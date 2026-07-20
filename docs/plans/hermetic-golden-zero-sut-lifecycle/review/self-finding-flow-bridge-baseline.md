# 自查发现（待并入 codex 修正 pass）— flow-bridge 非 events 保真基线

Claude 自核 `tests/_golden/flow-bridge.golden.mjs` 逼出，印证评审请求风险1：

## 事实

- `flow-bridge.golden.mjs` C1–C16 测的是**相1 桥**（LLM mapping → compile 吃的 flow）+ **compile gate 段**：C3 跑 `casey compile <caseId> --testcase --flow --out-dir`（**无 `--execute`、无 `--sut`**，`flow-bridge.golden.mjs:75`），只验 flow 结构校验 exit 0 + 落 `flow-<caseId>.json`。零启动浏览器/fake-sut，确 zero-SUT。
- compile 类墓碑对象（wf-add-node / p3-compile / plan-debt-sweep）测的是 `compile --execute` 启动 fake-sut 抓**浏览器 events** 的保真（capturedAgainstBuild ?v= 回填/回放核验全 unique）——**另一层**。

## 结论：plan 的 compile-baseline 声明高估

`flow-bridge` 覆盖的是上游 **flow 结构校验/桥投影忠实**层，**不含** compile→events 字节级保真。故：

- compile 类金牌的独有价值（events 保真）**无 zero-SUT 基线**，应**全部**移真机 UAT（与 replay 保真同命），非「归 flow-bridge」。
- `flow-bridge` 只在某 compile 金牌恰含 flow-gate 校验断言时才是那部分的基线——但那层已由 flow-bridge 独立 hermetic 覆盖、compile 金牌未唯一新增。

## 对照 verdict 侧（不对称，此处 plan 成立）

`p2-verdict` 喂合成 StepAxes 测 `verdict.mjs` 的 axes→四态映射；该映射逻辑对合成/回放 axes 同构，故 replay 金牌的 verdict 映射断言**确冗余**（可归 p2-verdict）；独有的 axes 产出保真才移真机 UAT。

## 修法（并入 codex 修正 pass）

plan「双后继」与「D2 subsumption 基线」节改：
- verdict 类：映射归 `p2-verdict`（成立）；axes 产出保真 → 真机 UAT。
- compile 类：events 保真 **无 hermetic 基线、全移真机 UAT**；`flow-bridge` 仅覆盖 flow-gate 校验层（compile 金牌非唯一新增），不作 events 保真基线。
- D2 审核对 compile 金牌：辨其断言是 flow-gate 校验（flow-bridge 已覆盖）还是 events 保真（→真机），后者不得伪称有 hermetic 基线保留。
