# sign-publication-recovery — plan

## 1. 背景与边界

`sign` 同时发布冻结断言、`entity-locks.frozen.json` 与规范 PRD checksum 时，逐文件 `rename` 不是多文件 OS 原子。若身份锁已经到位而 PRD 尚未到位，命令必须明确失败且可用完全相同输入恢复；不得把半提交说成成功，也不得因孤儿锁导致永久无法重试。

本契约只加固 `sign` 的本地发布事务，不改 events v2、binding draft、frozen locks schema、旧 successor golden/schema/checksum，不运行 SUT、浏览器、server 或网络。

## 2. 发布事务

- 含实体锁的签发必须在任何目标发布前写 publication journal（发布日志）；journal 只保存签署时间、目标路径摘要、内容摘要与 authority 目标摘要，不保存凭据或业务内容。
- 目标全部先 staged write（暂存写），再逐个 rename；规范 PRD 必须是最后一个目标。PRD 到位前，先到位的 locks 不得被本次新 checksum 铸成 authority。
- 多文件发布明确不声称 OS 原子；中断后 journal 保留，命令非零退出，不宣称完成。

## 3. 恢复与拒绝

- 同一目标集合、同一内容、同一 signedAt 的重试必须识别已到位目标并继续剩余步骤，最终校验全部目标后清 journal。
- journal 与本次任一目标/内容/signedAt 不一致时，必须在继续 rename 前拒绝，不得猜测或覆盖。
- 若全部目标已到位但 journal cleanup（日志清理）失败，首次命令仍非成功；同输入重试必须只完成终检与 journal 清理并成功收口。
- 无 journal 的既存实体锁、PRD 预存同路径 checksum、损坏 journal、journal 与临时路径碰撞都必须 fail-closed（失败即关闭）。

## 4. 可命令化验收

1. `interrupt-recover`：以内存文件系统动态注入“locks 后、PRD 前 rename 中断”，验证首次非成功、PRD 仍为旧字节、journal 保留；同输入重试成功且 journal 清除。
2. `mismatch-authority`：中断后改变任一输入必须拒绝且不继续 rename；有效事务中 PRD 永远最后 rename，半提交 locks 不构成本次新 authority。
3. `cleanup-retry`：动态注入 journal cleanup 失败，验证首次不宣称成功、全部目标与 journal 共存；同输入重试只做确定性收口并成功。
4. `cli-wiring`：`bin/sign.mjs` 使用独立 publication engine（发布引擎），传入规范 PRD 作为 authorityPath；不得保留本地多文件“原子”宣称，首次发布拒绝潜伏的旧 locks checksum。

以上测试只调用纯本地模块、内存 I/O 与静态源码读取；禁止子进程、SUT、浏览器、server 与网络。

## 5. 可观察性申报

- Win PowerShell、WSL 与 macOS 上真实断电/进程终止后的文件系统 rename、flush 与权限行为：`route:human`，在发布安装包 UAT 中留终端记录与附件。
- 人签操作者身份、平台权威读回、撤销与审计日志：`route:human`，沿实体语义锁主契约另行核销。

## 6. 停止条件

- 本 golden 在 clean `f6cee07` 上真实 RED，新增 plan/golden 的 sha256 进入独立 PRD，stories 初始 `passes:false`，`gate --dry` 可消费。
- gate 独立提交后才恢复实现候选；实现修绿须同时复跑旧 successor、side-effect、admission 与五条 wiring 回归。
- 不修改任何旧 frozen，不运行 SUT/browser/server/network。
