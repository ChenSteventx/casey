# GRILL — gen-prompts（full，regress scope C 改形态：被测参数的 CLI 外 LLM 合成 authoring）

授权与形态定案：Steven 2026-07-13 在主会话明确确认「合成在 coding agent 中做」——即 **CLI 外 LLM** 形态（凭据即任务简报所引确认，`--user-confirmed` 据此）。方向已定勿改。本文以任务简报 + `SCOPE-OPTIONS.md` 为输入，把承重分岔逐个清空。

> 设计评审修订（codex-sol@max）2026-07-13：跨族设计评审 12 条全数采信，D1–D9 中受影响条目就地修订（各条标「修订（评审）」），与 `plan.md` 同步。

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
  - 修订（评审）：`--n` 保持 1..50（支持给存量补少量单条），但「三类全覆盖」要求随 n 条件化——n<3 时三类全覆盖数学上不可满足；模板文案按 n 分支（n≥3 要求三类全覆盖，n<3 明示不作三类硬性要求），freeze 不校验条数与类别分布（三类覆盖是模板指引非硬契约，语义质量 route:human 抽检）。
- **D2 合成种子模板内容契约**（确定性、同输入同字节、无时刻字段，镜像 `ingest-scaffold` 字节稳定先例）：
  1. 任务说明：为被测 agent 设计 N 条被测参数；n≥3 时要求 `normal`/`boundary`/`security` 三类全覆盖，n<3 时明示不作三类硬性要求（D1 修订；语义对标 regress `buildGenMessages` 的生成指引，但以文档形态交给会话里的 LLM，非 API messages）；
  2. 候选产物格式说明：JSON 数组，条目键闭合白名单 `{id, text, category, expect?:{mustInclude?, mustNotInclude?, note?}}`（**无** `name` 字段——Casey `promptset` schema 无此字段，regress 差异记录；**不带** `source`——由 freeze 强制标注，见 D4）；
  3. 约束清单：id 匹配 `^[a-z0-9_]+$`、批内唯一、建议 `pNN_xxx` 形；**禁 `bnd_`/`sec_` 前缀**（注入向量库保留前缀，防撞）；text 中文非空；软期望须可被字符串包含判断、绝不判红；凭据概念约束一律用纯中文表述（访问令牌、口令、密钥等，向量也用中文）——修订（评审）：模板全文**不得**出现英文禁字段子串本身：凭据兜底门做不分位置的全文子串 fail-closed 扫描（实测含这些英文词的文本 `credentialGate` 判 `ok:false`），若模板照旧写出英文示例词，D3 输出侧门会把 seed happy 路径自锁成永远 exit 1；金牌 S2 直接断言 `credentialGate(模板全文).ok === true` 钉死自洽（口径继承 scope A GRILL D5：英文禁字段向量会被门拒、换中文向量重交）；
  4. 交付说明：把候选存成 JSON 文件 → 跑 `casey promptset-freeze` 收口（幂等：已有 id 深等跳过，冲突整批拒，见 D4 修订）；
  5. 内嵌系统提示词节选：修订（评审）——若给 `--embedded`，先规范化 `CRLF`/`CR` 为 `LF`（防 Windows 文件把 `0x0d` 带进「零 `0x0d`」产物），全文过输入侧门在截断**之前**（防凭据藏在截断点之后溜过），再按 Unicode 码点截断上限 4000（`slice` 按 UTF-16 码元切会裂开非 BMP 字符产生孤立代理对）并显式标注「已截断」（对标 regress 上限、边界语义收严）。
- **D3 seed 侧凭据门**：内嵌系统提示词是凭据粘贴向量（同 `scaffold-case` 自由文本待遇）——读入后、产出前先过 `credentialGate`，命中 exit 1 零落盘；`--agent-name` 同 caseId 待遇前置判门（镜像 `scaffold-case` 的 caseId 门）；输出种子模板全文再过一次门（防御纵深）。报错不回显原始路径与原值（output-seal 先例）。修订（评审）三点加固：
  - 解析前原文扫描：两 CLI 的一切输入在任何 `JSON.parse`/形状判定**之前**先以原文过门——实测 `JSON.parse` 的 `e.message` 携带原文前缀（如 `Unexpected token 'M', "MYSECRETVA"...`），脏文本可借解析报错走 stderr 旁路；
  - 报错纪律：只出类别码与位置下标，绝不透传 `e.message` 原文节选/输入路径/原值；
  - 私网地址负向扫描（独立于 `credentialGate`）：门只查禁词与已登记凭据字面量、不是地址门（实测 `http://192.168.1.7/internal` 过门 `ok:true`）——两 CLI 另设确定性地址扫描，覆盖 `http`/`https` 与裸主机形态的 `10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`127.0.0.0/8`、`169.254.0.0/16`、IPv6 `::1`/`fc00::/7`/`fe80::/10`；种子产物零裸 `://`、新增候选条目文本同禁（存量条目不追溯）；内部域名静态证不出、route:human 抽检兜。
