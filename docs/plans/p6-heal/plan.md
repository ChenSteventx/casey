# P6 heal 实现计划 v4（lane: full）

> v1→v4：codex sol xhigh + grok-4.5 三轮联合计划评审逐轮收敛；分岔裁决见 GRILL.md v4
> （D1-D12）。目标不变：把 `casey heal` 从桩落成「自愈准入门 + 非就地有界自愈」，
> 裁判零改、fail-safe 不降级、零 LLM。

## 1. 范围与非目标

做：S0 热路径可达性证明、准入门、确定性重锚提案（写读同形）、drift 补丁与证据元组台账、
候选旁文件式应用、事务性晋升、真链路复核编排、熔断/升级、CLI、全套 hermetic 金牌。
不做：`bin/verdict.mjs` 任何改动（绝对）；`replay` 生产库改动（S0 若证不可达则挂账不硬改）；
探针词表扩充；LLM；MCP 面变动；变更型用例自动复核（D3，route:human）；真机验收（route:human）。

## 2. story（先红后绿；产码文件逐个严格 <600 行）

S0 **热路径可达性证明**（D10）：用 replay 链既有假运行时接缝金牌证明词表原子
   miss→探针→axes.driftProbe→verdict `HARNESS_ERROR` 在现役接线全链可达。
   分支：可达→后续 story 按证据形状实做；不可达→出具证据文档，热路径挂账后继契约，
   本契约交付机械全链（验收表 A0 两分支各有明确产物，不虚标）。
   **S0 已执行完毕（2026-07-29）：结论证伪、走分支②**，证据见
   `docs/plans/p6-heal/hotpath-evidence.md`。断点在第一环（回放 miss→探针），两处独立断裂：
   ① 唯一词表原子 `workflow.deleteByName` 的点击步在 `lib/replay-actions.mjs:100-109` 被破坏动作
   域锁截走，`lib/workflow-delete-domain.mjs` 零次引用 `findEquivalentAffordance`、其轴工厂
   （:32-34）三键闭合无 `driftProbe`；② 三处探针调用位读 `event.targetName`，而全仓生产代码无一处
   写该字段（`cases/*/events.json` 出现 0 次），词表原子的目标名实存于 `value`。第二、三环实测全通
   （对照组：正向探针三元组进三轴即被 `bin/verdict.mjs:66-73` 抬成 `HARNESS_ERROR`，裁判零改）。
   故 S1–S7 按机械全链实做，热路径缺口挂账后继契约（解除条件见证据文档末节），
   不得对外宣称词表原子漂移已可自动自愈。

S1 **准入门** `lib/heal/admission.mjs`：纯函数。放行=步 verdict `HARNESS_ERROR`
   ∧ axes 同步 `resolution==='none'` ∧ `driftProbe.sameSignatureUniquePresent===true`
   ∧ `matchedSignature` 非空 ∧ atom 在词表 ∧ **D12 v4.1 互证全过**：目标步 events 定位必须
   纯语义可重构（role/accessibleName/targetName；含 `fallbackCss` 等未投影字段拒
   `HEAL_LINEAGE_UNVERIFIABLE`）∧ axes 目标步动作轴/探针三元组与 events 重算一致 ∧
   verdict↔axes 全步集与 caseId 精确一致 ∧ run-history 逐字段对账；失配拒
   `HEAL_INPUT_PAIR_MISMATCH`（现役产物无内嵌血缘已实测，不做「哈希互绑」旧模型）。
   拒因：`HEAL_VERDICT_NOT_HARNESS_ERROR` / `HEAL_NO_POSITIVE_DRIFT_EVIDENCE` /
   `HEAL_INPUT_PAIR_MISMATCH` / `DRIFT_VOCABULARY_UNSUPPORTED` / `HEAL_INPUT_INVALID`。
   单步处理（D11）：`--step` 显式或首个可准入步。

S2 **重锚提案** `lib/heal/reanchor.mjs`：先读 `lib/replay-actions.mjs` 定位消费面与既有
   `drift-patch.fixture` 形状（D9，实现首步落对照笔记入 plan 附录），产出与回放器消费形
   **同形**的语义锚补丁（含 withinRow 语境）；与现役定位等价→`HEAL_REANCHOR_NOOP`
   （归「无一步可自愈」语义，CLI 出口 `exit 4` + 具名 reason，D7）。纯数据。

S3 **补丁与台账** `lib/heal/drift-patch.mjs`：补丁 `drift/<caseId>.<ts>.patch.json`
   （证据元组三哈希、探针三元组、before 定位、proposed 锚、`signed:false`）；台账
   `drift/<caseId>.ledger.jsonl` 以**证据元组**为键（D2）：同元组幂等返回既有补丁；
   **同一 `{caseId,stepId}`** 的不同元组第 2 次→inbox 升级+拒新补丁（`HEAL_FLAKY_ESCALATED`，
   不同步骤各自首漂不互相触发）；并发安全=独占锁文件（O_EXCL 创建 `ledger.lock`，持锁读改写
   追加，陈锁 fail-closed 具名拒因），读-改-写全程在锁内，杜绝双进程覆盖丢行。
   写前写后断言原 events sha256 不变。

