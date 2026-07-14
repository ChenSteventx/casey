# gen-prompts 修复层评审（r4）——codex

调用式：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-gen-prompts -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium <指令> < docs/plans/gen-prompts/review/material-r4.md`（codex-cli 0.144.1，sandbox=read-only，reasoning effort=medium，用量 16,620 tokens）。评审对象：round-3 双路复核结果（codex round-3 判 NEEDS CHANGES 给出 4 条问题）经修复者逐条处置后的结果（commit `1ccf8cb`，父提交 `db3ab4d`）。实现方 Claude，评审方 codex（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

结论：**需修改**（原文 NEEDS CHANGES）。

round-3 的第 1、3、4 条已经兑现，且修复未见新的代码缺陷；但第 2 条"两三段地址简写全部维持不检测"的处置理由过度概括，仍有可低误报覆盖的明确场景，因此不能判 PASS。

1. N1e 确实堵住了 round-3 指定的 repoint 绕过。

   将 `bin('verdict.mjs')` 改成 `bin('promptset-freeze.mjs')` 后：`found` 会包含未在允许清单中的 `promptset-freeze.mjs`，第一个校验循环直接判红；同时 `verdict.mjs` 从集合消失，第二个循环也会判红。改成双引号同样不能静默通过：新目标虽不被当前单引号正则收集，但原目标会缺失，仍会判红。已记账的动态计算目标名缺口属于更强的静态分析边界，不另列阻断项。

2. `SPAWN_CALL_RE` 已补齐 `child_process` 的标准进程创建家族。

   `spawn/spawnSync/exec/execSync/execFile/execFileSync/fork` 均已覆盖；`execFile` 的回调式重载仍是同一个 `execFile(...)` 调用形态，也会命中。`Worker`、动态 `import()` 并非 child-process spawn。别名调用、计算属性及混淆路径仍可能绕过静态文本检查，但这与已明确接受的非对抗静态分析边界相同；现有材料没有证据表明 round-3 修复新增了这类退化，故不作为新阻断项。

3. 两三段简写的处置仍不充分。

   `lib/promptset-authoring.mjs:314` 的理由只对"裸 `10.1` 与版本号/小数无法区分"成立，却把所有上下文一并排除。至少以下上下文具有可靠区分特征：URI authority（例如 `http://10.1/`）；明确的 host/address 字段（例如 `host=10.1`）；结构化目标地址字段。对 URI authority 单独使用 URL 解析器归一化，不会把"产品版本 10.20"误判成地址。因此无需放宽全局两段数字正则，也能覆盖一部分高置信危险形态。建议保留裸两三段数字不检测，但新增上下文敏感检测及金牌，例如 URL authority 中的 `10.1`、`127.1` 必须命中。

4. F4c1 扩容完整。

   round-2 的三个新增形态均已进入 dirty cases；假阳性回归也覆盖了产品版本、重量、章节、价格、日期/编号、时间及软件版本等材料所列形态。

5. round-3 修复未见新增实现缺陷。N1e 只增加测试侧只读检查；生产裁判、回放和既有编排文件未改动。

铁不变量：本轮 diff 没有引入 LLM、API key、网络或凭据接线，裁判文件也保持不变；材料中的地址均为公开测试样例，而非真实目标地址。当前唯一阻断项是上述可上下文区分的两三段地址简写仍被整体放弃。

---

## 驱动员核对（sonnet5，修复者本人）

采纳建议，`scanEquivalentEncodings` 新增 `URI_AUTHORITY_RE`——只在显式 `http://`/`https://` 协议头之后提取主机部分并归一化核对，不受"恰好四段"限制，且不放宽裸文本判定（`http://10.1/`、`https://127.1:8080/api`、`http://172.16.5/status` 均转命中；"产品版本 10.20"等干净语料复测不误伤）。新增金牌 F4c1c，红先行验证（`git stash` 还原后判红，修复后转绿）。详见 `docs/plans/gen-prompts/review/dispositions-r4.md`。
