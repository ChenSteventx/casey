# ADR-0002：多态裁定 + fail-safe 默认 + 自愈准入门

- 状态：已接受
- 日期：2026-06-25
- 相关：设计 §4、§10；护栏 #13 #14 #15

## 背景

用户的核心要求：裁判必须区分**测试过程错误 / 测试用例本身有 bug / 被测真缺陷**，不得混淆。autotester 的门禁只有二值 `passes`（流程过没过），无法承载这一区分。直接把多态塞进二值门禁会让三类错误都坍缩成「红」，区分崩塌、自愈乱开。

最危险的失败模式：真 bug 表现成「元素不见了」，若被默认成「可自愈的工装漂移」会被悄悄重锚抹平 = 假绿；点错元素导致断言失败若被记成 `SUT_DEFECT` = 假缺陷、坑研发。

## 决策

1. **二值与多态分两个写者**：`gate.mjs`（二值、唯一写 `passes`，只看流程断言）保持不变；新建零 LLM 的 `verdict.mjs` 写多态 `verdict.json`，跑确定性判定树（设计 §4.2）给每步四态之一：`PASS` / `SUT_DEFECT` / `HARNESS_ERROR` / `NEEDS_HUMAN`（带 reason 子类）。
2. **fail-safe 不 fail-open**：机器只允许终判 `PASS` 与**有取证背书的** `SUT_DEFECT`。凡机器证不出的一律路由 `NEEDS_HUMAN`；catch-all 默认是 `NEEDS_HUMAN(INDETERMINATE)`，不是 `HARNESS_ERROR`。
3. **自愈准入门**：自愈只对正向确证的 `HARNESS_ERROR`（同稳定签名的唯一元素仍在）开闸；`SUT_DEFECT`/`NEEDS_HUMAN` 一律拒绝自愈。缺取证 ≠ 工装错。
4. **裁判与自愈分进程**：`verdict.mjs` 零 LLM；自愈（LLM）是它的下游消费者，绝不反向进入裁判进程。
5. **点击身份门 + 按发起方归因取证**：`actionPerformed` 仅当目标唯一或点击后身份回读成立才置 true，否则 `ambiguous`→`NEEDS_HUMAN`；网络取证按请求发起方归因（非时间窗），背景轮询 401 不得翻 verdict。
6. **三类错误的最终落点**：`NEEDS_HUMAN` 子类（`SUT_DEFECT_OR_STALE`/`CASE_DEFECT`/`AMBIGUOUS_ACTION`/`AFFORDANCE_ABSENT`/`INDETERMINATE`）在 Inbox 呈现证据，人三选一裁决——这是「区分过程错误/用例 bug/真缺陷」的最终落点。

## 为何难逆转

裁判态的语义是整个产品的信任根。一旦操作员据这四态分诊缺陷、提缺陷单给研发，事后改裁定语义会让历史报告全部失真、信任崩塌。故定为 ADR。

## 后果

- 收益：三类错误清晰可分；假绿/假缺陷被三道门（fail-safe 默认 + 自愈准入门 + 点击身份门）收口。
- 代价：需新建 `verdict.mjs` + `watchNetworkForensics` + 只读漂移探针（非照搬 autotester）；`NEEDS_HUMAN` 会比纯自动方案更多地占用人，这是为信任付的必要代价。
