# ingest-scaffold — grill 决策记录（相0 前段脚手架，full）

> 状态：契约包草案，未 grill 签核、未 `contract init`、未实现。本文只做决策，不碰 `lib`/`bin`/`web`/`mcp`、不动冻结 schema、不写 prd、不提交。
> 来源：用户易用性审计 `docs/plans/usability-audit/proposed/AUDIT-PLAN.md` 的 C9（解摩擦 F3「前半段把重活甩给代理手搓 JSON 且无脚手架」）。本契约只取 C9 的 相0 前段：把「一段自由文本用例 → 能喂流水线的候选 `TestCase`」这段变顺；C9 里的 F5 `init-profile` 属 相3 通道剖面，另议（见 D2）。
> 依据：`docs/design/txt2testreport-design.md` §1（五层 LLM 准入边界）/§2（`TestCase` 聚合根）、`CONTEXT.md`（`归一`/`TestCase`/`intentId`/五层）、`docs/adr/0003`（编译再回放：LLM 只编译期读一次）、`docs/adr/0006`、护栏 #7/#14/#15/#16。
> 姊妹先例：`ingest`（相0 归一薄 CLI，`docs/plans/ingest/proposed/GRILL.md` D1–D7 已签）、`record-distill`（示教兜底第三契约，`docs/plans/record-distill/proposed/GRILL.md` D1–D18；本契约与它是同一 相0 归一闸的两个上游喂料段，边界见 D1）、`llm-patch.draft.md`（相2 补缝 prompt 模板范式）。

## 背景与领域定位

相0 `ingest` 吃的是**已成形**的候选 `TestCase`（`source.kind ∈ {excel,json,txt,freetext}`）：LLM 在 CLI 外把杂乱原文归一成候选 JSON，`bin/ingest.mjs` 只做「读候选 → `parseTestCase` 确定性校验 → 落规范 `TestCase`」（零 LLM、L0 校验器，不产内容）。但「**一段自由文本 → 规范候选 `TestCase`**」这最前一段，现状仍要人/LLM 在 CLI 外完全手搓：无脚手架、无被指出的 prompt 模板，`parseTestCase` 全是 fail-closed `exit 65`，代理产 JSON 近乎盲写、过闸失败率高、回给它的是一句冷拒绝（审计 F3）。

本契约给这段配一个**零 LLM 的前段脚手架**：把自由文本零 LLM 包成一份 schema 合规的**候选骨架**（`source.kind:'freetext'` + `source.raw` 泊原文 + 一条 `route:human` 占位步），开箱即过 `parseTestCase`，再配一份**归一提示模板**（指明如何把 `source.raw` 归一成真实意图步）。自由文本的真正归一（切分意图、填 `actionHint`/`inputValue`/`expected`）仍是 CLI 外 LLM 的活，改完经 `parseTestCase` 重新入场——与全仓「每个 `lib`/`bin` 零 LLM，LLM 手术刀只在 CLI 外经确定性闸入场」不变量严丝合缝（设计 §1 五层：L0 内核零 LLM / L1 归一 = LLM 提案、`parseTestCase` fail-closed 校验）。

---

## D1 与 record-distill 的边界（喂料源不同，脚手架更薄）[推荐待签核]

`ingest-scaffold` 与 `record-distill` 是**同一 相0 归一闸的两个上游喂料段**，边界按**喂料源**划清，绝不重叠：

| | `record-distill` | `ingest-scaffold`（本契约） |
|---|---|---|
| 喂料源 | 已入账 `示教录制包`（真 events，带 action/path） | 一段**自由文本**（无 events、无结构） |
| 确定性核能做什么 | events **1:1 投影**成候选步（`click→click` 等忠实 `actionHint`）+ 溯源 | 只能**包+骨架**：泊 `source.raw`、发一条占位步——**无 event 可投影**，切分意图是语义活（LLM territory） |
| 新增 L0 闸 | 采集忠实闸（`mapping ↔ capture` 溯源） | **无新闸**——`source.raw` 逐字泊，忠实性平凡（`raw===输入`），`parseTestCase` 是唯一准入 |
| 溯源锚 | `captureSha256` + 入账台账 | `source.raw` + `source.kind:'freetext'` |