- **D4 幂等冻结语义**（对标 regress + Casey fail-closed 收紧；修订（评审）：幂等与冲突分明、校验先于幂等、字节契约改口）：
  - 校验序：先对整批候选完整校验（任一非法整批拒，**无论其 id 是否已存在**——堵「借已有 id 绕准入闸」：若先判已有 id 再校验，空 text/未知键/自带 `source`/批内重复都可能借跳过溜过），后做幂等/冲突分类；
  - 已存在 id 分两类：候选规范化后与既有条目**深等** → 幂等跳过（同一候选文件重复跑 = 0 新增、exit 0、整文件字节不变）；同 id **不同内容或不同来源** → 内容冲突、整批拒 exit 65（这不是同一次重跑——原设计把冲突静默吞成「0 新增 exit 0」会丢失该测试向量）；
  - 字节契约改口：已有条目**值深等保留**、0 新增时整文件字节不变；有新增时合并文件用规范序列化（稳定键序 + 2 空格 + 尾 `LF`）重写——`freezeMergePromptset` 是对象级 API，`JSON.parse`/`stringify` 之后不可能保留存量原始空白布局，「已有条目字节原样」与对象级 API 互斥，契约以值等价为准；
  - 候选任一条形状非法 / 未知键 / 批内重复 id / `bnd_`/`sec_` 前缀 / 自带 `source` → **整批拒**、exit 65、不写盘（**收紧**于 regress 的静默逐条 skip——freeze 是 LLM 输出准入闸，宁早失败，agent 修了重交便宜；差异记录）。候选自带 `source` 一律拒：`source:'llm'` 由 freeze 强制标注，不给 LLM 伪标 `user`/`builtin` 的口子（可追溯性防伪）；
  - 候选非 JSON / 非数组 / 空数组 → exit 65 不写盘；
  - 已有 `promptset.json` 坏 JSON / 非数组 → 拒绝合并（绝不覆盖人写存量，对标 regress `loadExisting`）；文件不存在 → 当空数组、可新建；
  - green-by-construction 自检：写盘前对合并结果自跑 `parsePromptset` + 与注入向量库 `mergeCases` 无撞，不过即 freeze 自身 bug、fail-closed 拒写（镜像 `scaffold-case` GRILL D8）；
  - 原子写：tmp + rename，任何失败不写盘不留半份（对标 regress `atomicWriteJson`）；修订（评审）：抽成可注入故障的 `atomicWriteFileSync(path, text, {writeFn?, renameFn?})`——「happy 后无 `.tmp` 残留」证不出原子性（裸 `writeFileSync` 也能过），金牌须注入 write/rename 失败断言目标原字节保留 + tmp 清理；
  - 输出侧凭据门：合并全文过 `credentialGate` + 私网地址负向扫描（D3 修订），命中 exit 1 零写盘（护栏 #7）；
  - `--dry-run`：只打印新增摘要，整个文件系统零差量（不止「目标文件没动」）。
- **D5 `source` 枚举扩展 `llm`**（可追溯性，对标 regress「LLM 合成条目一律标 `source:llm`」边界）：`lib/promptset.mjs` 的 `SOURCES` 从 `['user','builtin']` 扩为 `['user','builtin','llm']`——scope A 当时收窄的唯一理由「本轮不做 LLM 合成」在本契约失效。修订（评审）：只改 `SOURCES` 一行会留两处公开口径漂移——模块头注释仍写「本轮不做 LLM 合成」、`source` 非法报错文案仍硬编码「只能 "user" 或 "builtin"」；同步改这两处，报错文案从 `SOURCES` 常量派生，金牌 P1 断言报错含 `llm` 且仍拒 `robot`。涟漪：
  - `tests/_golden/regress-promptset.golden.mjs` 第 61 行负向钉（`source:'llm'` 应抛）改为正向（`llm` 合法入集），**同时保留未知 `source`（如 `'robot'`）仍抛的负向钉**——枚举保持闭合，棘轮不松方向、只挪边界；该文件是冻结断言文件，改动须重签 `prd-regress-promptset` 并在提交说明记账；
  - `CONTEXT.md` 的 `promptset` 词条 `source` 枚举更新 + 设计 `txt2testreport-design.md §13.2` 注释同步。
