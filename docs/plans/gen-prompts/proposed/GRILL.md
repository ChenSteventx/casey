# GRILL — gen-prompts（full，regress scope C 改形态：被测参数的 CLI 外 LLM 合成 authoring）

授权与形态定案：Steven 2026-07-13 在主会话明确确认「合成在 coding agent 中做」——即 **CLI 外 LLM** 形态（凭据即任务简报所引确认，`--user-confirmed` 据此）。方向已定勿改。本文以任务简报 + `SCOPE-OPTIONS.md` 为输入，把承重分岔逐个清空。

## 形态改定（本项到底做什么，与研究稿的差异）

- `SCOPE-OPTIONS.md` 选项 C 描述的是**直调 API 旧形态**（`bin/gen-prompts.mjs` + `lib/promptset-synth.mjs` 调 LLM + 凭据接线 + `--base`/`--key`/`deepseek-v3` 内网默认）——**已被 Steven 2026-07-13 改定作废，不搬**。regress 原版的 API 基址默认值、api-key 解析链、模型 id 一概不进 Casey 的代码与文档；任何内网/真目标地址不许出现。
- 改定后的形态：合成本身由 coding agent（会话里的 LLM）做；`casey` CLI 只做两段确定性零 LLM 工作——
  1. **出「合成种子模板」**：按种子信息（被测 agent 名 / 可选内嵌系统提示词文件）产给 CLI 外 LLM 的生成指引 + 候选产物格式说明；
  2. **收产物**：校验候选（对齐 scope A 已落的 `promptset` 语义）+ 幂等冻结进 `promptset.json`。
- 先例锚：Casey 既有「CLI 外 LLM」模式 = `ingest-scaffold` 的归一脚手架 / 候选骨架 / 归一提示模板三件套（脚手架零 LLM 出模板与骨架，LLM 手术刀在 CLI 外，产物经确定性闸重新入场）。本契约把同一范式套到 promptset authoring（authoring = 编写期一次性工序，指造测试输入、非跑测试）。
- 语义对标（read-only 参考，绝不改）：`/mnt/d/ctx/heren/regress_autotest/scripts/gen-prompts.mjs` 与 `scripts/_prompts-core.mjs` 的幂等冻结 / 去重 / 原子写 / 失败不写盘语义。

## 铁不变量（一字不让，逐条自证）

- **authoring 工具绝不进回放/裁定进程**：authoring 期一次性，回放期零 LLM 不变。金牌钉死 `bin/replay.mjs`、`bin/verdict.mjs`、`bin/promptset.mjs`（数据驱动编排器）的模块闭包不含任何 authoring 模块（D7）。
- **零 API key、零网络、零凭据接线**：两个新 CLI 的依赖闭包无网络/LLM 客户端（`verdict-purity-guard --entry` 双跑）；源码零 `--base`/`--key`/`--model` 旗标、零内网地址字面量（负向金牌）。
- **裁判零 LLM**：`bin/verdict.mjs` 字节不动、裁定语义不变（护栏 #15/#17）；fail-safe 不 fail-open（护栏 #14）。
- **落盘产物照旧过凭据兜底门**：`lib/cred-gate.mjs` 深扫命中拒写（护栏 #7），输入输出两侧都设门。
- **不碰冻结/人签闸**：`promptset.json` 是被测参数数据文件、非冻结断言契约；`lib/sign-gate.mjs` 零改。

## 承重决策（逐个清空）

- **D1 两段命令命名与形状**（对齐 `scaffold-case`/`ingest` 先例与 `bin/casey.mjs` 门面风格）：
  - `casey promptset-seed --agent-name <被测 agent 中文名> [--embedded <系统提示词文件>] [--n <条数，默认 6，1..50>] --out <f>` —— 零 LLM 确定性产**合成种子模板**（单个 md 文件）。
  - `casey promptset-freeze --candidates <候选 JSON> --promptset <promptset.json> [--dry-run]` —— 校验候选 + 幂等冻结追加。
  - 刻意**不叫** `gen-prompts`：CLI 不做合成（合成在 CLI 外），叫 gen 名不副实；两段各自诚实命名（seed = 出种子模板，freeze = 幂等冻结收口）。契约 slug 仍为 `gen-prompts`（战略项名）。
