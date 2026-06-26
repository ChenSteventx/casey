# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。

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
