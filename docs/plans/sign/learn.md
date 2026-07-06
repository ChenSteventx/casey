# sign — 沉淀（相2 人签门，full）

## 做成了什么

七相流水线的相2 后半人签门落地：`bin/sign.mjs`（draft→frozen 盖 signedAt/signedAgainstBuild/signerId +
checksum 冻进 prd 仅断言文件）+ `bin/replay.mjs` 未签前置闸（`assertSignedContract` 非 ok exit 65，
护栏 #14）+ `bin/casey.mjs` 接线。`casey sign` 从桩转真实现。「未签→报告出结论」这条 fail-safe 真生效，
报告能显示已签/期望版本，verdict 的 CASE_DEFECT/SUT_DEFECT 分水岭解锁。

## 异构评审（codex，七轮 R7 PASS）

R1 六 → R2 四 → R3 二 → R4 二 → R5 一 → R6 二 → R7 PASS。发现集中在两条主线：
- **caseId 端到端绑定**（R1-F1/R2-F2）：sign 校 prd.caseId；replay 对非空契约强制 events/expected 两侧
  caseId 都在且相等（删 caseId 也绕不过）。
- **落盘 fail-closed 原子性**（R1-F3/R2-F1/R3-F1/R4-F1/R5-F1/R6-F1/F2）：这条最难收，逐轮逼出——
  从「单文件 rename」→「全温写再统一 rename」→「预检 target/tmp 互异 + target∩tmp=∅」→「拒既存 tmp +
  wx 独占写」→「dirsToMk 不落 tmp 之下 + 多级新建目录全量回滚」。
- R3-F2 caseId transplant 按防篡改分层边界处置、codex 认可（见教训 3）。

## 教训

1. **fail-closed 的「零落盘」要含目录副作用、且要抗构造**：不是「写失败别留文件」这么简单——codex 连续四轮
   （R3–R6）用纯路径构造（`.tmp` 派生碰撞 / 预植 tmp / archive-dir 撞 tmp / archive-dir 落 tmp 之下 /
   多级新建目录）逼出残缝。收敛答案 = **一切副作用（文件+目录）在预检阶段拦在发生之前**，而非发生后清理。
   预检要把 tmp 派生路径、目录关系（等于/后代）全纳入碰撞图。
2. **多文件写没有真原子**：跨文件原子性无日志不可得。工程解 = 全温写（wx 独占）→ 统一 rename，把可构造
   失败全堵在温写前，只剩 rename 段真 I/O 崩溃/掉电这个 hermetic 强制不了的残余——如实注记、不假装消除。
3. **防篡改是分层的，别让下游层背上游的锁**（R3-F2）：replay 是「可信、已签、已 checksum 冻结契约的确定性
   执行器」。手改已签 frozen 顶层 caseId 去 transplant 是 gate/authoring 层的事——frozen 的 checksum 冻结
   （改任何字段 sha 变 → Test Ratchet 红）+ 人签才是防篡改层。硬要 replay 校 prd checksum = 越权耦合、改
   所有调用方。识别「这条防线归哪一层」比「哪一层都加一道」更对。记 GRILL D4.1。
4. **grep 启发式找涟漪面不可靠，跑全套才是完整性事实源**：初判 replay 直接消费者 7 金牌，全套一跑揪出
   run-history/report-diagnostics 两个走 casey run 端到端的漏网。凡「加了个全局闸」类改动，完整性核查 =
   跑全套 + 全仓 checksum 一致性扫，不是 grep。
5. **并行涟漪 fan-out 的安全前提是文件 disjoint**：8 subagent 并行补签 7 金牌 + 工具，先验证 golden→prd
   冻结映射两两不相交才敢并行；耦合核心（sign.mjs + replay 闸）自己串行保一致。设计并行、落地按 baton。

## 残余（挂账）

- `commitWrites` rename 段真 I/O 崩溃/掉电窗口：hermetic 强制不了，静态注记（codex R7 认可为可接受残余）。
- 真人签身份核验 / 人评审冻结断言真表达用例意图：route:human（ADR-0004 §6），`--signer/--build` 当可信
  授权输入；人不在场只挂账绝不代签。
