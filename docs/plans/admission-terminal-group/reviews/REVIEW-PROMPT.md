# 评审提示词 · admission-terminal-group

你是异构评审方，对已提交不可变快照做代码评审。只报 Critical / High / Medium；结论行
`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给文件:行号、严重级、
失败场景。

## 仓与基线

- 仓：当前工作目录即契约树克隆（可自跑命令验证）。
- 基线：dev `3f34512`；评审对象 = `git diff 3f34512..HEAD`。
- 背景（按需读）：`docs/plans/admission-terminal-group/GRILL.md`（Steven 裁甲：终端
  语义对齐基数门 codex round-3 已裁先例）、同目录 `plan.md`。

## 改动白名单（超出即报）

1. `lib/entity-observation-registry.mjs` · `validateObservationAdmission` 段 1 ——
   终端集由逐 click 改为组内末 click（`terminalByGroup` 键 JSON([intentId,atom])、
   最后写入即终端；逐 click 字段校验与重复完整三元组拒原样；段 3/5/6 与让位谓词
   零改动自动继承）。
2. `tests/_golden/admission-terminal-group.zero-sut.golden.mjs`、
   `loop/prd-admission-terminal-group.json`、`docs/plans/admission-terminal-group/**`。

## 风险清单（请优先证伪）

- R1 语义收紧的完备性：脚手架 click 不再是终端后，行锚脚手架的具名拒路径是否可靠
  （段 5 无终端可配的实际拒码）；有没有输入形状能让脚手架行静默通过。
- R2 与基数门判据的同构性（`:361-365` 对照）：顺序遍历/最后写入/键构造逐字一致；
  两门对同输入同判（金牌 T8 是钉，请独立构造反例试破）。
- R3 遗留等价：单 click 原子（agent/open）行为逐字节同码；两让位契约金牌
  （admission-envelope-yield / terminal-coverage-yield）零回归。
- R4 重复三元组拒与组内末语义的交互（同组同 stepId 重复、异组同 stepId 等）。

## 既有证据（可自行复跑）

- 验收金牌八钉 exit 0；红基线 5 过/3 红（`accept/red-proofs/`，T4 夹具笔误当场修正
  已在 PRD notes 留痕）；突变闭环（`git show` 姿势）；同文件邻接五金牌 + term-lint +
  selftest 全绿；gate GREEN 2/2。
- 拦点实证：sign 二跑 `OBSERVATION_ROLE_COUNT_MISMATCH`（主树十五跑真产物）。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
