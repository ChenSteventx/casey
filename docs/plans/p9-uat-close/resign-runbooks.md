# 四例重签跑单（P9 真机 UAT 收口）

日期：2026-07-29　编制：勘察会话（只读勘察 + 本文件为唯一写动作）　状态：待 Steven 裁

对象：2026-07-29 凌晨真机复跑时被准入闸拦下的四条已签署用例。四例全部在浏览器启动前
`fail-closed`（拒绝式失败，宁可不跑也不带疑问跑），零假绿，非缺陷——见 `docs/HANDOFF.md:54`。

本文件把「重签之路」实例化成可执行跑单。**核心结论先说**：跑单 A（chiefcomplaint）
是纯离线造件 + 一次人签，机器可完全预演；跑单 B（catalog/publish/history）**当前不是重签
问题，而是一条未接线的生产接缝**——重签一百次也过不了闸，证据见第三节。

---

## 一、四例勘察表

| 项 | `tc_chiefcomplaint_smoke` | `tc_catalog_wf_crud` | `tc_wf_publish_states` | `tc_wf_history_version` |
|---|---|---|---|---|
| 拦截原因 | `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID` | `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` | 同左 | 同左 |
| 事件数 | 10 | 16 | 16 | 20 |
| 破坏性原子 | 无 | `workflow.deleteByName` × 7 | × 7 | × 7 |
| 破坏链 `intentId` | — | `intent_3` | `intent_3` | `intent_7` |
| `entity-locks.frozen.json` | **不存在** | 存在（v1，16 绑定） | 存在（v1，16 绑定） | 存在（v1，20 绑定） |
| `expected.frozen.json` | 存在（2026-07-03 签，6 断言） | 存在（2026-07-22 签，8 断言） | 存在（9 断言） | 存在（7 断言） |
| 冻结件形状 | 旧形态：带 `schemaVersion`+`channel` | `{caseId,intents,globalAssertions}` | 同左 | 同左 |
| `signedAgainstBuild` | `1.1.2` | `1.1.2` | `1.1.2` | `1.1.2` |
| `signerId` | `Steven` | `Steven` | `Steven` | `Steven` |
| 用例 PRD | **缺** `loop/prd-tc_chiefcomplaint_smoke.json` | `loop/prd-tc_catalog_wf_crud.json` | 有 | 有 |
| 剖面身份通道 | 无 `agents` 段 | 无 `workflows` 段 | 无 | 无 |
| `observed` 的 `capturedAgainstBuild` | `null`（07-03 编译，早于该字段接线） | `1.1.2` | `1.1.2` | `1.1.2` |
| 现有 `expected.draft-*.json` | 陈旧：缺 `channel`/`soft`，且带 1 条 `pending` | 在 `runs/real-uat-20260722/` | 同左 | 同左 |
| 重签可行性 | **可**（离线造件，已实测） | **不可**（缺生产接缝，见三节） | 同左 | 同左 |

### 各例「缺什么才能过」

- `tc_chiefcomplaint_smoke`：缺一份 v1 冻结实体锁（10 条绑定，逐事件一条 `subject` 角色），
  外加一份规范用例 PRD 用来登记锁的校验和。**注意：不是「空锁」**——事件里 5 个原子
  （`nav.agentManagement`/`agent.searchOpen`/`agent.openTestPanel`/`chat.sendAndWait`/
  `chat.closeTestPanel`）都不在 `SIDE_EFFECT_POLICY` 只读白名单里
  （`lib/entity-semantic-lock-preflight.mjs:43-53`），按 `policyForAtom` 的兜底
  （同文件 `:456`）一律判 `mutation` + 必备角色 `['subject']`，所以每个事件都要一条绑定。
  空锁（零绑定）会被 `FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID` 拒。
- 三例 destructive：缺的是**运行期逐破坏步的目标连续性 ref**（证明「删的是同一个目标实体」
  的凭据）。这个 ref 在生产回放路径上**从未被填充过**，详见第三节。

---

## 二、被拦闸的代码坐标

### 2.1 `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`

判定处（三处同名拒绝码，chiefcomplaint 走第二处）：

