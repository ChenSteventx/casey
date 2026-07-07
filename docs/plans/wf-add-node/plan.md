# wf-add-node — 画布维度首原子（workflow.addNode，full）

## 背景

R9 坐标 flow 解锁首步：`addNode` 出现于全部 23 条 R9 flow（docs/plans/p2-intent-compile/flywheel-schedule.md:18-20）。
真机二号探针（2026-07-07）证伪甲案（面板项单击/双击不落节点）、实证乙案（`mouse` 三段式拖拽落 `.lf-node`）。
决策全录 proposed/GRILL.md：D1 `dragTo` 动作类 + 双冻结重签授权、D2 落点=画布容器相对 `offsetX`/`offsetY`
（承载复用既有 `ox`/`oy` 字段）、D5 例翻反例=`agent.openToolPicker`、D9 仅 `addNode` 收窄（`openNode` 顺延下一契约）。
Steven 四项点选定夺已回填 GRILL（2026-07-07）。

## 改动（依赖序，两耦合核心 `lib/compile-atoms.mjs` 与 `events.schema.json` 串行、其余按 golden→prd disjoint 可并行）

### 阶段一 · 编译原子加法（13→14）+ 例翻

1. `lib/compile-atoms.mjs`：分派表 +`workflow.addNode`（集自动 13→14）——`compileWorkflowAddNode`：
   条件步线性化开面板（「添加节点」role=button count=1；面板已开则跳过，镜像 create 下拉先例 :448-462）
   → `dragTo` 本体经 `run.emit` `customAct` 通路（:180-182，emit 全生命周期定位核验/静默点/采集）
   → 后置核验 `.lf-node` 计数 +1 不过进 `run.blockers` 硬阻断（镜像 workflow.open 容器归属闸 :333-352）。
   落点参数：`nodeName`（面板项文本，身份门源）+ `x`/`y`（registry 语义 600/280 缺省，写 event `ox`/`oy`）。
2. `tests/_golden/flow-bridge.golden.mjs` 例翻（反例 `workflow.addNode`→`agent.openToolPicker`，D5 终拍）：
   C5 :89-92（头注 + bad mapping）、C14 :180-184（标题/正例集追加 addNode/反例集换/集 13→14 + 文案）、
   C15 :194-196（注释 + `.add` 篡改探针 + 漂移断言）。
3. `tests/_golden/wf-open-smoke.golden.mjs`：:3/:51-52/:55 集 13→14 + 文案（恰 14（13+1））。
4. 重签：`loop/prd-flow-bridge.json` / `loop/prd-wf-open-smoke.json` 各自 golden checksum 重算，gate 复验 GREEN。

### 阶段二 · `dragTo` 动作类（枚举 + 连锁 schema + 回放）

5. `tests/_golden/schemas/events.schema.json`：action 枚举 :86-94 +`dragTo`；:95 描述按 GRILL D2 修订口径重写
   （画布拖拽经 `dragTo` 封装为确定性动作，落点是内容参数；禁纯坐标步语义不变）；allOf 加 `dragTo` 分支
   （源语义定位必填 + `ox`/`oy` 落点必填；`ox`/`oy` :171-176 补语义描述「dragTo 落点：相对画布容器左上角的内容参数」）。
6. 三姊妹 schema（seams-freeze-v2.golden enumEq 强制全等）：`action-vocabulary.schema.json` :61-69 枚举 +
   :38 `maxItems` 7→8；`channel-driver.schema.json` :158-166 枚举；`run-history.schema.json` :59-67 枚举 +
   :175-181 交互定位支纳入 `dragTo`（源有定位 → `locatorResolution` string 分支）。
7. fixture：`tests/_golden/fixtures/seams-v2/action-vocabulary.fixture.json` 补 `dragTo` 治理条目
   （覆盖全枚举 :367 强制；`coordinateFallback.allowed:false` + `failClosed` 红线同族）；
   `channel-driver.fixture.json` web 驱动 `actionSpace` 声明 `dragTo` 能力。
