# GRILL · zero-shot-guard-net

> 阶段 0 决策树。每条分岔给出裁决与理由；未清空的分岔不得进 plan。
> 本契约是门禁加固（非 kernel），lane=full。基线 `e6e7ea1`。
> 全部裁决由 fable 于 2026-08-03 定，另经前提审（`grok-4.5` high）逼出三条修正，均已落进本文。

## G0 证据基线（本轮实测，非推理）

探针全部只写 scratchpad 副本，真工作树零改动。

| 探针 | 做法 | 实测结果 |
|---|---|---|
| B0 | 跑 `adaptive-module-boundaries.static.golden.mjs` | `5/5 passed`，`EXIT=0` |
| P1 | 副本 `lib/zero-shot/` 放两个流氓模块：`rogue-a.mjs` 704 行、`import { chromium } from 'playwright'` + `import { readFileSync } from 'node:fs'`，与 `rogue-b.mjs` 互相 import 成环 | 边界金牌仍 `5/5 passed`、`EXIT=0`。五张网全部不响 |
| P2 | 同一副本套用自动发现补丁后重跑 | `0 passed, 5 failed`、`EXIT=1`；d1 报未纳入清单、d2 报 704 行、d3 报 `-> playwright` 与 `-> node:fs`、d4 报 `-> playwright`、d5 报 `cycle:rogue-a -> rogue-b -> rogue-a` |
| P3 | 删掉流氓模块、补丁保留、重跑 | `5/5 passed`、`EXIT=0`（补丁对现状零行为差） |
| P4 | 副本给 `page-observer.mjs` 的 `scopesOf` 白名单与夹具 `copyUnsupported` 各加第四键 `probeScope`，跑完整链 | 见下表 |

### P4：第四个 scope 键的逐消费点实测

| 消费点 | 已知键 `containerOnly:true` | 新键 `probeScope:true` |
|---|---|---|
| `revalidateAffordance`（observer `blockReason` 面，通用实现） | `UNSUPPORTED_SCOPE` | `UNSUPPORTED_SCOPE`（自动跟进） |
| `resolveDeterministicAction`（通用判据） | `route:human` / `UNSUPPORTED_SCOPE` | `route:human` / `UNSUPPORTED_SCOPE`（自动跟进） |
| `createActionProposal`（转发 resolver） | `UNSUPPORTED_SCOPE` | `UNSUPPORTED_SCOPE`（自动跟进） |
| `admitZeroShotAction`（逐字列举） | `UNSUPPORTED_SCOPE` | `RESOLUTION_AUTHORITY_INVALID` ← 自身闸失效、被上游遮蔽，仍拒但拒因错位 |
| `verifyStepProgress`（after 面，逐字列举） | `pending` / `PROGRESS_UNSUPPORTED_SCOPE` | `progressed` ← 真 fail-open |

这两行是范围 2 的全部承重结论：

1. `progress-verifier` 是**唯一可达的真 fail-open**。after observation 从不经过 resolver 与 admission，
   缺席判据在第四个 scope 键置真时被判成 `progressed`——一次动作根本没造成的进展被判成了进展，且零告警。
2. `action-admission` 的逐字列举**不是可达的 fail-open**，而是被上游两处通用实现遮蔽的纵深防线：
   加新键后拒付改由 `selectedAuthority` 兜住，拒因从 `UNSUPPORTED_SCOPE` 漂成 `RESOLUTION_AUTHORITY_INVALID`。
   危害是拒因错位（路由人时看错原因）与纵深失效，不是放行。

## G1 `S2_CORE` 自动发现的匹配规则

**事实**：`lib/zero-shot/` 现有 14 个 `.mjs`，与 `adaptive-module-boundaries.static.golden.mjs` 的
`S2_CORE` 14 项逐条相同（实测）。先例 `discoverSetupSupport` 扫 `lib/adaptive-execution/`、
过滤 `setup-` 前缀 + `.mjs` 扩展名，d1 再做**双向相等**断言：发现集必须属于冻结清单，
冻结清单也必须全在发现集里。

