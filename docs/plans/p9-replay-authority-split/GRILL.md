# GRILL 草案 · p9-replay-authority-split（回放授权件拆分）

> 状态：**已终裁**（fable 2026-08-04，八问逐条，记在 §五）。基线 `dev` @ `96f6107`，
> 工作树 `casey-p9-replay-authority-split`，lane=full，未 advance 阶段、未动生产件。
> 落地计划见同目录 `plan.md`；红先行基线见 `accept/red-proofs/`。
> 缘起：Steven 2026-08-04 裁——不接受同一份 v3 结构授权件同时覆盖 compile 面与
> Tier2 回放面，另立回放专用授权件，走最小权限分离。
> 来源问题：`docs/plans/p9-created-workflow-cleanup-continuity-v3/SIGNING-SESSION.md:442-444`。

---

## 〇、派活前提已按实测校正（双方独立复核，已采信）

派活口径写的是「一份件既进 compile 面也进 Tier2 采集层」。**按现役代码逐条追下来，
这句在「产物件」这一层不成立，在「语义」这一层成立。** 拆分方案必须按后者设计，否则会去
拆一条本来就不存在的连线。

**复核方式（两方各自跑，结论一致）：**

- 本方：`grep -rn 'readCreatedWorkflowOwnershipAuthority|checkCreatedWorkflowOwnershipPreflight|
  freezeCreatedWorkflowOwnershipAuthority|prepareCreatedWorkflowOwnershipDraft|
  authorCreatedWorkflowOwnershipDraft|createCreatedWorkflowReplayContinuityController' --include=*.mjs`
  ——生产调用点只有 `bin/entity-authority.mjs`（铸件）与 `bin/replay.mjs`（消费），其余全是金牌；
  以及 `grep -n 'authority|Authority' bin/compile.mjs`——compile 面的准入件只有
  `readIdentityAdmissionAuthorityFromPrd`，与 v3 结构件无关。
- fable：亲手 grep 复核 `compile.mjs` 对 v3 结构件与其 reader 的引用，结果为零，**采信本定位**
  ——本契约补的是回放侧运行期授权，结构件一字不动，纯加法。

实测三条：

1. **compile 面从头到尾不读 `created-workflow-authority.frozen.json`。**
   `bin/compile.mjs` 里唯一的准入件是 `--entity-authority`
   （`bin/compile.mjs:168-176`，读的是 `readIdentityAdmissionAuthorityFromPrd`，
   件种 `entity-pre-execution-authority`、`authorizedFor: 'compile-execute'`，
   由 `bin/entity-authority.mjs:129-142` 铸）。全仓 `readCreatedWorkflowOwnershipAuthority`
   的调用点只有两处：`bin/replay.mjs:179` 与四枚金牌。
2. **compile 面与 v3 模块的耦合只在两个纯函数**：`issueCreatedWorkflowCompileProvenance`
   （`bin/compile.mjs:403`，产 `compile-provenance.json`）与 `fetchCreatedWorkflowListScan`
   （`lib/compile-atoms-workflow-crud.mjs:13`，列表读回）。两者都不带授权语义，
   是「取证/读回」工具，不是「准许执行」的闸。
3. **Tier2 采集层确实拿 `created-workflow-authority.frozen.json` 当执行件**
   （`lib/selftest-tier2-manifest.mjs:26,31`、`lib/selftest-tier2-collect.mjs:150,177`），
   但它只是把该件原样转给 `casey run` → `bin/replay.mjs`
   （`bin/casey.mjs:164-170`）。也就是说：**该件本来就只在回放面被消费。**

那么真正的口径差是什么？是**这份签名说不清自己授权的是哪一段生命周期、几次运行**：

- 件里没有任何生命周期字段：`AUTHORITY_KEYS`（`lib/entity-created-workflow-continuity-v3.mjs:25-27`）
  只有 `schemaVersion/artifactKind/authorizedFor/caseId/signed/四源摘要/ownershipEdges/
  signerId/signedAt/audience/signature`。`authorizedFor` 的字面量恒为
  `'created-workflow-continuity'`（`:352`、`:368-369`），既不说 compile 也不说 replay。
- 件里没有任何批次或运行维度：签一次，之后**无限次**正式回放都拿它当唯一执行授权。
  `consume: 'once'`（`:149,:331`）是**进程内**一次性——`REF_STATE` 是 `WeakMap`
  （`:11,:557-562,:602`），进程一退就归零，落盘上没有任何消费台账。
