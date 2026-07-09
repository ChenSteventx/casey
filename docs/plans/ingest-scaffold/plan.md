# ingest-scaffold — plan（full）

相0 前段脚手架：新增 `casey scaffold-case`，把一段自由文本用例零 LLM 包成 schema 合规的候选骨架（`source.kind:'freetext'` + `source.raw` 泊原文 + 一条 `route:human` 占位步），开箱过 `parseTestCase`，再配一份归一提示模板 + `skill` 指针，供 CLI 外 LLM 把 `source.raw` 归一成真实候选后经 `ingest` 重新入场。解易用性审计摩擦 F3（前半段把重活甩给代理手搓 JSON 且无脚手架）。决策见 `docs/plans/ingest-scaffold/proposed/GRILL.md`（D1–D15）。与 `record-distill` 是同一 相0 归一闸的两个上游喂料段——distill 从 `示教录制包` 来（有 events 可 1:1 投影），本脚手架从自由文本来（无 events、只能包+骨架），边界见 GRILL D1。

## 0. 涟漪勘定（先勘后动，本契约零冻结 schema 涟漪）

- 不碰 `tests/_golden/schemas/testcase.schema.json`（骨架走既有 `source.kind:'freetext'` 模态、既有键集）、`lib/parse-testcase.mjs`（只**复用** `parseTestCase`，不改行为、不动 `tests/_golden/ingest.golden.mjs` 与 `loop/prd-ingest.json`）、`failure-ledger-entry.schema.json`、任何相2/3/4/6 冻结件。
- 复用 `lib/parse-testcase.mjs` 的 `parseTestCase`（green-by-construction 自检，单一事实源）、`lib/cred-gate.mjs` 的 `credentialGate`。
- `bin/casey.mjs` +1 switch case（`scaffold-case`，镜像 `ingest`/`intake` 分发先例）+ help +1 行（不带 `--sut <url>`，避开 `handover-pack` C2 过时黑名单；`cli-mcp-face` 只钉 MCP 12 工具集、`scaffold-case` 不接 MCP → 零涟漪；`handover-pack` C1 只查 README 八节锚 → 不逼命令全集同步）。
- 只新增一个金牌 `tests/_golden/ingest-scaffold.golden.mjs` + 一个 `loop/prd-ingest-scaffold.json`；无须重签任何既有 prd 的 checksum。
- 结论：零冻结涟漪、零重签。

## 1. 术语登记（CONTEXT.md，造词先登记；四列制补登记，与 归一/`TestCase` 一族对齐）

- 归一脚手架 / Normalization Scaffold：相0 归一的前段脚手架——把一段自由文本用例零 LLM 包成 schema 合规的候选骨架 + 归一提示模板，供 CLI 外 LLM 归一成真实候选后经 `parseTestCase` 重新入场；脚手架零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场。
- 候选骨架 / Candidate Skeleton：`casey scaffold-case` 产的非权威候选物；开箱过 `parseTestCase`（全 `route:human` 兜底基线），降权标记落文件名 + 落地提示 + 负向不变量，绝不 `signed`/`replayReady`，须 LLM 归一 + 重走全链 + 人签才算数。
- 归一提示模板 / Normalization Prompt Template：指导 CLI 外 LLM 把 `source.raw` 自由文本归一成真实候选 `TestCase` 的提示 + schema 约束（镜像 `llm-patch.draft.md` 相2 补缝模板范式）；产物必过 `parseTestCase`，违规 fail-closed 退回；语义质量 `route:human` 抽检。

登记纪律：英文走代码体/纯文本、加粗只给中文（ADR-0004）；首现附中文白话；中文标准简体；显式区分于 `蒸馏候选`（喂料源是 `示教录制包` 而非自由文本，GRILL D1）。

## 2. 纯函数层 `lib/ingest-scaffold.mjs`（零 I/O、零 LLM、可测、字节稳定可复现）

I/O（读自由文本、算凭据门、落盘）留 CLI 层；纯函数只吃已读入的字符串。

- `buildCandidateSkeleton(freeText, { caseId })` → 候选骨架对象（零 LLM 确定性，同输入产同字节，进金牌真值）：
  - 形态严守 `parseTestCase` 契约：`{ schemaVersion:1, caseId, source:{ kind:'freetext', raw:freeText }, steps:[ 一条占位步 ], uniquePrefix:'atl_' }`。
  - **不臆断切分**（GRILL D6）：零 LLM 不把自由文本按行/句切成 N 步（切分是语义活 = LLM territory，镜像 distill D6）；只发**一条** `route:human` 占位步：`{ intentId:'i1', intent:'<占位：待 CLI 外 LLM 从 source.raw 归一真实意图步>', route:'human', reason:'归一脚手架骨架占位：自由文本须 CLI 外 LLM 归一成真实意图步（actionHint/inputValue/expected），经 parseTestCase 重新入场 → route:human' }`。
  - `source.raw` 泊自由文本原文逐字（设计 §2 溯源，沿用 ingest D6 存 raw）；`source.raw` 不剥 URL（合法 authoring 内容、非 `site.json` 目标地址，GRILL D7）。
  - **不含 `expected`**（断言归相2）、**不含 `target`**（不臆造 `startUrl`）；`source` 键闭合 `{kind,raw}`（不加 `signed` 类字段，否则被 `parseTestCase` 拒，GRILL D10）。
  - `ingestedAt` 不在纯函数落章（缺席时由 CLI 层落章，或保持缺省交 `ingest` 落——确定性可复现由此保：纯函数产物不含时刻字段，金牌可字节确定）。

