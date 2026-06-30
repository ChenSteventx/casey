# P5 回放内核 Phase 2 实现规格：`watchNetworkForensics` 取证轴 + `findEquivalentAffordance` 只读漂移探针

> 状态：**实现规格 / 未落地**。本文只产规格，**不写** `lib`/`bin`、**不碰**任何已冻区（已冻 `verdict.mjs`、已冻 golden 夹具、已冻 schema、假 `SUT`）。落地仍须过 P5 的 accept barrier（护栏 #11）、补/转绿 golden、过 `Quality Gate`。
>
> 两个模块都是**全新建**（design §9.1：`watchNetworkForensics` 是「全新建非照搬」，autotester 无网络取证能力；`findEquivalentAffordance` 是 design buildability-③ 拆 P5/P6 循环依赖时新立的只读探针）。
>
> 事实源（按其为准，本文不另立预期）：
> - 决策：`docs/adr/0007-p5-replay-substrate-and-forensics.md`（决策 2 `CDP` 真发起方归因 + 决策 3 `通道剖面` + 补充 B-ii 背景判别式）。
> - 术语：`CONTEXT.md` 的 `网络取证`/`错误信封`/`通道剖面`/`只读漂移探针`/`漂移补丁`/`三轴` 行。
> - 已冻下游契约：`bin/verdict.mjs`（`forensicsBacksSutError`、`driftHolds`，对三轴粒度与归因机制不可知，只认 `attributedStepId===stepId`）。
> - 已冻可复用件：`lib/forensics.mjs`（`checkErrorEnvelope`）、`lib/drift-patch.mjs`（`stableSignature` 不变量）。
> - 已冻接缝/红基线：`tests/_golden/fixtures/p5/replay-cases.json`、`tests/_golden/p5-replay.golden.mjs`、`tests/_golden/fixtures/p2/verdict-cases.json`、`tests/_golden/fixtures/seams/observed-reality.fixture.json`、`tests/_golden/schemas/drift-patch.schema.json`、`tests/_golden/fixtures/seams/drift-patch.fixture.json`、假 `SUT`（`tests/fixtures/fake-sut/server.mjs` + `CONTRACT.md`）。

---

## 0. 两模块在三轴管线里的位置

回放 runner（`bin/replay.mjs`，本文不规定其全貌）对每个原子步合并出一条 `StepAxes`，喂已冻 `verdict.mjs`：

```
StepAxes = {
  stepId, intentId, atom,
  action:         { ... resolution, identityReadback, driftProbe },   ← 动作轴
  postAssertions: [ { kind, op, value, actual, ok, soft } ],          ← 逐条断言轴
  forensics:      { lifecycle:{pageerror,crashed,crashedAtStepId}, network:[ <网络记录> ] }  ← 取证轴
}
```

- `watchNetworkForensics` 产出 `forensics.network[]` 的每条记录（A 章）。
- `findEquivalentAffordance` 产出 `action.driftProbe`（B 章），且**仅在**录制 locator 失配（`action.resolution==='none'`）时才填。

已冻 `verdict.mjs` 怎么消费这两路信号（落地不得改其语义，只能喂对形态）：

```js
// 取证背书：只有归因到本步的 SUT 错误才背书（按发起方、非时间窗）
function forensicsBacksSutError(forensics, stepId) {
  ...
  return net.some(n =>
    n && n.attributedStepId != null && n.attributedStepId === stepId &&
    (Number(n.status) >= 500 || (n.errorEnvelope && n.errorEnvelope.ok === false)));
}
// 漂移成立：录制 locator 未命中 且 同稳定签名唯一元素仍在
function driftHolds(action) {
  return !!(action && action.resolution === 'none' &&
            action.driftProbe && action.driftProbe.sameSignatureUniquePresent === true);
}
```

这两个谓词是本文所有「形态契约」的终点：规格的对错最终由「喂进去能否让已冻 `verdict.mjs` 给出 golden 钉死的四态」判定。

---

## A. `watchNetworkForensics`（取证轴）★ fail-safe 命门

实现 `CONTEXT.md` 的 `网络取证`：记 `response`/`requestfailed` 的 `{url,status,initiator}` + `错误信封`，**按请求发起方归因（非时间窗）**。命门：背景轮询 401 绝不翻 `verdict`（护栏 #14/#15、ADR-0007 决策 2）。

### A.1 输出形态（每条网络记录）

