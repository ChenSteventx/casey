# ratchet-reverse-index GRILL

## 决策

1. 本契约只构建 Test Ratchet 的反向视图，不改变 `gate.mjs` 的裁判职责。
2. 输入仅为仓库内 `loop/prd-*.json` 的 `testChecksums` 和对应冻结文件。
3. 第一版不生成共享索引文件；索引只在内存和标准输出中存在，避免新的共享可写状态。
4. `verify` 检查缺文件、实际 checksum 漂移、不同 PRD 对同一文件声明冲突 hash、坏 PRD 和不安全路径。
5. `affected` 只回答变更文件影响哪些 PRD，不执行 gate、不重签、不合并。
6. PRD 路径必须是仓库内规范相对路径；绝对路径、父目录逃逸和空路径 fail-closed。
7. 工具不得导入或调用任何文件写 API，不得写 `passes`、`testChecksums`、签署元数据或 `active-contract.json`。

## DDD 归属

- 限界上下文：loop-kit 通用子域（编排/验证域）。
- 领域对象：Loop Contract 的验收冻结引用；本工具只建立派生查询视图，不拥有冻结签署生命周期。
- 不变量：Test Ratchet 的实际文件字节必须匹配所有引用 PRD 的声明；同一冻结文件的声明必须一致。
- Published Language：只读消费现有 PRD `testChecksums`，不改变 PRD schema。
- 禁止依赖：Casey 核心域模块、签署实现、裁定实现、MCP、LLM 或网络客户端。

## 非目标

- 不做批量重签；
- 不做测试结果缓存；
- 不拆分 gate；
- 不改 contract 状态机；
- 不建 worktree registry、共享池或 merge queue；
- 不自动运行受影响 PRD 的 acceptance。

## 升级条件

任何写 checksum、改 gate、改签署协议或引入共享持久状态的需求都必须退出本 light 契约，另开 kernel 级契约并经人签。
