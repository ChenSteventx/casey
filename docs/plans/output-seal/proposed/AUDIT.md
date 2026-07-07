# 全仓输出通道系统审计（2026-07-07，只读扫描，prd-caseid-echo-mask observability 挂账兑现）

> 扫描面：`bin/` + `lib/` 全部 `console.error`/`console.log`/die 消息约 200 处（全在 `bin/`；`lib/` 走
> throw/返回值经 bin 的 catch 透传，已并入）。判据：凭据兜底门只扫「将写的文本」（落盘产物），
> stderr/CLI 参数回显在其扫描面外——die/console 消息里的用户可控插值是主泄漏面。
> 六处挂账镜像逐一复核仍在原位（compile:60/:102、draft:48/:49、sign:102/:125、flow-bridge:43）。
> 关键分水岭：`ingest`（:35-36）与 `flow-bridge`（:37-38）回显前先对输入原文跑 `credentialGate` 预扫——
> 其闸拒回显是「已扫文本」；`sign`/`draft`/`compile`/`replay`/`report` 系无输入预扫，文件侧回显是真裸口。

## A 类：回显文件侧值

### High（可携文件任意内容片段）

- A1 `bin/sign.mjs:116`（stderr）：冻结期 lint 命中回显 `${a.value}` 断言值全文——draft 可手编/重签路径
  绕过草拟闸，值可为任何粘错内容。修：镜像 `ingest.mjs:29` 句式，只报「含未模板化 `atl_` 字面量」+
  原值不回显（可附 intentId 定位）。
- A2 `bin/sign.mjs:117`（stderr）：同上，9+ 位数字命中回显全文——值其余部分可为任意内容。同 A1。
- A3 `bin/draft.mjs:72` 经 `lib/assertion-draft.mjs:126-127`（stderr）：problems 内嵌 `${a.value}` 全文，
  `--patch` LLM/人编文件直达 stderr。修：lib 侧两条 problems 去 `：${a.value}` 尾巴（与 A1/A2 同一对
  正则的两个宿主，sign 注释已挂「抽公共件另案」可一并收）。

### Med（可携结构化字段值）

- A4 `bin/sign.mjs:102`：`draft.caseId`（挂账点名）——镜像句式「与命令行不一致（原值不回显）」。
- A5 `bin/sign.mjs:125`：`prd.caseId`（挂账点名）——同 A4。
- A6 `bin/draft.mjs:48`：`observed.caseId`（挂账点名）——同 A4。
- A7 `bin/draft.mjs:49`：`report.caseId`（挂账点名）——同 A4。
- A8 `bin/compile.mjs:60`：`tc.caseId`（挂账点名）——同 A4。
- A9 `bin/compile.mjs:102`：`tc.caseId` + `flowDoc.caseId`（挂账点名；flow 是 confirm 后可编辑件）——同 A4。
- A10 `bin/replay.mjs:175`：`expectedDoc.caseId`/`eventsDoc.caseId`——挂账未点名的同族新口（replay 对两
  文件零预扫零字符校验）。同 A4。
- A11 `bin/sign.mjs:139-141`：`verdict-baseline[${iid}]` 键名任意字符串——键名过 `SAFE_ID` 类白名单再
  回显，否则只报序号。
- A12 `bin/report.mjs:71-73,80,88`（stdout + 文件系统）：`model.caseId` 拼进 `<caseId>.report.*` 文件名
  与缺省 outDir 且 :88 回显完整路径——上游 `report-model.mjs:87` 与 `replay.mjs` 内部取值链全程无字符集
  校验（五 CLI 的 `^[A-Za-z0-9_-]+$` 闸在这条链集体缺席）。不止回显——是文件侧值进路径构造（穿越面）。
  修：report.mjs（或 report-model 装配处）补同款字符集闸。
- A13 `bin/compile.mjs:68,114` 经 `lib/compile-gate.mjs:38,46,51,52,55,106,108`：flow 文件的 `f.id`/原子名/
  参数键/实体名，:108 `「${v}」` 是值全文无校验。修：:108 收成「实体名未带前缀（原值不回显）」，键名类可留。

### Low（预扫垫底或值域受限，可顺手/可不动）

- A14 `flow-bridge.mjs:43`（六镜像之一，:37 预扫垫底降级）；A15 `flow-bridge` problems（预扫垫底）；
- A16 `ingest`/`parse-testcase` problems（预扫垫底 + :117 只回显已过闸值——正面样板）；
- A17 `sign.mjs:161-162` 越界键名；A18 sign-gate problems 结构化短值；A19 compile blockers 内嵌 flow 参数值。

