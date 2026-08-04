# plan · p9-replay-authority-split（回放授权票据）

> lane=full。后继于 `p9-created-workflow-cleanup-continuity-v3`，只补一件事：
> **回放面缺一份运行期授权**。v3 结构授权边的字节形状一字不动。
> 缘起裁决：Steven 2026-08-04「另立回放专用授权件，最小权限分离」；
> fable 2026-08-04 就八个分岔逐条终裁（记在 `GRILL.md` §六）。

## 1. 业务目标

P9 三条变更型用例（`tc_catalog_wf_crud` / `tc_wf_publish_states` / `tc_wf_history_version`）
上真机做「本轮建 → 本轮按同一平台标识删 → 稳定缺席」。删除这个动作的执行许可，
现在挂在一份**签一次就永久有效**的结构授权边上。本契约把执行许可从结构闭包里分出来，
落成一份**一批一签、一次性核销、带失效期**的回放授权票据。

完成后成立的事实：**没有当批已签票据，正式回放的删除链在浏览器启动前就跑不起来**——
且这条闸在纯层，不在命令行外壳，旁路调用方绕不过去。

## 2. 与 v3 契约的关系（务必先读这节）

派活最初的口径是「同一份 v3 结构授权件同时覆盖 compile 面与 Tier2 回放面」。
**该前提已按实测校正**（复核方式与证据见 `GRILL.md` §〇，fable 已亲手 grep 复核采信）：

- compile 面从头到尾不读 `created-workflow-authority.frozen.json`；
  它的准入件是 `entity-pre-execution-authority`（`bin/compile.mjs:168-176`）。
- 结构授权边只在回放面被消费（`bin/replay.mjs:179`）。

所以本契约**不是**把一份件劈两半，而是：

| 面 | 现役授权件 | 生命周期 |
|---|---|---|
| compile | `execute-authority.json`（`compile-execute`） | 每次编译一签 |
| replay 结构闭包 | `created-workflow-authority.frozen.json`（`created-workflow-continuity`） | 随五源字节，重编译才重签 |
| replay 运行期 | **本契约新增**：回放授权票据 | 每批一签，一次性 |

由此推出两条硬边界：

- `docs/plans/p9-created-workflow-cleanup-continuity-v3/plan.md` **一字不动**——
  它 §12 那句「只授权本次 compile，不授权正式 replay」说的本来就是 compile-execute 件，
  校正前提后措辞本来就对（fable 裁 Q6）。
- 结构授权边的 `DRAFT_KEYS` / `AUTHORITY_KEYS` / `authorizedFor` 字面量
  （`lib/entity-created-workflow-continuity-v3.mjs:21-27,350-353,364-371`）**一格不改**。
  一改，八枚 v3 金牌夹具全部重造、已签结构件全部作废。本契约走**纯加法**。

## 3. 票据模型

### 3.1 签什么

一份票据 = **一个批次的一次**回放许可。字段闭包：

```
schemaVersion / artifactKind: 'created-workflow-replay-grant'
authorizedFor: 'created-workflow-replay'     ← 与结构件字面量互斥，互不可冒充
batchId / audience / notAfter / grantNonce
cases: [ { caseId, structuralAuthoritySha256, structuralSignature } ]
signed / signerId / signedAt / signature
```

**不进票据**（明列，防日后加回）：`ownershipEdges`、五源摘要、`platformId`、`batchToken`、
`maxRuns`。逐项理由**各不相同，不合并叙述**（pi 残差：原措辞把四项笼统归给「结构闭包已签死」，
对后两项不成立）：

- `ownershipEdges` 与五源摘要——结构闭包已由结构件签死，复述会造第二事实源；
- `platformId`——运行期才产生，签票时根本不存在，签进去就是 v3 明令禁止的固定 ID；
- `batchToken`——**运行期由机器现生成**（`lib/selftest-tier2-collect.mjs:378-379`），
  签票在跑批之前，签不出来；它与票据的绑定发生在 §3.3 的批会话开启那一刻；
