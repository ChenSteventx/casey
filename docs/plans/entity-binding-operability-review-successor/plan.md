# entity-binding-operability-review-successor — plan

## 1. 目标与边界

收口 `entity-binding-operability-successor` 实现审查发现的三条公共入口/恢复边界：MCP sign 旧旗标可静默只签 expected、直接 CLI sign 忽略未知/废弃旗标、重签恢复可读取 archive target/`.tmp` 符号链接（symlink）并留下不持久审计件。

本 successor 只运行本地纯映射、静态源码与临时文件事务；禁止 SUT、浏览器、server 与网络。旧 frozen plan/golden/schema/checksum 不修改。

## 2. MCP 与 CLI 参数闭合

- `casey_sign` MCP schema/argv 对齐 CLI 真接口：`events + entityBindingsDraft + entityConfirmations + entityLocksOut` 四件成组映射到 `--events + --entity-bindings-draft + --entity-confirmations + --entity-locks-out`。
- 旧 MCP 三字段只作兼容输入名，不能伪造缺失 `events`；缺件必须由 CLI 成组校验非零退出。新旧同义字段冲突必须在 MCP 层拒绝。
- direct CLI 的允许旗标集合闭合；旧三旗标、任意未知旗标、重复旗标与多余位置参数均 exit 64，不得静默忽略后 exit 0。

## 3. Archive 恢复物理文件

- journal 恢复扫描 archive target/`.tmp` 时，最终路径必须以 no-follow 打开，`fstat` 与 `lstat` 的 device/inode 一致后才读取字节。
- publication engine 在 stage、commit 前和 final check 的既存 archive target/`.tmp` 读取都走同一生产读缝；精确内容的 symlink 也必须拒绝并保留 journal。
- 显式 `--archive-dir` 仍允许项目外路径；archive 物理读取只拒最终 symlink/非普通文件，不借项目 containment 造成外部合法路径半事务。

## 4. 只读自定义路由可观察性

本轮无锁只读只承诺固定 `/ai-manager/process/list` 与迁移 `/workflow` 信封。自定义 `profile.routes.workflowList` 的纯只读链目前既不在无锁允许表，也没有零 binding 的 events-hash 人签发行路径，明确 `route:human`；不得临时放宽，也不得声称已自动可达。

## 5. 可命令化验收

`node tests/_golden/entity-binding-operability-review-successor.zero-sut.golden.mjs` 同时验证 MCP 新四件套纯 argv、CLI 参数闭合静态接线、archive symlink 动态拒绝与项目外普通 archive 正向读取。

## 6. 停止条件

- 本 golden 在 clean `792b680` 上真实 RED，在实现工作树全绿。
- plan/golden checksum 进入独立 PRD，story 由 gate 写成真绿。
- 不修改任何旧冻结测试，不运行任何 SUT/browser/server/network。
