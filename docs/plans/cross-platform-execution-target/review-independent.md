# cross-platform-execution-target 独立实现复核

复核日期：2026-07-27
复核结论：**CHANGES_REQUIRED**

## 1. 范围与方法

本轮在两条实现 lane 声明冻结后，对当前工作树做独立只读对抗复核，覆盖：

- `lib/execution-target/{policy,authority,runtime,wiring,cli-boundary}.mjs`
- `lib/login-bootstrap.mjs`
- `bin/{record,replay,compile,doctor}.mjs`
- `lib/compile-atoms*.mjs`
- `lib/replay/*.mjs`
- cross-platform-execution-target 冻结 golden、checksum 与相邻零 SUT 回归

只使用源码检查、静态依赖检查和纯 Node 内存 double；未启动浏览器、fake/真实 SUT 或网络，未读取、展示真实 `site.json`、`.auth/` 或目标值。

复核重点不是“冻结测试是否变绿”，而是：

1. 页面来源错误后是否还会执行动作或产出可被当作成功的证据；
2. Windows/WSL 的实际 wiring 分支是否符合已拍板计划；
3. 登录填写、提交和“无需登录”返回前是否都保有来源证据；
4. 导航失败是否真正停止后续动作与成功产物；
5. 公开错误、日志和报告是否只含稳定脱敏信息；
6. 兼容入口是否绕过 CLI 准入；
7. 拆分后行为、依赖和 600 行结构门是否正常。

## 2. 阻塞发现

### Critical-1：replay 在“异源但 pathname 相同”时仍执行动作并记录 `unique`

位置：

- `lib/replay/event-runner.mjs:123-137`
- `lib/replay/event-runner.mjs:231-270`

当前非导航事件只在 `replayPathOf(page.url()) !== event.pre.path` 时恢复页面。`replayPathOf` 只保留 pathname，因此：

- 期望页为规范 origin 的 `/same`；
- 页面在前一步后异步漂移到另一 origin 的 `/same`；
- pathname 比较相等，跳过共享导航/origin guard；
- `dispatchAction` 仍被调用，动作轴可记录为 `unique`；
- 事件循环正常返回，后续 artifact finalizer 可继续生成 axes。

纯 Node double 复现结果：

```json
{"crossOriginSamePathDispatchCount":1,"actionResolution":"unique"}
```

影响：

- click/fill 等动作可能落在错误页面；
- 错误来源上的动作可被记录为成功动作证据；
- frozen R7 只覆盖显式 `goto` 后重定向，没有覆盖事件之间的异步来源漂移；
- `event.pre.path` 缺失时同样没有来源门。

建议：

1. 每个非导航动作 dispatch 前都调用共享 `verifyExecutionTargetPageOrigin`；
2. 来源不符时抛稳定 `ReplayNavigationAbort`，关闭错误页并终止整轮；
3. 代表步采证前再做一次来源复验，来源不符不得进入 artifact finalizer；
4. 增加“另一 origin + 相同 pathname”“无 `pre.path`”“前一步动作后异步漂移”三个零 SUT 棘轮，要求 dispatch=0、finalizer=0、无 axes。

### Critical-2：compile-atoms 在错误 origin 上仍可 fill，并给出 `unique`、零 blocker

位置：

- `lib/compile-atoms-run.mjs:105-195`

`emit` 仅在 `spec.action === "nav"` 时经过 `navigateExecutionTargetPage`。标准 fill/click/press/selectOption、`customAct` 和采证前都没有当前页面 origin 复验。

纯 Node double 令 authority 指向规范 origin、`page.url()` 固定返回另一 origin，再执行标准 fill，结果：

```json
{"crossOriginFillCount":1,"resolution":"unique","blockers":0}
```

影响：

- 编译期真实动作可落在错误站点；
- 错误站点动作可进入 `events`、`observed` 和 `verification`；
- 在其余步骤满足时，现有 execute 成品门不会因本步产生 blocker，可能落成功编译件。

建议：

1. `emit` 在所有真实动作（含 `customAct`）前统一复验 origin；
2. 动作后、`capture` 前再次复验，堵动作自身触发异源跳转后继续采证；
3. 来源不符应形成硬 blocker 并终止 flow，不得只记 note 后继续；
4. 增加标准 fill、click、customAct 三类错误来源探针，要求动作调用=0、成功产物=0。

### High-1：登录“未发现表单”分支可在异源页面上返回已登录

位置：

- `lib/login-bootstrap.mjs:97-119`

首次导航完成 origin 核验后，若初始 pathname 不是登录路径，代码等待账号框最多 3 秒。等待期间若页面异步漂移到另一 origin，且账号框未出现，catch 会把 `formVisible` 置为 false；随后第 114 行直接返回：

