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
