# teachin-replayability-closure 决策记录

日期：2026-07-27

## 问题

现有 `record` 能生成示教录制包，`intake` 与 `distill` 也有严格准入骨架，但仍不能证明三件事：

1. 录制现场关闭后，原始事件能否在一个真正新的浏览器会话中复现；
2. 原始事件能否忠实映射为已有 atom，而不是全量 pending、按共享 `intentId` 漏译，或由模型另写任意脚本；
3. 蒸馏结果能否在第三条物理 runtime（第二条 evidence replay）的真正新浏览器会话中，
   得到与 source 相同的业务结果。

如果缺少这三段，人工录制只能证明“当时人工做成功了”，不能证明 Casey 能重放，更不能证明蒸馏没有改语义。

## 已裁决决策

### D1 首版范围

本契约先完成 read-only v1 技术闭环，只允许冻结 side-effect policy 可确定为：

```text
effect=read
persistentMutation=false
```

允许导航、搜索、过滤、打开详情、同源 popup/new tab 等 UI 状态变化；不允许创建、编辑、保存、发布、删除、上传、下载、relation/mutation atom，也不把调用方声称“幂等”当证据。

前置条件仍通过已有 setup atom workflow 完成，但本契约首版只接受不产生持久化写入的 setup。需要创建测试数据的场景留给后继 formal promotion 契约。

### D2 fresh 不能自报

禁止接受 `{fresh:true}`、JSON receipt、run namespace 或时间戳作为 fresh 证据。

fresh runtime authority 只由以下事实共同铸造：

- 录制 browser 的真实 `disconnected` 事件已发生；
- 录制 context 的真实 close 已发生；
- replay browser/context/page 与录制对象身份不同；
- replay context 真实归属 replay browser；
- replay page 真实归属 replay context；
- replay browser 仍连接；
- replay Browser、Context、Page 任一对象一旦用于成功铸权，均不得被另一枚 authority 复用；
- authority 是模块私有 WeakMap 中的一次性能力，clone、spread、序列化、伪造和重放均无权。

source raw replay 与 distilled replay 必须各自使用不同的 fresh runtime authority。

### D3 capture 准入先于动作

对 capture 原始最终字节先做全包预检，再允许任何浏览器动作：

- exact bytes 计算 `sha256:<64hex>`；
- `caseId` 与闭合形状一致；
- `seq` 严格为 `1..N`，重复、跳号、乱序和非安全整数均拒；
- click/dblclick/fill/press 必须有 selector；
- 任一带 masked/redacted 敏感证据的 event 使全包零动作拒绝；
- topology sequence 先过现役 normalization；
- source 仍保持 `signed:false/replayReady:false/distillRequired:true`，不能被技术复现改写。

成功准入的 capture authority 是 opaque 多读只读 capability：runner 不消费它，后续
projection 只能通过 canonical inspector 取得 exact bytes 与深拷贝 capture；clone、
forge 无权，调用方不得另传一份自称相同的 capture。

### D4 `nav` 只作 checkpoint

原始事件中的 `nav` 只比较活动页当前安全 path+query：

- 相等：消费 checkpoint；
- 不等：`PATH_CHECKPOINT_MISMATCH`，首错停止；
- 不允许调用 `goto`、goBack 或其它导航把页面修回正确状态。

业务动作同样在动作前比较事件 path；错位时 executor 与后续事件调用数为零。

### D5 source proof 不是 verdict

raw replay 只有全事件消费后才可产生 `CLEAN` proof 与一次性 clean proof authority。持久化 proof 只是诊断工件：

- 不含 `PASS`、`verdict` 或正式裁定字段；
- 不含 selector、value、text、真实 path/URL/host；
- 不授权 atom roundtrip；
- 文件重读、clone 或手造 proof 均不能替代 clean proof authority；
- 换一个字节的 capture 不能消费原 authority。

正式 `PASS` 仍必须来自签署 expected 后的现役 replay → verdict → report。

### D6 atom 蒸馏按 event 证据覆盖

mapping 每行必须显式带 `evidenceEventSeqs`。覆盖键以 `eventSeq + action` 为主，`intentId` 只作业务归组：

- 一个 event 恰好 mapped 或 pending；
- mapped 与 pending 交集为空；
- 重复覆盖、越界、动作不符、漏译均 fail-closed；
- mapped step 删除 `route/reason`；
- capture admission 已拒绝纯坐标与 masked/redacted 敏感证据，projection 不得重新准入或洗白；
- unknown、未登记但已准入的 recipe、无法唯一映射、无法绑定 identity/effect 的 event 保持 pending；
- `newpage` 与触发 click 可共享 intent，但它仍是独立结构 event，不能被一条 click mapping 洗掉；
- 已有 atom 语义一致时只映射已有 atom，不新造任意脚本或自由 action；
- mapping 不得修改 expected、identity、effect 或 cleanup 语义。