## 3. CLI 层 `bin/scaffold-case.mjs`（薄壳，fail-closed 前置，退出码 GRILL D11）

- 用法：`node bin/casey.mjs scaffold-case <caseId> --from-text <text-file> --out-dir <d>`。
- `caseId` 缺 → exit 64；形状违规（非 `^[A-Za-z0-9_-]+$`、穿越/斜杠）→ exit 65；命中凭据门 → exit 65（镜像 `ingest.mjs` `caseId` 闸；原值不回显）。
- `--from-text`/`--out-dir` 缺或裸旗标（无值被解析成 `true`）→ exit 64（镜像 `ingest`「旗标须带值」）。
- 读 `raw = readFileSync(fromTextPath,'utf8')`（失败 → errno 回显、路径不回显、exit 65，镜像 `ingest.mjs:32`）。
- **前置凭据门**（GRILL D7，护栏 #7）：`credentialGate({ '输入自由文本': raw })` 命中 → exit 1 **零骨架落盘、零目录副作用**（自由文本是头号凭据粘贴向量，早于任何回显与 `mkdir`，镜像 `ingest.mjs:35`）。
- `skeleton = buildCandidateSkeleton(raw, { caseId })`。
- **green-by-construction 自检**（GRILL D8，纵深）：`parseTestCase(skeleton, { caseId })` 若竟 `ok:false`（骨架 bug）→ fail-closed exit 65（骨架自违契约，绝不落半份）。
- 序列化 → **输出侧凭据门**（防御纵深，命中 exit 1 零落盘，镜像 `ingest.mjs:55`）→ `mkdir <out-dir>`（通过后才建，拒时零目录副作用）→ 写 `<out-dir>/scaffold-candidate-<caseId>.json`（落盘异常 → errno 回显、路径不回显、exit 65）。
- 成功不回显 `--from-text`/`--out-dir` 绝对路径（output-seal），只报定名产物 `scaffold-candidate-<caseId>.json` + 落地提示：「候选非权威，须 CLI 外 LLM 按归一提示模板把 source.raw 归一成真实意图步 → 经 casey ingest 重新入场 → 重走全链 + 人签才算数」。

## 4. casey 门面 `bin/casey.mjs`

- `main()` switch 加 `case 'scaffold-case': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'scaffold-case.mjs'), rest); process.exit(r.code); }`（镜像 `ingest`/`intake` 先例）。
- `help()` 生命周期分步段在 `ingest` 行之前加一行（相0 前段，不带 `--sut <url>`，避开 `handover-pack` C2 黑名单）：
  `casey scaffold-case <caseId> --from-text <f> --out-dir <d>  相0 前段脚手架：自由文本 → 候选骨架（source.kind:freetext + route:human 占位；开箱过 parseTestCase；须 CLI 外 LLM 归一 + 重走 ingest→…→人签；不签署/不回放/门拒 fail-closed）`。

## 4.5 归一提示模板 + skill 指针（docs 交付，解 F3「没把 prompt 模板指出来」）

- `docs/plans/ingest-scaffold/proposed/from-text-candidate.draft.md`（本契约实现期落，形见 GRILL D9）：镜像 `docs/plans/p4-drafter/proposed/llm-patch.draft.md` 范式——角色边界（把自由文本 + 候选骨架归一成真实候选 `TestCase`）+ 硬约束 inline（`schemaVersion:1`/`source.kind:'freetext'`/`source` 键闭合/`intentId` 全局唯一/`actionHint` 枚举/`uniquePrefix` `^\S+$`/`route:human ⟹ reason`/易变字面量模板化）+ 产出后处理（过 `casey ingest` 的 `parseTestCase`，违规逐条退回）+ 语义质量 `route:human` 抽检声明。
- `.claude/skills/casey/SKILL.md`（纯文档）：
  - 「内部动作表」补一行——「把一段自由文本用例变成候选骨架 / 我要从头写个用例」→ 代理内部跑 `scaffold-case` 产骨架，再按归一提示模板归一 `source.raw`，经 `ingest` 入场；如实说明「候选须 LLM 归一 + 人签才算数、不是正式报告」。
  - 「底层命令映射」补 `scaffold-case` 真实签名一行，并把 `from-text-candidate.draft.md` 指出来（消除盲写 JSON）。
- 纪律：`skill` 只改文档（direct-lane 性质），是 full-lane CLI 的配套；用户操作面只收自然语言，不把多旗标命令抛给用户。

