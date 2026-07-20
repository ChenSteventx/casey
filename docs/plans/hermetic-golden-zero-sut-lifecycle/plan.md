# plan — hermetic-golden-zero-sut-lifecycle（阶段二：hermetic 金牌套件生命周期重裁）

> 车道 full（kernel 纪律）。决策源 `GRILL.md`（D1–D9；D8/D9 是本稿 v9 的承重修订）。方向源 `docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md`。
> **本稿 v9 = 保留 codex gpt-5.6-sol high R1–R7 对闭集/血缘/突变证据的硬化，同时并入 Steven D8 与本 session D9 代码复核。** v8 的文件级“全部 behavior 墓碑”前提被推翻：44 条抽样仅 16 条设计上 `full`、26 条 `partial`、2 条 `uncertain`，当前仓实际已有完整后继仅 6 条；31 条敌意覆盖的拟替代 31/31 均有缩水。v9 的最高优先规则是：先把复合 check 原子化，只有已落盘且经机械闭合证明 `full` 的原子义务才可退役；`partial` 只算净新增覆盖，原义务隔离保留；`uncertain` fail-closed 隔离；教义作废单独 supersession。任何后文旧措辞与本规则冲突时，以本段和 GRILL D8/D9 为准。

## 一句话

一批浏览器金牌启动 fake-sut（fake/login/chat/publish 四夹具），按 `SKILL.md:107` 任何 agent 不得启动/连接/回放、其陈旧绿是基础债；27 个文件中 21 个还是混合体。生命周期重裁靠四张独立冻结账互锁：① `sut-startup-closure` 锁 27 个启动面与效果路径；② `source-obligations` 以 `(sourceGolden,sourceCheckId,subObligationId)` 枚举原子义务；③ `retired-uat-manifest` 只收已有 `full` UAT 后继的退役义务；④ `isolated-browser-obligations` 收 `partial|uncertain` 且禁止 agent 执行的保留义务。存活 unit、完整退役、隔离保留、教义作废四类各自闭合；任何部分等价都不能冒充退役。全 PRD acceptance 反向闭包保证隔离 live executable 从所有 story 消失、墓碑路径不残留 true story。真机不实跑；false→true 存证/签名/迁移机制仍延给 `real-uat-attestation`。

## 决策落点（GRILL + codex R1/R2 修正）

- D1/D8/D9：原“behavior→UAT→墓碑”只保留为候选方向，不再是处置结论。先原子化；`coverageRelation:full` 且后继已落盘才 `lifecycle:retire`，`partial|uncertain` 一律 `lifecycle:retain-isolated`，教义已死单独 `lifecycle:superseded`。
- D2：subsumption 以原子义务而非顶层 check 背书。`p2-verdict` 只能接裁定分支，不能接 replay 生成 StepAxes 的因果链；`flow-bridge` 只能接 flow-gate，不能接 compile→events。
- D3/D7：只有 `retire` 的真机后继纳入 `prd-hermetic-retired-uat`；隔离义务进入独立 manifest，不伪称 UAT 后继。false→true 存证/签名/迁移 ledger 机制延给 `real-uat-attestation`。
- D4：复用 (A) `security-revocation` meta-golden 全强度 + 闭集突变电池（R2 已认达标）；规范模板用 AST allowlist 非禁词正则。
- D5：(c) 仅教义已死者（p5 drift/vanished 案级吊销）；自愈 liveness 出本契约。
- D6：扫描器定精确启 SUT 文件闭集；原子义务闭集另由统一 atomization 规则建立。全 PRD acceptance 反向闭包同时保证：隔离 live executable 不出现在任何 story，墓碑路径不残留 true story，存活覆盖 story 保真态。

## 三张独立冻结闭集（v3 骨架，杜绝自证）

覆盖不被静默丢的唯一保证 = 每个覆盖声明有独立源、集合间双向严格相等、突变必红。

### 闭集①：`sut-startup-closure`（哪些金牌/子测试启 SUT，codex R2-F7）

`tests/_golden/support/sut-startup-closure.mjs`：**AST/调用数据流级**静态扫全部 golden 入口，detector 覆盖——fixture server import（含间接 helper / re-export / dynamic import）、别名化 `createServer`/`listen`（如 `replay-video.golden.mjs:349` 自建 listener）、Playwright/browser launch、子进程启动（含拼装/展开 argv）、`--sut` 数据流。**须辨安全前置闸探针**：`admission-audience-wiring.golden.mjs:35` 真传 `--sut` 死址但 `:44` 用 `CASEY_LAUNCH_SENTINEL` 机械证浏览器未启——粗 `--sut` 数据流会误列，故 detector 须识 sentinel-证-未启模式并排除。输出每命中的**原因 + source span**（到 check 粒度，供闭集②辨子测试类别）。