```
{
  url:              string,          // 请求 url（与 verdict/报告同字段）
  status:           number,          // HTTP 状态码；requestfailed（连接级失败）记 0
  ts:               number,          // 该请求的 epoch 毫秒（响应或失败时刻），仅排序/取证展示，不入裁定
  initiator:        string,          // 归因后的发起方【标签】：本步 = 该步 stepId；背景 = 'background'
  attributedStepId: string | null,   // 归因后的【步绑定】：正向因果到本步 = 该步 stepId；证不出 = null
  errorEnvelope:    { field, expected, actual, ok } | null   // 见 A.4
}
```

- 形态对齐已冻接缝：`verdict-cases.json` 与 `observed-reality.fixture.json` 的网络记录就是这个壳（`observed-reality` 额外带 `method`，可选保留，不入裁定）。
- `initiator` 是**归因后的标签字符串**，不是 `CDP` 原始 `initiator` 对象。原始 `CDP` `initiator`（`type`+栈）只在 A.3 内部用于算归因，不外泄进记录。
- **`attributedStepId` 默认值必须是 `null`，不是「最近的步」**。这是 fail-safe 的物理落点：证不出归 `null` → `attributedStepId===stepId` 永假 → 永不背书。

> 已冻八案 `background_401_not_attributed` 把背景 poll 的 `attributedStepId` 写成 `atstep_0`（非本步、亦非 `null`）。ADR-0007 补充 B-ii 已认定这是夹具 smell：以 `observed-reality.fixture` / `CONTRACT.md` 为准应为 `null`，且 `verdict` 层「`atstep_0` 不等于本步」与「`null`」两者都不背书、不影响结论。**落地一律产 `null`**——p5-replay golden 的 `background401`/`stale_bg401` 案钉死 `attributedStepId: null`。

### A.2 采集路径（`CDP Network` 域）

autotester 无可照搬件（`watchPageLifecycle` 只碰 `crash`/`close`/`pageerror`，不碰 HTTP；`waitForReplyByStream` 用 `page.waitForResponse` 取单条响应，不做全量归因）。本模块**全新建**，但镜像两处既有形：`watchPageLifecycle` 的「按 page 幂等挂监听 + 现场进证据」结构、`waitForReplyByStream` 的「按 url pattern 等响应」思路。

- 经 `CDP` 会话开 `Network` 域（`Network.enable`），订阅四类事件：
  - `Network.requestWillBeSent` —— 取 `requestId`、`request.url`、原始 `initiator`（`type` ∈ `script`/`parser`/`preload`/`SignalR`/`other`，以及 `stack` 调用栈帧）、`timestamp`。
  - `Network.responseReceived` —— 按 `requestId` 补 `status`、`mimeType`、响应时刻。
  - `Network.loadingFinished` —— 标记可读 body（A.4）。
  - `Network.loadingFailed` —— 连接级失败：`status=0`，记 `errorText`（取证展示用，不入裁定）。
- **关联键是 `requestId`，绝不是 `url`**（同 url 多请求会串证据）。一条记录的 `initiator`/`status`/body 必须靠同一 `requestId` 拼。
- 只收 `SUT` origin 与其 API 的请求；跨域遥测（埋点、第三方）默认丢弃或一律归 `background`/`null`（design §4.2「站点 origin/API allowlist，默认丢跨域遥测」）。
- 幂等挂载（同一 page/session 不重复注册），随回放结束解绑。

### A.3 归因算法（按发起方，非时间窗）★命门核心

输入：原始 `CDP` `initiator`（`type`+`stack`）、请求 `url`、`通道剖面` 的背景 `denylist`、**当前活动步游标**（runner 在驱动每个原子步前后推进的 `currentStepId`，让 script 发起的同步请求能正向系到本步）。输出：`{ initiator: 标签, attributedStepId: stepId|null }`。

判定顺序（**denylist + 定时器源 → background/null；正向因果系到本步才归本步；任何含糊 → null**）：

1. **`url` 命中 `通道剖面` 背景 `denylist`** → `initiator='background'`，`attributedStepId=null`。（背景轮询接口的名单兜底层。）
2. **原始 `initiator` 源是定时器/异步轮询** → `initiator='background'`，`attributedStepId=null`。判据：`initiator.type` 为 `other` 且无可追的用户动作栈帧；或 `stack` 顶帧落在 `setInterval`/`setTimeout`/`requestAnimationFrame` 回调（页面加载即起的轮询，如假 `SUT` 的 `setInterval(... fetch('/api/auths/poll') ...)`）。
3. **原始 `initiator.type==='script'` 且调用栈能正向追到当前活动步动作触发的同步链** → `initiator=currentStepId`，`attributedStepId=currentStepId`。（点击 `确定`/`保存` → 事件处理器同步 `fetch` POST，栈根是用户动作触发的那一帧。）
4. **任何含糊** → `initiator='background'`（或保留原始类名做展示），`attributedStepId=null`。含糊含：`initiator` 缺失、`type==='other'`/`preload`/`parser` 无法系回本步、跨域、栈追不回当前活动步、有响应但当时无活动步（步间空窗）。

