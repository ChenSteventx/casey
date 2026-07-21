## 逐条判

1. **A 族负例：未完全消解，阻断。**  
   C4/C5/C6/C7/C12/C15 等已有定因设计，但 C8 仍只判断“非零退出”。C8 自建的 `leaky` mapping 缺少合法 bindings；若 credential gate 回归，它仍会被 entity-policy 以另一原因拒绝，测试继续绿，形成假绿。见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:20)、[flow-bridge.golden.mjs](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:122)、[flow-bridge.mjs](/mnt/d/ctx/heren/casey/bin/flow-bridge.mjs:35)。  
   **必须改：**给 C8 两个 mutation atom 补合法 bindings，并锁死 `exit=1`、credential-gate 精确诊断及零输出。

2. **反向锁 mutant：部分消解，仍有流程阻断。**  
   精确错误锁和真实 mutant 的方向正确，但 plan 把修改受管的 `lib/flow-bridge.mjs` 安排在 accept 阶段；full lane 此时尚无 `accept.done`，不能合法修改实现。见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:22)、[contract.mjs](/mnt/d/ctx/heren/loop-kit/bin/contract.mjs:69)。  
   **必须改：**在一次性副本/隔离 worktree 上做 mutant，或将其移到允许改实现的阶段；原文件 SHA-256 必须全程恢复并校验。

3. **B1 no-loader/loaded 成对证据：部分消解，阻断。**  
   成对运行已补，但“双跑均 `DRIVER_NOT_PUBLISHED` 即降级”的条件仍会把 loader 路径错误、签名材料错误等自身问题误判成环境不支持。authority-root 在验证收据签名之前就可能返回 readiness 拒绝，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:31)、[teachin-observation-authority-root.mjs](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:840)。  
   **必须改：**先用相同 package、相同 loader 做一次直接 intake 正控并要求成功；正控成功后，才允许依据 MCP pair 判断传播能力。否则不得降级。

4. **B2 17-check 迁移表：未消解，阻断。**  
   plan 要求“纯函数 check 直调 distill 本地编码门”并红先行，但该门目前内联在 CLI，既未导出，模块还会直接执行 `main()`，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:39)、[distill.mjs](/mnt/d/ctx/heren/casey/bin/distill.mjs:130)、[distill.mjs](/mnt/d/ctx/heren/casey/bin/distill.mjs:183)。在“production zero change”约束下无法同时满足可直调、红先行和真实 wiring 覆盖。  
   **必须二选一：**  
   - 扩 scope，抽取并导出生产 helper，再让 CLI 调用它；同步升级 PRD、checksum 与安全签署；或  
   - 明确把这项行为级覆盖列为 lost record，并登记精确后继债务，不能宣称已完整迁移。  
   另外 C2d 还需冻结真实拒绝码；当前 closed-package 路径对应的是 `CAPTURE_URL_LEAK`，见 [teachin-identity-package-validator.mjs](/mnt/d/ctx/heren/casey/lib/teachin-identity-package-validator.mjs:199)。

5. **canonical lease：已消解。**  
   try/finally、cleanup 结果参与红绿、外部扫描仅作二次取证，符合 R1 要求。见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:28)、[canonical-case-lease.mjs](/mnt/d/ctx/heren/casey/tests/_golden/support/canonical-case-lease.mjs:65)。

6. **重门禁与 22 PRD 审计：已消解，但属于 accept 前置硬条件。**  
   22 个受影响 PRD 与 6 个 checksum owner 并不冲突；前者是验收引用面，后者是发生 checksum 变更的所有者。sequencing、静态安全闭包和冻结审计件已有明确安排，见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:51)、[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:57)。  
   **准入条件：**首个 gate 前必须实际生成并冻结逐 PRD 明细，不能只保留“届时生成”的计划文字。

7. **timeout：已消解。**  
   已保持独立直接修复，不再错误并入 B 族，且目标差异明确。见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:76)、[observation-active-suite-contract-v2.zero-sut.golden.mjs](/mnt/d/ctx/heren/casey/tests/_golden/observation-active-suite-contract-v2.zero-sut.golden.mjs:15)。

8. **B 共用动态签名夹具及 B3 loader：未消解，阻断。**  
   plan 让 golden 运行时生成 loader，却又要求用该 loader 启动同一个 golden；但 B3 在模块加载期已经静态导入 authority-root，loader 必须在进程启动前存在，形成启动时序悖论。见 [plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:26)、[plan.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:43)、[teachin-observation-authority-root.zero-sut.golden.mjs](/mnt/d/ctx/heren/casey/tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs:22)。  
   **必须改：**落成稳定 bootstrap/worker：bootstrap 生成临时 key、publication 和 loader，再以显式 loader 启动 worker；worker 才导入 authority-root 并执行 B3。临时材料须 `finally` 清理，新增文件纳入 B3 PRD checksum 和 ADR-0004 签署面。

## 总判

**BLOCKED：v2 仍不可进入 accept。**

当前硬阻断为：

- C8 错因假绿；
- 反向 mutant 与 phase interlock 冲突；
- B1 降级条件缺少独立正控；
- B2 与“production zero change”互相矛盾；
- B3 动态 loader 存在启动时序悖论。

lease、22 PRD 重门禁、timeout，以及 C 族单行术语修复方向均已成立。本轮只做了静态只读复审，未运行任何 golden、fixture 或 SUT。