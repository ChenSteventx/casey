# real-uat-attestation · 真机 UAT 见证（2026-07-22/23 夜）

> uatCaseId=`tc_agent_id_readback_real_uat_v1`（冻结 uatDefinition 见 `prd-agent-id-readback` observability）。
> 隧道回环 + autotest（Steven 带外核）；GRILL 三分岔 Steven 全 A（我建我删 / 授权条件直签 / 即刻跑）。
> 脱敏纪律：只记测试件名（atl_ 前缀）、类名、路由形态、值形态（位数+字符集）与 sha 前 16 位；
> 凭据、真实基址、业务数据零回显。产物本体在本机 `cases/`、`runs/`（gitignore，不入库）；本文是持久权威。

## 四步执行账（uatDefinition 字面对照）

### ① 执行权威 → 真机重编译产 v2 产物 ✓

- 预置：autotest 创建测试智能体 X=`atl_同名对抗0722`（全场唯一；创建证据=精确同名卡 0→1）。
  平台按名称自动生成编码 `znt_atl_tmdk0722`（我填的编码被自动生成覆盖——真机形态发现①）。
- 铸权：`entity-pre-execution-authority`（audience=production、signerId=Steven、
  `calculateIdentityAdmissionSignature`）sha=`1d334e39…` 入 `prd-tc_agent_id_readback_real_uat_v1`。
- `casey compile --execute`（身份通道声明激活：listApi 真机填值+`itemContainer=.agent-card`+
  `cardFields=.agent-card__title/.agent-card__subtitle`）：events 4 步 / observed 4 步 / 候选 0，
  `identityGate={resolution:unique}`。产物：events v2（`3bfb356e…`）、draft v2 双 digest
  （`2e3f2880…`）、`identity-observations.compile.json`（`34420227…`，恰 1 行：kind=agent、
  name=X、code=`znt_atl_tmdk0722`、platformId=**19 长纯数字**、evidenceStepId=atstep_3、
  sourcePath=`/ai-manager/agent/setup/queryAgentPageList`）。

### ② sign 五元 join 人签出 frozen v2 ✓

- 确认件：draft.bindings 4 行 → 实体锁收据（kind=agent、bindingMode=existing、user-confirmed；
  **code/platformId 用真机观察读回值填充——尖峰结论③「code 通道待真机回读」的显式待办自此兑现**）。
- `freezeEntityBindingsDraft` 干跑 ok/replayReady=true → `sign --entity-observations` 直签
  （signer=Steven、build=1.1.2）：`expected.frozen.json`（3 条断言，`be609d20…`）+
  `entity-locks.frozen.json`（schemaVersion 2、identityObservations 1 行，`b1ffdb86…`）；
  两 sha 由 sign 写入 tc prd。
- 修单一笔（草拟阶段，冻结前）：首版补缝 patch 的 intentId 误写语义名 `intent_open`（事件流水实为
  `intent_1`），断言成孤儿静默未挂——重补缝+`--resign --archive-dir` 重签（expected 单独重签，
  身份锁未变不重签）。**工装发现②：drafter L0 闸不校验 patch.intentId 是否存在于 observed intents，
  错位断言静默失联**（挂账，见「发现与挂账」）。

### ③ 回放：双证到点击那一刻 ✓（两放）

- 回放①（X 全场唯一，令牌 uat0722r2）：动作轴 `{resolution:unique, candidateCount:1,
  identityReadback:{ok:true}}`——信封读回+DOM 双证对已签 platformId 全等、句柄内落笔；
  `urlPathname startsWith /heren/aimanagement/agent/detail` ok=true（详情真开）。
  裁定 intent_0 PASS / intent_1 **SUT_DEFECT**（axes `795cc3d2…`、verdict `bb9fdd39…`）：
  本步归因两条**真实 503**（`/ai-manager/agentPlus/queryPlus`、`/ai-manager/agent/setup/getAgentDetail?promptTemplateId=…`），
  信封先决如实背书——**SUT 真缺陷发现③：autotest 经标准「新增智能体」表单创建的骨架智能体，
  详情页两 API 确定性 503（跨两次回放复现）**。身份 UAT 判据（读回/全等/落笔/路由）全过；
  503 是被测系统的问题、正是 Casey 的本职产出（fail-safe 不粉饰，判断交 Steven 人签裁定）。
- 敌意预置：创建第二个精确同名 X（编码 `atl_dup0722_b`——确认前最后覆写编码+回读校验，
  破平台自动同码拒绝；精确同名卡 1→2，同名不同码对成立）。
- 回放②（同名对在场，令牌 uat0722r3，同一冻结件）：动作轴 `{resolution:ambiguous,
  candidateCount:2, identityReadback:{ok:false}}`——**必 AMBIGUOUS 不点击**；
  `urlPathname` actual=`/heren/aimanagement/agent/list`（仍停列表页=不点击的物理证据）。
  裁定 intent_1 **NEEDS_HUMAN·AMBIGUOUS_ACTION**（预期正确行为；axes `95009534…`、verdict `8c4c88bc…`）。

