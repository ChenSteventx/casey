# intent-plan-known-atom-foundation · 实现评审

> 结论：`PASS_WITH_FIXES`（带修复通过，Casey owner 按冻结契约裁定）。
>
> 这不是把外部评审 harness（调用链）故障记成通过。Grok 组合评审 R1 的两项真实缺陷已经修复并复验；
> Grok R2 与 pi.dev 复审均未产出有效裁决，故分别诚实记录为 `HARNESS_ERROR`。

## 1. 评审范围

- `lib/compile-gate.mjs`
- `lib/intent-plan.mjs`
- `lib/intent-recipes.snapshot.json`
- `lib/assertion-draft.mjs`
- `bin/draft.mjs`
- 本契约的 plan、PRD、schema 与三条新功能金牌
- 评审修复提交 `4f115ec`

不在本轮范围：陌生页面浏览器执行、业务前置条件 setup flow、人工示教回放、正式录制 intake、真实
AI 中台 UAT、医生站与 Hi 小助跨场景验收。

## 2. 对抗性评审处置

Grok 对 intent-plan 核心的首轮独立评审为 `APPROVE`，没有 Critical/High；随后组合评审 R1 给出
`CHANGES_REQUIRED`。逐项按冻结 plan 和可执行规格核对后的处置如下：

| R1 意见 | 事实裁定 | 处置 |
|---|---|---|
| 模型 patch 精确重复会增加重复断言 | 真实缺陷 | 新增 `mergeAssertionPatches`，结构相同项成为幂等 no-op；不删除、不替换已有断言 |
| bridge/state 多步骤失败统一归到首 intent | 真实缺陷 | 从 `step[n]` / `mapping[n]` 问题定位对应 intent；只有无法索引的问题才使用稳定兜底 |
| `traceStateMachine` 的 missing 补入污染 problems | 事实误读 | 补入的是状态集合，延续旧状态机防连锁误报语义；旧 problems 字节兼容金牌 5/5 |
| 无 `--testcase` 时仍走 legacy skeleton | 与冻结兼容要求冲突 | plan 明确要求缺席时旧行为不变，不改 |
| known override 时仍保留 known mapping | 与 known dominance 契约冲突 | known 结果保留，但 `ready=false`，因此不能投影执行；覆盖请求被结构化拒绝 |
| 未 ready plan 仍暴露 state trace | 非执行漏洞 | trace 用于 grill/诊断；`mappingFromIntentPlan` 对未 ready plan 硬拒 |
| 对 problems 排序 | 与旧字节语义冲突 | 不采纳；`checkStateMachine` 必须保持既有顺序与文本 |
| authored 缺 kind/op 未立即抛错 | 已有 fail-closed 分层 | 不完整 authored 进入 pending；完整但非法 kind/op 由现有 `validateDraft` 硬拒 |

## 3. 修复后证据

2026-07-27 在当前主工作树逐项重跑：

- intent plan：10/10；
- state trace：5/5；
- authored assertion freeze：6/6；
- flow bridge：17/17；
- compile gate：7/7；
- assertion drafter：20/20；
- draft CLI：11/11；
- `casey selftest --tier1`：GREEN；
- 统一语言注册表：GREEN；
- PRD 四条 story：4/4 `passes=true`，冻结 checksum 未改。

另有两个针对 R1 真实缺陷的定点探针：

- 重复模型 patch 保持断言数量不变；
- 多步骤 bridge 失败归因到实际失败的 mapping intent。

`p2-sign-unit` 为 21/21。完整 `p2-sign` 仍有一个既有 frozen entity lock 缺口；本轮基线已有该缺口，
且 Wave 1 没有修改 sign/runtime，所以不把它包装成本轮全绿，也不把它归因给本实现。

## 4. 供应方复审状态

- Grok 组合评审 R1：有效，`CHANGES_REQUIRED`；两项真实缺陷已在 `4f115ec` 修复。
- Grok R2：TUI 停在订阅提示页，没有会话和 verdict，记 `HARNESS_ERROR`，未重试。
- pi.dev DeepSeek V4 Pro：通过既定已配置入口发送白名单材料，386 秒无 stdout/stderr 和 verdict，随后
  中断；确认无残留进程，记 `HARNESS_ERROR`，未重试。

因此最终结论不是“外部供应方 R2 PASS”，而是 owner 对有效 R1 发现、冻结契约、修复 diff 和修复后
全量证据做出的 `PASS_WITH_FIXES`。供应方链路恢复后可以追加非阻断复核，但不能反向抹掉本记录。

## 5. 残余边界

- recipe 当前只实现冻结的 exact 子集，尚未实现 anchored-template；
- `BRIDGE_REJECTED` 仍是对外粗粒度 reason，细节在 bridge/state problems；
- 当前只能证明“陌生表述命中已知 atom + authored assertion 冻结”，不能证明任意陌生页面可执行；
- setup flow、页面观察/确定性解析和人工录制 fresh reproduction 进入后继契约。

