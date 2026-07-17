# teachin-runtime-provenance-budget-successor — GRILL

> 用户于 2026-07-17 要求接续独立评审确认的资源预算与健壮性缺口；以下边界已明确，无待选分岔。

1. `parseRuntimeAuthorityDataManifest` 当前用递归深度优先遍历。一个 20,000 节点的线性 manifest（清单）可令公开 `readEntityRuntimeReadiness` 抛出 `RangeError`，违反稳定返回约定。
2. 只把递归改成迭代仍不够：节点数、边数、单资源字节数、总资源字节数必须有显式常量上限，并在大量读取前拒绝。manifest 自身也必须有独立字节上限。
3. 图验证必须迭代完成，保持唯一 id、缺引用、环、不可达节点与摘要失配的既有拒绝语义。预算超限稳定返回 `available:false/route:human/reason:RUNTIME_AUTHORITY_PROVENANCE_BUDGET_EXCEEDED`，不得抛异常。
4. 每个 publication（发布项）的 inspection（检查）必须有独立 `catch` 边界；任何意外异常都稳定降级为 `RUNTIME_AUTHORITY_PROVENANCE_INSPECTION_FAILED`，不越过公开 readiness API。
5. public derive（公开派生器）对普通对象、Proxy（代理对象）与 accessor（取值器）继续零 trap/getter、不可铸绿；production 空表与上一 provenance successor 的不执行语义继续回归。
6. `teachin-runtime-authority-bundle-successor` 的旧 frozen 不修改。以 clean `819015f` 实测它是 exit 1、`3 过 / 9 红`，不是绿色；新 successor 必须另写 formal supersession（正式取代记录），不得沿用旧 PRD 的历史 `passes:true` 声称当前通过。
7. 全程 zero-SUT（零被测系统）：不启动 SUT、假 SUT、浏览器、服务或网络；测试资源只写 `mkdtemp` 临时隔离目录。