- **D6 MCP 面**：两个新命令进 `CLI_MCP_EXCLUDED`（不加 `casey_*` 工具）。理由：authoring 是一次性工序，驱动者是会话里的 coding agent（在仓内、有 shell），非跑测试操作面；镜像 `scaffold-case`「相0 前段脚手架不接 MCP」直接先例（同为「CLI 外 LLM」范式的 CLI 侧）与 `demo`/`doctor`/`mcp-config` 同类取舍。后续若真机 promptset 用例需求起来，由易用性契约补 `casey_*` 工具并移出（同 `distill` 挂账法）。涟漪：`tests/_golden/cli-mcp-face.golden.mjs` 的 `CLI_MCP_EXCLUDED` 集合与注释改动——该文件被 `prd-cli-mcp-face` 与 `prd-mcp-parity` **两份 prd 共冻**，重签一个不漏（HANDOFF 2026-07-10 复发债教训）；`distribution.golden.mjs` A8 只查 `mcp-config` 包含性、追加成员不红、不需重签。修订（评审）：A4 现只遍历 `bin/casey.mjs` switch 实有 case、EXCLUDED 多出的幽灵成员抓不到——若 switch 漏接 `promptset-freeze` 而 bin/help/EXCLUDED 都齐，全部直跑 bin 的测试仍绿、门面入口却不可用；同次改动给 A4 增补反向断言 `CLI_MCP_EXCLUDED` ⊆ switch 派生集（当前九成员均在位、即时可绿），且本契约金牌 C1 两命令都经门面真跑（freeze 缺参 64 + `--dry-run` happy）。
- **D7 「不进回放/裁定进程」的机制化**：新 authoring 纯函数落独立模块 `lib/promptset-authoring.mjs`（不并进 `lib/promptset.mjs`——后者被回放期编排器 import，混装会把 authoring 代码带进回放闭包）；金牌断言 `bin/replay.mjs`/`bin/verdict.mjs`/`bin/promptset.mjs` 的 import 闭包不含 `promptset-authoring`/两新 bin；`verdict-purity-guard --entry` 对两新 bin 各跑一遍（闭包无 LLM/网络客户端——它们自己也必须零网络）。修订（评审）三点加固：
  - spawn 边：`bin/promptset.mjs` 本就用 `node:child_process` 的 `spawnSync` 编排其他 bin——import 闭包核堵不住 spawn 边；金牌加源文本扫描：三份回放侧文件零 `promptset-seed`/`promptset-freeze`/`promptset-authoring` 字样；
  - 字节锚：全仓 `testChecksums` 枚举核过，此前**没有任何 prd** 冻结 `bin/verdict.mjs` 或 `lib/sign-gate.mjs` 的 sha256——「裁判字节不动」只有行为守卫无字节锚；`loop/prd-gen-prompts.json` 的 `testChecksums` 同表冻结这两份基线（非测试文件入冻结面有 `loop-kit/lib/boot.mjs` 等先例），铁不变量从宣称变机器可验；
  - 白名单核：`verdict-purity-guard` 的 `DENIED_PKGS` 是有限禁单，未登记 SDK（实测 `@google/generative-ai`）溜得过——两新 bin 加闭包白名单核（只放行 `node:` 内置与仓内相对模块，任何第三方 bare 说明符即红）+ 未登记 SDK 金丝雀证明检查器能红；白名单核落本契约金牌、不改 `verdict-purity-guard.mjs` 本体（不动 `prd-model-lane-guard` 冻结面）。
