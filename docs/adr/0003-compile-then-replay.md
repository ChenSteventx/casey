# ADR-0003：编译再回放（LLM 一次编译）+ 非就地有界自愈

- 状态：已接受
- 日期：2026-06-25
- 相关：设计 §0、§3、§9.5；护栏 #5 #13；ADR-0003（autotester，模型分层）

## 背景

LLM 直接每次跑用例有两个致命问题：不可复现（每跑结果可能不同）、烧 token（每次回归都付 LLM 费）。autotester 的内核是「确定性是默认，LLM 是只在确定性够不到处才动的手术刀」。Casey 把输入端翻面（LLM 读用例），但必须保住这个内核。

## 决策

1. **执行模型 = 编译 + 自愈混合**：LLM **只在编译期（相1）**读一次用例，真机跑一遍，把 intent 翻译成 autotester 风格的确定性 spec + 落观测现状（地面真值）；之后**确定性回放**（相3/4），日常回归零 LLM、可复现。
2. **编译期 determinism 契约**：记观测现状/做后检查前必等静默点（networkidle + 无动画 + DOM 稳定 K ms），不靠固定睡眠；spec 落稳定属性（role+accessibleName+stepId），**禁止纯坐标步**（authoring agent 无录制坐标）；本质不可复现步（画布拖拽等）标 `route:human`。
3. **自愈非就地、有界、人签后应用**：自愈只在确证 `HARNESS_ERROR` 时回现场重锚，**写漂移补丁到旁文件**（`drift/<caseId>.<ts>.patch`），原 spec 不变照常回放，**人签后才应用**；同一步 N 次漂移 → 升级 Inbox（flaky locator，非一次性漂移）；受熔断器约束。
4. **冻结边界物理隔离**：`testChecksums` 只冻断言文件，不冻 spec——自愈改 locator 不触棘轮（合法），改断言必触棘轮（拦住）；spec 完整性另由 gate 的指纹检查项守。
5. **熔断器无进展信号改喂每步进展哈希**：浏览器动作循环没有每步 commit，照搬 git HEAD 会误跳闸；改用快照差分/已满足步数经 `breaker --round --progress`。

## 后果

- 收益：日常回归确定性、可复现、不烧 token；LLM 只在编译与确证自愈时出现，频率与智能成反比（承接 autotester ADR-0003）。
- 代价：编译期 recorder-as-library 是红队点名最重的新建（ownership 从「人拥有浏览器」反转为「agent 拥有 context」）；P3 首验收（events.json 不触 authored/参数化拒绝）是硬门。
