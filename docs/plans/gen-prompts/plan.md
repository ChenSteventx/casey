# gen-prompts — 被测参数的 CLI 外 LLM 合成 authoring（full，regress scope C 改形态）

> 设计评审修订（codex-sol@max）2026-07-13：跨族设计评审 12 条全数采信并入——凭据门自锁改纯中文表述、门面反向断言、解析前原文扫描 + 私网地址负向扫描、路径闸、幂等与冲突分明、原子写可证、闭包白名单核、spawn 边扫描 + 裁判基线字节冻结、三类覆盖随 n 条件化、CRLF 规范化与码点截断、`SOURCES` 口径三处同步、术语消歧。逐条核代码/实测确认后并入，GRILL D1–D9 同步修订。

## 背景

战略项「regress 参数化」的收尾半格：scope A（数据驱动被测参数 overlay + 注入向量库 + 多用例聚合报告）已落 dev，剩 LLM 合成 authoring。形态经 Steven 2026-07-13 主会话改定为 **CLI 外 LLM**（合成在 coding agent 会话里做；`SCOPE-OPTIONS.md` 选项 C 的直调 API 旧形态作废不搬）。`casey` CLI 只做两段确定性零 LLM 工作：出**合成种子模板** + 收**被测参数候选**（校验 + **幂等冻结**进 `promptset.json`）。决策口径见 `proposed/GRILL.md`（D1–D9），语义对标 read-only 参考 `regress_autotest/scripts/gen-prompts.mjs` + `_prompts-core.mjs`。

内核一字不让：authoring 绝不进回放/裁定进程（回放期零 LLM 不变）；零 API key、零网络、零凭据接线、零内网地址；裁判零 LLM（`bin/verdict.mjs` 字节不动）；落盘过凭据兜底门；不碰冻结/人签闸。

## 流程（端到端，逻辑描述）

1. 用户对 coding agent 说「给××agent 生成一组测试提示词」；agent 跑 `casey promptset-seed --agent-name <名> [--embedded <系统提示词文件>] [--n 6] --out <seed.md>`——CLI 零 LLM 产合成种子模板（生成指引 + 候选格式说明 + 约束 + 交付步骤；输入/输出两侧凭据门）。
2. agent（会话里的 LLM）按种子模板合成 N 条被测参数候选，存成 JSON 数组文件。合成发生在 CLI 外，CLI 全程不碰模型与网络。
3. agent 跑 `casey promptset-freeze --candidates <f> --promptset <promptset.json> [--dry-run]`——CLI 零 LLM 校验候选（id 形状 / 禁 `bnd_`/`sec_` 前缀 / category 枚举 / expect 软期望形状 / 键闭合白名单 / 批内唯一 / 不得自带 `source`），任一不合整批拒不写盘（校验先于幂等判定）；合法则强制标 `source:'llm'`、已有 id 深等才幂等跳过（同 id 不同内容按冲突整批拒）、green-by-construction 自跑 `parsePromptset` + `mergeCases`、过凭据门与私网地址扫描、原子写。
4. 冻结后的 `promptset.json` 照 scope A 既有链路消费：`casey run --promptset` 数据驱动回放（回放期零 LLM、软期望绝不进裁定）。

## 改动（业务逻辑落点）

