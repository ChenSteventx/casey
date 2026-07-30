# Shared action authority 设计

日期：2026-07-27  
状态：验收冻结候选；生产实现尚未开始

## 1. 目的

raw replay 的 `resolve → perform` 不能靠测试 double。现役 `lib/replay-actions.mjs` 已有
`count===1` 点击身份门，但 resolver/actor 是私有连写；另写一份 raw count gate 会让两条执行
路径漂移。

本轮抽出：

```text
lib/replay/action-authority.mjs
lib/teachin/raw-playwright-driver.mjs
```

现役 `replay-actions.mjs` 的 generic click/dblclick/fill/press 路径与 raw driver 必须静态
导入并实际调用同一个 authority gate。不能用未被 exported（导出）入口调用的 dead
construction（死构造）满足门禁：`dispatchReplayAction` 的 generic call graph（通用调用链）
必须可达 shared gate 的 `resolve` 与 `perform`；raw exported canonical driver 的
`resolve/perform` 必须分别可达同一 factory 产物。special atom 继续走现役专用 domain gate，
不在此轮强行泛化。

## 2. API 与责任

```js
createActionAuthorityGate({
  resolveCandidate,
  revalidateCandidate,
  performCandidate,
  probeDrift,
  admitOrigin,
})
// -> {
//   resolve({event,topologyAuthority,executionTargetAuthority}),
//   perform({actionAuthority,topologyAuthority,executionTargetAuthority}),
// }
```

factory 只供 production wiring 与 zero-SUT doubles。production raw driver 静态绑定 Playwright
candidate resolver、现役 execution-target origin admission 与 page-topology active owner；
CLI/orchestrator 不接 factory/provider。`raw-playwright-driver.mjs` 必须导出冻结的
`canonicalRawPlaywrightDriver`，且只有 exact `readActivePath/resolve/perform` 三个方法；
runner 使用的就是这条 canonical path（规范路径），不是另一个测试 double。

formal generic path 从 `ctx.pageTopology` 取得 active page authority，并把同次
`ctx.executionTargetAuthority`/`ctx.admitReplayActionOrigin` 绑定进 gate；raw canonical path
从调用对象的 genuine `topologyAuthority/executionTargetAuthority` 取得同样事实。两条路径都必须：

- 用 `activePageAuthority()` 取得当刻 owner token；
- 只在该 token 对应的 active page 中解析 physical `ElementHandle`；
- 在动作前再次读取 active owner，并以 `ElementHandle.ownerFrame().page()`（或等价的
  Playwright owner 事实）核对 candidate owner；
- raw origin 通过现役 execution-target verifier，formal origin 通过现役
  `admitReplayActionOrigin`；caller boolean 不能代替 provider 结果。

`resolve`：

- 立即复制 closed raw event；
- 零候选返回 exact `none + candidateCount:0 + driftProbe`，不铸 authority；
- 多候选返回 exact `ambiguous + candidateCount:n`，不铸 authority；
- 恰一候选须同时返回物理 `candidate` 与当刻 `pageAuthority`；gate 才铸 opaque one-shot
  `actionAuthority`，私下绑定 ElementHandle、page authority、event、
  active page、topology 与 execution target；
- resolver throw/malformed 固定 `action_failed`，不把异常原文外露。

`perform`：

- plain/clone/foreign/replayed authority 在任何页面动作前拒；
- exact topology/target identity 不符拒；
- `revalidateCandidate` 必须返回 exact
  `{connected:true,sameNode:true,candidateCount:1,ownerMatches:true}`；unknown key、布尔简写、
  `null`/array、任一缺键、truthy/type coercion（真值/类型强转）、active page 换代、
  page owner 错配、节点脱离/替换或候选数变化均拒；
- origin、active page owner、ElementHandle connected/同一性/唯一性在动作窗口前重验；
- 重验失败固定 `action_failed`，真实动作调用数为零；
- authority 在尝试动作前原子消费，动作失败也不能重试到成功；
- 成功只在真实 click/dblclick/fill/press 完成后返回
  `{resolution:'unique',candidateCount:1,identityReadback:{ok:true}}`。

所有拒绝/失败均不得返回 `unique`。raw `nav` 仍只作 path checkpoint，`newpage` 仍走
page-topology controller，不进入本 action gate。

## 3. 验收

`teachin-replayability-action-authority.zero-sut.golden.mjs` 必须覆盖：

1. none/ambiguous 零 perform；
2. unique 只铸 opaque authority，plain/clone/foreign/replay 拒；
3. topology/target 换绑拒；
4. origin、active page 真换代、page owner provider 错配、connected/sameNode/唯一性 TOCTOU
   或 `null`/array/缺键/type pollution/unknown-key structured revalidation 失败时物理动作
   spy 为零；
5. genuine authority 真实 perform 恰一次，成功/失败都不可重试；
6. 并发重放同一 authority 也只能有一次真实 perform；
7. resolver throw 及 non-object、缺 candidate/page、count 类型污染/unknown-key malformed
   只出稳定轴；perform throw 不泄异常；
8. 纯内存 Playwright doubles 从 exported `dispatchReplayAction` 与
   `canonicalRawPlaywrightDriver` 各跑一条真实正控；active owner 换代、owner provider
   错配、origin reject 均为零物理动作；
9. 静态门从上述 exported roots 走 named call graph，必须可达 factory 产物的
   `resolve/perform`；仅 import、仅构造或不可达 helper 均不算接线完成。
