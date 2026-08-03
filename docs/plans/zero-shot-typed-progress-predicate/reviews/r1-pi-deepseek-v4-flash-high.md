Original tree untouched (all mutations in `/tmp/czt`). Here is the review.

---

# 代码评审：zero-shot-typed-progress-predicate 闭集扩展

**评审方式**：全部结论来自实测（8 条必跑命令 + 4 个独立探针 + 8 路变异测试，变异在 `/tmp/czt` 副本中进行，原树零改动）。必跑命令全部真实 exit 0（`typed-progress-predicate` 20/20、`action-progress`、`authority-runner`、`deterministic-resolver-step-contract`、`page-observer-main-frame`、`public-observation-redaction`、`adaptive-module-boundaries`、`term-lint --registry`）。金牌 sha256 与 PRD `d12f103f…` 一致。

## Critical

无。

## High

### H1. driver 级截断下 `roleVisible` 假绿——plan §4 的豁免理由对 driver 边界不成立

**文件**：`lib/zero-shot/progress-verifier.mjs:40`（`pageCount === 1` 判据）、`lib/zero-shot/progress-verifier.mjs:98-103`（完整性前置只对缺席类生效）；根因在 `lib/zero-shot/playwright-page-driver.mjs:7-8,71-75`（`MAX_DISCOVERED=1000`/`MAX_VISITED=20000` 浏览器侧截断）与 `lib/zero-shot/affordance-catalog.mjs:134,154`（`pageCount` 只在**已过 driver 上限**的 `projected` 集上计数）。

**为什么是问题**：plan §4 / GRILL G5 给「存在性断言豁免完整性前置」的理由是「截断只丢候选不造候选，且 `pageCount` 在截断前全集上算出、不受截断影响」。这**只对 catalog 级截断（maxCandidates）成立**——那里同名项排序相邻、计数不受 bound 影响。但真实路径有两道截断：浏览器侧 `discoverMainFrame` 在 `counts` 建立**之前**就丢弃第 1001 个候选（`nodes.push` 上限）并把 `sourceTruncated=true` 冒泡为 `observation.truncated=true`。同名第二实例被丢 → `pageCount` 低估为 1 → `roleVisible` 在**截断且实际歧义**的观察上判 `progressed`。

**可复现反例**（端到端，`/tmp/czt/probe3.mjs`）：真实页面动作后有两个同名可见 dialog，浏览器上限只枚举到一个并置 `sourceTruncated:true`：

```
after.truncated = true | pageCount = 1 | affordances: [{...role:"dialog", name:"工作流详情", visible:true, pageCount:1, actionable:true}]
verifyStepProgress → {"status":"progressed", "conditionKinds":["roleVisible"], ...}   ❌ 假绿
```

`verifyStepProgress` 甚至能看到 `after.truncated === true` 却不查（豁免），与护栏 #14 fail-safe 直接冲突。触发条件是真实页面的 >1000 候选元素（P9 工作流管理页的大表格/列表完全可能）或 >20000 DOM 节点。

**建议修法**：把 driver 级与 catalog 级截断分开暴露（observation 增加 `sourceTruncated` 或 `driverTruncated` 布尔），并让 `completenessBlocker` 对 `roleVisible` 也拦 driver 级截断（只豁免 catalog 级）；或更简单——存在性断言也过 `truncated` 闸，代价是牺牲 P14 钉死的现役行为，需重走 GRILL 裁决并补一枚「catalog 级截断 + roleVisible 仍判过」的钉子区分两级。

## Medium

### M1. 金牌没钉住 `roleVisible` 的两个 spec 关键条件（`pageCount===1`、`visible===true`）——变异后 20/20 仍全绿

**文件**：`lib/zero-shot/progress-verifier.mjs:40`；钉子面 `tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs`（P4/P5/P14）。

**为什么是问题**：P5 用「同名两命中（matched===2）」钉唯一性，它**无法区分** `matched.length===1 && pageCount===2`（截断切掉同名兄弟，正是 G3 纪律要防的歧义）与 pageCount===1。也没有任何「匹配元素挂载但不可见」的 `roleVisible` 反控钉。PRD 声称的变异验证「roleVisible 去唯一性」只覆盖整体删除。

**可复现反例**（变异，均在 `/tmp/czt`）：
- 删 `matched[0].pageCount === 1`（保留 `=== 1 && visible`）→ 20/20 全绿，EXIT 0；
- 删 `matched[0].visible === true` → 20/20 全绿，EXIT 0。

而对照变异（删完整性闸 / 删 redaction 闸 / 无名也计数 / roleHidden 改未挂载口径 / 闸扩到全部 kinds）全部正确转红——说明其他钉子质量可靠，唯独这两处是「假绿面」。

**建议修法**：补两枚钉——(a) after 含同名两候选且 `maxCandidates:1` 使目录只留一条（matched===1、pageCount===2）→ `EXPECTED_PROGRESS_NOT_PROVED`；(b) after 唯一匹配元素 `visible:false` → `roleVisible` 不成立 → `NOT_PROVED`。

