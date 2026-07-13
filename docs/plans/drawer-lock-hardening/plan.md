# PLAN — drawer-lock-hardening（画布三原子域锁跨抽屉边界硬化，light）

> 决策全录 `docs/plans/drawer-lock-hardening/proposed/GRILL.md`（D1 方向定案 / D2 标题锚取舍 /
> D3 `nodeName` 供给通道 / D4 缺 `nodeName` fail-closed / D5 openNode 预点基线 / D6 抽屉域三态分层 /
> D7 夹具场景 / D8 金牌形态）。本文只排落地步骤与验收，不复议决策。
>
> **设计评审修订**（codex-sol@max，2026-07-14，处置录 `docs/plans/drawer-lock-hardening/review/`）：
> 采信 6 条设计 findings 并入——①标题锚加「标题文本自身可见」内层限定（D2 修订）；②`nodeName`
> 缺失判据扩到空串/纯空白（D4 修订）；③金牌矩阵补 G8–G11（点后歧义/域级多匹配/隐藏文本/select
> 正面半边）并拆分 G3/G7 为独立子用例；④断言升级：精确 `NEEDS_HUMAN` 路由 + 宽域候选零落笔取证；
> ⑤新 prd 冻结闭包补 fake-sut 双文件；⑥run 态节点标题字段纳入 mark()/rollback() 快照。
> 唯一部分驳回：「标题须在标题元素内」子项——结构/类锚已被 D2 以实证拒（真机未采样、
> `.lf-node-drawer__title` 属夹具自造），残余假设面在 GRILL 风险 1 明示并走既有 route:human 采样。

## 落地步骤

1. **夹具先行**（红证的考场）：`tests/fixtures/fake-sut/server.mjs` 加五场景（GRILL D7 工作名
   `twinfield` / `twinboth` / `twintitle` / `twinlate` / `twinghost`，实现期定稿；前三场景 WIP 已冻入
   分支 178408b，续接勿重敲）——详情页画布外挂第二个可见 `.hr-drawer__content-wrapper` 冒牌抽屉，
   字段/触发器与节点抽屉共用构建函数不特判。评审修订新增：`twinboth` 冒牌抽屉补挂「请选择」触发器
   （G11 考场）；`twinlate` 单击节点开真抽屉（ddempty 形态）**同刻**挂出含节点标题精确可见文本的冒牌
   抽屉（带同 placeholder 字段 + 触发器——「点后才出现的冒牌」考场）；`twinghost` 单击节点不开抽屉
   （drawernone 半形态）+ 冒牌抽屉含节点标题精确文本但该文本 display:none 隐藏（隐藏文本假绿考场）。
   既有场景零行为差。同步登记 `tests/fixtures/fake-sut/CONTRACT.md`。
2. **新金牌红先行**：写 `tests/_golden/drawer-lock-hardening.golden.mjs`（下方金牌清单 G1–G11），在
   **旧实现**上跑——G1–G11 必须逐条红（红证留存运行输出），accept 阶段以 `--red-verified` 收口并
   sha256 冻进新 `loop/prd-drawer-lock-hardening.json`。
3. **回放门收窄**（`lib/replay-actions.mjs`）：抽新 helper——可见 `.hr-drawer__content-wrapper` +
   `filter has getByText(label,{exact:true})` 标题锚，且标题文本自身可见（内层锚同限可见，堵「wrapper
   可见但标题藏在隐藏节点」的假命中——D2 修订；`filter({has})` 不查内层可见性，ddhidden 场景
   「全页门数得到、可见门数不到」同一心智模型）；`doSetNodeField` / `doSelectNodeDropdown` 过抽屉域
   三态（0→`none`、>1→`ambiguous`、1→字段/触发器级既有闸不动），label 取 `ev.nodeName`，缺失判据 =
   字段缺席、非 string、`trim()` 后为空三者任一（D4 修订），命中即硬阻断 `action_failed`；域级三分支
   （`none`/`ambiguous`/`unique`）照 setmulti `candidateValues` 先例（`replay-actions.mjs:240`）快照
   宽域候选取证——全部可见抽屉内同 placeholder 字段 value / 同型触发器显示值入 axes（零落笔/唯一
   落笔的实证，金牌吃；纯加法证据字段，axes 无冻结 schema 约束）；`doOpenNode` 加预点基线 + 点后
   域内恰一（D5，基线与回读锚同用「标题文本可见」口径）。