铁律：归因**只看发起方**（denylist + `CDP` `initiator`/栈），**绝不看「请求落在本步时间窗内」**。背景 poll 与本步 save 几乎同时返回是常态；时间窗会把 poll 的 401 误归本步 → fail-open（ADR-0007 决策 2 否决项）。`denylist` 是**兜底层不是主信号**：主信号是 `CDP` 真发起方；漏一个背景模式时，定时器栈判据（步骤 2）仍能拦住，证不出仍归 `null`（步骤 4）。

### A.4 错误信封注入（经 `通道剖面`，复用 `lib/forensics.mjs`）

- 对**每一条**网络记录都算 `errorEnvelope`——连背景轮询记录都算。`错误信封`检查是**通道级配置**（成功字段 `web`/Heren = body `status===200`），不是按断言取值，故配置来自 `通道剖面` 而非按 `expected[]`（CONTEXT `错误信封`/`通道剖面` 行）。
- **直接复用** `lib/forensics.mjs` 的 `checkErrorEnvelope(body, { successField, successValue })`，参数取自 runner `--profile` 传入的 `通道剖面`：`{ background:[denylist], successField, successValue }`（hermetic 合成值 `successField='status'`/`successValue=200`；tier-2 由 `site.json` 非凭据子集投影）。**绝不读 `site.json`**（护栏 #7：`通道剖面` 是非凭据配置，与凭据密文严格分离）。
- body 取自 `Network.getResponseBody`（按 `requestId`，`loadingFinished` 后）并 `JSON.parse`。`checkErrorEnvelope` 已对「缺成功字段配置/缺 body 字段/敏感字段名」一律 fail-closed 返 `ok:false`（不静默放行软失败，护栏 #14/#7），落地直接吃这套语义。
- 非 JSON / 流式 / body 不可读时：`errorEnvelope.ok=false`（fail-closed），或 `errorEnvelope=null`。**但这绝不改变 A.3 的归因**——背景记录即便 `errorEnvelope.ok=false` 也因 `attributedStepId=null` 永不背书（A.5 命门 2）。
- 流式（SSE）响应：body 可能被前端消费或不终止，`getResponseBody` 不得阻塞回放。流式记录的取证以「响应回了且 `finished`」为信号（对齐 `streamReplyReceived`/`waitForReplyByStream`），`errorEnvelope` 允许为 `null`，不入裁定。

### A.5 与已冻 `verdict.mjs` 的接口 + 命门复现

背书条件（`forensicsBacksSutError`）= `attributedStepId===stepId` **且** (`status>=500` **或** `errorEnvelope.ok===false`)。据此跑通已冻接缝：

| 场景（假 `SUT`） | 本模块须产 | 已冻 `verdict` | 命门 |
|---|---|---|---|
| `inject500` | save POST 记 `status=500`，`attributedStepId=本步` | `SUT_DEFECT` | 5xx 归本步背书 |
| `envelope200bad` | save POST `status=200` 但 `errorEnvelope.ok=false`，`attributedStepId=本步` | `SUT_DEFECT` | 信封软失败第二条背书路 |
| `background401` | poll 记 `status=401`、`errorEnvelope.ok=false`、**`attributedStepId=null`** | `PASS` | 背景 401 进不了背书 |
| `stale_bg401` | poll 同上归 `null`；本步 save 干净 `200`；硬断言 `urlPathname` 失配 | `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)` | 错把 401 归本步则翻 `SUT_DEFECT`、被 golden 当场抓 |
| `happy`/`stream`/`drift`/`vanished`/`ambiguous` | 本步 save 干净 `200`、`errorEnvelope.ok=true`、归本步 | 取证不背书，结论由动作/断言轴定 | — |

`p5-replay.golden.mjs` 的 `wantForensics` 块对取证轴**直接硬断言**（不只靠下游 `verdict` 间接暴露）：按 `urlIncludes` 找记录，校 `attributedStepId`、`status`、`errorEnvelope.ok`。落地必须让这些字段逐字对齐。

### A.6 命门最易出错处（落地时务必逐条防住）

