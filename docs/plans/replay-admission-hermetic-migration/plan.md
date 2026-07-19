# plan — replay-admission-hermetic-migration

> 契约：full 车道，主树（非 kernel、不碰 `lib`/`bin`）。设计源 = 同目录 `PROPOSAL.md`（Steven 2026-07-19 亲裁路 a：测试签名锁注入 + 金牌迁移）。本文是实现计划：把 PROPOSAL 落成可执行分波 + 验收点，并记录两轮侦察对 PROPOSAL 的修正。

## 0. 目标一句话

把 5 个被 semantic-lock 准入门（`9ee2731`/`dfee72c`）拦成 runtime-RED 的 hermetic 浏览器回放金牌，经生产同一权威铸造接口合法迁入准入门内侧：陈旧绿先翻红记账，铸测试签名锁/执行授权补齐，gate 合法翻绿；准入门 kernel 零改动、生产门零削弱。

## 1. 侦察修正（相对 PROPOSAL，两轮代理 + 亲核坐实）

1. **摩擦案不需要冻编译产物/拆轨**。`drawer-lock`/`replay-nth` 的回放段 events 全是金牌手编、逐字节确定性可复现（`JSON.stringify(o,null,2)+'\n'` 固定内容，无 unique/时间戳）；compile-driven 非确定性只存在于编译执行段，而执行门授权绑的是 `flowSha256`+`testcaseSha256`（`lib/entity-semantic-lock-preflight.mjs:343-344`）——flow/testcase 在金牌里也是静态字节，**可预签**。PROPOSAL 预案的「冻编译产物或拆轨」不必启用。
2. **真正的摩擦是 prd 命名与体量**：回放门用 `prdId = eventsDoc.caseId` 找 `loop/prd-<caseId>.json`（`bin/replay.mjs:226-236`），编译门同用 testcase caseId（`bin/compile.mjs:167-174`）。现有 5 个 prd 全按 plan slug 命名，caseId 命名的 prd 一个都不存在。金牌逐 check 各有 caseId（`drawer-lock` 回放约 14 个 + 编译约 12 个；`replay-nth` 3+1；其余各 1-2），须为每个 caseId 新建注册用 prd。**不改金牌既有 caseId**（caseId 与 expected 契约双向绑定，动它波及断言语义）。
3. **供锁即免 read 信封检查**：`checkReplayEntityAdmission` 的 read url 白名单检查只在未供权威时跑（`lib/entity-semantic-lock-preflight.mjs:754`）。`drawer-lock`/`replay-nth` 的 `/ai-manager/process/detail` 越界问题随供锁自然消解，无须另开授权面。
4. **铸造走导出函数，无手算**：`calculateIdentityAdmissionSignature`（`:209`，去 `signature` 键、递归键排序 canonical JSON 的 sha256）+ `hashIdentityAdmissionBytes`（`:219`）+ `requiredFlowEntityBindings`（`:475`，执行段 bindings 机械推导）都是公开导出。先例 `7962c3d` 夹具即手写 JSON + 预算签名；`receiptHash` 占位（`sha256:` + 64 hex）只校格式不验内容（`:178`）。生产 `freezeEntityBindingsDraft` 路要真收据，测试锁不走它、也证明测试锁削弱不了它。
5. **p5 drift/vanished 撞的是独立 delete 门**（`lib/workflow-delete-spec.mjs:7-23`，先于准入门）：内联 delete event 缺 `text`/`semantic.name`（label 须 ∈ {删除,确定,确认}）与非空 `value`。修法 = 给冻结夹具 `fixtures/p5/replay-cases.json` 的内联 events 补合法文案与目标绑定（等价重编译产物，不从页面猜目标、不放宽域锁），随后按纪律②同会话重签该夹具 checksum。

## 2. 迁移机制（每 caseId 一套）

- **回放锁** `entity-locks.frozen.json`：闭合 schema 十字段（`FROZEN_ARTIFACT_FIELDS`）；`caseId` = events 文档 caseId；`eventsSha256` = 金牌实际写盘 events 字节的 `sha256:` 哈希（含缩进/尾换行细节）；bindings 与 events 严格双射——mutation event 恰 1 条 `role:'subject'`（本批金牌的 `nav.wf`/`nav.processList`/`workflow.*` 等未登记原子全默认 mutation），read event（仅 `nav.workflowManagement`/`assert.textVisible`）0 条；`signerId` 用测试签名者标识；`signature` 由导出函数预算。
- **执行授权** `execute-authority.json`（编译执行段 caseId）：`flowSha256`/`testcaseSha256` 绑金牌写盘的 flow/testcase 字节；bindings = `requiredFlowEntityBindings(flow)` 机械推导后严格集合相等。
- **注册 prd** `loop/prd-<caseId>.json`：`testChecksums[<项目相对正斜杠路径>] = 裸 sha256`；夹具落 `tests/_golden/fixtures/admission-locks/<caseId>/` 下（committed 普通文件，读路拒 symlink/仓外）。注册 prd 是纯注册面（无 stories 的 checksum 载体），`passes` 域不涉足——若 gate/ratchet 机制要求 stories 结构，则给最小自证 story 并由 gate 写值，绝不手写 `passes`。
- **金牌接线**：回放调用补 `--entity-locks <锁路径>`；编译执行调用补 `--entity-authority <授权路径>`（路径 resolve 后落仓内、与 prd 键逐字符相等）。events/flow 字节留 tmp 即可（门只哈希字节不认路径）。
- **铸造工具** `tests/_golden/support/mint-admission-authority.mjs`：读金牌同源 events/flow/testcase 字节 → 推 bindings → 预算签名 → 产出夹具。只 import 导出函数、零触 kernel；入库保证可复铸可评审。