4. **编译门同刻**（`lib/compile-atoms.mjs`）：`compileWorkflowOpenNode` 成功后落 run 态当前节点标题 +
   自身预点基线/点后恰一 blocker（锚口径与回放门同刻，含「标题文本自身可见」）；
   `compileWorkflowSelectNodeDropdown` / `compileWorkflowSetNodeField` 读 run 态作标题锚域锁
   （三态 blocker；run 态缺失或空白同判 fail-closed blocker）+ emit 事件带 `nodeName`（既有冻结
   schema 字段，零 schema 改动）。run 态新字段（如 `nodeDrawerLabel`）**纳入** `createCompileRun` 的
   mark()/rollback() 快照（`lib/compile-atoms.mjs:194-200` 现仅六字段——补齐防未来重试回滚后残留
   陈旧节点身份，评审修订⑥）。
5. **既有金牌最小补齐**（D8）：`wf-set-node-field` / `wf-select-node-dropdown` /
   `replay-nth-visible-hardening` 三份金牌的手编 select/set 回放 events 补 `nodeName`；C2-a 编译产物
   断言各加严一条 `nodeName` 钉位（棘轮只加严）。`wf-open-node.golden.mjs` 预期零改动。
6. **重签**：下方重签清单四份 prd 的对应 testChecksums 键重算 sha256；新金牌冻进新 prd。
7. **验收命令序**全绿（后台跑 gate，轮询收结果）+ 全仓 ratchet 总核零漂移。

## touchesFiles

- `lib/replay-actions.mjs`（doOpenNode / doSelectNodeDropdown / doSetNodeField + 标题锚 helper）
- `lib/compile-atoms.mjs`（compileWorkflowOpenNode / SelectNodeDropdown / SetNodeField + run 态 + emit `nodeName`）
- `tests/fixtures/fake-sut/server.mjs`（五反面场景纯加法 + twinboth 冒牌补触发器）
- `tests/fixtures/fake-sut/CONTRACT.md`（场景登记）
- `tests/_golden/drawer-lock-hardening.golden.mjs`（新，红先行金牌）
- `tests/_golden/wf-set-node-field.golden.mjs`（手编 events 补 `nodeName` + 钉位加严）
- `tests/_golden/wf-select-node-dropdown.golden.mjs`（同上）
- `tests/_golden/replay-nth-visible-hardening.golden.mjs`（同上）
- `loop/prd-drawer-lock-hardening.json`（新 prd；`passes` 只由 gate 写；评审修订⑤：testChecksums
  冻结闭包 = `tests/_golden/drawer-lock-hardening.golden.mjs` + `tests/fixtures/fake-sut/server.mjs` +
  `tests/fixtures/fake-sut/CONTRACT.md` 三冻——反面场景载体一并冻死，防后人不动金牌只削夹具场景
  把考场静默弱化）
- `loop/prd-wf-set-node-field.json` / `loop/prd-wf-select-node-dropdown.json` /
  `loop/prd-replay-nth-visible-hardening.json` / `loop/prd-p5-replay.json`（重签）
- `docs/plans/drawer-lock-hardening/`（本目录文档）

不碰：`bin/verdict.mjs`（裁判内核）、`tests/_golden/schemas/events.schema.json`（冻结 schema 零改动）、
`compile-atoms.mjs` 的 wf.create 抽屉锚（:842/:866/:871/:882）、`.auth/`、`site.json`。

## 红先行金牌清单（每条：钉什么 + 先怎么验红）

新金牌 `tests/_golden/drawer-lock-hardening.golden.mjs`（沿用 p5-replay 形制手编 events +
compileFlowCase 助手；对照 GRILL 反面场景总表）。评审修订后的断言总纪律（对每条生效）：

- 反面用例的 verdict 一律钉**精确路由** `NEEDS_HUMAN`（fail-safe 应落轴；`layer3-wiring-coverage`
  钉法先例），不再只断「不 `PASS`」——堵「错误落成 `SUT_DEFECT` 等非目标终态仍过关」；
- 涉冒牌字段/触发器的用例一律加**零落笔/唯一落笔取证断言**（吃门内宽域候选快照，落地步骤 3）——
  堵「先误填冒牌抽屉、再因它故上报失败」的字面量过关实现；
- 每个原子分支一个独立子用例（checkAsync 隔离），不许「set 或 select」合写——堵一分支失败短路
  掩盖另一分支未执行。

清单：

- **G1 回放·setNodeField 跨抽屉误命中**：`twinfield` 手编 events（setup + set 事件带 `nodeName`）→
  断言 `resolution==='none'` + verdict 恰 `NEEDS_HUMAN` + 宽域候选快照全空（冒牌字段零落笔）。验红：
  旧宽域锁 count=1 真填冒牌抽屉字段、回读成立 → `unique`+`PASS`，断言必败（挂账假绿实锤）。
- **G2 回放·selectNodeDropdown 跨抽屉误命中**：`twinfield` 手编 events（select 事件带 `nodeName`）→
  断言 `resolution==='none'` + 恰 `NEEDS_HUMAN` + 宽域触发器显示值仍全「请选择」（零落笔）。验红：
  旧门点冒牌触发器选中回读成立 → `unique`+`PASS` 必败。