### M2. 第四个不完整来源：driver 枚举边界/空目录下 `roleHidden` 假绿（plan 的完整性三来源宣称不穷尽）

**文件**：`lib/zero-shot/playwright-page-driver.mjs:64-70`（`nativeCandidate || roleCandidate` 过滤，role-less 非交互元素永不入目录、无任何完整性标志）；`lib/zero-shot/progress-verifier.mjs:49-61`（`completenessBlocker` 只查三种来源）。

**为什么是问题**：plan/R1 把「目录不完整的来源」钉死为 truncated / unsupportedScopes / redactionSuppressed 三种。但真实可见的无 role 属性元素（role-less 抽屉 `<div>`、`<h1>`、`<span>`、`<dialog>` 标签本身）在**主 frame 内**就被枚举规则排除，`roleHidden` 平凡成立；页面动作后变空白/跳登录页（0 候选、未截断、无抑制、无 scope）同样被当「完整目录」。

**可复现反例**（`/tmp/czt/probe4.mjs`）：before 有可见 `dialog`，点击后页面空白（`affordances: []`、`truncated:false`、`redactionSuppressed:0`、三 scope 全 false）→ 纯 `roleHidden` expected 判 `progressed`。plan §5「纯否定 expected 永远无法自称进展」的保证依赖 predicate 翻转，而「整页消失」正是一次翻转。

**建议修法**：至少把空目录列为第 4 种不完整来源（缺席类断言要求 after 目录非空或有其他证据）；role-less 元素盲区按 plan §9 已 route:human，但应在 plan/GRILL 里显式记录为已知不完整来源而非暗示三来源穷尽。零-SUT 夹具无法暴露此洞（adapter double 无枚举边界），建议在真实 driver 的探针/真机验收里加一项空目录断言。

## 逐条风险结论

1. **闭集是否真闭**：**无发现**。21 项探针：urlPathname 现役 9 种旧拒因 + 2 种合法形状逐字保持（字节兼容成立）；`Object.create(null)` 项合法；数组、own `__proto__` 键、非枚举键、symbol 键、空白 name、大写 role 全部按预期拒/净化（symbol/非枚举键被 `structuredClone` 在冻结前丢弃，验证结果与冻结件一致，无逃逸面）。
2. **缺席类 fail-open**：**部分发现（M2）**。catalog 内三种来源覆盖完整且钉子真红（MUT-C/MUT-D 转红）；第四种来源=driver 枚举边界/空目录，见 M2。
3. **roleVisible 唯一性**：**有发现（H1 + M1）**。现役判据正确，但 plan §4 的「pageCount 不受截断影响」在 driver 级截断下被证伪（H1 端到端假绿）；豁免面无任何钉子（M1）。
4. **因果性**：**无发现**。合取级规则混入否定式后无逻辑洞：纯否定双真 → `NOT_CAUSED`（P9 钉在）；任何 `progressed` 必伴随至少一个 predicate 翻转。「整页消失也算翻转」归入 M2。
5. **授权链**：**无发现**。伪造带 `redactionSuppressed:0` 的 observation 对象 → `OBSERVATION_AUTHORITY_MISMATCH`；跨 driver → lineage mismatch；observation 深度冻结 + WeakMap 身份绑定；`redactionSuppressed` 由 catalog 从 raw 事实派生、driver 无法注入；旧观察缺字段 → `Number.isInteger` 拒付（fail-closed）。`catalogDigest` 已并入 `redactionSuppressed`。
6. **护栏合规**：**无发现**。产物恒 `signed:false`/`replayReady:false`（P16）；`conditionKind(s)` 全仓 grep 唯一代码消费者即本模块（旧名仅存于 plan.md 文档，无下游被破）；diff 未触 `bin/verdict.mjs`/三轴/`check.mjs`（护栏 #15/#17）；全部邻接 exit 0（护栏 #19；`prd-drift-scan` exit 1 为 PRD notes 已记载的 cases/runs 缺件环境假红，与本 PRD 无关）。
7. **金牌质量**：**有发现（M1 + 支撑 H1）**。两处可削弱不红；其余 6 路变异正确转红，P19/P20 对 redactionSuppressed 计数区分（抑制 vs 无名）钉得扎实。
8. **不可达代码**：**无发现**。独立探针确认：截断 before → resolver `blocked/CATALOG_TRUNCATED`、admission `denied=CATALOG_TRUNCATED`、`perform=0`；actionReceipt 只能由 admission 签发，故 `verifyStepProgress` 拿不到绑定截断 before 的合法收据。plan「before 面不加死代码」主张成立。

---

`VERDICT: CHANGES_REQUIRED`（H1：driver 级截断 + `roleVisible` 豁免造成端到端可复现假绿，与 plan §4 自述矛盾，须先修 H1 再合入；M1/M2 可同轮补齐）
