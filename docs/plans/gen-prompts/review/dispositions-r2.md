# gen-prompts round-2 逐条处置（修复者 sonnet5，2026-07-14）

round-2 双路异构冗余复核：codex（gpt-5.6-sol@medium）判「需修改」（`docs/plans/gen-prompts/review/codex-r2.md`），pi（deepseek-v4-pro@high）判「通过」（`docs/plans/gen-prompts/review/pi-r2.md`）。两路结论不一致——codex 给出 4 条带文件+行号+可复现实测的具体缺陷，pi 未独立发现同类问题。逐条核实后，codex 的 4 条全部复现属实、逐条修死；pi 的「通过」未被本轮新证据推翻或证伪，只是覆盖面不如 codex 深（这不构成对 pi 结论本身的反驳，是两路独立评审的正常覆盖差异）。

## codex-r2 第 1 条：A1（HIGH）未兑现——真实地址仍留在 round-1 处置文档与 round-2 评审材料里

**问题**：`docs/plans/gen-prompts/review/dispositions-r1.md:14` 在描述"全仓 sweep 已清零"这一事实时，把被清零的地址字面量本身又写了一遍（连同 `material-r2.md` 里引用同一段文字的对应位置），自相矛盾——一边宣称"任何内网/真目标地址不许出现在代码与文档"已兑现，一边在同一份文档里把该地址重新写了回去。`material-r2.md` 里嵌入的 diff 摘录（旧行 `-` 那侧）也原样带出该地址。

**核实**：codex 的复现方法可信——直接对已知（r1 阶段确认过的）地址字节串做检索，命中 `dispositions-r1.md:14`；`git show HEAD:docs/plans/gen-prompts/review/dispositions-r1.md` 里也命中，证明不只是工作区临时态。

**修法**：
- `dispositions-r1.md` 第 14 行改写为脱敏描述——不复述具体数字，只用"文件+行号已核对，不复述具体数值"的方式陈述同一件事实。
- `material-r2.md` 里对应的三处（复述 dispositions 原文一处、diff 摘录旧行两处）同步改写/替换为 `<REDACTED-真实内网地址>` 占位。
- 全仓检索确认（`grep -rn` 该字节串，排除 `node_modules`）0 处命中，包含所有 `.md` 评审归档文件与本次新增的 `dispositions-r2.md`/`material-r3.md` 自身。

**证据**：见下方"汇总核验"一节的检索结果。

## codex-r2 第 2 条：A6（MED）未完全兑现——仍有 WHATWG URL 可归一的等价编码漏检

**问题**：`lib/promptset-authoring.mjs` 的 `scanEquivalentEncodings`（round-1 版本）候选提取正则漏掉三种 codex 给出的具体形态：
1. 大写十六进制前缀 `0X7f000001`（round-1 正则硬编码小写 `0x`）；
2. 无分隔符的前导零八进制整串 `017700000001`（round-1 只认 8-10 位纯十进制，未覆盖前导零整串）；
3. 点分四段内混十六进制段 `0x7f.0.0.1`（round-1 点分正则要求每段都是纯十进制 `\d`，不认十六进制段）。

**核实（复现，`lib/promptset-authoring.mjs` round-1 版本）**：对三个字符串直接调用 `scanPrivateAddress`，均返回 `hit:false`；同时 `new URL('http://<token>/')` 均正确归一为 `127.0.0.1`，证明确是真实的检测漏洞而非误报。

**修法**：`scanEquivalentEncodings`（现 `lib/promptset-authoring.mjs:313` 起）改写：
- 十六进制前缀正则改 `/\b0[xX][0-9a-fA-F]+\b/g`（大小写前缀均收）；
- 新增 `/\b0[0-9]{1,11}\b/g`（前导零 + 1-11 位数字的整串，覆盖无分隔符八进制整串形态；与既有 8-10 位纯十进制正则并存，二者候选取并集）；
- 点分四段改用具名 `DOTTED_OCTET` 正则片段（`0x/0X` 十六进制 ｜ 前导零疑似八进制 ｜ 普通 1-3 位十进制），四段都可独立走三种形态之一。

**证据（对修复后代码逐一验证）**：
- `0X7f000001` → `scanPrivateAddress` 返回 `{hit:true,kind:'127.0.0.0/8'}`；
- `017700000001` → `{hit:true,kind:'127.0.0.0/8'}`；
- `0x7f.0.0.1` → `{hit:true,kind:'127.0.0.0/8'}`；
- round-1 已覆盖的五种原始形态（IPv6 展开回环/八进制点分/十进制整数/十六进制整串/百分号编码）复测仍全部 `hit:true`，无回归。

