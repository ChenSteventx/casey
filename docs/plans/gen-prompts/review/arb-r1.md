# gen-prompts 契约评审汇裁 round-1（fable@xhigh）

汇裁者 fable，2026-07-14。被评对象为 sonnet（Claude 家族）实现，按自评张力护栏默认采信跨族（codex/pi）findings，逐条独立复现后裁决。修完仍由 codex+pi round-2 跨族复核。

## 复现方式

在契约 worktree 内对 `bin/promptset-freeze.mjs`、`bin/promptset-seed.mjs`、`lib/promptset-authoring.mjs`、`tests/_golden/gen-prompts.golden.mjs`、`loop-kit`（`parseRegistry`）逐条构造最小复现（脚本落在会话 scratchpad，未进本树），凭据/私网哨兵一律用不落原值方式核对。裁判进程 `bin/verdict.mjs` 全程未碰。

## 重合 / 分歧 / 各自独有

- **重合（source=both）**：`term-lint` 的 `parseRegistry` 裸 `split('|')` 不认 `\|` 转义，把 `promptset` 词条描述列裂出幽灵弃用别名（codex MED8 = pi MED1）。已复现：`parseRegistry().deny` 数组确含该幽灵项、`term-lint --registry` 仍 exit 0。
- **分歧（同一代码区、结论相反）**：`freezeMergePromptset` 的 `fresh.length===0` 路径。codex（HIGH1）称「0 新增时提前 exit 0 绕过自检、坏存量被放行」；pi（MED2，自标弱反例）称「0 新增时 `existing.map(canonicalizeEntry)` 会丢弃额外字段、改变字节」。复现裁定：CLI 在 0 新增分支于 `bin/promptset-freeze.mjs:106-108` 直接 `未写盘 + exit 0`，**根本不把** `merged` 落盘——故 pi 的「改字节」claim 被证伪（实测存量含额外字段做 0 新增重跑，字节不变）；codex 的「跳过 `parsePromptset`+`mergeCases` 自检、坏存量得成功判」为机械事实（实测存量含 `source:'robot'` 非法项 + 候选全幂等 → exit 0）。采信 codex 方向，证伪 pi 的字节 claim。
- **codex 独有**：HIGH2（错误回显原字段值）、HIGH3（金牌含姊妹项目真实内网端点）、HIGH4（固定 `.tmp` sidecar 符号链接旁路）、MED5（地址扫描漏归一等价写法）、MED6（`spawn` 边金牌只扫三入口）、MED7（原子写并发/中断残留未覆盖）、LOW9（`--dry-run` 打整条正文）。
- **pi 独有**：LOW3（金牌缺「存量含凭据/私网地址 → freeze 拒」负面场景）。机制实存（`bin/promptset-freeze.mjs:84` 存量原文过门，实测 exit 1），仅金牌未钉，采信为测试覆盖缺口。

## 逐条裁决

| # | 严重度 | source | 结论 | 复现要点 |
|---|--------|--------|------|----------|
| A1 | HIGH | codex | 采信 | 金牌 `tests/_golden/gen-prompts.golden.mjs:212` 的私网哨兵地址（含端口+路径）与作废旧实现 `regress_autotest/scripts/gen-prompts.mjs:27` 默认 API 基址逐字节一致；`:244` 又把该地址列为 `S3h` 自身禁值扫描目标却只扫两新 bin、不扫金牌自身，构成假绿。直接违「任何内网/真目标地址不许出现在代码与文档」硬约束。 |
| A2 | HIGH | codex | 采信 | `bin/promptset-freeze.mjs:93` `die(65, e.message)` 与 `lib/promptset-authoring.mjs:121` 把未登记键名带进 `CandidateValidationError.message`；实测干净未知键哨兵完整出现在 stderr。存量非法 `source` 值经 `fresh>0` 触发的 `parsePromptset` 自检 `e.message` 完整回显（实测 exit 65 且回显该值）。违 D3 output-seal。 |
| A3 | HIGH | codex | 采信 | `lib/promptset-authoring.mjs:243` 固定 `${path}.tmp`，`writeFileSync` 跟随预置符号链接。实测预置 `x.json.tmp` → 受害文件，`atomicWriteFileSync(x.json, ...)` 直接截断并写入受害文件内容。D9 只 canonical 化最终目标、堵不住 sidecar；seed（`bin/promptset-seed.mjs:99`）同用此函数，同受影响。 |
| A4 | HIGH | codex | 采信（pi 同区反向 claim 证伪） | `bin/promptset-freeze.mjs:106` `fresh.length===0` 提前 exit 0，跳过 `:111-116` 的 `parsePromptset`+`mergeCases` green-by-construction 自检；坏存量（非法 `source` 或撞 `bnd_`/`sec_` 注入向量库前缀的既有条目）在幂等 no-op 重跑时被判成功。金牌 F2a 只用完全合法存量，测不出。属 green-by-construction 保证在 no-op 路径被静默旁路。 |
| A5 | MED | both | 采信 | `term-lint` `parseRegistry` 裸 `split('|')` 幽灵别名（详见上「重合」）。实现者已用 `term-lint:allow` 临时豁免；根因在 `loop-kit` 解析器（复用件、保护面），修法建议落 CONTEXT 词条书写或 `loop-kit` 上游，本契约挂账。 |
| A6 | MED | codex | 采信 | `lib/promptset-authoring.mjs:268` 正则只认点分十进制与压缩 IPv6。实测五种等价写法（展开 IPv6 回环、八进制/整数/十六进制 IPv4、百分号编码点号）`scanPrivateAddress().hit` 皆 false。裸主机形态不含 `://`，可绕 freeze 落盘。 |
| A7 | MED | codex | 采信 | `tests/_golden/gen-prompts.golden.mjs:641` `N1` 只查三入口 import 闭包与源文本；经普通 helper 转发 `spawnSync` 或动态拼名可绕。当前三 bin/lib 实测均无 `child_process`/`spawn`，属防退化覆盖缺口，非现存缺陷。 |
| A8 | MED | codex | 采信（与 A3 同根） | `lib/promptset-authoring.mjs:246` 固定 `.tmp` 名 + `mkdirSync` 便利建目录；金牌只在已存在目录串行注入失败，未覆盖并发共用 `.tmp` 互相覆写、及建目录后写失败的残留语义。 |
| A9 | LOW | codex | 采信 | `bin/promptset-freeze.mjs:118-120` `--dry-run` 打印 `JSON.stringify(fresh, null, 2)` 整条正文；GRILL D4「只打印新增摘要」。内容已先过凭据/地址门属干净，主要为设计口径不符 + 输出面偏大。 |
| A10 | LOW | pi | 采信 | 金牌无「存量藏凭据/私网地址 → freeze 拒」负面钉；机制实存（`bin/promptset-freeze.mjs:84`，实测存量含凭据 exit 1），仅缺覆盖。 |

## dispositions（证伪/挂账记录）

- pi MED2「0 新增改字节」：**证伪**——CLI 0 新增分支不写盘，实测字节不变；该代码区真正的隐患是 codex A4 的自检旁路，已单列。
- A5（`term-lint` 幽灵别名）：根因在复用件 `loop-kit`/CONTEXT 书写，非本契约新代码缺陷；挂账，修法待定（CONTEXT 词条改写或上游）。
- A7：现存实现无 `spawn`，属未来防退化覆盖加固，非当前 live 缺陷。
