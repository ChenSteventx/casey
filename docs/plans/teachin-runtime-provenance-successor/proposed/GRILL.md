# teachin-runtime-provenance-successor — GRILL

> 用户于 2026-07-17 明确要求针对两项独立 `HIGH` 继续 successor（后继契约）；以下边界已确认，无待选分岔。

1. 公开 `deriveEntityRuntimeReadiness` 不得把调用者普通字符串对象变成 `available:true`。只有模块私有 WeakMap（弱映射）保存的 opaque inspected authority（不透明已检查权威）可进入绿色决策；production 查询只消费该不透明值。
2. `Function.prototype.toString` 摘要不能单独充当 implementation provenance（实现来源证明），因为相同函数源码可捕获不同 closure（闭包）或加载不同依赖。
3. 不允许先用顶层静态 import（导入）执行 bundle module，再事后核 manifest。`entity-semantic-lock-v2` 必须移除对 executable bundle module（可执行运行权威组模块）的顶层导入；发布 module/dependency（模块/依赖）只按不执行的数据字节读取。
4. publication 的既有 `manifest` 资源承载一个 data resource graph（数据资源图）：入口 module 与每个 dependency 都固定 release resource 摘要和依赖 id；递归遍历必须覆盖全部节点，缺失、重复、环或不可达节点都拒绝。该图只证明「清单所声明字节已摘要冻结」，不声称等于 JavaScript 的真实 import graph（导入图）。
5. production bundle/publication 表保持为空。测试模块、依赖、manifest 与 release resources 只安装在 `mkdtemp` 临时隔离根；不启动 SUT、假 SUT、浏览器、服务或网络。
6. 旧 frozen（冻结）测试、fixture（固定语料）与 PRD 逐字节不改；新 PRD 独立登记 successor 与 supersession（取代）关系。
7. 本轮没有可靠 JavaScript parser（解析器）与受限 executable loader（可执行加载器），因此即使整个 data resource graph 自守通过也最多返回 `provenance-recorded/available:false`，稳定路由 `RUNTIME_AUTHORITY_EXECUTABLE_LOADER_NOT_PUBLISHED`。不签发 adapter、run context、runtime-authorized handle 或 `verified-ready`；真实 executable loader 明确 route:human。
