# admission-policy-facets：准入策略「三面拆分」的表达修复

契约 lane=full，worktree 隔离。**只修表达，不改判定**：现役行为逐字节等价是硬底线。

## 1 问题（已实证，不重新发现）

`lib/entity-semantic-lock-preflight.mjs:43` 的 `SIDE_EFFECT_POLICY` 只登记 9 个原子，并且把三件本质不同的事压成一个 `effect` 字段：

1. **结构性变更**——这个原子改不改业务实体；
2. **身份钉定**——它要不要钉住目标业务对象的身份（破坏性/定向操作必须确认「我删的正是我建的那个」）；
3. **外部副作用**——它会不会真向被测系统外部发出动作、在对方留痕、不可撤销（例如真给被测智能体发一条消息）。

未登记原子一律默认 `mutation + subject`。后果：`chat.sendAndWait`（不改业务实体、无身份可钉、**有**外部副作用）与 `agent.searchOpen`（不改业务实体、**身份敏感读取**、无外部副作用）落进同一档；照这张表签绑定，签出来的是语义上虚构的绑定。

人签冻结的权威源是 `tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json`（由 `loop/prd-teachin-admission-side-effect-policy.json` 的 `testChecksums` 冻结，ADR-0004 面）；`SIDE_EFFECT_POLICY` 是它在生产侧的只读镜像。

## 2 建模：三面登记 + 第四面外联 + 纯函数派生投影

（本节形状经 `gpt-5.6-sol` max 异构复核后改过两处，见 §2.3；原始意见 `consult-sol-r1.log`。）

策略表的事实源从「一个 `effect` 字符串」改成三个正交面（准入三面策略），第四面由既有纯守卫外联：

| 面 | 字段 | 取值 | 判什么 | 事实源 |
| --- | --- | --- | --- | --- |
| 结构性变更 | `entityChange` | `none` / `entity` / `relation` | 改不改业务实体、改的是单体还是关系 | 策略表 |
| 身份钉定角色 | `identityBindingRoles` | `[]` / `['subject']` / `['source','target']` | 冻结实体绑定必须覆盖哪些角色 | 策略表 |
| 非实体持久副作用 | `nonEntityEffect` | `none` / `persistent` / `unknown` | 会不会在业务对象模型之外留下持久痕迹（真给被测智能体发一条消息） | 策略表 |
| 目标身份连续性 | `targetContinuity` | `none` / `same-platform-id` | 动作时刻要不要回读证明「删的正是建的那个」 | `requiresTargetContinuityRef`（**不在策略表重复登记**） |

派生投影（旧字段的唯一来源，不再是事实源）：

```
unboundReadAdmissible(f) = f.entityChange === 'none' && f.identityBindingRoles.length === 0 && f.nonEntityEffect === 'none'
admissionClass(f)        = unboundReadAdmissible(f) ? 'unbound-read'
                         : f.identityBindingRoles.length > 0 ? 'entity-lock'
                         : 'unsupported'
effect(f)                = f.entityChange === 'relation' ? 'relation' : (unboundReadAdmissible(f) ? 'read' : 'mutation')
requiredRoles(f)         = f.identityBindingRoles
```

未登记原子的默认面 = `{ entityChange:'entity', identityBindingRoles:['subject'], nonEntityEffect:'unknown' }`，派生回 `mutation + ['subject']`——与今天逐字节相同，且拆细后没有任何原子掉进更松的档（三面里任意一面不清白都进不了零绑定只读通道）。

遗留 event 投影（`legacyEventProjectionPolicyForAtom`）的未登记默认继续是 `requiredRoles: null` = 「三角色任一且恰一个」，与主策略的精确 `['subject']` **不是同一件事**，保留独立 adapter，不合并。

### 2.1 两个目标原子的如实描述

| 原子 | `entityChange` | `identityBindingRoles` | `nonEntityEffect` | `targetContinuity` | 派生档 |
| --- | --- | --- | --- | --- | --- |
| `chat.sendAndWait` | `none` | `['subject']` | `persistent` | `none` | `entity-lock`，`mutation + ['subject']`——与今天的未登记默认逐字节相同 |
| `agent.searchOpen` | `none` | `['subject']` | `none` | `none` | `entity-lock`，`mutation + ['subject']`——与今天的未登记默认逐字节相同 |

#### 2.1.1 `chat.sendAndWait` 由 `unsupported` 改判 `entity-lock`（2026-07-31，Steven 裁）

本行原写 `none` / `[]` / `persistent` → `unsupported`。**2026-07-31 由 Steven 在决策岔口改判**，
现行值是上表的 `none` / `['subject']` / `persistent` → `entity-lock`。

裁定原话：选「甲：登记为可锁」，被测智能体即 subject，落 `entity-lock` 档、可由签名满足；
明确不取「乙：守住 `unsupported`」，因为那会让 `tc_chiefcomplaint_smoke` 永久不可跑、tier-2 流式面归零。

改判的机械依据（实测，不是推断）：