- `maxRuns`——评审 H2 逮出的双轨：「一次」只由 `grantNonce` 的台账占用表达，
  **留一个计数字段就是将来被理解成「可以大于 1」的口子**，故删字段而非钉死它等于 1。

`grantNonce` 由机器在 draft 阶段生成（M4），取 `randomBytes(16).toString('hex')`
的 crypto 级熵，形状与用法照 `ensureWinProbeChallenge`
（`lib/selftest-tier2-manifest.mjs:257-259`）；人签的是整份草案，不手填 nonce。

`audience` 必须**逐字等于**该票据 `cases` 里每一份结构件的 `audience`（M3）。
production 票配 test 结构件、或反向，一律具名拒——否则「票是生产、边是测试」
这条缝会从两个门的夹角里漏过去（结构件受众门在 `bin/replay.mjs:365-374`，
它比的是结构件与凭据上下文，管不到票据）。

签名是内容摘要（与现役 `digestValue` 同族），**防的是误用与拼错件，不是抗恶意写盘伪造**；
人签边界仍然是命令行 freeze 加流程，文书不得暗示更强的密码学性质（L2）。

### 3.2 件间成链

票据逐例双绑结构件：`structuralAuthoritySha256`（字节哈希）与
`structuralSignature`（结构件自带的 `signature` 字段，即「去掉签名的整件」的自哈希）。
两个值一起比，能把「结构真变了」和「结构没变、只是换人重签」分开报，拒因具名度更高；
人核对时两件并排、两眼可核，不用跑工具。跨案冒用由 `caseId` 加双摘要自动堵死；
**结构件一旦重签，链即断、旧票自动失效**——这条正是评审点名要确认的「结构件重签后旧票是否自动失效」。

### 3.3 消费语义：批会话协议（评审 C-new 重写）

硬冲突一：票据签在跑之前，`batchToken` 生在跑之中（`lib/selftest-tier2-collect.mjs:378-379`）。
取一次性票据方案，不取「人给令牌」，保住「不可预测、不可复用」的现役纪律。

硬冲突二（评审 C-new 逮出，**本节因此重写**）：Tier2 的三条变更型成员是**分进程连跑**
——实测 `lib/selftest-tier2-collect.mjs:186` 在成员循环（`:405` 调用点）内逐个
`spawnSync` 一个 `casey run`，而全批共用同一个 `batchToken`（`:378-379`）。
上一稿写的「launch 前占用、命中该 `grantNonce` 即拒」按字面实现，
**成员①占用成功后成员②③必被判已核销，整个变更型批跑不通**。
反过来若实现者私自加一条「同 `batchToken` 可以再 launch」，
「一次」就退化成「锁在第一个 `batchToken` 上可无限 launch」。两头都不行，必须有协议。

**改定：批会话协议。** 台账根下**每 `grantNonce` 一个目录**，两级标记：

1. **开会话**（恰一次）：首个成员在 launch 前以 `wx` 标志（`O_EXCL` 原子独占创建）
   落 `<nonce>/session.json`，内容 `{ batchToken, occupiedAt }`。
   创建成功当且仅当一次——**这就是 `grantNonce → batchToken` 的绑定动作**，
   不需要额外的写者仲裁。
2. **逐成员核销**：每个成员在 launch 前依次核三条，全过才放行：
   - `session.json` 在场，且其 `batchToken` 与本进程的**逐字同值**
     （异值 = 重放或崩溃后换批重跑 → `REPLAY_GRANT_BATCH_SESSION_MISMATCH`）；
   - 自己的 `caseId` 在票据授权成员集内（否则 `REPLAY_GRANT_CASE_NOT_AUTHORIZED`）；
   - 以 `wx` 落 `<nonce>/<caseId>.consumed.json`，已在即该成员重跑
     （`REPLAY_GRANT_MEMBER_ALREADY_CONSUMED`）。

于是「一次」的准确含义是：**一张票 = 一个批会话 = 每个授权成员各恰一次 launch**。
批内多进程共用一票是协议内的正常路径（`R16` 是它的正控），不是例外口子。

