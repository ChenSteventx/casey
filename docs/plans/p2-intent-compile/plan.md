# 落地计划：P2 重定义（slug: p2-intent-compile，lane full）

> 配套：`grill.md`（本目录，决策记录）、`docs/adr/0006-fuse-autotester-regress.md`、`docs/design/txt2testreport-design.md`、总计划 `docs/plans/bootstrap/plan.md`。
> 重业务轻技术：每 story 给 流程 + 逻辑 + 验收点。可命令化的验收点 → 进 `loop/prd-p2-intent-compile.json` story；不可命令化的 → Observability `route:human`。
> 节奏沿用全流水线：grill（已收尾）→ plan（本文件）→ acceptance-gate（红测试 + 冻结）→ loop → 异构评审 → 沉淀。

## 范围与非目标

范围：
- ③ `catalog_wf_crud` 贯通 spike —— 第一刀、MVP 核心：从 regress 冻结 flow 起跑，验「回放 → 三轴 → 多态裁定 → 四态报告」，并以合成故障打通 SUT_DEFECT。
- ① 意图到 atomId 编译门 —— 复用 regress `_flow-authoring.mjs` 双闸 + 前缀参数化；本期只证「复用可行 + 前缀解耦」，不含归一前段。
- ② plan/design/ADR 对账 + 断言词表扩登记。

非目标（本期明确不做）：
- 端态运行时 A/B/C 拍板 —— 待 spike 证据，ADR-0006 推翻条件保持开放。
- 归一前段 L1（杂乱文本 → 平台无关意图）—— 单列后续 story，不进第一刀。
- P3 recorder-as-library —— 降级为「陌生站点孵化原子候选」支线，移出 MVP 关键路径（见 S3 对账）。
- 多 channel（cef/arbitrary）、并发回放 —— MVP 串行、Heren-only。

## Story S1：catalog_wf_crud 贯通 spike（MVP 第一刀）

流程（引 grill.md 任务清单 T1–T6，T0 底座已定 = TS 原地）：
1. T1 扩断言词表并登记 `CONTEXT.md`/design §2.1：新增 `noErrorToast`（DOM 错误弹窗缺席，取证类）；`countChange` 支持绝对归 0；登记 `urlPathname` 的 contains 到 matches/startsWith 映射。
2. T2 建 `watchNetworkForensics`（纯 mjs，架在 autotester L1 上）：`page.on('response')`/`'requestfailed'` 按活动步归因记 `{url,status,ts,initiator}` + error-envelope（成功字段按 channel 参数化，Heren `status===200`）；登录令牌只记状态不记 token 值（凭据红线）。
3. T3 把 `catalog_wf_crud` 用到的 5 原子（login/create/save/deleteByName/onPage 加 noErrorToast）在 autotester L1 原语上重表达成纯 mjs、吐 `StepAxes` 三轴的函数（锐化版路二）；`create` 收紧确认按钮 locator 消多匹配。
4. T4 建 flow→verdict 桥：把 `StepAxes[]` 逐步卷回意图、跑 design §4.2 判定树、出 `verdict.json`。
5. T5 跑通 回放 → `verdict.mjs` → 四态报告（多态徽章 + 期望对实际 + 取证引用）。
6. T6 注入合成故障：mock `saveOrModifyProcessData` 返 HTTP500 或 `status!=200`，断 save 步出有取证背书的 SUT_DEFECT。

逻辑/兜底：裁判零 LLM（`verdict.mjs` 纯确定性）；`actionPerformed` 的四态分类只在 `verdict.mjs`（护栏 #15）；soft 断言记录不进裁定树（防假绿）；取证按活动步归因非时间窗；指不到/点空响亮报红绝不静默假绿。