- 而人在签它的时候，跑单告诉他签的是「运行时唯一被允许的删除形状」
  （`SIGNING-SESSION.md:309-310`），`plan.md:198-199` 又告诉他「只授权本次 compile，
  不授权正式 replay」。**两句话对不上，且都不是件本身说的。**

所以「拆分」的准确定义应当是：

> 现役授权谱系里，**编译面有 per-compile 授权（`execute-authority.json`），
> 回放面没有对应件**——回放面唯一的执行授权是那份 run-agnostic 的结构授权边。
> 要补的是**回放侧的运行期授权**，不是把一份件劈成两半。

这也让 Steven 的裁决可以低代价落地：**结构授权边字节形状一字不动，新件纯加法**。

## 一、现役授权谱系与缺口（一张表）

| 件 | `artifactKind` / `authorizedFor` | 绑定 | 谁读 | 生命周期 |
|---|---|---|---|---|
| 预执行权威 | `entity-pre-execution-authority` / `compile-execute` | flow + TestCase 精确字节 + `bindings` | `bin/compile.mjs:168` | 每次 compile 一签 |
| 冻结实体锁 | 见 `entity-semantic-lock-preflight` 家族 | events 精确字节 + 角色闭包 | `bin/replay.mjs:213`、`bin/compile.mjs:534` | 每次重编译重签 |
| v3 结构授权边 | `created-workflow-ownership-authority` / `created-workflow-continuity` | 五源精确字节 + `ownershipEdges` | `bin/replay.mjs:179` | 签一次，无限次回放 |
| **（缺）回放批授权** | — | — | — | — |

结论：缺口是最后一行。补它 = 最小权限分离；不补，就只能靠改 `plan.md` 措辞把
「一次签名 = 无限次真机删除权」写成正当，那正是 Steven 否掉的那条路。

---

## 二、六个分岔逐条

### D1　新件的绑定集：与结构件同构，还是另加批次维度？

**倾向：不同构。新件只签「运行期维度」，结构闭包一格都不复述，靠摘要引用。**

论证：

- 复述 `ownershipEdges` 会造出第二个事实源。两份件若日后不一致，
  `readCreatedWorkflowOwnershipAuthority`（`:431`）和新读回面各信各的，
  必须再写一条一致性判据——而这条判据的唯一正确答案就是「以结构件为准」，
  那不如一开始就只引用摘要。
- 最小权限的维度是**范围**（哪几例、哪一批、几次、什么受众、到什么时候失效），
  不是**结构**。结构面已由 §2.2 的最小闭包签死，重签一遍不增加任何约束力。
- 现役已有同形先例：Tier2 清单对连通结果/带外回执的处理就是「声明路径 + 严格
  校验消费件的形状与时点」（`lib/selftest-tier2-manifest.mjs:285-346`），
  不复述被引用件的内容。

建议字段集（草案，非终稿）：

```
schemaVersion / artifactKind: 'created-workflow-replay-grant'
authorizedFor: 'created-workflow-replay'      ← 与结构件的字面量必须不同，互不可冒充
audience: test | production                    ← 沿用 准入受众（CONTEXT.md:106）
grantNonce                                     ← 一次性票据标识
notAfter                                       ← 失效时点（新鲜度上界）
cases: [ { caseId, structuralAuthoritySha256, structuralSignature } ]  ← 见 D2
（无 maxRuns：一次性只由 grantNonce 台账占用表达，见 D3 与评审 H2）
signerId / signedAt / signature
```

不放进去的（明确列出来，防日后加回）：`ownershipEdges`、五源摘要、`platformId`、
`batchToken`（理由见 D3）。

### D2　件间关系：要不要引用结构件哈希成链？

**倾向：要，而且要双绑——引 `sha256(结构件字节)` **和** 结构件自带的 `signature` 字段。**

论证：

- 只引字节哈希：人核对时要自己算 sha256；且如果结构件被重签（换 `signedAt`），
  字节哈希变，链断——这是对的（本该重签授权），但拒因说不清「是结构变了还是签名换了」。
- 同时引 `signature`（`:427` 算的是「去掉 signature 的整件」的摘要）：
  它是**结构+签署元数据**的自哈希。两个值一起比，能把「结构没变、只是换人重签」和
  「结构真的变了」分开报，拒因具名度更高。
