# plan · zero-shot-guard-net

> lane=full，门禁加固（非 kernel）。基线 `e6e7ea1`，后继于 `zero-shot-typed-progress-predicate`。
> 决策树见同目录 `GRILL.md`；前提审收据见 `reviews/`。
> 范围由三条组成，落地序强制 范围 1 → 范围 2 → 范围 3，本文不扩。

## 1. 业务目标

三个已实证的门禁盲区，都属于「网存在但覆盖面是硬编码、新东西自动逃逸」这一类：

1. **模块边界门的清单逃逸**：`adaptive-module-boundaries.static.golden.mjs` 的 `S2_CORE` 是硬编码 14 项，
   新建的 zero-shot 模块不进清单就不受五张网中的任何一张。实测：往 `lib/zero-shot/` 放一个 704 行、
   直接 `import playwright` 与 `node:fs`、且与另一模块互引成环的流氓模块，边界金牌仍 `5/5 passed`、`EXIT=0`。
2. **`unsupportedScopes` 判据四处分叉**：四个消费点各写各的判据，其中两处逐字列举三个键名。
   实测：往 scope 记录里加第四个键，`progress-verifier` 判 `progressed`——**真 fail-open**，
   一次动作根本没造成的进展被判成进展，且零告警；`action-admission` 的自身闸失效、
   拒因从 `UNSUPPORTED_SCOPE` 漂成 `RESOLUTION_AUTHORITY_INVALID`（拒因错位、纵深失效，不是放行）。
3. **`container-out` 未登记**：共享门 `agent-search-gate.mjs` 产出的第六态在统一语言注册表里没有落字，
   易被误读成 `verdict.mjs` 要新增一态。

## 2. 精确影响面

### 2.1 逐文件

| 文件 | 角色 | 改动 | 所属 PRD 与 checksum | amendment |
|---|---|---|---|---|
| `tests/_golden/adaptive-module-boundaries.static.golden.mjs` | 金牌 | 加 `discoverZeroShotCore`；d1 双向相等 + 无子目录断言；d2/d4/d5 吃发现集；d3 反转成执行面白名单 | `prd-zero-shot-observe-admit-step.json`，有锁 | **必须**（第 12 轮，R12） |
| `lib/zero-shot/unsupported-scopes.mjs` | 生产件（新增，纯叶） | 新建：`UNSUPPORTED_SCOPE_KEYS` + `normalizeUnsupportedScopes` + `anyUnsupportedScope` | 无 checksum（生产件从不进 `testChecksums`） | 不适用 |
| `lib/zero-shot/page-observer.mjs` | 生产件 | `scopesOf` 改调 `normalizeUnsupportedScopes`；`blockReason` 改调 `anyUnsupportedScope` | 无 | 不适用 |
| `lib/zero-shot/action-admission.mjs` | 生产件 | 逐字列举 → `anyUnsupportedScope` | 无 | 不适用 |
| `lib/zero-shot/progress-verifier.mjs` | 生产件 | 逐字列举 → `anyUnsupportedScope` | 无 | 不适用 |
| `lib/zero-shot/deterministic-resolver.mjs` | 生产件 | `unsupported()` → `anyUnsupportedScope` | 无 | 不适用 |
| `tests/_golden/fixtures/zero-shot-observe-admit-step/adapter-double.mjs` | 夹具 | `copyUnsupported` 白名单 → 通用透传 | `prd-zero-shot-observe-admit-step.json`，有锁 | **必须** |
| `tests/_golden/zero-shot-unsupported-scope-fanout.zero-sut.golden.mjs` | 金牌（新增） | 元钉，见 §5 | 落进新 PRD 的 `testChecksums` | 首次冻结 |
| `CONTEXT.md` | 统一语言注册表 | `resolution` 词条整行替换（追加门内第六态说明） | 全仓零 checksum 锁 | 不需要 |
| `docs/plans/zero-shot-guard-net/{plan.md,GRILL.md}` | 文档（新增） | full 车道交付物 | 新 PRD 冻结 | 首次冻结 |
| `docs/plans/zero-shot-guard-net/accept/red-proofs/*.red.txt` | 红证据（新增） | 见 §6 | 新 PRD 冻结 | 首次冻结 |
| `loop/prd-zero-shot-observe-admit-step.json` | PRD | 改两条 checksum + 追加第 12 条 `checksumAmendments` | 自身 | — |
| `loop/prd-zero-shot-guard-net.json` | PRD（新增） | 新契约 | 自身 | — |