**崩溃与失败后不得默认复用。** 采集层崩溃重跑会生成新的 `batchToken`
（`:378-379` 每次调用现生成），撞上已存在的 `session.json` 即异值拒；
重试走人签新票路径（另签一张，Steven 签）。工装没有任何「判断上次其实没跑成、
可以放回去」的权力——与 `chat.sendAndWait` 判读 `INDETERMINATE` 时立的是同一条纪律。

**落盘失败一律 `allowLaunch:false`**，绝不「先跑着、回头补记」（`R13` 钉这条）。

### 3.4 台账协议（评审 M2 + M-new1/M-new2）

**唯一形状**（上一稿出现过 `entries[]` 数组、`.jsonl` 追加、临时文件 `rename` 三套说法，
评审 M-new1 判为形状双轨，现收成一套）：

```
<ledgerRoot>/<grantNonce>/session.json           ← wx 创建，{ batchToken, occupiedAt }
<ledgerRoot>/<grantNonce>/<caseId>.consumed.json ← wx 创建，一成员一件
```

- **不用** `entries[]` 数组文件、**不用** `.jsonl` 追加、**不用** 临时文件加 `rename` 舞步、
  **不注入** `appendLine` 写者；
- **原子原语就是 `wx`**（`O_EXCL`）：同一文件系统上创建即独占，胜者唯一。
  这正面解决评审 M-new2 指出的「读后写 + `rename` 不是 check-and-set，
  两个进程同时读到空台账时后者会盖掉前者」——`wx` 根本不给「先读后写」留窗口；
- **判定与落盘分离**：`judgeReplayGrantBatchSession` 是纯函数，**吃读快照**
  （`sessionSnapshot` 加 `consumedCaseIds`），不碰文件系统；真正的原子性由命令行面的
  `wx` 保证，并由 `R18` 用**两个并发进程抢同一标记**实测（操作系统保证单胜者）；
- **落点** `runs/` 下，与被签件分离——写进票据本体会改签名字节、连带打翻清单哈希；
- **单一台账根**：直接 `replay` 与 Tier2 共用同一台账根，禁止双路径语义。


### 3.5 时钟（评审 H1）

`notAfter` 由 Steven 写进签名字节，**机器绝不代算有效期**（fable 裁 Q4；
跑单只给建议值，如签署时点加 4 小时）。判定用什么钟则是另一件事，一并钉死：

- **生产路径 `now` 一律取主机墙钟**；
- **命令行面禁止任何调用方喂时**——没有 `--now` 这类旗标，环境变量也不认；
- `now` 注入只保留在**纯 judge 函数签名**里，供金牌构造确定性时点。

### 3.6 名实：批级票据，不是 run-scoped（评审 H3）

派活与初稿口径像 run-scoped，实际模型是**批级一份票据**：`batchId` 在签署时可任意，
与运行期现生成的 `batchToken` 没有签前预绑定。这不是错——批级正好对齐 D 段
「这一批、这三条、跑一次」的人类决策粒度——但**文书一律改口「批级一次性票据」**，
不再写 run-scoped；「run 绑定」明确定义为**核销后的审计映射**
（台账里那条 `grantNonce → batchToken`），不是签前的能力约束。

**一场五成员同批用一份票据。** 人在 D 段做的是一个决定；
`--authorize-mutation` 已经是批级给三次。一个决定对一份签名。

## 4. 落点与接线

| 件 | 动作 |
|---|---|
| `lib/entity-created-workflow-replay-grant.mjs` | 新建：起草 / 冻结 / 读回（含过期与受众一致性）/ launch 前占用 / 核销判定 / 采集面拒跑筛 |
| `lib/entity-created-workflow-continuity-v3.mjs` | `createCreatedWorkflowReplayContinuityController` 增必填 `grant` handle |
| `bin/entity-authority.mjs` | 加 `replay-grant-draft` / `replay-grant-freeze` 两个 verb |
| `bin/replay.mjs` | 加 `--replay-grant` 与 `--replay-grant-ledger`；有 `--created-workflow-authority` 时必填；**占用发生在 launch 之前** |
| `lib/replay/cli-input.mjs` | 解析 `--replay-grant` / `--replay-grant-ledger` |
| `bin/casey.mjs` | `run` 面透传票据路径 |
| `lib/selftest-tier2-manifest.mjs` | 清单顶层 `replayGrantPath` + 严格消费 |
| `lib/selftest-tier2-collect.mjs` | 读票据、传给 `casey run`；**必须调拒跑筛并落拒跑回执**；不写台账（见下） |

