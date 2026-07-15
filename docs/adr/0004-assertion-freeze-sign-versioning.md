# ADR-0004：断言冻结 + 人签门 + 期望版本化

- 状态：已接受
- 日期：2026-06-25
- 相关：设计 §2.1、§4.3、§5；护栏 #1 #5 #16

## 背景

断言是裁判的依据。若 LLM 能自由发明断言、或断言能被悄悄放松、或把会变动的观测值冻成字面量，裁判就不可信：要么每跑假红（实体 ID/时间戳名每跑变），要么实现者把红改绿（奖励钻营）。同时，被测系统**有意改版**会让旧期望过时——若每次合理改版都自动记缺陷，操作员会学会无视 verdict，信号自毁。

## 决策

1. **断言只能从带类型词汇表里选**（设计 §2.1：urlPathname/textVisible/countChange/inputReadback/streamReplyReceived/...），每种限定允许的 op；LLM 不准发明自由断言或「语义相似」判据。
2. **默认结构式、易变值模板化**：URL 里的实体 ID/uuid/时间戳、`atl_` 唯一名一律用 `startsWith`/`matches`/模板，不用 `equals`；`uniqueName` 永不进冻结字面量，回放期实例化再比。冻结期有 lint 拦截 `equals` 含 ID/`atl_` 串。
3. **草拟 → 冻结 → 人签三段**：LLM 草拟（相2-①）→ 写进 `prd-<caseId>.json` 并 checksum 冻结**仅断言文件**（相2-②）→ **人签**后才算数（相2-③）。冻结后改一字符断言 = Test Ratchet 判红。
4. **期望版本化 + 重签通道**：每条冻结 `expected[]` 带 `signedAt`/`signedAgainstBuild`/`signerId`。有意改版导致的失败走 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)` → 人重签新基线（新 checksum + 新 `signedAgainstBuild`，旧期望归档），**不**自动记缺陷。
5. **人签是 CASE_DEFECT 与 SUT_DEFECT 的分水岭**：「入口可证缺席」在人签前 = 用例缺陷候选；在人签后（同入口编译时够得到）= 回归或漂移，绝不再判用例缺陷。
6. **gate 绿 ≠ 完成**：可命令化验收测不到语义正确性（用例是否真表达意图、真站是否真 bug），需求完成以人签真机 UAT 为准。

## 后果

- 收益：断言严格、不可悄悄放松、不假红；合理改版不误报，信号不自毁。
- 代价：每条用例需一次人签门（不能全自动到底）——这是「让区分站得住」的必要人工，记为 Observability `route:human`。
