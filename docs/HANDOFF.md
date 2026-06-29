# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。

## loop 已绿（2026-06-29，S1/S2/S3 done）

阶段3 loop 跑完：`gate --prd loop/prd-p2-intent-compile.json` = **GREEN 3/3**，契约 loop 阶段已 advance done（grill/plan/accept/loop 全 done，剩 review/learn）。tier-1 selftest 全绿、无回归。

实现产物（live）：
- **S1 裁判内核**：`bin/verdict.mjs`（§4.2 判定树、零 LLM、按断言种类不可知、断言续跑）、`lib/forensics.mjs`（`checkErrorEnvelope` 信封成功字段参数化）、`bin/check.mjs`（断言词表/op 硬闸，`--validate-only`）。
- **S2 编译门**：`lib/compile-gate.mjs`（移植 regress `_flow-authoring` 双闸 + 前缀从 `uniquePrefix` 注入，导出 `validateDraft`）。
- **S3 对账**：design §2.1 加 `noErrorToast` kind + 信封参数化；bootstrap plan 记 P3 recorder 降级「陌生站点孵化」支线。

配套设计落档：`docs/design/report-spec.md`（最终报告规格，反向约束 `verdict.json` 字段）；`docs/plans/p2-intent-compile/flywheel-schedule.md`（飞轮排期表：五维全加法、第二条移植 `chiefcomplaint_smoke`）；交互 demo 在 `M:\home\liufei\casey-report-demo.html`。

异构评审（Claude 侧，2026-06-29）已跑：5 镜头对抗评审 + 逐条核验，26 发现 / 18 确认。3 条 major（生命周期取证未按本步归因、缺失 action 误判 PASS、编译门空 prefix fail-open）+ 一串防御性 minor——全是 fail-safe 反向不变量缺口、当时 latent，已**不动冻结 golden** 修掉（`verdict.mjs`/`forensics.mjs`/`compile-gate.mjs` 收口，gate 仍 GREEN 3/3）。延后项（不静默丢）：冻结 golden 的边界覆盖（`atom` 卷回断言、空 prefix case）需走 acceptance-gate 补冻；design §6 命名 + `passes` 归属、§4.2/§9.1 加 `attributedStepId` 留 design 对账；真异构（Codex 非同族）那刀待发 bundle。

下一步：① 真异构（Codex）评审（输入只给 spec+diff+证据）；② tier-2 真机（route:human，护栏 #16 gate 绿≠完成，需先建 P3/P5 回放管线）：`catalog_wf_crud` 真绿全 PASS + 注 HTTP500 出 `SUT_DEFECT`；③ P7 报告渲染器（拆分+多态+MD，按 `report-spec`，需起独立契约）。

## 现状追加（2026-06-29，开 loop 前讨论）

接 `2026-06-26` 那次，本次没开 loop、只做开 loop 前的设计细化讨论 + 落档：

- **岔一锁定**：轴通用 = 一条实现纪律——`verdict.mjs` 按种类不可知、断言种类只在 `check.mjs` 枚举，新维度纯加法。流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。
- **质量接口锁定**：「内容好不好」独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`。已落 design §4.4。
- **岔二、岔三倾向待拍**：先榨干 `catalog` 注入再移植对话流；辐条第二条起默认轻车道、碰内核升 `full`。全文见 `docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。
- 文档动作：`CONTEXT.md` 登记 `chat`、design §4.4 补质量接口一句，均 `term-lint` 绿；未碰 `lib`/`bin`、未碰冻结测试。
- **推荐**：开 loop 前把岔一写成护栏第十七条（机制盯纪律），待拍。

## 现状（2026-06-26，本次会话）

**P2 已重定义并走完 grill → plan → accept（full lane，新 slug `p2-intent-compile`，旧 `p2-testcase` 作废被取代）**，停在 **loop 前**（用户要求先把记录落档再开实现）。本次做了：6 路并行深读 `regress_autotest` 原子流系统、把 ADR-0006 的 14 风险落到代码层核验并修正、锁定一组承重决策、冻结一套红 golden 与 prd。

### 已落地（P0/P1，live，不变）

| 模块 | 文件 | 验证 |
|---|---|---|
| loop-kit 引擎 | `loop-kit/bin/*`（与 autotester 字节一致，ADR-0001） | 9 脚本逐一 diff 无偏差 |
| 护栏 | `loop/GUARDRAILS.md`（12 迁移 + 13–16 新增） | term-lint exit 0 |
| 统一语言 | `CONTEXT.md`（两限界上下文） | `term-lint --registry` exit 0 |
| 决策档案 | `docs/adr/0001–0006` | 0006 = 融合决策 + 本次风险修正 |
| 自检 | `casey selftest --tier1` | 全链路 GREEN |

