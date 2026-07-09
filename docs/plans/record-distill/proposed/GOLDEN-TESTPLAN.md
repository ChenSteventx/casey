# record-distill — 金牌测试计划（红先行，逐条断言清单）

> 状态：契约包草案，测试**计划**（不写完整金牌代码）。主代理实现时红先行：先落 `tests/_golden/record-distill.golden.mjs` 并**验红**（`bin/distill.mjs` 不存在、`casey.mjs` 无 `distill` 分发、help 无 `casey distill` 即红），再实现，再 gate。
> 反夹具纪律（memory「别倒着裁夹具、复现已冻接缝」）：happy 路径**复现真接缝**——真 `casey record --from-events --no-login`（hermetic，无真机）产 capture → 真 `casey intake` 落台账 accept → `casey distill`。**绝不**手造一个「预定裁定」的 capture/台账去迎合断言；对抗输入（换包、软链、脏 mapping）在真接缝基础上做最小扰动。
> 决策依据：GRILL D1–D18 + plan §2–§5。

## 测试骨架（复用 record-intake.golden 的 hermetic 产包法）

- `run(args)` = `spawnSync(node, [casey.mjs, ...args])`；`assert(cond,msg)`；`readLedger` / `readJson` 辅助（照抄 `record-intake.golden.mjs` 先例）。
- 真接缝产包（每个需要「已入账干净包」的用例共用）：
  1. 写 `clean-events.json`（含真 URL 的原始事件，交 record 侧 `projectUrlSafe` 剥 host——复现真剥净接缝，不手写已剥净的 path）。
  2. `run(['record', caseId, '--sut', 'http://127.0.0.1:15519', '--out-dir', capOut, '--no-login', '--from-events', cleanEvents])` → exit 0，产 `<capOut>/<caseId>/record-capture/teach-in-capture.json`。
  3. `run(['intake', caseId, '--capture', capturePath])` → exit 0，台账落 accept（绑 `captureSha256`）。
  4. `run(['distill', caseId, '--capture', capturePath, '--out-dir', distillOut])`。
- 临时目录 `mkdtempSync`，`finally` 清理。

---

## C1 门面 + 用法错

- C1a：`casey.mjs` 源码含 `casey distill`（help 暴露命令，`readFileSync(cli).includes('casey distill')`）。
- C1b：`run(['distill'])`（缺 caseId）→ exit 64。
- C1c：`run(['distill', caseId])`（缺 `--capture`）→ exit 64；`run(['distill', caseId, '--capture', cap])`（缺 `--out-dir`）→ exit 64。
- C1d：裸旗标 `run(['distill', caseId, '--capture', '--out-dir', d])`（`--capture` 无值被解析成 true）→ exit 64。
- C1e：`caseId` 穿越/斜杠 → exit 65（`['distill','../../escape',...]`、`['distill','a/b',...]`），原值不回显。
- C1f：`caseId` 命中凭据门（如含 `token`/`password` 子串）→ exit 65，原值不回显（镜像 `intake` C1）。
- C1g（涟漪守）：`casey.mjs` help 不含过时形态 `--sut <url>`（避开 `handover-pack` C2 黑名单）；distill help 行只带 `--capture <f>` `--out-dir <d>`。

## C2 intake→distill TOCTOU 硬门（fail-closed，exit 65，零候选落盘）

每个拒账用例后断言：exit 65 + `<distillOut>/<caseId>/distill/` **不存在或为空**（零候选落盘，半份比没有更危险）。

- **C2a `NOT_INTAKEN`**：真 record 产干净 capture，但**跳过 intake**（不落台账）直接 distill → exit 65 reason `NOT_INTAKEN`、零候选落盘。（也测台账文件不存在、及台账存在但只有 reject 条目两种子形态。）
- **C2b `CAPTURE_SWAPPED`**：真 record → 真 intake（accept 绑 sha）→ **篡改 capture 字节**（改一个 event 的 `text`，保持仍合法）→ distill → exit 65 reason `CAPTURE_SWAPPED`、零候选落盘。（复现 record-intake prd F1 换包防线：intake 后换包，哈希失配即拒。）
- **C2c 软链硬化**（复用 intake 布局守卫，逐个子形态）：
  - capture 文件是符号链接 → exit 65。
  - `record-capture` 目录是符号链接 → exit 65。
  - `caseId` 目录是符号链接 → exit 65。
  - 既有 `intake-ledger.jsonl` 是符号链接 → exit 65。
  - `--capture` 非规范布局（basename 非 `teach-in-capture.json` / 父非 `record-capture` / 祖父非 `caseId`）→ exit 65。