## codex-r2 第 3 条：本轮新引入的假阳性——普通版本号/小数被误判为内网地址

**问题**：codex 指出 round-1 的点分正则 `\b\d{1,8}(?:\.\d{1,8}){1,3}\b`（允许 1-3 次重复，即最少两段）会把"产品版本 10.20""重量 10.5 公斤"这类自然语言里的两段小数/版本号提取为候选，喂给 `URL()` 后被当成 CIDR 简写形式归一为 `10.0.0.20` 等，命中 `10.0.0.0/8`，导致合法候选被 `freeze` 误拒。

**核实（复现，round-1 版本）**：对 `产品版本 10.20`、`重量 10.5 公斤` 两条干净中文语料调用 `scanPrivateAddress`，均返回 `{hit:true,kind:'10.0.0.0/8'}`——确认是真实的功能性假阳性，不是理论担忧（这类"两段小数"在中文测试语料里极常见：版本号、章节号、重量、金额、比例等）。

**修法**：点分正则从"1-3 次重复"（2-4 段均可）收紧为**恰好四段**（`DOTTED_OCTET(?:\.DOTTED_OCTET){3}`）——不再放行两段/三段简写形式；`10.20`（两段）不再落入候选提取范围，因此不再被喂给 `URL()` 做 CIDR 简写归一。代价：不再识别两三段简写等价形式（如 `10.20` 本身若真被当成主机名使用），判定为可接受的残余缺口（同既有"内部域名形态无法穷举，route:human 抽检兜底"口径），因为放行两三段简写造成的假阳性代价（误伤大量自然语言数字模式）远高于其检测收益（两三段简写在真实网络请求里本就罕见）。

**证据（对修复后代码逐一验证）**：
- `产品版本 10.20`、`重量 10.5 公斤`、`参见第 13.7 节`、`价格是 19.99 元`、`订单号是 20260713`、`现在是 08:00`、`版本 v10.2.3 发布` 等一批干净语料复测，全部 `{hit:false}`（无假阳性）；
- codex 给出的三个真缺陷形态（大写十六进制/前导零八进制整串/十六进制点分混合）与 round-1 五个原始形态复测仍全部 `{hit:true}`（检测能力不倒退）。

## codex-r2 第 4 条：A7（MED）未兑现——N1b 的近似去注释可被字符串字面量绕过

**问题**：round-1 对 N1b 的修订（改扫整个 import 闭包、去注释后再扫）仍可被绕过——codex 给出具体构造：

```js
const marker = "/*promptset-freeze*/";
spawnSync(process.execPath, ["/repo/bin/" + marker.slice(2, -2) + ".mjs"]);
```

`stripCommentsForScan()` 的块注释正则 `/\/\*[\s\S]*?\*\//g` 不辨"字符串字面量内碰巧长得像块注释的子串"与"真注释"，会把 `marker` 变量里的目标名字面量当成注释吞掉，导致后续子串扫描看不到"promptset-freeze"这个词，产生漏检。codex 同时指出：即便不利用这个去注释缺陷，普通字符串拼接（`'a'+'b'`）本就能绕过任何连续子串搜索——这是 round-1 汇裁时 arb-r1.md 已经点出的"动态拼名可绕"局限，round-1 的改动只扩大了扫描文件范围，没有解决这个根本局限。

**核实**：codex 给出的构造语法正确、逻辑成立；`stripCommentsForScan` 确实是纯正则近似、不辨字符串边界，这是可复现的真实局限（不是臆测）。

**修法**：不再试图把"字符串内容子串扫描"修成对抗式防线（这在不引入真正 JS 语法解析器的前提下做不到，超出本契约合理的工程投入）。改用一个不依赖"目标字符串内容长什么样"的正交角度——**结构化 spawn 调用点计数**：数三份闭包源码里 `spawnSync(`/`spawn(`/`exec(`/`execSync(`/`execFile(`/`execFileSync(` 这类"调用形态本身"（要求紧跟开括号，`import { spawnSync }` 这种解构导入不算）出现的总次数，与已审计过的现状基线比对（`replay`/`verdict` 闭包基线 0，`promptset` 闭包基线 1——`bin/promptset.mjs` 的 `runNode` helper，编排 `replay`/`verdict`/`report` 三个既有 bin，非本契约新增）。任何新增调用点（不论其参数字符串如何拼接/混淆）都会让计数超过基线——因为"调用本身是否存在"这件事，不像"调用参数字符串的具体内容"那样能被拼接/注释手法隐藏。codex 给出的 PoC 本身就包含一次真实的 `spawnSync(` 调用形态，会被新计数逻辑照单全收。

