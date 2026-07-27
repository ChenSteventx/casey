# page-topology-auth-continuity 实施计划

## 1. 目标

在同一 BrowserContext 内建立确定性 page topology：context 级监听与注入、opaque page/opener 身份、唯一 active page authority、click 后 0/1/>1 新页 handoff、popup close 回 opener、每页取证、同 origin session seed 和 cross-origin 硬停。人工 record、source replay、distill projection、distilled replay 必须保留并消费既有 `newpage` 事件。

决策细节见 `docs/plans/page-topology-auth-continuity/GRILL.md`。

## 2. 非目标

- 不修 logical target/transport；由 `cross-platform-execution-target` 契约负责。
- 不实现跨 origin SSO。
- 不改正式 `events.schema`：它已声明 `newpage` 且要求 `url`。
- 不在本门禁跑 browser/SUT/网络，不读真实配置或凭据。
- 不把 adapter double 的绿等同实机绿。

## 3. 冻结 API

### 3.1 Session seed

`lib/page-topology/session-seed.mjs` 导出：

```js
createSessionSeedAuthority({ origin, entries })
```

成功返回 `{ok:true, authority, receipt}`。receipt 键集只含：

```js
{
  schemaVersion: 1,
  originPolicy: "same-origin-only",
  valuePersistence: "memory-only"
}
```

origin、key、value、entryCount 均不公开。非法 origin/entries 返回稳定 reason；clone/forge authority 不可用。

### 3.2 Controller

`lib/page-topology/controller.mjs` 导出：

```js
await createPageTopologyController({
  context,
  initialPage,
  sessionSeedAuthority,
  attachForensics,
  idFactory
})
```

返回 `{ok:true, controller, activePageAuthority, receipt}`。controller 至少提供：

```js
controller.activePageAuthority()
controller.performClick({ pageAuthority, perform })
controller.evaluateActive({ pageAuthority, evaluate })
controller.consumeNewPageEvent({ pageAuthority, event })
```

公开 receipt/handoff 可以含 opaque pageId/openerPageId、分类和安全 path，但不得含 page 对象、origin、host、session key/value。

`performClick`：

- 先校 pageAuthority；
- `perform(page)` 恰执行一次；
- 等待本动作产生的 context page 注册队列收敛；
- 新页数 0 保持，1 校验后切换，大于 1 拒；
- cross-origin、opener 错、page 已关均不切换；
- 返回的 `newpage` capture event 只有 `action/path`，不持久化 pageId。

popup close 由 controller 监听并回 opener；active authority 的 clone 仍无权。

### 3.3 Topology event

`lib/page-topology/topology-events.mjs` 导出：

```js
normalizeTopologySequence({ events, format: "capture" | "formal" })
assertTopologyParity({ sourceEvents, distilledEvents })
```

规则：

- capture 用 `path`，formal 用 `url`；
- 只接受 path+query，不接受 host/scheme/fragment；
- `newpage` 必须紧随能产生新页的 click/dblclick，归属前一业务 intent；
- orphan、重复 handoff、顺序丢失、source/distilled 数量或 path 不同均具名拒；
- topology projection 不含 session seed 或页面 DOM。

### 3.4 Record/replay bridges

`record-bridge.mjs` 在第一个 page 前安装：

- `context.exposeBinding`
- `context.addInitScript`
- `context.on("page")`
- controller/forensics/session seed

`replay-bridge.mjs` 导出：

```js
consumeNewPageAction({ controller, event, pageAuthority })
consumeTopologySequence({ controller, events, format })
```

后者让 source capture 与 distilled formal events 走同一 normalization/消费路径。`dispatchReplayAction` 对 `newpage` 必须在 locator 解析前委派，不能触碰传入的旧 page。

## 4. 实施切片

### S1 Session seed + page registry

1. 新建 session seed authority，值仅 WeakMap/模块私有状态。
2. 新建 controller；先装 context listener，再注册 initial page。
3. 所有页安装 same-origin guarded init script与取证。
4. pageId 来自 `idFactory`，禁止由 URL/title/DOM 生成。

