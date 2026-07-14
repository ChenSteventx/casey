# gen-prompts 修复层评审料（r4，round-3 finding 修复后，异构冗余评审第四轮）

本文件是喂给异构评审者（codex / pi）的 round-4 评审料：只含 round-3 修复的 `git diff`（commit `1ccf8cb`，按路径过滤，只列 `lib/promptset-authoring.mjs` 与 `tests/_golden/gen-prompts.golden.mjs` 两个代码修法文件；该 commit 另改动 6 个评审归档/处置表/PRD 重签文件，均非"修法"本身，未列入下方 diff）+ round-3 逐条处置表（`dispositions-r3.md` 全文）。不含凭据、不含无关代码、不含实现者内心推理（护栏 #9）。

评审对象：round-2 双路复核结果——codex（gpt-5.6-sol@medium）round-3 判 NEEDS CHANGES，给出 4 条问题（`docs/plans/gen-prompts/review/codex-r3.md`）；pi（deepseek-v4-pro@high）round-3 判 PASS（`docs/plans/gen-prompts/review/pi-r3.md`）。修复者核实 codex 的 4 条全部可复现属实，逐条修死（commit `1ccf8cb`，父提交 `db3ab4d`）。round-1/round-2 相关归档见 `arb-r1.md`/`codex-r1.md`/`pi-r1.md`/`dispositions-r1.md`/`material-r2.md`/`codex-r2.md`/`pi-r2.md`/`dispositions-r2.md`。

**本轮请重点核实**：
1. codex round-3 的 4 条问题是否每条都真被兑现：
   - N1e（正向允许清单）是否真的堵住了"repoint 既有调用点"这个 round-3 才被发现的绕过——请具体尝试构造"把 `bin/promptset.mjs` 里某个 `bin('X.mjs')` 改成 authoring bin 名字"这类场景，看 N1e 是否真的判红；
   - `SPAWN_CALL_RE` 补 `fork` 后是否还有其他常见的 Node 进程创建方式遗漏（比如 `child_process.execFile` 的回调式重载、`Worker` 线程、动态 `import()` 载入可执行代码等——虽然这些超出"spawn 子进程"这个概念本身，但若评审认为值得纳入同一防线，请指出）；
   - 两三段地址简写维持不检测的取舍理由（词法上与自然语言数字不可靠区分）是否站得住，还是能想到更精细的区分特征；
   - F4c1 的扩容是否确实覆盖了 round-2 引入的全部新形态与假阳性场景；
2. round-3 修复本身有没有引入新的缺陷；
3. 铁不变量是否仍然成立：裁判零 LLM、authoring 绝不进回放/裁定闭包、零 API key/零网络/零凭据接线、任何内网/真实目标地址不出现在代码与文档（含本次评审材料自身、含所有历史归档）。

给出明确结论：PASS 或 NEEDS CHANGES（若 NEEDS CHANGES，请给文件路径+行号+可复现的实测依据，不要臆测）。

## 门禁证据摘录

```
$ node tests/_golden/gen-prompts.golden.mjs
gen-prompts golden: 76 过 / 0 败

$ node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json
ok    ratchet  tests/_golden/gen-prompts.golden.mjs
ok    ratchet  bin/verdict.mjs
ok    ratchet  lib/sign-gate.mjs
ok    term     术语检查通过
ok    s1-gen-prompts-seed-freeze  node tests/_golden/gen-prompts.golden.mjs
ok    s2-tier1-regression  node bin/casey.mjs selftest --tier1

gate: GREEN —— story 2/2 过

git diff --stat db3ab4d..1ccf8cb -- bin/verdict.mjs lib/sign-gate.mjs lib/promptset.mjs bin/promptset.mjs tests/_golden/cli-mcp-face.golden.mjs
（空——round-3 仍零改动，裁判进程/既有共冻 prd/bin/promptset.mjs 本体均无需重签或改动）
```

---

# round-3 逐条处置表（dispositions-r3.md 全文）

# gen-prompts round-3 逐条处置（修复者 sonnet5，2026-07-14）