- **C2d `REREVIEW_FAILED`**：真 record → 真 intake accept → **把 capture 换成一个 sha 仍匹配台账但当前 `reviewCapture` 不过的包**——注意：换字节必致 sha 变（会先撞 `CAPTURE_SWAPPED`）。故 C2d 复现路径 = 台账 accept 条目的 `captureSha256` 与当前脏包字节**一致**（即入账时就该拒但假设复核闸后续收紧的纵深场景）：构造「当前包字节 == 台账绑定 sha，但当前 `reviewCapture(doc,{caseId})` 返回 `ok:false`」。实现上用「直接手造一条 accept 台账条目，其 `captureSha256` 精确等于一个当前 `reviewCapture` 会拒的包的 sha256」复现纵深缝（此处允许构造台账，因为要复现的是「哈希对但复核不过」这一 TOCTOU 边角，非倒裁 distill 结论）→ distill → exit 65 reason 前缀 `REREVIEW_FAILED`、零候选落盘。
- **C2e 前置凭据门**：capture 原文含英文凭据关键词（绕过 record 剥净的构造包，但台账 sha 对齐）→ distill → exit 1（前置门，纵深防御，镜像 `ingest`）、零候选落盘、脏值不回显。

> C2d/C2e 允许手造台账+包以复现「哈希对但仍须拒」的纵深接缝——这是复现 TOCTOU 边角，不是倒着裁 distill 的裁定；happy 与主拒账（C2a/C2b/C2c）仍走真 record→真 intake 接缝。

## C3 零 LLM 确定性投影 + pending 诚实桩（happy，exit 0）

真 record → 真 intake accept → distill → exit 0，断言候选三件：

- C3a：`<distillOut>/<caseId>/distill/` 恰含三件 `distill-candidate-testcase-<caseId>.json` / `distill-candidate-mapping-<caseId>.json` / `distill-manifest-<caseId>.json`，**无**其他文件（尤其无 `events.json`/`expected.frozen.json`/`prd-*.json`）。
- C3b 候选 `TestCase` 骨架：`schemaVersion===1`；`caseId` 与入参一致；`source.kind==='json'`；`uniquePrefix==='atl_'`；`steps.length === events.length`（1:1，D6）；每步 `intentId==='i'+seq`、全局唯一；**无 `expected` 字段**（断言归相2）；**无 `target` 字段**（不臆造 startUrl）。
- C3c actionHint 忠实映射：`click` 事件步 `actionHint==='click'`、`fill`→`'fill'`、`nav`→`'navigate'`；`press`/`dblclick` 事件步**无 `actionHint`**（不臆造 `send`/`click`）。
- C3d pending 诚实桩（v1 全 pending，D8/D10）：候选 `mapping` 为空数组 `[]`；每个候选 `TestCase` 步标 `route:'human'` + 非空 `reason`；`manifest.pending.length === events.length`，每条 `pending` 有 `intentId`/`eventSeq`/`reason`（带 route:human 语），`pending` intentId 集 == `route:'human'` 步 intentId 集。
- C3e 候选真能被 `ingest` 收下（重走链贯通的第一关，复现真接缝）：`run(['ingest', caseId, '--in', 候选TestCase路径, '--out-dir', ingestOut])` → exit 0，产 `testcase-<caseId>.json`。**这是「重走 ingest→compile」贯通性的硬证**——候选骨架不是自说自话，真过 `parseTestCase`。
- C3f 溯源 manifest：`artifactKind==='distill-candidate'`；`captureSha256` 与台账 accept 条目的 `captureSha256` **一致**（且与当前包字节 `createHash('sha256')` 一致）；`projection.length===events.length`，每条 `{intentId,eventSeq,action,pathHint}`，`pathHint` 相对 path（`startsWith('/')`、无 `://`）。
- C3g 确定性可复现：同一 capture 连跑两次 distill，三候选文件字节**逐字节一致**（进 golden 真值；`generatedAt` 若含时刻须固定为可复现来源或排除出比对——实现取 manifest `generatedAt` 由入参注入/可 stub，或断言时剔除该字段）。

## C4 采集忠实闸（`--verify --mapping <f>`，或 `validateCaptureFidelity` 直测）

