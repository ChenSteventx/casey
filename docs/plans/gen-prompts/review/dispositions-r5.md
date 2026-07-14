# gen-prompts round-5 逐条处置（修复者 sonnet5，2026-07-14）

round-5 双路异构冗余复核：codex（gpt-5.6-sol@medium）判「通过」，pi（deepseek-v4-pro@high）判「通过」——两路评审首次在同一轮双双给出通过结论、零新增阻断项。这是双路复核自 round-2 起第五次交锋，也是第一次两路完全一致收敛。

## 双路共同指出的一项非阻断观察项：`URI_AUTHORITY_RE` 对 IPv6 字面量的中间提取结果不准确

**观察**：pi 独立指出，`http://[::1]/` 这类 IPv6 字面量地址经过 `URI_AUTHORITY_RE`（`/\bhttps?:\/\/(?:[^\s/?#@]*@)?([^\s/:?#]+)/gi`）提取时，捕获组会在 `[::1]` 内部第一个 `:` 处提前截断，只能捕获到 `[`，而不是完整的 `[::1]`。codex 独立复测同一场景，结论一致：`http://[::1]/`、ULA、link-local IPv6 均由既有专属 IPv6 正则先行命中，新增通道不会破坏它们。

**核实**：两路结论方向一致，判定为真实存在但无实际影响的实现细节，不是漏检。已用 `node -e` 直接调用 `scanPrivateAddress` 对三例实测坐实：

```
"系统见 http://[::1]/path 说明"       => {"hit":true,"kind":"IPv6 本机回环地址"}
"本机回环 http://[::1]:8080/api"      => {"hit":true,"kind":"IPv6 本机回环地址"}
"http://[fc00::1]/status"            => {"hit":true,"kind":"fc00::/7"}
```

三例全部正确命中，且 `kind` 都来自既有专属 IPv6 正则（不是新增的 `URI_AUTHORITY_RE` 通道）。`scanPrivateAddress` 的整体判定逻辑是多条 `PRIVATE_ADDR_PATTERNS`（含既有专属 IPv6 正则，直接扫描原始文本，不经过 `URI_AUTHORITY_RE`→`tryUrlNormalizeHost` 这条新增链路）与 `scanEquivalentEncodings`（含新增 URI authority 通道）并行扫描取"任一命中即命中"的逻辑——新增通道对 IPv6 场景的中间提取值不准确（提取出的 `"["` 经 `tryUrlNormalizeHost` 解析失败会返回 `null`、被静默丢弃），但既有专属 IPv6 正则独立、先于/无关于这条新增通道就已经覆盖了这些场景，整体检测结果不受影响。

**处置**：不修法。这是一个记账在案、有实测证据支撑的"真实但无害"的实现细节，不是本轮 finding。若未来有计划让 `URI_AUTHORITY_RE` 这条通道本身也扛起 IPv6 检测职责（目前不需要，已有独立防线），需要先修正其主机部分的字符集处理或显式排除方括号场景——留作后续若有正当理由再议，不在本契约当前范围内预防性修改。

## round-1 至 round-5 收敛小结

| 轮次 | codex 结论 | pi 结论 | 本轮新增真发现（codex 独立指出） |
|---|---|---|---|
| round-1（fable 汇裁） | —— | —— | 10 条（4 HIGH+4 MED+2 LOW，跨 codex/pi 两路初审汇裁） |
| round-2 | 需修改 | 通过 | 4 条 |
| round-3 | 需修改 | 通过 | 4 条 |
| round-4 | 需修改 | 通过 | 1 条 |
| round-5 | 通过 | 通过 | 0 条（仅 1 条双路共同复核过的非阻断观察项，已实测核验为无实际影响） |

自 round-2 起，codex 每轮独立指出的问题数量单调递减（4→4→1→0），且问题性质逐轮收窄——round-2/3 是跨多个不同代码区域的实质缺陷（凭据回显、等价编码漏检、原子写竞态、term-lint 解析 bug、repoint 绕过等），round-4 收窄到对已有取舍边界的一处精细化调整（裸文本 vs. 协议头上下文），round-5 归零、只剩一条双路已确认无实际影响的观察项。判定为已收敛：不是"评审者放水"，而是每轮真发现都被红先行修死、金牌冻结，可供下一轮复核的"新表面积"逐轮耗尽。

## 汇总核验

- 全仓地址字节串检索（脱敏方式核对，排除 `node_modules`）：0 处命中，含全部 5 轮评审归档 `.md` 文件与本轮新增材料。
- `node tests/_golden/gen-prompts.golden.mjs`：77 过 / 0 败（round-5 未新增/未删减断言，复用 round-4 收口时新增的 F4c1c 五个用例）。
- `node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json`：GREEN，story 2/2 过。
- `tests/_golden/gen-prompts.golden.mjs` sha256：`2ef73f80ab2464edfffd9628455ddc5e394ecd89df895d9c0225383cba1e82ed`（与 `loop/prd-gen-prompts.json` 冻结值一致）。
- `lib/promptset-authoring.mjs` 当前 sha256：`e83536e03884d5bc2fca83c98592b2610f6a464f8bf58e23d9c5a2fe37b06a76`（非冻结文件，供归档追溯）。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`bin/promptset.mjs`、`lib/promptset.mjs`：round-2 至 round-5 全程零改动，`loop/prd-gen-prompts.json` 里 `bin/verdict.mjs`/`lib/sign-gate.mjs` 两项 testChecksums 自契约起始至今未变过。

## 结论：双路 PASS，round-1 至 round-5 迭代收口

HIGH severity 的 4 条 round-1 finding（真实地址泄露、报错输出封口、符号链接原子写竞态、green-by-construction 绕过）与其余全部 round-1/2/3/4 finding 均已逐条红先行修死、金牌冻结、双路复核过。round-5 双路 PASS、零新增真发现，按任务要求的收敛条件（双路 PASS 或全部处置有账）达成，循环在此收口。