round-3 双路异构冗余复核：pi（deepseek-v4-pro@high，重试后成功——首次调用因模型在 `--no-tools` 模式下仍尝试发起 `read_file` 工具调用而中断，改用明确告知"无工具、只依据已提供文本"的指令重跑后正常完成）判「通过」；codex（gpt-5.6-sol@medium）判「需修改」，给出 4 条具体问题。逐条核实并处置如下。

## codex-r3 第 1 条：A7 仍未关闭——N1c 漏 `fork()`，且计数基线允许"复用既有调用点、repoint 目标参数"

**问题**：`SPAWN_CALL_RE` 没收 `fork`；更关键的是，即便不利用这一点，codex 给出第二种绕过——直接改写 `bin/promptset.mjs:42` 既有那个合法调用点的目标参数，让它指向 authoring bin：调用点计数仍是 1（未新增），`1 > 基线 1` 为假，N1c 静默放行。

**核实**：两点都成立。`fork` 确实不在原正则里（在 pi round-3 复核里也被独立指出，属两路汇聚的真发现）；"repoint 既有调用点"这一招确实是 N1c"数总次数"这个设计天然的盲区——计数式检查只能证明"没有新增调用点"，证不出"既有调用点的目标没被改"。

**修法**：
1. `SPAWN_CALL_RE` 补 `fork`（`tests/_golden/gen-prompts.golden.mjs` 现第 853 行一带）。
2. 新增 N1e：正向允许清单核对 `bin/promptset.mjs` 里 `bin('<名字>.mjs')` 字面量出现的全部目标名集合，必须恰好等于已审计的四个既有编排目标 `{replay.mjs, verdict.mjs, report-model.mjs, report.mjs}`——出现未登记名字（尤其是两个 authoring bin）判红；四个既有目标任一缺失也判红（目标集合被意外收窄同样需要人工复核）。这从"数总次数"换成"核对具体是哪几个目标"，直接堵住 repoint 这一招——用合成 mutation 测试验证：把 `bin('verdict.mjs')` 替换成 `bin('promptset-freeze.mjs')` 后，N1e 的逻辑会命中该未登记名字判红。

**未完全解决的边角（如实记账）**：N1e 仍是文本模式匹配，堵不住"目标名字整体动态计算、不以字面量形式出现在源码里"这种更极端的混淆（如 `bin(someComputedName)`）——这需要真正的数据流分析/AST 解释器才能穷尽，超出本契约合理投入，与既有"内部域名形态无法穷举"同属静态文本分析的公认边界。N1a（import 闭包核）+ N1c（调用点计数）+ N1e（目标允许清单）三层叠加，能挡住"新增 import"「新增调用点」「repoint 既有调用点到已知文件模式」这三类最常见的退化路径；面对蓄意、有代码编辑权限的攻击者精心构造的动态目标名，静态文本分析本身有其天花板，本契约不在此追加更重的机制（如运行时沙箱/AST 分析），判定为超出 MED 级"防退化覆盖加固"的合理投入。

**证据**：合成 mutation 测试（`bin('verdict.mjs')` → `bin('promptset-freeze.mjs')`）确认 N1e 逻辑会判红；金牌新增 N1e 检查通过（对当前干净的 `bin/promptset.mjs` 判绿）。

## codex-r3 第 2 条：四段收紧引入 `127.1`/`10.1` 等 WHATWG 简写假阴性

**问题**：round-2 把点分候选提取收紧到恰好四段后，`127.1`（→127.0.0.1）、`10.1`（→10.0.0.1）等两段简写不再被检测。codex 指出这与"内部域名形态无法穷举"不是一回事——两三段简写是 WHATWG 明文定义的有限形态，可以穷举，我把它归为"非目标"的类比不成立。

**核实**：codex 的技术批评成立——两三段简写确实是可枚举的、WHATWG 规范内的具体形态，用"域名无法穷举"来类比确实不准确。

