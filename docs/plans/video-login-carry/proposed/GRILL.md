# video-login-carry — grill 决策记录（full）

## 缺陷事实（真机实证 2026-07-06，探针 `cases/_probe/dance-auth.mjs`）

replay-video 双 page 舞步真机回归：`casey run --login-bootstrap`（视频缺省开）下，
page1 登录成功后 page2 未继承登录态——Heren 登录态在 `sessionStorage`（页签级，实测 3 键；
`localStorage` 0 键、cookie 1 个不承载登录态），page2 `sessionStorage` 0 键、登录表单在场、
列表卡片 0 → 回放全事件 `locatorResolution: none`、四态全 `NEEDS_HUMAN(INDETERMINATE)`。
hermetic 未暴露根因：`login-sut` 是 cookie 会话（`sid=1`），cookie 本就 context 级共享，舞步金牌假绿通过。
对照实验：同用例 `--no-video`（单 page 路径）全链 PASS（run_1783303011618），病灶唯一钉在舞步。

## D1 修法通道（真岔，Steven 拍板）

- A（推荐）**登录态收割-注入**：page1 登录后 `evaluate` 收割该 origin 的 `sessionStorage` 快照（仅进内存），
  page2 `addInitScript` 限 origin 匹配种入后再 goto——登录键入仍只发生在 page1（不入镜结构不变），
  凭据红线：快照绝不落盘/日志/产物。
- B 弃舞步、单 page 起录前登录：`recordVideo` 是 context 级、page 一建即录 → 登录期必入镜，违 M6 卫生。否。
- C API 登录种 cookie：Heren 非 cookie 承载（实证），不可行。否。

**拍板：A（2026-07-06 Steven）。**

## D2 收割范围（机械）

仅 `sessionStorage`。`localStorage`/cookie 本就 context 共享无需收割；Heren 实证登录态即 3 键 sessionStorage。
收割时机 = `loginBootstrap(page1)` 归位后一次性；注入 = page2 创建后、首次 goto 前 `addInitScript`
（每次导航自动重种，SPA 同 origin 内导航天然覆盖）。

## D3 红金牌复现面（机械，红先行）

`tests/fixtures/login-sut/server.mjs` 加法式新模式（query 场景位先例）：登录成功改由页面脚本将
token 写入 `sessionStorage`、受保护 UI 仅在 token 在场时渲染（cookie 模式行为一字不动）。
红 = 现行舞步对 session 模式跑 `--video-dir + --login-bootstrap` → 复现全事件 `locatorError`；
绿 = 修后同跑全 PASS + `video.webm`/`video.json` 落盘。
涟漪：消费者金牌 4 份复跑（replay-login-bootstrap / replay-video / run-history / kinds-harden）+
`prd-replay-login-bootstrap` 夹具 checksum 重签 + 其 gate 复验。

## D4 凭据卫生（机械，机制强制）

收割快照仅存活于回放进程内存；`addInitScript` 参数不进任何 log/事件/产物。
金牌加负向断言：跑完后 axes/report/run-history/video.json 全文本不含 fixture token 字面量（防新泄漏面）。

## D5 非目标

不带 `--video-dir` 的单 page 路径零行为差；verdict/装配/报告零动；不做 cookie/localStorage 收割通道；
真机「保存」断言人裁（另案，publish-states 四停站内闭环）。