- `lib/entity-semantic-lock-preflight.mjs:417` —— `verifyFrozenLocks` 内，`verify` 域权威缺失。
- `lib/entity-semantic-lock-preflight.mjs:861` —— `checkReplayEntityAdmission` 主路。**这条就是
  chiefcomplaint 命中的那条**：`:858` 先判「全只读且未供权威」可放行，chiefcomplaint 因
  `allRead === false` 落不到该分支，`:859-861` 取不到 `verify` 域权威即拒。
- `lib/entity-semantic-lock-preflight.mjs:910` —— 旧调用面兼容分域拒绝。

调用链：`bin/casey.mjs:107` 按约定解析 `cases/<caseId>/entity-locks.frozen.json`，文件不存在
则 `:155` 不透传 `--entity-locks` → `bin/replay.mjs:147` 的 `entityLocksSupplied` 为假 →
`:159-168` 准入未过、`exit 65`、不启动浏览器。

拒绝码枚举登记在 `lib/replay/entity-admission-reasons.mjs:6`。

实测复现（本会话探针，零写盘）：`checkReplayEntityAdmission({caseId, eventsBytes, eventsDocument})`
对现役 chiefcomplaint 件返回 `ok=false, reason=FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`。

### 2.2 `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`

判定处：`lib/entity-destructive-continuity.mjs:216`（逐破坏步主路）与 `:220`（遗留逐意图路，
仅供已冻结金牌驱动，生产不走）。

生产调用处：`bin/replay.mjs:205-211`。触发条件是「**任一**冻结锁在力（v1 或 v2）+ 事件里存在
定向破坏原子」，逐步核 `resolvedRefByStep`。

破坏原子集：`lib/entity-destructive-continuity.mjs:27-32`
（`workflow.deleteByName` / `agent.delete` / `picker.selectFirstTool` / `agent.confirmToolPicker`）。

编译侧还有一道同族结构闸：`lib/entity-destructive-continuity.mjs:242`
（`admitCompileDestructiveContinuity`），接线在 `bin/compile.mjs:293-303`，要求破坏目标的实体
种类在剖面里声明了可核实身份通道，否则 `COMPILE_DESTRUCTIVE_NO_IDENTITY_CHANNEL`、`exit 65`。
可核实种类由 `bin/compile.mjs:291-292` 从剖面算出：`profile.workflows` 良构才把 `workflow` 计入。

---

## 三、跑单 B 的阻断根因（承重结论，先于跑单读）

`bin/replay.mjs:203` 把逐破坏步的已认证 ref 表建成**空 Map，且全仓无任何一处向它写入**：

```
const destructiveContinuityByStep = new Map(); // bin/replay.mjs:203
```

全仓扫描 `destructiveContinuityByStep` 只有五处，全是读或建空表：
`bin/replay.mjs:203`（建空）、`:206`（准入门读）、`:269`（塞进回放上下文）、
`lib/replay/event-runner.mjs:194` 与 `:335`（运行期读），
外加 `lib/teachin/prepared-runtime-seam.mjs:177` 同样建空表。**零处 `.set()`**。

生产件自己也如实写了这一点，`bin/replay.mjs:266-268`：

> route:human 采集前恒空——空即上方 admission 已在浏览器前拒破坏步…… 当前生产不可达（诚实挂账）

于是：**只要冻结实体锁在力且事件含 `workflow.deleteByName`，准入恒拒**。这与锁是 v1 还是 v2、
重签几次、绑定多完整都无关。三例 destructive 的拦截不是「签署件陈旧」，是「破坏链身份采集这条
接缝没接」。

这条行为还被已冻结金牌钉死：
`tests/_golden/entity-destructive-continuity-guard.failclosed-replay.golden.mjs:146` 断言破坏动作
必须 `exit 65`，`:155-160` 另断言本闸不得退化成「有锁就一律拒」。要让破坏步放行，等于改这份
人签冻结金牌 —— 属 ADR-0004 重签事件，走人。

