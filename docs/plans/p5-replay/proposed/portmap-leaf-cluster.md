# P5 回放叶子簇 移植蓝图（portmap：leaf-cluster）

> 状态：纯蓝图，全文标「实现参考 / 未落地」。不写 `lib`/`bin`，不碰已冻区（`verdict.mjs`、八案 `verdict-cases.json`、`observed-reality.schema.json`、`events.json` / `expected.frozen.json`）。
> 用途：给 P5 Phase 2 四个互不依赖的叶子模块（`replay-guards` / `watchPageLifecycle` / `instantiate` / `waitForReplyByStream`）一张「源在哪 → Casey 怎么改 → 挂哪个三轴/观测现状字段 → 跟 runner 主干哪里接线 → 坑在哪」的对照表，供 fan-out 子代理起草、我串行落地。
> 事实源：`docs/plans/p5-replay/{plan.md,grill.md,exec-plan.md}`、`docs/adr/0007-p5-replay-substrate-and-forensics.md`、已冻 `tests/_golden/fixtures/p2/verdict-cases.json`、`tests/_golden/schemas/observed-reality.schema.json`；复用源 autotester `/mnt/d/ctx/heren/autotester`。2026-06-30 落。

---

## 0. 公共坐标：两张已冻接缝的字段速查（移植靶子）

四个模块都不是凭空产数据，而是把 autotester 的运行时观测灌进 Casey 这两张已冻接缝的具体字段。先把靶子钉死，下面各节只引字段名。

### 0.1 三轴 / StepAxes（喂 `verdict.mjs` 的形态，逐字对齐 `verdict-cases.json`）

每个裁定单元（= 一条 intent，按 `intentId` 聚合 N 个 event）一条：

```
{ stepId, intentId, atom,
  action:        { kind, resolution, identityReadback, driftProbe },
  postAssertions:[ { kind, op, value, actual, ok, soft } ... ],
  forensics:     { lifecycle: { pageerror: [], crashed: false },
                   network:   [ { url, status, initiator, attributedStepId, errorEnvelope } ... ] } }
```

### 0.2 观测现状 / `observed-<caseId>.json`（编译期相1落盘，断言草拟 + 取证背书共吃）

每回放事件步一条 `observedStep`：

```
{ stepId, intentId, atom, urlPathnameAfter, cleanTitles, toastTexts,
  replyText, replyStreamUrl, requestLog: [ ... ], quietPointReached }
```

> 关键不变量（已冻语义，蓝图不得违反）：`observed` 存实测字面量（含 `atl_<ts>` 实例名）、天生易变的字段（`replyText`/含实体 id 的 url）绝不冻成 golden；`quietPointReached=false` 一律下游 route:human、绝不静默当 ground truth；`forensics.network` 按发起方归因（护栏 #15），`attributedStepId` 含糊归 `null`、`null` 永不背书（护栏 #14）。

---

## 1. `replay-guards`（`coordClick` 命中测试 / 必填预检 / 下拉回读）

### autotester 源 file:line

`/mnt/d/ctx/heren/autotester/lib/replay-guards.mjs`（整文件零 `@playwright/test` 值依赖、只吃一个 `page`、失败一律 `throw` 原生 `Error`——这正是它能直接移到 Casey 纯 mjs runner 的原因）：

- `assertCoordHittable(page,x,y)`：21-48 —— 坐标兜底点击前 `document.elementFromPoint` 命中测试；命中 `html`/`body`（点空）抛「需 regen」；视口外坐标按 `AT_COORD_STRICT` 策略（默认告警放行、严格模式硬拦）。
- `coordClick(page,x,y,dbl)`：58-62 —— 守卫版坐标点击 = `assertCoordHittable` + `page.mouse.click`。
- `expectRequiredFilled(page,scope)`：71-125 —— 提交（确认/保存/确定）前扫 `scope` 内必填项（native `required` / `aria-required` / 星号标签三信号），有空就指名抛错、就地中止，避免下游 `waitForURL` 死等超时埋掉根因。
- `expectDropdownValue(shell,expected,opts)`：136-165 —— 自绘下拉「选完回读」：按元素类型取当前显示值（`input` 读 `value` / 自绘 `div` 读文本），轮询比对到超时，不一致抛「下拉静默假绿拦截」。