1. `lib/promptset-authoring.mjs`（新，零 LLM；核心两函数纯函数零 I/O，另含独立原子写 helper；独立于 `lib/promptset.mjs`——后者在回放闭包里，混装违 GRILL D7）：
   - `buildSeedTemplate({agentName, embedded?, n?})` → 种子模板文本（字节稳定、无时刻字段；embedded 先规范化 `CRLF`/`CR` 为 `LF`、再按 Unicode 码点截断 4000 并显式标注「已截断」、绝不切裂代理对；模板全文纯中文表达凭据概念、不含任何英文禁字段子串——内容契约见 GRILL D2 修订）；
   - `freezeMergePromptset({existing, candidates})` → `{merged, fresh, skippedExisting}`：先对整批候选完整校验（任一非法整批抛，无论其 id 是否已存在——校验先于幂等判定，堵「借已有 id 绕准入」）；已有 id 且规范化后与既有条目深等 → 幂等跳过；同 id 不同内容或不同来源 → 内容冲突整批抛（幂等重试≠冲突，绝不静默吞）；新条强制 `source:'llm'`。合并输出用规范序列化（稳定键序 + 2 空格缩进 + 尾 `LF`）——契约是「已有条目值深等保留、0 新增时整文件字节不变」，不承诺已有条目原始字节布局（对象级 API 与字节原样互斥，GRILL D4 修订）；
   - `atomicWriteFileSync(path, text, {writeFn?, renameFn?})`：tmp+rename 原子写，fs 操作可注入以便金牌模拟写/换名失败（任一失败不写盘、目标原字节保留、tmp 清理）。
2. `bin/promptset-seed.mjs`（新薄 CLI）：参数校验（64）→ 路径闸（`--out` 强制 `.md` 后缀；canonical 化含符号链接解析到真身后，拒写保护面 `.auth/`、`site.json`、`bin/`、`lib/`、`loop/`、`loop-kit/`、`mcp/`、`tests/_golden/`、`prompts/_lib/`；`--out` 已存在文件拒绝覆盖——违者 65）→ `--agent-name` 凭据门（65）→ 读 embedded 原文并在任何解析/截断之前先过输入侧凭据门 + 私网地址负向扫描（1，零落盘；扫描面：`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`127.0.0.0/8`、`169.254.0.0/16`、IPv6 `::1`/`fc00::/7`/`fe80::/10`，`http`/`https` 与裸主机形态皆覆盖；内部域名静态证不出，route:human 抽检兜）→ `buildSeedTemplate` → 输出侧凭据门 + 私网地址负向扫描 + 产物零裸 `://`（1）→ 落 `--out`（65 兜 I/O）。全程报错只出类别码与位置下标，绝不回显输入原文节选/路径/原值（`JSON.parse` 的 `e.message` 会携带原文前缀，一律不透传——output-seal 纪律，镜像 `scaffold-case.mjs`）。
3. `bin/promptset-freeze.mjs`（新薄 CLI）：参数校验（64）→ 路径闸（`--promptset` 强制 `.json` 后缀 + 同 seed 的保护面拒写，65）→ 读候选/存量原文并在 `JSON.parse` 之前先过凭据门 + 私网地址负向扫描（命中 1，零写盘——防脏原文借解析报错走 stderr 旁路）→ 解析（坏 JSON/坏形状 65，报错只出类别码与位置、不带原文节选）→ `freezeMergePromptset`（违规/冲突 65 整批拒）→ 新增候选条目文本零裸 `://`（65；存量条目不追溯）→ green-by-construction 自检（`parsePromptset` + `loadBuiltinLibs`+`mergeCases` 无撞；不过 65 拒写）→ 输出侧凭据门 + 私网地址负向扫描（1，零写盘）→ `atomicWriteFileSync` 原子写（65 兜 I/O）；`--dry-run` 打印新增摘要、整个文件系统零差量；0 新增 exit 0 且零写盘（幂等，整文件字节不变）。
4. `lib/promptset.mjs`：`SOURCES` 加 `'llm'` + 两处口径同步（模块头注释「本轮不做 LLM 合成」改口指向本契约；`source` 非法报错文案从 `SOURCES` 常量派生、不再硬编码「只能 "user" 或 "builtin"」）——共三处、语义只动枚举（GRILL D5 修订）。
5. `bin/casey.mjs`：switch 加 `promptset-seed`/`promptset-freeze` 两 case（直通各自 bin，同 `scaffold-case` 先例）+ help 生命周期分步节两行（标注「authoring 期一次性、合成在 CLI 外、绝不进回放」）。
6. `tests/_golden/regress-promptset.golden.mjs`（冻结文件，重签）：第 61 行 `source:'llm'` 负向钉改正向 + 新增未知 `source`（`'robot'`）负向钉（枚举仍闭合，棘轮只挪边界不松方向）。
7. `tests/_golden/cli-mcp-face.golden.mjs`（冻结文件，双 prd 共冻，重签）：`CLI_MCP_EXCLUDED` 追加 `promptset-seed`/`promptset-freeze` + 注释记理由（GRILL D6：authoring 一次性工序、驱动者是仓内有 shell 的 coding agent，镜像 `scaffold-case` 先例；后续易用性契约可补工具并移出）；A4 增补反向断言 `CLI_MCP_EXCLUDED` ⊆ switch 派生命令集——现 A4 只遍历派生集、EXCLUDED 里多出的幽灵成员永远抓不到，堵「加了 EXCLUDED 却没接 switch」的假绿（当前九成员均在 switch 在位，断言即时可绿）。
8. `CONTEXT.md`：登记 合成种子模板 / 被测参数候选 / 幂等冻结 三词条（GRILL D8）+ `promptset` 词条 `source` 枚举更新为 `user|builtin|llm`。
9. `docs/design/txt2testreport-design.md`：§13 头注「不做 LLM 合成（authoring 属后续独立契约）」改口指向本契约；§13.2 `source` 注释同步；新增 §13.7「合成 authoring（CLI 外 LLM）」小节（两段命令 + 铁不变量）。
10. `loop/prd-gen-prompts.json`（新）：stories + `testChecksums` 冻结 `tests/_golden/gen-prompts.golden.mjs`，并同表冻结 `bin/verdict.mjs` 与 `lib/sign-gate.mjs` 当前 sha256 基线——全仓 `testChecksums` 枚举核过，此前无任何 prd 冻这两份文件，「裁判字节不动」只有行为守卫（`verdict-purity-guard`）没有字节锚；本契约把铁不变量落成机器可验（非测试文件入 `testChecksums` 有 `loop-kit/lib/boot.mjs`、`tests/fixtures/fake-sut/server.mjs` 等先例；日后合法改动走重签纪律）。