补充缺口（就算接线也要一并补）：冻结锁里的 `identityObservations` 投影只有 8 个字段
（`lib/entity-semantic-lock-preflight.mjs:736-737`），而铸 ref 的
`mintTargetContinuityObservation` 要 11 个字符串字段 + `stepOrder`
（`lib/entity-destructive-continuity.mjs:35-39`、`:100`），缺 `profileFingerprint` / `scope` /
`requestCorrelationId` / `stepOrder` 四项。适配层 `lib/entity-destructive-continuity-wiring.mjs:103`
（`mintDestructiveTargetContinuity`）就是为补这四项而写的，但只被编译侧
（`lib/compile-atoms-workflow-crud.mjs:190`）消费，回放侧没有对应的重建路径。

**还有一道独立硬闸**：`bin/sign.mjs:175`

```
if (existsSync(entityLocksOut) && !recoveryJournal) die(65, 'entity-locks.frozen.json 已存在；身份锁重签须另走显式撤销/归档流程');
```

`--resign` 只覆盖 `expected.frozen.json`（`bin/sign.mjs:413-416`），**对实体锁无效**。三例的锁
文件都已存在 → 重签必被拒。而「显式撤销/归档流程」在仓里只是这句错误文案，没有对应命令实现。
配套还有 `bin/sign.mjs:214-217`：PRD 里已有实体锁校验和却无发布日志 → 拒绝猜测残留状态。

---

## 四、07-22 重表达配方的执行痕迹（文件:行号）

配方本身没有落成跑单文档，只有四份机械造件脚本 + 完整产物集。权威一句话在
`docs/HANDOFF.md:581`；八步缩写在 `docs/codex/HANDOFF.md:16`；产物指路
`docs/REQUIREMENTS-STATUS.md:101`。`loop/audit.jsonl` **没有**该次重表达的条目。

| 步 | 做法与坐标 | 产物 |
|---|---|---|
| 1 扩 flow 绑定 | `runs/real-uat-20260722/craft-crud.mjs:15` 读 07-16 已确认 flow；`:18-24` 逐步注入 `sourceIntentId` + `entityBindings`；`:20` 只读白名单；`:16-17` 三元组唯一 → 逐步独立 `candidateId`；`:25-26` 直接盖 `confirmedBy: 'Steven'` | `runs/real-uat-20260722/<case>/flow-<case>.json` |
| 2 铸权 | `craft-crud.mjs:32-38` 本地预验（`validateDraft` + `requiredFlowEntityBindings`）；`:43-52` 铸 `entity-pre-execution-authority`，`signed:true`/`signerId:'Steven'`/`audience:'production'`；`:56-57` 打印校验和与登记键 | `runs/real-uat-20260722/<case>/execute-authority.json` |
| 3 登记 + 哨兵 | 校验和登进 `loop/prd-<caseId>.json` 的 `testChecksums` 才生效，信任锚 `lib/entity-semantic-lock-preflight.mjs:299-330`（`:310-312` 解析 PRD 路径）。哨兵 = `bin/compile.mjs:306` 的 `CASEY_LAUNCH_SENTINEL`（`exit 66`，证全部闸早于浏览器启动）；回放侧同款 `bin/replay.mjs:369` | `loop/prd-<caseId>.json` 更新；哨兵文件 |
| 4 重编译 | `casey compile <caseId> --execute --sut <回环基址> --out-dir <run 目录> --profile <f> --testcase <f> --entity-authority <f> --unique-name <token>`；flow 从 `<out-dir>/flow-<caseId>.json` 读（`bin/compile.mjs:135-137`）；产物写盘在 `bin/compile.mjs:491-497` | `events.json` / `entity-bindings.draft.json` / `observed-<case>.json` / `compile-report.json` |
| 5 补缝 | `casey draft <caseId> --observed <f> --compile-report <f> --out-dir <d> --testcase <f> --patch <f>`（`bin/draft.mjs:45`）；补缝件例 `runs/real-uat-20260722/tc_catalog_wf_crud/draft-patch.json:1-6`（4 条）、publish/history 各 1 条 `countChange equals 0` | `expected.draft-<case>.json` |
| 6 确认 | `runs/real-uat-20260722/craft-confirmations-crud.mjs:17-22` 造单张锁收据（`kind:'workflow'`、`bindingMode:'existing'`、`source:'user-confirmed'`）；`:24-25` 每条草稿绑同一收据；`:27-33` 用 `freezeEntityBindingsDraft` 预演冻结，避免人签当场被拒；`:18` 如实挂账 `code` 是待办占位符不是真平台数据 | `entity-confirmations.json` |
| 7 签（人签点） | `bin/sign.mjs:121` 的接口；四个实体旗标必须成组（`bin/sign.mjs:137`）。实证：`signerId=Steven`、`--against-build 1.1.2`、`audience=production`、`signedAt` 见 `cases/tc_catalog_wf_crud/entity-locks.frozen.json:7`。授权方式记在脚本头：`craft-crud.mjs:2`「须 Steven checkpoint 后」；`craft-publish.mjs:1` 与 `craft-history.mjs:1`「Steven 已授权条件直签」 | `expected.frozen.json` / `entity-locks.frozen.json` / `archive/expected.frozen.<case>.<build>.<sha12>.json` / PRD 校验和 |
| 8 跑 | `casey run <caseId> --sut <回环基址> --run-dir <d> --unique-name <新令牌> --login-bootstrap`；实体锁按约定自动解析（`bin/casey.mjs:83,107,155`） | 三链 4/4、4/4、8/8 全 `PASS` |

