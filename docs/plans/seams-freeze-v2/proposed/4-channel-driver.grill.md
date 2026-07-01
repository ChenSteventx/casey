# 通道驱动（`channelDriver`）接缝 — grill 草稿

> 状态：**草稿 / 未冻 / 待 grill 拍板收口**。
>
> 边界：本文只起草开放问题与拍板结果，**不写 `lib`/`bin`、不碰已冻区（`events.schema.json` / `verdict.mjs` / `通道剖面` schema 一字不改）**。`channelDriver`（通道驱动，待登记）、`actionSpace`（动作能力集，待登记）落地前一律以反引号或纯文本出现，绝不当已登记术语加粗。
>
> 本轮范围来源：`channelDriver` 原列 `0-INDEX.md`「后置接缝（随 canvas / arbitrary 维度，本轮不起草）」；**承重决策 2.2 已人签把它拉进本轮 co-grill（范围扩到四接缝）**，故本草稿净新补齐 schema+fixture+grill。配套：`4-channel-driver.schema.json`、`4-channel-driver.fixture.json`。
>
> 上游事实源：`docs/design/midscene-adaptation.md` §8（`AbstractInterface` 与 action space，端口适配器提案）、§9（Bridge Mode——transport/CDP 归 `通道剖面`）；`docs/design/autonoma-adaptation.md` §10 注（arbitrary driver 的 action space 是新概念、边界须先 grill）；`CONTEXT.md` 的 `通道剖面`/`channel`/`三轴` 行；`2-action-vocabulary.grill.md` Q4（分工镜像）。

## 这条接缝是什么、挂在哪

`channelDriver`（通道驱动）是**端口适配器式**接缝：声明「某个回放驱动在某 `channel` 上到底能执行哪些动作、每个动作走哪个实现入口、有没有坐标空间、能采哪些取证」。它回答的是「这个说话者会哪些动作」，与 `动作词汇表`（channel 无关的字典：世上有哪些动作 + 每种必须吐什么）互补。

数据流位置与红线：

```
events.json(要求哪些 action) ──编译门两道校验──► ① ∈ 动作词汇表(形态合法) 且 ② ∈ 目标 channelDriver.actionSpace(确实可执行)
                                                    │
                          缺 ② → 走 动作词汇表.failClosed(NEEDS_HUMAN/INDETERMINATE、绝不替换、绝不自愈)
verdict.mjs ──绝不读 channelDriver、对 action 不可知、绝不按 driver 分支(护栏 #17)──►
```

一句话对照（`2-action-vocabulary.grill.md` Q4 已给、本轮落定）：`动作词汇表` 是字典（定义全集 + 规则），`channelDriver.actionSpace` 是某说话者会的子集（能力）。`动作词汇表` : `channelDriver` ≈ `断言词汇表` : `通道剖面`。

## 三条承重决策（本轮已人签）

### 决策 Q1（承重·已签）—— 本轮冻结范围：四接缝一起冻

`channelDriver` 的 schema+fixture 本轮就冻，进 `prd-seams-freeze-v2` 的 `testChecksums`，与 `run-history`/`动作词汇表`/`失败台账` 一起四接缝一次冻（honor 承重决策 2.2「范围扩到四接缝」）。下游可立即对四份合成 fixture 并行开发。理由：形状已由 midscene §8/§9 与已冻 `events.schema` 双向框定，本轮 grill 把 Q2/Q3 边界收口后即具备可冻的完整闭环。

### 决策 Q2（承重·已签）—— 与 `通道剖面` 的边界：正交 + `profileRef` 指针

`channelDriver` = **纯能力声明接缝**（`actionSpace` 动作能力子集 + `call` 实现指针 + `coordinateSpace` + `lifecycleHooks`），与 `通道剖面`（transport / CDP attach / 背景 denylist / 错误信封成功字段等**非凭据配置**）**正交**；`channelDriver` 只带一个 `profileRef` 字符串指针指向 `通道剖面`、**绝不内嵌 profile 字段**。

