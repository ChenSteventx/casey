# cross-platform-execution-target 对抗式实现评审

## 1. 评审边界

本轮只读审查以下范围：

- `lib/execution-target/policy.mjs`
- `lib/execution-target/authority.mjs`
- `lib/execution-target/runtime.mjs`
- `lib/execution-target/wiring.mjs`
- `bin/record.mjs`
- `bin/replay.mjs`
- `bin/compile.mjs`
- `bin/doctor.mjs`
- 对应冻结测试与 `loop/prd-cross-platform-execution-target.json`

审查只使用合成地址、纯函数和静态检查；未读取真实站点配置或凭据，未启动浏览器、被测系统或网络连接。

## 2. 结论

当前冻结门全部通过，但存在一项 `Critical`、四项 `High` 和一项 `Medium`。其中导航后来源不一致仍会继续执行，是本轮不能进入下一阶段的首要阻断。

已确认成立的部分：

- Windows、原生 Linux、macOS 在规范逻辑目标存在时选择 `direct`，共享回环传输值不会覆盖规范地址；
- WSL `legacy-loopback` 且要求来源连续时会在启动前拒绝；
- `origin-preserving-proxy` 只把代理端点交给启动参数，导航仍使用规范地址；
- direct、proxy、legacy 三条纯运行时测试均保留 pathname、query 和 hash；
- 公开 receipt 是闭合分类字段，`authority` 的 clone、spread、JSON round-trip 和空对象伪造均被拒；
- 冻结文件的八项 SHA-256 与 PRD 一致。

这些通过项不能覆盖下列未被门禁观测的执行缝。

## 3. Findings

### `Critical`：导航后未核验实际页面来源，错误来源仍可继续登录和执行

证据：

- `lib/execution-target/runtime.mjs:22-41` 只等待 `page.goto(...)`，随后直接返回成功；没有读取 `page.url()`，也没有在错配时关闭页面或停止运行。
- `lib/login-bootstrap.mjs:73-94` 在首次导航后直接探测登录表单，并在 `87-89` 行填写凭据；来源校验缺席。
- `bin/record.mjs:160-165`、`bin/replay.mjs:518`、`bin/replay.mjs:590`、`bin/replay.mjs:651-660`、`bin/compile.mjs:360` 以及 `lib/compile-atoms.mjs:472-474` 均没有消费来源校验结果。
- 纯内存重定向哨兵返回：

```json
{
  "redirectOriginRejected": false,
  "redirectClosed": false
}
```

影响：

- 浏览器被重定向到错误来源后，Casey 仍可能把登录、录制、回放或编译当作正常流程继续；
- 登录路径会在来源被证明正确之前填写凭据；
- 错误来源上的页面状态可能形成动作事实或后续产物，造成错误目标上的假执行。

最小修复：

1. 在 `authority` 私有状态中增加规范化的预期浏览器来源；direct/proxy 取逻辑来源，允许降级的 legacy 取传输来源。
2. 新增只接受真实 `authority` 的统一导航函数。每次 `goto` 完成后，用 `new URL(page.url()).origin` 与预期来源做严格相等比较。
3. 错配固定返回 `NAVIGATION_ORIGIN_MISMATCH`，不得携带地址或原始异常；立即关闭页面或浏览器并停止当前 run，禁止回退回环地址。
4. `loginBootstrap` 必须在首次 `goto` 后、填写任何凭据前执行校验；提交登录后再校验一次。
5. record、replay、compile 的入口导航、事件导航、上下文恢复和 atom 导航全部经过同一个函数。

### `High`：原生环境缺规范逻辑目标时，共享回环地址会被当成 direct

证据：

- `lib/execution-target/wiring.mjs:39-43` 在 `target.startUrl` 缺失时直接把 `cliSut` 当作逻辑目标。
- `lib/execution-target/wiring.mjs:24-30` 对非 WSL 运行时默认返回 `direct`，没有区分规范逻辑目标和共享回环传输值。
- `bin/replay.mjs:342-373` 在未启用登录预备动作时令 `executionSite` 为 `null`，因此不消费共享站点中的规范目标；启用登录但目标缺失时还会用 `cliSut` 实例化事件入口。
- 纯内存哨兵返回：

