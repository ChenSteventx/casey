# gen-prompts 设计层评审料（plan 阶段，实现前）

本文件是喂给异构评审者（codex）的评审料，只含 spec（plan + grill）与「已定勿改」的方向声明，不含代码、不含凭据、不含无关文件。评审对象是**设计**（实现尚未开始），目的是在 build 前逮出设计缺陷。

---

## 0. 已定勿改的方向声明（来自任务简报，勿评论该决策本身，只评估其设计落地是否有缺陷）

- 战略项「regress 参数化」剩项：被测参数的 LLM 合成 authoring。形态经 Steven（人类负责人）2026-07-13 在主会话明确确认「合成在 coding agent 中做」，即 **CLI 外 LLM** 形态。`docs/plans/gen-prompts/SCOPE-OPTIONS.md` 选项 C 描述的「直调 API 旧形态」（`bin/gen-prompts.mjs` + `lib/promptset-synth.mjs` 调 LLM + `--base`/`--key`/`deepseek-v3` 内网默认凭据接线）已作废，不搬进本契约。
- 定案后的形态：合成本身由 coding agent（会话里的 LLM）做；`casey` CLI 只做两段确定性零 LLM 工作——出「合成种子模板」+ 收「被测参数候选」（校验 + 幂等冻结）。
- 先例锚：Casey 既有「CLI 外 LLM」模式 = `ingest-scaffold` 的归一脚手架 / 候选骨架 / 归一提示模板三件套（脚手架零 LLM 出模板与骨架，LLM 手术刀在 CLI 外，产物经确定性闸重新入场）。本契约把同一范式套到 promptset authoring。
- 铁不变量（不可动摇，请评估设计是否真的守住，而非评论是否该守）：
  1. authoring 工具绝不进回放/裁定进程（回放期零 LLM 不变，裁判零 LLM 护栏 #15/#17）；
  2. 零 API key、零网络、零凭据接线、零内网地址；
  3. `bin/verdict.mjs` 字节不动、裁定语义不变；fail-safe 不 fail-open（护栏 #14）；
  4. 落盘产物照旧过凭据兜底门 `lib/cred-gate.mjs`（护栏 #7）；
  5. 不碰冻结/人签闸 `lib/sign-gate.mjs`（ADR-0004）。

评审请聚焦：设计是否真的兑现以上不变量、红先行金牌是否真能钉住对应缺陷（会不会假绿）、重签清单是否漏掉共享冻结文件、是否引入裁判 LLM 化 / 凭据外泄 / 术语走样风险。按 HIGH/MED/LOW 给 findings，逐条对准 GRILL 的 keyDecisions（D1–D9）编号；如无发现给 PASS。

---

## 1. plan.md 全文

<details>
<summary>docs/plans/gen-prompts/plan.md</summary>

