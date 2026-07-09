# Casey 排期 v2 —— 接缝优先、并行解锁（取代 bootstrap plan 的线性「总体顺序」）

> 2026-06-29 重排。bootstrap plan 的 `P3→P4→P5→P6→P7` 线性顺序已不合理：它把「运行时数据依赖」误当「开发顺序依赖」。本文用接缝优先重排，里程碑细节仍以 `bootstrap/plan.md` 各节为准。
>
> 2026-06-30 续：第 1 层接缝已全冻、第 2 层除 P5 外全绿合并，v2 的里程碑级并行红利已兑现完。剩余工作（P5 收尾 + review 接缝增冻 + 集成 + 飞轮）按「单活契约 baton 是真天花板」重排，见文末「排期 v3」——那是现行排期；本节 v2 保留为历史脉络。

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

---

# 排期 v3 —— P5 收尾期重排（2026-06-30）

> 接 review 收口（三份外部借鉴备忘录）+ 单活契约 baton 现实。上文 v2 的并行红利已兑现完，本节为现行排期。

## 一、现状（2026-06-30 实地核查）

- 第 0 层 P0/P1/P2 ✓；第 1 层接缝冻结 ✓（6 接缝 + `prd.schema` v2，`prd-seams-freeze` passes:true）。
- 第 2 层：轨 B·P7、轨 D·P6、轨 C·P4、轨 F·track-F 已合并 `dev` 亲验绿；轨 E·P3 降级 route:human。**P5 是唯一剩的第 2 层轨**：红基线算冻于工作树但未提交、accept 未签发，`bin/replay.mjs` 未写。
- 第 3 层集成未开始。
- review 收口已落 additive doc-fix（三份备忘录）；新接缝提案见 `docs/plans/seams-freeze-v2/proposed/`（草稿，待 grill）。

## 二、真天花板：单活契约 baton

loop-kit 是单活契约（hook 读主树共享 `loop/active-contract.json` 一个槽），`LOOP_CONTRACT_FILE` 参数化 + `breaker --state` 未建。结论：多个 `full` 契约真并行落地 = 现在不支持。第 2 层四轨实为「各自 worktree 起草 + 串行合并 `dev`」，非同时落地。决策（2026-06-30）：不投基建，把并行用在不碰 baton 的 fan-out。

## 三、并行设计硬规则

- 可无限 fan-out（不碰 `active-contract` 槽、不写 `lib`/`bin`）：研究 / grill 起草 / schema 起草 / golden 起草 / 异构评审 —— 多用子代理。
- 碰 `lib`/`bin` 的落地：单活 `full` 契约串行；要并行须 worktree 隔离 + git-native 合并（`merge`/`apply`），绝不 `cp` 进 `lib`/`bin`。
- P5 内部：一契约 + 7 叶子子代理起草 + 主脑串行集成（见 `p5-replay/exec-plan.md`）。
- 解锁真多轨落地的前提（~~暂不投：`LOOP_CONTRACT_FILE` 参数化 + `breaker --state`~~）：**已于 2026-07-09 由 `worktree-baton` 契约解决，但走的不是这条路**。实测发现每棵 git worktree 的 `loop/active-contract.json` 与 `.breaker-state.json` 都 gitignored、每树一份、互不共享——单槽机制在每棵 worktree 里本就各跑各的，故「N 路并行 = N 棵 worktree」零机制改动即成立。`LOOP_CONTRACT_FILE`/`breaker --state` 那套共享池反而是「多 session 挤同一 checkout」的解、背离 worktree 且经设计红队判 1 High + 4 Med，遂否决。`worktree-baton` 只加 `contract list`（跨树 baton 总览）+ `contract worktree`（起树脚手架）+ 并行纪律（GUARDRAILS #18），操作手册见 `docs/plans/worktree-baton/WORKTREE-PARALLEL.md`。

## 四、剩余工作重排

**关键路径（串行 baton + 内部 fan-out）：**
- 还原 `p5-replay` 契约 → 人审 accept 4 承诺 → 签冻 → P5 Phase 2（`robust-actions` 三轴埋点前置 → runner → StepAxes → 喂 verdict → 10 golden 绿；7 叶子模块子代理起草，命门 `watchNetworkForensics` 慎做）。不起第二 `full` 契约。

**并行预备轨（现在就能多用子代理，零 baton，与 P5 互不阻塞）：**
- 轨 P · 借鉴接缝 v2 增冻【预备】：起草 review 5 新接缝的 grill + schema + 合成 fixture。先行 `run-history.jsonl`/`run-metrics.json`、动作词汇表、failure ledger；后置 视觉模板合同、`channelDriver`（随 canvas / arbitrary 维度）。只起草不冻，待走 grill-with-docs 拍板 → 一个聚焦 seams-freeze v2 串行冻（Layer-1 式总钥匙 v2）。
- 轨 Q · 异构评审 / 研究：持续 fan-out。

**串行小活（碰 `bin`/`lib`，需契约，与 P5 排队或 P5 内顺手带）—— review 挖出的真缺口：**
- P7 凭据兜底门（护栏 #7）补 coverage golden：`bin/report.mjs` 的 `credentialGate` 目前零 golden 覆盖（对现有实现为绿，属 coverage-add）。
- P6 `superseded` 状态迁移补 coverage golden：`lib/drift-patch.mjs` 已实现该边但无测试覆盖。

**第 3 层集成（串行，必后）：** compile-gate 真产物 → P5 真回放 → verdict → P7 报告（首条 web 端到端）→ P8 多 channel（web 稳 → cef CDP）→ P9 tier-2 真机 UAT（route:human）= 完成（gate 绿 ≠ 完成）。

**飞轮（P5 绿 + catalog 首条真四态后启动）：** `catalog` → `chat` → 发布 → 画布；第二条起 light 车道。review 新接缝按维度对齐：动作词汇表↔多端动作、视觉模板合同↔画布、`channelDriver`↔arbitrary。

## 五、待办挂账（v3 更新）

- review 新接缝草稿待 grill-with-docs 拍板再冻（造词先登记 `CONTEXT.md`，ADR-0005）；草稿在 `docs/plans/seams-freeze-v2/proposed/`。
- loop 纪律 hook 引用的 `docs/decisions/2026-06-12-loop-kit.md` 不存在，真出处是 `docs/adr/0001-reuse-loop-kit.md`（2026-06-25）——待修这处坏引用。
- 两个 hermetic coverage golden 草稿在 `docs/plans/p7-report/proposed/` 与 `docs/plans/p6-selfheal/proposed/`，待接入 light 车道 accept 冻结。