## 3. 分波（顺序执行，每波自证后进下波）

- **波 0 翻红记账**：对 5 个 prd 逐个 `gate --prd` 重跑（顺序跑避争用 flake），让唯一 `passes` 写者把陈旧 `true` 覆写为当前真红，落债务基线提交。同波落本契约自身金牌（见 §4）的诚实红。
- **波 1 简单案**（各 1 个 caseId，静态 events 直接铸锁）：`replay-settle-mount`（`tc_settle_replay`）→ `wf-publish-states` 回放段（`tc_pub_replay`）→ `p5-replay` 静态 8 案（`tc_workflow_create_smoke`，共享一把锁）。
- **波 2 p5 delete 门**：drift/vanished 内联 events 补合法 label+`value`（改冻结夹具 `replay-cases.json`，纪律②重签）+ 为其 events 字节铸锁（同 caseId 下多把锁并存：同一注册 prd 多个 `testChecksums` 键，金牌逐案传对应锁）。
- **波 3 编译执行门**：`wf-publish-states` C1（`tc_pub_smoke`）、`replay-nth` C2（`tc_rnvh_c2`）、`drawer-lock` 编译 G 案（约 12 个 caseId）——铸执行授权 + `--entity-authority` 接线。
- **波 4 体量回放案**：`replay-nth` C1/C3/C4 + `drawer-lock` 回放 G 案（约 14 个 caseId）——铸锁 + 接线。波 1 打样后此波纯机械，可 fan-out 子代理按金牌分工（文件面互斥：各金牌自己的夹具目录/注册 prd/金牌 `.mjs`），金牌自跑验证并行、gate 收口归主会话顺序跑。
- **波 5 收口**：5 prd gate 顺序复跑合法翻绿 + 本契约 prd gate 绿；改动的金牌 `.mjs`/夹具全部重签 checksum；全仓 ratchet 总核零新增 + `tier1` GREEN。
- **单列处置 U1**：`wf-publish-states` U1（`IMPLEMENTED_KINDS` 12 vs 期望 11）是 `lib/replay-assert.mjs` 既有漂移、与准入无关（PROPOSAL 点名勿混治）。波 0 翻红时核实其真实红绿：若红，作为独立小修**分开提交、分开记账**（更新金牌期望 + 重签），使 gate 可达全绿；若绿则零动作。
- **完整性扫尾（护栏 #19 精神）**：grep 全部 `tests/_golden/*.mjs` 里调 `bin/replay.mjs`/`compile --execute` 而未带 `--entity-locks`/`--entity-authority` 的金牌（如 `p5-replay-coverage`），确认本批 5 个之外无同病陈旧绿；有则如实挂账（扩场景另行决策，不静默扩本契约范围）。

## 4. 本契约自身金牌（认证层，zero-SUT）

`tests/_golden/replay-admission-hermetic-migration.golden.mjs`：读迁移清单（caseId → 注册 prd 键），逐条断言——① 生产读路 `readIdentityAdmissionAuthorityFromPrd` 对每把锁/授权返回 `ok:true`（对应 domain）；② 负样本：篡改一字节的副本经同读路必拒（sha 失配）、未注册键必拒；③ 清单非空且覆盖全部迁移 caseId。落地时先于夹具存在而红（诚实红基线），随波次转绿。冻结进本契约 prd `loop/prd-replay-admission-hermetic-migration.json`。

## 5. 验收点（全部满足才算完）

1. 5 个受影响 prd 经 `gate --prd` 全 GREEN，且 git 历史里**翻红记账提交先于修复提交**（债务证据不抹）。
2. 准入门零削弱：`lib/entity-semantic-lock-preflight.mjs`、`lib/entity-semantic-lock*.mjs`、`lib/project-artifact-boundary.mjs`、`lib/workflow-delete-spec.mjs`、`bin/replay.mjs`、`bin/compile.mjs` 字节零改（diff 实证进评审包）。
3. 每把测试锁/执行授权都经生产读路合法注册生效（本契约金牌 §4 正样本），且篡改/未注册必拒（负样本）——`passes` 由 gate 写入本契约 prd。
4. p5 drift/vanished 过独立 delete 门：内联 events 带合法文案与目标绑定，两案回放恢复预期裁定。
5. 全仓 ratchet 总核零新增问题；`selftest --tier1` GREEN；改动冻结件（金牌 `.mjs`/夹具/注册 prd）全部重签、无漏签邻居。
6. 完整性扫尾无未记账同病金牌（有则挂账明示）。
7. codex 异构评审 PASS 入账 `loop/audit.jsonl`：核测试锁合法性（经生产接口注册、无 kernel 旁路）、bindings 对 events/flow 的忠实双射、生产门零削弱。