- **D2 合成种子模板内容契约**（确定性、同输入同字节、无时刻字段，镜像 `ingest-scaffold` 字节稳定先例）：
  1. 任务说明：为被测 agent 设计 N 条被测参数，`normal`/`boundary`/`security` 三类全覆盖（语义对标 regress `buildGenMessages` 的生成指引，但以文档形态交给会话里的 LLM，非 API messages）；
  2. 候选产物格式说明：JSON 数组，条目键闭合白名单 `{id, text, category, expect?:{mustInclude?, mustNotInclude?, note?}}`（**无** `name` 字段——Casey `promptset` schema 无此字段，regress 差异记录；**不带** `source`——由 freeze 强制标注，见 D4）；
  3. 约束清单：id 匹配 `^[a-z0-9_]+$`、批内唯一、建议 `pNN_xxx` 形；**禁 `bnd_`/`sec_` 前缀**（注入向量库保留前缀，防撞）；text 中文非空；软期望须可被字符串包含判断、绝不判红；**向量用中文、避开 `token`/`password`/`secret` 等英文禁字段子串**（凭据兜底门做子串 fail-closed 扫描，被测参数必进报告——口径继承 scope A GRILL D5，英文禁字段向量会被门拒、换中文向量重交）；
  4. 交付说明：把候选存成 JSON 文件 → 跑 `casey promptset-freeze` 收口（幂等：已有 id 跳过）；
  5. 内嵌系统提示词节选（若给 `--embedded`，截断上限 4000 字符，对标 regress）。
- **D3 seed 侧凭据门**：内嵌系统提示词是凭据粘贴向量（同 `scaffold-case` 自由文本待遇）——读入后、产出前先过 `credentialGate`，命中 exit 1 零落盘；`--agent-name` 同 caseId 待遇前置判门（镜像 `scaffold-case` 的 caseId 门）；输出种子模板全文再过一次门（防御纵深）。报错不回显原始路径与原值（output-seal 先例）。
- **D4 幂等冻结语义**（对标 regress + Casey fail-closed 收紧）：
  - 已存在 id → **跳过不覆盖只追加新条**（幂等：同一候选文件重复跑 = 0 新增、exit 0、文件字节不变）；已有条目字节原样保留；
  - 候选任一条形状非法 / 未知键 / 批内重复 id / `bnd_`/`sec_` 前缀 / 自带 `source` → **整批拒**、exit 65、不写盘（**收紧**于 regress 的静默逐条 skip——freeze 是 LLM 输出准入闸，宁早失败，agent 修了重交便宜；差异记录）。候选自带 `source` 一律拒：`source:'llm'` 由 freeze 强制标注，不给 LLM 伪标 `user`/`builtin` 的口子（可追溯性防伪）；
  - 候选非 JSON / 非数组 / 空数组 → exit 65 不写盘；
  - 已有 `promptset.json` 坏 JSON / 非数组 → 拒绝合并（绝不覆盖人写存量，对标 regress `loadExisting`）；文件不存在 → 当空数组、可新建；
  - green-by-construction 自检：写盘前对合并结果自跑 `parsePromptset` + 与注入向量库 `mergeCases` 无撞，不过即 freeze 自身 bug、fail-closed 拒写（镜像 `scaffold-case` GRILL D8）；
  - 原子写：tmp + rename，任何失败不写盘不留半份（对标 regress `atomicWriteJson`）；
  - 输出侧凭据门：合并全文过 `credentialGate`，命中 exit 1 零写盘（护栏 #7）；
  - `--dry-run`：只打印新增摘要，不写盘（对标 regress）。