接线源（怎么被主干吃）：`/mnt/d/ctx/heren/autotester/lib/robust-actions.mjs:8` 导入 `expectRequiredFilled,coordClick`；`robustClick`（46-93）里 `requireFilledScope` 预检在 48、坐标兜底走 `coordClick` 在 51/63/88。

### Casey 侧改动（实现参考 / 未落地）

- 直拷为 Casey runner 的 `lib` 纯 mjs 守卫（去掉对 autotester `SITE`/`__dirname` 的任何隐性依赖——本文件本就没有，故近乎直拷）。`scope`/`shell` 选择器、提交词集合、星号信号等改读 Casey 的`通道剖面`/site 非凭据子集，不写死 Heren class。
- 三个守卫的「抛错」语义在 autotester 里是让回放整步红；在 Casey 里要改成「不抛断进程，而是把结论翻译成三轴信号」——因为裁判零 LLM、四态由 `verdict.mjs` 出，守卫不能自己定生死。即：守卫探到的结果由 runner 捕获 → 落 `action.resolution` / `action.identityReadback` / 一条 `postAssertions`，交判定树裁。
- `AT_COORD_STRICT` 这类 env 旋钮在 Casey 收敛进`通道剖面`或 runner flag，不留裸环境变量（hermetic 可复现要求）。

### 挂到三轴 / 观测现状哪个字段

- `coordClick`/`assertCoordHittable`：决定「坐标兜底这一级是否真点到东西」。走到坐标兜底本身就意味着语义定位器与 `fallbackCss` 都没命中 → 该 event 的 `action.resolution` 已非 `unique`（落 `fallback_first` 或 `none`）；命中测试点空抛错 → 该 event「终态没点中」→ 聚合后 `actionPerformed=false`（对照 `verdict-cases.json` 的 `resolution:"none"` + `indeterminate`/`harness_error` 案）。挂点：`action.resolution`。
- `expectRequiredFilled`：必填项为空 = 一条硬失败信号。挂点：`forensics`/`action` 之外，落 `postAssertions` 里一条（kind 待 accept 定，候选 `requiredFilled`；已冻八案未含此 kind，故新增 kind 须确认不破 `verdict.mjs` 判定树，这是未落地待决点）。退一步可只作回放期「根因前移」中止并落 `quietPointReached=false` + reason，不新增断言 kind。
- `expectDropdownValue`：下拉选完回读 ok/失败 = 点击身份是否落实。挂点：`action.identityReadback`（对照 `harness_error` 案 `identityReadback:{ok:false}`）——下拉没真选中、但同稳定签名元素还在 → 配合只读漂移探针推 `HARNESS_ERROR`。

### 与 runner 主干的接线点

主干入口是移植后的 `robustClick`/`robustFill`/下拉语义单元（exec-plan「`robust-actions` 三轴埋点产动作轴」那条）。`replay-guards` 不直接被 runner 调，而是被这些动作原语调用：

- `robustClick` 的提交步 → 调 `expectRequiredFilled`（位置同 autotester `robust-actions.mjs:48`）。
- `robustClick` 三级兜底的坐标级 → 调 `coordClick`（位置同 `robust-actions.mjs:51/63/88`）。
- 下拉语义单元回放收尾 → 调 `expectDropdownValue`（autotester 由 `describe-action.mjs:363` 生成的 `dropdownUnitCode` 末行注入；Casey runner 在执行下拉 intent 终态时调）。

接线方向：守卫的结论由动作原语返回给 runner 的「动作轴埋点」，再由 StepAxes 合并阶段写进 `action.*` / `postAssertions`。

### 坑