**明确不动**：`lib/zero-shot/playwright-page-driver.mjs`、`lib/zero-shot/affordance-catalog.mjs`、
`PageObservation` 的键集、`catalogDigest` 的输入四元组。

### 2.2 `prd-zero-shot-observe-admit-step.json` 的 amendment 内容

两件冻结件改字节，须在 `checksumAmendments` 追加第 12 条，逐条写清「改了什么、为什么不是弱化断言」：

- `adaptive-module-boundaries.static.golden.mjs`：`S2_CORE` 由硬编码 14 项改为目录发现 + 双向相等 +
  无子目录断言；d3 由纯模块白名单反转为执行面白名单。**断言零弱化，只加严**：
  P1 证明改前流氓模块 5/5 全绿，P2 证明改后 0/5、五网齐响，P3 证明对现状零行为差。
- `adapter-double.mjs`：`copyUnsupported` 由三键白名单改为通用透传，消除夹具静默吞键这一假绿源；
  归一化职责仍由生产 `page-observer.scopesOf` 独占。

### 2.3 `catalogDigest` 影响评估

**零影响。** digest 输入是 `{truncated, totalCandidates, redactionSuppressed, affordances}`，
`unsupportedScopes` **不在其中**——它是 `page-observer` 直接挂到 observation 上的、不进 digest。
本契约不碰 `affordances` 的键集，故所有 digest 取值不变。

**停机条件**：实现期若发现任何 `catalogDigest` 取值发生变化，立即停机——那意味着撞上了未知面。
（残余风险：若有人「顺手」把 scope 信息塞进 affordance 或 digest 输入，digest 全变而没有任何金牌会红，
全仓无字面量 digest 断言、只有正则与两次一致性断言。故本文把「不动 digest 输入」写成硬非目标。）

## 3. 范围 1：模块边界门自动发现

`S2_CORE` 由硬编码清单改为「冻结清单 + 目录自动发现 + 双向相等」，对齐同文件既有的
`discoverSetupSupport` 先例：

- `discoverZeroShotCore()`：平铺 `readdirSync('lib/zero-shot')` + 只过滤 `.mjs` + 排序；
- d1 加双向相等：发现集每一项必须在 `S2_CORE` 里（未登记即红），`S2_CORE` 每一项必须被目录发现（缺文件即红）；
- d1 加「`lib/zero-shot/` 下不得有子目录或指向目录的符号链接」断言：平铺扫描看不见目录，
  此钉把「要建子目录」逼成一次显式裁决。**符号链接口径（R13 经异构评审逼出，见下）**：
  只看 `Dirent.isDirectory()` 会被整条绕过——对指向目录的符号链接它恒为假、`isSymbolicLink()` 才为真，
  于是链接既不进本钉、平铺发现也扫不进链接目录里的模块。故对符号链接解引用一次（`statSync`），
  指向目录即红；解引用失败（dangling / 权限 / 环）时门**证不出**「它不是目录」，
  按护栏 #14 的 fail-safe 姿态一律计入违规——证不出就红、不默认放行，与本契约「方向只许加严」一致。
  `discoverZeroShotCore` 本身保持平铺、不递归、不解引用：完整性由本钉承担，两者分工不重叠；
- d2 / d4 / d5 的受检集合改吃 `S2_CORE ∪ 发现集`；
- d3 的 `pureFiles` 反转成执行面白名单：`pureFiles = (S2_CORE ∪ 发现集) − S2_EXECUTION_FACING`，
  `S2_EXECUTION_FACING` 显式登记七个执行面模块（`playwright-page-driver` / `page-observer` /
  `affordance-catalog` / `affordance-authority` / `action-admission` / `step-executor` / `single-step-runner`）。
  新模块默认按纯模块最严口径受检，要豁免必须显式登记。