- 关键：自由文本**无 events 可投影**，故本脚手架的确定性核比 distill 更薄——它做「包 + 骨架 + 提示指引」，**不做投影**（distill 有 event 结构可 1:1 投影，本契约没有）。承认现实：零 LLM 核不发明意图步，切分/归一是 CLI 外 LLM 的活（正如 distill 的高层意图合并、`flow-bridge` 的 `mapping` 本就 CLI 外产）。
- 两者共享的内核完全一致：零 LLM 工具、LLM 只 CLI 外经闸、`route:human` 诚实桩、候选重走 `ingest→…→sign`、权威只来自人签。
- **待 grill**：是否要在本契约与 record-distill 之间加一条交叉引用注（两段喂同一 `ingest` 闸），还是各自独立即可（本草案取各自独立、边界表在此备案）。

## D2 范围 + 非目标（相0 前段 free-text→候选 TestCase）[承重·待签]

- **范围**：只建「一段自由文本 → 零 LLM 候选骨架（`source.kind:'freetext'`）→ 经 `parseTestCase` → 合规候选 `TestCase`」的前段脚手架（CLI 骨架发射器 + 归一提示模板 + `skill` 指针）。自由文本的语义归一（意图切分、`actionHint`/`inputValue`/`expected`）**一律 LLM 在 CLI 外**做，经 `parseTestCase` 重新入场。
- **carve out（本契约不做、另议）**：
  - `init-profile`（审计 F5）——属 相3 `通道剖面`（背景 denylist + 错误信封成功字段），是**另一相、另一闸**（非 `parseTestCase`），与 相0 前段无内聚，另开契约或另 § 处理。
  - `flow-bridge` mapping 脚手架（相1，碰 16-atom `COMPILE_KNOWN_ATOMS` 允许集）——本契约只产 相0 候选 `TestCase`（不含 atom），**不产 mapping**；故审计 C9 验收点里的「16-atom 允许集」在本契约**天然不涉**（候选的 `route:human` 占位步不带 atom）。若将来把脚手架延到也种候选 mapping（如 distill 那样），那才engage 16-atom 集，留 route:machine 挂账。
  - 相2 补缝模板——已有 `docs/plans/p4-drafter/proposed/llm-patch.draft.md`，不重造；本契约的归一提示模板只管 相0（free-text→候选 `TestCase`），与它是 prompt 模板同族、各管一相。
- **非目标**：不真机 compile / 不碰 tier2 route:human 尾巴；不代替人审（人签门归人）；不烧真 LLM；不建/改 `ingest`/`flow-bridge`/`sign`/`compile`（已建）；不改冻结 `testcase.schema.json` 与 `parseTestCase`/`verdict.mjs`/`gate.mjs` 内核；不扩断言词表（相2 事）；不接 MCP（属后续易用性契约，见 D13）。
- **承重点**：C9 原文把 F3（前段脚手架）与 F5（`init-profile`）捆在一条。本草案**拆开**：只做 F3 的 相0 前段，F5 另议。请 Steven 拍是否可拆（倾向拆：两者不同相、不同闸、不内聚，捆一起会让契约臃肿且跨相涟漪）。

## D3 车道：full（沿用审计 C9 判据）

碰 相0 前段与 LLM 边界、新增用户可见 CLI（新 bin + `casey.mjs` 分发 + help）、涉凭据前置门与输出卫生。先写金牌红基线并验红，再实现，再 gate。命令化层 hermetic 可验（脚手架只读自由文本 + 零 LLM 包骨架，不涉真机、不烧 LLM）。真机 compile 端到端属 route:human 尾巴（见 plan §6）。

## D4 脚手架形态：新子命令骨架发射器 + 归一提示模板 + skill 指针 [承重·待签：命名]

三件互补交付，都 hermetic 可验：

1. **CLI 骨架发射器（新子命令，零 LLM）**：`node bin/casey.mjs scaffold-case <caseId> --from-text <text-file> --out-dir <d>`。读一段自由文本（文件），零 LLM 包成一份 schema 合规的候选骨架（D6），开箱过 `parseTestCase`，落 `<out-dir>/scaffold-candidate-<caseId>.json`。
2. **归一提示模板（docs）**：`docs/plans/ingest-scaffold/proposed/from-text-candidate.draft.md`（由实现契约落，本 grill 只定其形，见 D9），镜像 `llm-patch.draft.md` 范式，把 `parseTestCase` 的字段/enum 约束 inline，指明 CLI 外 LLM 怎么把 `source.raw` 归一成真实意图步；产物必过 `parseTestCase`，违规 fail-closed 退回。
3. **skill 指针（docs，纯文档）**：`SKILL.md` 「底层命令映射」补 `scaffold-case` 一行 + 动作表补「把一段自由文本用例变成候选骨架」一行，并把归一提示模板指出来——解 F3「没把可用的 prompt 模板指出来」。