1. 甲案三面的派生投影 = `{ admissionClass: 'entity-lock', effect: 'mutation', requiredRoles: ['subject'] }`，
   与「未登记保守默认」的派生投影**逐字节相同**——主策略通道零行为位移。
2. 唯一位移在遗留 event 投影：未登记时 `requiredRoles: null`（三角色任一且恰一个），
   登记后收紧成「恰 `subject`」。方向是收紧。
3. 若照原案（乙）签，拒付理由会从「缺锁」变成 `REPLAY_EVENT_POLICY_INVALID`，
   没有任何锁文件能满足——`policyForAtom` 对 `unsupported` 返 `null`，四个消费点的 `!policy` 分支各自判死。

甲案**不**等于开了「有非实体持久副作用」的授权档：`nonEntityEffect: 'persistent'` 如实记录
「这枚原子真会给被测智能体发消息、在对方会话里留痕」这件事实，但承载它的是既有 `entity-lock` 档的
一条 `subject` 绑定（钉住「被测智能体是谁」），**不承载**「允许执行几次」。§2.3 末尾那条缺口仍然挂账。

落地契约：`chiefcomplaint-sendandwait-admission`（见 `docs/plans/chiefcomplaint-sendandwait-admission/`）。

### 2.2 `unsupported` 档为什么必须显式存在

原设计打算让 `chat.sendAndWait` 派生成 `mutation + []`，以为「非只读 + 空角色集」在绑定检查里不可满足。**实测证伪**（`scratchpad/probe-empty-roles2.mjs`，副本里插一行假原子）：

```
铸权成功（零绑定冻结件通过校验）= true
checkReplayEntityAdmission = {"ok":true,"allowBrowserLaunch":true,"authorityKind":"frozen-entity-locks-internal-policy"}
```

`inspectBindings([])` 返回合法空集、`expectedRoles` 遇 `requiredRoles: []` 精确匹配零绑定成功（`entity-semantic-lock-preflight.mjs:626`、`:884`），于是零绑定的已签冻结件**真放行、真启动浏览器**。所以 `mutation + []` 是 fail-open，不是 fail-closed。

结论：`admissionClass === 'unsupported'` 的原子，`policyForAtom` 一律返 `null`，四个消费点（副作用分类 / 逐操作绑定 / 草稿期 / 回放准入）各自的既有 `!policy` 分支把它判死。今天没有任何原子落进这一档（本契约交付时已登记 9 个 + 未登记默认都不落；`chiefcomplaint-sendandwait-admission`
按甲案加登记第 10 枚 `chat.sendAndWait` 后仍然一枚都不落），所以是零行为变更的纯扩展。

### 2.3 本契约不做的登记

**只交付表达能力，不登记这两个原子**：往人签冻结策略表里加行是策略判断，属 ADR-0004 人签事件，`signedBy: PENDING_STEVEN`，实现者不签。且登记本身会改行为——`agent.searchOpen` 登记后遗留 event 投影会从「三角色任一」收紧成「恰 subject」，要人签。

**待签内容的现状（2026-07-31 更新）**：`chat.sendAndWait` 那一笔已被 Steven 在决策岔口改判甲案（§2.1.1），
由后继契约 `chiefcomplaint-sendandwait-admission` 备好请签包，`signedBy` 仍是 `PENDING_STEVEN`——
**待签的是甲案（`none` / `['subject']` / `persistent` → `entity-lock`），不是本节原写的 `unsupported`**。
`agent.searchOpen` 那一笔照旧不登记、照旧待决。

「有非实体持久副作用但无身份可钉」的合法授权档（谁签字承认「本次跑会真发消息」、绑哪段事件字节、允许执行几次）本契约**不开**，挂人签待决。

## 3 验收（红先行 + 变异验证）

金牌 `tests/_golden/admission-policy-facets.zero-sut.golden.mjs`，四段，纯函数/静态，零 SUT、零网络、零子进程：

- `equivalence`——672 条行为语料（`tests/_golden/fixtures/admission-policy-facets/corpus.mjs`）跑当前模块，逐条与改写前采的基线 `behavior-baseline.json` 逐字节比对。**这是「现役行为零改变」的判据**：覆盖 `containsMutation`（flow/events）、`requiredFlowEntityBindings`、`requiredEventEntityBindings`（legacy 投影默认）、`buildEntityBindingsDraft`、`checkReplayEntityAdmission` 只读通道（`allowedActions` × 未绑定信封 URL）、`checkCompileIdentityAdmission` execute 只读短路；12 原子（已登记 9 + 未知 + 两个目标原子）× 7 角色集。
- `facets`——三件事被**分开**表达的判据：三个面各自可独立取值；第四面（目标身份连续性）由纯守卫外联且与身份钉定角色可分离（`workflow.create` 要 subject 绑定但不要连续性；`agent.delete` 要连续性但不在策略表）；两个目标原子的面可如实写出；`effect` 是有损投影（两条语义不同的面行塌成同一个 `effect` 字符串）；任意一面不清白都进不了零绑定只读通道；**没有任何面组合能派生出 `mutation + []` 这种 fail-open 行**。
- `authority`——三面派生出的 `{effect, requiredRoles}` 与人签冻结权威源逐字节相等（今天不存在的镜像≡权威校验，本次补上），且生产镜像不得比人签权威多登记原子。
- `wiring`——静态证明旧表是从三面派生的，仓里不存在第二张手写 `effect` 表（防「换个字段名、事实源还是老的」）。

