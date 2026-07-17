# entity-binding-operability-successor — plan

## 1. 目标与边界

本 successor 收口实体绑定 sidecar 上一实现评审发现的四个 HIGH：重签恢复目标集合漂移、flow 桥缺 mutation `subject` 正向入口、项目内 lexical（词法）路径可被 symlink ancestor（符号链接祖先）绕到仓外、纯只读链因无 frozen authority 不可达。

不改 events v2、旧 frozen、旧 successor golden/schema/checksum；不运行 fake SUT、真实 SUT、浏览器、server 或网络。

## 2. 重签恢复

- `--resign` 首次发布的 journal 必须绑定 archive、new frozen、entity locks 与 PRD 的完整目标集合。
- 中断发生在 archive/new frozen/locks 已到而 PRD 未到时，同一 `--resign` 输入必须重建同一 archivePlan，不能因当前 frozen 已变成新字节而丢失 archive 目标。
- 恢复只能从当前旧 frozen、journal 已绑定的 archive target 或其 staged tmp 中确定性重建；路径摘要、内容摘要或 signedAt 任一不符必须拒绝。

## 3. Flow bridge 的 subject 入口

- CLI 外 LLM 从自然语言 TestCase 产 mapping 时，`entityBindings[].role` 必须允许 `subject/source/target` 三个显式角色。
- mutation 原子以 `subject` 正向进入 flow，保留 `sourceIntentId + candidateId + role`；relation 继续要求 `source + target`，不得按顺序猜角色。
- 缺失/未知角色仍 fail-closed。

## 4. 项目 artifact 路径边界

- `entity-locks-out` 不能只做 lexical 项目内判断。所有既存祖先必须 `lstat` 拒符号链接并 `realpath` 仍在真实项目根内；目标到位后须以 no-follow 打开并用 `fstat` 对比设备号/inode（索引节点）与路径身份。
- sign 在 PRD authority 最后提交前复核 locks 的真实文件身份；固定 PRD reader 读取 artifact 时同样执行物理边界核，防签后换链。
- POSIX symlink 绕仓外必须机器拒绝且 PRD 不更新。Windows junction/其它 reparse point（重解析点）无法由当前 Node 跨类型完备证明，保留 `route:human` 真机核验，不得声称机器完备。

## 5. 纯只读链

- compile 对固定 read allowlist 的纯只读 flow 仍不产 binding draft。
- replay checker 必须先从原 events bytes/document 与固定 side-effect policy 内部推导；所有 event 均为 read 时，不要求 frozen authority 即可授权浏览器启动。
- 任一未知/mutation/relation event 仍必须具备与原 events 精确绑定的 opaque frozen authority；caller bool 不得把写链洗成只读。

## 6. 可命令化验收

1. `resign-recovery`：动态运行本地 sign CLI，构造 archive/new frozen/locks 已到且 PRD 未到的 journal 断点；同一 `--resign` 输入须 exit 0 收口，异输入仍拒。
2. `bridge-subject`：自然语言 TestCase 对应 mapping 的 mutation `subject` 经 buildFlow 正向保真；未知角色拒，relation source/target 不回退。
3. `symlink-boundary`：POSIX 临时目录中以项目内 symlink ancestor 指向仓外，sign 必须非零且 PRD 旧字节不变；源码机制包含 lstat/realpath/no-follow/fstat+inode，reader 与 PRD-last hook 同时接线。
4. `readonly`：原 events 仅含固定只读原子且无 frozen authority 时 replay checker 正向允许；加入 mutation/未知原子立即拒；caller 自报字段仍拒。

测试可启动本仓 `sign` 子进程，但只做本地文件事务；禁止 SUT、浏览器、server 与网络。

## 7. 可观察性申报

- Windows junction/其它 reparse point、PowerShell 权限组合以及目标文件身份 API 的真机行为：`route:human`，需 Win 真机终端记录与附件。
- macOS/APFS 与 Linux 文件系统在进程中断、目录替换竞态下的 no-follow/inode 行为：`route:human`，安装包 UAT 留证。
- 自然语言 mapping 的实体候选语义是否选对业务对象：`route:human`，人签 receipt 前逐对象确认。

## 8. 停止条件

- 本 golden 在 clean `1b57aa3` 四 section 真实 RED；plan/golden checksum 进入独立 PRD，stories 初始 `passes:false`，`gate --dry` 可消费。
- gate 独立提交后才改实现；修绿后复跑 publication、sidecar successor、side-effect、admission、flow provenance 与五条 wiring。
- 不修改旧 frozen，不运行任何 SUT/browser/server/network。
