# teachin-runtime-provenance-successor — plan（full）

> 本契约接续 `teachin-runtime-authority-bundle-successor`，修复独立评审确认的两项 `HIGH`。旧 plan、golden、fixture 与 PRD 保持逐字节不变。

## 1. 已核事实

1. 当前公开 `deriveEntityRuntimeReadiness` 接收普通 `{state, rootId, contractId, adapterId, issuerId, reason}`。调用者无需模块私有根即可直接得到 `available:true`，使诊断绿可伪造。
2. 当前 health proof（健康自检凭据）把 `Function.prototype.toString` 摘要与 driver/issuer 对比。函数源码相同但闭包常量、静态依赖或模块环境不同，行为可以变化而摘要不变。
3. 当前 publication 已有 digest-frozen（摘要冻结）的 `manifest` 资源槽，但 readiness 尚未读取它，也未把实际加载的 bundle module 与 release module/dependency bytes（发布模块/依赖字节）绑定。

## 2. 目标

### 2.1 模块私有不透明 readiness

- 新增模块私有 inspection WeakMap。`inspectRuntimeAuthorityBundle` 完成全部验证后，只签发一个冻结且无数据字段的不透明对象；真实状态只存 WeakMap。
- `deriveEntityRuntimeReadiness` 仅接受该 WeakMap 已登记对象。普通对象、展开副本、字符串伪根、Proxy（代理对象）与 accessor（取值器）一律 `available:false/state:unpublished/route:human`，且零 trap/getter 执行。
- `readEntityRuntimeReadiness` 只能消费模块内部刚签发的 inspection；public caller（公共调用者）不能注册、补写或复刻 inspection。

### 2.2 不执行的 release 字节来源台账

- `entity-semantic-lock-v2` 移除对 executable bundle module 的顶层静态 import。任何待核 module bytes 都不得在 manifest 验证前执行；本轮也不在验证后执行。
- runtime publication 的 `manifest` 必须是摘要可读的 `entity-runtime-authority-data-manifest`，绑定同一 `rootId/contractId/adapterId/issuerId` 与一个 release data resource graph。每个节点有唯一 id、摘要冻结 resource 与依赖 id 列表。
- 从 `entryId` 递归遍历整个清单图：节点/依赖 id 缺失、重复、自环/环、不可达附加节点、非 release path 或任一摘要不可读都拒绝。所有 resource 只经 `readPublishedFile` 读取为 bytes，不 import、不 eval（求值）、不调用。
- 不用 regex（正则表达式）冒充 JavaScript parser，不声称 manifest 图等于真实 import graph，也不读取/比较 workspace `lib/` 下待执行模块。环境、workspace 或 caller 无法注入行为，因为本轮根本没有 executable loader。
- health proof 只继续绑定 root 标识与完整 lock/events/policy 结构；`Function.toString` 和任意嵌入 receipt SHA 不再是 authority root。
- data resource graph 与完整锁结构全部自守通过后，内部 inspection 状态为 `provenance-recorded`，但仍 `available:false/route:human/reason:RUNTIME_AUTHORITY_EXECUTABLE_LOADER_NOT_PUBLISHED`。没有可靠 parser + sandboxed loader（受限加载器）前不签发 `verified-ready`、adapter、run context 或 runtime-authorized handle。

## 3. 验收点

### 可命令化

1. `opaque-readiness`：普通字符串根、readiness 展开副本、Proxy/accessor 均不能经 public derive 铸绿；production 空表仍故障关闭；隔离自守 data manifest 只能经 production read 的私有 inspection 得到 `provenance-recorded/available:false`。
2. `data-provenance`：三层 release resource graph 全部摘要可读且递归闭合时只记录 provenance、绝不 ready；入口 module 或第二层/第三层 dependency 字节失配、缺 manifest、缺节点、环与不可达节点均拒绝。
3. `no-execution-and-regression`：release module 含一旦执行即产生 ambient side effect（环境副作用）的代码时，readiness 查询证明副作用为零并保持不可用；上一 successor 的 production 空表、Proxy 零 trap 与 historical/roles 金牌继续通过。上一 successor 的正向 executable bundle 与跨根 capability 金牌因 loader 撤回而如实 supersede，不改旧 frozen。

### 可观察性申报

- `route:human`：可靠 JavaScript parser、递归真实 import graph、模块签名、Node/runtime 版本来源与先验 sandboxed executable loader；本轮只有不执行的数据资源图台账，不把它冒充 executable trust。
- `route:human`：真实 SUT 上 bundle module/manifest/health proof 同次发布并得到 `SAME` 与同源 successor；附录屏、视觉复核、独立 HTML 与附件。
- `route:human`：旧 `teachin-runtime-authority-bundle-successor` 中允许普通状态对象直接传给 public derive 的隐含 API，以及临时 executable bundle 正向/跨根金牌，被本契约取代；旧 frozen 不修改。其 production 空表、Proxy 与 historical/roles 行为继续回归。

## 4. 非目标与停止条件

- 不向 production 加测试 bundle、测试 publication、测试 module、测试 dependency 或测试 manifest。
- 不启动或连接 SUT、假 SUT、浏览器、服务或网络；只运行临时隔离文件、纯模块及静态金牌。
- 不修改既有 frozen 测试、fixture 或 PRD。新功能验收在 `77cdb5e` 上必须真实 RED；冻结后实现者只读，`passes/evidence` 只允许 gate 回写。
- 不把 frozen structural readiness（冻结结构就绪）描述成在线健康；driver/issuer 不在 readiness 查询中执行。