### S2 Active page state machine

1. active authority 校验统一入口。
2. click 新页 generation 计数 0/1/>1。
3. opener 连续性、cross-origin 和 close 回退。
4. 旧 page assertion callback 零调用。

### S3 Record/source replay

1. `bin/record.mjs` 改 context 级 binding/init/listener，移除只挂初始 page 的路径。
2. `record-capture.mjs` 把 `newpage` 纳入允许动作，保留安全 path。
3. source replay 用 replay bridge 消费 capture topology sequence。
4. 正式 `newpage` 只确认/消费 prior-click pending handoff，不额外打开重复页面。

### S4 Distill/distilled replay

1. `record-distill.mjs` 将 `newpage` 归到前一业务 intent 的 projection，不建独立 TestCase step。
2. atom mapping 只覆盖业务动作；结构 topology event 随 mapping 重新物化。
3. distilled formal event 仍是现役 `{action:"newpage",url}`。
4. source/distilled topology parity 不过则不允许 promotion。
5. `replay-actions.mjs` 在普通 locator 分支前实现 `newpage` 委派。

### S5 Integration

1. replay 的 page 读取只来自 controller active authority。
2. assertion、observer、settle、取证都通过活动页接缝。
3. `lib/replay-forensics.mjs` 新增小型 `attachPageForensics` adapter；网络/CDP/pageerror/dialog 对每个 page 恰挂一次，`bin/replay.mjs` 不再内联固定初始 page 接线。
4. run trace 只持脱敏 pageId/opener/page transition，不含 session seed。

## 5. 验收映射

| Story | 命令 | 实现前预期 |
|---|---|---|
| Controller | `node tests/_golden/page-topology-auth-continuity-controller.zero-sut.golden.mjs` | RED：模块缺失 |
| Session/forensics | `node tests/_golden/page-topology-auth-continuity-session.zero-sut.golden.mjs` | RED：模块缺失 |
| Record/distill parity | `node tests/_golden/page-topology-auth-continuity-pipeline.zero-sut.golden.mjs` | RED：capture 将 newpage 降 click / topology 模块缺失 |
| Replay newpage | `node tests/_golden/page-topology-auth-continuity-replay-action.zero-sut.golden.mjs` | RED：当前落普通 locator 分支 |
| Static boundaries | `node tests/_golden/page-topology-auth-continuity-boundaries.static.golden.mjs` | RED：模块、context 接线、newpage dispatch 均缺 |
| Adjacent GREEN | `node tests/_golden/page-topology-auth-continuity-adjacent-regression.zero-sut.golden.mjs`、`node tests/_golden/output-seal-b5-prelaunch.zero-sut.golden.mjs` | GREEN：现役 login bootstrap page double、record 脱敏与 output-seal prelaunch |

## 6. 实机 UAT 尾巴

自动门全部绿后仍必须人在场验证：

1. AI 中台 current build：进入智能体管理真实产生的新 tab/popup；
2. browser-visible origin、cookie/localStorage/sessionStorage 登录连续性；
3. popup 主动关闭与用户关闭都回正确 opener；
4. popup 上断言确实执行，旧 opener 不参与；
5. source replay 与 distilled replay 各自使用独立 fresh state；
6. AI 中台频繁更新后的 version-held-out 页面；
7. 医生站 web 新页场景；
8. Hi 小助 CEF 多页能力单列，不能由 web 外推。

真实值不进报告；只保存脱敏 page topology、verdict 和用户验收结论。

## 7. acceptance-gate 边界

本工序只新增本计划、决策记录、纯合成 context/page fixture、新 golden、红证和独立 PRD。新增能力门必须真实 RED，邻接门必须真实 GREEN，所有文件 SHA-256 冻结，`gate --dry` 可消费且所有 `passes:false`。不得修改生产、现役 frozen 测试、跨平台切片、HANDOFF/README/skill，不得 advance/commit。
