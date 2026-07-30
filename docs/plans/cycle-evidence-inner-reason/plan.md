# plan — cycle-evidence-inner-reason（v1，乙路）

> 前置：`GRILL.md` v1（codex 计划 + opus xhigh 审三处阻断订正 + Steven 点乙路）。
> lane=full。目标：内层拒付码在发射点直接通报，一次真机复录即可定位真因。

## 1. 生产件改动（两处，约 20-25 行）

1. `lib/teachin/raw-axes-adapter.mjs`：`projectAndVerify` 方法体内**全部 15 个**
   `return denied(...)` 改经小助手「先 `safeEmit` 再返回」——照同文件既有
   `reportFormalRefusal` 形制写；判定与返回形状零改。三处动态透传（预检、
   raw 消费者、resolved 消费者）经 GRILL D2b 的生产者局部归一器落码，
   不新增外来对象读取。
2. `lib/teachin/cycle-evidence-context.mjs`：`refusalPoint` 枚举加一员
   （21→22）；拒付码白名单补 D0 六码（若已在则只补缺的）+ 兜底成员。
3. 明确不改：`lib/dual-replay/replay-completion.mjs`（带逐字节钉，一字不动）、
   `cycle-evidence-output.mjs`（四层闸零改、不升 schemaVersion）、
   `verdict.mjs`、一切 authority 形状与判定语义。

## 2. 金牌（红先行，只扩既有 75 钉件）

扩 `tests/_golden/teachin-cycle-evidence.zero-sut.golden.mjs`：
- 六码各一枚从**真实分支**击发的正控（合成夹具驱动 `projectAndVerify` 真路径，
  禁直调发射器硬编码）；
- **静态完整性钉（codex r2 阻断三，必须有）**：`projectAndVerify` 方法体内
  15 个拒付位**全部经新助手**、禁止残留裸 `return denied(...)`——否则某个
  同码多分支漏接，六码正控仍会全绿；
- 新归因点成员的真实分支钉（A4 逐点唯一归因不破）；
- 降格负控两枚：**全局合法但非本生产者六码**的成员（如动作失败码）、
  完全未知串 → 均须 **不中毒 + 落兜底成员**（按 D5 口径，不是只断言原串
  不出现）；
- 零行为差：带/不带收集器双跑，返回值深等、调用次数相等、控制流无差；
- E3 逐员矩阵与既有 75 钉全部不得削弱。

## 3. prd 与验收

单锁：只对 `loop/prd-teachin-cycle-evidence.json` 做一次 checksum
amendment（金牌 sha 由 `9a138436…` 换新），**不新建 prd**。
s2 邻接：raw-axes-adapter / raw-runner / cycle-entry / equivalence-completion /
equivalence-production-boundary / boundaries / cycle-plan.static /
orchestrator / runtime-cycle-adapter / raw-actionability（新）/ nav-expansion /
clear-fill。s3 漂移扫 + 术语。

验收：
- A1 扩钉红→绿；A2 邻接零回归；A3 零漂移；
- A4（route:human）：Steven 真机复录一次，边车按 D6 判读表判——
  **须同时满足「新归因点为六码之一」与「随后出现既有外层统一码」两条才算
  验收通过**（codex r3 收紧：只判前者会把外层通报缺失误放行）；通过
  **不等于闭环转绿**，见 GRILL D7；
- A5（route:human）：换签人签。

## 4. 评审与风险

计划 v1 codex delta 一轮（乙路换根说明）；实现 opus 5 medium（可回抛 sol max
咨询）；实现后 codex 快速 delta。
- R1 新归因点破坏逐点唯一归因 → D2 不复用既有成员 + 真实分支钉；
- R2 降格漏路致整份边车中毒丢失 → D5 负控按「不中毒 + 落兜底」断言；
- R3 通报点混进判定路 → 零行为差双跑钉 + `safeEmit` 同步契约；
- R4 误把「验收通过」读成「闭环打通」→ GRILL D7 写死诚实预期。