反自证（R2-F7 核心）：扫描器配**独立 detector fixture + 正负控 mutation 电池**——每种启动方式一个正控 fixture（必入）、每种安全前置闸一个负控 fixture（必不入）；accept 证每正控命中、每负控不命中，**再**与契约冻结闭集比较（冻结集由人复核扫描器输出 + 正负控背书得出，非扫描器单方自产自证）。

**原子义务级 SUT 归因，跟实际效果路径非值污点**：真实混合既有服务器在 check 外共享，也有同一 check 内的纯前置闸 + live execute。单一 `dependsOnSut` 不足以表达。detector 对每个 sub-obligation 至少产四轴：`executionRequiresSut`、`assertionConsumesSutEvidence`、`shapeProducedByBrowser`、`judgmentCanRunZeroSut`。`--sut` 值污点非充分条件：`record --from-events` 与安全前置闸均是负控；间接输出、控制依赖、副作用依赖是正控。27 个 fixture 启动文件是文件闭集，不等同原子义务分类。

### 闭集②：`source-obligations`（原子覆盖义务，codex R2-F1/F3）

`tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json`：独立枚举每个待处理金牌的每条**原子义务**。规范键 = `(sourceGolden,sourceCheckId,subObligationId)`；记录至少含 `{obligationId,sourceGolden,sourceCheckId,subObligationId,sourceSpan,originalFileSha256,executionRequiresSut,assertionConsumesSutEvidence,shapeProducedByBrowser,judgmentCanRunZeroSut,coverageRelation,lifecycle}`。`coverageRelation ∈ {full,partial,none,uncertain}`；`lifecycle ∈ {survive-unit,retire,retain-isolated,superseded}`。复合 check 必须拆分，允许同一旧 check 对应多个互补后继。只有 `full` 可配 `retire`；`partial|none|uncertain` 必配 `retain-isolated`；教义作废必须有独立 supersession 理由，不得伪装成 subsumption。

### 闭集③：`retired-uat-manifest`（仅完整等价的真机 UAT 定义）

`tests/_golden/fixtures/hermetic-golden-retired/retired-uat-manifest.json`，checksum 冻入新建 `loop/prd-hermetic-retired-uat.json` 的 testChecksums。每 case **只含不可变 UAT 定义 + 来源血缘**：`{uatCaseId, sourceObligationId, sourceGolden, sourceCheckId, archiveSha256, preconditions, nlSteps, expectedEvidenceSchema, invariant, owner}`——无 `passes`/`route` 等运行状态。

`prd-hermetic-retired-uat` 只为 `coverageRelation:full,lifecycle:retire` 的 UAT 义务写 `observability` route:human；结构化 `uatCaseId` 是唯一指针。拟议 UAT 未落盘前不得把该义务放入退役集合。false→true 的证据存证/可信签名/触发/append-only ledger 仍延给 `real-uat-attestation`。

### 闭集④：`isolated-browser-obligations`（部分/不确定覆盖的诚实隔离账）

`tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json` 冻结所有 `retain-isolated` 义务：`{obligationId,sourceGolden,sourceCheckId,subObligationId,originalFileSha256,coverageRelation,partialSuccessors,uncoveredDimensions,agentExecution:"forbidden",route:"human"}`。`partialSuccessors` 只记净新增保护，不得当退役边。所有隔离 live executable 必须从全部 PRD acceptance 消失；原源码/归档摘要保留作历史行为参照，禁止 agent 运行。

### 分区双向闭合——闭合**带血缘的边元组**非裸目标集（codex R4-F1/F3 + R5 unit 边修）

裸目标集闭合有漏洞：两个同分区 obligation 的 successor 互换后总集合仍相等、category 不错配，但每条义务被错误后继接管（R4 逮）。故闭合对象是**边元组**、每条 successor 携 `obligationId` 血缘、跨命名空间比较用**规范 join 键**（非比裸目标集）：

