# codex 异构评审请求 round3：flow-bridge-golden-refit 二次修复复审

round1 判 FAIL 三缺陷；round2 确认 Finding 3 闭合、Finding 1/2 未闭合（我的首修不到位）。本轮只复审 Finding 1、Finding 2 的二次修复是否终闭合、有无新引入。Finding 3 已闭合，不重开。read-only。

## Finding 1（High）二次修复 —— 人签留痕 + 评审后字节补签

round2 你指出：① `HUMAN-SIGN.md` 顶部签署记录与正文签前时态自相矛盾（:3 未来式、波0 正文「需 Steven 签字确认」）；② 评审后两处冻结字节称「补签」却署 codex、且写「如需 Steven 复核」= 无真人签、断 ADR-0004 链。

二次修：
- 全文时态归一为「已签后状态」：`HUMAN-SIGN.md:3` 改为「已由 Steven 2026-07-21 签定…契约 loop 闭合」；波0 正文（原「需 Steven 签字确认」）改为「Steven 已签定为承接替代旧令（见签署记录第 2 条）」；全文再扫无「待/需/如需签」残留（仅剩「非待裁」澄清语）。
- 评审后两处字节由 Steven 真签：`HUMAN-SIGN.md` 的「评审修正补签」节记明——签署人 Steven、2026-07-21 经 AskUserQuestion 决策「批准补签两处」，落最终 sha：`cli-mcp-face.golden.mjs` `9543a9de`→`04899deb`（已重签 `prd-mcp-parity`）、`refit-regate-verify.mjs` `b8cd39a8`→`9b9b2803`（已重签本契约 prd）。

核：文档是否再无自相矛盾；两处评审后新字节是否有可查的人签记录（签署人、日期、方式、决策、最终 sha 全备），ADR-0004 链是否闭合。

## Finding 2（Medium）二次修复 —— s4 恒红 story 不再冒称已复 gate

round2 你指出：兄弟新鲜 evidence 反证可被 `gate --story <绿兄弟>` 单跑绕过，只证「同 prd 某 story 跑过」、不证「整 prd 已复 gate」。

二次修（`tests/_golden/support/refit-regate-verify.mjs`）：撤回该兄弟反证，改诚实标注——分列 `regatedGreen`（39，正面证明：passes===true + evidence 晚于红基线）与 `heldRed`（2，只保证 passes===false=未违规翻绿），输出 `39 复gate刷新绿（正面证明）+ 2 恒红守诚实（未违规翻绿）= 41 story 对账`。恒红分支注释说明：其 acceptance 自身失败、gate 不为失败 story 写 evidence，无从正面证明已复 gate，亦无必要（isolation-pending 承接、结构恒红）。

核：是否已彻底移除「兄弟反证」这一可绕过逻辑；新输出是否不再冒称恒红 story 已复 gate、只如实声称 passes===false；有无新引入的绕过或错分类。

## 现成证据（读，别复跑）

- 修后 `refit-regate-verify.mjs` 输出 `39 复gate刷新绿 + 2 恒红守诚实 = 41 对账；0 败`，exit 0。
- 校验器二次修字节已重签本契约 prd（`9b9b2803`）；契约 prd 复 gate 后 4/4 GREEN、s4 story 绿。

## 产出格式

给 `PASS`/`FAIL`。Finding 1、Finding 2 各给「闭合/未闭合/新问题」+ file:line。若均闭合、无新引入，明说 PASS 依据。Finding 3 已于 round2 确认闭合，无需复议。