- **为何新子命令而非 `ingest --from-text`**（审计原措辞）：`ingest` 有自己冻结的金牌 `tests/_golden/ingest.golden.mjs` + `loop/prd-ingest.json`，给它加 `--from-text` 模态会碰它的冻结面（Test Ratchet #1）；新子命令 = 新 bin + 新金牌 + `casey.mjs` +1 分发，**零涟漪** to 冻结 `ingest`（镜像 `distill` D16「新 bin、不改既有」先例）。
- **为何 CLI 骨架发射器值得建（非纯文档）**：解 F3 三痛点——① 盲写 JSON（骨架给个 schema 合规的起点，改而非从零写，消除冷拒绝首触）；② `source.raw` 泊原文是机械活（CLI 零 LLM 做，不靠 LLM 手滑）；③ 前置凭据门（自由文本是**头号凭据粘贴向量**，见 D7）。
- **否决面**：纯文档形（只出提示模板 + skill 指针、无 CLI）更轻（车道降到 light/direct），但拿不到「凭据前置门过的 green 骨架基线」这个可重走产物；本草案取「CLI + 提示模板 + skill 指针」全套。
- **承重点/待 grill**：子命令命名 `scaffold-case` vs `new-case` vs `init-case` vs `ingest --from-text`（本草案取 `scaffold-case`，零涟漪且语义清）；请 Steven 拍。

## D5 候选 source.kind = freetext（诚实模态，零 schema 涟漪）

- 骨架标 `source.kind:'freetext'`——字面属实（喂料就是一段自由文本），且 `'freetext'` 是**既有 enum 值**（`testcase.schema.json` 已收），**零冻结 schema 涟漪、零重签**。
- 对照 distill D5 取 `source.kind:'json'`（它的候选是机器产的 JSON 文档）——本契约喂料是自由文本，取 `'freetext'` 才诚实。两者都靠既有 enum 值走既有模态，都不碰冻结 schema。

## D6 候选骨架形态：零 LLM 不臆断切分，一条 route:human 占位步 [推荐待签核]

`buildCandidateSkeleton(freeText, { caseId })`（纯函数，零 LLM，字节稳定可复现）产：

```jsonc
{
  "schemaVersion": 1,
  "caseId": "<入参>",
  "source": { "kind": "freetext", "raw": "<自由文本原文，逐字>" },
  "steps": [
    { "intentId": "i1",
      "intent": "<占位：待 CLI 外 LLM 从 source.raw 归一真实意图步>",
      "route": "human",
      "reason": "归一脚手架骨架占位：自由文本须 CLI 外 LLM 归一成真实意图步（actionHint/inputValue/expected），经 parseTestCase 重新入场 → route:human" }
  ],
  "uniquePrefix": "atl_"
}
```

- **不臆断切分**：零 LLM 不把自由文本按行/句切成 N 步——切分意图是语义判断（LLM territory），镜像 distill D6「零 LLM 投影不臆断分组」。故只发**一条** `route:human` 占位步（`intentId:'i1'`），整段自由文本泊 `source.raw`。CLI 外 LLM 读 `source.raw` 产真实 N 步。
- **开箱过 `parseTestCase`（green 基线）**：`route:human` + 非空 `reason` 是 `parseTestCase`/`validateBridge` 既有合法跳过通道，故骨架**开箱即过闸**、可直接重走 `ingest→flow-bridge`（route:human 步下游按跳过处理）。这是「全 route:human 兜底基线」（镜像 distill D10），不是半破产物。
- **严守 `parseTestCase` 契约**：`source` 键闭合为 `{kind,raw,ingestedAt}`（`additionalProperties:false`），骨架**不含 `expected`**（断言归相2）、**不含 `target`**（不臆造 `startUrl`）、`uniquePrefix:'atl_'`（破坏性前缀硬闸，`^\S+$`）。
- **待 grill**：全步 `route:human` 的骨架（v1 常态、单占位步）作兜底基线是否可接受（本草案取可接受——schema 合规起点 + `source.raw` 泊原文 + 提示指引本身即价值），还是要求脚手架至少发 N 条空占位步（否决：N 需切分判断 = 臆断）。