分岔甲：平铺 `readdirSync` + 只过滤 `.mjs`，d1 双向相等（对齐先例，去掉前缀条件——zero-shot 家族无命名前缀约定）。
分岔乙：递归遍历子目录，多防一手「未来有人建 `lib/zero-shot/container/foo.mjs` 绕过平铺扫描」。
分岔丙：纯自动发现、删掉 `S2_CORE` 清单——破坏冻结语义，清单本身是「计划内核心文件完整在场」的事实源。

**裁决：甲 + 一条「`lib/zero-shot/` 下不得有子目录」的断言。**

理由：甲逐字对齐 `discoverSetupSupport` 先例，评审面最小；双向相等保住「新模块必须被人登记一次」
这道人类闸（护栏 #14 的 fail-safe 姿态：不认识的东西先红，不默认放行）。P2 实测甲案对流氓模块五网齐响、
P3 实测对现状零行为差。乙的递归今天零收益（目录是平的），而「无子目录」断言把未来的形状变更也变成红——
同样的保护、零递归复杂度，且把「要建子目录」逼成一次显式裁决而不是静默生效。丙直接排除。

## G2 `d3` 纯模块清单：白名单还是黑名单

**事实**：d3 的 `pureFiles` 是硬编码 7 项；`S2_CORE` 14 项减去这 7 项，剩下的恰好是 7 个执行面模块
（`playwright-page-driver` / `page-observer` / `affordance-catalog` / `affordance-authority` /
`action-admission` / `step-executor` / `single-step-runner`）。

分岔甲：`pureFiles` 保持硬编码——新建的纯模块若忘了加进去就逃过 Playwright/IO/网络禁令，
本契约要治的那类盲区换个位置复发。
分岔乙：反转成执行面白名单，`pureFiles = 发现集 − S2_EXECUTION_FACING`，新模块默认按纯模块最严口径受检，
要豁免必须显式登记进执行面白名单。

**裁决：乙。**

理由：「方向只许加严」在这里有唯一正解——默认值必须是严的那一侧。P2 实测中 `rogue-a.mjs` 正是靠乙案
才被 d3 逮到 `-> playwright` 与 `-> node:fs` 两条。甲案下新纯模块的默认是「不受检」，与本契约立意直接冲突。

**接受的残余债务**：执行面白名单本身是硬编码，没有门在盯（没人能证明白名单里的七项确实都该豁免）。
挂 `route:human`，不在本契约治。

## G3 共享 scope 常量放哪个模块

**硬约束（不是偏好，是现役门禁的判据）**：d3 的 `forbiddenFragments` 含 `page-observer`。
所以把常量放进 `page-observer.mjs` 让纯模块 import 会当场触 d3 红——`progress-verifier` 与
`deterministic-resolver` 都在 `pureFiles` 里。这条直接淘汰了「放在既有 observer 里」的选项。

分岔甲：新建纯叶模块 `lib/zero-shot/unsupported-scopes.mjs`，零 import，导出三件——
`UNSUPPORTED_SCOPE_KEYS`（冻结数组、键清单的唯一事实源）、`normalizeUnsupportedScopes`（产出恰含这些键的冻结记录）、
`anyUnsupportedScope`（判据）。
分岔乙：塞进 `step-contract.mjs` 或 `public-observation-redaction.mjs`——语义错位（一个管契约闭集、一个管脱敏），
破坏「一个模块一件事」。
分岔丙：只导出常量、不导出判据——四处仍各写各的 `some`，键清单同步了、判据仍可能分叉。
P4 实测里出错的正是判据，不是键清单，这只治了一半。

**裁决：甲，且必须同时导出判据与归一化函数，不能只导常量。**

