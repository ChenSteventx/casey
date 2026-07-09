# record-intake — plan（full）

示教兜底第二契约：新增 `casey intake`，把 `teach-in-capture.json` 经安全复核闸登记进蒸馏前置队列，落 append-only 入账台账。决策见 `docs/plans/record-intake/proposed/GRILL.md`（D1–D9，Steven grill 签核「照 GRILL 走」）。

## 0. 涟漪勘定（先勘后动，本契约零冻结 schema 涟漪）

- `failure-ledger-entry.schema.json`（seams-freeze-v2 冻结）是 CONTEXT:116 **裁定下游** Failure Ledger 条目（verdict/fingerprint/humanResolution/护栏 #13/#15 不变量）——与本契约 intake 台账**不同物**，本契约不碰它、不复用它的形态，术语分名（D7）。
- `cli-mcp-face` 只钉 MCP 12 工具集 + argv；本契约不接 MCP，零涟漪。
- `handover-pack` C2 钉 casey help「无过时形态 + 关键旗标锚在场」（过时黑名单含 `--sut <url>`）：`intake` 不带 `--sut`、help 行避开过时形态即无碰；C1 只查 README 八节锚不查命令全集，不逼 README 同步。
- `record-capture.golden` 用 `.includes('casey record')` 子串断言，加 `intake` 不误伤。
- 结论：本契约只新增一个金牌 `record-intake.golden.mjs`；无须重签任何既有 prd 的 checksum。

## 1. 术语登记（CONTEXT.md，造词先登记）

- 「示教入账 / Teach-in Intake」：把示教录制包经安全复核闸登记进蒸馏前置队列的动作；不转形、不签署、不回放。
- 「示教入账台账 / Teach-in Intake Ledger」：append-only 记录每次入账 accept/reject 的本地台账；**显式区分**于裁定下游 Failure Ledger（CONTEXT:116）——不进 verdict、不作自愈输入、不改任何裁定（护栏 #13/#15）。

## 2. 纯函数层 `lib/record-intake.mjs`（零 I/O，可测）

- `reviewCapture(doc, { caseId, scanText })` → `{ ok, status:'accepted'|'rejected', reason, eventCount }`：fail-closed 复核闸，逐条判 D4：
  1. `ARTIFACT_KIND`：`doc.artifactKind !== 'teach-in-capture'`。
  2. `SIGNED_FLAG`：`doc.source.signed !== false` ∨ `replayReady !== false` ∨ `distillRequired !== true`。
  3. `SCHEMA_VERSION`：`doc.schemaVersion !== 1`。
  4. `CASEID_MISMATCH`：`String(doc.caseId) !== String(caseId)`。
  5. `EMPTY_EVENTS`：`events` 非数组或 `length===0`。
  6. `DIRTY_EVENT`：任一 event `action ∉ ALLOWED_ACTIONS`（从 `record-capture.mjs` 导出复用单一事实源）∨ 缺 `path` ∨ 任一字符串字段含裸 `://`。
  7. `URL_LEAK`：`scanText` 含裸 `://` 或协议相对 `//host`（`<redacted:non-http-url>` 占位不含 `://`，合法 capture 恒过）。
  8. `CRED_GATE_HIT`：由 CLI 层先用 `credentialGate(raw)` 判（纵深防御，早于 parse），命中即此 reason（见 §3 前置顺序；类别码避开 `credential` 禁字段子串防台账行自触门）。
  - 命中即 `ok:false` + 对应 `reason` 类别码；全过则 `accepted`、`eventCount = events.length`。reason 只记**类别码**，绝不回原始脏内容。
- `buildIntakeRecord({ caseId, status, reason, eventCount, intakedAt, captureName })` → 台账条目对象：
  `{ schemaVersion:1, event:'intake', intakeStatus, caseId, intakedAt, eventCount, reason: status==='accepted'?null:reason, captureName }`。
- `intakeLedgerPath({ capturePath })` → capture 同目录的 `intake-ledger.jsonl`（`<caseDir>/record-capture/intake-ledger.jsonl`）。
- `appendIntakeLedger({ ledgerPath, record })`：序列化单行 + 写盘前过 `credentialGate`（命中抛，绝不写），`mkdirSync`+`appendFileSync`（追加不改）。
- `record-capture.mjs` 加性导出 `ALLOWED_ACTIONS`（纯加 `export`，零行为差，`record-capture.golden` 不动）。

## 3. CLI 层 `bin/intake.mjs`（薄壳，fail-closed 前置）