**处置（维持现状，理由改写更精确，非回避）**：没有采纳"扩大检测面"，而是重新审视并改写了取舍理由——真正的根源不是"能不能穷举形态"，而是"两三段点分数字在词法上与自然语言版本号/小数/比例/章节号（如"10.20"）毫无可靠区分特征"：两者除了具体数值外形态完全一样，静态正则/词法分析无法区分"这是地址简写"还是"这是版本号"。放宽候选提取到两三段会让 `产品版本 10.20` 类干净语料重新落回 round-2 修复前的误判（已用 `git stash` 复验坐实：只要把候选正则的重复次数从"恰好四段"松到"1-3 次"，`10.20`/`10.5` 立刻转回 `hit:true`）。鉴于 authoring 场景的候选文本几乎全是中文自然语言、两三段小数是极高频形态，而两三段简写在真实网络请求场景里极罕见（几乎无人会主动写"http://10.1/"期待其解析为 10.0.0.1），两权相害取其轻：不检测两三段简写，靠其他防线兜底（凭据兜底门、四段完整形态、IPv6 形态、`route:human` 语义质量抽检）。

已将这段更精确的推理写回 `lib/promptset-authoring.mjs`（`scanEquivalentEncodings` 上方注释）与金牌新增的 F4c1b（第 632 行一带）——F4c1b 显式冻结 `127.1`/`10.1`/`172.16.5` 三个简写样例"当前不命中"这一现状，把这条边界从"隐含假设"变成"金牌可查的显式契约"，未来若要改这条边界，金牌会先判红提醒改动者正视这里的取舍，而不是被静默移动。

**证据**：F4c1（第 610 行一带）新增 round-2 干净语料回归钉（产品版本/重量/章节号/价格/日期/时间/软件版本号共 6 条，均 `hit:false`）；F4c1b 新增两三段简写现状钉（3 条，均 `hit:false`，若未来该边界被移动会在此判红）。

## codex-r3 第 3 条：round-2 修复的三种新形态与假阳性修复未进冻结回归测试

**问题**：`scanEquivalentEncodings` 补的三种新形态（大写十六进制/无分隔符前导零八进制整串/点分段内混十六进制）与假阳性修复验证语料，此前只在会话 scratchpad 手工验证过，没有写进金牌本身——以后如果这段逻辑被不小心改坏，金牌不会判红。

**核实**：属实。F4c1（round-2 提交时）仍是 round-1 的五个原始形态，round-2 新增的三形态与干净语料回归确实没有写进 `tests/_golden/gen-prompts.golden.mjs`。

**修法**：F4c1 扩为八形态（原五 + round-2 新三），干净语料从 4 条扩到 10 条（含"产品版本 10.20""重量 10.5 公斤"等 codex 点名的具体假阳性样例）。全部作为金牌冻结断言，不再是仅存在于会话记录里的手工验证。

**证据**：`tests/_golden/gen-prompts.golden.mjs` 现 76 过 / 0 败（较 round-2 收口时新增 N1e、F4c1b 两条 + F4c1 扩容，F4c2 复测仍绿）。

## codex-r3 第 4 条：round-3 评审材料本身有陈旧/表述不清之处

**问题**：`material-r3.md` 里复制自 `dispositions-r2.md` 的一行仍写"`prd-gen-prompts.json` 待同步重签"，但当时该 prd 其实已经重签（`dispositions-r2.md` 本体后来又补了一次更新，material-r3.md 里的副本没跟着更新，出现两份文件不同步的陈旧态）；另外"仅列受影响的 3 个文件"这句表述没讲清楚是"刻意按路径过滤后只挑代码/关键文档修法三个文件"，容易被读成"这次提交只改了 3 个文件"（实际 commit 共改 8 个文件，另 5 个是评审归档与 checksum 重签，非"修法"本身）。

**核实**：两处均属实——这是我（修复者）在生成 round-3 评审材料时的文档管理疏漏，不是代码问题。

**修法**：`material-r3.md` 两处文字均已订正——过时的"待同步重签"改为"已同步重签，gate 复跑 GREEN"并注明订正原因；"仅列受影响的 3 个文件"补充说明这是按路径过滤的子集、非遗漏，并列出被过滤掉的另外 5 个文件属于哪一类（评审归档 + checksum 重签）。

