# grill：cli-authority-wiring-fill（W2 接线契约重定范围版）

契约 `cli-authority-wiring-fill`，分支 `cli-authority-wiring-fill`，基线 `dev@f9de8b8`，lane=full。

## 背景：上一轮为何停手

W2 接线契约上一轮在基线实跑即诚实停手（见 `red/STOP-golden-contradiction.md`）。停手因是两块冻结金牌对 `bin/distill.mjs` 提互斥源码约束：

- `teachin-semantic-lock-intake-joint.zero-sut.golden.mjs:27` 要求 `bin/distill.mjs` 源码必须含 `verifyIntakenPackage(`；
- `observation-cli-authority-wiring.zero-sut.golden.mjs:92-93` 要求 `bin/distill.mjs` 源码必须不含 `verifyIntakenPackage`。

同一份 `bin/distill.mjs` 不能既含又不含同一子串，两金牌逻辑互斥，不能同时转绿。

## 已核实的现役事实

- trust-root 新模型是活的权威。`bin/distill.mjs` 用 `rehydrateAcceptedObservationTransaction`（禁 `verifyIntakenPackage`）；`verifyIntakenPackage` 已下移到权威内核 `lib/teachin-observation-authority-root.mjs`（在其中被导入并调用），不再进 distill 命令行进程。
- `observation-cli-authority-wiring` 金牌主树真绿 8/8，本 worktree 补上被忽略的 `cases/` 目录后同样 8/8；其 `prd-observation-runtime-trust-root` s1 `passes:true` 现役。
- 旧 intake-joint 金牌钉在被同日下午提交 `1e6c3c5`（secure observation runtime trust root）废止的旧模型（distill 直调 `verifyIntakenPackage`、plain ledger 权威）上，未退役。其所属 `prd-teachin-semantic-lock-wiring-gaps` s2 `passes:false`（诚实红）。
- record-intake 金牌被 `1e6c3c5` 打破后没复跑 gate。其 `prd-record-intake` s1/s2 `passes:true`，但金牌今日实跑真红，是掩盖真红的陈旧绿。

## 第一步取证结论（承重分叉已判）

record-intake 金牌真红根因 `CAPTURE_PATH_NOT_CANONICAL`：金牌把 capture 写在临时目录（`tmpdir`），而现役权威内核 `appendAcceptedObservationPackage` 的 `assertCanonicalContainers` 要求 capture 精确落在 `<PROJECT_ROOT>/cases/<caseId>/record-capture/teach-in-capture.json`（固定 `cases/` 根）。

判定：金牌过时，非实现回归。依据——

- 固定 `cases/` 根是 trust-root 安全模型的地基（提交 `1e6c3c5` 标题即 secure observation runtime trust root，是刻意加固而非误伤）。
- 现役 observation 金牌正面校验此行为：happy 路径经 `acquireCanonicalCaseLease` 落在固定 `cases/` 根，且显式测「off-root intake 与 distill 皆拒」。
- 旧 record-intake 金牌为 `1e6c3c5` 之前的旧模型所写（intake 直接跑 `reviewCapture`、按调用方指向随处落 accept/reject 台账带类别码）。安全复核逻辑没丢，只是迁移：`reviewCapture` 现仍被 `bin/distill.mjs` 与权威内核 `readPackage` 调用。

故 record-intake 是旧模型路径契约的陈旧绿，实现已正确迁到新模型。不属实现回归，不停手，继续第二步。

## 决策（Steven 2026-07-18 以可点选项裁定）

裁定：对齐现役模型。即让死规格对齐活模型，清理被 `1e6c3c5` 废止的旧规格，不让测试迁就实现。

## 范围（in / out）

做（in）：

- 把 intake-joint 与 record-intake 两金牌重写为 trust-root 模型下的正确规格。
  - intake-joint：去掉与 trust-root 互斥的 distill 必含 `verifyIntakenPackage` 断言，改为 distill 侧正确接线断言（含 `rehydrateAcceptedObservationTransaction`、不含 `verifyIntakenPackage`，对齐 observation 金牌模型）；保留并补 intake 侧三件套真接线断言。
  - record-intake：对齐新模型的固定 `cases/` 根 canonical 路径契约。
- 补 `bin/intake.mjs` 与 observation 不冲突的真接线缺口：intake 命令行须派生并校验示教录制包三件套（capture + `identity-observations.json` + `teach-in-package.json`），对齐 `bin/distill.mjs` 现役消费方式；fail-safe 明确退出码 64/65、人话报错、凭据零出现。

不做（out）：

- 不回退权威内核 trust-root（`lib/teachin-observation-authority-root.mjs` 零触碰）——回退会打破现役真绿的 observation 及其 prd，超本契约范围。
- 不碰 observation-cli-authority-wiring 现役金牌。
- 不改判别内核 entity-semantic-lock-v2。

## 决策树分支与解

- 分支「实现回归还是金牌过时」：已判金牌过时（见上）。若曾判实现回归即停手另立修复契约——此分支不成立。
- 分支「distill 侧矛盾如何解」：以现役 trust-root 为准，重写 intake-joint 的 distill 断言到 `rehydrateAcceptedObservationTransaction`，与 observation 金牌对齐；旧 `verifyIntakenPackage` 必含断言退役。
- 分支「intake 侧 token 缺口是真缺口还是被取代」：真缺口。现役 intake 直接委托权威内核、命令行层无自身三件套预检；补 command line 层派生校验属纵深防御，与 observation 要求的 `appendAcceptedObservationPackage`、禁 `appendIntakeLedger` 不冲突。
- 分支「金牌是否倒着裁」：不许。重写后断言须忠实 trust-root 现役真实行为，不削弱成空洞；record-intake 若真红是实现回归则停手（已排除）。