1. **时间窗诱惑（头号坑）**：背景 poll 401 与本步 save 200 几乎同时返回，按时间窗/活动步窗会把 401 归本步 → `stale_bg401` 翻成 `SUT_DEFECT`、`background401` 翻成非 `PASS`。**必须按发起方**：denylist 命中或定时器栈即 `null`。
2. **归因与信封计算未解耦**：`errorEnvelope` 对**每条**记录都算（含背景记录），所以背景 401 的 `errorEnvelope.ok` 就是 `false`。若 `attributedStepId` 没独立置 `null`、跟着信封走，就会背书。**两条管线必须解耦**：`attributedStepId` 由 A.3 发起方算、`errorEnvelope` 由 A.4 通道配置算；背书只在两者都指向本步时成立。
3. **`attributedStepId` 默认值写错**：默认必须是 `null`，绝不能是「最近活动步」或「当前步」。证不出归 `null` 是 fail-safe 的物理实现；默认成当前步 = fail-open。
4. **把 `denylist` 当主信号**：`denylist` 只是兜底层。漏配一个背景接口时，主信号（`CDP` 真发起方 + 定时器栈判据）仍须能拦；且最终含糊归 `null`。绝不退化成「无 denylist 的纯时间窗」（ADR-0007 推翻条件明禁）。
5. **`requestId` 关联错**：用 `url` 拼 `initiator`/`status`/body 会在多发同 url 时串证据；必须用 `requestId`。
6. **body 读取阻塞或抢占**：SSE/流式 body `getResponseBody` 可能挂起或被前端消费；不得阻塞回放、不得因读不到 body 而误归因。读不到 → `errorEnvelope` fail-closed 或 `null`，**归因不变**。
7. **步间空窗的请求**：响应回来时没有活动步（步骤切换的空窗）→ 归 `null`，绝不顺手挂到上一步或下一步。

---

## B. `findEquivalentAffordance`（只读漂移探针）

实现 `CONTEXT.md` 的 `只读漂移探针`：**无 spec 变更、无重跑**地探明「同稳定签名唯一元素是否仍在」，供 `verdict.mjs` 判 `HARNESS_ERROR`；与相 5 自愈写回（`漂移补丁`）严格分离（拆 P5/P6 循环依赖）。**只读：不点、不改 spec/events。**

### B.1 从 `atom` + `targetName` 构造 `stableSignature.canonical`

漂移场景的录制 locator 是**纯位置式 css**（脆性、无可解析语义），回放期失配。稳定签名不能取自这个失配的 locator，须从动作的**语义契约**重建。已冻 `replay-cases.json` 的 `drift` 步只给：`{ atom:'workflow.deleteByName', action:'click', fallbackCss:位置式, nth:1, targetName:'atl_wf_5fa1' }`（注意：`events.schema` 无 `targetName`/`stableSignature` 字段，`targetName` 是 golden 内联事件的漂移探针输入）。要复现已冻 canonical：

```
canonical = "role=button|name=删除|withinRow=atl_wf_5fa1"
```

构造规则（确定性、固定键序，逐字复现 `drift-patch.fixture.json` 的 canonical 形态）：

```
canonical = "role=" + role + "|name=" + name + "|withinRow=" + targetName
```

三个分量的来源（按优先级）：
- `role` / `name`：优先取 event 录制的稳定属性（`semantic.role`/`semantic.name` 或 `role`/`accessibleName`，见 `events.schema`）；**当录制只有位置式 css、无语义块时**（正是 `drift`/`vanished` 步），回落到 `atom` 的**动作可供性契约**——`workflow.deleteByName` → `{ role:'button', name:'删除', scope:'withinRow' }`。这层 `atom`→可供性映射是「同稳定签名」得以脱离脆性 locator 而存活的根据。
- `withinRow`：取 `targetName`（`atl_wf_5fa1`），即动作所在行的稳定行名。
- 不变量：构造出的 canonical 须等于 `drift-patch.fixture.stableSignature.canonical`，也等于探针实际命中时回填的 `matchedSignature`（B.4）；三者一字不差。

> 命门：`role`/`name` 在 `drift` 案里**不能**硬编码成 `button`/`删除`——必须由 `atom`/录制语义按规则推出。`vanished` 案用同一 `atom`/`targetName`、同一构造规则，得到同一 canonical 去查 DOM，但目标行不在 → 命中数 0。硬编码会让 `vanished` 也产 `present:true` 而误判（B.3 堵）。

### B.2 探针执行（只读 DOM 查询）

仅在 `action.resolution==='none'`（录制 locator 失配）时触发——录制 locator 命中则无漂移可言、不跑探针、`driftProbe=null`。