8. 回放执行面：`lib/replay-actions.mjs` `doAct` :63-72 加 `dragTo` 分支——源身份门 count===1 才拖（既有
   :46-60 三态照走）；画布容器 `.lf-graph` count===1 且 `boundingBox` 可取，取不出如实回 false（fail-safe）；
   动作本体 `mouse.down` → `move`(steps:12) → 300ms → `up`（真机实证时序）；`bin/replay.mjs` :71-72
   `RH_INTERACTIVE`/`RH_ACTIONS` 纳入 `dragTo`；profile 加 `countSelector` 计数通道（缺省 `.hr-table-row`
   零行为差，画布用例配 `.lf-node`——GRILL D4 (a) 案，非冻结面加法）。
9. golden 计数硬编码：`tests/_golden/seams-freeze-v2.golden.mjs` :302 `7`→`8`；
   `tests/_golden/p3-compile.golden.mjs` :27 ACTIONS 加 `dragTo`（防漂移一致性）。
10. 重签：`loop/prd-seams-freeze.json`（events.schema）、`loop/prd-seams-freeze-v2.json`（golden + 三 schema +
    两 fixture）、`loop/prd-p3-compile.json`（golden）各自重算 checksum，gate 复验 GREEN。

### 阶段三 · 夹具 + 收口

11. `tests/fixtures/fake-sut/server.mjs`：画布通路纯加法（预研补丁已验 9/9：「添加节点」开 `.node-panel`
    21 项 `.node-item`（前 4 真机实采名）；`mousedown`/`mousemove`/`mouseup` 双守卫（位移 ≥12px 且落点
    `.lf-graph` 界内）落 `.lf-node`（`.lf-node-content` 节点名、`data-node-count` 计数）；单击/双击/微动/
    出界不落——真机否定行为反证面；既有场景零行为差）；`CONTRACT.md` 画布通路行为契约增补。
12. `lib/atoms-registry.snapshot.json` `nodeName` desc 修至真机实采 21 名（GRILL D8，零重签面）。
13. 设计条款：`docs/design/txt2testreport-design.md:135` 按 GRILL D2 草案修订留痕；CONTEXT.md:62 动作词汇表
    词条枚举串同步 +`dragTo`。
14. 重签：`loop/prd-p5-replay.json`（server.mjs + CONTRACT.md）重算 checksum，gate 复验 GREEN。
15. 全套复跑：tier1 + e2e-chain + 全 golden + 全仓 checksum 一致性扫（docs/plans/sign/learn.md:34 纪律）。

## 非目标

见 GRILL D10：`connectNodes`（拓扑取证无口挂账 SUT）、R9 其余 flow 逐条另契约、抽屉族原子（先 `openNode`，
下一契约）、不动 verdict.mjs/gate.mjs 冻结内核、不建 cases/ 真用例文件。

## 验收（红金牌 tests/_golden/wf-add-node.golden.mjs + loop/prd-wf-add-node.json）

- C1 `workflow.addNode` 可编译 + `COMPILE_KNOWN_ATOMS` 恰 14；`agent.openToolPicker` 不可编译（继任反例真缝）。
- C2 compile 全程（fake-sut happy）：events 含 `dragTo` 步且源带语义定位 + `ox`/`oy` 落点、过 events.schema
  校验、blockers 空、observed 含 `.lf-node` 计数 +1 证据。
- C3 mini 端到端：draft → sign → replay（`dragTo` 分支真跑夹具）→ verdict 全 PASS
  （`countChange` up 走 profile `countSelector` 通道）。
- C4 fail-closed 反面：源面板项多匹配不拖（ambiguous）/缺席不拖（none + 漂移探针）；画布容器缺席回 false
  不假绿；单击不落节点（夹具否定行为）；计数不 +1 进 blockers。
- C5 冻结面自洽：`dragTo` 过 seams-freeze / seams-freeze-v2 双金牌（词汇表覆盖全 8、`maxItems` 镜像、
  run-history 交互支归位）。
- 涟漪验收：flow-bridge / wf-open-smoke 两金牌例翻后全绿；六 prd（flow-bridge / wf-open-smoke /
  seams-freeze / seams-freeze-v2 / p3-compile / p5-replay）重签 gate 复验 GREEN；tier1 / e2e-chain /
  p5-replay / run-history 零行为差。
- observability（route:human 真机四停站，可并入下次合并行程）：① 21 面板项文本漂移复核；② `lf-node` 族
  类名漂移复核；③ 拖拽时序（steps:12 + 300ms）真机负载稳定性；④ `window.lf` 图对象口挂账 SUT 配合。
