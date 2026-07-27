# cross-platform-execution-target 第二轮独立复核

复核日期：2026-07-27
总体结论：**CHANGES_REQUIRED**
实现结论：**五处独立复核缺陷及两个后续旁路均已修复，cross/topology 本范围门通过；但仓库既有 Test Ratchet 尚有 2 条真实红项，未完成受控 rebaseline 前不能宣称整体回归或发布就绪。**

## 1. 范围与约束

本轮在实现方声明共享树冻结后，对当前工作树做独立只读复核，覆盖：

- execution-target policy、authority、runtime、wiring 与 CLI 输出边界；
- login bootstrap；
- replay event runner、导航、动作分发、page topology 接线与 axes 投影；
- compile run、标准动作、复合下拉动作与 openTestPanel 重试；
- record/page-topology 的最终相邻接线；
- cross-platform-execution-target 与 page-topology-auth-continuity 两份冻结 PRD；
- 首轮独立复核发现的五处缺陷及第二轮发现的两个窄补丁旁路。

只运行纯 Node、静态依赖/行数/checksum 检查。未启动浏览器、fake/真实 SUT 或网络，未读取或展示真实 `site.json`、`.auth/`、凭据或目标值。

本结论不能替代 Windows、Linux、macOS、WSL 和 AI 中台真实环境 UAT。

## 2. 首轮五处缺陷的复核结果

### Critical-1 replay 异源页面继续动作：已修复

当前接线：

- 每个非导航事件在任何 DOM 观察前核对当前 origin；
- pathname 恢复前独立核对 origin，`pre.path` 缺失不能绕过；
- locator/route 等异步准备后、真正 dispatch 前再次核对；
- 代表步 settle 前与 settle 后、真正读取断言证据前分别核对；
- mismatch 抛稳定 `ReplayNavigationAbort`，event runner 不正常返回。

独立探针结果：

1. 当前页为另一 origin、事件没有 `pre.path`：
   - DOM 观察 = 0；
   - dispatch = 0；
   - close = 1；
   - `NAVIGATION_ORIGIN_MISMATCH`。
2. dispatch 自身导致异源漂移：
   - 本次 dispatch = 1；
   - 后续代表步采证不可达；
   - 顺序 finalizer 计数 = 0；
   - close = 1。
3. 页面在 settle 窗口内漂移：
   - settle 后 origin 门拒绝；
   - 断言 DOM 采集不可达；
   - finalizer = 0；
   - close = 1。
4. frozen 同 pathname 异源用例：
   - dispatch = 0；
   - close = 1；
   - stable abort。

结论：首轮 Critical-1 已闭合。

### Critical-2 compile-atoms 异源动作仍为 unique：已修复

当前接线：

- 所有非导航 emit 在动作分支前核对 origin；
- locator count 后、标准 fill/press/dblclick/click 的物理动作前再次核对；
- 已动作后再次核对；
- quiet window 后、capture 前再次核对；
- mismatch 把动作降为 `action_failed`、`acted:false`，加入硬 blocker；
- compileFlow 遇新增 blocker 后停止后续 flow step；
- openTestPanel 的“首击被吞后重试”在重试前后均走相同 origin admission。

独立标准 fill 探针：

| 场景 | fill 次数 | close | 结果 | blocker |
|---|---:|---:|---|---:|
| 动作前已异源 | 0 | 1 | `action_failed / acted:false` | ≥1 |
| fill 导致异源漂移 | 1 | 1 | `action_failed / acted:false` | ≥1 |
| quiet window 内漂移 | 1 | 1 | `action_failed / acted:false` | ≥1 |

openTestPanel 重试探针：

- 首次同源 click = 1；
- 等待消息框期间漂移；
- 重试前 origin 门拒绝；
- 第二次 click = 0；
- close = 1；
- blocker ≥1。

结论：首轮 Critical-2 的标准动作和已知裸重试旁路已闭合。

### High-1 login 表单等待窗漂移误报已登录：已修复

login bootstrap 在表单探测完成后、`loggedIn:true/viaForm:false` 返回前再次核对 origin。

独立探针结果：

- 首跳同源；
- 等待账号框期间漂移到另一 origin；
- 返回 `ok:false / NAVIGATION_ORIGIN_MISMATCH`；
- close = 1；
- user fill = 0；
- password fill = 0；
- submit = 0。

结论：High-1 已闭合。

### High-2 pageerror 原文泄漏目标地址：已修复

首轮方案只识别带 scheme 的 URL，第二轮对抗探针证明无 scheme 的 `host:port/path?query#fragment` 仍可泄漏。最终实现不再猜测自由文本是否“像 URL”：

- 保留 pageerror 数量；
- 保留 `attributedStepId`；
- 保留允许列表中的错误类；
- 自由文本一律投影为 `<redacted:pageerror>`。

独立探针覆盖：

- 完整 `https://host:port/path?query#fragment`；
- 无 scheme 的 `host:port/path?query#fragment`；
- 普通 TypeError/RangeError 文本。

结果：

- host、port、path 哨兵、query 哨兵、fragment 哨兵均不进入 axes；
- 两条输入仍投影为两条 pageerror；
- 归因仍在；
- 错误类分别保留；
- verdict/report 所依赖的“本步是否存在 pageerror”结构事实未丢失。

结论：High-2 地址泄漏已闭合。

### High-3 WSL 隐式进入 legacy-loopback：已修复

当前 wiring：