```json
{
  "sharedCanonicalDirect": true,
  "nativeMissingCanonicalRejected": false
}
```

最小修复：

- 当运行时是 Windows、原生 Linux 或 macOS，规范逻辑目标缺失且 `cliSut` 命中共享配置中的回环传输值时，必须在浏览器启动前返回稳定拒因，例如 `LOGICAL_TARGET_REQUIRED`；
- replay 无论是否执行登录预备动作，都应读取同一份站点目标形态；凭据仍只在明确要求登录时读取；
- 不得把事件 URL 与回环 `cliSut` 合成后重新命名为逻辑目标。

### `High`：三入口没有共同调用运行时编排，静态门把“导入”误判为“已接线”

证据：

- `docs/plans/cross-platform-execution-target/plan.md:115-117` 要求录制、回放、编译共同调用 execution-target runtime。
- 全仓搜索 `openExecutionTarget` 只有 `lib/execution-target/runtime.mjs` 自身和运行时测试；生产入口没有调用。
- `tests/_golden/cross-platform-execution-target-boundaries.static.golden.mjs:110-118` 只检查四个入口是否 import 了名称含 `execution-target` 的模块，不能证明调用顺序或权威消费。
- `lib/compile-atoms.mjs:472-474` 仍执行 `this.sut + pathOfPlaceholder(spec.url)`。
- 同一静态门的 `120-130` 行只扫描三个 `bin` 文件，没有扫描实际执行 atom 导航的 `lib/compile-atoms.mjs`。

影响：

- `openExecutionTarget` 的稳定错误归一和今后的导航后来源校验无法自动覆盖生产入口；
- 三个入口继续各自维护 launch/goto 顺序，容易再次出现差异；
- 旧字符串重基址仍留在实际执行面。

最小修复：

- 把 resolve、launch、goto、来源核验和停止动作收敛为一条共享编排；
- 生产入口必须调用该编排或它导出的 authority-consuming 导航函数；
- 静态门检查真实调用点，不再只检查 import；
- 把 `lib/compile-atoms.mjs` 纳入旧重基址扫描，并删除 `this.sut + ...` 路径。

### `High`：命令行错误边界仍可能回显真实逻辑地址

证据：

- `bin/record.mjs:203-204`
- `bin/compile.mjs:364-365`
- `bin/compile.mjs:600`
- `bin/replay.mjs:1053-1054`

这些位置直接截取并输出原始异常 message。浏览器导航、重定向和代理异常可能在 message 中携带页面地址。`bin/compile.mjs:552` 还会转发 replay 的 stderr 尾部。

当前冻结测试只证明 `openExecutionTarget` 返回对象不回显 adapter 异常，没有覆盖三个生产命令的最终 stderr/stdout。

最小修复：

- 命令行最终 catch 只输出闭集稳定原因，不输出原始 message；
- compile verify 不原样转发 replay stderr；
- 诊断细节只使用不含地址的分类和阶段名。

### `High`：本次修改仍保留 1062 行的回放入口，违反用户的 600 行约束

实测行数：

```text
bin/record.mjs   206
bin/replay.mjs  1062
bin/compile.mjs  600
bin/doctor.mjs   216
```

`bin/replay.mjs` 是本次实际修改文件，差异为新增 60 行、删除 23 行。`docs/plans/cross-platform-execution-target/plan.md:119` 把既有超大文件拆分后置，与用户本 session 的明确约束冲突。`bin/compile.mjs` 虽恰好 600 行，也没有继续硬化所需的空间。

`tests/_golden/cross-platform-execution-target-boundaries.static.golden.mjs:45-59` 只检查三个新模块，不检查 wiring 或四个被修改入口。