**说明**：这一条针对的是"评审材料文档本身"的疏漏，不是"被评审的代码"有问题——已订正的 `material-r3.md` 是历史记录的一部分（已发给 codex/pi 评审过，内容不可能倒着改变已完成的评审事实），订正是为了让文档本身内部一致、不给后续阅读者留混淆，不代表 round-3 的评审结论需要因此重新评估。

## pi-r3 独立发现：`fork()` 遗漏（与 codex-r3 第 1 条部分重合，two-source 汇聚）

pi round-3（重试后）判「通过」，但在"次要项"一节独立指出同一处 `fork()` 遗漏（措辞更温和，判定为"不影响 PASS 结论，建议后续迭代"）。这与 codex-r3 第 1 条部分重合（codex 判定更严格、认为足以构成"未关闭"），已按 codex 的处置一并修复（见上方第 1 条）。

## 汇总核验

- 全仓地址字节串检索（脱敏方式核对，排除 `node_modules`）：0 处命中。
- `node tests/_golden/gen-prompts.golden.mjs`：76 过 / 0 败。
- `lib/promptset-authoring.mjs` 当前 sha256：`b5ec25c0aab9f7742a1c017e04f479ebe4ecea2cf0ea0db477e69bb3d13201e5`。
- `tests/_golden/gen-prompts.golden.mjs` 当前 sha256：`b31e7bb743d05225052ecd5208f09019ad934af73388a84a03c0838fcf852f67`（`prd-gen-prompts.json` 已同步重签本轮改动，gate 复跑 GREEN）。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`lib/promptset.mjs`、`tests/_golden/cli-mcp-face.golden.mjs`、`bin/promptset.mjs` 本轮（round-3 修订）仍零改动——N1e 只读 `bin/promptset.mjs`，不修改它。

---

# round-3 修复 diff（`git diff db3ab4d..1ccf8cb`，仅列两个代码修法文件）