- 人核对成本：两件并排看，`cases[i].structuralAuthoritySha256` 对 `sha256(文件)`、
  `cases[i].structuralSignature` 对结构件的 `signature` 字段——**两眼可核，不用跑工具**。
- 代价：零。纯新增字节，不碰任何已冻断言。

附带效果（重要）：**跨案冒用自动被堵死**。A 案的回放件配 B 案的结构件时
`caseId` 与摘要双不合，不需要另写一条判据。

### D3　consume 语义：按批还是按 run？五成员同批一场用几份？

先摆现役事实：

- `batchToken` 由 Tier2 本次调用**现生成**（`lib/selftest-tier2-collect.mjs:378-379`），
  三例的 `uniqueNameToken` 从它确定性派生（`lib/p9-tier2-final-batch.mjs` 的
  `createP9Tier2BatchContext`）。跑单明写「Steven 不用手给令牌，也不许复用上批的」
  （`SIGNING-SESSION.md:375-377`），`plan.md:145-150` 同义。
- 结构件的 `consume: 'once'` 只在进程内有效（`WeakMap`，见 §〇）。落盘无台账。

于是「回放件绑 `batchToken`」有一个硬冲突：**签在跑之前，令牌生在跑之中**。
三条出路：

| 方案 | 做法 | 代价 |
|---|---|---|
| (a) 人给令牌 | 回放件写死 `batchToken`，Tier2 改成消费它而非生成 | 推翻「机器现生成」现役纪律，且人手填令牌可复用、可打错 |
| (b) 一次性票据 | 回放件带 `grantNonce`，机器照旧生成 `batchToken`；**launch 前**原子占用（先记账再放行），台账已有该 nonce 即拒 | 需新增台账件与读写；**已采纳** |
| (c) 只设失效期 | 不绑批，只给 `notAfter` 窗口 | 窗口内可无限次跑，最小权限打折 |

**倾向 (b)，并叠加 (c) 的 `notAfter` 作为第二道上界。** 理由：

- 保住「令牌机器现生成、不可预测、不可复用」这条已生效的纪律不动；
- 仓内已有同款一次性 nonce 机械可抄——连通探针的挑战字
  `ensureWinProbeChallenge` / `consumeWinProbeChallenge`
  （`lib/selftest-tier2-manifest.mjs:248-283`），包括「发→回填→核对→用过即作废」
  的完整协议与「删旧件是尽力而为，所以靠 nonce 不靠删除」的论证（`:236-237`）。
  新件按同一形状做，评审面熟、判据可复用。
- 核销记录**必须落在被签件之外**（`runs/` 下），否则写 `consumedAt` 会改签名字节、
  连带打翻清单哈希。挑战字件本身就在 `runs/` 下，先例对齐。

**一场五成员同批用几份：一份。** 论证：

- 人在 D 段做的是**一个决定**——「这一批，这三条变更型，上真机跑一次」。
  跑单里 `--authorize-mutation` 已经是**批级**给三次
  （`SIGNING-SESSION.md:366-369`）。一个决定对一份签名，签署粒度才和决策粒度对齐。
- 拆成三份 per-case 件 = 一个决定要签三次，且**签不出「这三例必须同批」这条约束**
  ——而这条约束恰恰是 Tier2 清理面已经在硬要求的（`buildTier2CleanupObligations`
  在 `lib/selftest-tier2-collect.mjs:291-295` 明写：cleanup 三例未被全选就返回 `null`，
  金牌 `tier2-production` T4 钉住「单例诊断不许冒充三例正式批」）。
- 反方唯一有力的点是「件该放哪」：`cases/<caseId>/` 是 per-case 目录，批级件无处安放。
  → 放 `runs/` 下、由清单声明路径，正是 `winProbeResultPath`/`outOfBandReceiptPath`
  的现成形状（`lib/selftest-tier2-manifest.mjs:71-74`）。见 D4。

### D4　冻结面影响精确清单

先定一条设计约束，它决定了这张表的长短：

> **不改 `lib/entity-created-workflow-continuity-v3.mjs` 的 `DRAFT_KEYS` / `AUTHORITY_KEYS`
> / `authorizedFor` 字面量（`:21-27`、`:350-353`、`:364-371`）。**
> 一改，八枚 v3 金牌的夹具全部重造，且已签的结构件（若 B9 已跑）当场作废重签。
> 新件走**纯加法**。