## D7 前置凭据门 + source.raw 处置（护栏 #7）[承重·待签]

- **前置凭据门**：自由文本是**头号凭据粘贴向量**（`bin/ingest.mjs` 注释即言「自由文本最可能贴凭据，相0 是凭据入口第一道闸」）。脚手架**读入自由文本后、包骨架前**先过 `credentialGate({ '输入自由文本': raw })`，命中即 `exit 1` **零骨架落盘、零目录副作用**（镜像 `ingest` 前置门，早于任何回显与 `mkdir`）。落盘前再过一道输出侧凭据门（防御纵深）。纵深说明：`ingest` 消费候选时也前置凭据门，故凭据防线是**双道**（脚手架侧 + ingest 侧）。
- **source.raw 处置**：缺省**泊原文进 `source.raw`**（设计 §2 溯源，沿用 ingest D6 已签「存 raw」）——前置门已硬保证「含凭据的原文根本进不来」（命中整份拒 `exit 1`），存下的必是干净原文。
- **URL 处置边界（与 distill 的区别）**：distill 的 capture 已 host 安全化（`projectUrlSafe` 剥净），候选无裸 `://`；本脚手架的 `source.raw` 泊的是**用户 authoring 输入的自由文本**，其中的 URL 是**合法 authoring 内容**（用户写「打开 https://... 页面」），**不是 `site.json` 目标地址**（护栏 #7 边界是「`.auth`/`site.json` 内容不进输出」，非「任何 URL」）。故 `source.raw` **不剥 URL**（剥了会毁溯源与语义），只由凭据门拦凭据**值**。金牌 C7 据此**不**对 `source.raw` 断言无 `://`（这是与 distill C6a 的显式差异，见 GOLDEN-TESTPLAN）。
- **承重点**：`source.raw` 泊原文（含可能的 URL）vs 更保守剥净。倾向泊原文（溯源价值 + 前置门兜凭据 + URL 非 site.json 目标地址）；请 Steven 拍。

## D8 脚手架不新造闸，parseTestCase 是唯一准入 + green-by-construction 自检

- 脚手架**不新增任何 L0 闸**（对照 distill 建了采集忠实闸）——因 `source.raw` 逐字泊，忠实性平凡（`raw===输入`），无 event↔atom 溯源要对账。相0 归一的既有 `parseTestCase` 是唯一准入闸。
- **green-by-construction 自检**：CLI 落盘前对自己产的骨架**自跑 `parseTestCase`**（零 LLM，纵深）；若竟不过（骨架 bug）→ fail-closed `exit 65` 拒落盘。这把「脚手架产的候选必过 `parseTestCase`」变成运行期不变量、不只金牌指望。
- 畸形候选的 fail-closed 归 `ingest`/`parseTestCase` 既有职责：CLI 外 LLM 若把骨架改坏（缺 `uniquePrefix`/`intentId` 重复/`route:human` 缺 `reason`/未知 `source.kind`），`ingest` 照旧 `exit 65` 零落盘。脚手架**绝不**在 `parseTestCase` 之外另开旁路（金牌 C5 钉「不 create bypass」）。

## D9 归一提示模板（相0 版，镜像 llm-patch.draft.md）[推荐待签核]

`from-text-candidate.draft.md`（实现契约落，本 grill 定其形）：