未记进脚本的手工动作：签之前把 run 目录产物提升进 `cases/`，旧件手工存成
`archive/{events,observed,flow}.pre-20260722.json`（两套归档命名并存）。

配方坑（照抄前必读）：
1. 绑定闭合是全有或全无——漏一个变更类步骤整件被拒（`docs/plans/entity-ui-wiring/learn.md:12`）。
2. 权威件必须在 confirm 终写盘后按精确字节生成，任何再写盘即校验和失配
   （`docs/plans/stale-red-admission-refit/learn.md:5`）。
3. 受众与凭据上下文严格匹配、`fail-closed`：`audience: production` 要求真凭据实际加载，
   带 `--skip-login` 会把上下文翻成 `test` 而被拒（`bin/compile.mjs:186-192`）。
4. 请人签之前一定先用同一入口 `freezeEntityBindingsDraft` 预演。
5. 07-22 当时 `--patch` 的 `intentId` 不校验，打错字会静默产生孤儿断言
   （`docs/plans/real-uat-attestation/evidence/uat-run.md:31-34`）；后由 `drafter-patch-intent-guard` 修掉。

---

## 五、跑单 A：`tc_chiefcomplaint_smoke` 补签实体锁

**定性**：不需要真机重编译。实体锁草稿是纯函数产物
（`lib/entity-semantic-lock-preflight.mjs:635` 的 `buildEntityBindingsDraft`，入参只有
事件原始字节 + 事件文档 + 来源行），可从现役 `events.json` 离线造出。全程唯一需要真机的
是最后一步的验证回放。

**预演实证**（本会话已跑，零写盘）：对现役 `cases/tc_chiefcomplaint_smoke/events.json`
造 10 条 `subject` 来源行 → `buildEntityBindingsDraft` 返回 `ok=true`（10 行）→
`freezeEntityBindingsDraft` 返回 `ok=true`、`replayReady=true`、`schemaVersion=1`、10 条绑定。

工作目录约定：`runs/resign-20260729/tc_chiefcomplaint_smoke/`（沿用 07-22 的 run 目录形态，
不入库）。

### A0　建用例 PRD（人签点前置，必做）

`bin/sign.mjs:205-207` 规定产实体锁时 PRD 路径必须恰是 `loop/prd-<caseId>.json`，
而 `loop/prd-tc_chiefcomplaint_smoke.json` **不存在**（现有的
`loop/prd-chiefcomplaint-smoke.json` 是开发契约 PRD，`caseId` 字段都没有，不能顶替）。

新建内容（模板取自 `loop/prd-tc_catalog_wf_crud.json`，`testChecksums` 必须为空——
`bin/sign.mjs:214-217` 规定首次发布前 PRD 不得已有实体锁校验和）：

```json
{
  "schemaVersion": 2,
  "caseId": "tc_chiefcomplaint_smoke",
  "task": "tc_chiefcomplaint_smoke 人签断言契约 + v1 实体锁（2026-07-29 补签）",
  "testChecksums": {},
  "stories": []
}
```

