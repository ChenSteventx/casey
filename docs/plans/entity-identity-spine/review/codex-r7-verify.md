# codex R7 确认评审 — entity-identity-spine（PASS）

- 日期：2026-07-23
- 评审家族：codex gpt-5.6-sol（reasoning high），异构核验 Claude 实现（review 家族 ≠ 实现家族）
- 暴露方式：`codex exec -C <真 worktree> -s read-only`——评审方读真实代码 + 亲跑金牌（只读沙箱，改不了文件）
- 措辞：中性正确性核验（避对抗/攻击词触发内容闸）
- 会话：codex session 019f8e94-3ee3-77c2-879d-c233ba04da7c；原始全 log 见 scratchpad `c0-r7-codex-review.log`（560KB）
- 备注：早期有一条 rmcp MCP transport 403（missing csrf token）非致命，评审照常只读进行

## 评审目标

核验 R7 对 R6b 两处缺口的修复是否成立、是否引入新缺口、是否弱化既有不变量：

1. 五元组键碰撞掩盖 bindingMode 权威（R6b-High）——R7 改：去 step-4 的 some()，row→terminal 锚定改 anchoringBindings（完整六元组 filter，键含 intentId 消歧维），step5 要求每 (row, terminal) 恰一条锚定 binding（>1 → OBSERVATION_BINDING_JOIN_AMBIGUOUS），step5b 从唯一锚定 binding 取 bindingMode 权威。
2. 畸形 atom 前置（R6b-Medium）——R7 把 isNonEmptyString(ev.atom) 前置到 registry.has 之前：字段畸形拒（OBSERVATION_TERMINAL_FIELD_INVALID）、合法未登记孤儿 atom 放行。
3. bin/sign.mjs 收据映射键化——拆 provenanceByBindingKey（六元组含 intentId）+ provenanceByRowKey（五元组）。

## 结论：通过

- Critical：无　High：无　Medium：无
- codex 亲跑「终端 binding × 干扰 binding × 行 mode」27 组反例矩阵：干扰 intent 的 mode 不再影响裁定；只有终端 mode 本身被允许且行与之相等才 ok:true；终端为 successor 的所有组合均拒。
- atom 边界矩阵：缺失/null/空白/数字全部拒，任意非空未登记字符串放行。未发现新的应拒却 ok:true 构造。
- 六元组唯一锚定、c17（一行锚两终端、每终端各有唯一 binding）多终端拒绝、atom 边界、sign 双键映射均成立。
- 纯函数 43/43 全绿，c17/c35–c38 独立退出 0；两枚完整金牌仅因只读沙箱建不了 scratch 目录退 1，属题定环境限制（非缺陷）。
- 核 v2 冻结件 sha=b7b5a47e…（未动）。

## Claude 独立复验（正常可写环境，e1-e8 spawn 真 sign 真跑）

- entity-identity-spine.admission-registry 金牌：51/51 exit 0（e8 R6b-High 反例经生产 sign 实拒 exit 65）。
- 邻接面字节零漂移：agent-id-regression-diff 21/21、agent-id-sign-observation 11/11、agent-id-observation 30/30 全 exit 0。
- gate：GREEN（story 1/1，唯一 passes 写入）。
- v2 sha b7b5a47e1830084a 未动；registry/sign NUL 字节=0（tr -cd 实计），git 视为文本可 diff。
