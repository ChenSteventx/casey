# video-login-carry — 修视频舞步登录态继承（full）

## 背景

replay-video 双 page 舞步真机回归（2026-07-06 tc_wf_publish_states 四停站首验发现）：Heren 登录态在
`sessionStorage`（页签级、page2 不继承，探针实证 page1 3 键 / page2 0 键 + 登录表单在场），带视频回放
全事件 `locatorResolution: none`；`--no-video` 对照全链 PASS，病灶唯一。hermetic 旧金牌假绿根因 =
`login-sut` 是 cookie 会话（context 级共享，舞步天然不破）。决策全表见 `proposed/GRILL.md`
（D1 收割-注入 Steven 拍板；D2–D5 机械确认）。

## 改动

1. `bin/replay.mjs` 舞步分支（仅 `--video-dir` 与 `--login-bootstrap` 同开路径）：
   - `loginBootstrap(page1)` 归位后收割：`page1.evaluate` 一次性取该 origin 的 `sessionStorage`
     全键值快照 + `location.origin`（快照仅进程内存，绝不 log/落盘——护栏 #7）；
   - page2 创建后、首次 `goto` 前 `page2.addInitScript(seed, { origin, snapshot })`：
     `location.origin` 恒等才种入（每次导航自动重种，SPA 同 origin 覆盖）；
   - 单 page 路径（无 `--video-dir`）与无 `--login-bootstrap` 路径零行为差（D5）。
2. `tests/fixtures/login-sut/server.mjs` 加法式 session 模式（cookie 模式一字不动）：
   - `GET /app-session`：页面壳 + 客户端脚本——`sessionStorage.getItem('sid')` 在场渲染
     「应用页 + 进入」按钮，缺席渲染既有登录表单（占位符/按钮文案与 /app 完全同形）；
   - `POST /api/login-session`：写登录标记（恒 '1'）+ 回 `{status:200, token:'t0k_fake_session'}`
     无 Set-Cookie；表单脚本收到后 `sessionStorage.setItem('sid', token)` + reload——
     纯页签级登录态，复刻 Heren 形态。
3. 新金牌 `tests/_golden/video-login-carry.golden.mjs`（红先行，isoEnv/假凭据 env 范式照 replay-video）：
   - S1 舞步收割-注入（实现前红）：session 模式 + `--login-bootstrap --video-dir` → exit 0、
     axes 步 `resolution: unique` + `actionPerformed`、`video.webm`/`video.json` 落盘（现状红：全 `none`）；
   - S2 凭据卫生负向：S1 产物（axes/run-history/run-metrics/video.json）+ stdout/stderr 全文本
     不含 `t0k_fake_session` 字面量（防收割引新泄漏面）；
   - S3 单 page 零差回归：session 模式 + `--login-bootstrap` 无 `--video-dir` → unique/performed
     （单 page 天然继承页签存储，修前修后恒绿，锁不破单 page 路径）。
4. `loop/prd-video-login-carry.json`：s1 = S1 红→绿 + tier1；s2 = S2/S3 + 涟漪回归锁。
   testChecksums 冻结新金牌 + `login-sut/server.mjs`（改后基线）。
5. 涟漪（共享夹具纪律）：`login-sut` 消费者金牌 4 份复跑（replay-login-bootstrap / replay-video /
   run-history / kinds-harden）；`prd-replay-login-bootstrap` 夹具 checksum 重签 + 其 gate 复验 GREEN。

## 非目标

cookie/localStorage 收割通道（context 级本就共享）；verdict/装配/报告零动；compile/--verify 路径零动
（不带录像无舞步）；真机「保存」断言人裁（publish-states 四停站另案闭环）；真机带视频复跑 =
observability route:human 停站（修完同行程执行）。

## 验收

新金牌 S1 实现前红（复现全 `locatorError`）、实现后 3/3 绿；4 份消费者金牌原样绿；
`prd-replay-login-bootstrap` 重签后 gate 复验 GREEN；`selftest --tier1` 无回归；gate GREEN。
真机带视频复跑 publish-states 挂 observability（route:human，同行程收 task 6）。