**本改动对现状零行为差（实测 P3）。** 发现集恰好等于硬编码的 14 项，改前改后都是 `5/5 passed`。
故**这一半改动在常驻冻结断言层面造不出红**，它的价值只在「有人新建 zero-shot 模块」时兑现。
其保护面由 red-proof 里的变异实验（P1 绿 / P2 五红）作证，**不是**由新增了几条会红的断言作证。
这一条如实写明，不伪装成 ATDD 红。

## 4. 范围 2：`unsupportedScopes` 单一事实源

### 4.1 新纯叶模块

`lib/zero-shot/unsupported-scopes.mjs`，**零 import**（d3 的 `forbiddenFragments` 含 `page-observer`，
共享物只能住在依赖图的叶子上）。导出三件：

- `UNSUPPORTED_SCOPE_KEYS`：冻结数组，键清单的唯一事实源，落地取值 `['iframe','shadow','containerOnly']`；
- `normalizeUnsupportedScopes(value)`：产出**恰含这些键**的冻结记录，每键按 `=== true` 归一；
  非记录输入（数组 / `null` / 标量）一律当空记录处理，与现役 `scopesOf` 逐点等价；
- `anyUnsupportedScope(value)`：判据，取现役三种实现的**并集严格度**——
  记录型 → 任一**自有**值为真即真（**含未知键**）；数组型 → 非空即真；其余形状 → 返回假。

### 4.2 并集严格度是承重约束

三处现役判据严格度不同：`deterministic-resolver` 认数组与未知键；`page-observer` 认已归一记录的任意真值；
`action-admission` / `progress-verifier` 只认三个字面键。收敛必须取**并集**。
若图省事写成「只遍历 `UNSUPPORTED_SCOPE_KEYS`」，则合成观察件里带未知键的场景会从「resolver 拦」退成「放行」——
那是放松，直接违反「只许加严」。

**未知键对照钉的注入路径写死（前提审 H1）**：对照钉必须**直接调用**
`anyUnsupportedScope({ probeScope: true })` 与 `anyUnsupportedScope(['x'])`，
**禁止**经 `normalizeUnsupportedScopes` / `observePage` 链注入。原因：正确实现下 normalize 会把未知键剥掉，
经链注入的钉测的是 observation 形状而非判据语义，会**错红**。四点拒付钉只遍历 `UNSUPPORTED_SCOPE_KEYS` 内的键。

### 4.3 四个消费点收敛

| 消费点 | 现役 | 改后 |
|---|---|---|
| `page-observer.scopesOf` | 逐字构造三键记录 | `normalizeUnsupportedScopes` |
| `page-observer.blockReason` | `Object.values(...).some(Boolean)` | `anyUnsupportedScope` |
| `deterministic-resolver.unsupported` | 数组非空 或 记录任一值为真 | `anyUnsupportedScope` |
| `action-admission.observationBlocker` | 逐字列举三键 | `anyUnsupportedScope` |
| `progress-verifier.completenessBlocker` | 逐字列举三键 | `anyUnsupportedScope` |

拒因字面量一字不改：observer/admission 面 `UNSUPPORTED_SCOPE`，progress 面 `PROGRESS_UNSUPPORTED_SCOPE`，
resolver 面 `route:human` / `UNSUPPORTED_SCOPE`。

### 4.4 夹具 `adapter-double.mjs`

`copyUnsupported` 由三键白名单改为**通用透传**：把调用方给的每个自有键按 `=== true` 归一，不做键过滤。
夹具回归本分（如实转交调用方给的事实），归一化留给生产 `scopesOf`。

**行为等价的正确表述（前提审 M1 修正）**：旧实现恒吐三键，通用透传的输出键集会**变窄**——
`{iframe:true}` 旧吐三键、新吐一键；`{}` 与 `[]` 旧吐三键全假、新吐空记录。
故**不是字节等价**，正确表述是「经生产 `scopesOf` 归一后行为等价」。草案里的「字节等价」表述已废除。

**回归面已实测（M1 把原 R4 从推断降级为事实）**：前提审在只改夹具的状态下跑了 5 枚直接依赖夹具的金牌，
全部 `EXIT=0`——`page-observer-main-frame` 8/8、`deterministic-resolver-step-contract` 16/16、
`zero-shot-action-progress` 12/12、`zero-shot-authority-runner` 11/11、
`zero-shot-typed-progress-predicate` 24/24。其余邻接仍按护栏 #19 全量复跑（§7）。