### ④ 报告三形态交付 + 清理归零 ✓

- 报告 ×2（各 html/md/json）：`runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/report{1,2}/`
  （report JSON `e38fdde9…` / `96b450e6…`）。
- 清理（我建我删）：两件按**编码副标题逐卡定位**（同名双卡在场、裸「删除」即歧义——清理自身守双锚
  纪律）经卡「更多」菜单删除；精确同名卡 2→1→0（归零证据）。

## 发现与挂账

1. **SUT 真缺陷（交 Steven 裁定/上报）**：标准表单创建的骨架智能体详情页 `agentPlus/queryPlus` 与
   `getAgentDetail` 确定性 503。回放①报告即此缺陷的自包含取证件。
2. **工装缝（另立修单）**：drafter `--patch` 的 intentId 不经 observed intents 存在性校验，
   错位断言静默成孤儿（表现=冻结面缺该断言、裁定退化到只剩全局取证）。
3. 真机形态账（入原子知识候选）：新增智能体=下拉两跳入口；编码由名称自动生成、可确认前覆写；
   `智能体描述`必填（内联报错不出 toast）；卡删除藏「更多」菜单（`agent-card__more`）；
   列表搜索渲染需 3-4 秒静置（同 C7 时序家族，回放侧由身份账本 settle 有界等待天然覆盖——
   两次真机回放零竞态，C7 真机观察义务顺带核销）。
4. ADR-0009 完成闸：本见证的最终「过闸」由 Steven 对本文+双报告人签后成立（尤其发现 1 的
   SUT_DEFECT 判定采认）。

## run-2（codex R1 修单重跑，2026-07-23——本节为交付权威，run-1 账保留作缺陷取证与溯源）

codex R1 FAIL 四阻塞（报告缺录屏/附件悬空、金牌自证账本、prd 错账、预置清理 fail-open）全采信；
录屏/附件义务只能整链重跑兑现（冻结件绑已删 X 实例的 platformId——身份锁语义使然）：

- **重跑仪式**：run-1 冻结件人工审计归档（`cases/…/archive/run1-20260723/`，tc prd 陈旧账同步摘除
  ——sign 的「无 publication journal 拒猜残留」fail-closed 实证有效）；重预置 X（fail-closed 严判
  0→1、编码回读必等）→ 重编译（观察 code=`atl_dup0722_a`、platformId=19 长纯数字新实例）→
  确认→草拟（同 patch）→ 全新签署（frozen `78530d5c…`、locks v2 `a2261aed…`、events `4440f8d1…`、
  观察件 `5c559d34…`）。
- **回放①（run2-replay1，录屏+全附件）**：双证 unique+回读 ok+落笔+详情路由，**verdict 2/2 全 PASS**
  （axes `e4ac5201…`、verdict `29b63e5c…`、video `5d93e93d…`、report JSON `bb1a1932…`）；
  视觉复核 CONSISTENT（逐帧：列表搜索态→详情页，frames/ 共置）。
- **回放②（run2-replay2，录屏+全附件）**：同名对在场必 AMBIGUOUS 不点击——
  NEEDS_HUMAN·AMBIGUOUS_ACTION（axes `ae3b2fd3…`、verdict `8c4c88bc…`、video `f822fbf3…`、
  report JSON `4cc8bf0d…`）；视觉复核 CONSISTENT（终帧=恰两同名异码卡、全程无详情画面=不点击铁证）。
- **附件共置**（三链版式）：两 run 目录各含 report 三形态+`verdict.json`+`axes.json`+
  `run-history.jsonl`+`run-metrics.json`+`video.json`+`video.webm`+`visual-review.json`+`frames/`
  ——报告附件链接全部落地，SKILL.md 报告交付最低内容四项齐。
- **清理（fail-closed 三面归零）**：删两件→名称归零+逐编码搜索归零（`atl_dup0722_a`/`_b` 各 0）；
  运行日志冻结入库 `evidence/cleanup-run2.log`。
- **503 缺陷相关性精化**：run-1 X（编码被平台自动生成 `znt_atl_tmdk0722`）详情页两 API 确定性 503
  （跨两放复现）；run-2 X（显式编码覆写生效）详情页干净、全 PASS——缺陷与实例/创建路径相关，
  非全局；Steven 已采认的 SUT_DEFECT 取证件（run-1 report1）连同其冻结件归档保留。
- 脚本四件（预置/清理/铸件/确认）拷贝入库 `docs/plans/real-uat-attestation/scripts/`（审计可核）。

## 五元对账快照（sign 时点）

observations(1 行) ↔ confirmations(4 行同收据) ↔ draft v2（identityProfileDigest=`sha256:8b839a20…`、
identityObservationsSha256=`sha256:34420227…`=观察件原始字节 sha）↔ events（`3bfb356e…`）↔
tc prd testChecksums（authority `1d334e39…` + frozen 两件）。`freezeEntityBindingsDraft` 干跑与
sign 双双绿；回放①③账本激活由 v2 冻结权威（identityExpectedByStep 非空）。