理由：d3 的 `forbiddenFragments` 已经把架构方向钉死了——共享物只能住在依赖图的叶子上。
新模块零 import，d5 无环检查天然通过（P2 已证 d5 能逮到真环）。且它与范围 1 有正向依赖：
范围 1 先落，这个新模块自动进五张网，不必手改任何检查逻辑——这是把两个范围放进同一契约的实质理由。

**并集严格度（承重，已实测不是推理）**：`anyUnsupportedScope` 必须取现役三种实现的**并集**，
不能只认已知键——否则合成观察件里出现的未知键会从「今天被 resolver 拦」退成「放行」，那是放松。
口径：记录型 → 任一自有值为真即真（含未知键）；数组型 → 非空即真（保 `deterministic-resolver` 现役行为）；
其余形状 → 与今天一致返回假。

## G4 夹具 `adapter-double.mjs` 怎么同步

**事实**：`copyUnsupported` 是硬白名单三键；它是**测试替身**，不是生产归一化器——
真正的归一化在 `page-observer.mjs` 的 `scopesOf`。P4 探针里必须手工给夹具补第四键，键才透得过去。

分岔甲：夹具 import 共享常量——同步有保证，但让夹具依赖生产件的数据，
会让「夹具能不能独立证明控制流」这件事变模糊。
分岔乙：改成通用透传，把调用方给的每个自有键按 `=== true` 归一，不做键过滤。
夹具回归本分（如实转交调用方给的事实），归一化留给生产 `scopesOf`。
分岔丙：保持白名单、每次加键手改——这就是本契约要杀的病灶本身。

**裁决：乙。**

理由：白名单在夹具里是**净负值**——它不提供任何保护（生产侧 `scopesOf` 才是闸），
只提供一次静默吞键的机会。通用透传让「夹具吞键」这个失败模式从存在变成不存在，比「同步它」更彻底。

**行为等价的正确表述（前提审 M1 修正）**：旧 `copyUnsupported` 恒吐三键，通用透传的输出键集会**变窄**
（`{iframe:true}` 旧吐 `{iframe:true,shadow:false,containerOnly:false}`、新吐 `{iframe:true}`；
`{}` 与 `[]` 旧吐三键全假、新吐 `{}`）。故**不是字节等价**，正确表述是「经生产 `scopesOf` 归一后行为等价」。
草案里「字节等价」的说法已废除，本文不再使用。

**红先行注意**：走乙案时元钉里那条「前置须真的命中该键」的断言（对齐现役写法）必须保留——
它是防止夹具静默吞键的那一钉，不能因为换了实现就删。

## G5 元钉怎么造出「新键漏改」的红场景

**难点**：范围 1 与范围 2 落地后 `UNSUPPORTED_SCOPE_KEYS` 只有三键，遍历三键的元钉在修好之后是绿的、
在修好之前也可能是绿的（三键今天本来就四处同步）。必须让元钉对「未来加第四键但漏改某处」这件事真的红。

分岔甲：元钉遍历 `UNSUPPORTED_SCOPE_KEYS` 本身、不硬编码键名。
今天遍历三键全绿；未来任何人往常量里加键，只要漏接某个消费点，这枚钉当场红。
分岔乙：元钉额外注入一个合成第四键，断言四个消费点全拒。今天就能红（P4 已实证），
但要求生产件承认一个只为测试存在的键——要么在常量里留测试专用键（污染生产闭集），
要么测试绕过常量注入（那就变成倒着裁夹具，踩已冻接缝纪律）。
分岔丙：甲 + 一条静态断言，读四个消费点的源码文本，断言它们均已 import 共享模块且不含任何 scope 键字面量。
与 `entity-ui-wiring` 金牌以 import 结构钉死同刻是同一手法。

**裁决：甲 + 丙。乙只作为红证据的产生手段（一次性探针），不进冻结金牌。**

