# PLAN — drawer-lock-hardening（画布三原子域锁跨抽屉边界硬化，light）

> 决策全录 `docs/plans/drawer-lock-hardening/proposed/GRILL.md`（D1 方向定案 / D2 标题锚取舍 /
> D3 `nodeName` 供给通道 / D4 缺 `nodeName` fail-closed / D5 openNode 预点基线 / D6 抽屉域三态分层 /
> D7 三夹具场景 / D8 金牌形态）。本文只排落地步骤与验收，不复议决策。

## 落地步骤

1. **夹具先行**（红证的考场）：`tests/fixtures/fake-sut/server.mjs` 加三场景（GRILL D7 工作名
   `twinfield` / `twinboth` / `twintitle`，实现期定稿）——详情页画布外挂第二个可见
   `.hr-drawer__content-wrapper` 冒牌抽屉，字段/触发器与节点抽屉共用构建函数不特判；既有场景零行为差。
   同步登记 `tests/fixtures/fake-sut/CONTRACT.md`。
2. **新金牌红先行**：写 `tests/_golden/drawer-lock-hardening.golden.mjs`（下方金牌清单 G1–G7），在
   **旧实现**上跑——G1–G7 必须逐条红（红证留存运行输出），accept 阶段以 `--red-verified` 收口并
   sha256 冻进新 `loop/prd-drawer-lock-hardening.json`。
3. **回放门收窄**（`lib/replay-actions.mjs`）：抽新 helper（可见 `.hr-drawer__content-wrapper` +
   `filter has getByText(label,{exact:true})` 标题锚）；`doSetNodeField` / `doSelectNodeDropdown` 过
   抽屉域三态（0→`none`、>1→`ambiguous`、1→字段/触发器级既有闸不动），label 取 `ev.nodeName`、缺失
   硬阻断 `action_failed`（D4）；`doOpenNode` 加预点基线 + 点后域内恰一（D5）。
4. **编译门同刻**（`lib/compile-atoms.mjs`）：`compileWorkflowOpenNode` 成功后落 run 态当前节点标题 +
   自身预点基线/点后恰一 blocker；`compileWorkflowSelectNodeDropdown` / `compileWorkflowSetNodeField`
   读 run 态作标题锚域锁（三态 blocker）+ emit 事件带 `nodeName`（既有冻结 schema 字段，零 schema 改动）。
5. **既有金牌最小补齐**（D8）：`wf-set-node-field` / `wf-select-node-dropdown` /
   `replay-nth-visible-hardening` 三份金牌的手编 select/set 回放 events 补 `nodeName`；C2-a 编译产物
   断言各加严一条 `nodeName` 钉位（棘轮只加严）。`wf-open-node.golden.mjs` 预期零改动。
6. **重签**：下方重签清单四份 prd 的对应 testChecksums 键重算 sha256；新金牌冻进新 prd。
7. **验收命令序**全绿（后台跑 gate，轮询收结果）+ 全仓 ratchet 总核零漂移。

## touchesFiles

- `lib/replay-actions.mjs`（doOpenNode / doSelectNodeDropdown / doSetNodeField + 标题锚 helper）
- `lib/compile-atoms.mjs`（compileWorkflowOpenNode / SelectNodeDropdown / SetNodeField + run 态 + emit `nodeName`）
- `tests/fixtures/fake-sut/server.mjs`（三反面场景纯加法）
- `tests/fixtures/fake-sut/CONTRACT.md`（场景登记）
- `tests/_golden/drawer-lock-hardening.golden.mjs`（新，红先行金牌）
- `tests/_golden/wf-set-node-field.golden.mjs`（手编 events 补 `nodeName` + 钉位加严）
- `tests/_golden/wf-select-node-dropdown.golden.mjs`（同上）
- `tests/_golden/replay-nth-visible-hardening.golden.mjs`（同上）
- `loop/prd-drawer-lock-hardening.json`（新 prd；`passes` 只由 gate 写）
- `loop/prd-wf-set-node-field.json` / `loop/prd-wf-select-node-dropdown.json` /
  `loop/prd-replay-nth-visible-hardening.json` / `loop/prd-p5-replay.json`（重签）
- `docs/plans/drawer-lock-hardening/`（本目录文档）

不碰：`bin/verdict.mjs`（裁判内核）、`tests/_golden/schemas/events.schema.json`（冻结 schema 零改动）、
`compile-atoms.mjs` 的 wf.create 抽屉锚（:842/:866/:871/:882）、`.auth/`、`site.json`。

## 红先行金牌清单（每条：钉什么 + 先怎么验红）

新金牌 `tests/_golden/drawer-lock-hardening.golden.mjs`（沿用 p5-replay 形制手编 events +
compileFlowCase 助手；对照 GRILL 反面场景总表）：

- **G1 回放·setNodeField 跨抽屉误命中**：`twinfield` 手编 events（setup + set 事件带 `nodeName`）→
  断言 `resolution==='none'` + verdict 不 `PASS`。验红：旧宽域锁 count=1 真填冒牌抽屉字段、回读成立 →
  `unique`+`PASS`，断言必败（挂账假绿实锤）。
- **G2 回放·selectNodeDropdown 跨抽屉误命中**：`twinfield` 手编 events（select 事件带 `nodeName`）→
  断言 `resolution==='none'` + 不 `PASS`。验红：旧门点冒牌触发器选中回读成立 → `unique`+`PASS` 必败。
- **G3 编译·两原子跨抽屉误命中**：`twinfield` 上 compile flow（nav→open→addNode→openNode→set 或
  select）→ 断言 execute 预检 blocker exit 65 + 零 events + blocker 点名域内 count=0。验红：旧编译门
  命中冒牌抽屉 exit 0 产 events，断言必败。