在这条约束下逐件核：

**必须 amendment（真翻断言，须人签核销）**

1. `tests/_golden/p9-created-workflow-continuity-v3.authority-cli.zero-sut.golden.mjs:103-122`
   （A6）——spawn 真 `bin/replay.mjs` 带六旗标，断言 exit 65 且拒因是
   `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`。回放件转必填后，这组参数会先撞新门、
   变 exit 64。修法：夹具补 `--replay-grant`，断言语义不变。
   ⚠ 同件 `:94-101`（A5）断言「缺 batch/unique 时拒因具名 `batch-token`」——
   **新门的检查次序必须排在 `bin/replay.mjs:70-73` 之后**，否则 A5 一并翻。
2. `…authority-cli…:73-79`（A2）、`…replay-evidence…:51`、
   `…legacy-fixed-id-supersession…:56,:65`——三处直调
   `createCreatedWorkflowReplayContinuityController`。**若在纯层强制回放件**
   （见下方「强制点」），这三处要补 grant handle，否则 `allowLaunch:false`。
3. `tests/_golden/p9-created-workflow-continuity-v3.tier2-production.zero-sut.golden.mjs:80-118`
   （T5）——`manifest()` 夹具按现役成员 artifact 集造，断言 `current.ok === true`。
   清单形状一动，夹具就要跟。**做成清单顶层路径字段时，只动夹具、不动断言语义；
   做成成员第四件时，还要同步 `CREATED_WORKFLOW_ARTIFACT_NAMES`
   （`lib/selftest-tier2-manifest.mjs:28-32`）与 T5 的三件断言**——后者代价明显更大。

**零翻（纯加法，一格不动）**

- `…created-in-run…`：只用 author/freeze/read/observation/ref/guard，不碰 controller。
- `…stable-absence…`：纯窗口判定。
- `…tier2-cleanup…`：cleanup 义务判定。
- `…role-compile-sign…`：结构面 author/freeze/read/preflight 正反控；
  只要 `authorizedFor` 字面量不动就不受影响。
- `tests/_golden/p9-tier2-selftest.zero-sut.golden.mjs:1059-1101`（T9a）——
  **它不钉「v3 三件」这个常量**，它钉的是「盘上真清单要过结构校验器」
  （`:1065-1068` 断言 `existsSync(MANIFEST)` 且 `validateSuiteManifestDoc(real).ok === true`）。
  所以：**断言文字零改**；清单新增字段后该断言随 C 段重签自然跟上，
  在重签前它照旧红（今天本来就红，`SIGNING-SESSION.md:432` 在册）。

**「T9a 的 v3 三件要不要变四件」——直接回答：不建议。**
理由是 D3 定的批级粒度：回放件是**一批一份**，不是**一例一份**，塞进 per-case 的
`artifacts` 表在语义上就是错的（三例会各自登记同一份件的哈希，或被迫拆成三份）。
建议改成清单顶层多一个 `replayGrantPath`，形状照抄 `winProbeResultPath`
（`lib/selftest-tier2-manifest.mjs:71-74` 的路径闭合校验 + `:285-323` 的严格消费）。
这样 `CREATED_WORKFLOW_ARTIFACT_NAMES` 一格不动，成员面零翻。

**强制点（这是本契约最该被 grill 的一格）**

| 位置 | 强度 | 翻的金牌 |
|---|---|---|
| 只在 `bin/replay.mjs` 的 v3 段（`:144-207`）拦 | 弱：纯层仍可无票造 controller | 只翻 A6 |
| 在 `createCreatedWorkflowReplayContinuityController`（`:716`）要求已验 grant handle | 强：调用面绕不过去 | 翻 A2 / A6 / replay-evidence / legacy-fixed-id 四处 |

**倾向：纯层强制（第二行），接受四处 amendment。** 理由挂在既有教训上：
只在 CLI 拦 = 生产路径可能没接线的假绿形态（记忆 `golden-pure-fn-false-green-needs-e2e`
的镜像面），而本仓已经吃过「抽验证器后金牌只测纯函数」的亏。
配套：accept 金牌必须**同时**有纯层正反控**和** spawn 真 `bin/replay.mjs` 的端到端拒证。