**落地内序**：先只改夹具、跑这 5 枚确认零红，再动四个生产件。

### 4.5 范围 2 会连带一处金牌改动（设计使然）

范围 1 的 d1 双向相等意味着：新模块 `lib/zero-shot/unsupported-scopes.mjs` 一出现，
d1 立刻红，直到把它登记进 `S2_CORE`。故**范围 2 的提交必然携带一处边界金牌改动**。
这是期望行为、不是漏，须写进提交信息。

## 5. 范围 3：`CONTEXT.md` 的 `container-out` 落字

`resolution` 词条整行替换，只在第三列末尾追加一句门内第六态说明，前面一字不动，第四列保持 `—`。

`container-out` 是 容器归属闸 的**门内解析态**，不是动作轴上的可表征值：编译侧硬阻断零产事件，
回放侧投影成 `none`，`verdict.mjs` 从不见到该字面量。它是**在用的合法字面量**，
**不进**第四列弃用别名（进了会当场红三处在用代码），也**不为它另开词条**（容器归属只该有一个入口）。

标记约定已逐条核过 `term-lint`：正文不新增 `|`、零繁体字、不加粗英文术语。

## 6. 最小 ATDD 验收点（红先行）

### 6.1 新元钉金牌 `tests/_golden/zero-shot-unsupported-scope-fanout.zero-sut.golden.mjs`

零 SUT、零浏览器、零网络；复用 `fixtures/zero-shot-observe-admit-step/adapter-double.mjs`
（不另造夹具——已冻接缝是唯一事实源）。

| 钉 | 断言 | 实现前 |
|---|---|---|
| N1 | 模块导出三件：`UNSUPPORTED_SCOPE_KEYS`（冻结、非空、全为字符串）、`normalizeUnsupportedScopes`、`anyUnsupportedScope` | **红**（模块不存在） |
| N2 | 键清单是历史三键 `iframe`/`shadow`/`containerOnly` 的**超集**（棘轮：只许加不许减） | **红** |
| N3 | `normalizeUnsupportedScopes` 输出键集与 `UNSUPPORTED_SCOPE_KEYS` 逐字相等（防常量加了键、归一化器没跟） | **红** |
| N4 | 遍历 `UNSUPPORTED_SCOPE_KEYS` 每个键，置真后经 `observePage` 得到的 observation 上该键**真的为真**（前置钉，防夹具吞键） | **红** |
| N5 | 同一循环内 `revalidateAffordance` 拒 `UNSUPPORTED_SCOPE` | **红** |
| N6 | 同一循环内 `resolveDeterministicAction` 出 `route:human` / `UNSUPPORTED_SCOPE` | **红** |
| N7 | 同一循环内 `admitZeroShotAction` 拒**且拒因恰为** `UNSUPPORTED_SCOPE`（不是 `RESOLUTION_AUTHORITY_INVALID`） | **红** |
| N8 | 同一循环内 `createActionProposal` 拒 `UNSUPPORTED_SCOPE`（proposal 支路不得绕开） | **红** |
| N9 | 同一循环内、after observation 置该键时 `verifyStepProgress` 出 `pending` / `PROGRESS_UNSUPPORTED_SCOPE` | **红** |
| N10 | 结构钉：读四个消费点源文本，断言均已 import 共享模块且**不含**任何 scope 键字面量 | **红**（四处今天全是逐字列举 / 逐字构造） |
| N11 | 未知键对照钉（并集严格度）：**直接调用** `anyUnsupportedScope({probeScope:true})` 与 `anyUnsupportedScope(['x'])` 均为真；畸形形状（`null`/`undefined`/字符串/数字/空数组/空记录）均为假 | **红** |
| N12 | 产物纪律回归钉：本金牌涉及的全部件恒 `signed:false` / `replayReady:false`，不含 `verdict`/`passes` 字样 | **红**（语义是回归钉，但它也遍历键清单，故同样依赖共享模块） |

红基线实测：`0/12 通过，12 条红`、`EXIT=1`，全部红因均为共享模块缺席，与本表逐条相符
（既不多红也不少红），transcript 见 `accept/red-proofs/zero-shot-guard-net.red.txt`。