## 6.5 波 0 实测修正（2026-07-19 翻红记账后追记）

翻红实跑暴露债务真实尺寸大于 PROPOSAL 的 5 金牌口径：5 个 prd 的 s2 回归 story 连带跑的邻居金牌里 13 个同为准入门家族红（`kinds-harden`/`chiefcomplaint-smoke`/`layer3-wiring`/`run-history`/`wf-open-smoke`/`wf-set-node-field`/`wf-select-node-dropdown`/`wf-open-node`/`wf-add-node`/`wf-connect-nodes`/`flow-bridge`/`p3-compile`/`e2e-chain`），拒因归账全属同一家族（18× 锁缺失 / 33× read 越界 / 10× delete 门 / 9× 预执行 bindings / 2× 空 events），无第二病因混入。处置：

- **验收锚不变**：本契约 gate 判据仍是 5 个 prd 全绿 + 本契约金牌绿；但 5 prd 的 s2 传递性要求上述 13 个邻居金牌过门，故迁移面 = 18 个金牌文件（零 SUT 类只调纯函数不撞门、不在内）。
- **邻居金牌各自 owner prd 的陈旧绿**：属同笔债连带清偿——迁移后各自 gate 复跑落账（翻红翻绿同纪律）；不并入本契约 s2 台账断言（避免把验收耦到邻居 prd 可能存在的他因债上），复跑结果如实记于交接文档。
- **两处非典型拒因**：`PRE_EXECUTION_IDENTITY_BINDINGS_INVALID` = flow 推不出 bindings（`requiredFlowEntityBindings` 空），涉事编译段 flow 夹具须补实体元数据；`REPLAY_EVENTS_EMPTY` = 喂空 events 的个别案，迁移时逐案对号处置。
- **U1 单列处置归零**：波 0 实跑 `wf-publish-states` 金牌无 `IMPLEMENTED_KINDS` 失败（U1 绿），交接账里的该漂移条目不成立或已被先前修复，零动作。
- **events 字节冻结手法**（防序列化漂移类缺陷）：迁移把 events 文档从金牌内联/临时序列化改为 committed 夹具字节——单文档金牌直接把夹具路径传 `--events`；多变体金牌把 events 构造器提为 `tests/_golden/support/` 共享模块（金牌与铸造工具同源 import），锁的 `eventsSha256` 一律对 committed 字节取。

## 6.6 规模决策（Steven 2026-07-19 拍：选项三=收窄本契约 + 全债记账）

波 1 打样后核出真实规模远超 5 金牌口径：enforcement 9ee2731 把**整个浏览器回放金牌套件**（约 24 金牌 / 40 prd）打成陈旧绿，波 0 只翻红了最先发现的 5 核心 prd。抽验坐实 `prd-btn-enable-ops`/`prd-wf-history-version` 等 `passes:[true,true]` 但自有金牌准入门红。呈 Steven 可点选项，拍板**选项三**：

- **本契约验收面收窄**到 5 核心 prd 的 s2 闭包 = 恰好 17 金牌（其余 s2 邻居本就绿，已核）。把这 17 迁到真绿即满足本契约验收点 1。
- 改这 17 金牌连带破约 40 个 prd 的 checksum（它们冻结这些金牌）。处置分两类，**严格区分复签与翻红**：
  - **复签 checksum**（文件确实改了字节）：对全部 40 个 freezing prd 里的这 17 金牌条目，更新为新 sha256。确定性、只碰这 17 个键、不掩盖他因漂移。走 sweep（见下）。
  - **翻红 passes**（gate 覆写）：对复签后**自身仍准入门红**的~35 个非核心 prd（其 gate 跑到 17 之外的准入门红金牌），逐个 `gate --prd` 让裁判把陈旧 `passes:true` 覆写为 `false`。绝不手改、绝不靠复签让 ratchet 匹配就当绿。
- 其余套件债 park 成 `DEBT-REGISTER.md`（本目录）——列全 24 准入门红金牌 + 40 prd 现状，留给后续 sweep 契约系统迁完。本契约诚实收窄、债可见。
- 结构性阻塞 `p5 drift/vanished`：`DRIFT-VANISHED-DECISION.md` 墓碑吊销决策包待 Steven 人签。
- 异构讨论：Steven 指示与 codex gpt-5.6-sol high 讨论策略（讨论料 `review-packets/admission-migration-strategy-discussion.md`），据其独立判断校准后再执行剩余迁移。

## 6. 提交序与冻结治理

翻红记账（波 0，prd `passes` 由 gate 覆写）→ 铸造工具 + 夹具 + 注册 prd + 金牌接线（波 1-4，按波提交）→ U1 单列小修（如需，独立提交）→ 翻绿收口 + 重签（波 5）→ 评审修复 → 交接文档先行再并 dev（docs 先于 dev 提交纪律）。全程不手改 `passes`、不动 `testChecksums` 之外的他人冻结面；凭据零接触（纯 hermetic，无 `.auth`/`site.json`）。