- **D8 新术语登记 `CONTEXT.md`**（查重既有学科，简体）：
  - **合成种子模板**（Synthesis Seed Template）：`casey promptset-seed` 零 LLM 产的给 CLI 外 LLM 的生成指引 + 候选产物格式说明；字节稳定确定性；镜像 归一提示模板（相0 先例），喂料源是种子信息（agent 名 / 内嵌系统提示词）而非自由文本用例；
  - **被测参数候选**（Prompt Candidate）：修订（评审）粒度定死——**单条** `{id, text, category, expect?}` 条目；其 JSON 数组整体称**候选批**（候选文件），两粒度不混用（原稿把「候选」既当单条又当数组）；CLI 外 LLM 按 合成种子模板 合成、非权威，须过 `promptset-freeze` 校验闸 + 幂等冻结才进 `promptset.json`，冻结时一律强制 `source:'llm'` 可追溯；显式区分于 候选骨架（喂料源与产物域都不同）；
  - **幂等冻结**（Idempotent Freeze）：`promptset-freeze` 的写盘纪律——已存在 id 绝不覆盖（深等跳过、冲突整批拒，D4 修订）、任何失败不写盘不留半份、原子写；血缘幂等性（分布式系统术语）+ regress `gen-prompts` 冻结语义。修订（评审）：CONTEXT 登记时显式消歧——与既有「冻结断言契约」体系**无关**：无人签、无 checksum、可持续追加，只承诺已有 id 不覆盖与失败不写盘（两者都叫「冻结」但语义完全不同，并列词条防混淆）。
- **D9 落点布局**：种子模板落 `--out` 指定路径（无强制布局，建议 `prompts/<标签>/promptset-seed.md`）；候选文件是会话产物（任意路径）；`promptset.json` 由 `--promptset` 指定（对齐 scope A 自由路径惯例）。种子模板生成是纯读操作（除写 `--out` 外零副作用）。修订（评审）：自由布局保留，但加路径闸——原设计任意路径无任何护栏，一份「干净」的 seed 理论上可被写到 `bin/verdict.mjs`/`lib/sign-gate.mjs`/`.auth/` 直接破坏铁不变量（内容凭据门不查目的路径）：
  - 后缀强制：seed `--out` 须 `.md`、freeze `--promptset` 须 `.json`；
  - 保护面拒写：路径 canonical 化（符号链接解析到真身）后，拒写 `.auth/`、`site.json`、`bin/`、`lib/`、`loop/`、`loop-kit/`、`mcp/`、`tests/_golden/`、`prompts/_lib/`；
  - seed 对已存在文件拒绝覆盖（freeze 天然对已有 promptset 做合并、不受此限）；
  - 金牌断言保护文件写前写后 sha256 不变、含符号链接别名场景。

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
12. 同一候选文件重复 freeze → 0 新增 exit 0、文件字节不变（幂等正证）；
13. 同 id 不同内容候选 → 冲突整批拒 65（不许静默吞成幂等，D4 修订）；
14. 候选 malformed JSON 且原文夹凭据/地址哨兵 → 报错输出零原值零路径（解析前扫描 + 报错纪律，D3 修订）；
15. embedded 夹私网地址、或凭据藏在第 4000 码点之后 → exit 1（地址扫描 + 截断前全文过门，D2/D3 修订）；
16. `--out`/`--promptset` 指向保护路径（含符号链接别名）→ 拒写、保护文件 sha256 前后不变（D9 修订）；
17. switch 漏接 `promptset-freeze` 而 EXCLUDED 已加 → C1 门面全覆盖 + A4 反向断言红（D6 涟漪）。

## 风险

- `cli-mcp-face.golden.mjs` 双 prd 共冻：重签必须两份都签（`prd-cli-mcp-face` + `prd-mcp-parity`）；合并期若他树也动 `CLI_MCP_EXCLUDED`，走顺序合并 + 3-way + 合并后重签 + 全仓 ratchet 总核（HANDOFF 既定手法）。
- `regress-promptset.golden.mjs` 负向钉改向是冻结断言语义变更（松「`llm` 拒」半格）：必须保留未知 `source` 负向钉证明枚举仍闭合，提交说明记账重签事由。
- 凭据门英文子串扫描会拒含 `password` 等英文词的安全类向量——这是护栏 #7 零弱化的既定摩擦（scope A D5 已裁），种子模板生成指引里写明「用中文向量」消解，不改门。
- 种子模板字节稳定依赖 LF 行尾与固定拼接序——金牌双跑 diff 钉死；行尾用 node 数 `0x0d` 字节核。
- gate 时长：新金牌 hermetic 零 chromium（快）；但重签的 `prd-regress-promptset` 复验含 chat-sut 端到端（chromium），gate 用后台方式跑再轮询收结果。