- `source-obligations` 的 `retire|survive-unit|superseded` 项携一条或多条 typed successor 边；`retain-isolated` 项只携 `partialSuccessors` 与未覆盖维度，禁止伪造退役边。
- 矩阵 key 严格等于 obligations key；每行同时冻结 `coverageRelation`、`lifecycle`、successor 边数组。
- 收据 successor 带血缘 `{obligationId, kind:'unit-golden'|'uat-case', targetKey}`。
- 存活 unit check **冻 `sourceObligationId`**；manifest case 携 `sourceObligationId`；observability 项携 `uatCaseId`。
- **规范 targetKey（R5 逮 unitCheckId 碰撞）**：unit target = `(unitGoldenPath, unitCheckId)` 复合键（禁裸 unitCheckId，不同文件局部 check ID 会碰撞）；uat target = `uatCaseId`（manifest 全局唯一）。

按 lifecycle 分区闭合边集：
- `survive-unit` 边 `(obligationId,unitGoldenPath,unitCheckId)` 四处一致；
- `retire` 边 `(obligationId,uatCaseId)` 全链一致，且机械验证 `coverageRelation===full`；
- `retain-isolated` 与 isolation manifest 双射，机械验证不存在 retirement receipt/uat 边；
- `superseded` 与教义作废收据双射，不计入覆盖等价统计。

任一边缺环/血缘错配 = 红。accept mutation 红证含：删行/加行/重复 obligationId/断链/跨分区错配、**同分区两 obligation 交换 successor（含 unit 分区 matrix+收据协同换线而独立源 sourceObligationId 不变必红）**、**两 obligation 指同一 targetKey**、**收据 targetKey 重复**。

**血缘载荷投影等式（codex R6 逮：只比 ID 不比载荷，固定 ID 下交换载荷可逃逸）**：光比 `(obligationId, uatCaseId)` 不够——敌意可保持所有 ID 不变、在两 manifest case 间交换 `sourceGolden/sourceCheckId/archiveSha256/invariant/nlSteps`，全链边集与双射仍过，checksum 只会把错绑定冻下来。故逐 case 加机械投影等式：

- `manifest.{sourceObligationId,sourceGolden,sourceCheckId,sourceSubObligationId,archiveSha256}` 必须逐字段等于 obligation 血缘与原摘要。
- `manifest.archiveSha256 === 吊销收据.originalSha256 === sha256(gunzip(archive))`（把 manifest 归档摘要并入墓碑归档等式，三者同一）。
- observability 只认结构化 `uatCaseId` 指针，散文 `dimension` 不参与闭合（不承载第二份事实）。

mutation 红证补：**固定 ID 下交换两 manifest case 载荷**、**改单个 lineage 字段**、**改动/交换结构化 `uatCaseId`**——逐个必红。（`dimension` 散文**不得**复制 manifest invariant；散文变化不参与血缘裁定、不影响闭合——与「结构化指针唯一权威」一致，codex R7 逮 v7 二选一抄重的矛盾。）

## 墓碑机制（(A) 先例全强度，R2 已认达标）

只有文件内全部存活义务已抽出、全部待退役义务均有已落盘 `full` 后继、且不存在 `retain-isolated` 义务时，该文件才进入墓碑闭集。任一 partial/uncertain 原子义务存在即禁止整文件墓碑。合格文件四联动（冻结面变更、ADR-0004 人签，route:human）：

1. **金牌体换规范模板墓碑**（`tests/_golden/<name>.golden.mjs`）：marker 注释 + `console.error('...后继...')` + `process.exit(78)`，**AST allowlist 校验无 import/fs/child_process**（非仅禁词正则）。zero-SUT、gate 可跑、exit 78 → story `passes:false`。marker `HERMETIC_GOLDEN_RETIRED_TO_REAL_UAT_TOMBSTONE`。
2. **原字节归档** `tests/_golden/revoked/<name>.golden.mjs.archive.gz`：收据记 originalSha256、meta-golden gunzip 复核。归档是行为参照源（≠ UAT case 本身）。
3. **吊销收据** `tests/_golden/fixtures/hermetic-golden-retired/…-retired.json`：`superseded-tombstoned-not-pass`/`hazard:none`/逐条 executablePath+originalSha256+tombstoneSha256+supersededStory+reason+successors（指 manifest uatCaseId + 若有 flow-gate 子覆盖指存活 unit golden）。
4. **prd story 级处置**：`task` 溯源注释；`testChecksums` 对墓碑体/存活 unit 分别原地重签；`observability` 指 manifest；**只翻墓碑对应 story 为 false，存活纯覆盖 story 保真态**。