### D5　CLI 面：加 verb 还是新档？签署命令长什么样？

**倾向：在 `bin/entity-authority.mjs` 加第三组 verb，不新开档。**

论证：

- 该档自陈就是「exact-byte entity authorities 的确定性起草/签署边界」
  （`bin/entity-authority.mjs:2`），已经承载两族件（`execute-*` 与
  `created-workflow-*`），分发是 `:120-163` 的一段平铺 if/else，加第三族约 30 行。
- 新开档要复制 `parseArgs`（`:19-29`）、`writeArtifact` + `credentialGate`（`:55-72`）、
  `bytes`/`json` 消毒（`:36-43`）。**签署边界复制一份 = 审计面多一处**，
  凭据兜底门也要多守一处，划不来。
- 反方论点「回放件不是 entity authority 家族」不成立：它签的正是实体删除的执行许可，
  和 `execute-*` 同族同性。

命令形状（草案；Steven 在跑单新增的一步里跑）：

```
node bin/entity-authority.mjs replay-grant-draft <batchId> \
  --case tc_catalog_wf_crud   --authority cases/tc_catalog_wf_crud/created-workflow-authority.frozen.json \
  --case tc_wf_publish_states --authority cases/tc_wf_publish_states/created-workflow-authority.frozen.json \
  --case tc_wf_history_version --authority cases/tc_wf_history_version/created-workflow-authority.frozen.json \
  --audience production --not-after <ISO 时点> \
  --out runs/_tier2/replay-grant.draft.json

node bin/entity-authority.mjs replay-grant-freeze <batchId> \
  --draft runs/_tier2/replay-grant.draft.json \
  （同上三组 --case/--authority） \
  --audience production --not-after <ISO 时点> \
  --signer Steven --signed-at <ISO 时点> \
  --out runs/_tier2/replay-grant.json
```

沿用两条现役纪律：`*-freeze` 用当前精确字节**重建草案再逐字比对**，不一致 exit 65
（`:123-125`、`:146-148` 两处先例）；`--audience` 只吃 `test|production`
（`:99`、`:150`）。`--not-after` 是否该由人给、还是由签署时点 + 固定窗口机器算，
列为待裁（见 §五 Q4）。

### D6　红先行方案：新红钉什么

新契约独立冻结，落 `tests/_golden/p9-replay-authority-split.zero-sut.golden.mjs`
（单枚还是拆两枚，见 §五 Q5）。至少七条，**每条都要能指出「不这么钉就漏什么」**：

| # | 钉什么 | 不钉会漏 |
|---|---|---|
| R1 | 结构件当回放件传（`--replay-grant <结构件>`）→ 具名拒、零浏览器 | 两件互冒充，拆分等于没拆 |
| R2 | 带 `--created-workflow-authority` 不带 `--replay-grant` → 具名拒；且拒因**不是** `batch-token`（次序证明） | 新门被旧门吃掉，测不出真拦 |
| R3 | 回放件反向进结构面：喂 `readCreatedWorkflowOwnershipAuthority` 与 `entity-authority created-workflow-freeze --draft <回放件>` 均拒 | 反向冒充 |
| R4 | A 案回放件配 B 案结构件 → 摘要链不合而拒 | 跨案冒用 |
| R5 | 同一 `grantNonce` 第二次跑 → 核销台账命中而拒 | 一次签名无限次跑（本契约的立命之本） |
| R9–R13 | 过期拒 / launch 前占用第二进程拒 / 采集拒跑回执 / 受众一致性 / 台账写失败 fail-closed | 见 §七（评审补钉） |
| R6 | 纯层不给 grant handle 造 controller → `allowLaunch:false` | CLI-only 假门 |
| R7 | Tier2：清单未声明 `replayGrantPath`、或该件形状/时点/受众不合 → 三例**拒跑并落拒跑回执**，不是静默跑 | 采集层 fail-open |

R1/R2/R3/R7 必须 spawn 真二进制取退出码（不 grep 失败标记串，
按 `verify-goldens-by-exit-code` 纪律）；R6 是纯层，但必须与 R2 成对存在。

红证落 `docs/plans/p9-replay-authority-split/accept/red-proofs/`，
sha256 冻进新 PRD `loop/prd-p9-replay-authority-split.json`，`passes` 只由
`loop-kit/bin/gate.mjs` 写。

---

## 三、签署流程的连带改动

