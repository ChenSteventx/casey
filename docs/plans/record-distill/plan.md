# record-distill — plan（full）

示教兜底第三契约：新增 `casey distill`，把「已入账」示教录制包蒸馏成候选流程（候选 `mapping` + 候选 `TestCase` 骨架 + `pending` 清单 + 溯源 manifest），重走 `ingest→compile→draft→sign→run`，绝不直通回放。决策见 `docs/plans/record-distill/proposed/GRILL.md`（D1–D18）+ 基准设计 `docs/plans/record-distill/proposed/DESIGN-DRAFT.md`。上游兑现 `loop/prd-record-intake.json` observability F1 挂账（intake→distill TOCTOU 下游义务）。

## 0. 涟漪勘定（先勘后动，本契约零冻结 schema 涟漪）

- 不碰 `tests/_golden/schemas/testcase.schema.json`（候选走既有 `source.kind:'json'` 模态）、`failure-ledger-entry.schema.json`、任何相3/4/6 冻结件。
- 复用 `lib/record-intake.mjs` 现成导出 `reviewCapture` / `intakeLedgerPath`——**不改其行为、不动 `tests/_golden/record-intake.golden.mjs`**。`verifyIntaken`（TOCTOU 语义核）新增在 `lib/record-distill.mjs`，不动 intake。
- 复用 `lib/record-capture.mjs` 的 `ALLOWED_ACTIONS`（经 record-intake 导入链，单一事实源）、`lib/cred-gate.mjs` 的 `credentialGate`。
- `bin/casey.mjs` +1 switch case（`distill`）+ help +1 行（不带 `--sut <url>`，避开 `handover-pack` C2 过时黑名单；`cli-mcp-face` 只钉 MCP 12 工具集、distill 不接 MCP → 零涟漪；`handover-pack` C1 只查 README 八节锚 → 不逼命令全集同步）。
- 只新增一个金牌 `tests/_golden/record-distill.golden.mjs` + 一个 `loop/prd-record-distill.json`；无须重签任何既有 prd 的 checksum。
- 结论：零冻结涟漪、零重签。

## 1. 术语登记（CONTEXT.md，造词先登记；四列制补登记，与 示教* 一族对齐）

- 示教蒸馏 / Teach-in Distillation：把已入账 示教录制包 的 events 零 LLM 确定性投影成候选流程（候选 `mapping` + 候选 `TestCase` 骨架 + `pending` 清单 + 溯源 manifest），重走 `ingest→compile→draft→sign→run`、绝不直通回放；蒸馏工具零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场。
- 蒸馏候选 / Distillation Candidate：`casey distill` 产的非权威候选物；降权标记落 manifest + 文件名 + 负向不变量，绝不 `signed`/`replayReady`，须重走全链 + 人签才算数。
- 采集忠实闸 / Capture-Fidelity Gate：distill 的零 LLM L0 闸，校候选 `mapping` 对 capture 溯源忠实（每候选 atom 有 event 证据、每 event 被覆盖或落 pending）；对位 `flow-bridge` 投影忠实（对象是 capture 溯源而非 `TestCase.steps`）。

登记纪律：英文走代码体/纯文本、加粗只给中文（ADR-0004）；首现附中文白话；中文标准简体；显式区分于 失败记录台账（裁定下游，护栏 #13/#15）。

## 2. 纯函数层 `lib/record-distill.mjs`（零 I/O、零 LLM、可测、闸自身绝不抛）

I/O（读文件、算哈希、软链 `lstat`、读台账）留 CLI 层；纯函数只吃已读入的数据。

- `verifyIntaken({ caseId, ledgerEntries, currentSha256 })` → `{ ok, reason }`：TOCTOU 语义核（D4 步骤 4）。
  - 筛 `ledgerEntries` 中 `caseId` 匹配且 `intakeStatus==='accepted'` 的条目；无 → `{ok:false, reason:'NOT_INTAKEN'}`。
  - 取最新一条 accept，其 `captureSha256 !== currentSha256` → `{ok:false, reason:'CAPTURE_SWAPPED'}`。
  - 全过 → `{ok:true, reason:null}`。reason 只回类别码，绝不回哈希/脏内容。