- 守卫在 autotester 是「响亮抛错」，照搬会让 runner 进程崩、产不出三轴——必须改成「捕获→翻译成信号」，否则一个空必填项就让整个 `axes.json` 缺该 intent，裁判没法裁。这是本模块最大改造面。
- `expectRequiredFilled` 新增断言 kind 有撞已冻 `verdict.mjs` 判定树的风险（八案没这条）；要么走「不新增 kind、落 `quietPointReached=false`」的保守路，要么 accept 阶段确认判定树容得下新 kind（未落地）。
- `assertCoordHittable` 的「视口外坐标默认告警放行」在 hermetic 假 SUT 上视口固定，可直接开严（等价 `AT_COORD_STRICT=1`），避免「点空被当成功」的假绿；但真站 tier-2 视口可变、不能一刀切。
- `expectDropdownValue` 轮询 `waitForTimeout(120)` 是真机异步落值的等待，在 hermetic 同步假 SUT 上可瞬达；移植时别把它当静默点用——它只是局部回读轮询，跟第 4 节的流式静默点是两码事。

---

## 2. `watchPageLifecycle`（crash / close / pageerror 按本步归因）

### autotester 源 file:line

定义：`/mnt/d/ctx/heren/autotester/tests/_fixtures.ts:290-314`
- `watchedPages` WeakSet 幂等去重：290。
- `watchPageLifecycle(page,testInfo)`：297（幂等：298；起算时刻 `startedAt`：300；`safeUrl` 兜页面已关 `url()` 抛错：302-304）。
- 三类监听：`page.on('crash')` 305-307、`page.on('close')` 308-310、`page.on('pageerror')` 311-313；各 push 一条 `testInfo.annotations`（带自首调用起的秒数 + 现场 url 或错误信息前 200 字）。

接线源：生成 spec 时 `/mnt/d/ctx/heren/autotester/lib/describe-action.mjs:873`（加 import）、898（`context.on('page', p => watchPageLifecycle(p, testInfo))` 给新弹窗页挂）、901（给主 `page` 挂）。

### Casey 侧改动（实现参考 / 未落地）

- 输出端从「写 `testInfo.annotations`（人看报告）」改成「收集进结构化 per-intent 缓冲」，最后由 StepAxes 合并写 `forensics.lifecycle`。autotester 是为 Playwright 报告留痕；Casey 要的是喂 `verdict.mjs` 的机读字段。
- 归因维度收敛：autotester 只记「自测试起算的秒数」，不归到具体步；Casey 要按「事件发生时的活动 intent」把 `pageerror` 归到那条 intent 的 `forensics.lifecycle.pageerror[]`、`crash` 置该 intent `crashed=true`。
- 仍保幂等 WeakSet + `safeUrl` try/catch（页面已关 `url()` 抛错这条坑直接继承，别丢）。

### 挂到三轴 / 观测现状哪个字段

- `pageerror` → `forensics.lifecycle.pageerror[]`（已冻八案里恒为 `[]`，即「无外因 JS 报错」；移植后非空表示本步期间页面 JS 抛错，是 `HARNESS_ERROR` vs `SUT_DEFECT` 分诊的取证之一）。
- `crash` → `forensics.lifecycle.crashed`（八案恒 `false`）。
- `close`：八案 StepAxes 无独立字段。它在 Casey 主要用于「区分标签页被关 vs 页面 crash」的诊断，落 `observed`/报告诊断或并进 `pageerror` 语义即可，**不新增已冻 StepAxes 字段**（避免破 `verdict-cases.json` 形态）。

### 与 runner 主干的接线点

- runner 起回放时给主 `page` 挂一次（对位 `describe-action.mjs:901`），并给 `context.on('page')` 的每个新弹窗页挂（对位 898）——弹窗是一等回放对象，漏挂会丢弹窗页的外因。
- runner 维护「当前活动 intent」游标（按 `intentId` 聚合依序回放时本就有）；生命周期回调触发时读该游标做归因。
- 收集缓冲在 intent 静默点收口，交 StepAxes 合并阶段写 `forensics.lifecycle`。

### 坑