五条接线纪律：

- **授权闸下沉纯层**（fable 裁 Q2）：票据校验的唯一事实源在
  `createCreatedWorkflowReplayContinuityController`，命令行只负责把字节读进来。
  只在 `bin/replay.mjs` 拦是 CLI 单点假门，未来任何旁路调用方都能绕开。
- **台账校验与占用和 grant handle 同级必填**（评审 C2，本轮改稿重点）：
  初稿把台账写在 `lib/selftest-tier2-collect.mjs` 的编排层，**「一次」就只是 Tier2 礼仪、
  不是授权属性**——任何人拿一张已签未过期的票直接跑 `casey run` 或 `bin/replay.mjs`，
  在 `notAfter` 窗口内可以无限重放。改定：**台账路径与字节随 grant 一起进浏览器前门**，
  由同一个纯层函数在 launch 前完成 check-and-set。
- **采集层的拒跑筛是强制接线，不是可选礼仪**（评审 M-new3，修正上一稿「采集层不做闸」
  这句过头的表述）：`lib/selftest-tier2-collect.mjs` **必须**在 spawn 之前调用
  `screenTier2ReplayGrant`，无有效票据时**不启动子进程并落拒跑回执**——
  这与「执法闸在 `bin/replay.mjs` 浏览器前门」**两者都做，不是二选一**。
  理由：只钉纯函数会留下「筛是绿的、采集照样 spawn，只靠 replay 拒」的缝，
  那样三条变更型会各起一次子进程才被拒，既浪费又让拒跑回执缺位。
  采集层唯一不做的事是**写台账**——占用只在浏览器前门发生。
- **单一台账根**：直接 `replay` 与 Tier2 共用同一台账根，禁止双路径语义。
- **新门排在既有 batch-token 门之后**（`bin/replay.mjs:70-73`），否则拒因会被旧门吃掉、
  R2 那条钉测不出真拦。**两个旗标（`--replay-grant` 与 `--replay-grant-ledger`）
  在有结构件时同为必填、不可缺其一**（评审 H-new：金牌 spawn 面必须恒传 ledger，
  否则 R1/R9 会先撞「缺旗标 exit 64」，钉不到目标拒因）。

### 4.1 兼容豁免面（评审 L1，显式、有界、可枚举）

现役条件是「**仅当** `--created-workflow-authority` 在场时才必填 `--replay-grant`」
（判定点 `bin/casey.mjs:109-110` 的 `v3Requested`、`bin/replay.mjs:144`）。
这条豁免必须写死成有界的三句，不留解释空间：

1. 豁免只覆盖**没有 v3 结构授权边的用例**（v1/v2 旧件、纯只读用例）；
2. **三条变更型用例不在豁免面内**——它们的 v3 三件由清单校验器硬要求成组在场
   （`lib/selftest-tier2-manifest.mjs:111-117`），结构件在场即触发票据必填，
   **不存在「变更型清理链在无结构件路径下跑掉」这条缝**；
3. 豁免面**不随时间自动扩张**：新增任何变更型用例必须同时接 v3 三件与票据，
   不得以「暂无结构件」为由走豁免。

清单落点取顶层 `replayGrantPath`（fable 裁 Q3），形状照 `winProbeResultPath`
（`lib/selftest-tier2-manifest.mjs:71-74` 路径闭合 + `:285-323` 严格消费）。
**不做成成员第四件**：票据是一批一份、不是一例一份，塞进 per-case 的 `artifacts` 表语义就错。
由此 `CREATED_WORKFLOW_ARTIFACT_NAMES`（`:28-32`）与
`p9-tier2-selftest` 的 T9a 断言文字**零改**（fable 已确认）。