新增一个人签点，**位置在 C 段（清单定稿）之后、D 段（跑批）之前**，
不是派活口径说的 E 段——E 段是录像/残留/终签，跑批已经发生完了，那时再签就是追认。

- `SIGNING-SESSION.md:63-76` 的十行人签清单 → 插入新行「回放批授权（每批一签）」，
  前置 = 序 7（三例 v3 结构授权边）与序 8（清单重签）全部落地。
- `SIGNING-SESSION.md:358-382`（D 段）→ 跑 `selftest --tier2` 之前多一条
  `replay-grant-freeze`；D 段的回执逐项核对表加一格「本批核销台账已记
  `grantNonce → batchToken`」。
- `SIGNING-SESSION.md:384-395`（E 段）→ 残留扫描那一步旁边加「核销台账复核」，
  确认这一批只烧了一张票、没有第二次静默复用。
- `plan.md:198-199` 的措辞不改（它说的本来就是 compile-execute 授权，见 §〇）；
  但 `plan.md` §5「replay 面」需要补一句回放批授权的存在——这属于**改已签计划文本**，
  按 `review-fixes-need-rereview-and-resign` 的纪律，要走 amendment 不能就地改。
  → 列为待裁 Q6。

## 四、不做什么（先划掉，防范围蔓延）

- 不动结构件的字节形状、`authorizedFor` 字面量、五源绑定与 `ownershipEdges` 闭包；
- 不把 `batchToken` 的生成权从机器交给人；
- 不给 compile 面加 v3 授权门（compile 面已有 `execute-authority.json`，
  再加一道是重复授权，不是最小权限）；
- 不改零 LLM 裁判、不改 `cleanupSatisfied` 判据、不碰 `projectReplayAxes`；
- 不把旧 v1/v2 件迁移进新链。

## 五、裁决记录（fable 2026-08-04 终裁，八问逐条）

| # | 问题 | 裁决 | 落点 |
|---|---|---|---|
| Q1 | 前提校正是否采信 | **采信**，fable 亲手 grep 复核 `compile.mjs` 对 v3 结构件与其 reader 零引用；本契约定位改为「补回放侧运行期授权」 | 本文 §〇 已写成显式小节并记复核方式 |
| Q2 | 强制点：纯层还是命令行 | **取纯层**。授权闸下沉唯一事实源才封得住未来旁路调用方，fail-closed 纵深优先；四处翻钉走 amendment，逐条附真实红证与「断言只加严」论证 | `plan.md` §4、§6 |
| Q3 | 票据落点 | **清单顶层 `replayGrantPath`**（照 `winProbeResultPath` 形状）；`CREATED_WORKFLOW_ARTIFACT_NAMES` 与 T9a 断言文字**零改**，已确认 | `plan.md` §4、金牌 R7 |
| Q4 | `notAfter` 谁给 | **人给**。跑单给建议值（如签署时点 + 4 小时），值由 Steven 写进签名字节；**机器绝不代算有效期** | `plan.md` §3.3、§8 |
| Q5 | 新红一枚还是两枚 | **一枚**；实测超 600 行则拆二，拆法在 plan 写明；七条核心钉一条不减，四条 spawn 真二进制照旧 | `plan.md` §5（已拆二：285 + 218 行，另有共用夹具 131 行） |
| Q6 | 已签 `plan.md` 是否补写 | **一字不动**——前提校正后它的措辞本来就对。新契约 `plan.md` 写清与 v3 契约的关系；`SIGNING-SESSION.md` 在本分支更新 | `plan.md` §2、§8 |
| Q7 | 术语登记范围 | **只登记本契约引入的词**（回放授权票据等，先查既有学科词再造）；v3 家族术语未登记是既有欠账，**挂账不在本契约做大扫除** | `plan.md` §10 |
| Q8 | 工作树缺件 | **批准从主树复制（绝不软链）**：`cases/tier2-suite.manifest.json`、五成员 `cases/` 目录、`runs/_tier2/` 下钉子需要的件；复制清单记进 evidence | `evidence/worktree-fixtures-20260804.md` |

两条裁决改了草案原倾向，逐条记明：

- **Q4 原倾向「机器按窗口算」被否。** 机器代算有效期＝机器替人决定授权能活多久，
  与「fail-safe 不 fail-open、人签点不可代签」同向冲突。改为人写值、机器只建议。
