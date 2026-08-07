# delta 复审提示词 · compile-intent-lineage-rebind r2（只审 H1 修复）

你在 r1 对快照 `6082431` 裁 `CHANGES_REQUIRED`（H1 High + M1 Medium）。本轮只复审
H1 的修复 hunks 是否正确收口；M1 属冻结 schema 改版决策，已单独摆 Steven 裁，不在
本轮范围。结论行格式 `VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。

## 你的 r1 H1 原文（要点）

重绑只改 `events[].intentId` 与 `lastIntentId`；`observed[].intentId` 与
`verification[].intentId` 在 emit 时刻（`lib/compile-atoms-run.mjs:277-279`）已带走
编译器自生号未被重绑 → `synthesizeSkeleton` 按 assertionAtoms 产 authored 草稿、
draft 存在性闸（`bin/draft.mjs:100-105`）以 observed 全集为基准 → authored ∉
{intent_N} → exit 65 幽灵 intent 拒。

## 处置说明

修复提交 `2e4770b`（基线=你审过的 `6082431`，复审对象 = `git diff 6082431..2e4770b`）：

1. `lib/compile-atoms-flow.mjs` 重绑块：收集本步事件 stepId 集，按 stepId 同步改写
   `run.observed` / `run.verification` 行的 `intentId`（防御性 `Array.isArray` 取值，
   同函数内 blockers 先例——极简 run 桩可缺字段）。三通道逐 stepId 同号。
2. 金牌 `tests/_golden/compile-intent-lineage-rebind.zero-sut.golden.mjs` 补三钉：
   G1c-1（observed 逐 stepId 与 events 同号）、G1c-2（verification 同）、G2-5
   （混合流三通道双向一致：带号步全 authored、裸步全 intent_N）。
3. 红→绿证据：新钉对修前实现红 exit 1 实抓
   （`accept/red-proofs/compile-intent-lineage-rebind.h1-threechannel.delta-red.txt`，
   G1c-1/2 与 G2-5 三红、症状与你 r1 所述逐字吻合）；修后 16/16 绿；第三轮突变闭环
   （还原 `6082431` 版实现必红、恢复 sha256 逐字节同、必绿）。
4. 邻接组 + `bindagent-replay` + term-lint + selftest + gate 全绿复跑；PRD notes 已
   记账本轮并集修与 M1 待裁状态；plan.md 目标条已对齐逐步语义（你 r1 的文书注记）。

## 复审要求

- 自行核 `git diff 6082431..2e4770b` 只含上述白名单（lib 一处、金牌、PRD、docs 文书）。
- 可自跑金牌与突变复现（`git show` 姿势、勿 `git checkout -- `）。
- 重点证伪：stepId 集同步是否覆盖你 r1 给的失败场景（带号步 + 后继 assert →
  draft）；assert 折叠路径（不产事件、经 lastIntentId）是否被误改写；裸步/遗留流
  两通道是否零漂移。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