- 归因维度跟网络取证不一样，别混：网络取证按「请求真发起方（CDP initiator）」归因、明禁时间窗（护栏 #15、ADR-0007 决策 2）；但 `pageerror`/`crash` 事件没有 initiator 栈可查，只能按「事件发生时的活动步时序」归因。蓝图必须显式声明：生命周期轴是时序归因、网络取证是发起方归因，两者不是同一套机制，不能因为护栏 #15 就以为生命周期也得有 initiator。
- `close` 在正常 teardown 也会触发；不能把收尾的 `close` 当失败信号，否则每条用例都误红。归因游标要在回放结束/页面正常关闭时停止采信。
- 异步性：`pageerror` 可能在静默点之后、下一步开始前才冒出来，归因游标的收口时机要对齐 intent 静默点，别把上一步的迟到报错算到下一步头上。

---

## 3. `instantiate`（`{{uniqueName}}` 模板回填，约 7 行）

### autotester 源 file:line

`/mnt/d/ctx/heren/autotester/lib/_data_runner.mjs:15-21`（正好 7 行）：

```
function instantiate(value, rowName, ts) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\{\{\s*uniqueName\s*\}\}/g, `${rowName}_${ts}`)
    .replace(/\{\{\s*rowName\s*\}\}/g, rowName)
    .replace(/\{\{\s*ts\s*\}\}/g, ts);
}
```

调用点：`_data_runner.mjs:72`（未交互字段补项）、85（`fill` 值）、89（`prompt` 文本）。关联件：`/mnt/d/ctx/heren/autotester/lib/data-store.mjs:83` `instantiateRunId`（`atl_<行名>_{{ts}}` 基名 + 运行时短时间戳）、189 起 `deriveUniqueName`（撞名 → `_atl_<ts>` 后缀，Reserved Prefix 令牌、护栏 #6）；以及 `_data_runner.mjs:87` 的 `uniqueGuard` 分支（实体名填确切固定值 → 走建名查重，不模板化）。

### Casey 侧改动（实现参考 / 未落地）

- 近乎直拷这 7 行纯函数（无外部依赖、确定性可测）。Casey 里它在回放 runner 消费已冻 `events.json` 值、执行 `fill` 之前做一次模板替换。
- 按 grill 决策 7：`atl_` Reserved Prefix 由 compile-gate 的 `uniquePrefix` 在编译期注入进冻结 event 值（值里留 `{{uniqueName}}` 模板）；回放只负责把 `{{uniqueName}}` 填成 `${rowName}_${ts}`，`ts` 运行时生成。`uniqueGuard`（实体名填确切固定值、无 `{{}}` 模板）走建名查重 `ensureUniqueName`，不自动时间戳化（honor 用户确切名字，仅真撞名加后缀）。
- Casey 可只保留 `uniqueName`（必要）这一种模板键；`rowName`/`ts` 两键是 autotester 参数集批量的产物，Casey 单用例回放是否需要，accept 阶段定（未落地）。

### 挂到三轴 / 观测现状哪个字段

- `instantiate` 不直接对应某条 StepAxes 裁定字段；它产「回放真正填进去的唯一名字面量」，这个字面量随后出现在 `observed` 的实测字面量里：`urlPathnameAfter`（新建实体后 url 可能含 `atl_<ts>` 段）、被填字段的值、`cleanTitles`/`toastTexts`（含新建实体名）。
- 间接挂点：保证「同一冻结 spec 多次回放不撞后端唯一约束」，使 `action`/`postAssertions` 不因撞名误红——它是让确定性回放可重复跑的前置，而非一条轴。

### 与 runner 主干的接线点

- runner 主循环：取冻结 event → `instantiate(value,rowName,ts)` → 交给 `robustFill`/消息框输入。位置对位 autotester `_data_runner.mjs:85/89`，但 Casey 在单条回放管线里、不在批量 overlay 里。
- `ts` 由 runner 运行时一次性生成（整条用例共享，使同一实例名在多步间一致），不进任何冻结产物。

### 坑