## 5. 最小 ATDD（红先行，已跑出真红）

**已拆二**（实测触到 600 行阈值，拆法照 fable 既定口径）：

| 金牌 | 覆盖面 | 行数 |
|---|---|---|
| `tests/_golden/p9-replay-authority-split.cli-session.zero-sut.golden.mjs` | 命令行与签署边界 + 批会话协议（全 spawn 真二进制） | 305 |
| `tests/_golden/p9-replay-authority-split.pure-suite.zero-sut.golden.mjs` | 纯层与采集面（零子进程） | 218 |
| `tests/_golden/support/p9-replay-grant-fixtures.mjs` | 两枚共用夹具（不含断言） | 131 |

**二十一条用例**（表内编号 R1–R19 共 19 项，其中 R3 拆 a/b、R11 拆 R11/R11b，故实跑 21 条）：

| # | 钉什么 | 面 | 来源 |
|---|---|---|---|
| R1 | 结构件当 `--replay-grant` 传 → 具名拒、哨兵证明未启动浏览器 | spawn | 初稿 |
| R2 | 有结构件无票据 → exit 64 具名 `replay-grant`，且拒因**不是** `batch-token` | spawn | 初稿 |
| R3a | 票据喂结构面 reader → 拒（回归守钉） | 纯层 | 初稿 |
| R3b | 票据喂 `created-workflow-freeze` → 具名拒、不落件 | spawn | 初稿 |
| R4 | A 案票据配 B 案结构件 → 摘要链不合而拒；同案配对正控须过 | 纯层 | 初稿 |
| R5 | 批会话纯判定五态：首成员放行 / 同批次成员放行 / 同成员重跑拒 / 异 token 拒 / 未授权成员拒 | 纯层 | 初稿改写 |
| R6 | controller 缺 grant handle → `allowLaunch:false` | 纯层 | 初稿 |
| R7 | 清单缺 `replayGrantPath` / 越界 / 越出 `runs/` → 结构红；正控须过；v3 三件成组约束不被削弱 | 纯层 | 初稿 |
| R8 | `replay-grant-freeze` 草案与当前结构件字节不一致 → exit 65、不落件 | spawn | 初稿 |
| R9 | `notAfter` 已过期 → 具名拒、未 launch | spawn | R1 评审 H1 |
| R10 | 首成员**到达哨兵点时** session 与成员标记已落盘（先记再放行的可证伪面） | spawn | R1 评审 C1 |
| R11 | 采集面无有效票据 → 拒跑 + 要求回执；有效票据不得误拦 | 纯层 | R1 评审 M1 |
| R11b | **采集编排层真接线**：无票时不 spawn 子进程且产出拒跑清单 | 纯层 | R2 评审 M-new3 |
| R12 | 票据 `audience` 与结构件 `audience` 不等 → 具名拒（两向） | 纯层 | R1 评审 M3 |
| R13 | 台账根不可写 → 具名拒、未 launch，绝不先跑后补记 | spawn | R1 评审 C1③ |
| R14 | 同 nonce 异 `batchToken` → `BATCH_SESSION_MISMATCH`（崩溃重跑不得自动复用） | spawn | R2 评审 C-new |
| R15 | 同批同成员第二次 launch → `MEMBER_ALREADY_CONSUMED` | spawn | R2 评审 C-new |
| R16 | **同批第二成员放行到哨兵点**（C-new 的正控——否则整批跑不完） | spawn | R2 评审 C-new |
| R17 | `caseId` 不在票据授权成员集内 → `CASE_NOT_AUTHORIZED` | spawn | R2 评审 C-new |
| R18 | **两进程并发抢同一成员标记 → 恰一个到达哨兵点**（`wx` 原子独占，非串行） | spawn | R2 评审 M-new2 |
| R19 | **有票据但无台账根 → exit 64 具名、未 launch**（双旗标棘轮的另半边） | spawn | R3 过闸后补钉 |