```diff
diff --git a/lib/promptset-authoring.mjs b/lib/promptset-authoring.mjs
index e0d8f82..12dfbfd 100644
--- a/lib/promptset-authoring.mjs
+++ b/lib/promptset-authoring.mjs
@@ -311,8 +311,17 @@ export function scanPrivateAddress(text) {
 // round-2 codex 复核修订两处：
 //   1) 点分形式改硬性要求恰好四段（不再放行两三段简写）——round-1 版本用 `{1,3}` 重复允许两段就命中，
 //      而 WHATWG 对两段点分（如 "10.20"）按简写 CIDR 记法归一成 10.0.0.20，导致任何形如「版本号/小数」的
-//      自然语言文本（如「产品版本 10.20」「重量 10.5 公斤」）都被误判命中——实测坐实、已用干净语料回归钉死；
-//      收窄到恰好四段后不再触发该假阳性，代价是不再识别两三段简写等价形式（非穷举，同既有口径）；
+//      自然语言文本（如「产品版本 10.20」「重量 10.5 公斤」）都被误判命中——实测坐实、已用干净语料回归钉死。
+//      round-3 codex 复核指出两三段简写（如 "127.1"→127.0.0.1、"10.1"→10.0.0.1）因此漏检，且这不同于
+//      「内部域名形态无法穷举」——两三段简写是 WHATWG 明文定义的有限形态，穷举得出。已考虑但维持现状：
+//      两三段点分数字在词法上与自然语言版本号/小数/比例/章节号毫无可靠区分特征（"10.1" 和 "10.20" 除数值
+//      不同外形态一致），放宽候选提取到两三段会让「产品版本 10.20」类干净语料重新落回误判（已用 git stash
+//      复验坐实）。authoring 场景的候选文本几乎全是中文自然语言、两三段小数是高频形态，而两三段简写当
+//      真实网络请求书写时极罕见（几乎没人会主动写 "http://10.1/" 期待它解析成 10.0.0.1）——两权相害取其
+//      轻，选择不检测两三段简写，改靠其他防线兜底（凭据兜底门、四段完整形态、IPv6 形态、route:human 语义
+//      质量抽检）。金牌 F4c1b 冻结此边界（`127.1`/`10.1`/`172.16.5` 断言不命中），防止此取舍被静默改动；
+//      若未来要收紧，须先解决"如何区分两三段地址简写与两三段自然语言数字"这一根本词法歧义，而非简单放宽
+//      重复次数（那会原地重现本次的假阳性）。
 //   2) 补两处此前漏检形态：大写 0X 前缀；无分隔符的前导零八进制整串（此前只认 8-10 位纯十进制，漏了
 //      017700000001 这类前导零形态——纯十进制自然写法几乎不带前导零，专开一条不显著扩大误报面）。
 function tryUrlNormalizeHost(token) {
diff --git a/tests/_golden/gen-prompts.golden.mjs b/tests/_golden/gen-prompts.golden.mjs
index ca49f5b..c50b46e 100644
--- a/tests/_golden/gen-prompts.golden.mjs
+++ b/tests/_golden/gen-prompts.golden.mjs
@@ -607,25 +607,47 @@ check('F4c 新增候选 text 含私网地址 → exit 1 拒（不写盘），原
     if (!readFileSync(ps).equals(before)) throw new Error(`［${kind}］拒绝时文件应不变`);
   }
 });
-check('F4c1 scanPrivateAddress 覆盖等价编码形态（round-1 MED A6：此前只认标准点分十进制/压缩 IPv6字面量，IPv6 展开回环/八进制前导零/十进制整数/十六进制/百分号编码点号五种等价写法漏检；WHATWG URL 主机解析器归一后核对既有网段正则，非重新枚举网段）', () => {
+check('F4c1 scanPrivateAddress 覆盖等价编码形态（round-1 MED A6 五形态 + round-2 codex 复核后再补三形态：IPv6 展开回环/八进制前导零/十进制整数/十六进制/百分号编码点号/大写十六进制前缀/无分隔符前导零八进制整串/点分段内混十六进制；WHATWG URL 主机解析器归一后核对既有网段正则，非重新枚举网段。round-3 codex 复核指出这批形态此前只在 scratchpad 手工验证、未冻进金牌，本轮补齐冻结，防未来回归悄悄退化）', () => {
   const dirtyCases = [
     ['IPv6 展开回环', '内部地址 0:0:0:0:0:0:0:1 不应出现'],
     ['八进制前导零 IPv4', '内部地址 0177.0.0.1 不应出现'],
     ['十进制整数 IPv4', '内部地址 2130706433 不应出现'],
     ['十六进制 IPv4', '内部地址 0x7f000001 不应出现'],
     ['百分号编码点号', '内部地址 127%2e0%2e0%2e1 不应出现'],
+    ['大写十六进制前缀（round-2 补）', '内部地址 0X7f000001 不应出现'],
+    ['无分隔符前导零八进制整串（round-2 补）', '内部地址 017700000001 不应出现'],
+    ['点分段内混十六进制（round-2 补）', '内部地址 0x7f.0.0.1 不应出现'],
   ];
   for (const [kind, text] of dirtyCases) {
     const r = scanPrivateAddress(text);
     if (!r.hit) throw new Error(`［${kind}］scanPrivateAddress 应命中私网地址，实际 hit=false（文本：${text}）`);
   }
   // 干净文本不应因收紧检测而误报（假阳性面佐证：候选提取刻意收窄，不应把无关数字/版本号都判命中）。
-  const cleanCases = ['这是一条常规问句被测参数，问头疼怎么办', '本批共有 2026 条记录，编号从 1 到 2026', '版本号 v1.2.3 不是地址', '订单号是 20260713'];
+  // round-2 补：产品版本/重量/章节号/价格/日期/时间/软件版本号等两段小数形态，此前收紧点分正则到恰好四段
+  // 之前会误判命中，此处冻结回归钉死不再退化。
+  const cleanCases = [
+    '这是一条常规问句被测参数，问头疼怎么办', '本批共有 2026 条记录，编号从 1 到 2026', '版本号 v1.2.3 不是地址', '订单号是 20260713',
+    '产品版本 10.20', '重量 10.5 公斤', '参见第 13.7 节', '价格是 19.99 元', '现在是 08:00', '版本 v10.2.3 发布',
+  ];
   for (const text of cleanCases) {
     const r = scanPrivateAddress(text);
     if (r.hit) throw new Error(`干净文本不应误报命中，实际 kind=${r.kind}（文本：${text}）`);
   }
 });
+check('F4c1b 点分两三段简写形态是已知、有意的残余缺口（round-3 codex 复核指出 127.1/10.1 这类 WHATWG CIDR 简写此前也会漏检；本钉不是遗漏，是显式的、有测试佐证的设计取舍——见下方说明，冻结现状防止该取舍被静默改动）', () => {
+  // 取舍说明：两三段点分数字（如"10.1"/"127.1"）在词法上与自然语言里的版本号/小数/比例/章节号（如"10.20"）
+  // 完全没有可靠区分特征——恰好四段之外的候选提取范围一旦放开，F4c1 里"产品版本 10.20"类干净语料就会重新
+  // 被误判（已用 git stash 复验：放开到 1-3 次重复后，"10.20"/"10.5" 会 hit:true）。两三段简写在真实网络请求
+  // 里本就罕见（几乎没人会主动写"http://10.1/"指望它解析成 10.0.0.1），而误伤自然语言数字模式的代价对
+  // authoring 场景（候选文本几乎全是中文自然语言）是系统性的、高频的。故权衡后选择不检测两三段简写，
+  // 靠其它防线兜底（凭据兜底门、四段完整形态、IPv6 形态、route:human 语义质量抽检）。这不同于"内部域名
+  // 无法穷举"（那是真穷举不了）——这里是"能穷举但两种合法解读无法用词法特征区分，两权相害取其轻"。
+  const shorthandCases = ['127.1', '10.1', '172.16.5'];
+  for (const text of shorthandCases) {
+    const r = scanPrivateAddress(text);
+    if (r.hit) throw new Error(`两三段简写「${text}」当前设计不检测，实际却命中——若此断言判红，说明检测面已扩大，请同步更新本条注释与上方取舍说明，不要静默改变这条边界`);
+  }
+});
 check('F4c2 新增候选 text 含等价编码私网地址（十进制整数形态）→ 经真实 freeze CLI 仍 exit 1 拒、原值不回显（端到端验证 A6 修复已接线，不止库函数本身）', () => {
   const d = freshDir('f4c2');
   const ps = setupPromptset(d, EXISTING_PS);
@@ -843,14 +865,14 @@ check('N1b spawn 边扫描：三份回放侧文件的整个 import 闭包（不
 // 结构化 spawn 边计数（round-2 codex A7 复核后加固）：N1b 靠字符串内容本身（子串/去注释），可被"拼字符串
 // 拼目标名"绕过（codex 实测复现：`spawnSync(process.execPath, ["/repo/bin/"+marker.slice(2,-2)+".mjs"])`，
 // marker 里目标名字面量藏在会被误当注释去掉的 `/*.../*` 形态里）。本钉换一个不依赖目标字符串内容的角度：
-// 直接数三份闭包里"spawn 家族函数调用形态"（spawnSync(/spawn(/exec(/execSync(/execFile(/execFileSync( 等
+// 直接数三份闭包里"spawn 家族函数调用形态"（spawnSync(/spawn(/exec(/execSync(/execFile(/execFileSync(/fork( 等
 // 调用点，非 import 语句本身——`import { spawnSync }` 不含调用括号，不计入）出现的总次数，与已审计过的
 // 现状基线比对——任何新增调用点（不论其参数字符串如何拼接/混淆）都会让计数超过基线，因为「调用本身的存在」
 // 不像「调用的参数内容」那样能被字符串拼接/注释伪装隐藏。基线：verdict/replay 闭包 0 处；promptset 闭包 1 处
 // （`bin/promptset.mjs` 的 `runNode` helper，编排 replay/verdict/report 三个既有 bin，非本契约新增、非本契约
 // 关注的两个 authoring bin）。仍非无懈可击（动态计算函数名本身，如 `child_process['spawn'+'Sync']`，可再绕；
 // 但那已是完全不同量级的刻意混淆，静态文本分析的公认边界，同「内部域名形态无法穷举」既有口径）。
-const SPAWN_CALL_RE = /\b(?:spawnSync|spawn|execSync|exec|execFileSync|execFile)\s*\(/g;
+const SPAWN_CALL_RE = /\b(?:spawnSync|spawn|execSync|exec|execFileSync|execFile|fork)\s*\(/g;
 const SPAWN_CALL_SITE_BASELINE = { replay: 0, verdict: 0, promptset: 1 };
 check('N1c 结构化 spawn 调用点计数不超基线（round-2 codex A7 复核加固：不依赖拼接目标字符串内容，数调用形态本身出现次数）', () => {
   for (const [label, entry] of [['replay', REPLAY], ['verdict', VERDICT], ['promptset', PROMPTSET_BIN]]) {
@@ -885,6 +907,28 @@ check('N1d N1c 金丝雀：闭包内新增一个 spawn 调用点会被 N1c 判
   const stripped = stripCommentsForScan(src);
   if (stripped.includes('promptset-freeze')) throw new Error('本条金丝雀预期 N1b 的去注释近似会误吞目标名字面量（用以论证 N1c 存在的必要性）；实际未被吞，说明 stripCommentsForScan 实现已变化，需重新核对本注释的论证是否仍成立');
 });
+// 正向允许清单（round-3 codex 复核指出 N1c 的缺口）：N1c 只数"调用点总数不超基线"，堵不住"复用既有那一个
+// 合法调用点、把它的目标参数改指向 authoring bin"这种改法——调用点计数不变（仍是 1），检查会静默放行。
+// N1e 换个角度堵这个缺口：`bin/promptset.mjs` 是三份闭包里唯一含 spawn 调用点的文件，其编排目标全部经
+// `bin('<名字>.mjs')` 这一固定 helper 字面量传入（见 stage(...) 调用点）——直接对该文件源码做正向允许清单
+// 核对：`bin(...)` 里出现的全部目标名字面量集合，必须恰好等于已审计过的四个既有编排目标
+// {replay.mjs, verdict.mjs, report-model.mjs, report.mjs}，且显式不含两个 authoring bin 名字——任何增删替换
+// 都会被判红，包括"看似还是 4 个名字但其中一个换成了 authoring bin"这种repoint 手法。
+// 仍非终极防线（依旧是文本模式匹配，面对"目标名整体动态计算、不以字面量形式出现在源码里"的更极端混淆手法
+// 无能为力——这需要真正的数据流分析/AST 解释器才能穷尽，超出本契约合理投入；这也是 codex round-3 复核后
+// 如实记账的残余局限，非本钉能力范围内可修，与"内部域名形态无法穷举"同属静态文本分析的公认边界）。
+const PROMPTSET_ORCHESTRATION_ALLOWLIST = new Set(['replay.mjs', 'verdict.mjs', 'report-model.mjs', 'report.mjs']);
+check('N1e bin/promptset.mjs 的 bin(...) 编排目标正向允许清单（round-3 codex 复核加固：堵"复用既有调用点、repoint 目标参数指向 authoring bin"这种 N1c 计数堵不住的改法）', () => {
+  const src = readFileSync(PROMPTSET_BIN, 'utf8');
+  const found = new Set();
+  for (const m of src.matchAll(/\bbin\(\s*'([^']+)'\s*\)/g)) found.add(m[1]);
+  for (const name of found) {
+    if (!PROMPTSET_ORCHESTRATION_ALLOWLIST.has(name)) throw new Error(`bin/promptset.mjs 的 bin(...) 编排目标出现未登记名字「${name}」（须是既有四目标之一，出现未登记名字——尤其是两个 authoring bin——一律判红）`);
+  }
+  for (const expected of PROMPTSET_ORCHESTRATION_ALLOWLIST) {
+    if (!found.has(expected)) throw new Error(`bin/promptset.mjs 应仍编排既有目标「${expected}」，实际未找到（目标集合被意外收窄，需人工复核）`);
+  }
+});
 
 // ================= C1 CLI 门面（两命令全覆盖） =================
 check('C1a casey help 列两命令且带「合成在 CLI 外」表述', () => {
```