- `projectCapture(doc)` → `{ candidateTestCase, candidateMapping, pending, projection }`：零 LLM 确定性投影（D6/D8/D10），字节稳定可复现（同输入产同字节，进金牌真值）。
  - 意图切分 1:1：`doc.events` 每条 → 候选 `TestCase` 步，`intentId='i'+seq`；`intent` = 字面摘要（`action` + `text`/`fieldLabel`/`path` 字面拼接，不做语义声明）；`actionHint` 由 `click→click`/`fill→fill`/`nav→navigate` 忠实映射，`dblclick`/`press` 省略 `actionHint`。
  - v1 atom 全 pending：不产候选 atom，每步标 `route:'human'` + 非空 `reason`（诚实桩语），`candidateMapping=[]`。
  - `candidateTestCase` 形态严守 `parseTestCase` 契约：`{schemaVersion:1, caseId:doc.caseId, title?, source:{kind:'json', raw?}, steps:[...], uniquePrefix:'atl_'}`；**不含 `expected`**（断言归相2）；**不含 `target`**（capture 已剥 host、不臆造 `startUrl`）。
  - `projection` = `[{intentId, eventSeq, action, pathHint}]`（供 manifest 出账 + 采集忠实闸对账；`pathHint` 用相对 path）。
  - `pending` = `[{intentId, eventSeq, action, reason}]`，≡ `candidateTestCase` 里 `route:'human'` 步集。
- `validateCaptureFidelity({ mapping, projection, pending })` → `{ ok, problems }`：采集忠实闸（D9），fail-closed 全域返回、绝不抛（镜像 `validateDraft`）。
  - 引用完整：`∀ m∈mapping`，`m.intentId ∈ projection.intentIds` → 否则 `problems.push('NO_CAPTURE_EVIDENCE: <结构下标>')`（凭空 atom）。
  - 覆盖完整：`∀ p∈projection`，`p.intentId` 被 `mapping` 覆盖或 ∈ `pending` intentId 集 → 否则 `problems.push('UNCOVERED_EVENT: <intentId>')`（漏译）。
  - 对 manifest `projection` 溯源判、不重算 `i+seq` 命名（避免命名双源）。
- `buildDistillManifest({ caseId, captureSha256, projection, pending, generatedAt })` → manifest 对象 `{ schemaVersion:1, artifactKind:'distill-candidate', caseId, captureSha256, generatedAt, projection, pending, note }`（降权 note：非权威、须重走全链 + 人签）。

## 3. CLI 层 `bin/distill.mjs`（薄壳，fail-closed 前置，退出码 D13）

- 用法：`node bin/casey.mjs distill <caseId> --capture <caseId>/record-capture/teach-in-capture.json --out-dir <d>`。
- `caseId` 缺 → exit 64；形状违规（非 `^[A-Za-z0-9_-]+$`、穿越/斜杠）→ exit 65；命中凭据门 → exit 65（镜像 `intake.mjs:33-39`）。
- `--capture`/`--out-dir` 缺或裸旗标（无值）→ exit 64（镜像 `ingest`「旗标须带值」）。
- **前置 fail-closed 守卫（顺序即防线，复用 `intake.mjs:44-65`）**：布局校验（basename `teach-in-capture.json` / 父 `record-capture` / 祖父 `caseId`）+ 软链硬化（capture 文件 / `record-capture` 目录 / `caseId` 目录 / 既有台账文件任一软链 → exit 65）。
- 读 `raw = readFileSync(capturePath,'utf8')`（失败 → errno 回显 exit 1）→ 算 `captureSha256 = createHash('sha256').update(raw).digest('hex')`（**与 `intake.mjs:75` 同法**，D11 绑定）。
- 前置凭据门 `credentialGate({ capture: raw })` 命中 → exit 1（纵深防御，镜像 `ingest`，早于 parse 与回显）。
- 读台账 `intakeLedgerPath({capturePath})`，逐行 parse 成 `ledgerEntries`（读失败/无台账 → 视作无 accept 条目，交 `verifyIntaken` 报 `NOT_INTAKEN`）。
- `verifyIntaken({caseId, ledgerEntries, currentSha256:captureSha256})` 不过 → exit 65（reason `NOT_INTAKEN`/`CAPTURE_SWAPPED`，零哈希回显）。
- `JSON.parse(raw)` 失败 → exit 65（`PARSE_ERROR`）。
- 当前字节重跑 `reviewCapture(doc,{caseId})` 不过 → exit 65（`REREVIEW_FAILED:<review.reason>`）。
- 全过 → `projectCapture(doc)` + `buildDistillManifest(...)` → 三候选文件序列化，**逐一过 `credentialGate`**（命中 exit 1 零落盘，镜像 `ingest`）→ `mkdir <out-dir>/<caseId>/distill/` → 写盘。
  - 产物名：`distill-candidate-testcase-<caseId>.json`、`distill-candidate-mapping-<caseId>.json`、`distill-manifest-<caseId>.json`。
  - 成功不回显 `--out-dir`/`--capture` 绝对路径（output-seal），只报定名产物 + 「候选非权威、须重走链 + 人签」提示 + pending 计数。
