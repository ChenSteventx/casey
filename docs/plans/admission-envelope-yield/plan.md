# PLAN · admission-envelope-yield

前置：同目录 GRILL.md（承 Steven 已签让位设计的第三消费者接线，方向零新岔口）。

## 改法（一个文件）

`lib/entity-observation-registry.mjs` · `validateObservationAdmission`：

1. 终端投影携带取证字段：`terminals.push({...})` 增 `yieldedToPlatformId`
   （非空 string 才携，内部投影、对外形状零变）。
2. 让位判定内联谓词：四条件（义务恰 `['source']` / 字段非空 / 全部已验行中恰一条
   同 kind + role=subject + platformId 行）。
3. 4b 信封义务豁免：义务原子缺信封时，该原子**全部**终端均让位才 continue，
   否则原码拒 `OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION`。
4. 6) 角色计数豁免：终端零行且让位才 continue，否则原码拒
   `OBSERVATION_ROLE_COUNT_MISMATCH`（部分行在场仍拒——只对「少=0」开）。

## 验收金牌（accept 冻结，直驱 + 真产物字节形）

- A1 豁免正例（实现前必红）：create 信封（subject 行携 platformId）+ open 终端
  click 携字段 + open 零信封 → ok。
- A2 无字段遗留照拒（绿基线）：同形去字段 → `OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION`。
- A3 伪造字段无匹配行 → 照拒。
- A4 subject 义务终端携字段 → 照拒（义务面白名单）。
- A5 匹配行多条 → 照拒（恰一才豁免）。
- A6 open 信封在场但空 + 让位字段 → 原码 `OBSERVATION_ROLE_COUNT_MISMATCH` 拒
  （信封在场即非「整缺」面，空信封是 c26 既有拒面不松）。
- A7 agent 遗留形逐字等价 → ok。
- A8 真产物字节形回归（实现前必红）：以十五跑产物形状（17 绑定、单 create 信封、
  open 让位 click）构造最小等价输入 → ok。
- 红/绿基线运行验证、sha256 冻结进 `loop/prd-admission-envelope-yield.json`。

## 冻结面与收口

- 同文件邻接：terminal-coverage-yield / cardinality-reverse / wiring 金牌零接触必绿；
  全仓串行扫描（护栏 #19）；突变闭环（还原实现必红/恢复 sha 同/必绿）。
- commit 快照 → gate → 双路异构评审（grok tmux + pi 默认入口，ext4 克隆姿势）→
  收据 + learn + audit → merge dev → 重跑 sign（Steven 已签呈件不变）→ replay 链续。

## 非目标

同 GRILL 第 4 条。
