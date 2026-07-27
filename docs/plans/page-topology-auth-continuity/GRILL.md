# page-topology-auth-continuity 决策记录

日期：2026-07-27
状态：acceptance-gate 冻结候选；尚未实现

## 问题

AI 中台进入智能体管理等操作可能打开新标签页或 popup。当前录制、编译、回放都持有一个固定 page：

- recorder binding/init script 只挂初始 page；
- replay 的 CDP、网络取证、pageerror 只挂初始 page；
- `events.schema` 已把 `newpage` 列为正式动作且要求 `url`，但 `replay-actions` 没有对应分支；
- tab 级 `sessionStorage` 只在录像登录舞步的第二个 page 上一次性注入，后续 context 新页没有统一覆盖；
- 固定旧 page 继续跑“元素缺席”断言时，可能在错误页面上得到假绿。

逻辑 origin 与 transport 混用由相邻契约处理；本契约只处理同一 BrowserContext 内的页面生命周期、活动页权威和认证连续性。

## 决策

### D1 Context 是生命周期边界

在创建第一个 page 前安装 context 级 page listener、binding 和 init script。初始页、popup、脚本新页都走同一注册路径；禁止只在某个 page 上挂 recorder 或认证注入。

### D2 页面身份只在进程内

每个真实 page 获得与 URL、标题、DOM 无关的 opaque `pageId`，并记录 opaque `openerPageId`。page 对象与 pageId 的绑定由模块私有 authority 保存。

正式 `events.json` 不新增 pageId/opener 字段，不修改现役 frozen schema。既有 `newpage + url` 是持久化拓扑事件；pageId/opener 只出现在脱敏运行期 receipt，不能被 JSON clone/forge 当 authority。

### D3 唯一活动页

任何动作、观察和断言都必须携当前 active page authority。旧 page、已关闭 page、clone authority 或非活动 opener 一律在调用 DOM 前拒绝。活动页变化只能由 page topology controller 完成，业务动作不得自行改全局 `page` 变量。

### D4 click handoff 的 0/1/>1

一次 click/dblclick 前建立 page generation 边界，动作后只统计本次新注册的 page：

- 0：保持当前页；
- 1：校验 opener、认证 origin 和页状态后切为活动页，产一条 `newpage` topology event；
- 大于 1：`PAGE_HANDOFF_AMBIGUOUS`，不得任挑一个，活动页保持 opener，路由 `NEEDS_HUMAN`。

click 的 DOM locator 仍走现役 0/1/>1 点击身份门；本决策统计的是“动作产生多少新 page”，不能与 locator candidateCount 混为一谈。

### D5 popup close 回 opener

活动 popup 关闭时，若其 opener 仍存活且 authority 有效，自动回到 opener；否则进入 `NO_ACTIVE_PAGE`/`OPENER_AUTHORITY_MISSING`，不得回落任意 context page。

### D6 认证连续性

登录完成后可铸造进程内 session seed authority，内部仅持 `{origin, entries}`：

- 每个 page 注册时、首次脚本执行前安装同一 init script；
- 脚本只在 `location.origin === capturedOrigin` 时逐条写 `sessionStorage`；
- `entries` 使用键值对数组，保留 `__proto__` 等特殊键；
- 新页提交到同 origin 才可成为活动页；
- cross-origin 新页不注入值，handoff 以 `AUTH_CONTINUITY_UNAVAILABLE` fail-closed；
- seed key/value 不得进入 event、receipt、trace、错误、日志或报告。

Cookie/localStorage 仍由 BrowserContext 自身共享，不复制。

### D7 所有页挂取证

每个已注册 page 恰挂一次 network/CDP、pageerror、dialog 和必要生命周期取证。新页在获得活动页资格前先挂取证；cross-origin 或 ambiguous 页也要留下工装诊断，但不能给 SUT_DEFECT 背书。

### D8 断言必须落活动页

断言执行入口先验证 active page authority，再调用 replay assertion。旧 opener 上的“元素缺席”不得作为 popup 当前状态的证据；authority 不符统一返回 `PAGE_AUTHORITY_STALE` 和 `NEEDS_HUMAN` 提示，不执行 assertion callback。

### D9 `newpage` 在三条管线中的语义

- 人工 record：触发动作后 context listener 产 `{action:"newpage", path:<脱敏 path+query>}`；
- source replay：消费该结构事件，确认本次 handoff 恰一、路径吻合、active authority 已切换；
- distill：`newpage` 是前一业务 intent 的结构事件，不生成独立用户 intent/atom；projection 必须保留；
- distilled replay：atom 动作后的结构 `newpage` 用同一 replay bridge 消费；
- source/distilled topology sequence 不等价时拒绝 promotion，禁止蒸馏静默丢页切换。

现役正式 schema 的 `newpage + url` 继续作为唯一 action 真值，不另造 `popup`/`switchPage` 同义动作。

### D10 文件边界

新增生产核心拆为：

- `lib/page-topology/session-seed.mjs`
- `lib/page-topology/controller.mjs`
- `lib/page-topology/topology-events.mjs`
- `lib/page-topology/record-bridge.mjs`
- `lib/page-topology/replay-bridge.mjs`

每个新增文件不超过 600 行。模块不 import Playwright、文件系统、网络、凭据装载器或 verdict；Playwright context/page 与取证安装器均由外围注入。已有超大执行文件只准薄接线，不再内嵌 topology 实现。

现役 `lib/replay-forensics.mjs` 保持小文件并新增 `attachPageForensics` adapter，统一安装 CDP/network/pageerror/dialog；`bin/replay.mjs` 只把它注入 controller，不再自行只挂初始 page。

## 不做

- 不启动 fake SUT、真实浏览器或连接真实目标；
- 不读取 `site.json`、`.auth/`、环境凭据；
- 不修改现役 events schema、断言、verdict 或报告；
- 不把纯 page/context double 称为 AI 中台已通过；
- 不支持跨 origin SSO/联邦登录自动续接；首版明确 fail-closed；
- 不在 acceptance-gate 阶段写生产实现、advance 或 commit。