理由：甲保证「未来加键必红」，丙保证「现在真的收敛了、不是留了个没人用的常量」，两者合起来才是完整的元钉。
乙进金牌会造出一个永久的测试专用键，是给生产闭集开后门；但它作为**红证明的手段**是干净的——
P4 探针已在副本里跑出来，把 transcript 存成 red-proof 即可。

**未知键对照钉的注入路径（前提审 H1 修正，承重）**：并集严格度要求的是 `anyUnsupportedScope` 对
**raw 记录/数组**的严格度。今天未知键在两条路径上行为不同（实测）：经 `observePage` / `scopesOf` 时
`{probeScope:true}` 被白名单丢掉、scopes 全假、resolver 放行；合成观察件直喂 resolver 则拦。
正确实现后 `normalizeUnsupportedScopes` 同样会把未知键剥掉，若对照钉走 `observePage` → normalize → 再查四点，
钉会**错红**——它测的是 observation 形状而不是判据语义。

故写死：未知键对照钉必须**直接调用** `anyUnsupportedScope({ probeScope: true })` 与 `anyUnsupportedScope(['x'])`，
**禁止**经 `normalize` / `observePage` 链注入。四点拒付钉只遍历 `UNSUPPORTED_SCOPE_KEYS` 内的键。

## G6 `playwright-page-driver.mjs` 的生产端字面量要不要一起收

**事实**：driver 直接写 `unsupportedScopes: { iframe, shadow, containerOnly: false }`。
它是**生产者**不是消费者，加新键时它不改只意味着新键恒不置真（与 `containerOnly` 今天的处境相同），
不构成 fail-open。

分岔甲：一并改用常量构造（缺省全假 + 显式覆盖已探测到的键），语义最干净。
分岔乙：不动。driver 是 zero-shot 里唯一碰浏览器的模块，改它就要复跑
`playwright-page-driver-hardening.zero-sut.golden.mjs`。

**裁决：乙（本契约不动 driver）。**

理由：typed-progress 的 GRILL G2 已签「不碰 `playwright-page-driver.mjs` 采集面」。
本契约是门禁加固，没有必须反转那条裁决的理由；而生产端漏键不构成 fail-open（论证同上）。

## G7 `CONTEXT.md` 的 `container-out` 怎么落字

**事实（全部经 grep 与代码路径实证）**：

- 唯一产出点 `lib/agent-search-gate.mjs`，只出自 `resolveAgentSearchTarget`。
- 同文件的 `resolveAgentCardTarget` **从不返回** `container-out`（它的四态是 `unique`/`ambiguous`/`absent`/`failed`）。
  因此 `compile-atoms-agent.mjs`、`compile-atoms-workflow-nav.mjs`、`replay-actions/agent-search.mjs`
  三处的 `cardGate.resolution === 'container-out' ? 'failed' : ...` 是**防御性死代码**。
- 两个真消费点：编译侧非 `unique` 一律进 `blockers` 并 `return`，一个事件都不产（硬阻断、不落轴）；
  回放侧 `ambiguous` 原样透出、其余非 `unique`（含 `container-out`）投影成 `none`。
- 因此 `bin/verdict.mjs` 从不见到这个字面量（它只认 `unique`/`ambiguous`/`none`）。

**结论：`container-out` 是 容器归属闸 的门内解析态，不是动作轴上的可表征值。**
词条必须把「门内 / 轴上」这层区分写清楚，否则会被误读成 `verdict.mjs` 要新增一态。

分岔甲：为容器归属另开词条——会让「容器归属」在注册表里有两个入口，违反同一个词同一件事。
分岔乙：只改 `resolution` 这一行、不新增词条，把门内第六态补进枚举说明。

**裁决：乙。且 `container-out` 明确不进第四列弃用别名。**

理由：`container-out` 不是新概念，它是 容器归属闸 在共享门里的一个判定出口。
补进 `resolution` 的枚举说明里，既还了这笔既存债务，又不动词条数量。
它是**在用的合法字面量**，进黑名单会让 `agent-search-gate.mjs` 的注释、`prd-entity-ui-wiring.json`、
`entity-ui-wiring.searchopen.golden.mjs` 三处当场红（前提审已独立复现该判断）。

