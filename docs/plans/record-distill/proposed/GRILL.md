# record-distill — grill 决策记录（示教兜底第三契约，full）

> 状态：契约包草案，未 grill 签核、未 contract init、未实现。本文只做决策，不碰 `lib`/`bin`/`web`、不动冻结 schema、不写 prd、不提交。
> 基准：`docs/plans/record-distill/proposed/DESIGN-DRAFT.md`（两岔口已论证）。本 GRILL 在其结论上做**接近可实现**的深化，把散落的取舍收敛成逐条决策 D1..D18，并**显式标注**哪些是「推荐待 Steven grill 签核」（新增/细化项），哪些是「沿用已签先例」。
> 上游账：`record-intake` 台账 accept 条目已绑 `captureSha256`（`loop/prd-record-intake.json` observability F1 挂账：TOCTOU 下游义务落 record-distill）。本契约兑现该义务。

## 背景与领域定位

Casey 七相：相0 归一 → 相1 编译 → 相2 断言草拟+冻结人签 → 相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告。示教兜底线：`人示范 →record→ 示教录制包 →intake→ 入账台账 accept(+captureSha256) →distill→ 候选流程 →ingest→…→sign(人签)→…→report`。

`record-distill` 是这条线的第三段：把「已入账」录制包的 events **蒸馏**成候选流程（候选 `mapping` + 候选 `TestCase` 骨架 + `pending` 清单 + 溯源 manifest），**重走** `ingest→compile→draft→sign→run`，绝不直通回放。它是一次相1 高度的 authoring 活动（CONTEXT 五层准入：L1 归一/authoring = 「LLM 提案、确定性闸校验、不合规 fail-closed」），不是新执行层。全程在相3 回放/相4 裁定的**上游**，LLM 从不进裁判进程（护栏 #15 天然满足）。

不复活 recorder-as-library（ADR-0006）：不从裸点击反解硬化原子（R7/R9 已证不可靠），而是「保守确定性投影 + CLI 外 LLM 手术刀经既有闸入场 + 采集忠实闸 + 人签」把语料喂回正规 authoring 面。

---

## D1 范围（沿用 record-intake D9 交账）

`casey distill` 只把「已入账」录制包蒸馏成 **候选流程 + pending 清单 + 溯源 manifest**，让其重走七相原链。不签署、不裁定、不回放、不产正式回放产物（`events.json`/`expected.frozen.json`/`prd`）、不代替人签、不绕相2、不改任何相3/4/6 冻结内核、不自动接线 intake→distill。

## D2 车道：full（沿用 record-capture / record-intake 先例）

新增用户可见 CLI（`casey distill`）、碰 `bin/`、涉凭据复核/输出卫生/TOCTOU 校验/落盘。先写金牌红基线并验红，再实现，再 gate。命令化层 hermetic 可验（distill 只读已产录制包 + 台账，不涉真机）。

## D3 CLI 形态 + 触发 [推荐待签核：--out-dir 必带]

```
node bin/casey.mjs distill <caseId> --capture <caseId>/record-capture/teach-in-capture.json --out-dir <d>
```

- 触发**显式**：不做 intake 后自动接线。示教不开直通，distill 是一道可见、故意的闸。
- `--capture` 须为 `<caseId>/record-capture/teach-in-capture.json` 规范布局（复用 `bin/intake.mjs` 布局 + 软链硬化守卫，不另造判据）。
- `--out-dir` **必带值**（镜像 `ingest` 先例，不做隐式缺省，避免布局歧义）。候选落 `<out-dir>/<caseId>/distill/`，**绝不写进 `record-capture/`**（不扰 intake 台账「目录仅 capture + 台账两件」不变量）。
- 缺 `caseId`/`--capture`/`--out-dir` → exit 64；裸旗标（无值）→ exit 64；`caseId` 形状违规（穿越/斜杠/非 `^[A-Za-z0-9_-]+$`）→ exit 65；`caseId` 命中凭据门 → exit 65（镜像 `intake.mjs:33-39`）。
- **待 grill**：`--out-dir` 是否允许缺省为 capture 的 `<caseId>` 父目录（省一个参数），还是强制必带（本草案取必带）。

## D4 intake→distill TOCTOU 硬门（兑现 record-intake prd F1 挂账）

消费录制包**前**过下列硬门，任一不过一律 fail-closed exit 65、**零候选落盘**（半份候选比没有更危险，沿用全仓先例）。执行顺序即 fail-closed 顺序：