resolved candidate 继续进入现役 flow-bridge、compile、draft、sign 链；本契约不建立旁路。
`resolutionAuthority` 只可各铸一次 source-semantic 与 atom-roundtrip grant，二者不能互换。
roundtrip 必须在独立 fresh/reset 的 guided-compile authoring runtime 真调用现役
`createCompileRun + compileFlow`，保持 mapping/expected/identity/effect 与 exact lineage
不变并关闭 owner；这条第三次物理动作链不铸 replay receipt、不参加等价比较。技术 candidate
不是正式 verdict，更不能自行写成 `PASS`。

### D7 两次回放不直接 diff `axes.json`

source 与 distilled 的 event/step/atom 数可不同，因此不比较：

- `stepId`、event/atom 数量；
- locator、CSS、坐标；
- pageId、openerPageId、requestId、CDP 序号；
- 时间戳、耗时、截图/录像/报告路径；
- 原始 URL、session key/value、动态平台 ID 与自由文本 actual。

确定性 semantic receipt 只投影并比较：

- 每个 intent 的正式四态与 reason；
- terminal hard predicates；
- 以 `intentId + transition ordinal` 锚定的 topology；
- 已验证 entity identity digest；
- effect class 与证据引用；
- cleanup policy/status；
- TestCase、expected、build、profile、replay kernel、reset/session policy 的共同 digest。

任何 `NEEDS_HUMAN`、证据缺失或不支持的 effect 都不能晋升，即使两边字面相同。

### D8 三物理 runtime、两 evidence replay 绑定

顺序固定为：

```text
prepared source runtime claim → live source reset
→ source raw replay/clean proof/逐 event observations
→ resolved projection
→ source semantic grant → 现役 axes/frozen verdict → source completion
→ atom grant
→ exact source runtime owners close/disconnect
→ 独立 authoring runtime reset/现役 flow-bridge+compile/close
→ genuine distilled candidate authority
→ immutable pair finalization
→ pair-bound source semantic receipt
→ distilled fresh runtime → live distilled reset
→ distilled replay/verdict
→ distilled semantic receipt
→ deterministic comparator
→ exact distilled runtime owners close/disconnect
```

source 执行前不存在 distilled placeholder；source/distilled role 不可互换，run namespace 必须不同，
reset 与 fresh-session 实例不得复用，distilled receipt 必须绑定 source receipt 的 exact bytes hash。

### D9 本契约与 GitHub 发布门

本契约完成的是可运行的技术闭环和确定性证明内核，不自动等于 GitHub 发布：

- production `record` 尚未完整生成正式 identity sidecar、package manifest 与真实 driver receipt；
- source/distilled 正式 candidate 仍须 draft/sign/replay/verdict/report；
- AI 中台 fresh source + fresh distilled、另一个 setup→body 场景、至少三份正式报告和用户明确验收仍属后继 formal promotion/UAT。

不得为赶进度削弱现役 intake、签署、identity 或 verdict 门。

### D10 结构边界

新增能力拆为小模块：

- fresh lifecycle/runtime authority；
- capture admission/raw plan；
- raw action runner；
- clean proof；
- resolved atom projection；
- pair/run authority；
- semantic receipt projection；
- deterministic comparator；
- 薄 CLI/orchestrator。

所有新增或修改生产文件逐个严格少于 600 行。禁止继续膨胀 `bin/compile.mjs`、`bin/replay.mjs`、`bin/sign.mjs` 与 `lib/replay/event-runner.mjs`。

### D11 full-cycle 必须同进程交 live authority

首发只有 `record --login-bootstrap` 可进入 full-cycle：final capture 先 admission，再由
runtime-cycle 对同进程 live recording Browser/Context 安装 witness、关闭并等 disconnected，
随后以 canonical bootstrap 新开 role=`source` runtime。application service 只把 genuine
capture/preparation cap 注入 orchestrator；caller 不能预开 replay handles，不能用 plain JSON、
clone 或第二次 recording use 重建 cap。`teachin-cycle` 只是 Casey 的真实薄 dispatch 别名，
`--no-login` 仍 capture-only。source raw 只允许 core 第 5 步执行一次。
handoff 后 entry 独占 recording owner：任一早退/抛错都 exact cleanup；record finally 不得二次 close。

### D12 no-entity 不是 caller 自报

首发 `nav.workflowManagement` 的 source entity lock exact bytes 固定 UTF-8 `[]`。canonical
verifier 必须自解析 formal events 并调用现役 entity admission：只有 bindings 全部缺席/空数组
才可出 `mode:not-required,runtimeAuthorized:false`；其它事件走 `runtime-required` 并要求
genuine authority。caller 的 `noEntity/mode/hint/handle/digest/entityLockAuthority` 一律不收。
verified handle 还绑定 genuine `authoringClosureAuthority` scope；相同 case/events/digest 的
foreign pair closure 也不能换用。

## 停止条件

出现以下任一情况立即停止自动晋升并 route human：

- capture 无法安全复现 masked input；
- source path、topology 或 selector 不确定；
- atom mapping 不能逐 event 证明；
- expected/identity/effect 需要修改；
- fresh/reset authority 无法由真实运行器事实铸造；
- source 或 distilled verdict 非全 `PASS`；
- semantic receipt 缺任一必需维度；
- 真实页面跨 origin SSO、CEF/iframe/shadow/canvas 超出首版能力。