十三条 spawn 真二进制取退出码（不 grep 失败标记串）。
spawn 面全程带 `CASEY_LAUNCH_SENTINEL`（`bin/replay.mjs:450` 在 `chromium.launch` 前短路），
**「未启动浏览器」是哨兵可证的事实，不是断言里的形容词**；
且**恒传 `--replay-grant-ledger`**（评审 H-new），保证拒因钉得到目标而不是撞缺旗标。

### 5.1 真红基线（本轮实跑）

`accept/red-proofs/` 下两份（路径以本计划目录为根，即
`docs/plans/p9-replay-authority-split/accept/red-proofs/`，评审 L-new2）：

| 红证 | 结果 |
|---|---|
| `replay-authority-split.cli-session.red.txt` | **0/13，exit 1** |
| `replay-authority-split.pure-suite.red.txt` | **0/8，exit 1** |

R1/R2 的红尤其说明问题——**今天拿一份 `audience:test` 的结构授权边跑回放，
票据位塞什么都行（甚至不塞），一路跑到 `chromium.launch`**：回放面确实没有运行期授权闸。

R3a 需注意：结构面 reader 今天已能拒掉异种件（`authorityShape` 的精确键 + 字面量守卫），
该钉在实现后属**回归守钉**而非新增能力，红证里它红是因为造不出票据夹具，不是因为守卫缺席——
这一条如实标注，不冒充新拦截力。

`R9` 的「禁止喂时」目前只由金牌的文本守卫（拒因里不得出现 `--now`）表达，
**这是设计约束而不是机制**：实现者若真加一个喂时旗标，该钉不会翻。如实标注（pi 残差）。


## 6. 冻结面影响（amendment 清单）

**必须 amendment（真翻断言，逐条附真实红证与「断言只加严」论证）**

1. `tests/_golden/p9-created-workflow-continuity-v3.authority-cli.zero-sut.golden.mjs:103-122`（A6）
   —— 夹具补 `--replay-grant`；断言语义不变（仍是「bindAgent 继续命中旧锁门」）。
2. 同件 `:73-79`（A2）、`…replay-evidence…:51`、`…legacy-fixed-id-supersession…:56,65`
   —— 三处 `createCreatedWorkflowReplayContinuityController` 调用补 grant handle。
   属纯层强制的连带，四处合计。
3. `tests/_golden/p9-created-workflow-continuity-v3.tier2-production.zero-sut.golden.mjs:80-118`（T5）
   —— `manifest()` 夹具补顶层 `replayGrantPath`；成员面与三件断言不动。

**零翻**：`created-in-run` / `stable-absence` / `tier2-cleanup` / `role-compile-sign` /
`p9-tier2-selftest` T9a（断言文字零改；真清单加字段后随 C 段重签自然跟上）。

八枚 v3 金牌的**实现前基线**：本轮全绿（逐条退出码 0，见 `evidence/` 首节）。
实现中任何一枚出现基线外行为漂移 → 立即停、报主循环。

## 7. 交付顺序

1. GRILL 定稿 + 本 plan + 红金牌草案 + 真红基线（r1 已过 grok 前提审并按 findings 改稿，
   现为 r2，**待复核 + pi 双路**）；
2. 过审后：`acceptance-gate`——红证 checksum 冻结、successor PRD、`gate --dry`；
3. 纯层：`lib/entity-created-workflow-replay-grant.mjs`
   （起草 / 冻结 / 读回含过期与受众 / 批会话纯判定 / 采集面拒跑筛）+
   命令行面的 `wx` 原子占用；
4. 纯层强制：controller 增必填 grant + 四处 amendment（逐处附红证）；
5. 命令行：`bin/entity-authority.mjs` 两个 verb、`bin/replay.mjs` 与 `bin/casey.mjs` 接线，
   **台账占用接在浏览器前门、排在 `chromium.launch` 之前**；
6. 采集面：清单 `replayGrantPath` + 票据读取传递 + **强制接拒跑筛并落拒跑回执**（不写台账）+ T5 amendment；
7. 邻接复跑：八枚 v3 金牌、`p9-tier2-selftest`、`p9-tier2-final-batch`、
   admission policy facets、replay axes、verdict、term-lint、drift scan、tier1；