- **D5 `source` 枚举扩展 `llm`**（可追溯性，对标 regress「LLM 合成条目一律标 `source:llm`」边界）：`lib/promptset.mjs` 的 `SOURCES` 从 `['user','builtin']` 扩为 `['user','builtin','llm']`——scope A 当时收窄的唯一理由「本轮不做 LLM 合成」在本契约失效。涟漪：
  - `tests/_golden/regress-promptset.golden.mjs` 第 61 行负向钉（`source:'llm'` 应抛）改为正向（`llm` 合法入集），**同时保留未知 `source`（如 `'robot'`）仍抛的负向钉**——枚举保持闭合，棘轮不松方向、只挪边界；该文件是冻结断言文件，改动须重签 `prd-regress-promptset` 并在提交说明记账；
  - `CONTEXT.md` 的 `promptset` 词条 `source` 枚举更新 + 设计 `txt2testreport-design.md §13.2` 注释同步。
- **D6 MCP 面**：两个新命令进 `CLI_MCP_EXCLUDED`（不加 `casey_*` 工具）。理由：authoring 是一次性工序，驱动者是会话里的 coding agent（在仓内、有 shell），非跑测试操作面；镜像 `scaffold-case`「相0 前段脚手架不接 MCP」直接先例（同为「CLI 外 LLM」范式的 CLI 侧）与 `demo`/`doctor`/`mcp-config` 同类取舍。后续若真机 promptset 用例需求起来，由易用性契约补 `casey_*` 工具并移出（同 `distill` 挂账法）。涟漪：`tests/_golden/cli-mcp-face.golden.mjs` 的 `CLI_MCP_EXCLUDED` 集合与注释改动——该文件被 `prd-cli-mcp-face` 与 `prd-mcp-parity` **两份 prd 共冻**，重签一个不漏（HANDOFF 2026-07-10 复发债教训）；`distribution.golden.mjs` A8 只查 `mcp-config` 包含性、追加成员不红、不需重签。
- **D7 「不进回放/裁定进程」的机制化**：新 authoring 纯函数落独立模块 `lib/promptset-authoring.mjs`（不并进 `lib/promptset.mjs`——后者被回放期编排器 import，混装会把 authoring 代码带进回放闭包）；金牌断言 `bin/replay.mjs`/`bin/verdict.mjs`/`bin/promptset.mjs` 的 import 闭包不含 `promptset-authoring`/两新 bin；`verdict-purity-guard --entry` 对两新 bin 各跑一遍（闭包无 LLM/网络客户端——它们自己也必须零网络）。
- **D8 新术语登记 `CONTEXT.md`**（查重既有学科，简体）：
  - **合成种子模板**（Synthesis Seed Template）：`casey promptset-seed` 零 LLM 产的给 CLI 外 LLM 的生成指引 + 候选产物格式说明；字节稳定确定性；镜像 归一提示模板（相0 先例），喂料源是种子信息（agent 名 / 内嵌系统提示词）而非自由文本用例；
  - **被测参数候选**（Prompt Candidate）：CLI 外 LLM 按 合成种子模板 合成的 promptset 条目数组（非权威），须过 `promptset-freeze` 校验闸 + 幂等冻结才进 `promptset.json`，冻结时一律强制 `source:'llm'` 可追溯；显式区分于 候选骨架（喂料源与产物域都不同）；
  - **幂等冻结**（Idempotent Freeze）：`promptset-freeze` 的写盘纪律——已存在 id 绝不覆盖只追加新条、任何失败不写盘不留半份、原子写；血缘幂等性（分布式系统术语）+ regress `gen-prompts` 冻结语义。
