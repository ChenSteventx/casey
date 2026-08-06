# 评审任务 · wf-open-readback-requery R1（异构只读评审）

你是异构评审方（实现家族=Claude，你独立复核，不采信实现者结论，一切以仓内证据与你自己跑出的结果为准）。
本工作树只读评审：可自由读文件、跑金牌与 git 命令取证；**不得**修改工作树内文件（红证复现用
`git show <rev>:<file> > /tmp/...` 姿势，绝不 `git checkout -- <file>`、绝不写暂存区）；**不得**启动任何
SUT/浏览器真机流量；**不得**读取 `.auth/`、`site.json` 或任何凭据与真实目标地址。

## 快照与基线

- 候选快照：本仓 HEAD `85642ad`（分支 `wf-open-readback-requery`）。评审前先核 `git diff HEAD` 为空。
- 基线：dev `8d0e6e3`。评审差异集 = `git diff 8d0e6e3..85642ad`。
- 文件白名单（差异全集，不做全仓漫游）：
  - `lib/compile-atoms-workflow-nav.mjs`（唯一实现变更）
  - `tests/_golden/wf-open-readback-requery.zero-sut.golden.mjs`（新验收金牌）
  - `loop/prd-wf-open-readback-requery.json`（PRD 冻结）
  - `docs/plans/wf-open-readback-requery/`（GRILL/plan/红证）
- 背景事实源（只读参照，不在变更集）：`lib/compile-atoms-agent.mjs`（agent 侧同族门先例）、
  `lib/agent-identity-gate.mjs`（冻结纯函数判定表）、`lib/agent-search-gate.mjs`（卡片双锚/句柄内点击）、
  `lib/entity-created-workflow-continuity-v3.mjs` 的 `fetchCreatedWorkflowListScan`（create 侧真机已通扫描）、
  `lib/compile-atoms-flow.mjs`（观察归档与硬阻断中止）、`lib/compile-atoms-workflow-crud.mjs`
  的 `readCreatedWorkflowIdentity`（create 侧读回先例）。

## 变更主旨（事实陈述，不含实现者推理）

B4 十跑真机证据：`workflow.open` 前奏容器命中 4ms、锚定 3ms、click acted，阻断在 source 读回双证门
`action_failed（envelope-empty）`。本契约把读回+双证从「click→详情页→武装账本信封」重构为
「点击前列表页语境：`fetchCreatedWorkflowListScan` 扫描 + `resolveAgentCardTarget` 物理双锚 +
`resolveDualIdentity` 裁定 + 过门才 `clickAgentCardWithin` 句柄内点击」；`armWorkflowSourceReadback`
（信封路线）退役。路线取舍经 Steven grill 定案（丙路线），记录在 `docs/plans/wf-open-readback-requery/GRILL.md`。

## 风险清单（逐条给结论，有据可查）

1. 未声明身份通道路径是否真零漂移（`identityLedger` 缺席时 events 序列/阻断语义与基线逐字节等价）。
2. 扫描证据替代信封的 fail-safe 属性：`scan.complete` 判据、fetch 失败/denied 路径、0/500/1500ms 重试
   语义（零命中重试、同名多行不重试）是否存在 fail-open 缝隙（证不出被当证得出）。
3. `resolveDualIdentity` 输入投影正确性：`container-out → dom.status='failed'` 映射、扫描行集投影为
   `{status:'ok', rows, total}`、`expected.code` 条件实例化——判定表语义是否被旁路或弱化。
4. TOCTOU 与句柄生命周期：`cardGate.card` 从双锚到点击的存续、成功/失败/异常各路径的 dispose、
   有无泄漏或双释放；点击重验失败的 fail-closed 姿势。
5. 观察归档链：`evidenceStepId` 恰为终端 click、`pendingIdentityObservation` 形状与 `compileFlow`
   归档（provenance join）/基数门/issuer 门的兼容性；sign 对账面是否被破坏。
6. `compileWorkflowOpen` 新提前 return 结构对同文件其余原子（openNode/addNode/connectNodes 等）
   与调用方的影响。
7. 金牌质量：S1-S4 断言是否真钉住上述性质；红证（`accept/red-proofs/`）是否对最终金牌字节在
   旧实现下真实取得（可用 `git show 8d0e6e3:lib/compile-atoms-workflow-nav.mjs > /tmp/...` 自行复现）；
   PRD 三条 sha256 自算比对。
8. 邻接面：接缝金牌（`entity-workflow-source-readback.wiring/cardinality-reverse`、`wf-open-search-first`、
   `wf-open-preface-notes`、`post-nav-anchor-wait`、`wf-crud-sleep-import`、`entity-ui-wiring.bindagent-replay`）
   你自己跑一遍核绿；两个既存陈旧红（`entity-workflow-source-readback.arming.static`、
   `entity-ui-wiring.searchopen`，门面拆分族）非本契约债，但请核本变更未使其更红。

## 已有证据（可复核，不必采信）

- 验收金牌 20/20 绿（`node tests/_golden/wf-open-readback-requery.zero-sut.golden.mjs`）；
- gate GREEN 2/2 story（PRD `passes` 由 gate 写入）；
- 全仓 295 金牌双态扫描零回归（异码项串行复核消解；`bindagent-lockchain` 主树红归因主树未提交
  `.tmp` 残件 `PUBLICATION_TMP_WITHOUT_JOURNAL`，与本变更无关——工作树绿可自证）。

## 输出格式（严格遵守）

- 逐条 finding：`[Critical|High|Medium] 文件:行 —— 一句话缺陷 + 失败场景 + 证据`；首轮只报 C/H/M。
- 风险清单逐条给结论（过/不过/存疑+为什么）。
- 末行单独一行：`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。