- 已冻不变量：`events.json` 里存的是 `{{uniqueName}}` 模板、不是已实例化值；`ts` 绝不能写回冻结 events（否则每次回放字节变、破冻结）。`observed` 才存实测字面量（含 `atl_<ts>`），且这些字面量天生每次变 → 下游负责模板化、绝不冻成 golden 断言字面量（`observed-reality.schema.json` 已明示）。移植时分清「模板存冻结区、实例存观测区」。
- `atl_` 前缀语义在 Casey 归 compile-gate 注入（编译期），不是回放期凭空加；`instantiate` 只做字符串替换，别把前缀注入逻辑也搬进来，越界。
- 跨步一致性：同一 `{{uniqueName}}` 在「建」和「后续搜/删」多步里必须替成同一字面量，故 `ts` 整条用例固定一次；若每步现取 `Date.now()` 会步间不一致、查删落空。

---

## 4. `waitForReplyByStream`（SSE `finished()` 静默点）

### autotester 源 file:line

`/mnt/d/ctx/heren/autotester/tests/_fixtures.ts:204-240`：
- 签名/默认值：204-216（`timeoutMs` 默认 30s、`bodyTimeoutMs` 默认 600_000=10 分钟、`expectedStatus` 默认 200）。
- 先挂响应等待 `page.waitForResponse`：218-225（匹配 `urlPattern` 且 `status()===expectedStatus`）。
- 触发动作 + 拿响应：227-229（`startedAt` 计时 → `await opts.trigger()` 发消息/按发送 → `await responsePromise`）。
- 静默点核心 —— `finished()` 竞速：231-234（`Promise.race([ response.finished(), 超时 reject ])`，SSE body 在 `bodyTimeoutMs` 内未结束就抛）。
- 收尾：236-239（取 `response.text()` 兜 SSE 已被前端消费、返回 `{status,url,bodyText,durationMs}`）。

注入源（生成器怎么把「发消息→发送」包成它）：`/mnt/d/ctx/heren/autotester/lib/describe-action.mjs:279-302` `buildSendWaitBlock`、621-643 `sendBlock`（每次发送都包、`trigger` 为原发送动作、`urlPattern` 取 `SITE.llm.streamPattern`）；import 注入开关 875/1001。

### Casey 侧改动（实现参考 / 未落地）

- 移植为 Casey runner 的流式静默点门。autotester 返回 `{status,url,bodyText,durationMs}`、把 `bodyText` 当回复正文塞 annotation；Casey 要按 grill 决策 5 拆成两份用途：
  - 静默点信号 → `observed.quietPointReached`；命中响应 URL → `observed.replyStreamUrl`；正文（展示用）→ `observed.replyText`（不冻、不进 verdict）。
  - 一条 `streamReplyReceived` 三轴断言条目 → `postAssertions`：只判「匹配响应回 `expectedStatus` 且 `finished()`」，body/duration 不进 `verdict.mjs`（grill 决策 5、design §4.4）。
- `urlPattern`/`expectedStatus` 改读`通道剖面`（非 `SITE` 凭据），hermetic 由假 SUT 的 SSE 路由提供合成流。

### SSE `finished()` 静默点怎么对齐 Casey `静默点`（本节重点）

- Casey `静默点` 已登记定义 = 「networkidle + 无动画 + DOM 稳定 K ms」，是落 `observed` / 做后检查前必达的确定性等待条件，替固定睡眠保可复现。
- 矛盾：流式回复期间 SSE 是长连接、持续吐 chunk，networkidle 永不达 —— 用通用静默点判据会在流式步死等超时。故 grill 决策 5 拍板：流式 intent 的静默点判据「换成」`response.finished()`（那条匹配 `urlPattern` 且 `status===expectedStatus` 的流式响应体结束），而非 networkidle。
- 对齐方式（蓝图口径）：`finished()` 达成 = 该流式 intent 的静默点达成 → 置 `observed.quietPointReached=true` → 此后才采集 `replyText`/`replyStreamUrl`、跑该 intent 的 `postAssertions`。即 `waitForReplyByStream` 在流式步替换通用静默点 gate、占同一逻辑位（「采集与后检查前必达的确定性条件」），语义对齐、判据替换。
- 兜底：`finished()` 在 `bodyTimeoutMs` 内未结束（SSE 永不关/挂死）→ 不静默放行，置 `observed.quietPointReached=false`（该步可复现性存疑 → 下游 route:human，绝不当 ground truth）。这条把 autotester「抛 Error 整步红」改成 Casey「落 false 信号交判定树」，与第 1 节守卫同一改造原则。