依据 midscene §9 明文：「bridge / CDP attach 属于 `通道剖面`，不是事件语义」「传输层放进 `通道剖面`，不要塞进每个动作」。两接缝都按 `channel` 域，但一个管**能力**（会做什么动作）、一个管**配置**（怎么连、背景噪声怎么滤、成功字段是什么）。物理分离 = 免一个先冻另一个被框死、免双写漂移。

### 决策 Q3（承重·已签）—— `actionSpace` 动作名域：严格 ⊆ 已冻 `events.schema` 7 枚举

`actionSpace[].action` **严格 ⊆** 已冻 `events.schema` 的 7 动作枚举（`click`/`dblclick`/`fill`/`selectOption`/`press`/`nav`/`newpage`），配一条 `Quality Gate` 校验子集（跟随承重决策 2.1：动作真值源单点钉在 `events.schema`）。`arbitrary`/`cef` 的 `tap`/`scroll`/`longPress` 等 = **未来「改 `events.schema` 枚举 + 驱动 + golden」的显式棘轮事件 + route:human**，本轮不入册。

张力与取舍：`channelDriver` 立意本是 `arbitrary`/`cef`（midscene §8），而本轮 web 冻结用 7 枚举收紧，等于让 `channelDriver` 本轮先长成 web 形。这是刻意的——单点真值源（`events.schema`）不破、「常态治理零棘轮，只有动作扩集才显式棘轮」一致（`2-action-vocabulary.grill.md` Q5）；`arbitrary`/`cef` 扩集是后续 route:human 批次，schema 已用 `coordinateSpace` 可空为视觉通道留形（web 恒 null）。

## 字段形态（schema 草稿要点）

- 顶层 `= { schemaVersion, draft, actionSource, drivers[] }`，与 `动作词汇表` 的 `{ schemaVersion, draft, source, entries[] }` 严格对称（两接缝紧耦合，形状同构便于对读）。
- `actionSource`（共享）：单一事实源指针 → `events.schema` action 枚举（决策 2.1/Q3）。
- `drivers[].`：`channel` / `driverId`（与 `动作词汇表` `driver.channelDriver` 同值互链）/ `interfaceType`(可空) / `profileRef`(决策 Q2 指针，可空) / `actionSpace[]` / `coordinateSpace`(web 恒 null) / `observationCapabilities`(可选，取证输入非裁定)。
- `actionSpace[].` = `{ action(⊆7枚举) , call(provenance) , lifecycleHooks?(borrow midscene beforeInvokeAction/afterInvokeAction → 三轴 采集点) }`。
- 凭据红线（护栏 #7）：全程 `additionalProperties:false`；`profileRef` 是**指针**不是内嵌配置故不携 denylist/envelope/cookie 值；`driverId`/`call` 是 provenance 字符串。golden 深扫 `findForbiddenKey`。

## 留给 golden 的跨字段校验（schema 表达不了、accept 落 golden 时补）

- (a) `drivers[].actionSpace[].action` 逐一 ∈ 已冻 `events.schema` 7 枚举（决策 2.1/Q3 子集不变量）。
- (b) `channel==='web'` ⟹ `coordinateSpace===null`（web 禁纯坐标步、以 语义定位器 + 点击身份门 为准）。
- (c) `channelDriver.drivers[].driverId` 与 `action-vocabulary.entries[].driver.channelDriver` 交叉引用一致（两接缝互链不漂移）。
- (d) 深扫凭据/PII 禁字段名（复用 `seams-freeze.golden.mjs` 的 `findForbiddenKey`）。

## 不在本草稿（deferred / route:human）

- `arbitrary`/`cef` 驱动的真能力（`tap`/`scroll`/`longPress`/`coordinateSpace` 非 null）与其触发的 `events.schema` 枚举棘轮。
- 驱动的 `call` 真实现、`lifecycleHooks` 真接线（`lib`/`bin`）。
- `通道剖面` 自身 schema 的任何改动（本接缝只加 `profileRef` 指针、不动 `通道剖面`）。
- 登记 `CONTEXT.md`（`channelDriver`/`actionSpace`）—— 须 grill 拍板后随合并 `GRILL.md` 一并做。
