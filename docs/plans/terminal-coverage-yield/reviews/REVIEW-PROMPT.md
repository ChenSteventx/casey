# 评审提示词 · terminal-coverage-yield

你是异构评审方，对已提交不可变快照做代码评审。只报 Critical / High / Medium；结论行
`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给文件:行号、严重级、
失败场景。

## 仓与基线

- 仓：当前工作目录即契约树克隆（可自跑命令验证）。
- 基线：dev `643d3a9`；评审对象 = `git diff 643d3a9..HEAD`。
- 背景（按需读）：`docs/plans/terminal-coverage-yield/GRILL.md`（Steven 三点裁定：
  收窄版 A / platformId 硬桥接 / M1 schema 同车一次人签）、同目录 `plan.md`。

## 改动白名单（超出即报）

1. `lib/compile-atoms-workflow-nav.mjs` —— 让位分支盖 `yieldedToPlatformId`
   （让位判据与 notes 文本零接触）。
2. `lib/entity-observation-registry.mjs` —— `checkIdentityObservationCardinality`
   反向基数四条件豁免（加法门控）。
3. `tests/_golden/schemas/events.schema.json` —— pattern 放宽 + 新可选属性
   （Steven 已人签；两份归属 PRD 登 `checksumAmendments`）。
4. `tests/_golden/terminal-coverage-yield.zero-sut.golden.mjs`、
   `loop/prd-terminal-coverage-yield.json`、`loop/prd-page-topology-auth-continuity.json`、
   `loop/prd-seams-freeze.json`、`docs/plans/terminal-coverage-yield/**`。

## 风险清单（请优先证伪）

- R1 豁免是否可被滥用绕过读回义务：伪造字段、subject 义务、多条匹配、「多」面——
  金牌 Y3/Y4/Y5/Y6 是否真钉死；还有没有第五条泄漏路径。
- R2 加法门控是否成立：无字段输入下门行为与基线逐字节同码（cardinality-reverse /
  wiring / agent 遗留形）。
- R3 盖字段位置与让位判据的耦合：`r.stepId` 找到的事件是否恒为该组终端 click；
  非让位路径零接触。
- R4 schema 放宽的爆炸半径：pattern 新值是否引入不该合法的形状；新属性对
  `additionalProperties:false` 消费方的影响。
- R5 金牌 Y8 的 harness 是否诚实（种子行 + 合成锚定 click 的构造是否引入假绿面）。

## 既有证据（可自行复跑）

- 验收金牌 14 断言 exit 0；红基线 8 过/6 红（`accept/red-proofs/`）；突变闭环
  （三件实现整体还原→6 红→恢复→绿，`git show` 姿势复现、勿 `git checkout -- `）。
- 邻接八命令 + 归属金牌三家（seams-freeze/seams-freeze-v2/page-topology boundaries）
  全 exit 0；gate GREEN 2/2。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
