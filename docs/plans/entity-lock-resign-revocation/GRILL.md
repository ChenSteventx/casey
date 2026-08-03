# GRILL — entity-lock-resign-revocation

> 触发：现役 `sign` 只允许首次发布 `entity-locks.frozen.json`；文件一旦存在，
> 即使显式 `--resign` 也在写盘前拒绝。三条已有旧锁的 P9 用例因此没有合法换签入口。

## D0 已证事实

- `bin/sign.mjs` 的 `--resign` 目前只归档并替换 `expected.frozen.json`。
- 既存 `entity-locks.frozen.json` 且没有未完成 publication journal 时恒定 exit 65；
  错误文案所说的“显式撤销/归档流程”尚无实现。
- 现有 `sign-publication.mjs` 已提供 journal 驱动、PRD 最后提交、相同输入恢复、
  异输入拒绝的多文件发布基础，但还没有实体锁旧代归档与撤销记录。

## D1 显式授权与 anti-clobber

- 新增独立布尔旗标 `--resign-entity-locks`。它只在实体锁四件套完整、目标旧锁已存在、
  同时带 `--resign` 时合法；首次发布误带、只签断言时误带、缺 `--resign` 均拒绝。
- 旧 PRD 必须已登记目标 `entity-locks.frozen.json` 的精确旧 sha256，且旧文件字节与该值一致；
  缺登记、格式坏或不一致一律在任何落盘前拒绝。
- 不接受 caller 自报旧 hash、旧路径或撤销内容；全部由固定目标旧字节与规范 PRD 推导。

## D2 旧代归档与撤销 journal

- 旧锁按完整内容 sha256 寻址，归档为
  `archive/entity-locks.frozen.<caseId>.<oldSha256>.json`；同路径既存时只接受逐字节相等。
- 同一 `archive-dir` 下维护 `entity-locks.revocations.jsonl`。每行是闭合的撤销记录，
  至少绑定 caseId、旧锁 sha256、新锁 sha256、签署时间、构建、签署者；旧行逐字节保留，
  本次只追加一行。畸形旧 journal、重复旧 hash 指向不同 successor、尾部非换行均拒绝。
- 机器测试使用测试 signer；真实生产换签仍须 Steven 本人执行。本契约只产
  `PENDING_STEVEN` 的人工验收申报，不代签任何现有用例。

## D3 发布顺序与恢复

- 发布目标集合必须同时包含旧 expected 归档（如有）、旧实体锁归档、撤销 journal、
  新 expected、新实体锁、pending 旁车（如有）和 PRD；PRD 仍是最后 authority。
- publication journal 必须绑定完整目标路径摘要和内容摘要。旧锁归档或撤销 journal
  已到、PRD 未到时，同一输入可恢复；任一签署输入、旧/新锁字节或 journal 字节变化均拒绝。
- 不声称多文件 OS 原子；承诺是中断可判定、同输入可恢复、异输入 fail-closed、
  PRD 未到位时新锁不能形成有效 authority。

## D4 范围与非目标

- 只修改 `sign` 的实体锁换签发布面及其纯本地零 SUT 验收。
- 不修改实体锁 schema、receipt 语义、replay admission、裁判或 destructive continuity。
- 不提前实现 destructive continuity v3，不启动浏览器、server、隧道或真实 SUT，
  不读取凭据。

## D5 完成判据

- 新验收金牌在实现前真实 RED、实现后 GREEN，并由 successor PRD 冻结。
- 现有 sign/publication、entity-binding operability、实体锁准入与 tier-1 邻接面全绿。
- 全仓 checksum 漂移与术语检查为零问题；实现经异构评审。
- 真实生产换签与 Steven 人签保持 `route:human`，不因 hermetic 绿而宣称 P9 完成。
