# P2 重定义 grill 决策记录（slug: p2-intent-compile）

> 日期 2026-06-26。契约 lane=full，stage=grill。本文件是 grill 阶段交付物 + 下一会话决策快照。
> 配套：`docs/adr/0006-fuse-autotester-regress.md`（融合决策 + 14 风险）、深读情报图（`regress-intel.md`，本目录）。

## 框定：第一刀 spike = 后半截

spike 从 regress 已冻结的 `catalog_wf_crud.flow.json` 直接起跑，验「回放 → 三轴 → 多态裁定 → 四态报告」；不碰新编译门（归一 + 意图到 atomId）。P2 新编译门是另一条工作线（import 复用 regress `_flow-authoring.mjs` 双闸），不塞进第一刀。① 编译门与 ③ 裁定内核各证各的。

## 已锁决策

### 顶层三岔
1. 底座：spike 在 regress `@playwright/test`(TS) 原地验概念；端态运行时（A 采纳 @playwright/test / B 解耦到纯 mjs / C 桥接）待 spike 证据后再定——ADR-0006 的推翻条件保持开放。
2. 前缀（R12）：参数化——从 `TestCase.uniquePrefix` 注入，不写死；落地须同步改 `_flow-authoring.mjs` 与 `_flow-runner.ts` 两份镜像。
3. 裁定面（R5/R1）：含合成故障——`catalog_wf_crud` 真绿先出 PASS，再对 save 的 POST 注入 HTTP500 或 `status!=200`，出一份有取证背书的 SUT_DEFECT，证明多态命脉可达。

### 三轴改造落点（Q1）= 锐化版路二
不改 regress 共享原子（零回归）；把 `catalog_wf_crud` 用到的 5 个原子的**行为**在 autotester 的 L1 原语（`robust-actions.mjs`/`replay-guards.mjs`）上重表达成纯 mjs、吐三轴的函数。spike 的 spec 是一层薄 `@playwright/test` TS 壳，只给 page + 复用 regress `_fixtures` 登录态，再调 Casey 纯 mjs 三轴 runner。

证据：autotester lib 头注明「零 `@playwright/test` 依赖、只吃 page、throw 原生 Error、可被 node 直接 import 跑 golden」；动作轴（`resolveTarget`/`robustFill` 回读/`coordClick` 点空抛）、断言轴（`expect*` 守卫 = typed kind 库）、取证轴（`watchPageLifecycle`）在 autotester 原生拆开。ADR-0001 已立「拷快照、自有、独立演进」范式，路二同构。端态走 B 时这 5 个就是首批迁移件、非丢弃工。

### 三轴 schema（Q2，spike 草案，跑完可改、非冻结）
```
StepAxes {
  stepId, intentId, atom,
  action: { kind: click|fill|navigate|none, describe, resolution: unique|fallback_first|coord_fallback|none, identityReadback: {token,expected,actual,ok}|null },
  postAssertions: [ { kind, op, value, actual, ok, soft } ],
  forensics: { lifecycle: {pageerror[],crashed}, network: [ {url,status,ts,initiator,errorEnvelope:{field,expected,actual,ok}} ] }
}
```
- 子决定 A：`actionPerformed` 的 true/ambiguous/false 由 `verdict.mjs` 分类（原子只吐原始信号），护栏 #15「裁判零 LLM、分类只一处」。
- 子决定 B：`soft` 断言记录但**不进** §4.2 裁定树，只进报告（防假绿）。
- 子决定 C：取证按活动步归因（spike 串行）、非时间窗；error-envelope 成功字段按 channel 参数化（Heren = `status===200`，落 `site.json`）。

谁填：动作轴由 `robustClick`/`robustFill` 三轴包装层 + `describe-action.mjs`；断言轴由 `postAssert(kind,op,value,actualFn)` 逐条记、续跑不抛；取证轴由 flow 级 `watchNetworkForensics` + `watchPageLifecycle`。`verdict.mjs` 读 `StepAxes[]` 跑 §4.2 出四态写 `verdict.json`。

## 术语动作（本轮）
- 登记 `CONTEXT.md` 核心域：`三轴`（Three-Axis）。
- 更新 `错误信封`：成功字段按 channel 参数化（Heren `status===200`），不写死 `code`。

## 仍开放（非阻塞，留待 spike 发现或后续）
- flow→verdict 桥逐步卷回意图的细节：spike 实现期定。
- `workflow.create` 确认按钮 `.last()` 多匹配→点击身份门会判 ambiguous；要 PASS 须先收紧 locator（T3 实现期）。
- 断言词表新增 kind（`noErrorToast`、`countChange` 支持绝对归 0、`urlPathname` 的 contains→matches 映射）落 design §2.1（② 对账期）。
- 测试预言四分法（隐式/规格/派生/人类）及上一轮生造词的登记或入黑名单——非 spike 必需，继续 deferred。

## 对账要点（②，待 to-plan / 实现期落）
- P3 recorder 移出 MVP 关键路径，降为「陌生站点孵化新原子」支线（修订 ADR-0003 后果段与之冲突的表述）。
- design §2.1 `noErrorEnvelope` 改参数化成功字段；§1 L3 编译路由由 events.json/spec.ts 改为 NL→atomId→flow.json；补登「断言续跑」执行模型这条新约束。