```js
{ loggedIn: true, viaForm: false }
```

此返回前没有再次调用 `verifyExecutionTargetPageOrigin`。

纯 Node double 复现结果：

```json
{"returnedLoggedIn":true,"returnedFailureReason":null,"pageCrossOriginAtReturn":true,"closeCount":0}
```

影响：

- 登录预备动作可能在错误页面上假报成功；
- record/replay/compile 调用方随后继续运行；
- 该缝与 Critical-1/Critical-2 组合后，可直接进入错误页面动作和采证路径。

建议：

1. 无论是否发现登录表单，任何 success return 前都再次复验当前 origin；
2. 账号框等待异常只表示“表单未证实”，不能同时充当“已登录且来源正确”的证据；
3. 增加“首跳同源，等待表单期间异源漂移”的冻结测试，要求 `loggedIn !== true`、close=1、fill/click=0。

### High-2：replay 把原始 `pageerror.message` 写入 axes，可泄漏规范目标地址

位置：

- `bin/replay.mjs:450-452`
- `lib/replay-axes.mjs:49-56`

网络 URL 已投影为 pathname，但 `pageerror` 的原始 message 被截取 200 字后原样保存，并原样写入 axes。浏览器错误 message 可以携带页面 URL。

纯投影复现把合成 canonical URL 放入 page error，结果：

```json
{"reportContainsCanonicalHost":true,"reportContainsScheme":true}
```

这违反：

- `plan.md`：规范站点地址不进入 receipt、错误、日志、报告；
- `GRILL.md` D1/D7：值不得进入公开报告，原始异常 message 不得穿透。

建议：

1. 在 page error 采集边界即投影为稳定类别，例如 `PAGE_ERROR` 加允许列表中的错误类型；
2. 若确需保留诊断摘要，必须使用统一 URL/凭据 scrubber，至少保证 scheme、host、port、query、fragment 不可进入产物；
3. 增加 axes pageerror URL-bearing seal 测试，而不只测三个 CLI 的 stderr。

### High-3：WSL 未显式选择 transport 时会自动进入 legacy-loopback

位置：

- `lib/execution-target/wiring.mjs:45-51`

GRILL D2 已拍板：

> WSL 可用 direct；只有显式选择时才进入其他方式。

当前 wiring 在 WSL 下，只要 `target.devProxyUrl` 与 CLI `--sut` 都是 loopback，就在没有 `transportMode` 的情况下自动推断 `legacy-loopback`。

纯 Node wiring 结果：

```json
{"name":"windows","inferredModeWithoutExplicitChoice":"direct","admitted":true,"reason":null}
{"name":"wsl","inferredModeWithoutExplicitChoice":"legacy-loopback","admitted":false,"reason":"ORIGIN_CONTINUITY_UNAVAILABLE"}
```

Windows 原生分支符合本轮目标，但 WSL 分支不符合“非 direct 必须显式选择”的决策；保留旧 `devProxyUrl` 的 WSL 配置会在登录连续性场景被意外拒绝，而不是走 direct。

建议：

1. 未配置 transport mode 时，所有受支持平台统一默认为 `direct`；
2. `legacy-loopback` 和 `origin-preserving-proxy` 只接受显式 mode；
3. doctor 对仅有旧 `devProxyUrl`、没有显式 mode 的配置给迁移提示，但不得替用户选 legacy；
4. 增加 wiring 级测试：WSL + canonical startUrl + devProxyUrl + loopback CLI + 无显式 mode，必须解析为 direct。

## 3. 已确认正常的部分

### 冻结门与 checksum

- PRD 中冻结的 GRILL、plan、red proof 和七个 golden 的 SHA-256 与当前文件逐项一致；
- cross frozen：31/31 通过；
- `output-seal-b5-prelaunch`：1/1 通过；
- page-topology adjacent：4/4 通过。

这些结果证明已冻结故事的显式样例通过，但没有覆盖本评审发现的时序漂移、同 pathname 异源、pageerror 报告泄漏和 WSL 隐式 mode 分支。

### 导航失败

- `navigateExecutionTargetPage` 的目标非法、`goto` 异常和跳转后 origin mismatch 均返回稳定原因；
- `goto` 异常现已 best-effort close；
- replay 显式导航/恢复失败会抛 `ReplayNavigationAbort`，在 artifact finalizer 前中止；
- compile 的显式 nav 失败会形成 blocker，成功 events/observed 不落盘。

阻塞问题不在显式 nav 失败路径，而在“页面之后自行漂移、下一步不是 nav”的路径。

