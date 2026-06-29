# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。
> 下方「当前状态」是权威现状；「历史层」仅供溯源。

## 当前状态（2026-06-29）

P2（slug `p2-intent-compile`，full lane）的 loop **已绿并提交**。契约阶段：grill / plan / accept / loop 全 done，剩 review / learn。

- `gate --prd loop/prd-p2-intent-compile.json` = GREEN 3/3；`casey selftest --tier1` 全绿、无回归。
- 已提交：`dev` 分支 `594ecf4`（14 文件，含实现 + 文档 + 契约 prd 翻绿）。**未 push**（push 需 review done）。
- 异构评审 Claude 侧已跑并按 fail-safe 收口（见下节）。

## 实现产物（live）

| Story | 文件 | 要点 |
|---|---|---|
| S1 裁判内核 | `bin/verdict.mjs` | §4.2 判定树、零 LLM、按断言种类不可知、断言续跑、取证按本步归因、入参 fail-closed |
| | `lib/forensics.mjs` | `checkErrorEnvelope` 信封成功字段参数化；缺配置 fail-closed |
| | `bin/check.mjs` | 断言词表/op 硬闸，`--validate-only`；断言 kind 枚举唯一活在此处 |
| S2 编译门 | `lib/compile-gate.mjs` | 移植 regress `_flow-authoring` 双闸 + 前缀从 `uniquePrefix` 注入；空/缺 prefix 拒绝放行 |
| S3 对账 | design §2.1 / bootstrap plan | 加 `noErrorToast`、信封参数化、`countChange equals 0` 例外；P3 recorder 降级「陌生站点孵化」 |

配套设计落档：
- `docs/design/report-spec.md` —— 最终报告规格（拆分布局 + HTML/Markdown/json + 多态裁定，反向约束 `verdict.json` 字段）。
- `docs/plans/p2-intent-compile/flywheel-schedule.md` —— 飞轮排期表（五维全加法、第二条移植 `chiefcomplaint_smoke`、23 条 R9 坐标 flow 标 route:human）。
- 交互 demo（演示壳、合成数据，HTML + Markdown 双视图）：`M:\home\liufei\casey-report-demo.html`。

## 异构评审（Claude 侧，2026-06-29）

5 镜头对抗评审 + 逐条核验：26 发现 / 18 确认。3 条 major + 一串防御性 minor，全是 fail-safe 反向不变量缺口（当时 latent，P5 回放未建故未触发）。已**不动冻结测试**修掉，gate 仍 GREEN：

- 生命周期取证（crash / pageerror）改为按本步归因（原来全局信号会翻任意步的 verdict）。
- 缺失 action 轴不再误判成 actionPerformed=true（防畸形步假 PASS）。
- 无硬断言不静默 PASS、缺 stepId 不假命中、`verdict.mjs` 入参 fail-closed。
- 编译门空/缺 prefix 拒绝放行（原来 `startsWith('')` 恒真把破坏性硬闸静默清零）。
- 信封缺配置返回 ok:false、不默认放行。

延后项（不静默丢，留后续 acceptance-gate / design 对账）：
- 冻结 golden 边界覆盖缺口：`atom` 卷回未断言、空 prefix 无 case、CASE_DEFECT 分支无 case —— 改 golden 触 ratchet，须走契约更新补冻。
- design §6 把「带期望对实际」的 `verdict.json` 与 `verdict.mjs` 最小输出混名、`passes` 归属错挂；§4.2/§9.1 取证记录缺 `attributedStepId` —— 留 design 对账（`report-spec` §7 已记）。

## 锁定的决策（2026-06-29）

- **岔一**（已锁）：轴通用 = 实现纪律，不是预留字段。`verdict.mjs` 按断言种类不可知、kind 枚举只在 `check.mjs`，新维度纯加法；流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。已落护栏第十七条。
- **质量接口**（已锁）：「内容好不好」走独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。
- **岔二**（已采纳）：压裁判保守分支最便宜的办法是先在 catalog 上多注合成故障（漂移→HARNESS_ERROR、元素消失→AFFORDANCE_ABSENT、真数据多匹配→ambiguous），再移植第二条 `chiefcomplaint_smoke`。
- **岔三**（已采纳）：第一条走 `full`；之后辐条默认轻车道（跳 grill、保留 plan+accept+loop），碰冻结内核才升 `full`；`accept` 任何车道都不跳。
- 全文：`docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。

## 下一步

1. **真异构（Codex 非同族）评审**：输入只给 spec+diff+证据（护栏 #9）。注意 `omc ask` 未装、本机是零信任工作区往外发代码有合规考量；走 `codex review` 只读模式或人工跑。
2. **P7 报告渲染器**（拆分 + 多态 + Markdown，按 `report-spec`）：需起独立契约（grill/plan/accept→loop）；单活契约下要等 p2 review/learn 收口或显式切换。
3. **tier-2 真机**（route:human，护栏 #16 gate 绿≠完成）：`catalog_wf_crud` 真绿全 PASS + 注 HTTP500 出 `SUT_DEFECT`。**依赖尚未建的回放管线（P3 编译 + P5 回放）**——现在 Casey 只有 hermetic 裁判内核、没有真站回放路径，故 tier-2 暂不可达。

## 契约 / 运维

- `loop/active-contract.json` = `p2-intent-compile`（full lane）；grill/plan/accept/loop done，review/learn pending。
- 旧 `p2-testcase` 契约已被取代作废。
- 全程过 `term-lint`；本会话新登记词条：`三轴`/`chat`/`移植`/`CSS`/`trace`/`commit`/`push`/`PowerShell`。

## 历史层（溯源用，非现状）

- **P0/P1**（live，不变）：loop-kit 引擎（与 autotester 字节一致，ADR-0001）、护栏（12 迁移 + 13–17 新增）、`CONTEXT.md` 两限界上下文、ADR 0001–0006、`casey selftest --tier1`。
- **2026-06-26**：P2 重定义走完 grill→plan→accept，6 路深读 `regress_autotest`、ADR-0006 的 14 风险落代码核验、冻结 5 红 golden + 2 fixture + prd，停在 loop 前。详见 `docs/plans/p2-intent-compile/grill.md`。
- **2026-06-29**：开 loop 前的岔一/二/三 + 质量接口讨论 → 落档（FLYWHEEL/design/report-spec/flywheel-schedule）→ 实现 loop（S1/S2/S3 绿）→ 提交 `594ecf4` → Claude 侧异构评审 → 收口。