**标记约定（逐条核过 `term-lint`）**：术语用反引号；容器归属闸 按现役同行写法不加反引号也不加粗；
全行零繁体字；正文不新增 `|`（`parseRegistry` 按 `|` 切列，多一个就把四列制切坏、词条会静默从白名单消失）；
不加粗任何英文词。

## G8 与 typed-progress GRILL G8「不预留半成品字段」的边界接管

typed-progress 的 GRILL G8 已签一条非目标：不做 `dialogOpened` / `drawerOpened` / `pageOpened` 等
容器/拓扑类 predicate，因为它们需要 `PageObservation` 先有页面内容器作用域，属下一契约（观测包），
**本契约不预留半成品字段**。

本契约是否与之冲突？**不冲突，理由如下（显式接管，不留悬念）**：

1. 本契约**不往 `PageObservation` 加任何字段**。`unsupportedScopes` 是现役已有字段，
   本契约只把「谁来判定它」从四份逐字列举收敛成一个共享判据，键集一个不加、一个不减。
2. 本契约**不往 typed progress predicate 闭集加任何 kind**。`step-contract.mjs` 一字不动。
3. `UNSUPPORTED_SCOPE_KEYS` 不是「预留字段」——它是对**现役三个键**的一次事实源收敛，
   落地当天取值恰为 `['iframe','shadow','containerOnly']`，与今天的行为逐点等价（P3/P4 对照组已实测）。
   它没有为未来的键预留任何未接线的分支：加键这件事将来仍需一次显式人类动作，
   而元钉（G5 甲）恰恰保证那次动作漏接任何消费点时立刻红。
4. 反过来说，本契约让 G8 的边界更稳：将来观测包契约真要引入容器作用域时，
   它必须先把新键登记进 `UNSUPPORTED_SCOPE_KEYS`，元钉会当场逼它把四个消费点全接上——
   这正是 G8「不预留半成品」想要的姿态（要么不加，要加就一次加全），只是把它从人的自觉变成了机器的闸。

结论：G8 继续有效、一字不改；本契约在其非目标之外，且加固了它。

## G9 落地序

范围 2 的新模块 `lib/zero-shot/unsupported-scopes.mjs` 若在范围 1 之前落，它会**逃过五张网**
（正是我们在治的洞）；若范围 1 先落且用了双向相等断言，新模块出现的那一刻 d1 会红，
直到把它登记进 `S2_CORE`。

**裁决：强制落地序 范围 1 → 范围 2 → 范围 3。**
范围 2 的提交必然携带一处边界金牌改动（把新模块登记进 `S2_CORE`），这是设计使然、不是漏，
须写进提交信息。

范围 2 内部再守一层序：**先只改夹具**，跑 5 枚直接依赖夹具的金牌确认零红，再动四个生产件（前提审已实测该序可行）。

## G10 非目标与挂账

- 不动 `lib/zero-shot/playwright-page-driver.mjs`（G6）、不动 `affordance-catalog.mjs`、
  不动 `PageObservation` 的键集、不动 `catalogDigest` 的输入四元组。
- `anyUnsupportedScope` 对畸形形状（`null` / `undefined` / 字符串 / 数字）保持今天的「返回假」，
  **不在本契约改成 fail-closed**。那是新行为、要自带红证据与自己的钉，单独挂账。
- 三处 `container-out` 防御性死代码只挂账不删：删死代码属行为改动、要另走红证据，
  且它今天不造成任何错误结论。
- 不动 `bin/verdict.mjs`、不动三轴、不新增断言 kind：本契约完全在 zero-shot 开发期闭环内，
  产物仍恒 `signed:false` / `replayReady:false`（护栏 #15/#17 不受影响）。