- 未显式配置 transport mode 时统一选择 `direct`；
- 顶层 `target.transportMode` 可显式选择 legacy；
- 嵌套 `target.transport.mode` 可显式选择 legacy；
- 显式 legacy 且不要求 origin continuity 时准入并标 `degraded`；
- 显式 legacy 且要求 continuity 时以 `ORIGIN_CONTINUITY_UNAVAILABLE` 拒绝。

独立正负控全部通过：

1. WSL + canonical + devProxy + 无 mode → direct/preserved；
2. WSL + 显式 legacy + continuity false → legacy/degraded；
3. WSL + 显式 legacy + continuity true → prelaunch reject；
4. nested explicit mode 不丢失。

结论：High-3 已闭合，显式 legacy 兼容能力未被“全部写死 direct”的窄补丁破坏。

## 3. 第二轮新增旁路的复核结果

### 3.1 复合 selectOption 的两次物理 click：已修复

第二轮首次探针证明，若下拉 trigger click 导致异源导航，旧修复会在整个 atom 结束后才发现；option click 已可能落到错误页面。

最终实现：

- compile selectOption 在 trigger click 前核对；
- compile selectOption 在 option click 前再次核对；
- replay 的 production ctx 注入 execution authority 派生的 action-origin admission；
- replay 通用 selectOption 在 trigger 与 option 两次物理 click 前分别 admission。

最终独立探针：

| 路径 | trigger click | 错误 origin option click | close | finalizer/成功结果 |
|---|---:|---:|---:|---|
| compile | 1 | 0 | 1 | `action_failed` + blocker |
| replay production-style ctx | 1 | 0 | 1 | finalizer = 0 |

结论：已知复合下拉 TOCTOU 旁路已闭合。

### 3.2 pageerror 裸 host：已修复

第二轮首次探针：

```json
{"hostLeaked":true,"queryLeaked":true,"fragmentLeaked":true}
```

最终 class-only 投影下，同一探针三项均为 false，结构化 pageerror 事实仍完整。该旁路已闭合。

## 4. 正式门结果

### cross-platform-execution-target

- core：8/8；
- runtime：8/8；
- login-origin：1/1；
- boundaries：9/9；
- CLI output seal：1/1；
- adjacent regression：4/4；
- independent-review hardening：5/5。

合计：**36/36 GREEN**。

### page-topology-auth-continuity

- adjacent regression：4/4；
- boundaries：7/7；
- controller：7/7；
- delayed-popup / binding-arrival race：5/5；
- pipeline：6/6；
- replay-action：3/3；
- session：5/5。

合计：**37/37 GREEN**。

`output-seal-b5-prelaunch`：1/1 GREEN。

本轮最终正式测试文件：**15/15 exit 0，共 74 项通过**。

## 5. 冻结、结构与依赖

- cross PRD 冻结 checksum：12 项，0 mismatch；
- page-topology PRD 冻结 checksum：13 项，0 mismatch；
- 本范围静态 import 图：38 个模块，0 dependency cycle；
- `git diff --check`：通过；
- 本范围生产文件与 golden 均不超过 600 行。

当前较大文件：

| 文件 | 行数 |
|---|---:|
| `bin/compile.mjs` | 600 |
| `bin/replay.mjs` | 580 |
| `lib/page-topology/controller.mjs` | 549 |
| `lib/replay-actions/workflow-drawer.mjs` | 536 |
| `lib/replay/event-runner.mjs` | 518 |
| `lib/compile-atoms-workflow-drawer.mjs` | 479 |
| `lib/page-topology/record-bridge.mjs` | 405 |

结构门满足，但 `bin/compile.mjs` 已在硬上限；任何后续增量必须继续拆分。

## 6. 仍然真实存在的红项

运行既有 `agent-id-regression-diff.zero-sut.golden.mjs`：

- R1–R19：GREEN；
- R20 `projectReplayAxes` 固定字节面：RED；
- R21 verdict → report 固定字节面：RED；
- 汇总：19/21 通过，2/21 未过，进程 exit 1。

根因不是五处缺陷仍未修，而是 pageerror 从原始自由文本改为“错误类 + 稳定占位”后，既有 byte baseline 按设计发生变化。该变化是修复目标地址泄漏所必需，不能为了旧字节绿而恢复原始 message，也不能把两条红项隐藏成“无回归”。

必须完成的后续动作：

1. 对 R20/R21 做受控差分，证明字节变化只来自 pageerror message 的新投影；
2. 走既有 Test Ratchet / successor acceptance 流程批准新契约；
3. 更新对应 baseline 与 manifest/checksum；
4. 重跑至 R1–R21 全绿；
5. 在此之前不得宣称仓库整体回归绿或发布就绪。

因此本轮给出：

- **实现修复：PASS**；
- **cross/topology 本范围冻结门：PASS**；
- **整体合入/发布就绪：CHANGES_REQUIRED**。

## 7. 仍需人工验收的边界

以下维度未由本轮纯 Node 复核证明：

- Windows 原生 direct；
- Linux 原生 direct；
- macOS direct；
- WSL direct 与显式 legacy 拒绝；
- AI 中台频繁更新后的 query/hash、智能体管理 popup/new tab 与登录连续性；
- 医生站与 Hi 小助的容器/认证差异；
- origin-preserving proxy 的真实 DNS/TLS/Host 行为；
- 人工录制 → 原始成功回放 → 蒸馏原子 → 蒸馏后成功回放的实机闭环。

这些必须按计划 route human，并以真实回放、产物和用户验收为准；当前第二轮 PASS 子结论不得外推成实机验收完成。