- **Q6 原方案「给 v3 已签 plan.md 补一句」被否。** 前提校正后原措辞并无错处，
  改已签文本反而要走 amendment、平白多一处人签负担。关系写在新 plan 里即可。

## 六、续跑与停机（fable 定）

- 本轮交付到 **GRILL 定稿 + `plan.md` + 红金牌草案 + 真红基线存证（未冻结）** 为止，
  **再停一次检查点**：fable 送 grok 做前提审（GRILL + plan + 红测试草案），
  **过审才许碰生产件与冻结面**。
- 停机条件：出现「冻结金牌需要修改才能绿」以外的意外，或八枚 v3 金牌任何行为漂移，
  立即停、报主循环，不在本分支就地改生产件。

## 七、异构前提审与改稿（grok-4.5 high，2026-08-04）

产物：`reviews/premise-r1-grok-4.5-high.txt`。**VERDICT: PREMISE_FLAWED**。
评审方自跑金牌得 exit 1、0/9，并自行 grep 复核了「编译面不读 v3 结构件」这条前提。

**方法前提全部采信**（编译面不读结构件、缺口在回放运行期、洞是真的非标记假红、
纯层强制点、签署点 C 后 D 前、R3a 诚实标注）。被逮的是安全属性的时序与临界路径。

### 逐条独立复现结论

| # | 级别 | 结论 | 复现证据 |
|---|---|---|---|
| C1 | Critical | **成立，改稿重点** | `lib/selftest-tier2-collect.mjs:371-372` 实读：先例是「前置门过后、成员循环（`:387`）开始前」作废，注释原文「前置门过了才作废挑战字」。初稿写「跑完再写台账」确实写反 |
| C2 | Critical | **成立** | 初稿 `plan.md` 把台账只挂在采集编排层，`bin/replay.mjs` 全程不读台账——拿已签未过期票直接跑 `casey run` 可在 `notAfter` 内无限重放，「一次」退化成 Tier2 礼仪 |
| H1 | High | 成立 | 金牌 `:238,:246` 确实注入 `now`；plan 未规定生产路径时钟来源，也无过期红钉 |
| H2 | High | 成立 | `maxRuns` 与 nonce 台账双轨，字段无人消费 |
| H3 | High | 成立 | `batchId` 签署时可任意，与运行期 `batchToken` 无签前预绑定；模型是批级不是 run-scoped |
| M1 | Medium | 成立 | 金牌 R7 只验清单结构，未覆盖采集层 fail-closed |
| M2 | Medium | 成立 | 台账并发/半消耗协议空白 |
| M3 | Medium | 成立 | `bin/replay.mjs:365-374` 是结构件受众对凭据上下文的门，管不到票据受众 |
| M4 | Medium | 成立 | 金牌固定 `a*32`，plan 未写生成方与熵 |
| L1–L5 | Low | 照单落实 | 见下 |

### 改稿落点

- `C1` → `plan.md` §3.3 整节重写：核销 = launch 前原子 check-and-set（先记再放行）；
  落盘失败即 `allowLaunch:false`；崩溃/失败后**不得默认复用旧 nonce**，重试走人签新票路径。
  全文「跑完」措辞清除。
- `C2` → `plan.md` §4 接线纪律加两条：台账校验与占用**和 grant handle 同级必填**、
  进浏览器前门由同一纯层函数完成；直接 `replay` 与 Tier2 **共用单一台账根**。
  §4 表里采集层职责改为「不做闸、不写台账」。
- `H1` → 新增 §3.5：生产 `now` 取主机墙钟、命令行禁止喂时、`now` 注入只留纯 judge 签名；补 R9。
- `H2` → 删 `maxRuns` 字段（不留死字段，见 §3.1）。
- `H3` → 新增 §3.6：全文改口「批级一次性票据」，「run 绑定」定义为核销后审计映射。
- `M1` → 补 R11（采集面无有效票据 → 子进程未起 + 拒跑回执）。
- `M2` → 新增 §3.4 台账协议：`runs/` 落点、只追加、单一写者加原子落盘、
  同 nonce 竞态先写者赢、写失败 fail-closed。