执行者：机器起草，Steven 过目。耗时 2 分钟。
注意：写 `loop/prd-*.json` 会被 `hook-loop-guard` 判成 `write-prd` 动作、要求先完成 `plan` 阶段，
须在活契约下做或先 `contract init`。

### A1　造实体绑定草稿

来源行 = 逐事件一条，字段 `{stepId, intentId, atom, sourceIntentId, candidateId, role}` 六项齐全
（`lib/entity-semantic-lock-preflight.mjs:650-651`），`role` 取 `subject`，
`sourceIntentId` 取事件自身 `intentId`，`candidateId` 逐步唯一。

```
node runs/resign-20260729/craft-chief.mjs
```

脚本照抄 `runs/real-uat-20260722/craft-confirmations-crud.mjs` 的形态，
调 `buildEntityBindingsDraft({eventsBytes, eventsDocument, provenance})`。

产出：`runs/resign-20260729/tc_chiefcomplaint_smoke/entity-bindings.draft.json`
（`schemaVersion:1`、`signed:false`、`replayReady:false`、10 条绑定）。
执行者：机器。耗时 5 分钟。

### A2　造确认件（锁收据）

一张收据覆盖全部 10 条绑定，形态照 `craft-confirmations-crud.mjs:17-25`：
`createEntityLockReceipt({lockId, kind:'agent', bindingMode:'existing', scopeFingerprint,
expected, observed, source:'user-confirmed'})`。

`bindingMode: 'existing'` 时 `source` 必须是 `user-confirmed`
（`lib/entity-semantic-lock.mjs:74-76`），且 `expected.name/code` 必须与 `observed.name/code`
逐字相等（`:85`）。

**待裁**：被测智能体的真实名称与编号。07-22 用了显式待办占位符
（`ROUTE-HUMAN-CODE-READBACK-PENDING-20260722`）并如实挂账；07-23 的 v2 用例改用真机读回值。
本例走 v1、回放不比对身份三元组，占位符可用，但要照 07-22 的做法在脚本头如实写明。

同一脚本尾部**必须**用 `freezeEntityBindingsDraft` 预演冻结（`craft-confirmations-crud.mjs:27-33`
的纪律），预演不 `ok` 就不要请人签。

产出：`runs/resign-20260729/tc_chiefcomplaint_smoke/entity-confirmations.json`。
执行者：机器。耗时 10 分钟。

### A3　造脱签草稿（不要用现有 draft）

现役 `cases/tc_chiefcomplaint_smoke/expected.draft-tc_chiefcomplaint_smoke.json` **不能直接用**，
两个实测问题：

1. 带 1 条 `pending`（`intent_3` / `assert.bubble` / 映射不出可靠断言），`bin/sign.mjs:337-338`
   默认拒签，要 `--force` 才过并落留痕旁车——等于给一份未闭合契约背书，不该做。
2. 内容与现役冻结件不一致：草稿缺 `channel: "web"`，四条断言也缺 `soft: false`。照它重签会
   悄悄改动人签过的断言形状。

正确做法：从现役 `expected.frozen.json` 反推脱签草稿——剥掉每条断言的
`signedAt`/`signedAgainstBuild`/`signerId` 三个签署字段，其余原样保留。

**已实测**：这样反推的草稿过 `assertSignedContract`（`ok=true`）、零越界键、无 `pending`
（不需 `--force`）。唯一差异：重签产物会丢掉顶层 `schemaVersion` 字段——因为
`bin/sign.mjs:359-369` 只写 `{caseId, channel?, intents, globalAssertions?}`，从不写
`schemaVersion`。现役 chiefcomplaint 件带 `schemaVersion` 是 2026-07-03 的旧形态，
07-22 签的另三例都没有该字段。**这是预期内的形状归一，但属于改动人签字节，请 Steven 明确认可。**

产出：`runs/resign-20260729/tc_chiefcomplaint_smoke/expected.draft-tc_chiefcomplaint_smoke.json`。
执行者：机器。耗时 5 分钟。

### A4　人签（Steven 签字点）