8. 异构评审（实现家族≠评审家族）；
9. 文书：`SIGNING-SESSION.md` 新签署点落位。

## 8. route:human

- **回放授权票据人签**：每批一签。位置在 **C 段（清单定稿）之后、D 段（跑批）之前**——
  E 段跑批已经发生完了，那时再签是追认，不是授权。
- `notAfter` 由 Steven 本人写值；机器只在跑单给建议值。
- **崩溃或失败后的重试要人签新票**：半消耗票据一律作废，工装无权判定「上次其实没跑成、
  可以放回去」。这与 `chat.sendAndWait` 判读 `INDETERMINATE` 时立的是同一条纪律。
- E 段新增一项核对：本批核销台账只记了一张票，没有第二次静默复用。
- `SIGNING-SESSION.md:63-76` 的十行人签清单插入新行；`:358-382`（D 段）加
  `replay-grant-freeze` 一步与回执核对格；`:384-395`（E 段）加台账复核。

## 9. 验收点（逐条可判、退出码为准）

每条验收点对应 PRD 里一个 story；判据一律是**跑命令看退出码**，不 grep 失败标记串。

| 验收点 | 判据 | 对应 story |
|---|---|---|
| 票据件种与结构件互不可冒充；跨案链断；受众两向都拒；过期拒；freeze 重建字节不符即拒 | `pure-suite` 与 `cli-session` 两枚 exit 0 | s1 |
| 批会话协议成立：首成员开会话、同批第二成员放行、同成员二次拒、异 token 拒、未授权成员拒、并发单胜者、台账不可写即不放行 | `cli-session` exit 0（R10/R13–R18 全绿）、`pure-suite` R5 五态全绿 | s2 |
| 授权闸在纯层：缺 grant handle 的 controller 一律 `allowLaunch:false`；双旗标缺任一 exit 64 具名；新门排在 batch-token 门之后 | `pure-suite` R6、`cli-session` R2/R19 全绿 | s3 |
| 清单顶层 `replayGrantPath` 闭合；采集层无有效票据时不 spawn 且落拒跑回执 | `pure-suite` R7/R11/R11b 全绿 | s4 |
| 四处 amendment 各有红证与「断言只加严」论证；八枚 v3 金牌零行为漂移 | 八枚 v3 金牌逐枚 exit 0 | s5 |

**验收的边界条件**（写明防止被绕过）：

- 二十一条钉必须**全部**由红转绿，不接受「大部分绿、个别挂账」；
- `R16`（同批第二成员放行）与 `R14`/`R15`/`R17` 必须**成组**看：只钉拒不钉放行，
  会把「整批跑不通」这个坏实现判成绿；
- `R18` 必须是**两个并发进程**，串行双跑证不出 `wx` 的原子独占；
- 采集层 call-site 的真接线金牌只钉得住导出契约，**须人工核**（列入 `observability` 的 route:human）；
- 冻结件只读：`passes` 只由 `loop-kit/bin/gate.mjs` 写。

## 10. 完成定义与非目标

完成须同时满足：二十一条钉由红转绿、四处 amendment 各有红证与只加严论证、
八枚 v3 金牌零漂移、邻接无回归、异构评审通过、`SIGNING-SESSION.md` 新签署点在册。

非目标：不动 v3 结构件字节形状与已签 `plan.md`；不把 `batchToken` 生成权交给人；
不给 compile 面加第二道 v3 授权门（它已有 `execute-authority.json`，再加是重复授权）；
不碰零 LLM 裁判、`cleanupSatisfied` 判据与 `projectReplayAxes`；不迁移 v1/v2 旧件。

## 11. 术语登记

本契约只登记自己引入的词（fable 裁 Q7），先查既有学科词再造：
「回放授权票据」（票据 = capability ticket 的既有学科词，取其一次性、可核销、
带失效期三性）、「核销台账」（会计既有词，取「一票只核销一次」）。
v3 家族术语（结构授权边等）未登记 `CONTEXT.md` 属既有欠账，**挂账不在本契约做大扫除**。