验收点：
- [命令] `verdict.mjs` 喂合成三轴四元组：四态各一 golden —— 全断言过且动作唯一 → `PASS`；动作唯一 + 断言失败 + 取证背书 5xx 归因本步 → `SUT_DEFECT`；同稳定签名唯一元素在仅 locator 漂移 → `HARNESS_ERROR`；其余证不出 → `NEEDS_HUMAN`（含 `AMBIGUOUS_ACTION`/`INDETERMINATE` 子类）。
- [命令] 点击身份门：合成 `resolution=fallback_first` 或 `coord_fallback` → `actionPerformed=ambiguous` → `NEEDS_HUMAN(AMBIGUOUS_ACTION)`，不记缺陷。
- [命令] `watchNetworkForensics`：喂合成 response 序列，按活动步归因正确、背景无关 401 不翻 verdict；error-envelope 成功字段参数化为 `status===200` 时 Heren 信封判定正确。
- [命令] flow→verdict 桥：合成 `StepAxes[]` → `verdict.json` 形状正确、四态正确、逐步卷回 `intentId`。
- [命令] 新 kind `noErrorToast`、`countChange` 绝对归 0 的 check 命令：合规过、越界/缺值报红。
- [🧑] tier-2 真机：`catalog_wf_crud` 真绿回放 → `verdict.json` 全 PASS（需 site.json + 登录态，route:human）。
- [🧑] tier-2 真机：对 save POST 注入 HTTP500 → save 步正确判 `SUT_DEFECT` 而非 `HARNESS_ERROR`（最关键真机验收，route:human）。

## Story S2：意图到 atomId 编译门（① 复用 + 前缀解耦）

流程：
1. Casey 侧 import 复用 regress `_flow-authoring.mjs` 的 `validateFlowStructural`（闸一）+ `checkFlowV2`（闸二状态机）+ `validateDraft`，以 `atoms.registry.json` 为数据；不重造状态机校验。
2. 前缀参数化：把硬闸里写死的 `ctxtest_` 改成从 `TestCase.uniquePrefix` 注入；同步改 `_flow-authoring.mjs` 与 `_flow-runner.ts` 两份镜像。

逻辑/兜底：编译门坐落在 LLM 选 atomId 之后、冻结之前，确定性零 LLM，挡 R8（选错原子，如把新增编成保存）；fail-closed。

验收点：
- [命令] `validateDraft` 复用：合规 flow 过；畸形（未知 atomId / 缺必填参数 / 类型错 / 状态机顺序错缺步）逐一报红，报文含「需要〈状态〉 + 谁能提供」。
- [命令] 前缀参数化：注入前缀（如 `atl_` 或配置值）的实体名过；裸名 / 错前缀报红；两份镜像（.mjs 与 .ts）行为一致。
- [🧑] 把一段平台无关意图喂编译门产 atom 序列，人核对映射正确（route:human）。

## Story S3：plan/design/ADR 对账 + 词表（②）

流程（文档与词表，无 lib/bin）：
1. 对账 `docs/plans/bootstrap/plan.md` 与 `docs/design/txt2testreport-design.md`：P3 recorder 移出 MVP 关键路径、降为陌生站点孵化支线；design §2.1 `noErrorEnvelope` 改参数化成功字段；§1 L3 编译路由由 events.json/spec.ts 改为 NL 到 atomId 到 flow.json。
2. 修订 `docs/adr/0003` 后果段与 recorder 关键路径冲突的表述（或加补记指向 ADR-0006 R14）。
3. 断言词表新增 kind 登记到 `CONTEXT.md`/design §2.1；补登「断言续跑」执行模型这条新约束。

验收点：
- [命令] `term-lint --registry` 与 `term-lint --file` 对改动文档全绿；新增 kind 的 check 命令越界报红。
- [🧑] 对账后 plan/design/ADR 自洽、无与 ADR-0006 冲突的遗留表述（route:human 审）。

## 风险与 route:human 汇总

- 最高风险：spike 在合成故障下把 `SUT_DEFECT` 误判 `HARNESS_ERROR` 被自愈抹平 —— hermetic golden（命令）+ tier-2 真机（route:human）双验，自愈本期不做、只验裁定。
- 双运行时雷（R2/R6）：spike 用 TS 薄壳 + 纯 mjs 三轴 runner 在最小面前置暴露；端态 A/B/C 待证据，不在本期拍板。
- 前缀参数化触两份镜像（R12）：验收点要求 .mjs 与 .ts 行为一致。
- Observability 申报（route:human）：真站 PASS 与注入故障 SUT_DEFECT 判定、LLM 编译映射保真。

## 立即下一步

1. 评审本计划验收点（尤其 S1 命令化项是否足以冻结）；
2. acceptance-gate：按验收点写红测试、跑验红基线、sha256 冻结，生成 `loop/prd-p2-intent-compile.json`；
3. loop 实现（先 S1 spike）。
