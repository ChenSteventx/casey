# 基础债修复方案——hermetic 浏览器回放金牌迁到 semantic-lock 准入门

> Steven 2026-07-19 决策：先修基础债（另立契约）+ mountdelay 排后。本文是修复契约的方案（侦察定清、file:line 承重），供直接接手实现。侦察结论已亲核关键点（`replay-settle-mount.golden.mjs` 主树 9 过/7 红 FROZEN_ENTITY_LOCKS 坐实）。

## 问题

2026-07-17 `9ee2731`→`dfee72c`「enforce semantic lock admission gates」落地：含 mutation/unknown atom 的 events 回放要求签名冻结锁（`--entity-locks` + 注册 prd checksum）。合成 caseId 的 hermetic 浏览器回放金牌满足不了 → 一批 runtime-RED（`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`，浏览器未启动 exit 65）。enforcement 落地未复跑这些金牌 → prd 陈旧 `passes:true`；`tier1` 不跑浏览器回放金牌、掩盖。

## 准入门判据（承重 file:line）

- 调用：`bin/replay.mjs:228-247`（`checkReplayEntityAdmission` 别名 `checkCompileIdentityAdmission`，`:33` 导入；caseId 取 `eventsDoc.caseId` `:226`）；`compile --execute` 双门 `bin/compile.mjs:166-189`、`--verify` 门 `:334-354`。
- 判据：`lib/entity-semantic-lock-preflight.mjs:729-796`——逐 event 校 `{stepId,intentId,atom,action}` + triple 唯一；`policyForAtom:399`（未登记 atom **默认 mutation**）；read allowlist 仅 `nav.workflowManagement`+`assert.textVisible`（`SIDE_EFFECT_POLICY:40-50`）；免锁 read 信封 url 仅 `{{baseUrl}}/ai-manager/process/list`+`/workflow`（`:55-58`）；`:761` 纯只读免锁唯一出口；`:762-767` 否则须 `frozenLockAuthority` opaque handle，缺→`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`。
- 权威铸造：`readIdentityAdmissionAuthorityFromPrd:276-312`——`loop/prd-<caseId>.json` 的 `testChecksums[artifactKey]`（bare sha256）→ `readProjectArtifactBytes`（PROJECT_ROOT 下、拒 symlink）→ 实读字节 sha256==注册值 → `validateFrozenArtifact:242-257`（只校 schema + bindings 结构 + **内容自哈希签名 `:255`，非 Ed25519**；准入读路**不验收据内容**）→ `mintAuthority`（WeakMap opaque handle，非导出、测试无法伪造）。

**关键**：准入读路无 Ed25519、无收据验证、无真 SUT 依赖——只认 结构+内容自哈希+prd checksum。故 hermetic 测试锁可**确定性铸造**并经生产接口合法注册。

## 方案：路 (a) 测试签名锁注入 + 金牌迁移（不触 kernel，Steven 决策 + 侦察推荐）

铸造接缝（每金牌）：committed `entity-locks.frozen.json` fixture（`eventsSha256` = 金牌喂 replay 的**精确 events 字节** sha256，bindings 逐 event triple 全覆盖 + 角色匹配 policy.requiredRoles）+ committed `loop/prd-<caseId>.json` 注册其 checksum + 金牌 `.mjs` 传 `--entity-locks`。events 可在 tmp（门只哈希字节不认路径）。仓内先例：`tests/_golden/fixtures/teachin-semantic-lock-admission-authority/entity-locks.frozen.json` + `loop/prd-teachin-semantic-lock-admission-authority.json`（binding receiptHash 占位 `sha256:dddd…` 仍过门，因读路不验收据内容）。

**不削弱生产门**：走生产同一权威铸造接口（prd checksum→opaque WeakMap handle，测试无法伪造 handle），生产回放仍须真签名锁；测试锁只是合法注册的 committed 测试件（测试 signerId）。否决路 (b) hermetic seam（触 kernel、fail-open 缝、违护栏 #14）。

## 分层（复杂度递增）

1. **简单案（静态 events fixture，直接铸锁）**：
   - `p5-replay`（caseId `tc_workflow_create_smoke`，events 来自 `tests/_golden/fixtures/seams/events.fixture.json`）——但 drift/vanished 2 案用 `workflow.deleteByName` 死在**独立门** `validateWorkflowDeleteBindings`（`replay.mjs:221`，commit `4326e27` 07-16，早于准入门），须一并给合法 delete 绑定或重编译 events。
   - `replay-settle-mount`（caseId `tc_settle_replay`，events `nav.processList`/`workflow.openCreate/fillName/confirmCreate`）。
   - `wf-publish-states`（caseId `tc_pub_replay`）。**勿混治**：其 U1 `IMPLEMENTED_KINDS` 现 12 期望 11 是 `lib/replay-assert.mjs` 漂移、与准入无关。
2. **摩擦案（compile-driven 非确定性 + 双门，须冻编译产物或拆轨）**：
   - `drawer-lock-hardening`、`replay-nth-visible-hardening`——events/flow 由 `compile --execute` 运行时生成（unique-name/DOM 回读）非确定性，静态锁无法预绑；且双门（execute-authority + verify entity-locks）。方案：把编译产物一次性冻成 committed events fixture 再绑锁，或拆金牌（编译轨转独立单元断言、回放轨喂冻结 events）。内联案还有 read event url `/ai-manager/process/detail` 不在免锁 allowlist（`REPLAY_READ_EVENT_TARGET_INVALID`），须供授权。

## 陈旧绿翻真（承重纪律）

5 prd `passes:true`（evidence gate@2026-07-14，早于 07-16 deleteByName 门 + 07-17 准入门）是陈旧绿。**先翻红记账、修好再翻绿**：修复契约起手对 5 prd 逐个 `gate --prd` 重跑，让确定性裁判（唯一 passes 写者）把 true 覆写为当前真红作债务基线；落 (a) 修复后 gate 复跑合法翻绿。**不手改 passes、不随迁移直接补绿**（撞 fidelity-audit/翻真纪律，抹债务证据）。

## 车道 / 冻结治理 / 触不触 kernel

- 车道：`full`（多金牌迁移 + 冻结面重签，需异构评审核迁移正确性），**非 kernel、不必 worktree**（路 a 不碰 lib/bin core）。
- 冻结重签：5 金牌 `.mjs`（testChecksums 冻结件）改后各 prd 重冻 sha256；events fixture 若改字节须重冻；新增 frozen-lock/execute-authority fixture + prd testChecksums 注册。全程 `gate.mjs` 收口、走 sign/重签流程（`bin/sign.mjs` anti-clobber）。
- 触 kernel：路 (a) **不触** `entity-semantic-lock-preflight.mjs`/`entity-semantic-lock*.mjs`（零改）。
- 异构评审：codex 核迁移正确性（测试锁是否经生产接口合法、bindings 覆盖是否忠实 events、生产门是否零削弱）。

## 关键 file:line 速查

门判据 `lib/entity-semantic-lock-preflight.mjs:729-796`（replay）/`:276-312`（authority 铸造）/`:40-58`（policy+allowlist）；调用 `bin/replay.mjs:228-247`、`bin/compile.mjs:166-189`（execute）/`:334-354`（verify）；先例 fixture `tests/_golden/fixtures/teachin-semantic-lock-admission-authority/entity-locks.frozen.json` + `loop/prd-teachin-semantic-lock-admission-authority.json`；真机合法 sign 路 `bin/sign.mjs:133-276`。
