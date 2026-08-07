# PLAN · admission-terminal-group

前置：同目录 GRILL.md（Steven 裁甲：终端语义对齐基数门先例）。

## 改法（一个文件）

`lib/entity-observation-registry.mjs` · `validateObservationAdmission` 段 1：

1. 逐 click 校验原样保留（字段 fail-closed、重复完整三元组拒）。
2. 终端集改组内末 click：顺序遍历，`terminalByGroup.set(JSON([intentId,atom]), 投影)`
   ——最后写入即终端（基数门 `:361-365` 同构判据）；投影携 `yieldedToPlatformId`。
3. `terminals = [...terminalByGroup.values()]`；段 3/5/6 与让位谓词零改动自动继承。
   附带收紧：行锚脚手架 click → 无终端可配 → 既有拒路径具名拒。

## 验收金牌（accept 冻结，八钉）

- T1 多 click create + 单行锚末 click → ok（实现前必红——即 sign 二跑真形）。
- T2 行锚脚手架（非末）click → 拒（新收紧面，实现前红：今日脚手架也是终端故 ok）。
- T3 真产物全形（多 click create + open 让位 + delete 未登记绑定共存）→ ok
  （实现前必红——sign 通路的最小等价形）。
- T4 agent 单 click 遗留逐字等价 → ok。
- T5 重复完整三元组照拒。
- T6 双 create 组各锚各自末 click → ok（组隔离）。
- T7 让位谓词随新终端集生效（末 click 携字段豁免、脚手架 click 携字段不产义务）。
- T8 基数门与准入门同输入同判（对 T3 真形两门都 ok——两验证器判据同构实证）。
- 红/绿基线运行验证、sha256 冻结进 `loop/prd-admission-terminal-group.json`。

## 冻结面与收口

- 同文件邻接必绿：admission-envelope-yield / terminal-coverage-yield /
  cardinality-reverse / wiring / observation-yield。
- 突变闭环 + 全仓串行扫描 + 双路异构评审（ext4 克隆姿势）+ 收据/learn/audit →
  merge → 重跑 sign → replay 链续。

## 非目标

同 GRILL 第 4 条。
