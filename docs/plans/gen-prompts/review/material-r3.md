# gen-prompts 修复层评审料（r3，round-2 finding 修复后，异构冗余评审第三轮）

本文件是喂给异构评审者（codex / pi）的 round-3 评审料：只含 round-2 修复的 `git diff`（round-3 校订：下方 diff 是对 commit `db3ab4d` 按路径过滤后的子集，只保留 `lib/promptset-authoring.mjs`、`tests/_golden/gen-prompts.golden.mjs`、`docs/plans/gen-prompts/review/dispositions-r1.md` 三个"代码/关键文档修法"文件；该 commit 实际共改动 8 个文件，另外 5 个是本轮新增的评审归档 `codex-r2.md`/`dispositions-r2.md`/`material-r2.md`/`pi-r2.md` 与 `loop/prd-gen-prompts.json` 的 checksum 重签，均非"修法"本身、故未列入下方 diff——round-3 codex 复核指出此前措辞"仅列受影响的 3 个文件"未讲清楚是刻意过滤而非遗漏，已订正）+ round-2 逐条处置表（`dispositions-r2.md` 全文）。不含凭据、不含无关代码、不含实现者内心推理（护栏 #9）。

评审对象：round-2 双路复核结果——codex（gpt-5.6-sol@medium）本轮判 NEEDS CHANGES，给出 4 条具体缺陷（`docs/plans/gen-prompts/review/codex-r2.md`）；pi（deepseek-v4-pro@high）本轮判 PASS（`docs/plans/gen-prompts/review/pi-r2.md`）。修复者核实 codex 的 4 条全部可复现属实，逐条修死（commit `db3ab4d`，父提交 `1416147`）。round-1 相关归档见 `docs/plans/gen-prompts/review/arb-r1.md`/`codex-r1.md`/`pi-r1.md`/`dispositions-r1.md`；round-2 相关归档见 `material-r2.md`/`dispositions-r2.md`。

**本轮请重点核实**：
1. codex round-2 的 4 条具体缺陷是否每条都真被兑现（不是文案改了但逻辑没变、或改了留新缺口）——尤其是：地址字面量是否真的从所有文档里清除、`scanEquivalentEncodings` 补的三种形态是否真的检测得到、点分正则收紧到恰好四段是否真的堵死了假阳性同时没有引入新的假阴性、N1c 的结构化 spawn 调用点计数是否真的堵住了 codex 给出的绕过构造；
2. round-2 修复本身有没有引入新的缺陷——特别关注：`scanEquivalentEncodings` 收紧到"恰好四段"后，是否遗漏了本该检测的常见形态（比如标准四段但某段用了不寻常的十六进制/八进制写法之外的其他表示）；`N1c` 的 `SPAWN_CALL_RE` 正则本身是否有遗漏的 spawn 家族函数名、或者是否可能因为白名单基线写死为具体数字而在未来合法新增 spawn 用途时产生噪音（工程可维护性角度，非安全角度）；
3. 铁不变量是否仍然成立：裁判零 LLM（`bin/verdict.mjs`、`lib/sign-gate.mjs` 字节不动）、authoring 绝不进回放/裁定闭包、零 API key/零网络/零凭据接线、任何内网/真实目标地址不出现在代码与文档（含本次评审材料自身、含 round-1/round-2 所有归档文档）。

给出明确结论：PASS 或 NEEDS CHANGES（若 NEEDS CHANGES，请给文件路径+行号+可复现的实测依据，不要臆测）。

## 门禁证据摘录