```
node bin/casey.mjs sign tc_chiefcomplaint_smoke \
  --draft runs/resign-20260729/tc_chiefcomplaint_smoke/expected.draft-tc_chiefcomplaint_smoke.json \
  --prd loop/prd-tc_chiefcomplaint_smoke.json \
  --frozen-out cases/tc_chiefcomplaint_smoke/expected.frozen.json \
  --signer Steven \
  --against-build 1.1.2 \
  --events cases/tc_chiefcomplaint_smoke/events.json \
  --entity-bindings-draft runs/resign-20260729/tc_chiefcomplaint_smoke/entity-bindings.draft.json \
  --entity-confirmations runs/resign-20260729/tc_chiefcomplaint_smoke/entity-confirmations.json \
  --entity-locks-out cases/tc_chiefcomplaint_smoke/entity-locks.frozen.json \
  --audience production \
  --resign \
  --archive-dir cases/tc_chiefcomplaint_smoke/archive
```

逐旗标依据：

- `--resign` 必带：`cases/tc_chiefcomplaint_smoke/expected.frozen.json` 已存在，
  无 `--resign` 会被 `bin/sign.mjs:414` 的防误覆写拒。`--resign` 只作用于 `expected.frozen.json`
  （归档旧件到 `archive/expected.frozen.tc_chiefcomplaint_smoke.1.1.2.<sha12>.json`，
  命名规则 `bin/sign.mjs:399-409`），**与实体锁无关**——本例实体锁是首次发布，
  `bin/sign.mjs:175` 的既存拦截不触发。
- `--entity-locks-out` 文件名必须恰为 `entity-locks.frozen.json`（`bin/sign.mjs:150`），
  且必须位于仓内（`:151-155`），供 PRD 校验和登记后铸成不透明权威。
- 四个实体旗标（`--events` / `--entity-bindings-draft` / `--entity-confirmations` /
  `--entity-locks-out`）必须成组（`bin/sign.mjs:134-138`）。
- `--audience production` 必填且只能是 `test|production`（`bin/sign.mjs:143-145`）。
  选 `production` 是因为验证回放要带 `--login-bootstrap` 用真凭据，受众与凭据上下文严格匹配
  （`lib/entity-semantic-lock-preflight.mjs:360-369`）。
- **不带** `--entity-observations`：本例走 v1（草稿 `schemaVersion:1`），
  `bin/sign.mjs:246` 明确 v1 草稿不接受该旗标。
- `--against-build 1.1.2` 的取法：**不是** `sut-build-digest`。`--against-build` 受
  `bin/sign.mjs:39` 的 `SAFE_ID` 约束（只许 `[A-Za-z0-9._@-]`），带冒号的
  `sha256:...` 形态会直接 `exit 65`。真正的取法是入口 HTML 里脚本 `src` 的 `?v=` 查询串
  （`bin/compile.mjs:441-454`），落进 `observed-<case>.json` 的 `capturedAgainstBuild`。
  现役三例 07-22 编译的值都是 `1.1.2`；chiefcomplaint 自身的 `observed` 是 `null`
  （07-03 编译早于该字段接线），所以取同期同平台的 `1.1.2`。
  **若真机平台已升级，须先读一次入口页的 `?v=` 值再签**，不要照抄 `1.1.2`。
  （附带留证：`runs/teachin-uat/tc_chiefcomplaint_smoke_20260729_130944/sut-build-digest-derivation.md`
  记的 `sha256:4cd940f5…` 是示教环节的构建指纹，与本旗标不是同一个东西，别混用。）
- 不带 `--force`（A3 的脱签草稿无 `pending`）；不带 `--verdict-baseline`（现役件无期望裁定基线，
  别新增）；`--signed-at` 留空由命令取当前时间。

执行者：Steven 本人（人签门，**不可代签**）。耗时 5 分钟。

落盘（`bin/sign.mjs:488-493` 的顺序，PRD 最后落位）：归档旧冻结件 →
`cases/tc_chiefcomplaint_smoke/expected.frozen.json` →
`cases/tc_chiefcomplaint_smoke/entity-locks.frozen.json` →
`loop/prd-tc_chiefcomplaint_smoke.json`（写入两条 `testChecksums` + `expectedFrozenPath`）。

### A5　验证回放（真机）

```
node bin/casey.mjs run tc_chiefcomplaint_smoke \
  --sut <隧道回环基址> \
  --run-dir runs/tc_chiefcomplaint_smoke/run_resign_20260729 \
  --unique-name <新令牌> \
  --login-bootstrap
```

