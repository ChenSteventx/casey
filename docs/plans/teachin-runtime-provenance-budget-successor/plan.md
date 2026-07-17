# teachin-runtime-provenance-budget-successor — plan（full）

> 本契约接续 `teachin-runtime-provenance-successor`，补齐独立评审确认的图规模、字节预算与公开 API 健壮性。所有旧 golden、fixture 与 PRD 保持逐字节不变。

## 1. 已核事实

1. clean `819015f` 上，20,000 节点线性 data resource graph（数据资源图）进入递归 `visit` 后使公开 `readEntityRuntimeReadiness` 抛 `RangeError: Maximum call stack size exceeded`。
2. 当前 manifest 没有节点/边预算；每个节点的 release resource（发布资源）会逐个读入内存，也没有单资源或总字节预算。
3. `readEntityRuntimeReadiness` 直接调用单个 publication inspection，意外异常会越过公共 API。
4. 旧 `teachin-runtime-authority-bundle-successor` 在当前树的真实状态是 exit 1、`3 过 / 9 红`；旧 PRD 的历史 gate 结果不能描述当前代码。

## 2. 目标

### 2.1 迭代有界图

- 把 manifest 图遍历改为显式栈/队列的迭代算法，不再依赖 JavaScript 调用栈。
- 固定并集中声明以下预算：manifest 最大字节、最大节点、最大边、非 manifest 单资源最大字节、非 manifest 总资源最大字节。测试 fixture 冻结同一组数值作为可执行契约。
- 在遍历和资源读取前先检查节点/边；资源读取用打开文件的大小先检查单资源与剩余总预算，再读 bytes（字节）。20,000 节点、超边、超单资源和超总字节都拒绝为 `RUNTIME_AUTHORITY_PROVENANCE_BUDGET_EXCEEDED`。
- 既有缺引用、重复、环、不可达和摘要失配继续 `RUNTIME_AUTHORITY_PROVENANCE_NOT_VERIFIED`；预算与结构错误不能铸成 `provenance-recorded`。

### 2.2 单 publication 异常隔离

- `readEntityRuntimeReadiness` 对每次 `inspectRuntimeAuthorityPublication` 建独立 `try/catch`。异常对应的 publication 只生成模块私有失败 inspection，reason 为 `RUNTIME_AUTHORITY_PROVENANCE_INSPECTION_FAILED`。
- 公开 API 始终返回冻结数据、`available:false/route:human`；不得把异常对象、栈或文件内容泄漏给调用者。
- 该 catch 是最后兜底，不能替代迭代算法与预算拒绝；20,000 节点必须命中预算 reason，而非靠栈溢出后捕获。

### 2.3 正式取代与回归

- 新增 `SUPERSESSION.md`，记录旧 bundle successor 在 `819015f` 的命令、exit 1 和 `3 过 / 9 红`，明确它当前不是绿色；旧 frozen 文件不改。
- Proxy/accessor 零 trap/getter、公开普通对象不可铸绿、production 空表、待核模块不执行、historical/roles 与非真空 fail-closed 行为继续通过。

## 3. 验收点

### 可命令化

1. `bounded-topology`：20,000 节点线性图不抛异常且以预算 reason 拒绝；节点预算和边预算超限在资源遍历前故障关闭。
2. `bounded-bytes`：超过单资源预算或非 manifest 总资源预算时不记录 provenance、不抛异常，并稳定返回预算 reason；预算内三层健康图仍只 `provenance-recorded/available:false`。
3. `isolation-and-supersession`：临时副本故障注入使单 publication inspection 抛异常时，公开 readiness 稳定降级；Proxy/accessor 零 trap/getter；新测试机械确认旧 bundle successor 当前 exit 1、`3 过 / 9 红`，且上一 provenance、production、historical/roles 回归继续通过。

### 可观察性申报

- `route:human`：预算数值在真实发布物上的容量评审与监控；本轮只固定资源上限，不声称覆盖未来所有合法 bundle。
- `route:human`：真实 SUT 上同次发布、可靠 parser、真实 import graph、模块签名及 sandboxed executable loader（受限可执行加载器）；本轮仍不执行候选 JavaScript。
- `route:human`：旧 bundle successor 的正向 executable bundle 行为已正式取代且当前 `3 过 / 9 红`；若将来恢复，必须新开可靠 loader 契约，不得把旧历史 gate 称为当前绿色。

## 4. 非目标与停止条件

- 不向 production 加测试 publication、bundle、module、manifest 或 release resource。
- 不启动或连接 SUT、假 SUT、浏览器、服务或网络。
- 不修改任何旧 frozen 测试、fixture、RED 证据或 PRD。新测试在 clean `819015f` 上必须真实 RED；冻结后实现者只读，`passes/evidence` 只允许 gate 回写。
- 不实现 executable loader，不签发 adapter、run context、runtime-authorized handle 或 `verified-ready`。
