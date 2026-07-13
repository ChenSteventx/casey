# plan 设计评审处置录 — drawer-lock-hardening

> 评审：codex-sol@max（跨族，2026-07-14，findings 原文 `planreview-codex.md`）；
> 汇裁：fable@xhigh（Steven 2026-07-13 定的汇裁路线）。同族终审偏袒护栏：默认采信跨族
> findings，驳回必须给具体反证。6 条 findings 逐条处置如下，修订已并入 plan.md 与 GRILL.md。

## F1（MED）D2 标题锚未排除「点击后才出现的冒牌」与隐藏文本命中 → 采信（一子项驳回）

- 采信实据：`filter({has})` 不查内层可见性、`:visible` 只约束 wrapper——本仓 ddhidden 场景注释
  「全页门数得到、可见门数不到」即同一心智模型（`tests/fixtures/fake-sut/server.mjs:308-310`）；
  `twintitle` 确只覆盖「冒牌点击前已存在」。
- 修订：标题锚内层文本锚同限可见（GRILL D2 修订，plan 步骤 3/4）；新增 `twinghost`（隐藏文本
  红钉，plan G10）与 `twinlate`（点后冒牌红钉，plan G8/G9）两场景。
- 驳回子项「文本须位于标题元素内」：结构/类锚 = D2 已拒的类锚——真机节点抽屉标题元素类未采样
  （wf-open-node GRILL D5 白纸黑字）、`.lf-node-drawer__title` 属夹具自造（server.mjs:303），锁它
  即夹具倒裁。残余假设面（可见精确标题的冒牌抽屉不可分辨）在 GRILL 风险 1 明示，走既有
  route:human 采样行程。

## F2（MED）D4 未拦空串/纯空白 `nodeName` → 采信

- 实据：`tests/_golden/schemas/events.schema.json` 只约束 `nodeName` 为 string，空串/纯空白类型合法。
- 修订：缺失判据扩为「字段缺席、非 string、`trim()` 后为空」三者任一（GRILL D4 修订）；编译侧
  run 态标题空白同判 blocker；G7 拆 G7a/G7b/G7c 三独立子用例覆盖。

## F3（MED）G1–G7 未覆盖三态全部边界分支 → 采信

- 修订：补 G8（openNode 点后域内 count=2）、G9（set/select 域级 count>1 → `ambiguous`，含编译半边
  run 态缺失 blocker 实钉）、G10（隐藏文本）、G11（selectNodeDropdown twinboth 正面半边）；
  G3 拆 G3a/G3b、G7 拆三，独立子用例隔离防短路掩盖。
- 附核：G9 红证成立——`twinlate` 下旧宽域锁字段/触发器 count=1 命中冒牌 → `unique`+`PASS` 假绿，
  新域级 count=2 → `ambiguous`，断言在旧实现必败。

## F4（MED）金牌只钉 verdict 字面量、未钉副作用与精确终态 → 采信

- 实据：`bin/verdict.mjs:81/85/97/99` 证实证不出分支恰落 `NEEDS_HUMAN`（`ambiguous` 分支 reason
  恒 `AMBIGUOUS_ACTION`），可精确钉；零落笔取证有现成形制——setmulti `candidateValues` 快照
  （`lib/replay-actions.mjs:240`，金牌 C3e 先例），axes 无冻结 schema、纯加法证据字段可行。
- 修订：断言总纪律入 plan 金牌清单——反面用例一律钉恰 `NEEDS_HUMAN`；涉冒牌的用例一律加宽域
  候选零落笔/唯一落笔取证断言（G1/G2/G4/G9/G11）；G4 加断冒牌字段未被误动。

## F5（MED）新 prd 冻结闭包遗漏反面场景载体 → 采信

- 实据：`loop/prd-drawer-lock-hardening.json` 尚不存在，原 plan 只写「新 prd」未列冻结闭包；
  `server.mjs` 正是 twin* 场景载体，不冻则考场可被静默削弱。
- 修订：新 prd testChecksums 三冻 = 新金牌 + `tests/fixtures/fake-sut/server.mjs` +
  `tests/fixtures/fake-sut/CONTRACT.md`（p5-replay 先例把 CONTRACT.md 视规范性测试资产一并冻）。

## F6（LOW）run 态新字段不在 mark()/rollback() 事务边界 → 采信

- 实据：`lib/compile-atoms.mjs:194-200` mark()/rollback() 仅六字段快照
  （events/observed/verification/stepN/intentN/lastIntentId）。
- 修订：run 态节点标题字段（如 `nodeDrawerLabel`）纳入 mark()/rollback() 快照（plan 步骤 4）。
