# cross-platform-execution-target 实施计划

## 1. 目标

把浏览器可见的逻辑目标地址与网络传输方式拆成两份权威输入，消除原生平台误走回环地址、WSL 回环改 origin、路径重基址丢 query/hash 三类问题。该切片先形成确定性闭环，后置真实站点 page topology 与登录续接验收。

决策细节见 `docs/plans/cross-platform-execution-target/GRILL.md`。

## 2. 不变量

1. 规范站点地址只在进程内流转，不进入 receipt、错误、日志、报告。
2. Windows、原生 Linux、macOS 的 direct 导航保持规范 origin。
3. Windows + legacy loopback 在 browser launch 前拒绝。
4. WSL + legacy loopback + origin continuity required 在 browser launch 前拒绝。
5. future origin-preserving proxy 只改变 browser launch 的代理配置，不改变页面导航 URL。
6. pathname、search 和浏览器所需 hash 保留；hash 不参与网络身份。
7. 无法确定的平台、方式、URL 或 authority 一律 fail-closed。
8. 新增生产文件逐个不超过 600 行，并保持纯策略、authority、runtime 三层解耦。
9. 本契约零 SUT、零浏览器、零网络，所有地址均为测试内合成哨兵。
10. `goto` 返回不等于导航可信；每次导航后必须读取浏览器实际 URL，按 authority 的期望 origin 精确核对。
11. origin 不匹配必须返回 `NAVIGATION_ORIGIN_MISMATCH`、不返回 receipt、best-effort `close` 恰一次；登录首跳不匹配时凭据 fill/click 必须为 0。
12. 原生 Windows/Linux/macOS 收到 shared loopback 且没有 canonical `target.startUrl` 时，必须以 `LOGICAL_TARGET_REQUIRED` 在 launch 前拒绝。
13. 确定性导航只允许经过共享 origin guard；record/replay/compile/loginBootstrap/compile-atoms 禁止 raw `goto` 和旧 rebase。
14. 本契约新增或修改的生产、golden 文件均不超过 600 行；不再把既有大文件拆分后置。
15. CLI 的 stdout/stderr 只允许稳定 reason，不允许原始异常或子进程 stderr 携带目标 URL 片段穿透。

## 3. 冻结 API

### 3.1 纯解析

`lib/execution-target/authority.mjs` 导出：

```js
resolveExecutionTarget({
  runtime: { platform, isWSL },
  logicalTarget: { startUrl },
  transport: { mode, endpoint? },
  requiresOriginContinuity
})
```

成功返回：

```js
{
  ok: true,
  authority,
  receipt: {
    schemaVersion: 1,
    runtimeClass,
    transportMode,
    originContinuity,
    fragmentPolicy
  }
}
```

receipt 只允许上述脱敏分类字段。authority 必须冻结、无可枚举地址字段；clone/spread/JSON round-trip 后不得被 runtime 接受。

失败返回 `{ok:false, reason}`。固定原因至少覆盖：

- `RUNTIME_UNSUPPORTED`
- `LOGICAL_TARGET_INVALID`
- `TRANSPORT_MODE_INVALID`
- `TRANSPORT_ENDPOINT_REQUIRED`
- `TARGET_TRANSPORT_MODE_MISMATCH`
- `ORIGIN_CONTINUITY_UNAVAILABLE`
- `EXECUTION_TARGET_AUTHORITY_INVALID`
- `BROWSER_LAUNCH_FAILED`
- `NAVIGATION_FAILED`
- `NAVIGATION_ORIGIN_MISMATCH`
- `LOGICAL_TARGET_REQUIRED`

失败对象不得携带输入原值或原始异常 message。

### 3.2 runtime 编排

`lib/execution-target/runtime.mjs` 导出：

```js
openExecutionTarget({ request, adapter })
navigateExecutionTargetPage({ page, authority, targetUrl, gotoOptions? })
```

adapter 最小协议：

```js
const page = await adapter.launch({ proxyServer? });
await page.goto(browserVisibleUrl);
const actualUrl = page.url();
await page.close(); // 仅拒绝路径 best-effort
```

准入失败时 `launch` 调用次数必须为 0。direct 不传 proxy；origin-preserving proxy 把 endpoint 仅作为 `proxyServer` 传给 launch，goto 仍接收规范 URL；允许降级的 legacy loopback 才会把 endpoint 作为浏览器可见 base，但 receipt 必须标记 `originContinuity:"degraded"`。

`navigateExecutionTargetPage` 是唯一导航入口：先验证 `targetUrl` 受 authority 约束，再执行导航，随后读取 `page.url()` 并将实际 `.origin` 与 authority 的 browser-visible origin 精确比较。同 origin 的 path/query/hash 变化允许；跨 origin、实际 URL 不可读或不可解析均 fail-closed 为 `NAVIGATION_ORIGIN_MISMATCH`，失败对象无 receipt/URL，且 page best-effort close 恰一次。`openExecutionTarget` 必须调用它，不能自行 `goto`。

### 3.3 CLI 输出边界

`lib/execution-target/cli-boundary.mjs` 导出：

```js
emitExecutionTargetCliFailure({ command, failure, stdout, stderr })
```