### Windows/native 准入

- native Windows/Linux/macOS 缺 canonical `target.startUrl` 时，以 `LOGICAL_TARGET_REQUIRED` 在 launch 前拒绝；
- Windows 即使配置了 `devProxyUrl`，在没有显式 legacy mode 时仍走 direct；
- Windows 显式 legacy-loopback 被策略层拒绝；
- WSL 显式 legacy + continuity required 被拒绝；
- origin-preserving proxy 只把 endpoint 投影到 launch proxy，goto 保持规范 URL。

### CLI 与低层兼容

- record/replay/compile 的生产 CLI 路径都显式传入 execution target authority；
- `loginBootstrap` 与 `createCompileRun` 的低层兼容 fallback 只在 authority 缺省时启用，没有发现三个 CLI 通过该 fallback 绕过准入；
- 三 CLI 的 execution-target 最终错误使用稳定 reason 的共享输出边界。

兼容 fallback 仍扩大了低层 API 的可调用面，建议后续标为 deprecated，并在所有仓内脚本迁移完成后删除；本轮未把它单列为阻塞，因为当前 CLI wiring 没有走该分支。

### 拆分与结构

- 本范围生产文件与冻结 golden 均不超过 600 行；
- `bin/compile.mjs` 恰为 600 行，`bin/replay.mjs` 为 590 行；
- 24 个本范围模块的相对 import 图静态检查未发现依赖环；
- compile-atoms facade、replay event loop、artifact finalizer、navigation 和 history 的职责已拆开；
- 未发现拆分导致的显式导航恢复失败后仍 finalizer 的行为损失。

`bin/compile.mjs` 已处于硬上限，后续任何功能增量应继续拆分，不能再向该文件堆代码。

## 4. 第二轮必须补的独立门

修复后至少新增以下零 SUT 棘轮，再做第二轮独立复核：

1. replay：异源同 pathname，dispatch=0、finalizer=0；
2. replay：非 nav 事件没有 `pre.path` 且当前异源，dispatch=0；
3. replay：动作后异源漂移，代表步采证和 axes 写入均停止；
4. compile-atoms：标准 fill/click 在异源时动作=0、blocker>0、成功件=0；
5. compile-atoms：customAct 前后 origin gate；
6. login：表单等待期间异源漂移，success=false、close=1、凭据动作=0；
7. replay axes：pageerror message 含 URL 时产物不含 scheme/host/port/query/fragment；
8. wiring：WSL 未显式 mode 恒为 direct；显式 legacy 才进入 legacy 策略；
9. 保持现有 frozen checksum 门、31/31、相邻回归和逐文件 600 行门全绿。

在上述 Critical/High 问题修复并由第二轮探针证明前，本切片不能标为独立复核通过，也不应进入实机验收或发布。

## 5. 已执行探针的最小构造

以下均使用 `.invalid` 合成地址，只展示固化新 golden 所需的调用形状和关键 stub。实际复核时这些构造已由 Node 直接执行。

### 5.1 login：等待表单期间异源漂移

```js
const resolved = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://expected.invalid/app' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});

let current = 'https://expected.invalid/app';
let closeCount = 0;
const userBox = {
  first() { return this; },
  async waitFor() {
    current = 'https://other.invalid/app';
    throw new Error('not visible');
  },
  async fill() { throw new Error('must not fill'); },
};
const page = {
  async goto() { current = 'https://expected.invalid/app'; },
  url() { return current; },
  async close() { closeCount += 1; },
  getByRole() { return userBox; },
};

const result = await loginBootstrap(page, {
  site: {
    login: {
      pathMarker: '/login',
      user: { role: 'textbox', name: 'user' },
      pass: { role: 'textbox', name: 'pass' },
      submit: { role: 'button', name: 'submit' },
    },
  },
  creds: { user: 'x', pass: 'y' },
  startUrl: 'https://expected.invalid/app',
  executionTargetAuthority: resolved.authority,
});
```

当前关键断言：

```js
assert.equal(result.loggedIn, true); // 当前错误行为
assert.equal(new URL(current).origin, 'https://other.invalid');
assert.equal(closeCount, 0);
```

修复后应反转为稳定 origin failure、`loggedIn !== true`、`closeCount === 1`。

### 5.2 replay：另一 origin、相同 pathname 仍 dispatch