- **G3a 编译·setNodeField 跨抽屉误命中**：`twinfield` 上 compile flow（nav→open→addNode→openNode→set）
  → 断言 execute 预检 blocker exit 65 + 该原子零 events + blocker 点名域内 count=0。验红：旧编译门
  命中冒牌抽屉 exit 0 产 events，断言必败。
- **G3b 编译·selectNodeDropdown 跨抽屉误命中**：同 G3a 形制、flow 末步换 select（独立子用例）。
- **G4 回放·twinboth setNodeField 正面半边（域内唯一才动手）**：两抽屉各一同 placeholder 字段 → 断言
  `resolution==='unique'` + `candidateCount===1` + `identityReadback.ok===true` + verdict `PASS` +
  宽域候选快照证唯一落笔在真节点抽屉字段、冒牌字段仍空（防「填对了也顺手误动冒牌」漏网）。验红：
  旧宽域锁 count=2 → `ambiguous`，断言必败（证明收窄后能证出归属时照常干活、不是无脑全关）。
- **G5 回放·openNode 开错抽屉归因**：`twintitle`（点了不开 + 冒牌抽屉含节点标题）→ 断言
  `resolution==='action_failed'` + `identityReadback.ok` 非 true + verdict 恰 `NEEDS_HUMAN`。验红：
  旧回读命中冒牌抽屉 → `unique` 假绿必败。
- **G6 编译·openNode 预点基线**：`twintitle` 上 compile flow 到 openNode → 断言 blocker exit 65 +
  零 events + blocker 点名预点基线证不出归因。验红：旧编译门等到冒牌抽屉可见、后置核验过 → exit 0 必败。
- **G7 回放·`nodeName` fail-closed 钉桩（三独立子用例）**：happy 场景手编事件——G7a set 事件不带
  `nodeName`；G7b select 事件不带 `nodeName`；G7c set 与 select 事件 `nodeName` 为空串与纯空白各一
  （D4 修订判据）→ 一律断言 `resolution==='action_failed'` + 恰 `NEEDS_HUMAN`（绝不回落宽域锁）。
  验红：旧门无此字段要求照常 `unique`+`PASS` 必败；此桩同时锁死后人加 legacy 回落。
- **G8 回放+编译·openNode 点后歧义**：`twinlate`（预点基线 0、单击后真抽屉与含标题冒牌同刻出现）→
  回放断言 `resolution==='action_failed'` + 恰 `NEEDS_HUMAN`（点后域内 count=2 证不出归因）；编译半边
  断言点后恰一 blocker exit 65 + blocker 点名点后域内 count=2。验红：旧回读 first 可见即过 →
  `unique` 假绿必败；旧编译 isVisible 过 → exit 0 必败。（堵「冒牌抽屉点击后才出现」支线——
  twintitle 只覆盖点击前已存在。）
- **G9 回放+编译·set/select 域级多匹配**：`twinlate` 手编 events（openNode 点击已发生、两含标题抽屉
  在场后走 set 与 select 两独立子用例）→ 断言 `resolution==='ambiguous'` + `candidateCount===2` +
  宽域候选快照零落笔 + verdict 恰 `NEEDS_HUMAN`（reason 可加钉 `AMBIGUOUS_ACTION`，唯一合法字面量
  先例）。验红：旧宽域锁字段/触发器 count=1 命中冒牌 → `unique`+`PASS` 假绿必败。编译半边：openNode
  被 blocker 截后 run 态缺失 → select/set blocker fail-closed（D3 run 态缺失分支实钉）。
- **G10 回放·隐藏标题文本拒认**：`twinghost`（冒牌抽屉标题文本 display:none）→ openNode 断言
  `resolution==='action_failed'` + 恰 `NEEDS_HUMAN`（隐藏文本不算命中）；set 子用例断言域内
  count=0 → `none` + 恰 `NEEDS_HUMAN`。验红：旧 `filter({has})` 命中隐藏文本、wrapper 可见即过 →
  `unique` 假绿必败（钉「标题文本自身可见」收紧，D2 修订）。
- **G11 回放·selectNodeDropdown twinboth 正面半边**：两抽屉各一「请选择」触发器（冒牌在 DOM 序
  更前）→ 断言新门锁进真节点抽屉、`resolution==='unique'` + verdict `PASS` + 宽域候选快照证冒牌
  触发器仍「请选择」（唯一落笔在真抽屉触发器）。验红：旧宽域 nth=0 误点冒牌触发器同样
  `unique`+`PASS`——红落在取证断言（旧门无宽域快照证据 + 冒牌触发器被误动）必败；同时堵
  「多抽屉在场即无条件拒绝 select」的过宽实现。

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
node tests/_golden/drawer-lock-hardening.golden.mjs        # 必须 G1–G11 逐条红（留输出作红证；G11 红在取证断言）
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
