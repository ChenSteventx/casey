# video-login-carry — 沉淀（full）

## 缺陷与修复

replay-video 双 page 舞步真机回归（2026-07-06 tc_wf_publish_states 四停站首验）：Heren 登录态只活在
`sessionStorage`（页签级），双 page 舞步的 page2 拿不到 → 带视频回放全事件 `locatorResolution: none`。
`--no-video`（单 page 路径）对照全链 PASS，病灶唯一钉在舞步。修复 = 登录归位后收割 page1 的
`sessionStorage` 快照（仅进程内存、绝不落盘/日志，护栏 #7）→ page2 首次 `goto` 前 `addInitScript`
恒等 `location.origin` 才种入（每次导航自动重种、异 origin 不外溢）。

## 异构评审（codex，四轮收口 R4 PASS）

- R1 四发现：三采信一修正采纳——全键值快照语义提硬（夹具三键随机 + 内嵌期望值校验）、跨 origin 负向
  S4、S2 全扫、S3 补回读断言。
- R2 四发现全采信：env 洗净 + 形状校验、S4 的 A/B 键值深等 + B 命中标记、夹具 capture 输出扫描、
  entries 收割 + 页面壳 `JSON.parse` 的 `__proto__` 保真（+ S5 特殊键金牌）。
- R3 一发现（Low，R3-F1）：capture 用异步 `on('data')`、金牌 `spawnSync` 阻塞事件循环，夹具末轮输出
  可能滞留 OS 管道致 S2 漏扫；修 = `close()` 改等 `'close'` 事件（stdio EOF）而非 `'exit'` + 各 check
  finally 内即关，S2 扫描前全部 SUT 收口确定性完整。
- R4 PASS：确认 R3-F1 闭合，钉红实证（夹具泄漏 key 到 stderr → S2 确定性红）。

## 教训

1. **hermetic 金牌假绿的根因是夹具形态与真机不同构**：`login-sut` 原是 cookie 会话（context 级共享），
   舞步天然不破，所以旧金牌假绿。复现真缺陷必须让夹具复刻真机的**登录态载体形态**（页签级
   `sessionStorage`），不是加断言。呼应 [[dont-rig-fixtures-reproduce-frozen-seams]]。
2. **断言要断在冻结接缝上，不断衍生概念**：axes 动作轴没有 `actionPerformed` 字段（那是 verdict 层
   衍生），等强度接缝信号是 `identityReadback.ok`（`replay-actions` 唯一写者）。断错字段会让金牌
   在自己的断言里假红/假绿。
3. **测试卫生扫描本身要确定性**：异步 `on('data')` + 同步 `spawnSync` 有漏扫竞态；凭据卫生这类
   fail-closed 扫描若非确定性，等于没有。收口用 `'close'` 事件（stdio EOF）而非 `'exit'`。
4. **钉红是「扫描非空转」的唯一证明**：每道负向断言都该有一次「注入违规→必红」的实证，否则可能
   一直绿只是因为从没被触发。R1/R2/R3 每轮都以破坏钉红实证后修绿。

## 残余（挂账）

- `close()` 的超时兜底分支 `SIGKILL` 后立即 resolve、不再等一次 `'close'`（R4 记）：假 SUT 无 SIGTERM
  handler、正常路径恒走 `'close'`，此异常路径不影响闭合；若将来夹具加信号处理再收紧。
- 真机带视频复跑 tc_wf_publish_states（route:human）：修后带视频回放应恢复 unique/performed 且报告
  录屏可播、`sessionStorage` 快照不入任何输出人工抽检——需拉隧道 + Steven 在场，同四停站行程收。