- 用 canonical 的语义分量构造**语义定位器**（`getByRole`/`getByText`，对照 css/坐标兜底，CONTEXT `语义定位器`）按 `withinRow` 收窄作用域。对齐 `drift-patch.fixture.locatorAfter` 的表达式：
  ```
  page.getByRole('row', { name: /<targetName>/ }).getByRole('button', { name: '删除' })
  ```
- `candidateCount` = 过滤（可见/可点）后的命中元素数。
- 只做 `count`/查询，**绝不 `click`、绝不写 events/spec/旁文件**（写回是相 5 自愈、P6 的事，严格分离）。

### B.3 输出 `driftProbe` 字段（对齐已冻 `StepAxes.action.driftProbe`）

```
driftProbe = {
  sameSignatureUniquePresent: boolean,   // candidateCount === 1
  candidateCount:             number,    // 真实命中数（堵硬编码）
  matchedSignature:           string     // 命中时 = canonical；须等于 stableSignature.canonical
}
```

判定（对齐已冻 `verdict-cases.json#harness_error`/`#indeterminate` 与 `drift-patch.schema` 的 `candidateCount>=1` 约束）：

| `candidateCount` | `sameSignatureUniquePresent` | 含义 / 下游 |
|---|---|---|
| `1` | `true` | 同稳定签名唯一元素仍在 = 纯 locator 漂移 → 喂 `verdict` 判 `HARNESS_ERROR`（`drift` 案） |
| `0` | `false` | 同稳定签名元素已消失 → 非工装漂移 → fail-safe 落 `INDETERMINATE`（`vanished` 案） |
| `>1` | `false` | 多匹配非唯一 → 不是可自愈的纯漂移，应降级 `AMBIGUOUS_ACTION` route:human（`drift-patch.schema` 注：`>1` 不自愈） |

### B.4 喂 `verdict.mjs` 的接口 + 命门复现

- `verdict.driftHolds(action)` 要求 `action.resolution==='none'` **且** `driftProbe.sameSignatureUniquePresent===true`。故落地须保证：探针只在 `resolution==='none'` 时填 `driftProbe`；`drift` 案两条件齐 → `HARNESS_ERROR`；`vanished` 案 `sameSignatureUniquePresent=false` → `driftHolds` 假、取证又干净 → `verdict` 落 `INDETERMINATE`。
- `p5-replay.golden.mjs` 的 `wantDriftSignal` 块对 `action.driftProbe` **逐字硬断言** `sameSignatureUniquePresent`、`candidateCount`、`matchedSignature`：
  - `drift`：`{ sameSignatureUniquePresent:true, candidateCount:1, matchedSignature:"role=button|name=删除|withinRow=atl_wf_5fa1" }`。
  - `vanished`：`{ sameSignatureUniquePresent:false, candidateCount:0 }`。
- 命门：golden 把 `candidateCount` 单独钉死，就是**堵 runner 把信号硬编码成 `present:true`**——`vanished` 的 `0` 与 `drift` 的 `1` 必须来自同一段真 DOM 查询，不是常量。

### B.5 边界与不变量

- **只读**：探针不点、不改 spec/events、不写 `漂移补丁`。补丁里 `before===after`（同稳定签名）的合法性判定、locatorAfter 真实生成、人签写回，全是相 5/P6 的事，本探针只回答「在不在、唯不唯一」。
- **不出裁定**：探针只产 `driftProbe` 信号，四态分类由零 LLM 的 `verdict.mjs` 独占（护栏 #15）；探针绝不自己判 `HARNESS_ERROR`，也绝不进裁判进程。
- **`atom` 可供性契约须登记**：`atom`→`{role,name,scope}` 映射是新接缝（`workflow.deleteByName`→`button`/`删除`/`withinRow` 是当前唯一用例），落地前若扩为通用表，须按统一语言规则在 `CONTEXT.md` 登记后再落（避免散落硬编码）。

---

## C. 落地次序与红绿对账（不在本文范围、仅备忘）

- 两模块都在 P5 Phase 2「fan-out 起草的七模块」内（`exec-plan.md`）：可并行起草，由集成主干串行收敛进 `StepAxes` 合并。`watchNetworkForensics` 因是命门按新建慎做、非机械移植。
- 转绿判据：`watchNetworkForensics` 让 `inject500`/`envelope200bad`/`background401`/`stale_bg401` 四案的取证轴硬断言与下游 `verdict` 同时转绿；`findEquivalentAffordance` 让 `drift`/`vanished` 两案的 `wantDriftSignal` 与下游 `verdict` 同时转绿。
- 真机可靠度（`CDP` 发起方在真 Heren 流量下能否稳定正向归因）是 route:human / observability 项（ADR-0007 推翻条件），不卡 loop 绿。