S4 **候选式应用** `lib/heal/apply.mjs`（D5 重设计）：`--apply --patch <已签补丁>`：
   校补丁签署（`HEAL_PATCH_UNSIGNED` 拒）→ 产出候选 events 旁文件
   `drift/<caseId>.<ts>.events.candidate.json`（目标步换锚、其余字节保序），原 events 不动；
   输出候选 sha256 供人签绑定。**不存在就地改写路径。**

S5 **日志式事务晋升** `lib/heal/promote.mjs`（D5 v4）：前置全验=候选 sha256 与人签绑定一致、
   受影响冻结绑定重签件就位（实现首步实测哈希面清单）、无未封 journal；任一不满足整体拒
   `exit 6`。journal 登记**全部将改目标**（events+每个绑定/发布指针）的前后 sha256 与逐件
   预存副本，按五步走（journal→重签件校验→events rename→绑定发布→receipt 封账）。
   **回滚与晋升对称**：journal 逆序逐件恢复（events+绑定全集）、逐件 sha256 断言、回滚过程
   自身入 journal 并以 `rolled-back` 封账；无「只恢复 events」的半回滚路径。任何 heal
   子命令见未封 journal（含回滚中断）一律 fail-closed。

S6 **复核编排** `lib/heal/reverify.mjs` + `bin/heal.mjs`：晋升后复核只认真 replay→真 verdict
   链（D6），先验冻结件签署权威；复核准入=签署 `reset-proof.json` 验真（D3 v3 schema，布尔
   自报无效），否则 route:human（receipt 记之，exit 0 outcome=reverify-routed-human）。
   **通过标准**：目标步 `PASS` ∧ 对照 heal 前基线 verdict 全案无非目标步「绿→非绿」新回归；
   违反→FAILED→按 journal 自动回滚。CLI 四模式；stdout 结构化 JSON；退出码按 D7 **已冻结**
   码表（0/2/4/6/64/65），casey.mjs 图例同步补一行。血缘判别按 S1 的 D12 内容级互证执行
   （不依赖内嵌哈希链——现役产物无此面，已实测）。

S7 **熔断接线**（D8 v4 同步）：case 级——同一 caseId 连续 3 个完整 heal 周期（跨步骤累计、
   同证据幂等不算）无任何**终局 receipt**（healed→PASS 或 route:human）→ loop-kit breaker
   跳闸 exit 2 + inbox。进展只认终局 receipt；**新补丁产出不算进展**（空转轮可以产补丁，
   A5 三步空转路径因此可达）。同步骤复发由 D2 先行拦截，不叠轮数。

依赖：S0 → S1-S3（可并行）→ S4 → S5 → S6 → S7。

## 3. 验收表（acceptance-gate 冻结为 loop/prd-p6-heal.json；全 hermetic、spawn 真 CLI、只认退出码+产物字节）

| # | 验收 | 对应 |
|---|---|---|
| A0 | S0 两分支：可达→全链证据金牌绿；不可达→证据文档存在且计划挂账段落更新 | D10 |
| A1 | 喂 `SUT_DEFECT`/`NEEDS_HUMAN` 步→准入拒、无补丁、`exit 4` + 逐步具名拒因 | bootstrap 验收 1 + D7 |
| A8 | 喂全绿 verdict（干净案）→ `exit 4` + reason=`NO_HARNESS_ERROR_STEPS`，零产物 | grok N1 |
| A2 | 确证 `HARNESS_ERROR`→补丁落盘、原 events sha256 不变；锚形状=回放消费形（对照断言） | 验收 2 前半 + D9 |
| A3a | 未签补丁 `--apply` 拒；已签→候选旁文件产出、原 events 不变、候选 sha256 输出 | D5 |
| A3b | 候选篡改（sha256 失配）`--promote` 拒；重签缺失→拒 `exit 6`、无任何文件被换；未封 journal 残留→一切 heal 子命令 fail-closed | D5/D6 负控 |
| A3c | 绑定齐备 `--promote`→journal 五步晋升+HealReceipt；复核走真链路假运行时接缝，目标步 `PASS` **且全案无非目标步新回归**；注入非目标步回归→FAILED+对称回滚：**journal 登记的全部目标（events+绑定逐件）恢复后 sha256 断言=晋升前**、stdout outcome=`reverify-failed-rolled-back`、`exit 0` | 验收 2 后半 + D6 + 双家回滚对称 High |
| A4 | 同证据元组重调→幂等返回既有补丁；同一 `{caseId,stepId}` 不同元组第 2 次→升级+拒；**并发双进程同时提案→一成功一幂等、台账无丢行**；异步骤各自首漂→互不触发升级 | D2 + codex 6 |
| A5 | 同一 case 三个不同步骤各一轮空转（无终局 receipt）→熔断 `exit 2` + inbox（D8 case 级计量，可达路径） | 验收 3 + D8 v4 |
| A6 | 词表外原子/证据残缺/互证失配→具名拒因 fail-closed；定位含未投影字段（如 fallbackCss）→拒 `HEAL_LINEAGE_UNVERIFIABLE`；纯语义定位 A/B 步集失配→拒（D12 v4.1 双负控） | #13/#14 + D12 |
| A7 | 无签署 `reset-proof.json`（或布尔自报）`--reverify`→route:human 落 receipt，不产合成 PASS；字段残缺/caseId·digest 失配→拒（签署真实性沿现役人签信任模型，防伪强度不虚标，ADR-0010 边界） | D3 v4 |
| 🧑 | 真机两不变量 + 真机 healed→PASS 实例（排 B 项后） | bootstrap 验收 4 |

