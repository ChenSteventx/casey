# 停手报告：两块冻结金牌互相矛盾，W2 接线目标不可满足

契约 `cli-authority-wiring-fill`（分支 `cli-authority-wiring-fill`，基线 `dev@f9de8b8`）。
第一步实跑定基线即命中停手条件，未 `contract init`、未建 prd、未改任何实现或金牌。

## 基线实跑结果（worktree）

| 金牌 | worktree | 主树（有 `cases/`） | 判定 |
| --- | --- | --- | --- |
| `teachin-semantic-lock-intake-joint.zero-sut.golden.mjs` | exit 1（静态，与环境无关） | exit 1 | 真红 |
| `observation-cli-authority-wiring.zero-sut.golden.mjs` | exit 1（缺 gitignored `cases/`） | exit 0，8/8 GREEN | 主树真绿，worktree 仅环境缺件 |
| `record-intake.golden.mjs` | exit 1（`CAPTURE_PATH_NOT_CANONICAL`） | exit 1（同错） | 真红（两树同） |

`cases/` 被 `.gitignore` 忽略，worktree 不带；observation 与 record-intake 的 worktree 红分别源于此环境缺件与真实漂移，须以主树结果为准。

## 核心停手因：intake-joint 与 observation 两金牌对 `bin/distill.mjs` 提互斥源码约束

- `teachin-semantic-lock-intake-joint.zero-sut.golden.mjs:27`
  `if (!/verifyIntakenPackage\s*\(/.test(distillBin)) fail('distill 未调用三件套 accepted 台账复核器');`
  要求 `bin/distill.mjs` 源码**必须含** `verifyIntakenPackage(`。

- `observation-cli-authority-wiring.zero-sut.golden.mjs:92-93`
  `if (!DISTILL_SOURCE.includes('rehydrateAcceptedObservationTransaction') || DISTILL_SOURCE.includes('verifyIntakenPackage') || DISTILL_SOURCE.includes('ledgerEntries =')) { throw ... }`
  要求 `bin/distill.mjs` 源码**必须不含** `verifyIntakenPackage`。

同一份 `bin/distill.mjs` 不可能既含又不含 `verifyIntakenPackage` 子串。两块冻结金牌逻辑互斥，不能同时转绿。
`bin/intake.mjs` 侧同理：intake-joint 要 intake 源码含 `deriveTeachInPackagePaths`/三件套 token（现 0 命中），
而 observation 要 intake 源码含 `appendAcceptedObservationPackage` 且不含 `appendIntakeLedger`——intake token 缺口可补，
但 distill 侧的矛盾无解，任一实现补法都会打破另一块。

## 时间线：下午 trust-root 迁移废止上午 intake 模型，却留下金牌未退役

- 2026-07-17 09:25 `5cb3b75` freeze semantic lock wiring gap guards（含 intake-joint 金牌；模型=distill 直调 `verifyIntakenPackage`，plain-ledger 权威）。
- 2026-07-17 11:22 `8095611` bind teach-in package intake artifacts（当时 intake 接了三件套 token）。
- 2026-07-17 13:22 `d9aba60` / 13:45 `9aa601a` freeze observation runtime trust root 金牌（新模型=distill 用 `rehydrateAcceptedObservationTransaction`，禁 `verifyIntakenPackage`/plain ledger）。
- 2026-07-17 13:36 `1e6c3c5` secure observation runtime trust root：把 `bin/intake.mjs`（改瘦身 canonical authority-root）与 `bin/distill.mjs`（改 rehydrate）迁到新模型。此提交同时：
  - 打红 intake-joint（distill 不再调 `verifyIntakenPackage`；intake 丢三件套 token）；
  - 打红 record-intake（intake 改 canonical-root 唯一成功路径，tmpdir happy 路径遭 `CAPTURE_PATH_NOT_CANONICAL`）。

## prd 现状

- `prd-observation-runtime-trust-root` s1（accept=observation 金牌）`passes:true`——现役、当前真绿、最新权威模型。
- `prd-teachin-semantic-lock-wiring-gaps` s2（accept=intake-joint 金牌）`passes:false`——上午冻结、被下午迁移废止的旧模型残留红。
- `prd-record-intake` 两 story 皆 `passes:true`，其 testChecksum 与现行金牌字节完全一致（`9e6d1709...`），但金牌今日实跑真红——`1e6c3c5` 打破后从未复跑其 gate，是掩盖真红的陈旧绿。

## 请主会话裁决（不自行重签、不改金牌、不碰权威内核 `teachin-observation-authority-root.mjs`）

W2 契约前提「intake-joint 是可填的活体缺口、填了它同时保 observation 绿」不成立：两金牌互斥。可选：
1. 退役/重签 intake-joint 与 record-intake 金牌，使其对齐已落地的 trust-root（canonical authority-root + rehydrate）模型，并同步刷新 `prd-teachin-semantic-lock-wiring-gaps` s2 与 `prd-record-intake` 的 passes；
2. 若判定 trust-root 迁移方向有误，回退权威内核（会打破现役真绿的 observation 及其 prd）——须显式授权，超出本契约「不碰权威内核」范围；
3. 重新界定本契约范围（例如只保留 intake token 补齐这一不与 observation 冲突的子集，且明确 distill 侧不动、intake-joint 不作验收）。