- 可选 `--verify --mapping <f>`（子命令模态，D9）：读 `--mapping` 文件 + 既有 manifest（取 `projection`/`pending`）→ `validateCaptureFidelity` → 不过 exit 65（逐条 problems 类别码，无脏内容）；过 exit 0。用于 CLI 外 LLM 改完 `mapping` 后自检（也可直接进 `flow-bridge` 由其闸兜）。

## 4. casey 门面 `bin/casey.mjs`

- `main()` switch 加 `case 'distill': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'distill.mjs'), rest); process.exit(r.code); }`（镜像 `intake`/`record`/`ingest` 先例）。
- `help()` 生命周期分步段在 `intake` 行之后加一行（不带 `--sut <url>`，避开 `handover-pack` C2 黑名单）：
  `casey distill <caseId> --capture <f> --out-dir <d>  示教蒸馏：已入账录制包 → 候选流程 + pending + 溯源（重走 ingest→…→人签；不签署/不回放；门拒 fail-closed）`。
- 本契约不接 MCP / skill（属后续易用性契约，需同时补真实可跑用例）。

## 5. 验收（红先行：先写金牌红基线并验红，再实现，再 gate）

金牌 `tests/_golden/record-distill.golden.mjs`，逐条断言 C1–C7 见 `docs/plans/record-distill/proposed/GOLDEN-TESTPLAN.md`。红先行纪律：实现前 `bin/distill.mjs` 不存在、`casey.mjs` 无 `distill` 分发、help 无 `casey distill` 即红。happy 路径**复现真接缝**——先跑真 `casey record --from-events --no-login`（hermetic）产 capture、真 `casey intake` 落台账 accept，再 `casey distill`（对齐 memory「别倒着裁夹具、复现已冻接缝」，绝不手造预定裁定的夹具）。

`loop/prd-record-distill.json`：`testChecksums` 冻结金牌 sha256（`gate.mjs` 唯一写 `passes`）；observability 挂账（route:machine/human）见 §7。

**验收**（gate 判据）：

- `node tests/_golden/record-distill.golden.mjs` exit 0（C1–C7 全过）。
- `node bin/casey.mjs selftest --tier1` 无回归（新增 distill 门面不破确定性内核与统一语言自检）。
- `node loop-kit/bin/gate.mjs --prd loop/prd-record-distill.json` 全 acceptance exit 0（gate 写 `passes:true`）。

## 6. route:human（非阻断真机趟合并项，非本契约 hermetic 验收）

真机走一遍 `record → intake → distill → ingest → flow-bridge → compile → draft → 人签 → replay`，确认候选真过闸、`pending` 真交人、无凭据泄漏、无 `://`、无签署假象、候选 `TestCase` 真被 `ingest` 收下、候选 `mapping` 经 CLI 外 LLM 补后真过 `flow-bridge` + 采集忠实闸。属真机 UAT。

## 7. observability 挂账（prd，route 标注）

- route:human —— §6 真机全链趟合并项。
- route:machine —— v1 零 LLM 投影全 pending（D8）：`PROJECTION_HINTS` 高置信 atom 查表留后续增量，届时另开红先行金牌补「高置信 event → 候选 atom」断言，不在本契约臆造脆弱路由匹配。
- route:machine —— 蒸馏候选形态未冻 JSON schema（仅金牌断言字段锁漂移）：若将来跨消费者契约需硬化，另冻 `distill-candidate-*.schema.json` 并重签；本契约按局部候选处理、不预冻（沿用 record-intake 台账未预冻先例）。

## 8. 非目标（本契约不做，见 GRILL D17）

不改 `replay`/`verdict`/`report`/`ingest` 冻结内核；不碰 `testcase.schema.json`/`failure-ledger-entry.schema.json`；不接 MCP/skill；不自动接线 intake→distill；不复活 recorder-as-library（不从裸点击反解硬化原子）；不代替人签、不绕相2、不产任何正式回放产物（`events.json`/`expected.frozen.json`/`prd`/`signed`/`replayReady`）。

## 9. 待 Steven grill 敲定（收敛清单，见 GRILL「开放项」）

`--out-dir` 必带 vs 缺省 / 严格 1:1 vs 极保守去重 / v1 全 pending vs 一条 nav 查表 / 全步 route:human 候选可接受性 / 多 accept sha 匹配语义 / `--verify` 并入 vs 后续增量 / 候选标 `source.kind:'json'` 观感。