## 非目标

不做 CLI 内 LLM 合成 / API / 凭据 / 网络接线（形态定案）；不动 `bin/verdict.mjs`（裁判零 LLM）、`lib/sign-gate.mjs`（冻结/人签闸）、`prompts/_lib/*.json`（注入向量库，freeze 只写用户 promptset）、`mcp/casey-server.mjs`（走 EXCLUDED）；不做交互式逐条核对入口（会话即交互面）；不动 `.claude/skills/casey`（挂账）；候选语义质量 route:human 抽检、不做机器评分；不做 freeze 侧条数/类别分布校验（三类覆盖是模板指引非硬契约，见 GRILL D1 修订）；不做内部域名的静态识别（私网地址扫描只覆盖可枚举的保留网段，内部域名证不出、route:human 抽检兜）；不改 `bin/verdict-purity-guard.mjs` 本体（其有限禁单的加严走本契约金牌白名单核，不动 `prd-model-lane-guard` 冻结面）。

## touchesFiles

新建：`lib/promptset-authoring.mjs`、`bin/promptset-seed.mjs`、`bin/promptset-freeze.mjs`、`tests/_golden/gen-prompts.golden.mjs`、`loop/prd-gen-prompts.json`、`docs/plans/gen-prompts/proposed/GRILL.md`、`docs/plans/gen-prompts/plan.md`。
修改：`lib/promptset.mjs`（`SOURCES` 一行）、`bin/casey.mjs`（两 case + help）、`tests/_golden/regress-promptset.golden.mjs`（冻结，重签）、`tests/_golden/cli-mcp-face.golden.mjs`（冻结，双 prd 重签）、`CONTEXT.md`、`docs/design/txt2testreport-design.md`、`loop/prd-regress-promptset.json`、`loop/prd-cli-mcp-face.json`、`loop/prd-mcp-parity.json`（后三份仅 `testChecksums` 重签）。
不碰：`bin/verdict.mjs`、`lib/sign-gate.mjs`、`prompts/_lib/*.json`、`mcp/casey-server.mjs`、`.auth/`、`site.json`。

