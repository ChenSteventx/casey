# plan — entity-lock-resign-revocation

## 1. 目标

为已有 `entity-locks.frozen.json` 提供显式、可审计、可恢复的换签入口：
旧锁字节按完整 hash 归档，撤销记录追加进 journal，新锁与 PRD checksum 经现役
publication engine 以 PRD-last 顺序发布。任何不明确或不自洽的旧状态都在写盘前拒绝。

## 2. 接口与生产改动

1. `lib/sign-cli-args.mjs` 增加独立布尔旗标 `--resign-entity-locks`；
   `bin/casey.mjs` help 与 `casey_sign` MCP schema/argv 同步。
2. 新增纯函数模块 `lib/entity-lock-resign.mjs`，负责：
   - 校验旧 PRD 登记的实体锁 checksum 与旧锁原始字节精确一致；
   - 生成完整 sha256 寻址的旧锁 archive；
   - 严格读取、验证并追加 `entity-locks.revocations.jsonl`；
   - 生成绑定旧/新锁 sha256、caseId、signedAt、build、signer 的闭合撤销记录。
3. `bin/sign.mjs` 只做编排：显式旗标组合门、初次换签计划、publication journal
   恢复时从其已绑定 target/tmp 重建相同 archive 与撤销 journal 文本，并把两件加入
   现役 PRD-last 事务。
4. `lib/sign-publication.mjs` 不改变既有 journal schema 与承诺；实体锁归档和撤销
   journal 作为普通前序 writes 被完整路径/内容摘要绑定。

不修改实体锁 schema、receipt、replay admission、`verdict.mjs` 或 destructive continuity。

## 3. 可执行验收

### A1 显式换签与 anti-clobber（红→绿）

新增 `tests/_golden/entity-lock-resign-revocation.zero-sut.golden.mjs`，在项目内临时
case/PRD 上调用真实 `bin/sign.mjs`：

- 已有旧锁时，不带新旗标仍 exit 65 且所有字节不变；
- 只带 `--resign-entity-locks`、未带 `--resign` 时拒绝；
- 首次发布误带、只签 expected 时误带、重复/未知旗标仍拒绝；
- 旧 PRD 缺 checksum、checksum 非 64 位小写 hex、checksum 与旧锁字节不符时零落盘拒绝；
- 同时带 `--resign --resign-entity-locks` 且旧状态自洽时 exit 0。

实现前应因新旗标未被 CLI 接受、合法换签不能完成而 exit 1；实现后全绿。

### A2 旧锁归档、撤销 journal 与 PRD-last

同一金牌断言：

- 旧锁 archive 文件名含旧锁完整 sha256，内容与旧锁原始字节逐字节相同；
- `entity-locks.revocations.jsonl` 只追加一条闭合记录，旧行逐字节保留，记录的旧/新
  sha256 与实际字节相等；
- 新 PRD 最终 checksum 指向新锁，旧 hash 只保留在归档与撤销记录；
- 畸形旧 journal、非换行终止、同一旧 hash 已指向不同 successor、既存 archive
  同名异内容均拒绝且 PRD 不变。

### A3 中断恢复与异输入拒绝

动态构造 publication journal 和已 staged/部分 committed 状态：

- 旧锁 archive 与撤销 journal 已到、新锁已到而 PRD 未到时，同一完整输入 exit 0 收口；
- 改 signedAt、build、signer、draft/confirmation 使新锁或撤销记录改变时拒绝；
- target 或 `.tmp` symlink、内容 hash 不符、匹配候选不唯一时保留 journal 并拒绝；
- PRD 始终为最后 authority，半提交状态不得被读侧当成新锁已授权。

### A4 邻接回归

- `sign-publication-recovery`、`entity-binding-operability-successor`、
  `entity-binding-operability-review-successor`、`p2-sign` 与实体锁 sign/准入金牌全绿；
- `casey selftest --tier1`、全仓 checksum 漂移扫描、术语检查全绿。

## 4. 可观察性申报

- 三条现有 destructive 用例的真实锁换签与 Steven 人签：`route:human`，状态
  `PENDING_STEVEN`；本契约不写现有 case 冻结件。
- Windows reparse point、掉电持久性与真实文件系统跨目录 rename 行为：
  `route:human`，安装包真机验收留证。
- destructive continuity v3 与逐删除步目标连续性：独立后继契约，本契约不实现。

## 5. 停止条件

- 新金牌在生产改动前真实 RED，红输出与 exit code 落盘；checksum 冻进独立 successor PRD。
- 新门与全部邻接面 GREEN，diff check、语法检查、漂移扫描通过。
- 异构实现评审通过；机器只留下 `PENDING_STEVEN`，不代签、不启动 SUT。