**单一 meta-golden** `hermetic-golden-retired-tombstones.zero-sut.golden.mjs`（R2 认强度达标）：冻结精确墓碑闭集、硬断收据集合恰等且数量恰等；逐墓碑验 marker（先于 spawn）+ AST 规范体 + gunzip sha===originalSha256 + 体 sha===tombstoneSha256 + spawn exit===78 + 无副作用（sentinel）。accept 突变电池：删体/删marker/改exit0/篡archive/加 fs 或 child_process/删「收据项+体」对/收据增减——逐个证必红。

## 全 PRD acceptance 反向依赖闭包（codex R2-F6，新增）

`tests/_golden/support/prd-acceptance-reverse-closure.mjs` 扫全部 `loop/prd-*.json` 的 story acceptance。机械校验两类禁止边：①所有 `retain-isolated` live executable 不得出现在**任何** story acceptance（gate 不看现有 `passes`，仍会执行命令）；②墓碑路径不得出现在 true story。混引 story 必须拆分，存活 zero-SUT 检查保留原真态，隔离命令改为安全的静态 isolation assertion，不得留下 live fake-SUT 命令。

## output-seal 处置（R 组，codex R2-F4 完整合法信封）

`output-seal` 死端口 `127.0.0.1:1`、不启 fake-sut、划 R 组（zero-SUT 重验、非墓碑）。真假绿点：B5 用 `workflow.create`（`:214`）被准入判 mutation（`entity-semantic-lock-preflight.mjs:42`），无 authority 在登录凭据失败分支前即拒（`:783`），抢跑原「登录预备失败、种子不回显」断言。**仅改 atom 不够**——无 authority 的 `nav.workflowManagement` 还要求（`entity-semantic-lock-preflight.mjs:54/62`）：信封 URL 属固定白名单 + event URL===信封 URL + action:`nav` + 无 `pre`，否则 `REPLAY_READ_EVENT_TARGET_INVALID` 抢跑。修法：B5 信封与 event URL 同改合法固定信封（`{{baseUrl}}/ai-manager/process/list`）、`action:"nav"`、无 `pre`、设 `CASEY_LAUNCH_SENTINEL`，断 exit 65 + 登录预备失败原因 + 种子不回显 + 哨兵不存在。**补 output-seal 专属验收点**。

## 工序（v9）

0. 跑闭集①扫描器正负控，冻结 27 个 fixture 启动文件闭集与原因/span。
1. 统一 atomization：把复合 check 拆成 `(sourceGolden,sourceCheckId,subObligationId)` 原子义务，冻结四轴 SUT 归因与原 sha。
2. 逐原子做覆盖等价审计，冻结 `coverageRelation`/`lifecycle`；拟后继未落盘一律不得计 `full` 退役。
3. 先建存活 zero-SUT unit 与必要纯入口；部分等价只记新增覆盖，不改变原义务 isolation 状态；另补 `CASE_DEFECT` 与 output-seal B5 窄回归。
4. 建 `retired-uat-manifest` 与 `isolated-browser-obligations`；只为已兑现 full UAT 边写 retired observability。
5. 仅对满足文件级全量 full 条件者执行墓碑四联动；教义作废另立收据。
6. 跑全 PRD acceptance 反向闭包：清除全部隔离 live executable 引用，拆混引 story，保持存活检查真态。
7. 分区边元组、血缘载荷、isolation 双射、墓碑 meta 与突变电池全绿；迁移机制仍延 `real-uat-attestation`。

## 验收点（交 acceptance-gate 铸可执行规格）