```
$ node tests/_golden/gen-prompts.golden.mjs
gen-prompts golden: 74 过 / 0 败

$ node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json
ok    ratchet  tests/_golden/gen-prompts.golden.mjs
ok    ratchet  bin/verdict.mjs
ok    ratchet  lib/sign-gate.mjs
ok    term     术语检查通过
ok    s1-gen-prompts-seed-freeze  node tests/_golden/gen-prompts.golden.mjs
ok    s2-tier1-regression  node bin/casey.mjs selftest --tier1

gate: GREEN —— story 2/2 过

git diff --stat 1416147..db3ab4d -- bin/verdict.mjs lib/sign-gate.mjs lib/promptset.mjs tests/_golden/cli-mcp-face.golden.mjs
（空——round-2 仍零改动，裁判进程与既有共冻 prd 无需重签）
```

---

# round-2 逐条处置表（dispositions-r2.md 全文）

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
- `tests/_golden/gen-prompts.golden.mjs` 当前 sha256：`5509011211d0e2e90812ea115381450b14ec200f19e748d13cf6f564b26f1465`（`prd-gen-prompts.json` 已同步重签，gate 复跑 GREEN——round-3 校订：本行此前与 `dispositions-r2.md` 当时的最新状态不同步，误留"待同步重签"字样，已订正一致）。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`lib/promptset.mjs`、`tests/_golden/cli-mcp-face.golden.mjs` 本轮（round-2 修订）仍零改动。

---

# round-2 修复 diff（`git diff 1416147..db3ab4d`，仅列受影响文件）

