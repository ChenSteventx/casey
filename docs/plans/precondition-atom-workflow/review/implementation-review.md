# precondition-atom-workflow · 实现评审

> 结论：`PASS`。两路独立只读复审在最终提交 `da636a1` 上均确认无未处置
> Critical / High / Medium。

## 1. 交付范围

- registry 真值驱动的 setup candidate/plan、稳定拓扑和状态 trace；
- setup execution evidence → candidate receipt → main admission；
- plan admission → 单次 execution request → setup → receipt → admission → main 固定 barrier；
- 名称/编号发现与 identity observation 平台 ID 确认；
- 三条新金牌、三条邻接回归和 R1-R5 acceptance amendment。

本契约只证明 zero-SUT 纯函数与受信 adapter 接缝，不宣称真实 AI 中台、医生站、Hi 小助或受控
浏览器 UAT 已完成。

## 2. 评审发现与处置

首轮实现审查与后续 challenge 定点审计发现并闭合：

- exclusive group 已移除的中间状态不得进入 receipt；
- plan 必须在 setup adapter 前准入，坏 plan 的 setup/main 均零调用；
- TestCase 业务前置不进入初态，且每项非 Login Bootstrap 前置必须被 goal 与最终 readback 完整覆盖；
- 同 case 新增业务前置后，旧 plan/receipt 不得继续授权；
- identity ref 不能省略，issuer、kind、完整关联键与生产 observation 形状必须一致；
- 同一 session 只签发一次 execution request，首次针对 ready/matching plan 的 evidence finalize 即消费；
- receipt 绑定 execution request digest，不同 session/run 的 receipt 字节不同；
- `workflow.open` 的现役 action=`subject` / observation=`source` 冲突在规划期具名
  `SETUP_IDENTITY_ROLE_CONFLICT`、`route:human`，没有通过换夹具制造假绿。

两路最终复审分别覆盖完整 setup 行为和 challenge/session 对抗。两者均给出 `PASS`，无
Critical / High / Medium。

## 3. 证据

- setup plan：10/10；
- setup receipt/identity：8/8；
- runtime barrier：5/5；
- state trace：5/5；
- flow bridge：17/17；
- entity binding operability：7/7；
- 旧 side-effect policy：17/17；
- workflow source-readback wiring：18/18；
- PRD gate：4/4 GREEN，9 项 checksum 零漂移；
- `casey selftest --tier1`、term-lint、`git diff --check`：GREEN。

## 4. 明确边界

`executeSetup` 是受信 evidence adapter。S1 能证明 request/evidence/receipt 相关性，并阻止未改写的
旧 envelope/receipt 重放；无签 JSON 本身不能证明 readback 的发生时刻。错误 adapter 把 fresh
challenge 重包到缓存旧 readback/identity observation，必须在后继浏览器接缝中把 request digest
下沉到实际 observer，并以 fresh-run UAT 取证。

非阻断 Low：公共 `finalizeSetupReceipt` 若先收到同 case 但 `ready:false` 的 plan，会在消费 session
前拒绝；随后可用原 ready plan 继续。固定 barrier 已先执行 `admitSetupPlan` 且不重试，此路径不可达，
不形成执行或授权绕过。