```markdown
# gen-prompts — 被测参数的 CLI 外 LLM 合成 authoring（full，regress scope C 改形态）

## 背景

战略项「regress 参数化」的收尾半格：scope A（数据驱动被测参数 overlay + 注入向量库 + 多用例聚合报告）已落 dev，剩 LLM 合成 authoring。形态经 Steven 2026-07-13 主会话改定为 **CLI 外 LLM**（合成在 coding agent 会话里做；`SCOPE-OPTIONS.md` 选项 C 的直调 API 旧形态作废不搬）。`casey` CLI 只做两段确定性零 LLM 工作：出**合成种子模板** + 收**被测参数候选**（校验 + **幂等冻结**进 `promptset.json`）。决策口径见 `proposed/GRILL.md`（D1–D9），语义对标 read-only 参考 `regress_autotest/scripts/gen-prompts.mjs` + `_prompts-core.mjs`。

内核一字不让：authoring 绝不进回放/裁定进程（回放期零 LLM 不变）；零 API key、零网络、零凭据接线、零内网地址；裁判零 LLM（`bin/verdict.mjs` 字节不动）；落盘过凭据兜底门；不碰冻结/人签闸。

## 流程（端到端，逻辑描述）

1. 用户对 coding agent 说「给××agent 生成一组测试提示词」；agent 跑 `casey promptset-seed --agent-name <名> [--embedded <系统提示词文件>] [--n 6] --out <seed.md>`——CLI 零 LLM 产合成种子模板（生成指引 + 候选格式说明 + 约束 + 交付步骤；输入/输出两侧凭据门）。
2. agent（会话里的 LLM）按种子模板合成 N 条被测参数候选，存成 JSON 数组文件。合成发生在 CLI 外，CLI 全程不碰模型与网络。
3. agent 跑 `casey promptset-freeze --candidates <f> --promptset <promptset.json> [--dry-run]`——CLI 零 LLM 校验候选（id 形状 / 禁 `bnd_`/`sec_` 前缀 / category 枚举 / expect 软期望形状 / 键闭合白名单 / 批内唯一 / 不得自带 `source`），任一不合整批拒不写盘；合法则强制标 `source:'llm'`、跳过已有 id 只追加新条、green-by-construction 自跑 `parsePromptset` + `mergeCases`、过凭据门、原子写。
4. 冻结后的 `promptset.json` 照 scope A 既有链路消费：`casey run --promptset` 数据驱动回放（回放期零 LLM、软期望绝不进裁定）。

## 改动（业务逻辑落点）

1. `lib/promptset-authoring.mjs`（新，纯函数、零 I/O、零 LLM；独立于 `lib/promptset.mjs`——后者在回放闭包里，混装违 GRILL D7）：
   - `buildSeedTemplate({agentName, embedded?, n?})` → 种子模板文本（字节稳定、无时刻字段；embedded 截断 4000 字符；内容契约见 GRILL D2）；
   - `freezeMergePromptset({existing, candidates})` → `{merged, fresh, skippedExisting}`（校验闭合白名单 fail-closed 抛；已有 id 跳过；新条强制 `source:'llm'`）。
2. `bin/promptset-seed.mjs`（新薄 CLI）：参数校验（64）→ `--agent-name` 凭据门（65）→ 读 embedded + 输入侧凭据门（1，零落盘）→ `buildSeedTemplate` → 输出侧凭据门（1）→ 落 `--out`（65 兜 I/O）。镜像 `scaffold-case.mjs` 结构与 output-seal（不回显路径/原值）。
3. `bin/promptset-freeze.mjs`（新薄 CLI）：参数校验（64）→ 读候选/存量（坏形状 65）→ `freezeMergePromptset`（违规 65 整批拒）→ green-by-construction 自检（`parsePromptset` + `loadBuiltinLibs`+`mergeCases` 无撞；不过 65 拒写）→ 输出侧凭据门（1，零写盘）→ 原子写 tmp+rename（65 兜 I/O）；`--dry-run` 打印新增摘要不写盘；0 新增也 exit 0（幂等）。
4. `lib/promptset.mjs`：`SOURCES` 加 `'llm'`（唯一改动行，GRILL D5）。
5. `bin/casey.mjs`：switch 加 `promptset-seed`/`promptset-freeze` 两 case（直通各自 bin，同 `scaffold-case` 先例）+ help 生命周期分步节两行（标注「authoring 期一次性、合成在 CLI 外、绝不进回放」）。
6. `tests/_golden/regress-promptset.golden.mjs`（冻结文件，重签）：第 61 行 `source:'llm'` 负向钉改正向 + 新增未知 `source`（`'robot'`）负向钉（枚举仍闭合，棘轮只挪边界不松方向）。
7. `tests/_golden/cli-mcp-face.golden.mjs`（冻结文件，双 prd 共冻，重签）：`CLI_MCP_EXCLUDED` 追加 `promptset-seed`/`promptset-freeze` + 注释记理由（GRILL D6：authoring 一次性工序、驱动者是仓内有 shell 的 coding agent，镜像 `scaffold-case` 先例；后续易用性契约可补工具并移出）。
8. `CONTEXT.md`：登记 合成种子模板 / 被测参数候选 / 幂等冻结 三词条（GRILL D8）+ `promptset` 词条 `source` 枚举更新为 `user|builtin|llm`。
9. `docs/design/txt2testreport-design.md`：§13 头注「不做 LLM 合成（authoring 属后续独立契约）」改口指向本契约；§13.2 `source` 注释同步；新增 §13.7「合成 authoring（CLI 外 LLM）」小节（两段命令 + 铁不变量）。
10. `loop/prd-gen-prompts.json`（新）：stories + `testChecksums` 冻结 `tests/_golden/gen-prompts.golden.mjs`。

## 非目标

不做 CLI 内 LLM 合成 / API / 凭据 / 网络接线（形态定案）；不动 `bin/verdict.mjs`（裁判零 LLM）、`lib/sign-gate.mjs`（冻结/人签闸）、`prompts/_lib/*.json`（注入向量库，freeze 只写用户 promptset）、`mcp/casey-server.mjs`（走 EXCLUDED）；不做交互式逐条核对入口（会话即交互面）；不动 `.claude/skills/casey`（挂账）；候选语义质量 route:human 抽检、不做机器评分。

## touchesFiles

新建：`lib/promptset-authoring.mjs`、`bin/promptset-seed.mjs`、`bin/promptset-freeze.mjs`、`tests/_golden/gen-prompts.golden.mjs`、`loop/prd-gen-prompts.json`、`docs/plans/gen-prompts/proposed/GRILL.md`、`docs/plans/gen-prompts/plan.md`。
修改：`lib/promptset.mjs`（`SOURCES` 一行）、`bin/casey.mjs`（两 case + help）、`tests/_golden/regress-promptset.golden.mjs`（冻结，重签）、`tests/_golden/cli-mcp-face.golden.mjs`（冻结，双 prd 重签）、`CONTEXT.md`、`docs/design/txt2testreport-design.md`、`loop/prd-regress-promptset.json`、`loop/prd-cli-mcp-face.json`、`loop/prd-mcp-parity.json`（后三份仅 `testChecksums` 重签）。
不碰：`bin/verdict.mjs`、`lib/sign-gate.mjs`、`prompts/_lib/*.json`、`mcp/casey-server.mjs`、`.auth/`、`site.json`。

## 红先行金牌清单（`tests/_golden/gen-prompts.golden.mjs`，hermetic 零真机零凭据零 chromium）

先验红方式：金牌文件先落、`loop/prd-gen-prompts.json` 以其 sha256 冻结，实现前跑金牌——两个新 bin 与 `lib/promptset-authoring.mjs` 尚不存在，S/F 组全红；P1 因 `SOURCES` 尚无 `llm` 而红。红证留档后才开 accept（`--red-verified`）。

- S1 种子确定性：同种子输入（agent 名 + embedded + n）双跑产物字节相同、无时刻字段、LF 行尾（node 数 `0x0d` 为 0）。先红：`bin/promptset-seed.mjs` 缺席 → spawn 非零。
- S2 种子内容契约：模板含 id 形状 `^[a-z0-9_]+$`、禁 `bnd_`/`sec_` 前缀、category 三枚举、expect 软期望字段说明 + 「软期望绝不判红」申明、「中文向量避英文禁字段子串」约束、`--n` 条数、embedded 节选（超 4000 截断）、交付 freeze 步骤。先红：同 S1。
- S3 种子门与负向：缺参/裸旗标 64；`--n` 越界（非 1..50 整数）64；`--agent-name` 命中凭据门 65；embedded 含凭据字面量 → exit 1 且零落盘；产物与两新 bin 源码零内网地址（`http://10.` 等）/零 `--base`/`--key`/`--model` 字样。先红：同 S1。
- S4 零 LLM/零网络闭包：`verdict-purity-guard --entry bin/promptset-seed.mjs` 与 `--entry bin/promptset-freeze.mjs` 均 exit 0。先红：同 S1（entry 缺席非零）。
- F1 冻结 happy：候选 3 条（normal/boundary/security 各一）追加进已有 2 条的 promptset → 5 条、新条 `source` 全 `llm`、已有条目字节原样、产物过 `parsePromptset` 且与注入向量库 `mergeCases` 无撞。先红：`bin/promptset-freeze.mjs` 缺席。
- F2 幂等：同一候选文件再跑 → 0 新增、exit 0、文件字节不变；`--dry-run` 有新增也零写盘。先红：同 F1。
- F3 准入闸（整批拒、零写盘、exit 65）：id 非法 / 批内重复 / `bnd_`·`sec_` 前缀 / 自带 `source` / 未知键 / expect 坏形状 / text 空 / 候选非数组或空数组 / 已有 promptset 坏 JSON——逐场景断言目标文件字节不变。先红：同 F1。
- F4 凭据门与原子性：候选 text 含凭据字面量 → exit 1 零写盘；happy 路径跑完无 `.tmp` 残留。先红：同 F1。
- P1 `source` 枚举扩展：`parsePromptset` 收 `source:'llm'`；未知 `source`（`'robot'`）仍抛。先红：现 `SOURCES` 无 `llm` → 前半段抛即红。
- N1 不进回放/裁定闭包（防退化钉）：静态解析 `bin/replay.mjs`、`bin/verdict.mjs`、`bin/promptset.mjs` 的 import 闭包，断言不含 `promptset-authoring` 与两新 bin；红先行验法 = 临时把断言目标指向一个已知在闭包内的模块证明检查器真能红，再指回（红证记档）。
- C1 CLI 门面：`casey help` 列出两命令且带「合成在 CLI 外」表述；`casey promptset-seed` 缺参经门面透传 64。先红：门面 case 未加 → 未知命令 64 但 help 不含 → 断言 help 内容红。

配套改动的既有金牌（改后复跑，属重签验收）：`regress-promptset.golden.mjs`（P 组 `llm` 正向 + `robot` 负向）、`cli-mcp-face.golden.mjs`（A4 覆盖断言在 EXCLUDED 更新后过）。

## 预计重签 checksum 的 prd 清单（遍历 `loop/prd-*.json` 的 `testChecksums` 全量核过，一个不漏）

| prd | 被改冻结文件 | 事由 |
| --- | --- | --- |
| `loop/prd-regress-promptset.json` | `tests/_golden/regress-promptset.golden.mjs` | `source:'llm'` 负向钉改正向 + 补未知 `source` 负向钉（GRILL D5） |
| `loop/prd-cli-mcp-face.json` | `tests/_golden/cli-mcp-face.golden.mjs` | `CLI_MCP_EXCLUDED` 追加两命令 + 注释（GRILL D6） |
| `loop/prd-mcp-parity.json` | `tests/_golden/cli-mcp-face.golden.mjs` | 同上（双 prd 共冻同一文件，一个不漏） |

核对依据：全仓 `testChecksums` 枚举显示本契约其余 touchesFiles（`lib/promptset.mjs`、`bin/casey.mjs`、`CONTEXT.md`、设计文档、`mcp/casey-server.mjs`）均不在任何 prd 冻结面；`distribution.golden.mjs` A8 只做 `mcp-config` 包含性检查，EXCLUDED 追加成员不红、`prd-distribution` 不需重签。若实现期实际改动面外溢，先重跑全量枚举再补签。

## 验收（命令序）

1. `node loop-kit/bin/breaker.mjs --reset`（loop 开始）；
2. 红先行：金牌 + prd 落盘 → `node tests/_golden/gen-prompts.golden.mjs` 确认红（留红证）→ `contract advance accept --red-verified`；
3. 实现后：`node tests/_golden/gen-prompts.golden.mjs` 绿；
4. `node tests/_golden/regress-promptset.golden.mjs` 绿（scope A 全组 + 改钉）；
5. `node tests/_golden/cli-mcp-face.golden.mjs` 绿（A4 + A8 跨金牌一致）；
6. `node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json` GREEN（唯一写 `passes`）；
7. 重签复验（后台跑、轮询收结果，含 chromium 慢金牌）：`gate --prd loop/prd-regress-promptset.json`、`gate --prd loop/prd-cli-mcp-face.json`、`gate --prd loop/prd-mcp-parity.json` 全 GREEN；
8. `node bin/casey.mjs selftest --tier1` GREEN（确定性内核 + 裁判零 LLM 不破）；
9. `node loop-kit/bin/term-lint.mjs --registry` exit 0（CONTEXT 新词条完整）；
10. 全仓 ratchet 总核：node 遍历每份 `loop/prd-*.json` 的 `testChecksums` 对实际文件 sha256 全 MATCH（合并收尾准则）；
11. review：异构冗余评审（Claude 实现 → codex 评，`gpt-5.6-sol/terra/luna`@xhigh；重点面：凭据门旁路 / 幂等冻结覆盖存量 / 闭包纯度 / 棘轮松动）；
12. route:human：Steven 过目一份真实种子模板 + 一次真实会话合成收口的 promptset diff（语义质量抽检）；真机 promptset 用例趟归真机 UAT 合并跑。
```

</details>

---

## 2. GRILL.md 全文（proposed/GRILL.md，含承重决策 D1–D9、铁不变量、反面场景清单）

<details>
<summary>docs/plans/gen-prompts/proposed/GRILL.md</summary>

```markdown
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
```

</details>

---

## 3. 评审指令（复述，供评审者对齐输出结构）

审设计层——请回答：

1. 锚点选择是否会漏命中或误命中（例如：id 前缀防撞正则 `^[a-z0-9_]+$` + 禁 `bnd_`/`sec_`、凭据门英文子串扫描、`CLI_MCP_EXCLUDED` 集合、闭包扫描的模块清单）？
2. fail-closed 边界是否留有 fail-open 缝（例如：`--dry-run` 路径、`promptset.json` 不存在时新建、green-by-construction 自检失败路径、原子写失败路径、embedded 截断逻辑）？
3. 红先行金牌清单（S1–S4 / F1–F4 / P1 / N1 / C1）是否真能钉住对应缺陷，会不会假绿（例如断言过弱、断言了错误的东西、遗漏关键反面场景）？
4. 「预计重签 checksum 的 prd 清单」是否遗漏了任何共享冻结文件（结合 `touchesFiles`、`SOURCES` 改动、`CLI_MCP_EXCLUDED` 改动交叉核对）？
5. 是否存在引入「裁判 LLM 化」的设计风险（authoring 产物是否有任何路径可能被误当作裁定输入）？
6. 是否存在凭据外泄设计风险（双侧凭据门覆盖是否完整、报错回显是否可能泄漏原值）？
7. 术语与 DDD 统一语言是否走样（三新词条「合成种子模板」「被测参数候选」「幂等冻结」与既有词条「候选骨架」「归一提示模板」「归一脚手架」「注入向量库」的消歧是否清楚、有无循环定义或含糊）？

按 HIGH/MED/LOW 分级列 findings，每条对准 GRILL 的 D1–D9 或对应章节编号；给出具体证据引用（行为/字段/场景描述，非泛泛而论）；无发现给 PASS。
