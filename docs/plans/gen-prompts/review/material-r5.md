# gen-prompts 修复层评审料（r5，round-4 finding 修复后，异构冗余评审第五轮）

本文件是喂给异构评审者（codex / pi）的 round-5 评审料：只含 round-4 修复的完整 `git diff`（从 round-3 收口 `1ccf8cb` 到本轮实际最新提交 `ca4f230`，按路径过滤，只列 `lib/promptset-authoring.mjs` 与 `tests/_golden/gen-prompts.golden.mjs` 两个代码修法文件；这段区间内另改动若干评审归档/PRD 重签文件，非"修法"本身，未列入下方 diff）+ round-4 逐条处置表（`dispositions-r4.md` 全文，含 round-5 前置自查追记）。不含凭据、不含无关代码、不含实现者内心推理（护栏 #9）。

评审对象：round-3 双路复核结果——pi round-4 判 PASS；codex round-4 判 NEEDS CHANGES，给出 1 条具体建议（URI authority 单独检测两三段简写）。修复者采纳建议并实现（commit `0eb068c`，父提交 `1ccf8cb`）；随后在准备本轮评审材料时自查发现并修复了新增代码里的一处真实缺口（URL 含 `userinfo@` 时提取错误，commit `ca4f230`，父提交 `0eb068c`）——**这一处是修复者主动发现并修复的，不是外部评审指出的**，如实告知供评审者复核。历史归档：round-1 见 `arb-r1.md`/`codex-r1.md`/`pi-r1.md`/`dispositions-r1.md`；round-2 见 `material-r2.md`/`codex-r2.md`/`pi-r2.md`/`dispositions-r2.md`；round-3 见 `material-r3.md`/`codex-r3.md`/`pi-r3.md`/`dispositions-r3.md`；round-4 见 `material-r4.md`/`codex-r4.md`/`pi-r4.md`。

**背景**：这是 gen-prompts 契约（regress scope C：被测参数的 CLI 外 LLM 合成 authoring）第五轮跨族异构复核。round-1 汇裁 10 条 finding（4 HIGH + 4 MED + 2 LOW）全数处置；round-2/3/4 codex 各自独立发现新问题（分别是 4/4/1 条），均已逐条核实、红先行验证、金牌冻结。pi 从 round-2 起持续判 PASS。

**本轮请重点核实**：
1. codex round-4 的建议（URI authority 检测）是否真被兑现，`URI_AUTHORITY_RE` 正则本身是否还有可绕过或可误伤之处（除了已自查修复的 `userinfo@` 场景外，还请具体核实：IPv6 字面量地址 `http://[::1]/` 形态是否被正确处理（虽然这类地址已被更早的既有 IPv6 字面量正则单独捕获，与本条新增通道无关，但仍请确认不会因新增通道而产生副作用）；`ftp://`、`ws://` 等非 http(s) 协议头是否如设计所述不受本条新增通道影响；纯粹的字符串拼接构造能否绕过 `\bhttps?:\/\/` 这个锚点本身）；
2. 修复者自查发现并修复的 `userinfo@` 缺口是否已妥善处置、是否还有类似性质的其他遗漏；
3. round-4（含自查追加）的修复本身有没有引入新的缺陷；
4. 铁不变量是否仍然成立：裁判零 LLM、authoring 绝不进回放/裁定闭包、零 API key/零网络/零凭据接线、任何内网/真实目标地址不出现在代码与文档（含本次评审材料自身、含所有历史归档）。

给出明确结论：PASS 或 NEEDS CHANGES（若 NEEDS CHANGES，请给文件路径+行号+可复现的实测依据，不要臆测）。

## 门禁证据摘录

```
$ node tests/_golden/gen-prompts.golden.mjs
gen-prompts golden: 77 过 / 0 败

$ node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json
ok    ratchet  tests/_golden/gen-prompts.golden.mjs
ok    ratchet  bin/verdict.mjs
ok    ratchet  lib/sign-gate.mjs
ok    term     术语检查通过
ok    s1-gen-prompts-seed-freeze  node tests/_golden/gen-prompts.golden.mjs
ok    s2-tier1-regression  node bin/casey.mjs selftest --tier1

gate: GREEN —— story 2/2 过

git diff --stat 1ccf8cb..ca4f230 -- bin/verdict.mjs lib/sign-gate.mjs lib/promptset.mjs bin/promptset.mjs tests/_golden/cli-mcp-face.golden.mjs
（空——round-4（含自查追加）仍零改动）
```

---