## B 类：异常消息透传（Node 20+ `JSON.parse` 报错自带内容片段，login-bootstrap:62-63 实测确认）

### High

- B1 `bin/sign.mjs:37` `readJson`（draft/prd/verdict-baseline/旧 frozen 四类）：`${f}：${e.message}`——
  draft/baseline 人编无预扫。修：照 `login-bootstrap.mjs:60-64` 消毒「不是合法 JSON/不可读（内容不回显）」。
- B2 `bin/draft.mjs:30` `readJson`（observed/compile-report/patch）：同上（patch 人编/LLM 无预扫）。

### Med

- B3 `bin/compile.mjs:46`：testcase/flow `JSON.parse` 片段——同消毒方向。
- B4 `bin/report-model.mjs:99`：大 catch 吞六路 `JSON.parse`（case-meta 人给）——消毒或剥 `e.message` 换 `e.code`。
- B5 `bin/replay.mjs:199,274,307,329`：登录预备动作 `e.message` 截 300——凭据在飞语境；`loadCreds` 已消毒
  但 Playwright 报错可携元素预览（SUT 页面内容）。建议只留 `e.name` + 固定文案。
- B6 `bin/replay.mjs:709`：`e.stack` 全量兜底 catch——截断 + 剥栈（只留首行）。
- B7 `bin/compile.mjs:168,295`：`e.stack` 截 500 / 全量（:295 未截断）——同 B6。
- B8 `bin/verdict.mjs:110`：axes `JSON.parse` 片段——裁判面，消毒一行顺收。

### Low（逐处判过，不动可接受）

ingest:39 / flow-bridge:41-42（预扫在前，有意留口）；report.mjs 六处（门后产物 + fs 错误）；
sign:72,77（fs 路径类）；term-judge/term-guard/config-lane-guard/casey:130（仓内配置低危）；
casey:90 / compile:247（子进程 stderr 转发传递面）；compile-atoms:228（进 report 走 gatedWrite 有门）。

## C / D 类概览

- C 类（路径回显）约 28 处：全是用户自给 CLI 路径，低危不动。唯一点名不一致：`ingest.mjs:36` 与
  `flow-bridge.mjs:38` 把原始输入路径当 `credentialGate` 产物名键——`hit` 串会把 `--in`/`--testcase`
  原始路径带上 stderr，与 ingest 自家 :32/:61「路径不回显」政策矛盾。修：键改固定标签（如「输入候选」）。
- D 类（安全白名单）约 145 处：固定文案/用法行/已过闸值/枚举常量/七处已封镜像。不动。

## 特别复核

1. 裁判面 `bin/verdict.mjs` 干净（唯一缝 B8）；`verdict.json` 落盘不过凭据门（内容全为 axes 派生枚举，
   可接受但属未过门落盘口，记档）。`check.mjs` 独立调用回显 kind/op 属 CLI 参数；子进程调用 pipe 吞掉。
2. `lib/cred-gate.mjs` 自身不回显命中值（关键词回显字面量、敏感字面量写死「已隐去」）；唯一带出 = 产物名键（见 C 类）。
3. `term-judge.mjs:68` 写 `loop/inbox.md` 不过凭据门，`verdict.reason` 内嵌回合文本片段（span/term/gloss）；
   同族 `term-guard.mjs:215` `--emit-candidates` 落盘、`report-model.mjs:96`（靠 redactScalar 不靠门）。
   Med/Low：建议 inbox 写入过 `credentialGate` 或截断。
4. 正面样板 `bin/ingest.mjs` 三封口 + 输入预扫早于一切回显（金牌 ingest.golden:261,273,276 三哨兵钉死）——
   「预扫 + errno-only + 定名产物」就是封缝模板。

## 总账

要封：High 5（A1/A2/A3 + B1/B2）+ Med 约 13（A4–A13 + B3–B8 择收）。修法二选一均有先例
（`ingest.mjs:29` 遮值句式 / `login-bootstrap.mjs:60-64` 消毒重抛）。不建议给 sign/draft 加全文输入预扫
（`FORBIDDEN_KEYWORDS` 含 `token`/`cookie`，会误伤含这些英文词的正常断言值与夹具）。涟漪面小：既有金牌
只钉退出码与非回显哨兵不钉文案，零重冻；封缝按哨兵三断言模式各补新钉。