- 角色边界：把一段自由文本 + 脚手架产的候选骨架，归一成真实候选 `TestCase`——填真实意图步（切分意图、`intentId` 全局唯一、`actionHint ∈ {click,fill,select,send,navigate,assert}`、`inputValue` 易变值模板化 `{{uniqueName}}`、`expected` 用断言词表 kind），把能自动化的步从 `route:human` 升级（去 `route:human` + 补 `actionHint`），升不动的保持 `route:human` + `reason`。
- 硬约束 inline（违反即被 `parseTestCase` 拒、fail-closed）：`schemaVersion:1`、`source.kind:'freetext'`、`source` 键闭合、`steps` `minItems:1`、`intentId` 全局唯一、`uniquePrefix` `^\S+$`、`route:human ⟹ reason`、易变字面量纪律（`atl_<ts>`/uuid/时间戳绝不冻字面量）。
- 产出后处理（零 LLM）：过 `parseTestCase`（`casey ingest`），违规逐条 problems 退回让 LLM 重出（有界次数），再违规 → 保持 `route:human` 交人。
- 语义质量（切得对不对、`actionHint` 选得准不准）是 `route:human` 抽检，不在 hermetic（镜像 llm-patch.draft.md「语义质量 route:human 抽检」）。

## D10 候选降权硬不变量（权威只来自人签，护栏 #16）[推荐待签核]

- 候选 `TestCase` **不能自我标记非权威**：`source` 键闭合（`{kind,raw,ingestedAt}`），加 `signed:false` 类字段会被 `parseTestCase` 拒；且候选**设计意图就是与普通 `TestCase` 无差**（才能重走 `ingest`）。故降权标记落**文件名**（`scaffold-candidate-<caseId>.json`）+ **落地提示**（stdout 输出「候选非权威、须 LLM 归一 + 重走全链 + 人签才算数」的 authoring 提示）+ **负向不变量**（脚手架**绝不**产 `signed:true`/`replayReady:true`/`events.json`/`expected.frozen.json`/`loop/prd-*.json`）。
- 权威**只**来自下游人签（护栏 #16）。镜像 distill D11。金牌 C6 钉负向不变量。

## D11 退出码（沿用 ingest / 全仓先例）

`0` 成功 / `64` 用法错（缺 `caseId`/`--from-text`/`--out-dir`；裸旗标无值）/ `65` 输入坏·闸拒（`caseId` 形状违规穿越/斜杠/非 `^[A-Za-z0-9_-]+$`、`caseId` 命中凭据门、读自由文本失败 errno、green-by-construction 自检竟不过、落盘失败 errno）/ `1` 前置凭据门命中（自由文本含凭据）。任一闸拒**零落盘**（半份候选比没有更危险）、通过后才 `mkdir`（拒时零目录副作用，同 `ingest`）。

## D12 输出卫生（护栏 #7，沿用全仓 output-seal 纪律）

- 骨架落盘前过 `credentialGate`，命中即 `exit 1` 零落盘（镜像 `ingest`）。
- 成功不回显用户 `--from-text`/`--out-dir` 绝对路径，只报定名产物（`scaffold-candidate-<caseId>.json`）+ 「候选非权威、须 LLM 归一 + 重走链 + 人签」提示。
- 错误只回 errno 类别码 / 类别原因，绝不回显路径与脏内容（`caseId` 原值、凭据值、自由文本全文皆不回显；`caseId` 已过 `^[A-Za-z0-9_-]+$` 闸才进产物名）。
- 与 distill C6a 的差异：`source.raw` 保留自由文本里的 URL（合法 authoring 内容，非 site.json 目标地址，D7），故**不**对候选文件断言无裸 `://`；凭据**值**由凭据门拦（金牌 C7）。

## D13 涟漪勘定（先勘后动，零冻结 schema 涟漪）

- 不碰 `tests/_golden/schemas/testcase.schema.json`（骨架走既有 `source.kind:'freetext'` 模态、既有键集）、`parse-testcase.mjs`（只**复用** `parseTestCase`，不改）、`failure-ledger-entry.schema.json`、任何相2/3/4/6 冻结件。
- 复用 `lib/parse-testcase.mjs` 的 `parseTestCase`（green-by-construction 自检）、`lib/cred-gate.mjs` 的 `credentialGate`。
- 新增：`lib/ingest-scaffold.mjs`（纯函数 `buildCandidateSkeleton`，零 I/O 零 LLM）+ `bin/scaffold-case.mjs`（薄壳）+ `bin/casey.mjs` +1 switch case（镜像 `ingest`/`intake` 先例）+ help +1 行（不带 `--sut <url>`，避开 `handover-pack` C2 过时黑名单）。
- `cli-mcp-face.golden.mjs` 只钉死 MCP 12 工具集、`scaffold-case` **不接 MCP** → 零涟漪；`handover-pack` C1 只查 README 八节锚、不逼命令全集同步。
- 只新增一个金牌 `tests/_golden/ingest-scaffold.golden.mjs` + 一个 `loop/prd-ingest-scaffold.json`；无须重签任何既有 prd 的 checksum。
- 结论：**零冻结涟漪、零重签**。

