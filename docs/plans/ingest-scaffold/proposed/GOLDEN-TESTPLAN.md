# ingest-scaffold — 金牌测试计划（红先行，逐条断言清单）

> 状态：契约包草案，测试**计划**（不写完整金牌代码）。主代理实现时红先行：先落 `tests/_golden/ingest-scaffold.golden.mjs` 并**验红**（`bin/scaffold-case.mjs` 不存在、`casey.mjs` 无 `scaffold-case` 分发、help 无 `casey scaffold-case` 即红），再实现，再 gate。
> 反夹具纪律（memory「别倒着裁夹具、复现已冻接缝」）：happy 路径**复现真接缝**——真写一段自由文本 → 真 `casey scaffold-case` 产骨架 → 真 `casey ingest` 收下（复现 相0 前段→相0 归一闸的真贯通）。**绝不**手造一个「预定裁定」的候选去迎合断言；对抗输入（凭据自由文本、畸形候选）在真接缝基础上做最小扰动。mock LLM 候选 = 内联夹具（表示 CLI 外 LLM 编辑骨架后的产物），**绝不烧真 LLM**（镜像 `ingest.golden` 内联候选夹具先例）。
> 决策依据：GRILL D1–D15 + plan §2–§5。

## 测试骨架（复用 ingest.golden 的 hermetic 内联夹具法）

- `run(args)` = `spawnSync(node, [casey.mjs, ...args])`；`assert(cond,msg)`；`readJson` 辅助（照抄 `ingest.golden.mjs` 先例）。
- 真接缝主链（happy 用例共用）：
  1. 写 `free-text.txt`（一段自由文本用例原文，无凭据、可含合法 URL）。
  2. `run(['scaffold-case', caseId, '--from-text', freeTextPath, '--out-dir', scaffoldOut])` → exit 0，产 `<scaffoldOut>/scaffold-candidate-<caseId>.json`。
  3. `run(['ingest', caseId, '--in', 候选骨架路径, '--out-dir', ingestOut])` → exit 0，产 `testcase-<caseId>.json`（相0 前段→相0 归一闸贯通的硬证）。
- 临时目录 `mkdtempSync`，`finally` 清理。

---

## C1 门面 + 用法错

- C1a：`casey.mjs` 源码含 `casey scaffold-case`（help 暴露命令，`readFileSync(cli).includes('casey scaffold-case')`）。
- C1b：`run(['scaffold-case'])`（缺 caseId）→ exit 64。
- C1c：`run(['scaffold-case', caseId])`（缺 `--from-text`）→ exit 64；`run(['scaffold-case', caseId, '--from-text', f])`（缺 `--out-dir`）→ exit 64。
- C1d：裸旗标 `run(['scaffold-case', caseId, '--from-text', '--out-dir', d])`（`--from-text` 无值被解析成 `true`）→ exit 64。
- C1e：`caseId` 穿越/斜杠 → exit 65（`['scaffold-case','../../escape',...]`、`['scaffold-case','a/b',...]`），原值不回显。
- C1f：`caseId` 命中凭据门（如含 `token`/`password` 子串）→ exit 65，原值不回显（镜像 `ingest` `caseId` 闸）。
- C1g（涟漪守）：`casey.mjs` help 不含过时形态 `--sut <url>`（避开 `handover-pack` C2 黑名单）；`scaffold-case` help 行只带 `--from-text <f>` `--out-dir <d>`。

## C2 前置凭据门（护栏 #7，自由文本头号凭据向量）

- C2a：`free-text.txt` 含英文凭据关键词（如 `password: hunter2`、`api_token=...`）→ `run(['scaffold-case', caseId, '--from-text', dirty, '--out-dir', d])` → exit 1、`<out-dir>/scaffold-candidate-<caseId>.json` **不存在**（零骨架落盘）、`<out-dir>` 目录未建或为空（零目录副作用）、脏值不回显（stderr 只类别提示）。
- C2b：前置门早于落盘——凭据自由文本命中即拒，绝不先落半份再删（镜像 `ingest.mjs:35` 前置门先落盘顺序）。

