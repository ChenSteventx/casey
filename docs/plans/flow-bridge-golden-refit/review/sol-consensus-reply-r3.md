结论先说：**BLOCKED，v3 暂不可进入 accept。** C8、B2、冻结执行账已消解；mutant、B1、B3 仍有执行矛盾，并新出现冻结清单不闭合。

## 逐条判

1. **C8：已消解。**

   v3 已要求两个 mutation 原子补合法绑定，并锁定 `exit 1`、凭据门诊断和零产物，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:20)。凭据门确实先于实体闸执行并以 1 退出，见 [bin/flow-bridge.mjs](/mnt/d/ctx/heren/casey/bin/flow-bridge.mjs:35)。原错因假绿已被封住。

2. **mutant：阶段互锁已解，但证伪流程仍阻断。**

   隔离 worktree + direct baton 可以合法修改实现；但 worktree 从 `HEAD` 创建，见 [contract.mjs](/mnt/d/ctx/heren/loop-kit/bin/contract.mjs:305)，不会自动包含主树 accept 阶段尚未提交的新反向锁。v3 未规定如何把冻结后的 golden 精确投影到临时树，也未要求同树先跑 baseline GREEN，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:21)。

   必须补：临时树 golden SHA 与主树冻结 SHA 一致 → baseline GREEN → 注入 mutant → 同一 check RED → 清理树/临时分支；否则红不能归因于 mutant。

3. **B1：独立正控已补，但状态编排自相矛盾，阻断。**

   正控先行方向正确；但正控对“同一份包”成功 intake 后必已写 committed ledger，随后无-loader MCP 又要求“零台账”，两者不能同时成立，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:36)。authority root 会读取旧 ledger、递增 generation 并提交新字节，见 [teachin-observation-authority-root.mjs](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:377) 和 [同文件](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:470)。

   必须二选一：

   - 正控后清理租约，再按相同 SHA 重建同包供 MCP pair；或
   - 把“零台账”改为“ledger SHA/行数零变化”，loaded 路再精确增加一条 accepted。

   修正状态基线后，三条件与的降级判据成立。

4. **B2：已消解。**

   distill 内联门已诚实列入丢失项；C2f/C2h 改测已导出的纯 validator，且该 validator 确实返回 `CRED_GATE_HIT`，见 [teachin-identity-package-validator.mjs](/mnt/d/ctx/heren/casey/lib/teachin-identity-package-validator.mjs:167)。authority root 的真实读路也调用它，见 [teachin-observation-authority-root.mjs](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:227)。C2d 以实测定谳 `CAPTURE_URL_LEAK` 后冻结的处理可行。

5. **B3：bootstrap/worker 方案正确，但 plan 内仍保留旧启动要求，阻断。**

   [plan.md:28](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:28) 规定外层 bootstrap 先生成临时 loader，再带 loader spawn worker；但 [plan.md:48](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:48) 又要求 PRD 外层 acceptance 命令直接带该 loader。运行时生成的 loader 在 bootstrap 启动前尚不存在，原时序悖论因此仍在。

   必须保留当前 PRD 的裸 `node <bootstrap>` 入口，见 [prd-teachin-observation-authority-root.json](/mnt/d/ctx/heren/casey/loop/prd-teachin-observation-authority-root.json:33)；仅由 bootstrap 的子进程命令显式带 loader。

6. **22 PRD 执行账：已消解，仍是首个 gate 前硬条件。**

   静态重数仍为 **22 个唯一受影响 PRD、6 个现有 checksum owner**。v3 已明确 accept 实际生成并冻结逐 acceptance、安全闭包和预期翻转，且首个 gate 前存在，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:62)。该项可进入 accept 制造。

7. **新增冻结面：清单不闭合，阻断。**

   v3 前文要求新增 worker 纳 B3 PRD checksum 和人签、共享 support 纳本契约 checksum，见 [plan.md:28](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:28) 与 [plan.md:30](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:30)；但最终“ADR-0004 人签清单”仍只列“五金牌字节”，遗漏 worker 与 support，见 [plan.md:75](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:75)。gate 只校验显式登记在 `testChecksums` 的文件，不会递归冻结 import/spawn 依赖，见 [gate.mjs](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:50)。

   必须把五个入口 golden、新 worker、共享 support 的 checksum owner 与人签项完整列清，并说明旧 unsigned receipt fixture 是保留作负例还是退出冻结面。

## 总判

**BLOCKED：v3 不可进入 accept。**

剩余四个硬阻断：

- mutant worktree 未携带精确冻结 golden、缺同树 GREEN→RED 对照；
- B1 正控后的 ledger 与无-loader“零台账”冲突；
- B3 外层 acceptance loader 与 bootstrap 生成时序冲突；
- 新 worker/support 的 checksum 与人签清单未闭合。

本轮仅静态只读复审，未运行 golden、fixture、gate 或 SUT。