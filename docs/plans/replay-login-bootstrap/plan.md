# replay-login-bootstrap — 回放器登录预备动作（light）

## 背景 / 为什么现在

P3 tier-2 真机 bring-up 已产出第一份完整 events/observed（三跑 2026-07-02），但 `compile --verify` 直喂 `bin/replay.mjs`、回放器无登录预备动作 → 真机必撞登录墙（HANDOFF 已知缺口第 7 条）。同一缺口也挡住相 3 真机回放（`casey run` 与回放核验第二轮）。方案分岔已人签（Steven，2026-07-02）：取「replay 登录预备动作」、弃 storageState 移交——理由：CONTEXT.md 已登记术语「登录预备动作：回放/编译开始前把浏览器带到已登录态的开场步」，领域语言本就预留回放侧；凭据只进内存不落盘（护栏 #7）；跨时重跑不怕会话过期。

## 范围（三处，全部加法）

1. `lib/login-bootstrap.mjs`：`loadCreds` 凭据文件路径加 `AT_CREDS_FILE` env 覆盖（与 `AT_SITE_JSON` 同范式）。动机双重：hermetic 测试必须能把凭据源隔离到假文件——否则「缺凭据」「假凭据」两方向都会读到仓里真 `.auth/credentials.json`，把真凭据填进假 SUT（红线）；真机侧多环境凭据切换同受益。
2. `bin/replay.mjs`：加 opt-in 旗标 `--login-bootstrap`。
   - 前置（浏览器启动前）：`loadSiteConfig()` + `loadCreds()`，任一失败 → stderr 一句（不含凭据值）+ exit 65（fail-closed，与坏输入同码）。
   - 登录入口 = `--sut` 基址 + site.json `target.startUrl` 的路径段（真机实采教训：裸基址不渲染登录表单，SPA 判据会 fail-open）；无 `startUrl` 退 events 信封 url 路径段，再退 `/`。
   - 执行点：forensics 接线后、事件循环前调 `loginBootstrap(page, …)`——此期 `currentStepId=null`，登录期流量一律归 null 不背书（护栏 #14/#15，spike 已验此归因语义）；不产 event、不进 axes（axes 步只源于 events）；登录失败 → 关浏览器 + exit 65，不落 axes。
   - 缺省（无旗标）行为一字不变：p5 已冻 golden 原样复跑全绿即证。
3. `bin/compile.mjs`：`--verify` 段 spawn `bin/replay.mjs` 时透传 `--login-bootstrap`（仅当调用方给了旗标）；用法注释同步。

## 非目标

- 不做 storageState 移交（已人签弃）；不改 `lib/login-bootstrap.mjs` 登录判据本体；不碰 `verdict.mjs`/冻结 golden；不改回放看门狗时长；真机核验第二轮（route:human）不在本契约内、走 P3 挂账。

## 验收（红先行）

新 golden `tests/_golden/replay-login-bootstrap.golden.mjs`（假 SUT 子进程 + 服务端 cookie 会话，登录标记只落布尔标记文件、绝不持久化请求体）：

1. 旗标缺省零行为差：无旗标（也无凭据 env）回放纯页事件 → exit 0、axes 落盘（旗标是纯 opt-in）。
2. 开旗标缺凭据 fail-closed：`AT_CREDS_FILE` 指向不存在文件、凭据 env 清空 → exit 65、不落 axes（当前实现未识别旗标会静默 exit 0 → 红）。
3. 开旗标登录真发生：env 假凭据 + 假 SUT 登录页（登录后才有目标按钮）→ 服务端登录标记出现、事件步全 unique 回放、axes 步数 = events 步数（无登录步混入）、axes 全文不含假凭据值、exit 0（当前实现不登录 → 无标记 → 红）。
4. 已登录态幂等：开旗标但入口页无登录表单 → SPA 判据视作已登录直通、exit 0（回归方向）。
5. verify 透传：`compile --verify --login-bootstrap` → 子 replay 出现登录标记 + exit 0（当前实现不透传 → 无标记 → 红）。

回归锁：`p5-replay.golden`、`p5-replay-coverage.golden`、`p3-compile.golden`、`selftest --tier1` 原样全绿。

## 风险与对策

- 凭据入错误输出：前置失败信息只引用文件路径与字段名，绝不回显值；golden 断言 axes 全文无凭据值。
- 登录期流量污染 axes：靠既有「currentStepId=null → 归 null」语义 + golden 断言步数恒等。
- 真机验证（route:human）：hermetic 绿后由 P3 tier-2 回放核验第二轮兑现，不在本契约 gate 内。