实体锁按约定自动解析（`bin/casey.mjs:83,107,155`），不必手写 `--entity-locks`。

预期：准入过闸、启动浏览器、四相跑完。**注意本例是流式对话用例**，
`streamReplyReceived/finished` 断言依赖真机回复，裁定非 `PASS` 时按四态如实报，
别把 `NEEDS_HUMAN` 当失败也别当通过。

执行者：机器（Steven 在场开闸）。耗时 10 分钟。

### A6　收口

`loop/prd-tc_chiefcomplaint_smoke.json` 的两条校验和已由 sign 写入；跑一次全仓漂移扫确认无
跨 PRD 校验和不一致，再更新 `docs/HANDOFF.md` 的迁移账。执行者：机器。耗时 10 分钟。

**跑单 A 合计**：机器段约 30 分钟 + 人签 5 分钟 + 真机回放 10 分钟。

---

## 六、跑单 B：三例 destructive

### B 的定性

按第三节，**跑单 B 不能以「重签」的形式存在**。硬阻断有三层，任何一层不解决，
重签产物都跑不起来：

| 阻断层 | 坐标 | 性质 |
|---|---|---|
| ① 回放期逐破坏步 ref 表恒空 | `bin/replay.mjs:203`（零处写入） | 生产接缝未接线 |
| ② 冻结锁投影字段不足以铸 ref | `lib/entity-semantic-lock-preflight.mjs:736-737` 对 `lib/entity-destructive-continuity.mjs:35-39` | 签署件格式缺四字段 |
| ③ 实体锁不可重签 | `bin/sign.mjs:175` | 撤销/归档流程只有文案、无实现 |
| ④ 编译侧无 workflow 身份通道 | `bin/compile.mjs:291-292` + 三例剖面均无 `workflows` 段 | 剖面待扩 |
| ⑤ 现行行为被冻结金牌钉死 | `tests/_golden/entity-destructive-continuity-guard.failclosed-replay.golden.mjs:146` | 改动属 ADR-0004 重签事件 |

所以 B 有两条路，**请 Steven 先裁走哪条**，再谈跑单：

### 路 B-1：接线破坏链身份采集（正解，重）

这是一个完整的实现契约，不是跑单。粗粒度阶段：

1. **剖面扩身份通道**：三例 `profile.json` 补 `workflows.listApi`（含 `pathname`/`method`/
   `recordsPath`/`totalPath`/`queryParam`/`fields.{id,code,name}`）+ `itemContainer` +
   `cardFields.{name,code}`，形状要求见 `bin/compile.mjs:233-247`。
   注意 `bin/compile.mjs:257-259`：同时声明多个身份观察通道种类会被拒，三例只需 `workflows`。
   执行者：机器起草 + 真机核对字段路径。
2. **实体锁格式扩容**：让冻结锁携足够铸 ref 的字段（`profileFingerprint`/`scope`/
   `requestCorrelationId`/`stepOrder`），或另立一份已认证的连续性件。**改签署件格式 = 改已冻结
   接缝**，须先定方案再送异构评审。
3. **回放侧接线**：在 `bin/replay.mjs` 准入门之前，从已验证的 `verify` 域权威重建
   `destructiveContinuityByStep`，复用 `lib/entity-destructive-continuity-wiring.mjs:103`
   的铸造适配器。
4. **金牌重签**：`entity-destructive-continuity-guard.failclosed-replay.golden.mjs` 的 D1 断言
   要按新语义重钉（有合法 ref 才放行、无 ref 仍恒拒），属 ADR-0004 重签事件，**必须 Steven 补签**。
5. **实体锁撤销流程**：实现 `bin/sign.mjs:175` 提到的显式撤销/归档，或为本次收口开一条
   一次性的人工归档 + PRD 校验和摘除路径（要留审计痕）。
6. 之后才轮到 07-22 那八步（扩 flow 绑定 → 铸权 → 哨兵 → 重编译 → 补缝 → 确认 → 签 → 跑）。

三例在阶段 1、6 里的机器段可并行（三份剖面、三条 craft 脚本、三次编译互不耦合，
与 07-22 的做法一致）；阶段 2、3、4、5 是共用生产件与冻结金牌，**必须串行单线**，
碰 `lib`/`bin` 的真并行按护栏 #18 走独立工作树。