红先行：实现前 `facets`/`authority`/`wiring` 三段必红（导出面不存在），`equivalence` 段必绿（还没改，当然等价）。实现后四段全绿。

变异验证：三个面各破坏一次（改某原子的 `entityChange`、清空 `identityBindingRoles`、把 `nonEntityEffect` 置 `none`），再加一条把 `unsupported` 档退回 `mutation + []`，对应断言必须真红；在临时副本里做，做完按 sha256 校验还原。

换签面（`signedBy: PENDING_STEVEN`，实现者不签）：人签冻结权威源 `entity-admission-policy.frozen.json` 升 `schemaVersion:2` 带三面 + `allowedActions` + `unknownFacets`，`effect`/`requiredRoles` 保留为派生兼容字段；amend 记进 `loop/prd-teachin-admission-side-effect-policy.json` 的 `checksumAmendments`，原件 gzip 存档回验 sha。只改生产镜像不改权威源的风险更高——会让**未签**的第三面决定要不要走零绑定短路，权威源与实际放行规则永久分裂。

邻接（护栏 #19）：`grep -rl` 列出全部消费方金牌逐个复跑记退出码，改前改后对比红分布；HEAD 既有红如实挂账不修。

## 3.1 实际证据（跑出来的，不是计划）

| 证据 | 结果 | 落点 |
| --- | --- | --- |
| 红先行（首版金牌 vs 未改实现） | 3 过 / 20 红 | 本节下方「红分布」 |
| 红重钉（改后金牌 vs HEAD 版模块，含两处改过的断言） | 3 过 / 20 红，还原 sha 一致 | `evidence/red-repin.txt` |
| 变异验证（三面各一 + unsupported 退化 + 第四面 + 默认放松 + 查表出口） | 7/7 真红，逐条命中对应断言，还原 sha 一致 | `evidence/mutation-verify.txt` |
| 「非只读 + 空必需角色集」是不是挡板 | 否，实测 fail-open：零绑定已签冻结件 `ok:true` + 准许启动浏览器 | `evidence/probe-empty-roles.txt` |
| 行为等价 | 672 条语料逐条逐字节等价 | 金牌 `equivalence` 段 |
| 邻接消费方（护栏 #19） | 24 项改前改后退出码零漂移；HEAD 既有 5 红如实挂账 | `evidence/consumers-before-after.txt` |
| 被冻结的消费金牌（换签后未改一字） | 17/17 exit 0 | `teachin-admission-side-effect-policy.zero-sut.golden.mjs` |
| 全仓冻结面漂移扫 | 零 checksum 失配（15 个 FILE_MISSING 全是本工作树没有的 `cases/`、`runs/` 产物） | `ratchet verify` |
| 门禁 | GREEN 4/4（`passes` 由 gate 写） | `loop/prd-admission-policy-facets.json` |
| 链路自检 | `selftest --tier1` 全绿 | — |

红分布（红先行首轮）：`equivalence` 3 条全绿（那时还没改实现，本就该等价）；`facets` 9 条、`authority` 4 条、`wiring` 5 条全红——共 20 红。

## 4 边界（本契约不做）

- 不碰 `cases/` 下任何用例件、不签任何实体绑定、不跑真机、不碰 `.auth/` 与 `site.json`；
- 不往人签冻结策略表里加原子（含上面两个），不自签任何换签；
- 不新开「有外部副作用」的准入档；
- 不修既有陈旧红（HEAD 即红的 5 项，逐项定性见 `evidence/consumers-before-after.txt`）；
- 不跑异构代码评审（contract 停在 `loop` done）：按纪律评审要对着不可变快照，而本轮受命不提交 git，故 `review` 阶段留给下一步；本轮已用 `gpt-5.6-sol` max 做过**定稿前设计咨询**并采纳其三条 High（第四面外联 / `unsupported` 档 / 权威源一并 amend），那不等于对最终 diff 的评审。

## 5 同一冻结件上的另一笔待签（协调用）

`prd-entity-workflow-source-readback` 早已挂了一笔针对**同一个**冻结策略件的待签请求：把 `workflow.create/open` 的角色由 `[subject]` 改到 `[source]`，以解「观察门要 source、准入门要 subject，happy path 不存在」的死锁。两笔互不冲突（本笔逐字节保留全部角色值），但签的时候要一起看：签了 `[source]` 那笔，`identityBindingRoles` 与派生的 `requiredRoles` 必须同步改，且本契约的 `authority` 段断言会立刻把不同步逮红。三面表达反而让那笔更好签——「读回武装点要钉谁的身份」现在是独立一面，不必再借 `effect` 表达。
