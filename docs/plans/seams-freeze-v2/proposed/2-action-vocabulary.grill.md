# 动作词汇表（`action vocabulary`）—— 接缝冻结 v2 草稿

> 状态：草稿 / 未冻 / 待 grill 拍板。
>
> 本文只起草开放问题与推荐答案，供后续走 grill-with-docs 人审拍板。落地边界：不冻结、不登记 `CONTEXT.md`、不触碰任何已冻区（`events.schema.json` / `verdict.mjs` / `check.mjs` 一字不改）、不写 `lib`/`bin`。
>
> 配套草稿：`2-action-vocabulary.schema.json`（条目 schema）、`2-action-vocabulary.fixture.json`（click/fill/selectOption/press 4 条合成夹具）。

## 这条接缝是什么

`动作词汇表`（`action vocabulary`，与 `断言词汇表` 对称的一张登记表）打算回答一个问题：Casey 一共认得哪些回放动作、每种动作的参数长什么样、由谁实现、回放时该吐哪些证据、哪条 golden 守它、平台不支持时怎么 fail-closed。

它与已有概念的对称关系（grill 的锚）：

- `断言词汇表` 的 kind 权威枚举活在 `bin/check.mjs` 的 `VOCAB`，`expected-frozen.schema.json` 的 `assertionKind` 只是与之对齐的镜像；裁判 `verdict.mjs` 对 kind 不可知（护栏 #17）。
- 与之对称：`动作词汇表` 的 action 权威枚举已经活在 `events.schema.json#/definitions/event/properties/action/enum`（`click`/`dblclick`/`fill`/`selectOption`/`press`/`nav`/`newpage`）。`verdict.mjs` 同样对 action 不可知——它卷 `三轴` 出四态，绝不按 action 分支。
- 所以护栏 #17 有一条「动作侧」对称表述待确认：新增一种动作只在 `events.schema` 枚举 + 驱动实现 + golden 三处加，裁判不动。

## Q1 定名与定位：是治理层，还是独立 schema？

问题：叫 `动作词汇表` / `Action Vocabulary` 合适吗？它是给已冻 `events.schema` action 枚举定治理规则（不是新数据），还是另立一份独立的回放数据 schema？

推荐答案：

- 命名合适，与 `断言词汇表` 严格对称，且 `docs/design/midscene-adaptation.md` §13 已埋下「待登记」注脚。
- 定位为治理层，不是新回放数据：action 名的唯一事实源仍是已冻 `events.schema` 枚举；`动作词汇表` 是挂在那张枚举上的一份登记表，给每个 action 补上 `paramSchema` 投影、所属 channel、坐标兜底治理、`三轴` 证据产出、golden 覆盖、fail-closed 规则。
- 它确实落成一份独立文件（本草稿 schema 描述的就是这份登记表的形状），但「独立文件」不等于「独立数据 seam」——runner 不加载它、它不进回放序列；它是给人和 `编译` 门读的治理投影。

留给 grill 的真问题（一处真实不对称）：`断言词汇表` 的权威家在代码（`check.mjs`），schema 是镜像；而 action 的权威家在**已冻数据 schema**（`events.schema`），其「代码家」其实是驱动的 `actionSpace`（见 Q4）。所以「哪种动作存在」的单一事实源到底钉在 `events.schema` 枚举，还是钉在驱动能力声明？推荐把闭合名集钉在 `events.schema` 枚举，登记表只是非权威投影，由一条 `Quality Gate` 校验 `entries[].action ⊆ events.schema 枚举`（正如 `expected-frozen` 镜像 `check.mjs`）。

## Q2 每条动作的元数据形态

问题：每种动作登记哪些字段？

推荐答案：每条 = `action` 名 + `paramSchema` + 实现驱动 + `三轴` 证据 + golden，外加坐标兜底治理与 fail-closed 规则。借 Midscene `AbstractInterface` 的 `actionSpace`（每个动作 name/description/`paramSchema`/`call`），但补上 Casey 独有的 `三轴` + golden + 坐标兜底治理：

- `action`：取自已冻枚举（与之对齐，不私自扩）。
- `paramSchema`：本动作所需 `events.json` event 字段的投影，不复制 `events.schema` 全文（单一事实源仍是 `events.schema` 的 `allOf` if/then）——只登记必填/选填字段名 + 定位绑定约束（交互动作须落 `语义定位器` / role+accessibleName / text / fieldLabel / dropdownUnit 之一，禁纯坐标步）。
- 实现驱动：哪个 `channelDriver` 的 `actionSpace` 提供本动作的 `call`（provenance，不进裁定）。
- `三轴` 证据：动作轴（`actionPerformed` 经 `点击身份门` 判 true/ambiguous/false）/ 断言轴（本动作典型喂养的 `断言词汇表` kind，仅交叉引用、不强耦合）/ 取证轴（`watchNetworkForensics` 网络取证 + 生命周期）。
- golden：覆盖本动作的 `Golden Test` 引用；无 golden 不得入表（动作侧棘轮）。

