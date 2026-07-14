# gen-prompts 代码层评审（r1）——pi

调用式：`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro @docs/plans/gen-prompts/review/material-r1.md <指令>`（pi v0.80.3，provider=deepseek，thinking=high；实测冒烟先确认真选中 deepseek-v4-pro）。评审对象：契约 `gen-prompts`（lane full）实现，commit `7cabd8f`。实现方 Claude，评审方 pi/deepseek-v4-pro（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

## 异构冗余评审结果（代码实现 → pi 评审）

结论：**实现质量高，未发现 HIGH 级别缺陷。** 发现 2 个 MEDIUM（含一个工具缺陷）、1 个 LOW 缺口。评审范围覆盖 GRILL D1-D9「修订（评审）」条目的代码兑现、金牌强度、凭据/私网泄漏与铁不变量坚守。

---

### 发现 1（MED）：term-lint 管道转义缺陷导致误裂列并产生幽灵弃用别名

- **文件**：`CONTEXT.md` 第 106 行附近（diff 中 `promptset` 词条行）
- **问题**：`term-lint` 的 `parseRegistry` 使用裸 `split('|')` 解析四列制注册表，不认 `\|` 转义。该行为了在第二列（描述列）内使用分隔符，写了 `\|`，导致解析器把 `builtin（随 注入向量库 发）` 误裂成多余列，从而被错判为 `promptset` 的弃用别名。
- **证据**：diff 中同行的内联注释已如实记载该缺陷："parseRegistry 用裸 split('|') 不认转义…… 把「builtin（随 注入向量库 发）」错判成 promptset 的弃用别名"。实现者为绕过此误报对该行添加了 `<!-- term-lint:allow … -->` 豁免。
- **建议**：修改 `loop-kit/bin/term-lint.mjs` 的注册表解析，使其感知 `\|` 转义，或改用更稳健的 Markdown table 解析器。在修复工具前，当前豁免注释可作为临时措施。
- **影响面**：当前仅此一行受影响；若未来其他词条描述中含 `|`，会在未加豁免时产生假报错，降低工程师对 term-lint 的信任。

---

### 发现 2（MED）：`freezeMergePromptset` 在 0 新增时可能改变存量文件字节（弱反例）

- **文件**：`lib/promptset-authoring.mjs` 第 209-229 行（`freezeMergePromptset` 函数）
- **问题**：当 `fresh.length === 0` 时，函数返回 `merged` 由 `existing.map(canonicalizeEntry)` 产出。`canonicalizeEntry` 会严格按固定键序（id / text / source / category / expect）重排键，并**丢弃**不在该白名单内的字段（第 211-216 行只取 `['id','text','source','category','expect']`）。对一份格式合规（仅含上述五键）的存量 `promptset.json`，行为无损；但对历史遗留或未来可能包含额外字段的合法扩展条目，0 新增重跑会导致文件字节改变，进而违反 GRILL D4 的承诺"0 新增时整文件字节不变"。
- **证据**：当前金牌 F2a 的幂等重跑用例中，存量条目恰好只含允许的五键，因此无法揭穿此隐患。该测试可视为假绿。
- **建议**：在 0 新增路径中，直接返回原 `existing` 数组（不重排、不去字段）以真正实现"字节不变"。或者显式声明 contract 为"规范化重写字节可能变"并将金牌改为验证逻辑等价而非字节相等。鉴于 GRILL 已经改口为"值深等保留"，建议采纳后者并同步调整金牌预期；否则需在 0 新增时原样保留。

---

### 发现 3（LOW）：金牌未覆盖"存量 promptset 含凭据/私网地址时 freeze 拒绝"的反面场景

- **文件**：`tests/_golden/gen-prompts.golden.mjs`
- **问题**：`bin/promptset-freeze.mjs` 在读入已有 `promptset.json` 后，会调用 `gateRawTextOrExit` 对原文进行凭据门与私网地址扫描。但金牌 F 组（F3i 仅测坏 JSON）从未构造一个内容含凭据关键词（如 `password`）的存量文件并验证 freeze 退出码为 1 且不写盘。
- **证据**：代码实现中该安全检查存在（`bin/promptset-freeze.mjs` 第 36-41 行），但未被测试覆盖。
- **建议**：补一条 F 组用例：写一份含 `token` 或私网地址的 `promptset.json`，调用 freeze 断言 exit 1、文件字节不变、且报错文本不含原值。这可以防止未来重构意外移除原文扫描。

---

### 对其他重点面的评估（简要 PASS 结论）

- **fail-open/假绿**：所有 GRILL D2/D3/D4/D7/D9 修订项均已兑现且被金牌的正确断言锚定，未见显著假绿（除上述 0 新增字节改变的弱窗口）。
- **域锁与边界**：`scanPrivateAddress` 覆盖了声称的全部网段与 IPv4/IPv6 形态，与 `credentialGate` 分工清晰，无旁路。
- **冻结纪律**：全部受影响的 prd（prd-cli-mcp-face、prd-mcp-parity、prd-regress-promptset）的 `testChecksums` 均已重签，`bin/verdict.mjs`/`lib/sign-gate.mjs` 的 SHA-256 基线已锚定。
- **幂等与原子写**：`atomicWriteFileSync` 的可注入故障验证，以及 `freezeMergePromptset` 的"先校验后分类"顺序，均已通过金牌验证，未发现绕过路径。
- **裁判 LLM 化**：import 闭包核 + spawn 边源文本扫描 + 字节锚三重防护均生效。
- **凭据外泄**：报错纪律严格执行，JSON.parse 路径已通过解析前原文扫描封堵。
- **术语消歧**：CONTEXT.md 新增词条对"冻结"做了显式区分，不再混用。

---

**总结**：实现与设计高度吻合，安全边界严谨。上述 MED/LOW 项均可在后续小幅修正，不影响合入。

---

> 驱动员核对备注：pi 判定"幂等与原子写…未发现绕过路径""fail-open/假绿…未见显著假绿"，与 codex 同轮独立发现的 HIGH#1（0 新增路径绕过 green-by-construction 自检，可放行坏存量）方向相反——两路对同一代码区域给出了不同严重度判断，这属于异构评审的正常分歧信号，不由驱动员代为裁定谁对，留给下一段汇裁。另外 pi 未独立复测 codex HIGH#3 指出的"金牌哨兵是姊妹项目真实内网地址"一事（pi 只判了 term-lint 工具缺陷为 MED，未提地址真实性问题）。