1. **布局 + 软链硬化**：`--capture` 规范布局；capture 文件、`record-capture` 目录、`caseId` 目录、既有台账文件任一是符号链接一律拒（`lstat` 不跟随）。直接复用 `bin/intake.mjs:44-65` 守卫纪律。
2. **读当前 capture 字节 + 算 `captureSha256`**：`createHash('sha256').update(raw).digest('hex')`，`raw = readFileSync(capturePath,'utf8')`——**须与 `bin/intake.mjs:75` 字节同法**（TOCTOU 绑定依赖两侧哈希口径一致，见 D11）。
3. **前置凭据门**：`credentialGate({ capture: raw })` 命中 → exit 1（纵深防御，镜像 `ingest` 前置门；早于 parse 与任何回显）。
4. **读台账 + `verifyIntaken`**：读同目录 `intake-ledger.jsonl` 逐行 parse，筛该 `caseId` 且 `intakeStatus==='accepted'` 条目——
   - 无 accept 条目 → 拒（`NOT_INTAKEN`：录制包从未入账，distill 无权越 intake 闸）。
   - 取**最新一条** accept，比对其 `captureSha256` 与步骤 2 当前哈希：失配 → 拒（`CAPTURE_SWAPPED`：intake 后有人换包，按哈希失配即拒——正是 record-intake F1 换包防线）。
5. **当前字节重跑 `reviewCapture(doc, { caseId })`**（`lib/record-intake.mjs` 现成导出）：不过 → 拒（`REREVIEW_FAILED`）。台账 accept 只证「入账那刻干净」；distill 再验证「此刻仍干净、且仍过当前更严的复核闸」（复核闸后续收紧被此步自动吸收，纵深防御）。

取舍：哈希绑定 + 重跑复核**都做**（belt-and-suspenders）。哈希抓字节篡改，重跑抓「哈希对但语义须复核」的边角并吸收复核闸收紧。二者都零 LLM、都可复现、都进金牌。**待 grill**：多 accept 条目（同包合法重录重入账，多个不同 sha 的 accept）时是否只认「最新一条 accept 的 sha」——本草案取「最新 accept 精确 sha 匹配」，失配即 `CAPTURE_SWAPPED`。

## D5 蒸馏产物形态（岔口一定案，沿用 DESIGN-DRAFT §3）

**候选 `mapping` + 轻量候选 `TestCase` 骨架**，走**既有** `source.kind:'json'` 模态，**零冻结 schema 涟漪、零重签**。否决给 `source.kind` 加 `'teach-in'`/`'manual'` 枚举、改冻结 `testcase.schema.json` 的做法。

- 血缘由 intake 台账 `captureSha256` + distill manifest 双记，出账充分；`teach-in` 不属于「文本书写模态」这一维，硬加会污染枚举；改冻结 schema 的涟漪（重签 ingest 金牌、双源同刻改 `parse-testcase`、触 compile/draft 下游）成本远超收益。
- 候选 `TestCase` 骨架标 `source.kind:'json'` 字面属实（它就是一份机器产的 JSON authoring 文档）。

## D6 意图切分：1 event : 1 意图步 [推荐待签核，细化 DESIGN-DRAFT §4]

零 LLM 确定性投影把 events **一对一**切成意图级步：`event.seq` → 一个候选 `TestCase` 步，`intentId = 'i' + seq`（如 `i1`/`i2`），`intent = event 字面摘要`（取 `action` + `text`/`fieldLabel`/`path` 的字面拼接，纯字面、不做语义声明）。

- **不做多 event 合并成一意图**——合并需语义判断（LLM territory），零 LLM 投影不臆断分组。多 event 合成一个高层意图由 CLI 外 LLM 在改写候选时做，经 `parseTestCase` 重新入场。
- 1:1 让「采集忠实闸」的 event↔intentId 对账**结构可判**（见 D9），是可实现性的关键简化。
- **待 grill**：是否允许「连续同 path 的 nav 去重」等极保守的确定性合并——本草案取严格 1:1，宁多步勿臆断。

## D7 蒸馏 LLM 边界（岔口二定案，沿用 DESIGN-DRAFT §4）

**蒸馏工具本体（`lib/record-distill.mjs` + `bin/distill.mjs`）零 LLM 确定性投影**；**LLM 手术刀只在 CLI 之外**（agent/skill 层），其产物必经既有零 LLM 闸（`parseTestCase`/`validateBridge`/`validateDraft`）+ 新增采集忠实闸 + 人签门入场。与全仓「每个 `lib`/`bin` 零 LLM、LLM 只在 CLI 外经确定性闸入场」不变量严丝合缝（`ingest` 的 `parseTestCase`、`flow-bridge` 的 `validateBridge`、`draft` 的 `validateDraft` 全是此形）。