**红先行的成色说明（诚实标注）**：N1–N12 今天红是**因为共享模块与四点收敛尚未存在**——
这是标准的 ATDD 接口红，它证明的是「接口没落地」，不是「有 bug」。
其中 N5–N9 对**现役三个键**的行为今天本来就是绿的（三键今天恰好四处同步），
它们钉的是「键清单与消费点的同步关系」，价值在将来加键时兑现，不是今天就能红的洞。
真正证明「有 bug」的是第四个 scope 键在 `progress-verifier` 与 `action-admission` 上的行为，
而第四个键在冻结金牌里不该存在（会给生产闭集开后门，见 GRILL G5）。
因此红证据必须由 §6.2 的三份 transcript 共同构成，缺一份就是拿「模块缺失」冒充「洞的证明」。

### 6.2 red-proof 三份

| 文件 | 内容 |
|---|---|
| `accept/red-proofs/module-boundary-blindspot.red.txt` | 工作树临时副本内注入 704 行 + `playwright` + `node:fs` + 互引成环的 zero-shot 模块，跑边界金牌 → `5/5 passed` `EXIT=0`（洞的证明）；套用补丁后 → `0 passed, 5 failed` `EXIT=1`（补丁有效）；删流氓模块后 → `5/5` `EXIT=0`（零行为差） |
| `accept/red-proofs/unsupported-scope-fanout.red.txt` | 临时副本内给 `scopesOf` 与夹具各加第四键，跑完整链 → after 面 `progressed`（真 fail-open）、admission 拒因漂成 `RESOLUTION_AUTHORITY_INVALID`；同一探针换成已知键 `containerOnly` 作对照组 → 四点全 `UNSUPPORTED_SCOPE` + `PROGRESS_UNSUPPORTED_SCOPE` |
| `accept/red-proofs/zero-shot-guard-net.red.txt` | 新元钉金牌在未实现时的整份 transcript（真实 `EXIT=1`） |
| `accept/red-proofs/subdirectory-symlink-bypass.red.txt` | R13 补：把仓外目录软链进 `lib/zero-shot`、目录里藏一个未登记 `.mjs`，修前金牌 `5/5 passed` `EXIT=0`（钉被绕过）；修后 `4 passed, 1 failed` `EXIT=1`；删链接后回 `5/5` `EXIT=0`；另附 dangling 目录链接一路（同样红，fail-closed 口径） |

四份 transcript 全部在本工作树重新实跑采集，不复制历史数字（含评审方给的反例形状——形状复用、数字自采）。
边界那份另附一路本轮新增的独立变异：在副本里建 `lib/zero-shot/container/smuggled.mjs`，
改后金牌 `4 passed, 1 failed` `EXIT=1`（改前根本没有这张网），删目录后回 `5/5` `EXIT=0`。

**R13 如实记账**：首版的「无子目录」钉只看 `Dirent.isDirectory()`，被指向目录的符号链接整条绕过——
这是实现落地后的代码级异构评审（`grok-4.5` high，对 `e6e7ea1..24e0508`）逮到的唯一 finding（Medium，
`CHANGES_REQUIRED`），八项风险清单其余七项均判无发现并取证通过。作者已独立复现（`isDirectory()=false`、
`isSymbolicLink()=true`，修前 `5/5` `EXIT=0`），按上述口径修并补第四份 red-proof。
断言零弱化、只加严：修前放行的两类形状（目录符号链接、dangling 目录链接）修后一律红，
干净树上零行为差（`5/5` `EXIT=0` 不变）。

## 7. 复跑面（护栏 #19）

改动落在两个共享冻结面（模块边界门 + zero-shot 观测/判定链），`selftest --tier1` 绿一律不算数。
全集 = 三个 PRD 的 acceptance 并集 + 本契约新增。

**A. `prd-zero-shot-observe-admit-step` 全部 six stories：17 条 acceptance / 16 个唯一命令路径**
（`setup-runtime-barrier` 在 s5 与 s6 双挂，故 17 行对应 16 个文件——前提审 M2 澄清，
实现期不要按 17 个文件去找）

