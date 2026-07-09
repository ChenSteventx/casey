# record-intake — grill 决策记录（示教兜底第二契约，full）

背景：`record-capture` 已建，产出 `teach-in-capture.json`（`signed:false`/`replayReady:false`/`distillRequired:true` 硬降权、事件已 host 安全化 + 敏感字段遮值）。Steven 定示教兜底续建走 C（intake + distill 连做）。本契约只落第一段 `record-intake`：给录制包一个显式的安全复核闸 + 入账台账；`record-distill`（蒸馏 capture→候选 flow）另立契约。

设计前提：示教 intake/distill 的内部流在已落文档中未细定（设计 §9 recorder-as-library 已被 ADR-0006 取代，autotester 只有采集侧 recorder 参照）。本契约决策据领域模型（CONTEXT 示教/示教录制包词条）+ 已冻形态（teach-in-capture 包结构、ingest testcase.schema）+ 五层 LLM 准入边界 + 护栏 #7/#13/#14/#15。

## D1 范围：只复核登记，不蒸馏、不回放

- 定夺：`casey intake` 只做「接收录制包 → 安全复核 → 登记入账/拒账」。它不蒸馏（capture→flow 是 `record-distill` 的活）、不产候选 flow / 候选 TestCase、不改 capture 内容、不签署、不触发回放、不改 ingest schema。
- 理由：录制物没过相1 编译闸、相2 草拟闸、人签门、L0 复核；intake 是「录制物进蒸馏前置队列」的显式安全闸，把蒸馏的语义提升留给下游契约，职责单一（护栏 #14 fail-safe、CONTEXT 示教词条「不开直通回放」）。

## D2 车道：full

- 定夺：full。新增用户可见 CLI（`casey intake`），碰 `bin/`，涉及凭据复核、输出卫生、追加台账落盘。镜像 `record-capture` 同理由。
- 验收：先写金牌红基线，再实现，再 gate。命令化层钉包复核不变量与台账/输出安全；真机不涉（intake 只读已产录制包，纯 hermetic 可验）。

## D3 CLI 形态 + 触发（「触发接线」）

- 定夺：`node bin/casey.mjs intake <caseId> --capture <teach-in-capture.json>`。〔errata（同族兜底评审 F3）：本条初稿写 `[--out-dir <dir>]`，实现与 plan §3 已弃用——台账固定落 capture 同目录 `<caseDir>/record-capture/intake-ledger.jsonl`，无 `--out-dir`。以实现为准。〕
- 触发为**显式**：不做 `record` 完成后自动接线 intake。示教不开直通，intake 是一道可见、故意的闸；自动接线会把「录制→入账」并成一步、削弱闸的显式性（CONTEXT 示教词条）。
- 缺 caseId / `--capture` → exit 64。caseId 与 `--capture` 路径经 caseId 安全校验（镜像 `draft.mjs`/`sign.mjs` 先例，防路径穿越）。
- 台账落 capture 所在 case 目录的 `record-capture/` 下（由 `--capture` 路径派生，规范布局 `<caseId>/record-capture/teach-in-capture.json` 强制）。

## D4 复核不变量（fail-closed 拒账清单）

逐条命中即 reject（追加拒账台账 + 非零退出 + 不产 accepted 事实、不留半态）：

1. `artifactKind !== 'teach-in-capture'` → 拒（异类产物：防拿 `events.json`/`expected.frozen.json`/prd 冒充录制包过闸——护栏「录制物不直通」的形态门）。
2. `source.signed !== false` ∨ `source.replayReady !== false` ∨ `source.distillRequired !== true` → 拒（任何自称已签/可回放/免蒸馏的包——防走私假签署契约过 intake）。
3. `schemaVersion !== 1` → 拒（形态漂移）。
4. 包内 `caseId !== <caseId 入参>` → 拒（绑定闸，镜像 sign 的 prd.caseId 绑定）。
5. `events` 非数组或空 → 拒（无操作语料无法蒸馏）。
6. 任一 event：`action ∉ {click,dblclick,fill,press,nav}` ∨ 缺 `path` ∨ 字段含裸 `://` → 拒（脏事件；ALLOWED_ACTIONS 复用 record-capture 单一事实源）。
7. `credentialGate` 全文复扫命中 → 拒（纵深防御：capture 已过门，intake 再验一次；FORBIDDEN_KEYWORDS 单一事实源）。
8. 全文含裸 `://` 或非白名单 URL 形态 → 拒（host 泄漏；`<redacted:non-http-url>` 占位不含 `://`，合法 capture 恒过）。

- fail-closed 方向：复核证不出「干净合法录制包」一律拒账，绝不 fail-open 放进蒸馏。

## D5 intake 台账（「失败台账兑现」，本地入账台账）

- 定夺：append-only jsonl 台账 `<caseDir>/record-capture/intake-ledger.jsonl`；每次 intake 追加一条不可变记录：`{schemaVersion, event:'intake', intakeStatus:'accepted'|'rejected', caseId, intakedAt, eventCount, reason?, captureName}`。
- accept 与 reject 都追加（`reason` 只记**拒账依据类别**如 `ARTIFACT_KIND`/`CREDENTIAL_HIT`/`DIRTY_EVENT`，绝不复制原始脏内容进台账——防二次泄漏）。
- 台账文本写盘前过 `credentialGate`；追加不改（会计台账 + KEDB 追加血缘）。
- **与 CONTEXT:116 裁定下游 Failure Ledger 区分**：这是 intake **本地入账**台账，绝不进 `verdict.mjs`、绝不作自愈输入、绝不改写任何裁定（护栏 #13/#15）。术语须单独登记，避免与「失败记录台账」概念撞名。

## D6 accept 产物：台账即事实源，不转形不产副本

- 定夺：accept 后不转形、不产新候选文件——capture 已是语料，intake 只把 `accepted` 事实追加进台账 + 成功回显**定名产物**（capture 的定名形式，不回显 `--out-dir` 绝对路径，output-seal 纪律）。
- `record-distill` 直接读原 capture（intake 台账的 `accepted` 条目即「已入账」凭据）。
- 理由：避免冗余副本与两处事实源；台账已是入账权威。

## D7 术语登记（CONTEXT，造词先登记）

- 「示教入账 / Teach-in Intake」：把示教录制包经安全复核闸登记进蒸馏前置队列的动作；不转形、不签署、不回放。
- 「示教入账台账 / Teach-in Intake Ledger」：append-only 记录每次入账 accept/reject 的本地台账；显式与裁定下游 Failure Ledger（CONTEXT:116）区分——不进 verdict、不作自愈输入、不改裁定。

## D8 非目标

- 不做蒸馏（`record-distill` 另立）：不产 flow mapping、不产候选 TestCase、不碰 ingest `testcase.schema.json` 冻结形态。
- 不改 `replay`/`verdict`/`report` 冻结内核。
- 不代替人签、不绕相2。
- 不自动触发（`record`→`intake` 非自动接线）。
- 不接 MCP/skill（属后续易用性契约，需同时补真实可跑用例）。

## D9 与 record-distill 的接口约定（供下一契约衔接，本契约不实现）

- distill 读「已入账」的 capture（intake 台账 `accepted` 条目背书），把 events 蒸馏成候选 flow，重走 ingest→compile→draft→sign→run，绝不直通回放（learn 交账）。
- 蒸馏产物形态（候选 atom flow vs 完整候选 TestCase）与蒸馏 LLM 边界（零 LLM 投影 vs LLM 手术刀）留待 `record-distill` 的 grill 定，本契约不预设。