## D8 零 LLM 投影的 atom 边界：v1 全 pending [推荐待签核，细化 DESIGN-DRAFT §4 + §9]

- **actionHint（动作类，非 atom）确定性投影到候选 `TestCase` 步**：`click→click`、`fill→fill`、`nav→navigate`（忠实的动作类映射）；`dblclick`/`press` 无忠实枚举对应 → **省略 actionHint**（留给 CLI 外 LLM），绝不猜 `send`/`click`。这是忠实、恒安全的结构性投影。
- **atom（相1 硬化原子）零 LLM 投影 v1 一律不落、全 pending**：真机路由跨环境不稳（如注册表 `ROUTE_LIST='/ai-manager/process/list'` 与录制里 `/heren/aimanagement/process/list` 不等），无可靠静态查表把 event 映成 atom（ADR-0006 R7/R9）。故 v1 `projectCapture` **不产任何候选 atom**，候选 `mapping` 为空数组 `[]`，每个意图步落 `pending`（`route:'human'` + reason，见 D10）。
- 「高置信 atom 查表」作为**前向扩展**保留：将来若登记一份保守、显式的 `PROJECTION_HINTS`（如 nav 精确路由匹配），命中者落候选 atom、`mapping` 加一条、该步不标 `route:human`。v1 该表**空/极小**，具体内容留待 grill。
- 承认现实：零 LLM 核不发明 atom——它做「投影 + 闸」，不做「发明」。真正的 atom 提议是 CLI 外 LLM 的活，经采集忠实闸 + `validateBridge` + 人签夹住（正如 `flow-bridge` 的 `mapping` 本就 LLM 在 CLI 外产）。
- **待 grill**：v1 是否要哪怕一条最保守的 nav 路由查表条目，还是干脆全 pending（本草案取全 pending，最诚实、金牌无须造脆弱路由匹配）。

## D9 采集忠实闸（distill 零 LLM L0 新闸，细化 DESIGN-DRAFT §4）[推荐待签核]

`validateCaptureFidelity({ mapping, projection, pending })` → `{ ok, problems }`，零 LLM、fail-closed、**闸自身绝不抛**（全域返回 `{ok,problems}`，镜像 `validateDraft`）。判据（**对 manifest 的 `projection` 溯源表判、不重算 `i+seq` 命名，避免命名双源**）：

- **引用完整（无凭空 atom）**：`∀ m ∈ mapping`，`m.intentId` 须 ∈ `projection` 的 intentId 集——不在即 `NO_CAPTURE_EVIDENCE`（LLM 提议了录制里没有的意图/atom，凭空幻觉，拒）。
- **覆盖完整（无漏译）**：`∀ p ∈ projection`，`p.intentId` 须被 `mapping` 覆盖 **或** ∈ 原始 `pending` 集——皆非即 `UNCOVERED_EVENT`（LLM 既没映射某 event 又没标 pending，漏译，拒）。

对象类比：`采集忠实闸 : capture events ≈ flow-bridge 投影忠实 : TestCase.steps`。它抓 `flow-bridge` 抓不到的缝——「LLM 读着录制却提议录制里没有的 atom」。两者分工：采集忠实闸绑 `mapping↔capture 溯源`，`validateBridge` 绑 `mapping↔候选 TestCase.steps` + `route:human` 一致性。LLM 若把 `pending` 意图升级为已映射，须**同时**改候选 `TestCase`（去 `route:human`）与 `mapping`（加条目）——这层跨文件一致性由 `validateBridge` 兜（route:human 又被 mapping 覆盖 = 矛盾），采集忠实闸不重复管。

## D10 pending 诚实桩 ↔ route:human [推荐待签核，新增]

投影不出可靠 atom 的意图步（v1 = 全部）在候选 `TestCase` 里标 `route:'human'` + 非空 `reason`（如「蒸馏零 LLM 投影不出可靠 atom：示教语料须 CLI 外 LLM 手术刀补 mapping，经采集忠实闸 + 人签入场 → route:human」）；候选 `mapping` 不覆盖它。这样：