## 3.5 金牌先冻的 CLI 硬接缝（acceptance-gate 前钉死，金牌按此编码）

- 命令形：`casey heal <caseId> --verdict <f> --axes <f> --events <f> [--run-history <f>] [--step <id>] --out-dir <d>`（提案）；
  `--apply --patch <f>`；`--promote --candidate <f>`；`--reverify --receipt <f>`。
- 产物路径：`<out-dir>/drift/<caseId>.<ts>.patch.json`、`<caseId>.ledger.jsonl`、
  `<caseId>.<ts>.events.candidate.json`、`<caseId>.<ts>.promote.journal.json`、
  `<caseId>.<ts>.heal-receipt.json`；`<ts>` 由 `--ts` 旗标显式注入（金牌确定性），缺省取钟。
- 复核运行时注入：环境变量 `CASEY_HEAL_RUNTIME_SEAM=<module>` 指向假运行时模块
  （zero-SUT 金牌用，示教 harness 同款模式）；未设时走真浏览器链路。生产语义不受该变量
  影响裁定（复核仍是真 replay→真 verdict 代码路径，仅运行时来源可注入）。
- stdout 末行为单行 JSON：`{"mode":..., "outcome":..., "reason":...}`（枚举见 GRILL D7）。
- 金牌铸造期钉死的补充接缝（实现须迎合，不得反向改金牌）：① `--out-dir`/`--ts` 四模式通用；
  ② 「受影响冻结绑定重签件」具体化为 `cases/<caseId>/entity-locks.frozen.json` 的
  `eventsSha256` 改签至候选字节（同时兑现 D5 人签绑定候选 sha256 与 S5 重签件就位）；
  ③ 热路径证明金牌命名约定 `tests/_golden/p6-heal-hotpath-*.golden.mjs`（A0 件自身除外）；
  ④ 升级 inbox 落点=隔离 loop 根的 `inbox.md` 或 `drift/` 内 inbox 旁文件二选一；
  ⑤ 复核接缝模块导出 `openRuntime`（对齐 runtime-bootstrap seams 形）；
  ⑥ `DRIFT_VOCABULARY_UNSUPPORTED` 与 `HEAL_NO_POSITIVE_DRIFT_EVIDENCE` 的真实职责是
  **防伪造三轴**（自然流程下词表外原子产不出正向探针证据、会落 NEEDS_HUMAN）——实现必须在
  证据校验层查，不得只写在「正常流程」分支里。

## 4. 执行编排（老规矩）

v2 送 codex+grok delta 复审（只喂原 findings+处置+v2 全文）→ 收敛后 grill/plan 阶段推进
（grill 半硬门按决策超时阶梯取 Steven 确认或代签）→ acceptance-gate 冻结红金牌 →
opus 5 medium 分 story 实现（S0 先行独跑；S1-S3 并行；S4-S7 串行），疑难回抛 fable →
代码评审 codex sol xhigh + grok 联合 → 发现方 delta 复审 → learn 沉淀。完工邮件每批必发。

## 5. 风险与对策（v2 增补）

- 半应用/半回滚状态：不假称「无中间态」——中间态存在但**全部被 journal 显式标记**且
  fail-closed（未封 journal 拦一切 heal 子命令、现役绑定校验拦回放）；晋升与回滚对称，
  逐件预存+逐件 sha256 断言，无任何静默残留路径（grok N3 对齐正文）。
- 合成复核骗绿：D6 把「真链路」写进验收 A3c/A7 负控。
- 热路径空转：S0 先证，两分支都有诚实产物。**已结案：证伪、走分支②挂账**——真实回放自然产不出
  确证 `HARNESS_ERROR`（断点在回放 miss→探针一环，两处独立断裂），本契约的自愈全链只在 hermetic
  合成证据上可跑通；接通两处断裂属 `replay` 生产库改动，按 §1 非目标不在本契约范围内。
- 变更型用例复核副作用：D3 收口 route:human，不装作安全超集。
- 退出码歧义：D7 结构化 stdout + 码号对照图例敲定，绝不复用「未实现」语义的 3。
