# GRILL · entity-rename-negative-guard（C4）

> 设计拷问在三方规划中完成(fable→codex→opus)。母规格 `docs/plans/entity-identity-lastmile/plan.md`。本文记录 C4 专属已决分岔。

## 决策树(已清空)

- **D1 rename→successor 端到端要不要本轮做?** 定:**不做**。签 successor 端到端要唤醒形式收据链子系统 A(`entity-semantic-lock-v2.mjs`,被 819015f 有意封死、sha `b7b5a47e` 冻结),须过 kernel 设计门 + Steven 人签。本轮只做负护栏。
- **D2 要不要加一个"永远 route:human 的假 rename 编译器"?** 定:**不加**(codex Q4)。`COMPILE_ATOM_COMPILERS` 现无 rename 编译器;若未知原子当前已稳定拒绝,只需**冻结这个缺席即拒绝的行为**,不新增假编译器——那只会提前固化未经设计审的协议形状。
- **D3 负护栏具体钉什么?** 定三条:①rename 事件/手造 replay artifact 必须在**第一次浏览器副作用之前**被拒;②rename 路径**绝不产 PASS**;③0/26 诚实红基线(`prd-teachin-semantic-lock-runtime-discrimination-successor`)**保持红且拒绝原因不漂**。
- **D4 红先行怎么成立?** 若当前代码对未知 rename 原子的拒绝**发生在浏览器副作用之后**(或根本没有明确前置拒绝),则金牌 RED、需最小 guard;若已前置拒绝,则金牌是特征化锁(characterization lock),据实标注。实现者先探当前行为再定。

## 半硬确认

Steven 2026-07-23 参与设计:确认 C4 只做负护栏、不碰 A、不加假编译器,范围「一轮全落 5 契约」内,回「同意」。grill 用户确认成立。