## Q3 平台不支持某动作时如何 fail-closed

问题：目标 channel/驱动的 `actionSpace` 不含某个已编译 events 要求的动作时怎么办？

推荐答案（`fail-safe` 不 `fail-open`，绝不静默换动作）：

- 编译期已知目标 channel 缺该动作 → `编译` 门判 `CASE_DEFECT` 候选（人签前，用例要求了此通道做不到的动作）。
- 回放期才发现驱动能力缺失 → fail-closed 到 `NEEDS_HUMAN`，reason 子类默认 `INDETERMINATE`，落 route:human。
- 硬不变量：绝不用别的动作替换（不准把 `selectOption` 偷换成 `click`+坐标）；能力缺失不构成可自愈 `HARNESS_ERROR`（护栏 #13/#14）——`HARNESS_ERROR` 仅限只读漂移探针正向确证的定位漂移。

留给 grill 的真问题：能力缺失到底归哪个既有 `NEEDS_HUMAN` 子类？现有子类（`SUT_DEFECT_OR_STALE`/`CASE_DEFECT`/`AMBIGUOUS_ACTION`/`AFFORDANCE_ABSENT`/`INDETERMINATE`）里没有「动作不支持」专属项，推荐复用 `INDETERMINATE`（catch-all 的 `fail-safe` 默认落点），不新造子类——保持裁判枚举封闭。

## Q4 与 `channelDriver` 的 `action space` 是什么关系（防两个概念打架）

问题：`动作词汇表` 和 `channelDriver` 声明的 `action space` 会不会重复或冲突？

推荐答案：互补、非竞争，分工镜像 `断言词汇表` 对 `通道剖面`：

- `动作词汇表` = channel 无关的**治理/登记**：闭合的 action 名集（取自已冻枚举）+ 参数形态 + 证据契约 + golden + 坐标兜底规则——「世上有哪些动作、每种必须吐什么」，像 `断言词汇表` 一样 channel 无关。
- `channelDriver.actionSpace` = 每个具体驱动的能力声明（运行期端口适配器）：「这个驱动在这个界面上能执行这些动作」。
- `编译` 门两道校验：events 要求的每个 action ∈ `动作词汇表`（形态合法）**且** ∈ 目标 `channelDriver.actionSpace`（确实可执行）；在词汇表里但不在驱动 `actionSpace` 里 → 走 Q3 的 fail-closed。
- 一句话对照：`动作词汇表` 是字典（定义全集 + 规则），`actionSpace` 是某个说话者会的子集（能力）。`动作词汇表` : `channelDriver` ≈ `断言词汇表` : `通道剖面`。

注：`channelDriver` 本身也是 v2 待登记的新接缝（`midscene-adaptation.md` §8 已标「提案待登记」），二者的边界应在同一轮 grill 一并定，避免一个先冻、另一个被它框死。

## Q5 落地时改已冻 `events.schema`，还是另立治理文档？

问题：把 `动作词汇表` 落地，要不要动已冻 `events.schema`（触 `Test Ratchet`）？

推荐答案：

- P5 范围 = 纯治理登记文档，覆盖现有 7 个动作，零 schema 改动——因为 action 枚举已经冻在 `events.schema`，把治理元数据另立成一份登记表是加性、非破坏的，不触 `Test Ratchet`。
- 登记表以已冻枚举为单一事实源（一条 `Quality Gate` 守 `entries ⊆ 枚举`），自身先不进 `testChecksums`、不登记 `CONTEXT.md`（待本轮 grill 拍板后再登记术语 + 决定是否冻结）。
- 将来真要新增一种动作（如 CEF/mobile 的 `longPress`/`swipe`）才会改 `events.schema` 枚举——那本就应是一次有意的、过 schema-freeze + golden 的棘轮事件，正如新增 `断言词汇表` kind 要过 `check.mjs` + golden。即：常态治理零棘轮，只有动作扩集才显式棘轮。

## 落地边界复述（防越界）

- 本草稿不改 `events.schema.json`、不写 `verdict.mjs`/`check.mjs`、不登记 `CONTEXT.md`、不进 `testChecksums`。
- 裁判零 LLM、`fail-safe` 不 `fail-open`、裁判对 action 不可知（护栏 #17 动作侧对称）三条内核在本接缝下一字不让。
- 拍板后的后续动作（登记 `CONTEXT.md`、补 `Quality Gate` 校验、决定是否纳入冻结）均不在本草稿内，留给 grill 产出。