最小修复：

- 先从 replay 拆出 execution-target 准入、登录预备、导航和来源校验接缝；
- 扩展行数门，覆盖本契约全部新增和修改文件；
- compile 的新增硬化进入小模块，不再继续扩写 600 行入口。

### `Medium`：doctor 可能把空或非法逻辑目标报告为 ready

证据：

- `bin/doctor.mjs:85-90` 只检查 `startUrl` 键是否存在，未检查它是否为非空合法 HTTP(S) URL；
- `lib/execution-target/wiring.mjs:99-104` 只对 `hasLogicalTarget` 做布尔判断。

因此 `startUrl:null`、空字符串或非法字符串可能在 doctor 中显示可准入，而真正执行时由 policy 拒绝。

最小修复：

- doctor 采集层只向纯分类器传递脱敏的 `validLogicalTarget` 布尔事实；
- 空值、非法协议、含用户信息的 URL 均分类为未就绪；
- 仍不输出目标值。

## 4. 建议新增的 RED

### R7：导航后来源错配

adapter double 的 `goto` 成功，但 `page.url()` 返回不同来源。期望：

- `ok:false`
- `reason:"NAVIGATION_ORIGIN_MISMATCH"`
- 不返回 receipt
- close/stop 恰调用一次
- 结果与输出不含任一地址哨兵

direct 和 origin-preserving proxy 都应覆盖；同来源内 pathname/query/hash 变化仍允许。

### R8：原生共享回环缺规范目标

对 Windows、原生 Linux、macOS 分别注入：

- 共享配置只有回环传输值，没有规范逻辑目标；
- `cliSut` 等于该共享回环值。

期望稳定拒绝且 launch/goto 均为零。另设正控：规范逻辑目标在场时仍是 direct，导航使用完整规范地址。

### R9：登录前来源校验

登录页 double 在首次 `goto` 后报告异源，并提供形状完全相同的账号、密码和提交控件。期望：

- 账号 fill 为零；
- 密码 fill 为零；
- 提交 click 为零；
- close/stop 恰一次；
- 返回稳定来源错配原因。

### R10：三入口共享接线

静态与注入门共同证明：

- record、replay、compile 均调用同一个 authority-consuming 导航函数；
- `loginBootstrap` 有填凭据前校验；
- `lib/compile-atoms.mjs` 不再出现 `sut/baseUrl + path`；
- 生产范围不存在绕过共享函数的裸 `page.goto`。

### R11：命令行输出封印

让 launch、goto、来源读取和 close double 分别抛出含合成地址哨兵的异常。对 record、replay、compile 捕获 stdout/stderr，期望：

- 只出现稳定 reason；
- 不出现 host、port、pathname、query、hash 或裸 scheme；
- 退出码非零；
- 错配路径不生成成功产物。

### B1 扩展：所有新增和修改文件不超过 600 行

至少覆盖：

- `lib/execution-target/*.mjs`
- `bin/record.mjs`
- `bin/replay.mjs`
- `bin/compile.mjs`
- `bin/doctor.mjs`
- 因本修复新增的支持模块

## 5. 实证结果

本轮真实执行：

```text
cross-platform-execution-target-core: 8/8
cross-platform-execution-target-runtime: 6/6
cross-platform-execution-target-boundaries: 5/5
cross-platform-execution-target-adjacent-regression: 4/4
output-seal-b5-prelaunch: GREEN
```

补充纯函数哨兵：

```text
Windows 共享配置含规范逻辑目标与回环传输：direct 且规范目标保留
原生环境缺规范逻辑目标：未拒绝
导航后实际来源错配：未拒绝
来源错配后的 close/stop：未调用
authority 公开键：0
runtime JSON 地址字段：0
事件 pathname/query/hash：完整保留
```

所以现有门禁的绿色结论只证明已冻结范围成立，不证明生产入口已经满足导航后来源一致、原生回环兜底拒绝或全部修改文件不超过 600 行。