- 用法：`node bin/casey.mjs intake <caseId> --capture <teach-in-capture.json>`（台账落 capture 同目录，无 `--out-dir`）。
- 缺 `caseId` / `--capture` → exit 64（用法错）；裸 `--capture`（无值）→ exit 64。
- caseId 形状安全（镜像 `draft.mjs`/`sign.mjs`/`record.mjs`：拒 `..`/斜杠/穿越）= 预读 fail-closed 守卫 → exit 65（无台账；台账只记读包后的内容裁定）。
- 读 capture 文件失败 → 只回显 errno 不回显路径 → exit 1。
- **前置凭据门**：先读原文 `raw`，`credentialGate(raw)` 命中 → 追加 reject 台账（reason `CRED_GATE_HIT`，台账条目零脏内容）→ exit 65；早于 JSON.parse 与任何回显。类别码刻意避开 cred-gate 禁字段子串（`CREDENTIAL_HIT` 含 `credential` 会自触门），故命名 `CRED_GATE_HIT`。
- `JSON.parse` 失败 → 追加 reject 台账（reason `PARSE_ERROR`）→ exit 65。
- `reviewCapture` → `accepted`：追加 accept 台账，回显**定名产物**（`<case-dir>/record-capture/intake-ledger.jsonl` 定名，不回显用户传入的绝对路径，output-seal 纪律）→ exit 0；`rejected`：追加 reject 台账（reason 类别）→ exit 65。
- 退出码沿用先例：64 用法错 / 65 复核拒账（fail-closed，同 sign/flow-bridge）/ 1 读写错 / 0 accept。

## 4. casey 门面 `bin/casey.mjs`

- `main()` switch 加 `case 'intake': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'intake.mjs'), rest); process.exit(r.code); }`（镜像 `record`/`ingest` 五先例）。
- `help()` 生命周期分步段加 `record` 之后一行：`casey intake <caseId> --capture <f>  示教入账：安全复核录制包 → 登记入账台账（不转形/不签署/不回放；拒账 fail-closed）`。避开 handover-pack C2 过时黑名单形态。
- 本契约不接 MCP / skill（属后续易用性契约，需同时补真实可跑用例）。

## 5. 验收（红先行：先写金牌红基线并验红，再实现，再 gate）

`node tests/_golden/record-intake.golden.mjs`：

- C1：help 暴露 `casey intake`；缺 caseId/`--capture` → exit 64；caseId 穿越（`../../x`、`a/b`）→ exit 65。
- C2：干净合法 capture → exit 0；台账 `intake-ledger.jsonl` 追加一条 `intakeStatus:'accepted'`、`eventCount` 与包一致、`reason:null`；成功回显不含用户绝对路径；**不产任何副本文件**（只加台账，capture 原地不动）。
- C3：八条 fail-closed 逐条 → exit 65 + 台账 reject + reason 类别码正确、无 accepted 事实：
  C3a `ARTIFACT_KIND` / C3b `SIGNED_FLAG`（signed:true / replayReady:true / distillRequired:false 三形态）/ C3c `SCHEMA_VERSION` / C3d `CASEID_MISMATCH` / C3e `EMPTY_EVENTS` / C3f `DIRTY_EVENT`（坏 action、缺 path、字段内嵌 `://`）/ C3g `CRED_GATE_HIT`（台账条目内**零凭据值**）/ C3h `URL_LEAK`（含 `PARSE_ERROR` 坏 JSON 拒账）。
- C4：台账 append-only——两次 intake → 两行，第一行字节不变；台账全文过 `credentialGate`（无 `://`、无凭据）。
- C5：拒账不留半态（无 accepted 条目、无副本）；reason 是类别码非原始脏内容（脏内容不落台账）。
- `node bin/casey.mjs selftest --tier1` 无回归。

## 6. route:human（可选，非阻断）

- 真机录制一次后跑 `casey intake` 一遍，确认真 capture 过闸、台账 accept、无凭据泄漏。属真机趟合并项，非本契约 hermetic 验收。

## 7. 非目标（本契约不做）

- 不蒸馏（`record-distill` 另立）：不产 flow mapping / 候选 TestCase、不碰 `testcase.schema.json`。
- 不改 `replay`/`verdict`/`report` 冻结内核、不碰 `failure-ledger-entry.schema.json`。
- 不代替人签、不绕相2、不自动触发（`record`→`intake` 非自动接线）。

## 8. 交下一契约的账（record-distill）

- distill 读「已入账」capture（intake 台账 `accepted` 条目背书），events 蒸馏成候选 flow，重走 ingest→compile→draft→sign→run，绝不直通回放。
- 蒸馏产物形态（候选 atom flow vs 完整候选 TestCase，后者需改 ingest 冻结 schema）与蒸馏 LLM 边界（零 LLM 投影 vs LLM 手术刀）留待 `record-distill` grill 定。