## 红先行金牌清单（`tests/_golden/gen-prompts.golden.mjs`，hermetic 零真机零凭据零 chromium）

先验红方式：金牌文件先落、`loop/prd-gen-prompts.json` 以其 sha256 冻结，实现前跑金牌——两个新 bin 与 `lib/promptset-authoring.mjs` 尚不存在，S/F 组全红；P1 因 `SOURCES` 尚无 `llm` 而红。红证留档后才开 accept（`--red-verified`）。

- S1 种子确定性：同种子输入（agent 名 + embedded + n）双跑产物字节相同、无时刻字段、LF 行尾（node 数 `0x0d` 为 0）；embedded 给 CRLF 文件 → 产物 `0x0d` 仍为 0（先规范化再嵌入）；embedded 在 4000 码点边界压非 BMP 字符（emoji）→ 产物无孤立代理对（`isWellFormed`）且带「已截断」标注。先红：`bin/promptset-seed.mjs` 缺席 → spawn 非零。
- S2 种子内容契约：模板含 id 形状 `^[a-z0-9_]+$`、禁 `bnd_`/`sec_` 前缀、category 三枚举、expect 软期望字段说明 + 「软期望绝不判红」申明、凭据概念约束用纯中文表述（访问令牌/口令/密钥等——模板全文不得出现英文禁字段子串）、`--n` 条数、embedded 节选、交付 freeze 步骤；同时直接断言 `credentialGate({seed: 模板全文}).ok === true`（内容契约与凭据门自洽——实测门对含英文禁词的文本 `ok:false`，若模板写英文示例词则 happy 路径被自家门锁死、弱语义断言会假绿）；三类覆盖文案随 n 条件化：n≥3（默认 6）断言「normal/boundary/security 三类全覆盖」在文，n=2 断言改为不作三类硬性要求的表述（n<3 时三类全覆盖数学上不可满足）。先红：同 S1。
- S3 种子门与负向：缺参/裸旗标 64；`--n` 越界（非 1..50 整数）64；`--agent-name` 命中凭据门 65；embedded 含凭据字面量 → exit 1 且零落盘；凭据出现在第 4000 码点之后 → 仍 exit 1（先全文过门、后截断）；embedded 夹私网地址哨兵（`http://10.…`、`https://172.16.…`、`http://192.168.…`、`http://127.…`、`fe80::…`）→ exit 1（`credentialGate` 不是地址门，实测私网地址过门 `ok:true`，靠独立地址扫描拦）；种子产物零裸 `://`；负向场景 stderr/stdout 均不含哨兵原值与输入绝对路径；两新 bin 源码零内网地址/零 `--base`/`--key`/`--model` 字样。先红：同 S1。
- S4 零 LLM/零网络闭包：`verdict-purity-guard --entry` 对两新 bin 均 exit 0；再加闭包白名单核（禁单之外的加严——守卫是有限禁单，未登记 SDK 如 `@google/generative-ai` 实测溜得过）：静态遍历两新 bin 的 import 闭包，每个说明符必须是 `node:` 内置（且不在守卫禁单）或仓内相对路径，任何第三方 bare 说明符即红；配金丝雀：合成一个 import 未登记 SDK 的夹具模块喂白名单核 → 必须能红（证明检查器活着）。先红：同 S1（entry 缺席非零）。
- S5 路径闸（seed）：`--out` 无 `.md` 后缀 65；`--out` canonical 化后指向保护面（`bin/`、`lib/`、`loop/`、`.auth/` 等，含经符号链接别名指入）→ 65 拒写且 `bin/verdict.mjs`/`lib/sign-gate.mjs` sha256 前后不变；`--out` 已存在 → 拒绝覆盖 65。先红：同 S1。
- F1 冻结 happy：候选 3 条（normal/boundary/security 各一）追加进已有 2 条的 promptset → 5 条、新条 `source` 全 `llm`、已有条目值深等保留（规范序列化）、产物过 `parsePromptset` 且与注入向量库 `mergeCases` 无撞。先红：`bin/promptset-freeze.mjs` 缺席。
- F2 幂等与冲突分明：同一候选文件再跑 → 0 新增、exit 0、整文件字节不变；同 id 不同 text 的候选 → 冲突整批拒 65、文件字节不变（内容冲突≠幂等重试，绝不静默吞成 0 新增 exit 0）；`--dry-run` 有新增 → 打印摘要且整个工作目录文件系统零差量（不止查目标文件）。先红：同 F1。
- F3 准入闸（整批拒、零写盘、exit 65）：id 非法 / 批内重复 / `bnd_`·`sec_` 前缀 / 自带 `source` / 未知键 / expect 坏形状 / text 空 / 候选非数组或空数组 / 已有 promptset 坏 JSON——逐场景断言目标文件字节不变；校验序钉：非法候选即使 id 已存在也整批拒（校验先于幂等跳过，堵「借已有 id 绕准入」）；批内重复且撞已有 id → 整批拒。先红：同 F1。
- F4 凭据门、地址门与原子性：候选 text 含凭据字面量 → exit 1 零写盘；候选 malformed JSON 且原文夹凭据哨兵 → 65/1 且 stderr/stdout 不含哨兵原值（解析前扫描 + 报错不透传 `e.message` 原文节选——实测 `JSON.parse` 报错带原文前缀）；新增候选 text 含私网地址或裸 `://` → 拒；直接 import `atomicWriteFileSync` 注入 write 失败与 rename 失败 → 目标原字节保留、无 `.tmp` 残留（非原子的裸 `writeFileSync` 实现过不了）；happy 路径跑完无 `.tmp` 残留。先红：同 F1。
- F5 路径闸（freeze）：`--promptset` 无 `.json` 后缀 65；canonical 化后指向保护面（含符号链接别名）→ 65 拒写、保护文件 sha256 前后不变。先红：同 F1。
- P1 `source` 枚举扩展：`parsePromptset` 收 `source:'llm'`；未知 `source`（`'robot'`）仍抛且报错文案含 `llm`（文案从 `SOURCES` 派生的口径钉）。先红：现 `SOURCES` 无 `llm` → 前半段抛即红。
- N1 不进回放/裁定闭包（防退化钉）：静态解析 `bin/replay.mjs`、`bin/verdict.mjs`、`bin/promptset.mjs` 的 import 闭包，断言不含 `promptset-authoring` 与两新 bin；再对这三份文件源文本扫 `promptset-seed`/`promptset-freeze`/`promptset-authoring` 字样为零——`bin/promptset.mjs` 本就用 `node:child_process` 的 `spawnSync` 编排其他 bin，spawn 边不走 import 图、仅闭包核堵不住；红先行验法 = 临时把断言目标指向一个已知在闭包内的模块证明检查器真能红，再指回（红证记档）。
- C1 CLI 门面（两命令全覆盖）：`casey help` 列出两命令且带「合成在 CLI 外」表述；`casey promptset-seed` 缺参经门面透传 64；`casey promptset-freeze` 缺参经门面透传 64 + 一次 `--dry-run` happy 经门面 exit 0——堵「两 bin 都在、help 都列、EXCLUDED 都加，唯独 switch 漏接 freeze」的假绿（A4 只遍历 switch 实有 case，EXCLUDED 多出的成员抓不到）。先红：门面 case 未加 → 断言红。

配套改动的既有金牌（改后复跑，属重签验收）：`regress-promptset.golden.mjs`（P 组 `llm` 正向 + `robot` 负向）、`cli-mcp-face.golden.mjs`（A4 覆盖断言在 EXCLUDED 更新后过 + 新增 `CLI_MCP_EXCLUDED` ⊆ switch 派生集反向断言）。

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