## D14 术语登记（造词先登记 CONTEXT，本契约先提议、实现契约落）

与 CONTEXT 既有 `归一`/`TestCase`/`intentId` 一族对齐；英文走代码体/纯文本，加粗只给中文（ADR-0004）；首现附中文白话；中文标准简体。

- 归一脚手架 / Normalization Scaffold：相0 归一的前段脚手架——把一段自由文本用例零 LLM 包成 schema 合规的候选骨架（`source.kind:'freetext'` + `source.raw` 泊原文 + `route:human` 占位步）+ 归一提示模板，供 CLI 外 LLM 归一成真实候选后经 `parseTestCase` 重新入场；脚手架零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场。
- 候选骨架 / Candidate Skeleton：`casey scaffold-case` 产的非权威候选物；开箱过 `parseTestCase`（全 `route:human` 兜底基线），降权标记落文件名 + authoring note + 负向不变量，绝不 `signed`/`replayReady`，须 LLM 归一 + 重走全链 + 人签才算数。
- 归一提示模板 / Normalization Prompt Template：指导 CLI 外 LLM 把 `source.raw` 自由文本归一成真实候选 `TestCase` 的提示 + schema 约束（镜像 `llm-patch.draft.md` 相2 补缝模板范式）；产物必过 `parseTestCase`，违规 fail-closed 退回；语义质量 `route:human` 抽检。

## D15 异构评审（memory 铁律）

Claude 实现 → codex 异构评审（评审家族 ≠ 实现家族）；codex 标 review done 但 audit 写「非正式异构待补」不算数，Claude 补跑。

---

## 待 Steven grill 敲定的开放项（收敛清单）

1. D2：C9 拆分——本契约只做 F3 相0 前段、F5 `init-profile` 另议（本草案取拆）。
2. D4：子命令命名 `scaffold-case` vs `new-case` vs `init-case` vs `ingest --from-text`（本草案取 `scaffold-case`，零涟漪）。
3. D4：脚手架形态取「CLI + 提示模板 + skill 指针」全套 vs 纯文档形（更轻、无 green 骨架基线）。
4. D6：全步 `route:human` 的单占位步骨架作兜底基线是否可接受（本草案取可接受）。
5. D7：`source.raw` 泊原文（含 URL）vs 更保守剥净（本草案取泊原文，前置门兜凭据、URL 非 site.json 目标地址）。
6. D1：是否在本契约与 record-distill 间加交叉引用注（本草案取各自独立、边界表备案）。
7. D9：归一提示模板并入本契约实现交付 vs 留后续（本草案取并入，`from-text-candidate.draft.md` + skill 指针）。

## 护栏对账

- 裁判零 LLM（#15）：脚手架全在相3/4 上游，LLM 从不进 `verdict.mjs`；候选只经人签冻结 spec/expected 正规路入下游。守。
- fail-safe 不 fail-open（#14）：切不出真实步 → `route:human` 交人；凭据/形状/自检不过 → fail-closed `exit 65`/`exit 1`；catch-all 默认落 `route:human`。守。
- 冻结测试只读 / Test Ratchet（#1/#5）：不改任何冻结 schema、不改 `parseTestCase`、不重签 checksum、不动既有金牌；只加 `ingest-scaffold.golden`。守。
- 凭据不进输出（#7）：自由文本前置凭据门 + 输出侧复扫；output-seal 不回显绝对路径、错误只回类别码；`source.raw` 只经凭据门拦值、URL 属合法 authoring 内容不剥。守。
- 阶段互锁（#11）：实现契约走 `contract init` → plan → 冻结红金牌 → gate → 人签；本文档不触发任何实现动作。守。
- 统一语言（#4/#12）：新词先登记 CONTEXT，英文不加粗、走代码体，简体，首现附白话。守。
- 异构评审（#9/#10、memory）：Claude 实现 → codex 异构评审；「非正式待补」不算数、Claude 补跑。守。

— 完（契约包草案，待 Steven grill 签核）—