- 闭集①扫描器：每启动方式正控必入、每安全前置闸负控必不入、27 文件输出与冻结闭集严格相等（可命令化 + mutation）。
- 闭集②以 `(sourceGolden,sourceCheckId,subObligationId)` 原子化；复合 check 正负/接线义务均在，四轴 SUT 归因可机读；obligations 与矩阵 key 严格等集，删行/加行/重复 ID/合并复合义务突变必红。
- 生命周期门：只有 `coverageRelation:full` 可 `retire`；`partial|none|uncertain` 必须 `retain-isolated`；拟 successor 缺文件/缺 sourceObligationId 即红；旧 18→25 四项只可 superseded，不可伪称 subsumed。
- 拆出的存活 unit golden：实现前红、拆后安全执行真绿；partial unit 只作新增覆盖，不能自动改变 isolation。
- `p2-verdict` CASE_DEFECT 扩充案：实现前红、扩后绿。
- 每墓碑 `exit==78` + AST 规范模板；meta-golden 闭集 + 逐项验 + 突变电池逐个证红（可命令化）。
- check 级 SUT 依赖归因：check-前共享启动/check-内启动/纯 check 位于启动前/共享跨多 check 正负控逐个证归因正确（可命令化）。
- 分区边元组双向闭合：unit 复合键、UAT uatCaseId、isolation obligationId 各自双射；同分区换线、两义务指同目标、收据目标重复、partial 偷进 retire 均突变红。
- `prd-hermetic-retired-uat`：manifest 入 checksum，只含不可变定义+血缘；仅 full UAT 义务各一条 observability。`isolated-browser-obligations` 与 isolation observability 双射，且不得出现 retirement receipt。
- **血缘载荷投影**：`manifest.{sourceObligationId,sourceGolden,sourceCheckId,archiveSha256}` 逐字段等于 `obligation.{obligationId,sourceGolden,checkId,originalFileSha256}`；`manifest.archiveSha256===收据.originalSha256===sha256(gunzip(archive))`；mutation 红证含固定 ID 下交换两 manifest case 载荷/改单个 lineage 字段/改动或交换结构化 `uatCaseId`（可命令化）；`dimension` 散文不复制 manifest invariant、变化不参与血缘裁定。
- 实现层规范（非设计分岔）：`targetKey` 的 JSON 编码与仓根相对路径形式在 accept 时冻死，禁歧义字符串拼接（codex R6 非阻断项）。
- PRD acceptance 反向依赖闭包：全部隔离 live executable 从所有 story acceptance 消失；无墓碑路径残留 true story；存活检查 story 保真态（可命令化）。
- output-seal B5：合法固定信封 + action:nav + 无 pre + 哨兵，断 exit 65 + 原因 + 种子不回显 + 哨兵不存在（可命令化）。
- ADR-0004 冻结面人签（atomized obligations/矩阵/unit/隔离账/墓碑体/收据/重签 checksum/案级吊销/manifests/PRD）：route:human。

## p5-replay 处置（story 级，R2 认 p5 本体已消解）

原 s2 纯覆盖 `p5-replay-coverage` 保持 true。drift/vanished 可按教义作废逐案 supersession，但不得把 `p2-verdict` 冒充 replay 生成 driftProbe 的完整后继。8 个存活 replay 案只有在逐案真机 UAT 定义已落盘并通过 full 门后才进 retire manifest；此前保持隔离，不整文件墓碑。需 ADR-0004 人签。

## 明确不在范围

- 自愈 liveness 契约（护栏 #13 无活触发器）：另立契约。
- **`real-uat-attestation` 契约（D7 延）**：false→true 的证据存证 + 可信签名 + 触发 registry + append-only 迁移 ledger 机制，配合 P4 signerId 认证落地时做；本契约只落 observability route:human 声明 + 冻结 manifest 账，不建迁移机制。
- 真机 UAT 实跑：manifest 冻结但不跑，延给 Steven（隧道 loopback + .auth）；由 `real-uat-attestation` 契约承接迁移。
- 已合规 zero-SUT（`flow-bridge` 仅 flow-gate 层 / `p5-replay-coverage` / `p2-verdict`（会扩缺口案）/ `admission-audience-*`（安全前置闸、扫描器负控）/ 全部 `*.zero-sut`·`*.static`）：不墓碑。`replay-settle-mount` 台账「已迁」是陈旧记录、实混合金牌、属本契约。

## 金牌候选清单（Explore 手工清点，扫描器 accept 时定权威）

启四夹具 SUT 的候选（非权威，闭集①定准）：replay 类 drawer-lock-hardening / replay-nth-visible-hardening / replay-settle-mount(混合) / p5-replay / wf-publish-states(混合) / chiefcomplaint-smoke(混合) / kinds-harden(混合) / layer3-wiring / run-history；compile 类 p3-compile / plan-debt-sweep / e2e-chain / wf-add-node / wf-connect-nodes / wf-open-node / wf-open-smoke / wf-select-node-dropdown / wf-set-node-field；登录发布类 p2-sign / replay-login-bootstrap / replay-video(自建 listener) / video-login-carry / btn-enable-ops(混合) / wf-history-version；未归账 regress-promptset(混合) / report-diagnostics(混合) / run-convention。R 组 output-seal（死端口、非墓碑）。C 组 p5 drift/vanished 案级。候选合计约 27，扫描器核定。混合金牌由闭集② category 推导、非本清单示例为准。