- 候选对（候选 `TestCase` + 候选 `mapping`）**开箱即过 `validateBridge`**（route:human 是既有跳过通道），是一份**内部自洽、可直接重走链**的候选，而非半破产物。
- `pending[]`（manifest）≡ 候选 `TestCase` 里 `route:'human'` 步集，双记同一事实。
- CLI 外 LLM 的活 = 把能自动化的 `route:human` 步「升级」（去 route:human + 加 mapping），改完经 `parseTestCase`/`validateBridge`/采集忠实闸重新入场；升不动的保持 route:human 交人。
- fail-safe：证不出 → route:human 交人，**绝不臆造 atom**（护栏 #14）。人签门是「route:human 步在此用例是否可接受」的收口。
- **待 grill**：全步 route:human 的候选（v1 常态）是否可接受为「兜底基线」，还是要求投影至少产一条可自动化步才算有价值（本草案取「可接受——结构化骨架 + 精确 pending 工作单 + 溯源本身即价值」）。

## D11 候选降权硬不变量 [推荐待签核：降权载体澄清]

- **候选 `TestCase` 不能自我标记非权威**：`parse-testcase.mjs` 的 `source` 键闭合为 `{kind,raw,ingestedAt}`（`additionalProperties:false`），加 `signed:false` 类字段会被 `parseTestCase` 拒。且候选 `TestCase` 的**设计意图就是与普通 TestCase 无差**（这样才能重走 `ingest`）。故：
- 降权标记落在 **溯源 manifest**（`artifactKind:'distill-candidate'` + `captureSha256` + 「须重走全链 + 人签才算数」note）+ **文件名**（`distill-candidate-*` / `distill-manifest-*`）+ **负向不变量**（distill **绝不**产 `signed:true`/`replayReady:true`/`events.json`/`expected.frozen.json`/`loop/prd-*.json`）。候选 `mapping` 是裸数组（`flow-bridge` 形态），无处挂 `artifactKind`，其降权由 manifest 交叉引用兜。
- 权威**只**来自下游人签（护栏 #16）。金牌 C5 钉负向不变量 + manifest 正向标记。

## D12 溯源出账（沿用 DESIGN-DRAFT §3）

manifest 记 `captureSha256`（消费的字节哈希）+ `projection`（`[{intentId, eventSeq, action, pathHint}]` event→意图投影明细）+ `pending[]` + `generatedAt` + `artifactKind:'distill-candidate'`。血缘出账、**不塞进冻结 `TestCase` schema**。`pathHint` 用相对 path（capture 已 host 安全化，无裸 host）。

## D13 退出码（沿用 DESIGN-DRAFT §7.4 + 全仓先例）

`0` 成功 / `64` 用法错（缺参/裸旗标）/ `65` 门拒或闸拒（caseId 形状/凭据、布局/软链、TOCTOU 四类、parse 失败、reviewCapture 拒、采集忠实闸拒）/ `1` 前置凭据门命中 + 读写错（镜像 `ingest` 前置门 exit 1 + 落盘异常 errno 回显纪律）。

## D14 输出卫生（护栏 #7，沿用全仓 output-seal 纪律）

- 三候选文件 + manifest 落盘前逐一过 `credentialGate`，命中即 exit 1 零落盘（镜像 `ingest`）。
- 成功不回显用户 `--out-dir`/`--capture` 绝对路径，只报定名产物（`distill-*-<caseId>.json`）。
- 错误只回 errno 类别码 / reason 类别码，绝不回显路径与脏内容。
- 候选/manifest 全文无裸 `://`（源 capture 已剥净，候选派生自它 + 输出门复扫兜底）。

## D15 术语登记（造词先登记 CONTEXT，本契约先提议、实现契约落）

与 CONTEXT 既有 `示教`/`示教录制包`/`示教入账`/`示教入账台账` 一族对齐；英文走代码体/纯文本，加粗只给中文（ADR-0004）；首现附中文白话；中文标准简体。

- 示教蒸馏 / Teach-in Distillation：把已入账示教录制包的 events 零 LLM 确定性投影成候选流程（候选 `mapping` + 候选 `TestCase` 骨架 + `pending` 清单 + 溯源 manifest），重走 `ingest→compile→draft→sign→run`、绝不直通回放；蒸馏工具零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场。
- 蒸馏候选 / Distillation Candidate：distill 产的非权威候选物；降权标记落 manifest + 文件名 + 负向不变量，绝不 `signed`/`replayReady`，须重走全链 + 人签才算数。
- 采集忠实闸 / Capture-Fidelity Gate：distill 的零 LLM L0 闸，校候选 `mapping` 对 capture 溯源忠实（每 atom 有 event 证据、每 event 被覆盖或落 pending）；对位 `flow-bridge` 投影忠实（对象是 capture 溯源而非 `TestCase.steps`）。