### 本次产物（p2-intent-compile）

| 产物 | 文件 | 状态 |
|---|---|---|
| grill 决策记录 | `docs/plans/p2-intent-compile/grill.md` | 契约 grill 交付物 |
| 落地计划 | `docs/plans/p2-intent-compile/plan.md` | 三 story + 验收点，term-lint 绿 |
| 冻结契约 | `loop/prd-p2-intent-compile.json` | 三 story、7 文件 sha256 冻结、gate --dry 绿 |
| 红 golden | `tests/_golden/p2-*.golden.mjs`（5 个）+ `fixtures/p2/*.json`（2 个） | 全红（实现/对账缺失），已冻 |
| 词表 | `CONTEXT.md`：新增 `三轴`；更新 `错误信封`（信封成功字段按 channel 参数化） | term-lint 绿 |
| 契约阶段 | grill / plan / accept 全 done（`loop/active-contract.json`） | edit-impl 已解锁 |

## 锁定的决策（全文见 `docs/plans/p2-intent-compile/grill.md`）

- 顶层三岔：spike 底座 = regress `@playwright/test`(TS) 原地验概念（端态 A/B/C 待证据）；前缀 = 参数化从 `TestCase.uniquePrefix` 注入；裁定面 = 含合成故障（注入 HTTP500 打通 SUT_DEFECT）。
- 三轴改造落点 = 锐化版路二：不改 regress 共享原子，把 5 个原子行为在 autotester L1 原语（`robust-actions`/`replay-guards`）上重表达成纯 mjs、吐三轴的函数；spike spec 是薄 TS 壳调 Casey 纯 mjs runner。证据：autotester lib 零 `@playwright/test` 依赖、可 golden、三轴原生拆开。
- 三轴 `StepAxes` schema（spike 草案、可改）+ 三子决定：A 四态分类只在 `verdict.mjs`（护栏 #15）；B soft 断言不进裁定树；C 取证按活动步归因、信封成功字段按 channel 参数化。

## 冻结的接口契约（被 golden 钉死，loop 须实现到位）

- `bin/verdict.mjs --axes <in> --out <out>`：读 `{caseId,steps:[StepAxes]}`，跑 §4.2 出 `{steps:[{stepId,intentId,atom,verdict,reason}]}`，零 LLM。
- `lib/forensics.mjs` 导出 `checkErrorEnvelope(body,{successField,successValue})→{field,expected,actual,ok}`。
- `bin/check.mjs --kind --op [--value] --validate-only`：词表/op 合法 exit 0、越界 exit≠0。
- `lib/compile-gate.mjs` 导出 `validateDraft(draft,{prefix,registry})→{ok,problems}`（复制并参数化 regress `_flow-authoring` 双闸）。

## 下一步（新会话）

1. 阶段3 loop（S1 优先，一个 story 绿了再下一个）：loop 开始先 `breaker --reset`。
   - S1：建 `bin/verdict.mjs` + `lib/forensics.mjs` + `bin/check.mjs`。
   - S2：建 `lib/compile-gate.mjs`（搬 `atoms.registry` 数据、前缀参数化）。
   - S3：改 `design §2.1`（noErrorToast + 参数化信封 + 断言续跑）、`bootstrap plan`（P3 recorder 降级为陌生站点孵化支线）。
   - 每轮 `gate --prd loop/prd-p2-intent-compile.json` 直到 3/3 绿。
2. tier-2 真机（route:human）：`catalog_wf_crud` 真绿全 PASS + 注入 HTTP500 出 SUT_DEFECT；gate 绿 ≠ 完成（护栏 #16）。
3. 阶段4 异构评审（输入只给 spec+diff+证据）→ 阶段5 沉淀。

## 后续方向：数据飞轮（按维度扩条）

第一条真绿后按维度扩 flow（chat → 发布 → 画布最后），骑 regress 现成语料；排期、复利项、与纪律的加法式关系见 `docs/FLYWHEEL.md`。现在不动手，但 S1 抽象按「喂多种形状」设计。

## 待裁决（route:human）

- 端态运行时 A/B/C 拍板：待 spike 证据，ADR-0006 推翻条件保持开放。
- 其余（两镜像一致、LLM 编译保真、对账自洽、真机两态）见 `loop/prd-p2-intent-compile.json` 的 observability。

## 运维

- `loop/active-contract.json` = `p2-intent-compile`（lane full），grill/plan/accept done，loop pending。
- 旧 `p2-testcase` 契约已被取代作废（其 grill 在本次重定义里被吸收）。
- 本次全程过 `term-lint`；逮到两处 Windows ESM 坑（动态 import 绝对路径要 `file://` URL）已修，保证 golden 实现后能转绿。
