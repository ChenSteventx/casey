# PLAN · terminal-coverage-yield

前置：同目录 GRILL.md（Steven 三点裁定：收窄版 A / platformId 硬桥接 / M1 schema 同车
一次人签）。本 plan 只落实现路线。

## 缺陷与目标

- 缺陷：让位（流层已裁语义）与注册表无条件 source 义务（成品层）打架——十四跑唯一红
  `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION`（open 终端 click 0 观察）。
- 目标：基数门学让位——豁免按 platformId 硬桥接门内重推导，fail-closed 不松；
  十五跑 exit 0 产全绿成功件。

## 改法（三个文件）

1. `lib/compile-atoms-workflow-nav.mjs` 让位分支（`:191-194`）：`priorSameId` 成立时，
   按 `r.stepId` 找到刚发出的终端 click 事件、盖 `yieldedToPlatformId =
   gate.matched.platformId`。既有让位 notes 文本一字不动（冻结金牌可能钉其存在）。
2. `lib/entity-observation-registry.mjs` · `checkIdentityObservationCardinality`
   反向基数循环：计数≠义务数时不再直接拒——四条件全与才豁免（GRILL 第 3 条：
   count===0 ∧ requiredRoles 恰 `['source']` ∧ click 携非空 `yieldedToPlatformId` ∧
   观察集内恰一条 `kind===entry.boundKind && role==='subject' && platformId===该值`），
   否则原码拒。加法门控：无新字段的一切既有输入行为逐字节不变。
3. `tests/_golden/schemas/events.schema.json` 改版（M1 同车）：`intentId` pattern
   `^intent_[0-9]+$` → `^intent_[A-Za-z0-9_]+$`；事件对象新增可选属性
   `yieldedToPlatformId`（非空 string）。三份归属 PRD（drawer-lock-hardening /
   page-topology-auth-continuity / seams-freeze）各登 `checksumAmendments`
   （old/new sha + 理由引 Steven 2026-08-07 两裁定）+ Steven 人签。

## 验收金牌（accept 阶段冻结，钉八件）

- Y1 豁免正例（实现前必红）：open 终端 click 携字段 + 恰一条同 kind/subject/platformId
  create 行 → ok。
- Y2 字段缺席照拒（绿基线）：同形去字段 → 原码拒（遗留等价）。
- Y3 伪造字段无匹配行 → 拒（字段非豁免宣告）。
- Y4 同 platformId 匹配行多条 → 拒（恰一才豁免）。
- Y5 subject 义务终端伪造字段 → 拒（所有权义务绝不豁免）。
- Y6 观察多于义务数 → 拒（「多」永不豁免，字段在也拒）。
- Y7 agent 逐字等价回归（无字段全遗留形）→ ok/拒行为与改前同码。
- Y8 编译缝（实现前必红）：驱真实让位路径产出的终端 click 事件携正确 platformId
  （镜像 wf-open-observation-yield 金牌的 harness 姿势）。
- Y9 schema 改版钉：pattern 新值 + 新属性在位 + authored 号样例过 pattern（实现前红）。
- 红/绿基线运行验证、sha256 冻结进 `loop/prd-terminal-coverage-yield.json`。

## 冻结面与风险核查

- `cardinality-reverse` 金牌：夹具无新字段 → 预期绿（加法门控实证）。
- `wf-open-observation-yield` 金牌：让位场景事件多一字段，若其钉事件形状可能红 →
  改版举证、与 schema 同签同车。
- 全仓金牌扫描单侧串行（新纪律）终判；护栏 #19。
- H1i / 出处链闸 / C3 守卫零接触；open 让位判据本体零接触。

## 评审与收口

- commit 快照（`git diff HEAD` 空）→ gate 写 passes → 双路异构（grok tmux 伪终端 +
  pi 默认入口，ext4 克隆树姿势备用）→ 并集修/delta 复审 → 收据 + learn + audit 入账
  → HANDOFF/NEXT-SESSION → merge dev → 隧道重启 → 十五跑（预登记：exit 0 产全绿
  成功件，任何红即停）。

## 非目标

同 GRILL 第 8 条。