## D16 涟漪勘定（先勘后动，零冻结 schema 涟漪）

- 不碰 `testcase.schema.json`（候选走既有 `json` 模态）、`failure-ledger-entry.schema.json`、任何相3/4/6 冻结件。
- 复用 `lib/record-intake.mjs` 现成导出（`reviewCapture` / `intakeLedgerPath`），**不改其行为、不动 `record-intake.golden`**（`verifyIntaken` 新增在 `record-distill.mjs`，不动 intake）。
- 复用 `lib/record-capture.mjs` 的 `ALLOWED_ACTIONS`（经 record-intake 已导入链）、`lib/cred-gate.mjs` 的 `credentialGate`。
- `casey.mjs` +1 case + help +1 行：不带 `--sut <url>`（避开 `handover-pack` C2 过时黑名单）；`cli-mcp-face` 只钉 MCP 12 工具集、distill 不接 MCP → 零涟漪；`handover-pack` C1 只查 README 八节锚、不逼命令全集同步。
- 只新增一个金牌 `record-distill.golden.mjs` + 一个 `loop/prd-record-distill.json`；无须重签任何既有 prd checksum。
- 结论：**零冻结涟漪、零重签**。

## D17 非目标

不改 `replay`/`verdict`/`report`/`ingest` 冻结内核；不碰 `testcase.schema.json`/`failure-ledger-entry.schema.json`；不接 MCP/skill（属后续易用性契约，需同时补真实可跑用例）；不自动接线 intake→distill；不复活 recorder-as-library（不从裸点击反解硬化原子）；不代替人签、不绕相2、不产任何正式回放产物。

## D18 异构评审（memory 铁律）

Claude 实现 → codex 异构评审（评审家族 ≠ 实现家族）；codex 标 review done 但 audit 写「非正式异构待补」不算数，Claude 补跑。

---

## Steven grill 签核（2026-07-09，7 项开放项全定案）

1. D3 `--out-dir`：**签核必带**（草案取）——不缺省，防写盘落点歧义。
2. D6 意图切分：**签核严格 1:1** event↔意图步（草案取）——使采集忠实闸 event↔intentId 对账结构可判。
3. D8 v1 投影：**Steven 明确签核「全 pending」**——v1 不产候选 atom、mapping=[]，因真机路由跨环境不稳（注册表 /ai-manager ≠ 录制 /heren）、无可靠静态查表，不臆造脆弱匹配；高置信查表作前向增量。
4. D10 全步 route:human 骨架：**签核可接受**（草案取）——v1 常态即诚实骨架兜底基线，重走 ingest→compile→draft→sign 由人补全。
5. D4 多 accept sha 语义：**签核「最新 accept 精确匹配」**（草案取）。
6. `--verify` 采集忠实闸：**Steven 明确签核「并入本契约」**——含 `validateCaptureFidelity` 纯函数 + 金牌 + `--verify` 子命令，L0 复核闸不留缺口。
7. 候选 `source.kind:'json'` 名义模态：**签核可接受**（草案取）——血缘由 manifest（`artifactKind:'distill-candidate'`）兜，不碰冻结 schema。

## 护栏对账

- 裁判零 LLM（#15）：distill 全在相3/4 上游，LLM 从不进 `verdict.mjs`；产物只经人签冻结 spec/expected 正规路入下游。守。
- fail-safe 不 fail-open（#14）：证不出 → pending/route:human；TOCTOU/重跑复核/采集忠实失配 → fail-closed exit 65；catch-all 默认落 pending 交人。守。
- 冻结测试只读 / Test Ratchet（#1/#5）：不改任何冻结 schema、不重签 checksum、不动既有金牌；只加 `record-distill.golden`。守。
- 凭据不进输出（#7）：候选/manifest 全过 `credentialGate`；重跑 `reviewCapture` 复扫；output-seal 不回显绝对路径、错误只回类别码。守。
- 阶段互锁（#11）：实现契约走 contract init → plan → 冻结红金牌 → gate → 人签；本文档不触发任何实现动作。守。
- 统一语言（#4/#12）：新词先登记 CONTEXT，英文不加粗、走代码体，简体，首现附白话。守。
- 异构评审（#9/#10、memory）：Claude 实现 → codex 异构评审；「非正式待补」不算数、Claude 补跑。守。

— 完（契约包草案，待 Steven grill 签核）—
