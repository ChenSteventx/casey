# ADR-0007：P5 回放运行时基座 + 取证归因

状态：已接受（2026-06-29，p5-replay 契约 grill 阶段拍板，取代 ADR-0006 留的端态运行时 A/B/C 待裁决）

## 背景

P5 是确定性回放 + 取证 + 三轴产出 + 只读漂移探针（★核心，design §3 相3-4、§4.2、§9.1）。两处难逆转决策需先于实现拍板：① 用什么驱动浏览器回放（ADR-0006 留的 A 采纳 @playwright/test / B 解耦纯 mjs / C 桥接）；② watchNetworkForensics 怎么把请求归因到步（背景轮询 401 不得翻 verdict 的命门，design 要求「按发起方归因、非时间窗」）。

裁判内核 verdict.mjs 已冻、零 LLM、对三轴粒度与归因机制不可知（只认 `attributedStepId===stepId` 才背书），所以这两处机制都藏在已冻的三轴/axes 接缝之后、可换不破契约。

## 决策

1. **回放基座采纳 @playwright/test（A）。** 回放生成 `.spec.ts` 跑在 playwright test runner 下，复用 autotester 全套 `robust-actions`/`_fixtures`/`watchPageLifecycle`/`waitForReplyByStream`/下拉语义单元（ADR-0001 复用红利）。回放把每 intent 的三轴写 `axes.json`，`verdict.mjs` 仍是独立 node 进程消费——裁判进程不被 test runner 污染、零 LLM 不变。耦合只锁在回放这一层；裁定/报告/契约层照旧 channel/runner 无关。

2. **取证按 CDP 真发起方归因 + 背景 denylist + 证不出归 null（fail-safe）。** watchNetworkForensics 经 CDP `Network` 域取每请求的真 `initiator`（type+栈，区分用户动作触发 vs 定时器轮询）：① url 命中 `site.json` 背景模式 denylist → `background`/`attributedStepId:null`；② initiator 为定时器/异步轮询源 → `background`/null；③ 正向因果系到当前步才归本步；④ 任何含糊 → null。verdict 只对 `attributedStepId===stepId` 背书，故 null 永不背书——证不出就不翻（护栏 #14）。

配套（同 grill 拍板，非本 ADR 主轴但记此）：三轴裁定单元 = intent（按 intentId 聚合 N 个 event）；hermetic 假 SUT = 移植 autotester `web/server.mjs` 的本地 fixture server（覆盖 XHR 5xx/401/信封 + SSE 流式 + pageerror）。

## 后果

- 正面：最大化复用、回放层不重蹈 autotester 已平的坑；裁判零 LLM 与 fail-safe 不变量在回放/取证层都站得住；归因忠于「非时间窗」、背景 401 进不了背书。
- 代价：回放层耦合 playwright test runner（接受，只锁此层）；CDP initiator 接入 + 栈分类比时间窗复杂（用 denylist + 证不出归 null 兜底，复杂度可控且偏 fail-safe）。
- 推翻条件：若 CDP initiator 在 Heren 实测下不可靠到无法正向归因，退化为「denylist + 活动步窗 + 仍证不出归 null」，但绝不退到「无 denylist 的纯时间窗」（那会让未知背景请求误背书）。

## 备选

- B 解耦纯 mjs：丢 robust-actions/fixtures 复用、重写已解决的坑，否决。
- 纯时间窗归因：design 明禁，未知背景请求会误把干净失败翻成 SUT_DEFECT（fail-open），否决。
- 纯 denylist 归因：漏一个背景模式就误背书，仅作 CDP 的兜底层、非主信号。