```js
let dispatchCount = 0;
const event = {
  stepId: 's1',
  intentId: 'i1',
  atom: 'agent.searchOpen',
  action: 'fill',
  value: 'x',
  pre: { path: '/same' },
};
const locator = {
  async count() { return 0; },
  first() { return this; },
  last() { return this; },
};
const page = {
  url() { return 'https://other.invalid/same'; },
  locator() { return locator; },
};

const evidence = await runReplayEvents({
  page,
  execution: {},
  args: {},
  events: [event],
  intentEvents: new Map([['i1', [event]]]),
  // 令本探针只测 dispatch seam，不进入代表步 DOM 采集。
  reprStepOf: new Map([['i1', 'not-s1']]),
  profile: {},
  ctx: { identityLedger: null },
  forensics: {
    records() { return []; },
    inFlightCount() { return 0; },
    async awaitStreamsSettled() {},
    async drain() {},
  },
  state: { currentStepId: null },
  guardAborts: [],
  expectedByIntent: new Map(),
  globalAssertions: [],
  countSelector: '.row',
  buttons: null,
  caseId: 'probe',
  videoStartedAt: Date.now(),
  log() {},
  async dispatchAction() {
    dispatchCount += 1;
    return { resolution: 'unique', identityReadback: { ok: true } };
  },
});
```

当前关键断言：

```js
assert.equal(dispatchCount, 1); // 当前错误行为
assert.equal(evidence.actionByStep.get('s1').resolution, 'unique');
```

修复后的 golden 应传入真实合成 authority/runtime，并断言 rejection、dispatch=0。另加一例删除 `pre`，仍应 dispatch=0。

### 5.3 compile-atoms：异源标准 fill 仍为 unique

```js
const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://expected.invalid/app' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
let fillCount = 0;
const locator = {
  first() { return this; },
  async waitFor() {},
  async count() { return 1; },
  async fill() { fillCount += 1; },
};
const page = {
  url() { return 'https://other.invalid/app'; },
  getByRole() { return locator; },
  locator() { return locator; },
  async evaluate(fn) {
    return String(fn).includes('innerHTML.length') ? 1 : [];
  },
};
const run = createCompileRun({
  page,
  forensics: { records() { return []; } },
  state: { currentStepId: null },
  sut: 'https://expected.invalid',
  uniqueName: 'x',
  site: {},
  profile: {},
  executionTargetAuthority: execution.authority,
  executionTargetRuntime: projectExecutionTargetRuntime(execution.authority),
});

const result = await run.emit({
  intentId: 'i1',
  atom: 'agent.searchOpen',
  action: 'fill',
  semantic: {
    kind: 'role',
    role: 'textbox',
    name: 'q',
    exact: true,
  },
  value: 'x',
});
```

当前关键断言：

```js
assert.equal(fillCount, 1); // 当前错误行为
assert.equal(result.resolution, 'unique');
assert.equal(run.blockers.length, 0);
```

修复后应为 fill=0、非 unique、硬 blocker，并由 execute 成品门证明 events/observed 不落盘。

### 5.4 wiring：WSL 无显式 mode 自动选 legacy

```js
const base = {
  site: {
    target: {
      startUrl: 'https://expected.invalid/app',
      devProxyUrl: 'http://127.0.0.1:2',
    },
  },
  cliSut: 'http://127.0.0.1:1',
  requiresOriginContinuity: true,
};
const windowsRuntime = { platform: 'win32', isWSL: false };
const wslRuntime = { platform: 'linux', isWSL: true };

const windowsRequest = buildExecutionTargetRequest({
  ...base,
  runtime: windowsRuntime,
});
const wslRequest = buildExecutionTargetRequest({
  ...base,
  runtime: wslRuntime,
});
const wslResult = resolveCliExecutionTarget({
  ...base,
  runtime: wslRuntime,
});
```

当前关键断言：

```js
assert.equal(windowsRequest.transport.mode, 'direct');
assert.equal(wslRequest.transport.mode, 'legacy-loopback'); // 当前计划违例
assert.equal(wslResult.reason, 'ORIGIN_CONTINUITY_UNAVAILABLE');
```

修复后 `wslRequest.transport.mode` 应为 `direct` 且准入成功；只有显式 `transportMode:"legacy-loopback"` 才应进入拒绝路径。

### 5.5 axes：pageerror 原文携 URL

最小输入只需一个 intent/step，并传：

```js
pageErrors: [{
  attributedStepId: 's1',
  message: 'failure at https://canonical-host.invalid/private',
}]
```

给 `projectReplayAxes` 的其余证据 Map 可为空，`intentEvents`/`reprStepOf`/`allStepIds` 只登记 `s1`。当前关键断言：

```js
assert.equal(text.includes('canonical-host.invalid'), true);
assert.equal(text.includes('https://'), true);
```

修复后两个断言都必须为 false，同时仍保留“该步发生 page error”的结构化事实。