仅接受 `record`、`replay`、`compile` 和闭集稳定 reason，写入不含协议、host、port、path、query、fragment 的脱敏文本并返回确定性非零退出码。三个 CLI 的 URL-bearing 异常、最终 catch 与子进程 stderr 均须经过该边界。

### 3.4 登录边界

`loginBootstrap` 接收 `executionTargetAuthority`。首跳必须调用共享 origin guard 并在任何 locator/fill/click 之前完成；登录提交导致的后续导航也必须核对实际 origin。首跳不匹配时返回稳定拒绝，凭据 fill 与 submit click 调用数必须为 0。

## 4. 实施顺序

### S1 纯策略

新增 `policy.mjs`：

- 规范化 runtime class；
- 校验 URL 与 transport 枚举；
- 决定准入结果和 origin continuity；
- 生成内部 navigation/transport 投影；
- 保留 pathname+search+hash，明确 fragment policy。

### S2 authority

新增 `authority.mjs`：

- 用模块私有存储绑定内部投影；
- 对外只给冻结 receipt 与 opaque authority；
- 拒绝 clone/forge/tamper；
- 统一失败 reason，禁止回显输入。

### S3 runtime

新增 `runtime.mjs`：

- 必须先 resolve，再 launch；
- 只从真实 authority 取内部投影；
- adapter launch/goto 异常归一并脱敏；
- goto 后读取 browser-visible URL 并精确验证 origin，失败 close 一次且不发 receipt；
- direct、legacy-loopback、origin-preserving-proxy 各走单一确定性分支。

### S4 接入

录制、回放、编译、登录预备和 compile-atoms 共同调用 `navigateExecutionTargetPage`，不再各自导航或重建 URL。doctor 只输出平台/方式/连续性分类和补救建议，不输出目标值。旧 `sut + pathname`、`sut + pathOf(...)`、`this.sut + pathOfPlaceholder(...)`、只取 pathname 的重基址路径及 raw `page.goto` 全部移除。record/replay/compile 的失败输出共同调用 CLI 输出边界。

本切片会修改的所有生产文件和新增 golden 均必须逐文件不超过 600 行。当前 `bin/replay.mjs` 与 `lib/compile-atoms.mjs` 必须先拆分再接入，不能把结构门后置成技术债。

### S5 实机验收

在用户提供的真实环境执行，且报告不得展示真实地址：

1. Windows 原生 direct；
2. Linux 原生 direct；
3. macOS direct；
4. WSL direct；
5. WSL legacy loopback + continuity required 必须启动前拒绝；
6. origin-preserving proxy 就绪后再验 WSL 代理路径；
7. AI 中台带 query/hash 的页面；
8. AI 中台“进入智能体管理”若新开标签页，转交 page-topology 后继契约验证登录连续性。

本阶段不以模拟站点替代以上实机结论。

## 5. 验收映射

| Story | 可执行验收 | 实现前预期 |
|---|---|---|
| S1/S2 | `node tests/_golden/cross-platform-execution-target-core.zero-sut.golden.mjs` | GREEN：首轮实现的纯策略/authority 基线保持 |
| S3/R7/R8 | `node tests/_golden/cross-platform-execution-target-runtime.zero-sut.golden.mjs` | RED：导航后未核对实际 origin；native 缺 canonical 仍 launch |
| R9 | `node tests/_golden/cross-platform-execution-target-login-origin.zero-sut.golden.mjs` | RED：登录首跳跨 origin 后仍填凭据/提交 |
| S4/R10/结构门 | `node tests/_golden/cross-platform-execution-target-boundaries.static.golden.mjs` | RED：共享 guard/CLI 边界缺失、raw goto/旧 rebase 仍在、改动文件超 600 行 |
| R11 | `node tests/_golden/cross-platform-execution-target-cli-output-seal.zero-sut.golden.mjs` | RED：共享 CLI 输出封口缺失，现役入口仍直接输出原异常 |
| 邻接回归 | `node tests/_golden/cross-platform-execution-target-adjacent-regression.zero-sut.golden.mjs`、`node tests/_golden/output-seal-b5-prelaunch.zero-sut.golden.mjs` | GREEN；仅纯注入/合成配置，且在 browser launch 前短路 |

## 6. 可观测性与人工路由

- AI 中台、医生站、Hi 小助的真实可达性与身份系统差异：route human。
- popup/new tab 的活动页接管与 tab 级 session storage：route human，归 page-topology 后继契约。
- future origin-preserving proxy 的真实 DNS/TLS/Host 行为：route human，代理实现落地前不得假绿。
- 四平台真机矩阵：route human；zero-SUT 只证明策略和调用顺序。
- 真实目标配置的迁移兼容性：route human；门禁绝不读取真实配置。

## 7. acceptance-gate 交付边界

本工序只修改本计划/决策记录、冻结 golden、红证和独立 PRD。R7–R11 能力门必须真实 RED，邻接回归与现役 prelaunch 回归必须真实 GREEN；所有冻结文件写入 SHA-256，`gate --dry` 可消费且所有 `passes` 保持 false。不得实现功能、不得推进 contract、不得提交。