```
tests/_golden/page-observer-main-frame.zero-sut.golden.mjs
tests/_golden/public-observation-redaction.zero-sut.golden.mjs
tests/_golden/playwright-page-driver-hardening.zero-sut.golden.mjs
tests/_golden/deterministic-resolver-step-contract.zero-sut.golden.mjs
tests/_golden/zero-shot-action-progress.zero-sut.golden.mjs
tests/_golden/zero-shot-authority-runner.zero-sut.golden.mjs
tests/_golden/adaptive-module-boundaries.static.golden.mjs
tests/_golden/precondition-atom-workflow.zero-sut.golden.mjs
tests/_golden/setup-receipt-identity.zero-sut.golden.mjs
tests/_golden/setup-runtime-barrier.zero-sut.golden.mjs
tests/_golden/intent-plan-known-atom.zero-sut.golden.mjs
tests/_golden/intent-state-trace.zero-sut.golden.mjs
tests/_golden/flow-bridge.golden.mjs
tests/_golden/p2-compile-gate.golden.mjs
tests/_golden/units/replay-settle-mount-unit.zero-sut.golden.mjs
tests/_golden/entity-binding-operability-successor.zero-sut.golden.mjs
```

**B. `prd-zero-shot-typed-progress-predicate` 的 s1–s5**：
`zero-shot-typed-progress-predicate.zero-sut.golden.mjs`（s4 的九条与 A 重叠）、
`support/prd-drift-scan.mjs`、`term-lint --registry`、`selftest --tier1`。

**C. `prd-teachin-cycle-evidence` 的 `s2-adjacent-zero-regression` 整支 17 条**。
该 PRD 把 `adaptive-module-boundaries.static.golden.mjs` 列进 acceptance 但**未锁 checksum**——
不需要 amendment，但护栏 #19 要求复跑整条 story。这是最容易被漏掉的一支，因为它跟 zero-shot 家族看起来没关系。

**D. 本契约新增**：新元钉金牌 + `CONTEXT.md` 改动后的 `term-lint --registry`。

**第四个 PRD？无。** 按 `testChecksums` 与 `stories[].acceptance` 两维度全扫，命中三个 PRD，
前提审独立复扫结论一致。

**工作树注意**：`prd-drift-scan` 与 `gate` 在本工作树跑必须先软链主树的 `cases/` 与 `runs/`
（两者 gitignored、冻结件只存在于主树），否则报缺件假红；跑完立即还原并核 `git status` 无意外改动。

## 8. observability / route:human

| 维度 | 路由 |
|---|---|
| d3 的执行面豁免名单（`S2_EXECUTION_FACING` 七项）本身是硬编码、**没有门在盯**——没人能证明这七项确实都该豁免 Playwright/IO/网络禁令。新模块要豁免须显式登记，那是有意的人类动作（正是我们要的闸），但名单的正确性只能由人定期复核 | human |
| `anyUnsupportedScope` 对畸形形状（`null`/`undefined`/字符串/数字）保持返回假，与现役三处一致，**不 fail-closed**。这是有意保留的现役行为，不在本契约改；改它属新行为、须自带红证据与自己的钉 | human |
| 三处 `container-out` 防御性死代码（`compile-atoms-agent.mjs` / `compile-atoms-workflow-nav.mjs` / `replay-actions/agent-search.mjs`）——`resolveAgentCardTarget` 从不返回该值。只挂账不删：删死代码属行为改动、要另走红证据 | human |
| 真实 SUT 上是否存在第四类未支持作用域（如页面内容器作用域）。本契约只保证「加键时四个消费点会被逼着一起改」，不预判该不该加键；加键本身须人裁 | human |

## 9. 完成定义与非目标

完成 = §6 全部验收点由红转绿 + §7 A+B+C+D 全集 exit 0 +
`gate --prd loop/prd-zero-shot-guard-net.json` GREEN + 四路变异验证全部由绿转红且还原后字节全同。
验收点与复跑面之外的任何绿都不算完成证据。

非目标：不动 `playwright-page-driver.mjs` 采集面；不动 `affordance-catalog.mjs`；
不动 `PageObservation` 键集与 `catalogDigest` 输入四元组；不给 typed progress predicate 闭集加 kind；
不动 `bin/verdict.mjs`、不动三轴、不新增断言 kind 到 `check.mjs`；不删 `container-out` 死代码；
不改畸形形状的严格度。zero-SUT 绿不能替代真实 Playwright 与真机 UAT。