## 5. 验收（红先行：先写金牌红基线并验红，再实现，再 gate）

金牌 `tests/_golden/ingest-scaffold.golden.mjs`，逐条断言 C1–C8 见 `docs/plans/ingest-scaffold/proposed/GOLDEN-TESTPLAN.md`。红先行纪律：实现前 `bin/scaffold-case.mjs` 不存在、`casey.mjs` 无 `scaffold-case` 分发、help 无 `casey scaffold-case` 即红。

反夹具纪律（memory「别倒着裁夹具、复现已冻接缝」）：happy 路径**复现真接缝**——真写一段自由文本 → 真 `casey scaffold-case` 产骨架 → 真 `casey ingest` 收下骨架（复现 相0 前段→相0 归一闸的真贯通）；**绝不**手造一个「预定裁定」的候选去迎合断言。mock LLM 候选 = 内联夹具（表示 CLI 外 LLM 编辑骨架后的产物：补真实自动化步、去 `route:human`），**绝不烧真 LLM**（镜像 ingest D1 内联候选夹具先例）。

**核心 hermetic 验收链**（审计 C9 验收点「脚手架 + 各闸 hermetic 可测；产出能过 `testcase.schema.json`」）：

> 自由文本 ─`scaffold-case`→ 候选骨架 ─`ingest`（`parseTestCase` 闸）→ 合规 `TestCase`（`testcase-<caseId>.json`）
> 并：mock LLM 归一后的候选 ─`ingest`（`parseTestCase` 闸）→ 合规 `TestCase`

`loop/prd-ingest-scaffold.json`：`testChecksums` 冻结金牌 sha256（`gate.mjs` 唯一写 `passes`）；observability 挂账（route:machine/human）见 §7。

**验收**（gate 判据）：

- `node tests/_golden/ingest-scaffold.golden.mjs` exit 0（C1–C8 全过）。
- `node bin/casey.mjs selftest --tier1` 无回归（新增 `scaffold-case` 门面不破确定性内核与统一语言自检）。
- `node loop-kit/bin/gate.mjs --prd loop/prd-ingest-scaffold.json` 全 acceptance exit 0（gate 写 `passes:true`）。

## 6. route:human（非阻断真机趟合并项，非本契约 hermetic 验收）

真机走一遍 `自由文本 → scaffold-case → 候选骨架 → CLI 外 LLM 归一 → ingest → flow-bridge → compile（--execute 打真机）→ draft → 人签 → replay → verdict → report`，确认全新用例第一份报告真通。注意 相1 `compile --execute` 必打真机（隧道 + 凭据），故任何全新用例的端到端真通固定 route:human（审计 F4/C9 尾巴，排最后）。属真机 UAT，不在本契约 hermetic 收口。

## 7. observability 挂账（prd，route 标注）

- route:human —— §6 真机全链趟合并项（全新用例端到端真通须真机 compile）。
- route:machine —— v1 脚手架零 LLM 只发**单条** `route:human` 占位步（GRILL D6 不臆断切分）：自由文本→N 意图步的语义切分是 CLI 外 LLM 的活，脚手架不臆造；将来若登记保守确定性预切分（如按显式编号行），另开红先行金牌补，不在本契约造脆弱切分。
- route:machine —— 候选骨架形态未冻 JSON schema（仅金牌断言字段锁漂移，且走既有 `testcase.schema.json` 校验）：本契约按局部候选处理、不预冻新 schema（沿用 record-intake 台账 / distill 候选未预冻先例）。
- route:machine —— 归一提示模板的语义质量（切得对不对、`actionHint` 选得准不准）不可 hermetic 测，是 `route:human` 抽检（镜像 `llm-patch.draft.md`）。

## 8. 非目标（本契约不做，见 GRILL D2/D15）

不做 `init-profile`（审计 F5，属 相3 `通道剖面`，另议）；不产 mapping（相1 `flow-bridge` 事，不涉 16-atom 允许集）；不重造相2 补缝模板（已有 `llm-patch.draft.md`）；不真机 compile / 不碰 tier2 route:human 尾巴；不代替人审（人签门归人）；不烧真 LLM；不改 `ingest`/`flow-bridge`/`sign`/`compile`/`replay`/`verdict`/`report` 冻结内核；不碰 `testcase.schema.json`/`parse-testcase.mjs`；不扩断言词表（相2 事）；不接 MCP/skill 实现层改动（`skill` 只补文档指针，MCP 面属后续易用性契约）。

## 9. 待 Steven grill 敲定（收敛清单，见 GRILL「开放项」）

C9 拆分（F3 本契约 / F5 另议）/ 子命令命名（`scaffold-case` vs `new-case` vs `ingest --from-text`）/ 脚手架形态（CLI + 模板 + skill 指针全套 vs 纯文档）/ 单占位步骨架兜底可接受性 / `source.raw` 泊原文含 URL vs 剥净 / 与 record-distill 交叉引用 / 归一提示模板并入本契约 vs 后续。