## C3 候选骨架（happy，exit 0）

真自由文本 → `scaffold-case` → exit 0，断言候选骨架：

- C3a：`<scaffoldOut>/` 恰含 `scaffold-candidate-<caseId>.json` 一件，**无**其他文件（尤其无 `events.json`/`expected.frozen.json`/`testcase-*.json`/`prd-*.json`）。
- C3b：`schemaVersion===1`；`caseId` 与入参一致；`source.kind==='freetext'`；`source.raw===` 自由文本原文（**逐字节一致**，干净原文）；`uniquePrefix==='atl_'`。
- C3c：`steps.length===1`（单占位步，GRILL D6 不臆断切分）；`steps[0].intentId==='i1'`；`steps[0].route==='human'`；`steps[0].reason` 非空（带「脚手架骨架占位」语）。
- C3d（严守 `parseTestCase` 契约）：候选骨架**无 `expected` 字段**（断言归相2）；**无 `target` 字段**（不臆造 `startUrl`）；`source` 键集 ⊆ `{kind,raw,ingestedAt}`（无 `signed`/`replayReady` 类键，否则被 `parseTestCase` 拒）。
- C3e：`source.raw` 保留自由文本里的合法 URL（若原文含 `http(s)://...`）——**不剥 URL**（GRILL D7，与 distill C6a 的显式差异：`source.raw` 是 authoring 输入、非 `site.json` 目标地址）。断言：原文含 URL 时候选 `source.raw` 仍含该 URL。
- C3f（确定性可复现）：同一自由文本连跑两次 `scaffold-case`，候选文件字节**逐字节一致**（进 golden 真值；纯函数 `buildCandidateSkeleton` 不含时刻字段，若 CLI 层落 `ingestedAt` 须固定为可复现来源或断言时剔除）。

## C4 候选真过 parseTestCase 闸 + 真被 ingest 收下（核心 hermetic 验收，复现真接缝）

审计 C9 验收点「产出能过 `testcase.schema.json`」的硬证——候选骨架不是自说自话，真过 `parseTestCase`：

- C4a（骨架直入）：`run(['ingest', caseId, '--in', 候选骨架路径, '--out-dir', ingestOut])` → exit 0，产 `testcase-<caseId>.json`（`source.kind==='freetext'`、单 `route:human` 步的兜底基线合规 `TestCase`）。这是「自由文本 → scaffold → 过 parseTestCase 闸 → 合规 TestCase」的贯通硬证。
- C4b（mock LLM 归一后入场）：取 C3 骨架，内联编辑成 mock LLM 归一产物——把 `source.raw` 里的意图切成 2–3 条**真实自动化步**（补 `intentId`（全局唯一）/`intent`/`actionHint ∈ {click,fill,navigate,...}`/`inputValue` 模板化，去 `route:human`），保留 `source.kind:'freetext'`/`uniquePrefix:'atl_'` → `run(['ingest', caseId, '--in', mock候选, '--out-dir', d])` → exit 0，产合规 `TestCase`。证明「脚手架骨架 → CLI 外 LLM 归一 → 重新入场」链贯通。**mock 候选是内联夹具、绝不烧真 LLM。**

## C5 畸形候选被闸拒（fail-closed，脚手架不 create bypass）

脚手架**不在 `parseTestCase` 之外另开旁路**——CLI 外 LLM 把骨架改坏，`ingest` 照旧 fail-closed（复现 `parseTestCase` 既有 fail-closed 契约，在真骨架基础上做最小畸变）：

- C5a：删 `uniquePrefix` → `run(['ingest',...])` exit 65、零落盘。
- C5b：`intentId` 重复（两步同 `intentId`）→ exit 65。
- C5c：`source.kind` 改成未知值（如 `'teach-in'`）→ exit 65（enum fail-closed）。
- C5d：`route:'human'` 步删 `reason` → exit 65（`route:human ⟹ reason` 闸）。
- C5e：`source` 加闭合外键（如 `signed:false`）→ exit 65（`additionalProperties:false`）。