## git diff（`1ccf8cb..ca4f230`，仅 `lib/promptset-authoring.mjs` + `tests/_golden/gen-prompts.golden.mjs`）

```diff
diff --git a/lib/promptset-authoring.mjs b/lib/promptset-authoring.mjs
index 12dfbfd..6d410d3 100644
--- a/lib/promptset-authoring.mjs
+++ b/lib/promptset-authoring.mjs
@@ -316,12 +316,16 @@ export function scanPrivateAddress(text) {
 //      「内部域名形态无法穷举」——两三段简写是 WHATWG 明文定义的有限形态，穷举得出。已考虑但维持现状：
 //      两三段点分数字在词法上与自然语言版本号/小数/比例/章节号毫无可靠区分特征（"10.1" 和 "10.20" 除数值
 //      不同外形态一致），放宽候选提取到两三段会让「产品版本 10.20」类干净语料重新落回误判（已用 git stash
-//      复验坐实）。authoring 场景的候选文本几乎全是中文自然语言、两三段小数是高频形态，而两三段简写当
-//      真实网络请求书写时极罕见（几乎没人会主动写 "http://10.1/" 期待它解析成 10.0.0.1）——两权相害取其
-//      轻，选择不检测两三段简写，改靠其他防线兜底（凭据兜底门、四段完整形态、IPv6 形态、route:human 语义
-//      质量抽检）。金牌 F4c1b 冻结此边界（`127.1`/`10.1`/`172.16.5` 断言不命中），防止此取舍被静默改动；
-//      若未来要收紧，须先解决"如何区分两三段地址简写与两三段自然语言数字"这一根本词法歧义，而非简单放宽
-//      重复次数（那会原地重现本次的假阳性）。
+//      复验坐实）。authoring 场景的候选文本几乎全是中文自然语言、两三段小数是高频形态——两权相害取其轻，
+//      裸文本（无协议头）里的两三段简写维持不检测，改靠其他防线兜底（凭据兜底门、四段完整形态、IPv6 形态、
+//      route:human 语义质量抽检）。金牌 F4c1b 冻结此边界（`127.1`/`10.1`/`172.16.5` 裸文本断言不命中），
+//      防止此取舍被静默改动；若未来要收紧裸文本判定，须先解决"如何区分两三段地址简写与两三段自然语言数字"
+//      这一根本词法歧义，而非简单放宽重复次数（那会原地重现本次的假阳性）。
+//      round-4 codex 复核建议采纳：上面这条顾虑只对"没有协议头的裸数字"成立——一旦文本里出现显式
+//      `http://`/`https://` 前缀，紧随其后的主机部分该按什么形态解析已经不含糊（自然语言几乎不会写
+//      "http://10.20" 这种协议头 + 数字的组合，这不是版本号会出现的位置），故新增一条不受"恰好四段"限制
+//      的 URI authority 提取通道，专门处理"协议头 + 两三段简写主机"这类高置信度危险形态（如
+//      `http://10.1/`），不放宽裸文本判定、不重新引入假阳性。
 //   2) 补两处此前漏检形态：大写 0X 前缀；无分隔符的前导零八进制整串（此前只认 8-10 位纯十进制，漏了
 //      017700000001 这类前导零形态——纯十进制自然写法几乎不带前导零，专开一条不显著扩大误报面）。
 function tryUrlNormalizeHost(token) {
@@ -330,6 +334,11 @@ function tryUrlNormalizeHost(token) {
 // 点分四段的单段形态：十六进制前缀（0x/0X）｜前导零疑似八进制（0 + 1-3 位 0-7 数字）｜普通 1-3 位十进制。
 const DOTTED_OCTET = '(?:0[xX][0-9a-fA-F]+|0[0-7]{1,3}|\\d{1,3})';
 const DOTTED_QUAD_RE = new RegExp(`\\b${DOTTED_OCTET}(?:\\.${DOTTED_OCTET}){3}\\b`, 'g');
+// URI authority 提取（round-4 codex 建议；round-5 自查补一处）：只在显式 http(s):// 协议头之后取主机部分
+// （到下一个路径/端口/查询/片段分隔符或空白为止），不管它是几段——协议头本身已消除"是地址还是自然语言
+// 数字"的歧义，不需要再靠"恰好四段"这道防假阳性的闸。先跳过可选的 `userinfo@`（如 `user:pass@`）——不然
+// `http://user:pass@10.1/` 会在 `user` 后的冒号处提前截断，误把 "user" 当主机名、漏过真正的 "10.1"。
+const URI_AUTHORITY_RE = /\bhttps?:\/\/(?:[^\s/?#@]*@)?([^\s/:?#]+)/gi;
 function scanEquivalentEncodings(text) {
   const candidates = new Set();
   for (const m of text.matchAll(/\b0[xX][0-9a-fA-F]+\b/g)) candidates.add(m[0]);
@@ -337,6 +346,7 @@ function scanEquivalentEncodings(text) {
   for (const m of text.matchAll(/\b0[0-9]{1,11}\b/g)) candidates.add(m[0]);
   for (const m of text.matchAll(DOTTED_QUAD_RE)) candidates.add(m[0]);
   for (const m of text.matchAll(/(?:\d{1,3}%2[eE]){1,3}\d{1,3}/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(URI_AUTHORITY_RE)) candidates.add(m[1]);
   for (const tok of candidates) {
     const hostname = tryUrlNormalizeHost(tok);
     if (!hostname) continue;
diff --git a/tests/_golden/gen-prompts.golden.mjs b/tests/_golden/gen-prompts.golden.mjs
index c50b46e..4271d3a 100644
--- a/tests/_golden/gen-prompts.golden.mjs
+++ b/tests/_golden/gen-prompts.golden.mjs
@@ -634,18 +634,37 @@ check('F4c1 scanPrivateAddress 覆盖等价编码形态（round-1 MED A6 五形
     if (r.hit) throw new Error(`干净文本不应误报命中，实际 kind=${r.kind}（文本：${text}）`);
   }
 });
-check('F4c1b 点分两三段简写形态是已知、有意的残余缺口（round-3 codex 复核指出 127.1/10.1 这类 WHATWG CIDR 简写此前也会漏检；本钉不是遗漏，是显式的、有测试佐证的设计取舍——见下方说明，冻结现状防止该取舍被静默改动）', () => {
-  // 取舍说明：两三段点分数字（如"10.1"/"127.1"）在词法上与自然语言里的版本号/小数/比例/章节号（如"10.20"）
-  // 完全没有可靠区分特征——恰好四段之外的候选提取范围一旦放开，F4c1 里"产品版本 10.20"类干净语料就会重新
-  // 被误判（已用 git stash 复验：放开到 1-3 次重复后，"10.20"/"10.5" 会 hit:true）。两三段简写在真实网络请求
-  // 里本就罕见（几乎没人会主动写"http://10.1/"指望它解析成 10.0.0.1），而误伤自然语言数字模式的代价对
-  // authoring 场景（候选文本几乎全是中文自然语言）是系统性的、高频的。故权衡后选择不检测两三段简写，
-  // 靠其它防线兜底（凭据兜底门、四段完整形态、IPv6 形态、route:human 语义质量抽检）。这不同于"内部域名
-  // 无法穷举"（那是真穷举不了）——这里是"能穷举但两种合法解读无法用词法特征区分，两权相害取其轻"。
+check('F4c1b 无协议头的裸两三段简写是已知、有意的残余缺口（round-3 codex 复核指出 127.1/10.1 这类 WHATWG CIDR 简写此前也会漏检；round-4 codex 复核进一步指出"裸文本不区分"的理由不能一概而论地推广到"有协议头的场景"，已按建议收窄范围——本钉现专指裸文本，见下方 F4c1c 的协议头场景已改为检测）', () => {
+  // 取舍说明：两三段点分数字（如"10.1"/"127.1"）在没有协议头、单独出现在自然语言里时，跟版本号/小数/比例/
+  // 章节号（如"10.20"）完全没有可靠区分特征——恰好四段之外的候选提取范围一旦放开，F4c1 里"产品版本 10.20"
+  // 类干净语料就会重新被误判（已用 git stash 复验：放开到 1-3 次重复后，"10.20"/"10.5" 会 hit:true）。裸两三段
+  // 简写在真实网络请求里发生频率远低于版本号/小数在中文自然语言里出现的频率，两权相害取其轻，故对*裸文本*
+  // 维持不检测，靠其它防线兜底（凭据兜底门、四段完整形态、IPv6 形态、route:human 语义质量抽检）。这不同于
+  // "内部域名无法穷举"（那是真穷举不了）——这里是"裸文本场景下两种合法解读无法用词法特征区分，两权相害
+  // 取其轻"；一旦文本带显式协议头（`http://`/`https://`），这层歧义就不存在了，见下方 F4c1c。
   const shorthandCases = ['127.1', '10.1', '172.16.5'];
   for (const text of shorthandCases) {
     const r = scanPrivateAddress(text);
-    if (r.hit) throw new Error(`两三段简写「${text}」当前设计不检测，实际却命中——若此断言判红，说明检测面已扩大，请同步更新本条注释与上方取舍说明，不要静默改变这条边界`);
+    if (r.hit) throw new Error(`裸两三段简写「${text}」当前设计不检测，实际却命中——若此断言判红，说明检测面已扩大，请同步更新本条注释与上方取舍说明，不要静默改变这条边界`);
+  }
+});
+check('F4c1c 带显式协议头的两三段简写主机改判命中（round-4 codex 复核建议采纳：协议头本身消除"是地址还是自然语言数字"的歧义，不需要再受"恰好四段"限制，且不会重新引入 F4c1b 那类假阳性——协议头 + 纯数字组合在中文自然语言里不会意外出现。round-5 自查补一处：URL 含 userinfo（user:pass@host）时若不跳过该段会在其内部冒号处提前截断、误把用户名当主机名）', () => {
+  const dirtyCases = [
+    ['URI authority 两段（http）', '系统文档见 http://10.1/docs 请查阅'],
+    ['URI authority 两段（https，含端口）', '内部服务 https://127.1:8080/api 不应出现'],
+    ['URI authority 三段', '管理面 http://172.16.5/status'],
+    ['URI authority 含 userinfo（round-5 自查补）', '内部凭据示例 http://user:pass@10.1/path 不应出现', ],
+    ['协议头大小写不敏感（round-5 自查补）', 'HTTP://127.1/x 不应出现'],
+  ];
+  for (const [kind, text] of dirtyCases) {
+    const r = scanPrivateAddress(text);
+    if (!r.hit) throw new Error(`［${kind}］带协议头的两三段简写主机应命中，实际 hit=false（文本：${text}）`);
+  }
+  // 干净对照：协议头场景收紧不应误伤"看起来像但没有真协议头"的文本（纯数字/词语混排，无 http(s):// 字面量）。
+  const cleanCases = ['产品版本 10.20', '协议版本 http 10.20（无真协议头，不应命中）', 'https://example.com/path（公网域名非私网）', 'http://8.8.8.8/（公网 IP 非私网）'];
+  for (const text of cleanCases) {
+    const r = scanPrivateAddress(text);
+    if (r.hit) throw new Error(`干净对照不应误报命中，实际 kind=${r.kind}（文本：${text}）`);
   }
 });
 check('F4c2 新增候选 text 含等价编码私网地址（十进制整数形态）→ 经真实 freeze CLI 仍 exit 1 拒、原值不回显（端到端验证 A6 修复已接线，不止库函数本身）', () => {
```

---

# round-4 逐条处置表（dispositions-r4.md 全文，含 round-5 前置自查追记）

round-4 双路异构冗余复核：pi（deepseek-v4-pro@high）判「通过」，逐条确认 round-3 的 4 条问题全部兑现、round-3 修复未引入新缺陷、铁不变量成立；附一条非阻断观察项（`Worker`/`execFile` 回调式重载不在 `SPAWN_CALL_RE` 范围——经核实 `execFile` 本身已在正则里，回调与否不影响是否命中，`Worker` 确实不在 spawn 家族范围内，判定为不需处理）。codex（gpt-5.6-sol@medium）判「需修改」，确认 round-3 第 1/3/4 条已兑现、round-3 修复未见新缺陷，但认为第 2 条"两三段简写全部维持不检测"的处置理由过度概括，指出至少 URI authority 场景（如 `http://10.1/`）具有可靠区分特征、不应该也归入"无法区分"之列。

## codex-r4 唯一问题：两三段简写的"裸文本不可区分"理由不应推广到"有协议头"的场景

**问题**：round-3 的处置理由（两三段点分数字与自然语言版本号/小数无法用词法特征区分）只对"没有协议头的裸数字"成立；一旦文本里出现显式 `http://`/`https://` 协议头，紧随其后的主机部分该怎么解析已经不含糊——自然语言几乎不会写"http://10.20"这种协议头+数字的组合。codex 具体建议：对 URI authority 单独做归一化检测，不放宽全局两三段裸数字的判定，就能覆盖一部分高置信度危险形态（如 `http://10.1/`）。

**核实**：codex 的技术论证成立，且给出的具体方案（只在协议头场景加检测，不动裸文本判定）恰好是"不重新引入假阳性"的正确切入点——协议头本身是强信号，中文自然语言实际上不会意外产生"http://"+纯数字的组合。

**修法**：`scanEquivalentEncodings`（`lib/promptset-authoring.mjs` 现第 340 行一带）新增 `URI_AUTHORITY_RE`（`/\bhttps?:\/\/([^\s/:?#]+)/gi`）——只在显式协议头之后提取主机部分（到下一个路径/端口/查询/片段分隔符或空白为止），不受"恰好四段"限制地直接丢给 URL 归一化再核对既有网段清单。这条新增通道与裸文本的四段限制完全独立：裸文本（无协议头）的两三段简写继续维持不检测（F4c1b 冻结的边界不变），只有"确实带协议头"的场景改判命中。

这也顺带补上了此前的一处实际检测空白：`freeze` 的"新增候选文本零裸 `://`"检查会独立拒绝任何含 `://` 的候选（与本次改动无关，属既有机制），但 `seed` 侧对 `--embedded` 系统提示词原文并无同款"零裸 `://`"限制（`--embedded` 允许包含合法 URL 作为智能体系统提示词原文的一部分）——这条路径此前确实存在"协议头+两三段简写主机"这一具体子集的检测空白，本次修法一并堵上。

**证据**：
- 新增用例：`http://10.1/docs`、`https://127.1:8080/api`、`http://172.16.5/status` 均转 `hit:true`；干净对照（"产品版本 10.20""协议版本 http 10.20"（无真协议头）"https://example.com/path"（公网域名）"http://8.8.8.8/"（公网 IP））均 `hit:false`，不误伤。
- F4c1b（裸文本不检测）三个原样例复测仍 `hit:false`，边界未被意外扩大。
- 红先行：`git stash` 还原到本轮修复前，新增金牌 F4c1c 判红（`带协议头的两三段简写主机应命中，实际 hit=false`）；恢复修复后转绿。
- 金牌全量复跑：77 过 / 0 败（较 round-3 收口新增 F4c1c 一条，F4c1/F4c1b/F4c2 复测仍绿）。

## pi-r4 观察项：`Worker`/`execFile` 回调式重载

**核实**：`execFile` 本身已在 `SPAWN_CALL_RE` 里（`spawnSync|spawn|execSync|exec|execFileSync|execFile|fork`），是否传回调参数不影响函数名本身是否被匹配——pi 在报告里也自己核实了这点（"`execFile` 函数名本身已在正则中，与是否回调无关"）。`worker_threads` 的 `Worker` 确实不在 `child_process` 的 spawn 家族里，是完全不同的并发原语（线程而非进程），当前 authoring/回放/裁定三处代码均未使用 `Worker`，判定为不需要现在处理——若未来有正当理由要用 `Worker` 启动某些逻辑，应作为独立评审事项另议，不在本契约范围内预防性扩大检测面。

## round-5 前置自查追记（准备评审材料时自行发现，未等外部评审指出）

在为本轮修复整理 round-5 评审材料时，主动构造了一批 `URI_AUTHORITY_RE` 的边界场景自测（大小写协议头、`userinfo@` 形态、IPv6 字面量、`ftp://` 等非 http(s) 协议），发现真实缺口：URL 含 `userinfo`（`user:pass@host` 形态）时，正则会在 `userinfo` 内部的冒号处提前截断，误把用户名当主机名、漏过真正的主机（`http://user:pass@10.1/path` 会提取到 `"user"` 而非 `"10.1"`，导致该场景 `hit:false`）。已在同一次收口里修复（`URI_AUTHORITY_RE` 加一个可选非捕获组跳过 `userinfo@` 前缀）+ 金牌 F4c1c 补两条断言（userinfo 场景 + 协议头大小写不敏感场景）+ 红先行验证（`git stash` 复验）。提交 `ca4f230`（父提交 `0eb068c`）。

## 汇总核验

- 全仓地址字节串检索（脱敏方式核对，排除 `node_modules`）：0 处命中。
- `node tests/_golden/gen-prompts.golden.mjs`：77 过 / 0 败。
- `lib/promptset-authoring.mjs` round-4 本体（commit `0eb068c`）sha256：`a1e959757968cbc118c9690c3ebfaa642294d03e6bb84e40d0154a84464dac9e`；round-5 前置自查（commit `ca4f230`）后已更新，最新哈希见该提交。
- `tests/_golden/gen-prompts.golden.mjs` round-4 本体 sha256：`1ff9482eb13d1176db2630265fac21108ee009d5bb78c2b1b98b0862325188c1`；round-5 前置自查后已更新，最新哈希见该提交，`prd-gen-prompts.json` 已同步重签、gate 复跑 GREEN。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`lib/promptset.mjs`、`bin/promptset.mjs`、`tests/_golden/cli-mcp-face.golden.mjs` 本轮（round-4 修订）仍零改动。
