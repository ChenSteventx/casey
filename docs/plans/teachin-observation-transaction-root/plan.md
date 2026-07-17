# teachin-observation-transaction-root — plan（full）

目标：以替代性契约补齐示教身份观察根的四个 HIGH 边界：固定项目 `cases/` 根、ledger（入账台账）安全事务、accepted authority（已接收权柄）与 readback receipt（读回收据）的同事务绑定、plain-own-data（纯自有数据）有界快照。任何拒绝路径均不得遗留可被 consumer（消费者）承认的 accepted 记录。

本契约 supersede（替代并收严）`teachin-observation-authority-root` 的路径、入账事务与联合能力边界，并与 `teachin-observation-driver-provenance` 的真实 driver 签名边界组合：本契约不放宽 driver 信任根。所有旧 plan、golden、fixture、PRD 与 checksum 保持不变。

## 1. 固定 canonical root 与对象身份

1. append/read 只接受模块内固定 `PROJECT_ROOT/cases/<caseId>/record-capture/teach-in-capture.json`。调用方参数、环境变量、同形 `/tmp` 路径或其它根不能扩张该信任根。
2. `cases/`、case 目录、package 目录、三件套文件、receipt 与 ledger 的祖先/叶节点 symlink 均拒绝；`realpath` 必须仍位于固定根内。
3. 目录与文件的设备号/inode（Windows 使用等价稳定 file identity）在一次事务内绑定并复核；只比较 basename、字符串路径或叶文件身份不构成 canonical 证明。
4. 非 canonical、symlink 或 identity 改变均 fail-closed，且不得创建 ledger、lock 或 accepted 残留。

## 2. bounded atomic committed ledger transaction

1. ledger 已存在 symlink 或 hardlink（`nlink > 1`）时拒绝；外部目标字节必须保持不变。新建/打开 ledger 必须拒绝跟随 symlink，并只接受普通单链接文件。
2. package 三件套、固定 receipt 文件、当前 ledger 与 latest accepted 的全部校验在 commit 前完成。任何校验拒绝都不得先追加 accepted 行；malformed receipt/ledger 后不得留下新的 accepted 字节。
3. accepted 写入是一条有界单行事务，长度上限来自 `limits.json`；写入使用排他锁、单次完整写入与落盘同步。锁已占用时 fail-closed，不得写 ledger。
4. committed 行必须闭合携带 `transactionId`、`transactionState:'committed'`、三件套 hash、`ledgerGeneration` 与 `transactionSha256`；`transactionSha256` 固定为移除自身字段后对 `JSON.stringify(record)` UTF-8 字节求 sha256。consumer 只承认字段齐全、hash 正确且状态为 committed 的 latest transaction；pending、缺字段、torn tail、重复 generation 均拒绝。

## 3. accepted + receipt 的同事务联合能力

1. accepted authority 与 receipt 必须由同一成功 commit 私下共享不可伪造 transaction token，并同时绑定 caseId、capture/sidecar/manifest 三 hash 与 ledger generation。
2. token 不得出现在 JSON、ledger、公开 facts、可枚举字段、日志、错误、报告或命令行。生产根提供联合验证面，只返回经同事务验证后的公开 package facts。
3. A package 的 receipt 与 B package 的 accepted authority 即使 `caseId` 及 `eventSeq/kind/name/code/platformId/scope/evidenceSha256` 全相同，也必须拒绝；反向组合同样拒绝。consumer 不得分别读取两份 plain facts 后自行拼接信任。

## 4. safe-own-data 有界且唯一实现

1. 共享模块公开并执行固定 `MAX_ITEMS`、`MAX_DEPTH`、`MAX_KEYS`、`MAX_BYTES`；验收值见冻结 `limits.json`。数组/对象/Buffer/Uint8Array/递归深度超限均在复制前拒绝。
2. 稀疏数组必须按实际 own keys 验证，不得用 `Array.from({ length })`、展开或其它按声明 length 构造全集；巨大稀疏 length 必须快速拒绝而不分配同规模内存。
3. `teachin-identity-observations` 必须复用共享 `snapshotPlainOwnData`，不得保留同型私有副本；同一 limits 对 identity sidecar/options 生效。

## 5. 可命令化验收

- `node tests/_golden/teachin-observation-transaction-root.zero-sut.golden.mjs`

golden 只使用本地文件、纯函数与冻结 fixture，覆盖：固定 cases root、case/package 祖先 symlink、ledger symlink/hardlink 外部字节不变、malformed 拒绝零 accepted 残留、committed 行与 lock/consumer 语义、A receipt + B authority 错包、四项 safe limits、巨大稀疏数组无按 length 分配、identity snapshot 复用。

冻结材料：

- `tests/_golden/fixtures/teachin-observation-transaction-root/limits.json`

## 6. 可观察性申报

- 父目录在检查与 open/rename/commit 间的跨进程 rename race，Node 在各 OS 缺少统一目录 fd 相对寻址能力，zero-SUT 无法完整证明；须平台专项审计与并发压力测试，`route:human`。不得为此向生产 API 注入 reader、clock 或 filesystem 测试旁路。
- 排他锁在进程崩溃、断电、网络文件系统和 Windows/macOS/Linux/WSL 各文件系统上的回收与 durability，须跨平台故障注入，`route:human`。
- file identity 在 Windows 与 POSIX 的等价性、真实录制 driver 是否在同一次会话消费 committed transaction，须真机审计，`route:human`。
- 本契约不启动 SUT、fake、fixture server、浏览器或网络；zero-SUT GREEN 不得外推成真机闭环，`route:human`。

## 7. 停止条件

新 golden 取得真实红输出并存档；plan、golden、fixture 的 sha256 写入新 PRD；`gate --dry --prd <新 PRD>` 与 `git diff --check` 通过；独立 acceptance commit 后停止。不改生产实现、不运行 SUT/browser/network、不改任何旧 frozen 资产。