```diff
diff --git a/docs/plans/gen-prompts/review/dispositions-r1.md b/docs/plans/gen-prompts/review/dispositions-r1.md
index 7cb5260..a7da62a 100644
--- a/docs/plans/gen-prompts/review/dispositions-r1.md
+++ b/docs/plans/gen-prompts/review/dispositions-r1.md
@@ -11,7 +11,7 @@
 4. 顺带清理：`docs/plans/gen-prompts/review/material-r1.md` 里两处引用该真实地址的评审材料原文（第 1894、1926 行附近）做了脱敏替换（`<REDACTED-真实内网地址>`），因为它是即将随本轮提交进仓库历史的文档，"任何内网/真目标地址不许出现在代码与文档"对文档同样成立。
 
 **证据**：
-- 全仓 sweep：`grep -rn "<REDACTED-真实内网地址>" .`（排除 node_modules）在本轮修复后返回 0 处命中（修复前返回 `tests/_golden/gen-prompts.golden.mjs:212` 与 `:244` 两处，与 `regress_autotest/scripts/gen-prompts.mjs:27` 的默认 API 基址逐字节一致，已核对）。
+- 全仓 sweep（脱敏方式核对，不在本文档写出该地址字面量本身——写出即视为把它重新带回仓库）：修复前 `tests/_golden/gen-prompts.golden.mjs:212` 与 `:244` 两处含一个私网地址字面量，与 `regress_autotest/scripts/gen-prompts.mjs:27` 的默认 API 基址逐字节一致（已用文件+行号核对，不复述具体数值）；修复后对该字面量的全仓字符串检索（排除 `node_modules`）0 处命中，包括本篇处置文档与 round-2 评审材料自身。
 - S3i 红先行：新常量刚加入、检查逻辑写成"计数"式之前，先在会话里对旧版金牌文本手工计数确认 `--base` 等字样只应出现 1 次而不查金牌自身是假绿的路径；写成 S3i 后跑一次金牌，因检查描述字符串本身含 `--base` 使计数变 2，判红（真实抓到"自身包含旗标字样超过 1 次"这一类问题，即便触发原因是描述文案而非真实残留），随即把 S3h 描述文案里的具体旗标名去掉、S3i 转绿——证明该检查确有分辨力，不是摆设。
 
 ## A2（HIGH）错误路径回显原始字段值，违 D3 output-seal
@@ -28,7 +28,7 @@
 ## A3 / A8（HIGH / MED，同根）固定 `.tmp` sidecar 符号链接可覆写受害文件；并发共用同一 tmp 名
 
 **修法**：`lib/promptset-authoring.mjs` 的 `atomicWriteFileSync`（第 254-268 行）：
-1. tmp 名从固定 `${path}.tmp` 改为 `` `${path}.${randomBytes(9).toString('hex')}.tmp` ``（第 257 行，72 位随机熵）——每次调用互不相同，структур上消除"两进程/两次调用共用同一 tmp 名互相覆写"（A8 的主要子问题）。
+1. tmp 名从固定 `${path}.tmp` 改为 `` `${path}.${randomBytes(9).toString('hex')}.tmp` ``（第 257 行，72 位随机熵）——每次调用互不相同，结构上消除"两进程/两次调用共用同一 tmp 名互相覆写"（A8 的主要子问题）。
 2. 默认 `writeFn` 加 `{ flag: 'wx' }`（第 254 行，`O_CREAT|O_EXCL|O_WRONLY`）——POSIX 语义下，目标路径若已是符号链接（不论悬空与否），`open()` 必以 `EEXIST` 失败、绝不跟随，作为第二道防线。
 3. `mkdirSync` 便利建目录在写失败时留下的空目录残留，维持原设计取舍（代码注释里原本已声明"不是原子性契约的一部分，纯为便利"）——本轮不做事务化建目录回滚，判定为可接受的既有取舍，非本轮新增问题，见下方"未完全解决的边角"说明。
 
diff --git a/lib/promptset-authoring.mjs b/lib/promptset-authoring.mjs
index dedbeab..e0d8f82 100644
--- a/lib/promptset-authoring.mjs
+++ b/lib/promptset-authoring.mjs
@@ -301,20 +301,32 @@ export function scanPrivateAddress(text) {
   return { hit: false };
 }
 
-// 数字型主机等价编码扫描（round-1 MED A6）：既有正则只认标准点分十进制字面量，漏检 WHATWG URL 主机解析器
-// 会认得的等价写法——十进制 32 位整数（2130706433）、八进制前导零每段（0177.0.0.1）、十六进制（0x7f000001）、
-// 百分号编码点号（127%2e0%2e0%2e1）。用 Node 内置 URL（无第三方依赖，S4 零第三方裸说明符不破）把「像数字型
-// 主机」的片段丢给标准解析器归一，再用既有网段正则核对归一结果——不是重新枚举网段，是复用上面那份权威清单。
-// 候选提取刻意收窄（只挑十六进制前缀/点分数字串/长十进制串/百分号编码点号片段），避免把任意散落数字都喂进
-// 解析器造成误判；仍非穷举——更冷门的等价写法与内部域名形态静态证不出，route:human 抽检兜底（同既有说明）。
+// 数字型主机等价编码扫描（round-1 MED A6，round-2 codex 复核后加固）：既有正则只认标准点分十进制字面量，
+// 漏检 WHATWG URL 主机解析器会认得的等价写法——十进制 32 位整数（2130706433）、八进制前导零整串
+// （017700000001）、十六进制（0x7f000001/0X7f000001，大小写前缀均收）、点分四段内混十六进制/八进制段
+// （0x7f.0.0.1）、百分号编码点号（127%2e0%2e0%2e1）。用 Node 内置 URL（无第三方依赖，S4 零第三方裸说明符
+// 不破）把「像数字型主机」的片段丢给标准解析器归一，再用既有网段正则核对归一结果——不是重新枚举网段，是
+// 复用上面那份权威清单。
+//
+// round-2 codex 复核修订两处：
+//   1) 点分形式改硬性要求恰好四段（不再放行两三段简写）——round-1 版本用 `{1,3}` 重复允许两段就命中，
+//      而 WHATWG 对两段点分（如 "10.20"）按简写 CIDR 记法归一成 10.0.0.20，导致任何形如「版本号/小数」的
+//      自然语言文本（如「产品版本 10.20」「重量 10.5 公斤」）都被误判命中——实测坐实、已用干净语料回归钉死；
+//      收窄到恰好四段后不再触发该假阳性，代价是不再识别两三段简写等价形式（非穷举，同既有口径）；
+//   2) 补两处此前漏检形态：大写 0X 前缀；无分隔符的前导零八进制整串（此前只认 8-10 位纯十进制，漏了
+//      017700000001 这类前导零形态——纯十进制自然写法几乎不带前导零，专开一条不显著扩大误报面）。
 function tryUrlNormalizeHost(token) {
   try { return new URL(`http://${token}/`).hostname; } catch { return null; }
 }