保留 round-1 的 N1b（子串扫描 + 去注释）作为非对抗式的尽力检测层（能挡住"完整字符串字面量直接出现"这类最常见的疏忽性退化，且改动幅度小、维护成本低），但在其注释里如实标注局限、指向 N1c 作为对抗式防线，不再单独宣称它"堵住了绕过"。

新增 N1d 金丝雀：用 codex 给出的原始构造（合成对照，落临时目录、不改动仓内文件）验证——① N1c 确实会判红（证明有牙）；② N1b 的去注释近似确实会把这份构造里的目标名吞掉（如实佐证局限存在、解释为何需要 N1c，而非空口宣称）。

**证据**：
- 结构化计数基线核实：`replay` 闭包（11 个文件）spawn 调用点计数 0；`verdict` 闭包（1 个文件）0；`promptset` 闭包（3 个文件）1（`bin/promptset.mjs:42` 的 `runNode` 里那一处）。
- N1d 金丝雀：对 codex 给出的合成构造直接统计 `SPAWN_CALL_RE` 命中数 > 0（会被 N1c 判红）；同时验证 `stripCommentsForScan` 确实把该构造里的 `promptset-freeze` 目标名吞掉（`stripped.includes('promptset-freeze') === false`），坐实局限说明不是空话。
- 金牌全量复跑：74 过 / 0 败（较 round-1 收口时新增 N1c、N1d 两条，及 F4c1/F4c2 复测仍绿）。

## 未被本轮采纳的分歧：pi-r2 的 PASS 结论

pi（deepseek-v4-pro@high）本轮判 PASS，逐条复核 round-1 的 10 项 finding 均认为已妥善处置，且明确审计了 `sanitizeFreezeError` 正则提取、`wx`+随机 tmp 名竞态、`scanEquivalentEncodings` 假阳性/性能、`stripCommentsForScan` 绕过等四个 codex round-2 指令里点名要求复核的风险点，结论是"均未发现新缺陷"。这与 codex 独立给出的 4 条具体缺陷（本文档已逐条复现属实）方向相反。

核实：pi 的审计文字里对 `scanEquivalentEncodings` 假阳性的评估是"narrow extraction... plus normalisation... No regression"——但没有给出具体反例语料去验证，属于评估性判断而非复现性验证；对 `stripCommentsForScan` 的评估同样停在"heuristic...guard is not intended to foil an adversary"的一般性论述，没有像 codex 那样给出可执行的绕过构造。这不代表 pi 的评审"错了"或"不认真"——两路评审对同一代码区域给出不同深度的复核结论，是异构评审的正常覆盖差异（pi 覆盖了逐条 finding 兑现验证与红先行证据可信性两个维度都很扎实，只是在"本轮修复本身是否引入新缺陷"这一项上不如 codex 深挖到具体反例）。本轮不因 pi 给 PASS 就跳过 codex 的具体证据，4 条 codex finding 已逐条修死；不因 codex 给 NEEDS CHANGES 就否定 pi 的 PASS 本身成立与否——两路结论都如实记录在案，供后续 round-3 交叉验证。

## 汇总核验

- 全仓地址字节串检索（脱敏方式核对，排除 `node_modules`）：0 处命中，含所有新旧评审归档 `.md` 文件。
- `node tests/_golden/gen-prompts.golden.mjs`：74 过 / 0 败。
- `lib/promptset-authoring.mjs` 当前 sha256：`19a10fd9a0da4fdc927cf8af57eb968a9da0d3186cd66f247489b1c867f3a8a0`。
- `tests/_golden/gen-prompts.golden.mjs` 当前 sha256：`5509011211d0e2e90812ea115381450b14ec200f19e748d13cf6f564b26f1465`（`prd-gen-prompts.json` 已同步重签，gate 复跑 GREEN）。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`lib/promptset.mjs`、`tests/_golden/cli-mcp-face.golden.mjs` 本轮（round-2 修订）仍零改动。
