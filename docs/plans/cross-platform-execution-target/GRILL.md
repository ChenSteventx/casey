# cross-platform-execution-target 决策记录

日期：2026-07-27
状态：首轮实现后的 acceptance-gate 加固候选；R7–R11 尚未实现

## 问题

当前录制、编译和回放把浏览器应看到的站点地址与 WSL 到 Windows 的网络转发地址合并成一个 `sut`/`baseUrl`。这会让浏览器实际 origin 改成回环地址，并丢失 query/hash；若登录态依赖 origin 或 tab 级 `sessionStorage`，表现就是“跳转后掉登录”。Windows 原生执行仍可能被错误地喂入 WSL 回环地址。

弹窗/新标签页没有被接管是另一条已确认根因。本契约只修地址与传输权威，不用地址修复冒充 page topology 已完成。

## 决策

### D1 输入分离

生产核心接收两份独立的进程内输入：

- `logicalTarget.startUrl`：浏览器可见的规范站点地址；
- `transport`：`direct`、`legacy-loopback` 或 `origin-preserving-proxy`。

核心模块不读取 `site.json`、`.auth/`、环境变量或文件系统。外围现有装载器只能把已装载值注入核心，值不得进入公开 receipt、错误、日志或报告。

### D2 平台分类

- Windows、原生 Linux、macOS 的默认方式都是 `direct`，浏览器导航到规范站点地址；
- WSL 可用 `direct`；只有显式选择时才进入其他方式；
- Windows 原生选择 `legacy-loopback` 是配置/平台不匹配，必须在浏览器启动前拒绝；
- WSL 的 `legacy-loopback` 会改变浏览器可见 origin。凡声明 `requiresOriginContinuity:true` 的场景，必须在浏览器启动前拒绝；
- `origin-preserving-proxy` 是预留能力：传输端点只交给浏览器代理配置，页面仍导航到规范站点地址。

### D3 URL 策略

- pathname 与 search 必须原样保留；
- hash 供浏览器导航保留，兼容 SPA 路由；
- hash 不进入网络请求身份、代理选择或 origin 判断，因为 HTTP 请求不发送 fragment；
- 禁止用 `new URL(startUrl).pathname` 后再拼另一个 base，也禁止 `sut + pathOf(...)` 一类重基址。

### D4 进程内 authority

解析成功只公开冻结的脱敏 receipt 和不可序列化、不可克隆复用的进程内 authority。真实地址只能由 runtime 通过 authority 交给注入的 browser adapter。JSON 序列化结果、失败原因和异常归一结果不得含协议、host、path、query、fragment 或 transport endpoint 原值。

### D5 启动前准入

平台/方式不匹配、缺 transport endpoint、非法 URL、origin 连续性不成立均先拒绝，再允许 browser adapter 的 `launch`。adapter 自身抛错必须归一为稳定原因码，不能转抛包含目标值的原始 message。

原生 Windows/Linux/macOS 若只有 shared loopback/dev proxy 值而没有 canonical `target.startUrl`，不得把 loopback 降格当逻辑目标；固定以 `LOGICAL_TARGET_REQUIRED` 在 launch 前拒绝。CLI 的 `--sut` 在此情形只能代表 transport 兼容输入，不能补造 canonical target。

### D6 导航后 origin 核验

`goto` 成功只说明调用返回，不说明页面仍位于获准 origin。所有导航必须经 `runtime.mjs` 的 `navigateExecutionTargetPage`：先由 authority 约束请求目标，导航后读取 `page.url()`，将实际 `.origin` 与 authority 的 browser-visible origin 精确比较。

- 同 origin 的 path/query/hash 改变允许；
- 跨 origin、实际 URL 不可读或不可解析统一为 `NAVIGATION_ORIGIN_MISMATCH`；
- 失败不返回 receipt 或地址，page best-effort `close` 恰一次；
- 登录首跳必须先核验再取得 locator/填凭据/点击，跨 origin 时三者调用均为 0；
- 登录提交后的导航也必须核验，防止认证流程把执行带到未知 origin。

### D7 单一导航与输出边界

record、replay、compile、loginBootstrap、compile-atoms 的导航统一调用共享 guard；禁止 raw `page.goto`、`this.sut + pathOfPlaceholder(...)` 和其他旧 rebase。`openExecutionTarget` 自身也必须调用该 guard。

record/replay/compile 的最终 catch、URL-bearing adapter 异常和子进程错误输出统一交给 `cli-boundary.mjs`。公开 stdout/stderr 只含闭集稳定 reason 和命令分类，原始 `e.message`/`stderr` 不得直接穿透。

### D8 文件边界

新增生产核心拆成：

- `lib/execution-target/policy.mjs`：纯策略与 URL 校验；
- `lib/execution-target/authority.mjs`：进程内 authority；
- `lib/execution-target/runtime.mjs`：唯一 browser adapter 编排和导航 origin guard；
- `lib/execution-target/cli-boundary.mjs`：CLI 脱敏失败输出。

本契约新增或修改的每个生产/golden 文件都不超过 600 行。纯层不得依赖 Playwright、IO、网络或现有 replay/compile 大文件。因为本轮必须修改 `bin/replay.mjs` 与 `lib/compile-atoms.mjs`，其当前超限不能再作为“后续债”豁免，须先拆分后接线。

### D9 相邻但不混入

新标签页/弹窗接管、活动页选择、tab 级 `sessionStorage` 续接、同一 `BrowserContext` 的登录连续性需要独立 page-topology 契约和真实站点 UAT。本契约完成只能消除 origin/transport 混用，不能宣称“所有跳转掉登录”已解决。

## 明确不做

- 不读取、复制或展示真实 `site.json`/`.auth/`；
- 不启动 fake SUT、浏览器或连接真实站点；
- 不改变凭据、裁定和报告语义；
- 不在 acceptance-gate 阶段修改任何生产实现；
- 不把 WSL 反向监听器宣称为 origin-preserving proxy。