- **G4 回放·twinboth 域内唯一才动手（正面半边）**：两抽屉各一同 placeholder 字段 → 断言
  `resolution==='unique'` + `candidateCount===1` + `identityReadback.ok===true` + verdict `PASS`。验红：
  旧宽域锁 count=2 → `ambiguous`，断言必败（证明收窄后能证出归属时照常干活、不是无脑全关）。
- **G5 回放·openNode 开错抽屉归因**：`twintitle`（点了不开 + 冒牌抽屉含节点标题）→ 断言
  `resolution==='action_failed'` + `identityReadback.ok` 非 true + 不 `PASS`。验红：旧回读命中冒牌抽屉 →
  `unique` 假绿必败。
- **G6 编译·openNode 预点基线**：`twintitle` 上 compile flow 到 openNode → 断言 blocker exit 65 +
  零 events + blocker 点名预点基线证不出归因。验红：旧编译门等到冒牌抽屉可见、后置核验过 → exit 0 必败。
- **G7 回放·缺 `nodeName` fail-closed 钉桩**：happy 场景手编 set 与 select 事件**不带** `nodeName` →
  断言 `resolution==='action_failed'` + 不 `PASS`（D4：绝不回落宽域锁）。验红：旧门无此字段要求照常
  `unique`+`PASS` 必败；此桩同时锁死后人加 legacy 回落。

既有金牌补齐后的复跑（非新红，但属验收面）：三份补 `nodeName` 金牌 + `wf-open-node` +
涟漪族全绿、既有场景判定零行为差（GRILL D6 断言）。

## 预计重签 checksum 的 prd 清单

用 node 遍历 `loop/prd-*.json` 的 `testChecksums` 对 touchesFiles 求交（2026-07-13 实扫结果，一个不漏）：

| prd | 命中的冻结键 | 重签原因 |
|---|---|---|
| `loop/prd-wf-set-node-field.json` | `tests/_golden/wf-set-node-field.golden.mjs` | 手编 events 补 `nodeName` + 钉位加严 |
| `loop/prd-wf-select-node-dropdown.json` | `tests/_golden/wf-select-node-dropdown.golden.mjs` | 同上 |
| `loop/prd-replay-nth-visible-hardening.json` | `tests/_golden/replay-nth-visible-hardening.golden.mjs` + `tests/fixtures/fake-sut/server.mjs` | 金牌补 `nodeName`；夹具加场景（双冻文件） |
| `loop/prd-p5-replay.json` | `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md` | 夹具加场景 + 场景登记（双冻文件） |

条件项：`loop/prd-wf-open-node.json`（冻 `tests/_golden/wf-open-node.golden.mjs`）——预期零改动不重签；
实现期若被迫动它，重签并在提交说明记账。`lib/*.mjs` 两实现文件未被任何 prd 冻结（实扫确认）。
另注：`loop/prd-flow-bridge.json` / `loop/prd-report-workflow-structure.json` 虽引用三原子字样，其冻结
金牌不回放抽屉原子、`COMPILE_KNOWN_ATOMS` 恒 18 不变，零改动零重签（涟漪复跑守住）。

## 验收命令序

红证（实现前，accept 阶段）：

```
node tests/_golden/drawer-lock-hardening.golden.mjs        # 必须 G1–G7 逐条红（留输出作红证）
```

实现后（gate 慢，后台跑逐个收）：

```
node loop-kit/bin/breaker.mjs --reset
node tests/_golden/drawer-lock-hardening.golden.mjs        # 新金牌全绿
node tests/_golden/wf-set-node-field.golden.mjs            # 补 nodeName 后全绿
node tests/_golden/wf-select-node-dropdown.golden.mjs
node tests/_golden/replay-nth-visible-hardening.golden.mjs
node tests/_golden/wf-open-node.golden.mjs                 # 零改动复跑（预点基线零行为差）
node tests/_golden/wf-add-node.golden.mjs                  # 画布族涟漪
node tests/_golden/wf-connect-nodes.golden.mjs
node tests/_golden/wf-open-smoke.golden.mjs
node tests/_golden/flow-bridge.golden.mjs
node tests/_golden/p5-replay.golden.mjs                    # 夹具双冻回归
node tests/_golden/p5-replay-coverage.golden.mjs
node tests/_golden/e2e-chain.golden.mjs                    # 全链零行为差
node tests/_golden/report-workflow-structure.golden.mjs    # 集 18 不变 + 结构块零行为差
node bin/casey.mjs selftest --tier1                        # 裁判零 LLM 链路自检
node loop-kit/bin/gate.mjs --prd loop/prd-drawer-lock-hardening.json
node loop-kit/bin/gate.mjs --prd loop/prd-wf-set-node-field.json
node loop-kit/bin/gate.mjs --prd loop/prd-wf-select-node-dropdown.json
node loop-kit/bin/gate.mjs --prd loop/prd-replay-nth-visible-hardening.json
node loop-kit/bin/gate.mjs --prd loop/prd-p5-replay.json
```

收尾（合并前，HANDOFF 教训）：全仓 ratchet 总核——node 遍历每份 `loop/prd-*.json` 的
`testChecksums` 对实际文件 sha256 逐键比对，必须全 MATCH（逮跨契约共享冻结文件漏签）。

## 提交纪律

- 只列显式路径（上方 touchesFiles + 本目录文档），绝不 `add -A`；不带 `loop/prd-selftest.json` 时间戳漂移。
- 重签的 sha256 变更在提交说明里逐 prd 记账（冻结文件对实现者只读、重签走记账例外）。
- 异构冗余评审：本实现属 Claude 家族 → review 阶段派 codex（评审家族≠实现家族）。