> C5 断言的是「脚手架产的候选若被改坏，`parseTestCase` 仍拦得住」——不新造闸、不弱化既有闸（GRILL D8）。

## C6 不改冻结 schema + 降权硬不变量（GRILL D10/D13）

- C6a（棘轮守）：`tests/_golden/schemas/testcase.schema.json` **字节未变**（金牌可对该文件 sha256 或断言 `source.kind` enum 仍含 `freetext`、`source` `additionalProperties:false` 仍在——脚手架靠既有形态、不改 schema）。
- C6b（降权负向不变量）：`scaffold-case` **绝不**产 `events.json`/`expected.frozen.json`/`loop/prd-*.json`/任何 `signed:true`/`replayReady:true` 产物（扫 `<scaffoldOut>/` 目录 + 候选文件全文，无这些键为 true、无这些文件名）。
- C6c：候选骨架**无处自标非权威**（`source` 键闭合），降权靠**文件名** `scaffold-candidate-<caseId>.json` + **stdout 落地提示**（成功 stdout 含「候选非权威、须 LLM 归一 + 重走全链 + 人签才算数」语）。

## C7 输出卫生（护栏 #7，output-seal）

- C7a：成功 stdout 不含 `--from-text`/`--out-dir` 用户绝对路径（只报定名产物 `scaffold-candidate-<caseId>.json` + 落地提示）。
- C7b：错误路径（C1e/C1f `caseId`、C2 凭据门、读/落盘失败）stderr 只回 errno / 类别码，不回显路径、不回显脏内容（`caseId` 原值、凭据值、自由文本全文皆不回显）。
- C7c：候选骨架过 `credentialGate`（可用 `credentialGate` 直扫候选文本断言 `ok`）；构造「自由文本干净但脚手架若误引入英文凭据」的纵深对抗 → 若命中输出门则 exit 1 零落盘。
- C7d（与 distill C6a 的显式差异）：**不**对候选文件断言无裸 `://`——`source.raw` 泊的自由文本 URL 是合法 authoring 内容（GRILL D7），凭据**值**由凭据门拦；金牌只钉凭据门，不钉 URL 剥净。

## C8 门面回归

- `run(['selftest', '--tier1'])` → exit 0（新增 `scaffold-case` 门面不破确定性内核与统一语言自检）。

---

## 红先行验红预期（实现前跑金牌应见的红）

- C1a：`casey scaffold-case` 不在 help → 红。
- C1b–C1f：`scaffold-case` 分发不存在 → `casey.mjs` 落 `default`/未知命令分支，退出码 ≠ 期望 → 红。
- C2/C3/C4a/C6/C7：`bin/scaffold-case.mjs` 不存在 → 红。
- C4b/C5：依赖 C4a 的真骨架产物，脚手架不存在 → 红（且 C5 的 `ingest` fail-closed 部分本就绿，锁「脚手架不弱化既有闸」，非红先行项）。
- C8：selftest 本应绿（不依赖 `scaffold-case`）——锁「实现后不回归」，非红先行项。

## 例翻纪律（可翻的例，防臆造）

单占位步 + 全 `route:human`（C3c）是可翻的例：红先行钉「脚手架零 LLM 不臆断切分、只发诚实占位步、不臆造 `actionHint`/意图步」。任何「让脚手架自作主张把自由文本切成 N 步并猜 `actionHint`」的臆造立即触 C3c 金牌红（步数/`route:human` 不符）。green-by-construction（C4a）是第二道可翻例：任何「脚手架产的骨架过不了 `parseTestCase`」立即触红。不 create bypass（C5）是第三道：任何「脚手架旁路了 `parseTestCase` 让畸形候选溜过」立即触红。

## 挂账（进 prd observability，route 标注）

- route:machine —— 「自由文本 → N 意图步确定性预切分」断言留后续增量（v1 单占位步不臆断，GRILL D6）；届时另开红先行金牌补，不在本契约造脆弱切分匹配。
- route:human —— 归一提示模板语义质量（切得对不对、`actionHint` 选得准不准）抽检；全新用例真机 compile 端到端真通（plan §6）。