- `M3` → §3.1 加受众逐字相等约束；补 R12（两向都拒）。
- `M4` → §3.1 写明 nonce 由机器在 draft 生成、取 `randomBytes(16)` 级熵、人签整份草案。
- `L1` → 新增 §4.1：豁免面显式三句，并点明三条变更型不在豁免面内
  （其 v3 三件由 `lib/selftest-tier2-manifest.mjs:111-117` 硬要求成组在场）。
- `L2` → §3.1 写明签名是内容摘要、防误用不抗恶意伪造，文书不暗示更强密码学。
- `L3/L4/L5` → 哨兵用法评审已确认正确；范围坦白面（controller 签名、四处 amendment、
  清单顶层字段）原样保留，不改口径。

红钉由九条增至十三条，红证 r2 重采：**0/14、exit 1、零浏览器启动**。

## 八、R2 双路复核与再改稿（2026-08-04）

产物：`reviews/premise-r2-grok-4.5-high.txt`、`reviews/premise-r2-pi-deepseek-v4-flash-high.md`。

**结论分歧**：pi 判 `PREMISE_SOUND`（R1 findings 干净闭合，残差四条属实现期细节）；
grok 判 `PREMISE_FLAWED`（一条新 Critical）。按双路纪律，任一路 Critical 即退回。
R1 的 `C1`/`C2`/`H1`–`H3`/`M1`–`M4` 闭合**双方都认**，本轮只修新开口。

### C-new：批级一票与分进程连跑的硬冲突（独立复现成立）

这条是真的，而且是我上一稿改 `C1` 时**自己引入**的——把占用点从「批前一次」挪到
「每 launch 前」，却没补批内语义。实测：

- `lib/selftest-tier2-collect.mjs:186` 在成员循环（`:405` 调用点）内逐个 `spawnSync`
  一个 `casey run`——三条变更型是**三个进程**；
- `:378-379` 全批共用同一个 `batchToken`。

按上一稿字面实现：成员①占用成功 → 成员②③必撞 `ALREADY_CONSUMED`，变更型批跑不通。
私自加「同 `batchToken` 可再 launch」则「一次」退化为「锁在第一个 token 上可无限 launch」。

改定见 `plan.md` §3.3 的**批会话协议**（每 nonce 一目录、`wx` 开会话、逐成员 `wx` 标记、
三条核验全过才放行），并补四条钉：`R14` 异 token 拒、`R15` 同成员二次拒、
`R16` 同批第二成员放行（**正控**）、`R17` 未授权成员拒。

### 其余 findings 与落点

| # | 级别 | 落点 |
|---|---|---|
| `H-new` spawn 面未带 ledger 旗标 | High | 夹具 `replayArgs` 恒传 `--replay-grant-ledger`；`plan.md` §4 明写双旗标同为必填不可缺其一 |
| `M-new1` 台账三套形状 | Medium | `plan.md` §3.4 收成唯一协议（每 nonce 目录 + `wx` 标记件）；删 `entries[]`、删 `appendLine` 注入、删 `rename` 舞步 |
| `M-new2` 并发原语未指定 | Medium | 原语定为 `wx`（`O_EXCL`）；`R18` 用**两个并发进程**抢同一标记实测单胜者，不留 route:human |
| `M-new3` 采集接线含糊 | Medium | 修正上一稿「采集层不做闸」的过头表述：`plan.md` §4 改为**强制接线**（必须调筛、落拒跑回执），与浏览器前门执法闸**两者都做**；补 `R11b` 钉真接线 |
| `L-new1` §5.1 计数 | Low | 已同步为实测 0/12 与 0/8 |
| `L-new2` 红证路径表述 | Low | §5.1 写明以计划目录为根的完整路径 |
| `L-new3` `R10` 断言偏弱 | Low | 补断言首进程**真到达哨兵点**（`launched === true` 且 `exit 66`），再断言 session 与成员标记已落盘 |
| `L-new4` GRILL 行数过期 | Low | 见下 |
| pi 残差：排除项理由粗 | Low | `plan.md` §3.1 逐项分述（`batchToken` 的真实理由是运行期现生成） |
| pi 残差：`R9` 禁喂时是文本守卫 | Low | `plan.md` §5.1 如实标注为**设计约束而非机制** |

金牌已**拆二**（实测触阈）：`cli-session` 285 行、`pure-suite` 218 行、
共用夹具 `support/p9-replay-grant-fixtures.mjs` 131 行。
红证 r3 双份重采：**0/12 与 0/8，均 exit 1，零浏览器启动**。
