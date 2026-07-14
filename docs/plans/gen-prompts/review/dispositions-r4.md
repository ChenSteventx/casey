# gen-prompts round-4 逐条处置（修复者 sonnet5，2026-07-14）

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

## 汇总核验

- 全仓地址字节串检索（脱敏方式核对，排除 `node_modules`）：0 处命中。
- `node tests/_golden/gen-prompts.golden.mjs`：77 过 / 0 败。
- `lib/promptset-authoring.mjs` 当前 sha256：`a1e959757968cbc118c9690c3ebfaa642294d03e6bb84e40d0154a84464dac9e`。
- `tests/_golden/gen-prompts.golden.mjs` 当前 sha256：`1ff9482eb13d1176db2630265fac21108ee009d5bb78c2b1b98b0862325188c1`（`prd-gen-prompts.json` 已同步重签，gate 复跑 GREEN）。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`lib/promptset.mjs`、`bin/promptset.mjs`、`tests/_golden/cli-mcp-face.golden.mjs` 本轮（round-4 修订）仍零改动。