+// 点分四段的单段形态：十六进制前缀（0x/0X）｜前导零疑似八进制（0 + 1-3 位 0-7 数字）｜普通 1-3 位十进制。
+const DOTTED_OCTET = '(?:0[xX][0-9a-fA-F]+|0[0-7]{1,3}|\\d{1,3})';
+const DOTTED_QUAD_RE = new RegExp(`\\b${DOTTED_OCTET}(?:\\.${DOTTED_OCTET}){3}\\b`, 'g');
 function scanEquivalentEncodings(text) {
   const candidates = new Set();
-  for (const m of text.matchAll(/\b0x[0-9a-fA-F]+\b/g)) candidates.add(m[0]);
-  for (const m of text.matchAll(/\b\d{1,8}(?:\.\d{1,8}){1,3}\b/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(/\b0[xX][0-9a-fA-F]+\b/g)) candidates.add(m[0]);
   for (const m of text.matchAll(/\b\d{8,10}\b/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(/\b0[0-9]{1,11}\b/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(DOTTED_QUAD_RE)) candidates.add(m[0]);
   for (const m of text.matchAll(/(?:\d{1,3}%2[eE]){1,3}\d{1,3}/g)) candidates.add(m[0]);
   for (const tok of candidates) {
     const hostname = tryUrlNormalizeHost(tok);
diff --git a/tests/_golden/gen-prompts.golden.mjs b/tests/_golden/gen-prompts.golden.mjs
index 80ee4fd..ca49f5b 100644
--- a/tests/_golden/gen-prompts.golden.mjs
+++ b/tests/_golden/gen-prompts.golden.mjs
@@ -16,9 +16,15 @@
 //
 // round-1 异构冗余评审（codex+pi，fable@xhigh 汇裁，docs/plans/gen-prompts/review/arb-r1.md）修订钉：
 //   A1（金牌自身含姊妹项目真实内网地址）S3f 改合成占位地址 + S3h/S3i 扩自扫描面；A2（错误回显原字段值）
-//   F3o/F4k 不回显钉；A3/A8（固定 .tmp 符号链接可覆写）F4h/F4i；A4（0 新增绕自检）F2d；A5（term-lint
-//   parseRegistry 幽灵别名，both）T1；A6（地址等价编码漏检）F4c 已扩五形态；A7（N1 spawn 扫描面窄）N1b 改
-//   闭包扫描；A9（--dry-run 打全文）F2c 摘要钉；A10（存量藏凭据/地址未钉）F4j。
+//   F3o/F4j 不回显钉；A3/A8（固定 .tmp 符号链接可覆写）F4h/F4i；A4（0 新增绕自检）F2d；A5（term-lint
+//   parseRegistry 幽灵别名，both）T1；A6（地址等价编码漏检）F4c1/F4c2；A7（N1 spawn 扫描面窄）N1b 改闭包
+//   扫描；A9（--dry-run 打全文）F2c2 摘要钉；A10（存量藏凭据/地址未钉）F4j。
+// round-2 codex 复核（docs/plans/gen-prompts/review/codex-r2.md）再修订：A6 补大写十六进制前缀/无分隔符
+//   前导零八进制整串/点分段内混十六进制三处漏检，且把点分形式收紧到恰好四段以堵死"版本号/小数被误判地址"
+//   的新增假阳性（如「产品版本 10.20」）；A7 加 N1c 结构化 spawn 调用点计数（不依赖目标字符串内容，数调用
+//   形态本身，堵住 N1b 可被"目标名字面量藏进会被误当注释吞掉的 /*.../ 形态"绕过的缺口）+ N1d 金丝雀；round-1
+//   处置文档 dispositions-r1.md 里误把已作废真实地址字面量写进"证据"描述本身（自相矛盾：一边修一边在文档里
+//   重新写出同一地址）——已改脱敏描述、不复述具体数值。
 import {
   readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, symlinkSync, readdirSync, rmSync,
 } from 'node:fs';
@@ -812,12 +818,17 @@ check('N1a import 闭包核：bin/replay.mjs / bin/verdict.mjs / bin/promptset.m
 // 去块注释/行注释后再扫（镜像 bin/verdict-purity-guard.mjs 内部 stripComments 的同款近似做法，该函数未导出
 // 故本文件另起一份等价实现）——纯文档性质的交叉引用注释（如"见 lib/promptset-authoring.mjs"）不是 spawn 边，
 // 不该被误判；真正的 spawnSync(...) 调用/字符串拼目标必然落在可执行代码里，去注释后依然会被扫到。
+// 已知局限（round-2 codex 复核指出、如实记账，不夸大本钉效力）：本近似去注释器不辨"字符串字面量内碰巧长得
+// 像块注释的子串"（如 `"/*promptset-freeze*/"`）与真注释——刻意把这类子串误当注释去掉会制造漏检窗口；
+// 更根本地，即便不利用去注释，普通字符串拼接（如 `'promp'+'tset-freeze'`）本就能绕过任何连续子串搜索——
+// 这是本类静态文本扫描的固有局限，非本钉能力范围内可修。本钉仍有价值（能挡住"完整字符串字面量直接出现"
+// 这一类最常见的疏忽退化），但不是对抗式防线；对抗式防线见下方 N1c（结构化计数，不依赖字符串内容本身）。
 function stripCommentsForScan(text) {
   let s = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
   s = s.replace(/([^:'"\\])\/\/[^\n]*/g, '$1');
   return s;
 }
-check('N1b spawn 边扫描：三份回放侧文件的整个 import 闭包（不止入口自身）去注释后零 promptset-seed/promptset-freeze/promptset-authoring 字样（round-1 MED A7 修订：此前只查入口文件自身源文本，helper 转发 spawnSync 可绕；改核闭包内每个文件，去注释防文档性交叉引用误判）', () => {
+check('N1b spawn 边扫描：三份回放侧文件的整个 import 闭包（不止入口自身）去注释后零 promptset-seed/promptset-freeze/promptset-authoring 字样（round-1 MED A7 修订：此前只查入口文件自身源文本，helper 转发 spawnSync 可绕；改核闭包内每个文件，去注释防文档性交叉引用误判；非对抗式防线，见上方局限说明与下方 N1c）', () => {
   for (const [label, entry] of [['replay', REPLAY], ['verdict', VERDICT], ['promptset', PROMPTSET_BIN]]) {
     const { visited } = scanClosure(entry);
     const filesToScan = new Set([resolve(entry), ...visited]);
@@ -829,6 +840,51 @@ check('N1b spawn 边扫描：三份回放侧文件的整个 import 闭包（不
     }
   }
 });
+// 结构化 spawn 边计数（round-2 codex A7 复核后加固）：N1b 靠字符串内容本身（子串/去注释），可被"拼字符串
+// 拼目标名"绕过（codex 实测复现：`spawnSync(process.execPath, ["/repo/bin/"+marker.slice(2,-2)+".mjs"])`，
+// marker 里目标名字面量藏在会被误当注释去掉的 `/*.../*` 形态里）。本钉换一个不依赖目标字符串内容的角度：
+// 直接数三份闭包里"spawn 家族函数调用形态"（spawnSync(/spawn(/exec(/execSync(/execFile(/execFileSync( 等
+// 调用点，非 import 语句本身——`import { spawnSync }` 不含调用括号，不计入）出现的总次数，与已审计过的
+// 现状基线比对——任何新增调用点（不论其参数字符串如何拼接/混淆）都会让计数超过基线，因为「调用本身的存在」
+// 不像「调用的参数内容」那样能被字符串拼接/注释伪装隐藏。基线：verdict/replay 闭包 0 处；promptset 闭包 1 处
+// （`bin/promptset.mjs` 的 `runNode` helper，编排 replay/verdict/report 三个既有 bin，非本契约新增、非本契约
+// 关注的两个 authoring bin）。仍非无懈可击（动态计算函数名本身，如 `child_process['spawn'+'Sync']`，可再绕；
+// 但那已是完全不同量级的刻意混淆，静态文本分析的公认边界，同「内部域名形态无法穷举」既有口径）。
+const SPAWN_CALL_RE = /\b(?:spawnSync|spawn|execSync|exec|execFileSync|execFile)\s*\(/g;
+const SPAWN_CALL_SITE_BASELINE = { replay: 0, verdict: 0, promptset: 1 };
+check('N1c 结构化 spawn 调用点计数不超基线（round-2 codex A7 复核加固：不依赖拼接目标字符串内容，数调用形态本身出现次数）', () => {
+  for (const [label, entry] of [['replay', REPLAY], ['verdict', VERDICT], ['promptset', PROMPTSET_BIN]]) {
+    const { visited } = scanClosure(entry);
+    const filesToScan = new Set([resolve(entry), ...visited]);
+    let total = 0;
+    for (const file of filesToScan) {
+      let src; try { src = readFileSync(file, 'utf8'); } catch { continue; }
+      const m = src.match(SPAWN_CALL_RE);
+      if (m) total += m.length;
+    }
+    if (total > SPAWN_CALL_SITE_BASELINE[label]) {
+      throw new Error(`${label} 闭包 spawn 调用点计数 ${total} 超过已审计基线 ${SPAWN_CALL_SITE_BASELINE[label]}（新增 spawn 调用点，需人工复核是否碰 authoring 两 bin）`);
+    }
+  }
+});
+check('N1d N1c 金丝雀：闭包内新增一个 spawn 调用点会被 N1c 判红（证明该检查有牙，非摆设；用临时目录合成对照，未改动仓内文件）', () => {
+  const d = freshDir('n1d');
+  const fakeEntry = join(d, 'fake-entry.mjs');
+  // codex round-2 实际给出的绕过写法：目标名字面量藏在会被 N1b 的去注释近似判成"块注释"的 /*.../ 形态里，
+  // 借此证明"即便 N1b 被绕过，N1c 仍能靠调用形态本身兜住"。
+  writeFileSync(fakeEntry, [
+    "import { spawnSync } from 'node:child_process';",
+    "const marker = \"/*promptset-freeze*/\";",
+    "spawnSync(process.execPath, ['/repo/bin/' + marker.slice(2, -2) + '.mjs']);",
+  ].join('\n'));
+  const src = readFileSync(fakeEntry, 'utf8');
+  const m = src.match(SPAWN_CALL_RE);
+  const count = m ? m.length : 0;
+  if (count <= SPAWN_CALL_SITE_BASELINE.verdict) throw new Error(`合成对照应命中 spawn 调用点计数 > 0（verdict 基线 0），实际 ${count}——检查器失能`);
+  // 同时佐证 N1b 的已知局限确实存在（去注释会把这份合成对照里的目标名字面量吞掉），解释为何需要 N1c。
+  const stripped = stripCommentsForScan(src);
+  if (stripped.includes('promptset-freeze')) throw new Error('本条金丝雀预期 N1b 的去注释近似会误吞目标名字面量（用以论证 N1c 存在的必要性）；实际未被吞，说明 stripCommentsForScan 实现已变化，需重新核对本注释的论证是否仍成立');
+});
 
 // ================= C1 CLI 门面（两命令全覆盖） =================
 check('C1a casey help 列两命令且带「合成在 CLI 外」表述', () => {
```
