# gen-prompts 修复层评审（r2）——codex

调用式：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-gen-prompts -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium <指令> < docs/plans/gen-prompts/review/material-r2.md`（codex-cli 0.144.1，sandbox=read-only，reasoning effort=medium，用量 96,904 tokens）。评审对象：round-1 的 10 条 finding（`docs/plans/gen-prompts/review/arb-r1.md` 汇裁采信）经修复者逐条处置后的结果（commit `1416147`，父提交 `7cabd8f`）。实现方 Claude，评审方 codex（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

结论：**需修改**（原文 NEEDS CHANGES）。

r1 的 10 条 finding 中，A1、A6、A7 尚未妥善处置；其余 7 条修复成立。本轮另引入一个确定的地址扫描假阳性。

## 必须修改

1. **A1 未兑现：真实目标地址仍留在文档和本轮评审材料中**

   - [dispositions-r1.md](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/review/dispositions-r1.md:14)
   - [material-r2.md](/mnt/d/ctx/heren/casey-gen-prompts/docs/plans/gen-prompts/review/material-r2.md:58)，另在第 390、412 行重复。
   - 实测：按 r1 已确认的真实地址字节串扫描，以上位置仍命中。`HEAD` 中 `dispositions-r1.md:14` 也命中，不只是工作区临时内容。
   - S3i 的红先行证据不充分：它只是因测试描述自身重复旗标而红，没有真实复现"文档/评审材料残留真实地址"；而且 S3i 只计数旧旗标，不扫描金牌自身的地址。
   - 因此"任何内网/真实目标地址不出现在代码与文档（含本次材料）"铁不变量已破坏。最终材料必须删除该字面量，不能把它放进 grep 命令或历史说明。

2. **A6 未完全兑现：仍有 WHATWG URL 可归一的回环编码漏检**

   - [promptset-authoring.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:315)
   - 候选提取正则漏掉：
     - 大写十六进制前缀：`0X7f000001`
     - 整体八进制整数：`017700000001`
     - 十六进制点分形式：`0x7f.0.0.1`
   - 实测：Node `URL` 将三者都归一为回环地址，但 `scanPrivateAddress()` 均返回 `hit:false`。把三者分别放入真实候选并运行 freeze，均 `exit 0` 且成功写盘。
   - 现有 F4c1 的五个例子确实复现并修好了原来的五个样例，但测试与实现使用同一组手选形态，不能证明"A6 的标准 URL 等价编码面"已关闭。

3. **本轮新增假阳性：普通版本号会被当成内网地址硬拒**

   - [promptset-authoring.mjs](/mnt/d/ctx/heren/casey-gen-prompts/lib/promptset-authoring.mjs:316)
   - 实测候选正文"产品版本 10.20"被提取为点分数字主机，freeze `exit 1`、未写盘，错误归因为私网地址。
   - 这不是性能问题：对 10 万、100 万、500 万连续数字字符实测约 4ms、26ms、130ms，未见灾难性回溯；问题是缺少上下文约束导致功能性假阳性。

4. **A7 未兑现：N1b 的近似去注释可被字符串字面量绕过**

   - [gen-prompts.golden.mjs](/mnt/d/ctx/heren/casey-gen-prompts/tests/_golden/gen-prompts.golden.mjs:815)
   - 最小复现：

     ```js
     const marker = "/*promptset-freeze*/";
     spawnSync(process.execPath, ["/repo/bin/" + marker.slice(2, -2) + ".mjs"]);
     ```

   - 运行时目标确为 authoring bin；但 `stripCommentsForScan()` 把字符串内部的 `/*...*/` 当注释删除，随后扫描不再看到禁词。
   - 即使不利用去注释，普通字符串拼接也能绕过连续子串搜索。r1 汇裁已经明确点出"动态拼名可绕"，本轮只扩大了文件范围，没有解析 spawn 目标，因此 A7 仍未关闭。
   - 处置表所谓合成对照只验证"helper 中放完整连续字符串会命中"，没有验证上述恶意语法构造，也没有把金丝雀固化进金牌。

## 其余 finding

- A2：成立。结构化 `code` 优先；普通错误中的固定类别码位于候选控制内容之前，当前 `/\[([A-Z_]+)\]/` 未发现候选可控泄漏路径。
- A3/A8：成立。随机临时名消除共享 sidecar，默认 `wx` 阻止预置文件/符号链接；随机碰撞时 fail-closed。未发现具有独立安全意义的遗留竞态。
- A4：成立。0 新增现在也先跑全量自检。
- A5：成立。全角分隔符避免当前裸 `split('|')` 误裂列。
- A9：成立。dry-run 不再输出正文和软期望。
- A10：成立。存量凭据/地址拒绝路径已有明确负面钉。

## 铁不变量核验

- 裁判零 LLM：通过。`verdict.mjs`、`sign-gate.mjs` 实际 SHA-256 与 PRD 完全一致。
- authoring 当前未进入 replay/verdict/promptset import 闭包：通过；三个闭包实测均无 authoring 文件。但 N1b 防退化门本身仍可绕。
- 零 API key、零网络、零凭据接线：本轮实现 diff 未发现新增接线；`new URL()` 仅本地解析。
- 零真实地址入库/材料：**失败**，见 A1。

官方金牌和 gate 在本只读环境中会尝试写 `/tmp` 或刷新 PRD，因 `EROFS` 无法独立完整复跑；但冻结文件哈希与所附门禁摘录一致。上述结论均来自可独立复现的针对性实测，不依赖门禁失败。

---

## 驱动员核对（sonnet5，修复者本人）

4 条全部复现属实，逐条修死，见 `docs/plans/gen-prompts/review/dispositions-r2.md`：
1. `dispositions-r1.md`/`material-r2.md` 里误写回的地址字面量已脱敏改写，全仓检索 0 命中。
2. `scanEquivalentEncodings` 补三处漏检形态（大写十六进制/前导零八进制整串/十六进制点分混合）。
3. 点分候选提取正则从"1-3 次重复"收紧为"恰好四段"，堵死版本号/小数假阳性，干净语料回归钉死。
4. N1b 如实标注局限（非对抗式防线）；新增 N1c 结构化 spawn 调用点计数（不依赖目标字符串内容）+ N1d 金丝雀（直接用 codex 给出的构造验证 N1c 判红、且验证 N1b 确实会被同一构造绕过）。