### 挂到三轴 / 观测现状哪个字段

- 流静默点达成 → `observed.quietPointReached`（流式步专用判据：`finished()` 取代 networkidle）。
- 命中流式响应 URL → `observed.replyStreamUrl`。
- 回复正文 → `observed.replyText`（展示/草拟 `replyContains`，天生每次变、不冻、不进 golden）。
- `streamReplyReceived`（回 `expectedStatus` + `finished()`）→ 一条 `postAssertions`（body 不进裁定）。

### 与 runner 主干的接线点

- runner 识别「流式 intent」（消息框输入 + 发送）后，发送动作不裸跑，而是作为 `trigger` 传进 `waitForReplyByStream`（对位 autotester `sendBlock` 把原发送当 `trigger`）。
- 流式步绕过通用静默点 gate、改用 `finished()` 作该 intent 的静默点；达点后走统一的「采集 observed + 产 StepAxes」收口，与非流式步在 StepAxes 合并阶段汇流。
- `chat` 维度（CONTEXT 已登记）专吃这条：`streamReplyReceived` / `replyContains` 的取证底座就是它。

### 坑

- `finished()` 等的是「那一条匹配且 200 的响应体结束」；若假 SUT 的 SSE 保持连接不关闭（真 EventStream 常驻），`finished()` 卡到 `bodyTimeoutMs`——hermetic 假 SUT 的 SSE 路由必须在吐完合成 chunk 后显式结束响应，否则 golden 跑 10 分钟超时。这是 fixture server SSE 路由契约的硬要求。
- 默认 `bodyTimeoutMs=600_000`（10 分钟）是为真站 LLM 慢回复设的；hermetic golden 必须改小（合成流应秒级结束），别让一条挂死流拖垮整个 golden 套件。
- `expectedStatus` 必须命中才解析：`waitForResponse` 只认 `status===expectedStatus`，假 SUT 流式路由若先回非 200 再补流，`waitForResponse` 永不命中、`timeoutMs`（30s）超时——流式负路径（错误状态）要在 fixture 里单独设计，别跟正路径混。
- 不要把 `finished()` 静默点跟第 1 节 `expectDropdownValue` 的局部回读轮询、或通用 networkidle 静默点混为一谈：三者都在「等」，但判据/适用步/挂点各不同——流式步用 `finished()`、下拉用回读轮询、普通步用 networkidle，蓝图不可张冠李戴。

---

## 5. 起草顺序与主干接线总览（给 fan-out 子代理）

按 exec-plan「软序」：四个叶子互不依赖、文件互不相交、对 `@playwright/test` 零值依赖，可并行起草；都在「动作原语 / StepAxes 合并 / 静默点门」这三个主干接缝处汇入，由我串行落地、保轴抽象一致。

| 模块 | 源 file:line | 主挂字段 | 主干接线点 |
| --- | --- | --- | --- |
| `replay-guards` | `lib/replay-guards.mjs:21/58/71/136` | `action.resolution` / `action.identityReadback` / `postAssertions` | 动作原语（`robustClick`/下拉单元）内调 |
| `watchPageLifecycle` | `tests/_fixtures.ts:297` | `forensics.lifecycle.{pageerror,crashed}` | runner 起回放挂监听 + 活动 intent 游标归因 |
| `instantiate` | `lib/_data_runner.mjs:15` | `observed` 实测字面量（间接） | runner 主循环 `fill` 前模板替换 |
| `waitForReplyByStream` | `tests/_fixtures.ts:204`（`finished()` 231-234） | `observed.quietPointReached`/`replyStreamUrl`/`replyText` + `streamReplyReceived` | 流式 intent 静默点门（替 networkidle） |

> 上表所列源路径相对 `/mnt/d/ctx/heren/autotester`。全文未落地、待 Phase 2 accept 后实现；新增断言 kind（必填预检）与模板键裁剪（`instantiate`）两处「未落地待决点」须 accept 阶段确认不破已冻 `verdict.mjs` 判定树与 `events.json` 冻结形态。
