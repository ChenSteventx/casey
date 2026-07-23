# plan · entity-rename-negative-guard（C4，独立并行）

> 母规格 `docs/plans/entity-identity-lastmile/plan.md`。车道 light。C4 与 C0-C3 无文件依赖,独立并行。

## 业务目标(说人话)

需求要求「改名不能静默更新旧身份,必须签 successor」。但签 successor 的端到端消费者要唤醒被有意封死的形式收据链,本轮做不到(见 GRILL D1)。C4 做的是**负护栏**:确保系统在还不能安全处理改名时,**明确、前置地拒绝**改名操作——绝不半路执行、绝不误判 PASS,并让那条等真实运行时权威的诚实红基线保持红、拒绝原因不漂。这是 fail-safe:能力没到位就拒,不假装做到。

## 逻辑描述

- 现状:`lib/compile-atoms.mjs` 的 `COMPILE_ATOM_COMPILERS` 无 rename 编译器;金牌里 `workflow.rename` 是虚构前瞻原子。
- 目标:冻结「无 rename 编译器 ⇒ rename 事件/artifact 在任何浏览器副作用前被拒、不产 PASS」这一负能力;并特征化「0/26 保红、拒绝原因不漂」。
- 不做:不加真/假 rename 编译器、不碰 v2、不改裁定四态、不让 0/26 转绿。

## 验收点(acceptance)

1. **rename 前置拒绝金牌(zero-SUT)**:构造一个 rename 原子的事件/手造 replay artifact,断言:
   - 编译/回放在**第一次浏览器副作用之前**拒绝(具名拒绝码,如 UNKNOWN_ATOM/UNSUPPORTED);
   - 该路径**绝不产 PASS**;
   - 若当前代码拒绝发生在副作用之后 → 金牌 RED、实现最小前置 guard 转绿;若已前置拒绝 → 特征化锁,据实标注(实现者先探再定)。
2. **0/26 保红且拒绝原因不漂**:复跑 `tests/_golden/teachin-semantic-lock-runtime-discrimination-successor.zero-sut.golden.mjs`,确认仍 RED(0/26),且拒绝原因仍是 `runtimeAuthorized!==true` 一族——不是被 C4 改动换了拒绝原因。**绝不使其转绿**。

## 交付物

- 负护栏金牌(zero-SUT)冻进 `loop/prd-entity-rename-negative-guard.json` testChecksums。
- (若探出 gap)最小前置拒绝 guard;否则纯特征化锁 + 据实标注。
- 异构评审 + learn。

## 边界与挂账

- rename→successor 端到端=挂账(唤醒 A,kernel 设计门 + Steven 人签)。
- 完成语义:hermetic 绿=负护栏逻辑已证,非需求完成;实机为准(ADR-0009)。
