# Casey 排期 v2 —— 接缝优先、并行解锁（取代 bootstrap plan 的线性「总体顺序」）

> 2026-06-29 重排。bootstrap plan 的 `P3→P4→P5→P6→P7` 线性顺序已不合理：它把「运行时数据依赖」误当「开发顺序依赖」。本文用接缝优先重排，里程碑细节仍以 `bootstrap/plan.md` 各节为准。

## 核心原则：冻接缝 → 对合成 fixture 并行

P2 已证明：裁判内核对着合成三轴 fixture 跑 hermetic 就能建成、不必等真回放。把里程碑之间的**数据契约接缝**先钉死（schema + 一份合成 fixture），上下游就能各自对 fixture 并行开发，在冻死的接缝处会合。运行时 A 吃 B 的产物 ≠ 开发上 A 必须等 B 完工。

## 接缝清单（钉死才解锁并行）

| 接缝 | 连接 | 现状 |
|---|---|---|
| StepAxes 三轴 | 回放 → 裁定 | 已冻（P2） |
| verdict.json | 裁定 → 报告/自愈 | 已冻（P2） |
| compile-gate flow.json | 意图编译 | 已冻（P2） |
| events.json | 编译 → 回放 | 草拟，**待冻** |
| observed-reality | 编译 → 草拟/取证 | 草拟，**待冻** |
| prd.schema v2 | 冻结/人签（verdict 枚举 + signedAt/signedAgainstBuild/signerId） | 待扩 |
| report-model.json | verdict⋈axes⋈observed → 报告 | 草拟，**待对账定** |
| drift 补丁 | 自愈 → 重跑 | 草拟，**待冻** |

## 里程碑现状（关键纠正）

- P3（recorder + authoring）：**已降级出关键路径**（plan.md:82，「陌生站点孵化」支线）。MVP 编译走已建好的 compile-gate（NL→atomId→flow.json）。需真站、route:human。不阻塞任何人。
- P5（回放+取证+裁定+漂移探针）：**已半成**。verdict.mjs / deriveActionPerformed / checkErrorEnvelope 已 done（P2）。剩：回放 runner（移植 autotester `_data_runner`/`robust-actions`）+ watchPageLifecycle（移植 `replay-guards`）+ watchNetworkForensics（**全新建**）+ StepAxes 产出 + 只读漂移探针（**全新建**）。
- P4（断言草拟+冻结+人签）：冻结机制（check.mjs 词表、gate、testChecksums）大体在；剩草拟器（LLM、质量 route:human）+ 人签 CLI + prd v2。
- P7（报告）：**现在就能建** —— verdict.json 已冻，对合成 verdict.json + report-model fixture 跑 hermetic。
- P6（自愈）：对合成 HARNESS_ERROR verdict + drift fixture 跑 hermetic。
- P8（多 channel）/P9（两层 selftest）：tier-1 hermetic 早可验；tier-2 + cef + 真机 route:human。

## 三层排期

### 第 0 层（已完成）
P0/P1/P2 + 本会话 review 收口；C1-C4 覆盖契约（已 init、挂起，作第 2 层一条小轨）。

### 第 1 层 —— 接缝冻结（短、串行、总钥匙）
一个聚焦契约，把上表「待冻」的接缝定 schema + 冻一份合成 fixture：events.json、observed-reality、prd.schema v2、report-model.json、drift 补丁。产物：冻结 schema + 合成 fixtures。**这一层一完成，第 2 层全并行解锁。**

### 第 2 层 —— 并行 hermetic 建造（各自契约 + git worktree 隔离，对冻结 fixture 跑）
- 轨 A · P5 回放内核：移植 runner/robust-actions/lifecycle + 新建 watchNetworkForensics + StepAxes 产出 + 漂移探针。对合成 events → 出三轴 → 喂已 done 的 verdict。
- 轨 B · P7 报告：HTML/Markdown/json 渲染 + 多态徽章 + 缺陷单，对合成 verdict.json + report-model fixture。
- 轨 C · P4 冻结机制：草拟器 + 人签 CLI + prd v2，对合成 observed-reality。
- 轨 D · P6 自愈：准入门 + 非就地 drift 补丁，对合成 HARNESS_ERROR verdict。
- 轨 E · P3 recorder：重活、route:human、真站；支线、不阻塞。
- 轨 F · C1-C4 覆盖 golden（已 init 的小契约）。
各轨绿一条 hermetic golden 后串行合并。

### 第 3 层 —— 集成（串行、真数据替合成、端到端）
compile-gate 真产物 → P5 真回放 → verdict → P7 报告，首条 web 用例端到端（MVP 第一份真报告）；再 P8 多 channel（web 稳 → cef CDP）；P9 tier-2 + 真机 UAT（route:human）= 完成（gate 绿 ≠ 完成）。

## 并行结论（纠正研究 agent 的字面依赖判断）
- P3 ∥ P5 ∥ P4 ∥ P6 ∥ P7：**全部可并行**（各自的输入接缝已冻或可冻合成 fixture）。
- 唯二真串行：第 1 层接缝冻结（总钥匙，必先）→ 第 3 层集成（真数据替合成，必后）。
- P3 不在关键路径，别让它卡任何东西。

## 执行模型（subagent 并行）
- 第 1 层：聚焦一次（接缝相互咬合，需一致性；可并行起草各 schema、我合成冻结）。
- 第 2 层：Workflow + worktree 隔离子代理，一轨一契约一分支，对冻结 fixture 各建 hermetic 绿，再串行合并。
- 第 3 层：串行集成 + route:human 真机。

## 待办挂账
- push：`dev` 待你确认 GitHub 目标仓后推（自动模式分类器拦了我推断的目标）。
- C1-C4：第 2 层轨 F。