- **D9 落点布局**：种子模板落 `--out` 指定路径（无强制布局，建议 `prompts/<标签>/promptset-seed.md`）；候选文件是会话产物（任意路径）；`promptset.json` 由 `--promptset` 指定（对齐 scope A 自由路径惯例）。种子模板生成是纯读操作（除写 `--out` 外零副作用）。

## 做 / 不做边界

做：`lib/promptset-authoring.mjs`（两段纯函数）、`bin/promptset-seed.mjs` + `bin/promptset-freeze.mjs`（薄 CLI）、`bin/casey.mjs` 门面两命令、`SOURCES` 扩 `llm`（含金牌钉改向与三 prd 重签）、CONTEXT 三词条 + 设计 §13 authoring 小节、红先行金牌 `tests/_golden/gen-prompts.golden.mjs`。

不做（挂账/显式排除）：
- 不做 CLI 内 LLM 合成、不接任何 API/凭据/网络（形态定案，D1 前提）；
- 不动 `bin/verdict.mjs`、`lib/sign-gate.mjs`、`prompts/_lib/*.json`（注入向量库另有编辑面，freeze 只写用户 promptset）、`mcp/casey-server.mjs`（D6 走 EXCLUDED）；
- 不做交互式逐条核对入口（regress `prep.mjs` 的交互面）——coding agent 会话本身就是交互面；
- 不动 `.claude/skills/casey`（自然语言 authoring 入口挂账后续易用性契约）；
- 不做 promptset 行数上限治理 / 候选质量语义评分（语义质量 route:human 抽检，同 归一提示模板 词条口径）。

## 反面场景清单（金牌逐条钉）

1. 内嵌系统提示词含凭据 → seed 输入门 exit 1、零落盘（凭据粘贴向量，镜像 `scaffold-case` 前置门）；
2. LLM 候选 text 夹带凭据字面量 → freeze 输出门 exit 1、零写盘；
3. 候选 id 撞 `bnd_`/`sec_` 保留前缀 → 整批拒（防撞注入向量库）；
4. 候选 id 撞已有 id → 跳过不覆盖（幂等；已冻结条目字节不动）；
5. 候选批内 id 重复 → 整批拒；
6. 候选自带 `source` / 未知键 / expect 坏形状 → 整批拒（闭合白名单，防 LLM 发明字段被静默吞）；
7. 候选非 JSON / 非数组 / 空数组 → exit 65 不写盘；
8. 已有 `promptset.json` 坏 JSON → 拒绝合并（保护人写存量）；
9. 进程中途被杀 → 原子写保证无半份；
10. authoring 模块被接进回放/裁定闭包 → 闭包金牌红（D7）；
11. 种子模板或新 bin 混入内网地址 / API 旗标字样 → 负向金牌红；
12. 同一候选文件重复 freeze → 0 新增 exit 0、文件字节不变（幂等正证）。

## 风险

- `cli-mcp-face.golden.mjs` 双 prd 共冻：重签必须两份都签（`prd-cli-mcp-face` + `prd-mcp-parity`）；合并期若他树也动 `CLI_MCP_EXCLUDED`，走顺序合并 + 3-way + 合并后重签 + 全仓 ratchet 总核（HANDOFF 既定手法）。
- `regress-promptset.golden.mjs` 负向钉改向是冻结断言语义变更（松「`llm` 拒」半格）：必须保留未知 `source` 负向钉证明枚举仍闭合，提交说明记账重签事由。
- 凭据门英文子串扫描会拒含 `password` 等英文词的安全类向量——这是护栏 #7 零弱化的既定摩擦（scope A D5 已裁），种子模板生成指引里写明「用中文向量」消解，不改门。
- 种子模板字节稳定依赖 LF 行尾与固定拼接序——金牌双跑 diff 钉死；行尾用 node 数 `0x0d` 字节核。
- gate 时长：新金牌 hermetic 零 chromium（快）；但重签的 `prd-regress-promptset` 复验含 chat-sut 端到端（chromium），gate 用后台方式跑再轮询收结果。