预计：阶段 1 半天；阶段 2-5 是一个完整契约（计划 + 异构评审 + 实现 + 复审），
按仓内同类契约的历史体量，两到三个工作日；阶段 6 每例约 1 小时（含人签与真机回放）。

### 路 B-2：把清理链移出用例（轻，但改用例语义）

三例的破坏链各自只落在一个意图上（catalog `intent_3`、publish `intent_3`、history `intent_7`），
且这些意图的断言全是清理类：

- `tc_catalog_wf_crud` `intent_3`：`textVisible appears 删除成功` + `countChange equals 0`
- `tc_wf_publish_states` `intent_3`：`countChange equals 0`
- `tc_wf_history_version` `intent_7`：`countChange equals 0`

若把清理链从用例里摘掉，事件里就没有破坏原子，准入门根本不触发，实体锁可以照跑单 A 的
离线造件路径重签（v1、纯函数、不需真机重编译）。

代价：① 删掉上述 4 条断言，用例覆盖面缩水（自清理不再被验证）；② 真机会留下 `atl_` 前缀的
测试残留，需要另起清理手段；③ 改用例语义要 Steven 拍板并重签 `expected.frozen.json`。

预计：三例合计机器段 1.5 小时 + 人签 15 分钟 + 三次真机回放 30 分钟，一个上午能收口。

### B 的取舍

B-1 是正解但是一个契约级投入，且踩 ADR-0004 重签；B-2 半天能通但削覆盖面、留残留。
两条都不是纯跑单能承担的决定，**本文件不代裁**。

---

## 七、开放问题（待 Steven 裁）

1. **跑单 B 走哪条路**：B-1（接线破坏链身份采集，契约级，含冻结金牌重签）还是
   B-2（摘清理链，半天，削 4 条断言 + 留真机残留）？还是先做 A、B 整体挂账等下一轮？
2. **A3 的形状归一**：重签 chiefcomplaint 会丢掉顶层 `schemaVersion` 字段（sign 从不写它），
   与 07-22 三例形状对齐。这是改动人签过的字节，是否认可？
3. **A2 的收据身份值**：被测智能体的真实名称与编号未知。沿用 07-22 的显式待办占位符
   （如实挂账、v1 回放不比对），还是先去真机读回真值再签？
4. **`--against-build` 取值**：现役四例都是 `1.1.2`。真机平台若已升级，签之前是否要重新读一次
   入口页的 `?v=`？（2026-07-29 的示教留证只记了 `sut-build-digest`，没记 `?v=` 的当前值。）
5. **A0 建 PRD 的契约归属**：`loop/prd-tc_chiefcomplaint_smoke.json` 是新建用例 PRD，
   写它会触发阶段互锁（判成 `write-prd`）。挂在哪个契约下做？
6. **本轮是否需要异构评审**：跑单 A 只造件不改生产件，按现行准则似乎不必；但第三节的承重结论
   （「三例结构上不可重签」）是个会改变排期的判断，是否送 codex 复核一遍？
7. **B-2 若采纳**，真机上已有的 `atl_` 残留由谁清、用什么手段清（当前没有独立的清理工具）？

---

## 附：本文件结论的实测依据

除文件行号引用外，以下三条是本会话跑纯函数探针得到的实证（零写盘、零浏览器、零 SUT 接触）：

1. 现役 chiefcomplaint 件过 `checkReplayEntityAdmission` → `ok=false`,
   `reason=FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`（复现拦截，确认根因）。
2. 由现役 `events.json` 离线造 10 条来源行 → `buildEntityBindingsDraft` `ok=true`(10 行) →
   `freezeEntityBindingsDraft` `ok=true`, `replayReady=true`, `schemaVersion=1`, 10 条绑定
   （证跑单 A 不需真机重编译）。
3. 由现役 `expected.frozen.json` 反推的脱签草稿，重新盖签后过 `assertSignedContract`
   （`ok=true`）、零越界键、无 `pending`；差异仅顶层 `schemaVersion` 一项
   （证 A3 路径可行且差异可枚举）。