在 C3 产出的 manifest（`projection`/`pending`）基础上，喂对抗 `mapping`：

- C4a 无 capture 证据（凭空 atom）：`mapping` 含一条 `intentId` **不在** `projection` 集的条目（如 `i999`）→ `--verify` exit 65（reason `NO_CAPTURE_EVIDENCE`），或纯函数 `validateCaptureFidelity` 返回 `ok:false` + 该类 problem。
- C4b 漏译（未覆盖又未 pending）：构造一个 `projection` 有某 `intentId` 但 `mapping` 不覆盖、`pending` 也不含它 → exit 65（reason `UNCOVERED_EVENT`）/ `ok:false`。
- C4c 忠实通过：`mapping` 每条 `intentId` ∈ `projection` 且每个 `projection` 项被覆盖或 ∈ `pending` → `--verify` exit 0 / `ok:true`。
- C4d 闸自身绝不抛：喂 `mapping` 非数组、含 `null` 条目、缺 `intentId` 等畸形 → 返回 `{ok:false, problems}`（不抛异常、不 exit 1，镜像 `validateDraft` fail-closed 纪律）。
- C4e 输出卫生：`--verify` 拒账只回 reason 类别码 + 结构下标，不回显 `mapping` 值全文（防 `--mapping` 任意文件侧输入携种子）。

## C5 不直通回放（降权硬不变量，D11）

- C5a：distill **绝不**产 `events.json`/`expected.frozen.json`/`loop/prd-*.json`/任何 `signed:true`/`replayReady:true` 产物（扫 `distill/` 目录 + 三候选文件全文，无这些键为 true、无这些文件名）。
- C5b：候选 `mapping` 是裸数组（`flow-bridge` 形态），无 `signed`/`replayReady` 包裹键。
- C5c：manifest 有降权 note（非权威、须重走全链 + 人签）；`artifactKind==='distill-candidate'`（非 `teach-in-capture`、非任何回放产物类）。
- C5d：候选 `TestCase` 无 `source.signed`/`source.replayReady` 等键（`source` 只 `{kind,raw?,ingestedAt?}`——否则会被 `parseTestCase` 的 `source` 键闭合拒，C3e 已间接兜；此处正向断言 `source` 键集）。

## C6 输出卫生（护栏 #7，output-seal）

- C6a：三候选文件 + manifest 全文无裸 `://`（源 capture 已剥净、候选派生 + 输出门复扫）。
- C6b：成功 stdout 不含 `--out-dir`/`--capture` 用户绝对路径（只报定名产物 `distill-*-<caseId>.json`）。
- C6c：错误路径（C2 各拒账、C4 拒）stderr 只回 errno / reason 类别码，不回显路径、不回显脏内容（哈希、凭据值、mapping 值全文皆不回显）。
- C6d：候选/manifest 全文过 `credentialGate`（可用 `credentialGate` 直扫三文件文本断言 `ok`）；构造「投影后候选含英文凭据」的对抗（理论上源已剥净，此为纵深断言）→ 若命中输出门则 exit 1 零落盘。

## C7 门面回归

- `run(['selftest', '--tier1'])` → exit 0（新增 distill 门面不破确定性内核与统一语言自检）。

---

## 红先行验红预期（实现前跑金牌应见的红）

- C1a：`casey distill` 不在 help → 红。
- C1b–C1f：`distill` 分发不存在 → `casey.mjs` 落 `default`/`未知命令` 分支，退出码 ≠ 期望 → 红。
- C2/C3/C4/C5/C6：`bin/distill.mjs` 不存在 → 红。
- C7：selftest 本应绿（不依赖 distill）——它锁「实现后不回归」，非红先行项。

## 例翻纪律（可翻的例，防臆造）

pending 诚实桩（C3d）是可翻的例：红先行钉「未知/低置信 event 必落 pending（route:human）、不静默丢、不臆造 atom」。实现只让（v1）全部落 pending、（将来）仅高置信信号落候选 atom。任何「让 pending 变少的臆造」立即触 C3d/C4a 金牌红。采集忠实闸（C4a/C4b）是第二道可翻例：任何「LLM 提议录制里没有的 atom」或「漏译某 event」立即触红。

## 挂账（进 prd observability，route 标注）

- route:machine —— 「高置信 event → 候选 atom」断言留后续增量（v1 全 pending，D8）；届时另开红先行金牌补，不在本契约造脆弱路由匹配。
- route:human —— 真机全链趟合并（plan §6）。
