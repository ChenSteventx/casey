# loop-kit-extract 实现审 round-2 第六次跑评审料（material-impl-r7）

> 用途：喂给异构冗余实现审（`codex` / `pi`）round-2 第六次跑。此前五次跑均由 `codex` 发现问题、
> `pi` 同料判 `PASS`：第一次跑 2 `HIGH`+1 `MED`+1 `LOW`；第二次跑 1 `HIGH`；第三次跑 1 `MED`+1
> `LOW`；第四次跑 1 `HIGH`（`node:vm` `Context` 边界，新角度）+1 `LOW`；第五次跑 1 `HIGH`（`node:vm`
> 范围收窄未同步进权威契约，治理/文档一致性角度）。均已处置，详见
> `docs/plans/loop-kit-extract/review/codex-impl-r2.md`~`r6.md`。本轮复核第五次跑发现的治理缺口
> 处置后的状态——若本轮 `codex` 与 `pi` 同时判 `PASS`，round-2 双路复核收口。

---

## 0. 评审指令（原样转发）

你是异构冗余实现审的评审方（评审家族≠实现家族：实现方是 Claude/Sonnet 5）。这是
`casey-loop-kit-extract` 契约实现审第六次跑（round-2 第六次跑）。请针对下文「历史发现摘要」「本轮
新增处置」「diff」「门禁证据」逐条核实：

1. `round-2` 第五次跑的 1 条 `HIGH`（`node:vm` 范围收窄未同步进权威契约——`plan.md`/`GRILL.md`/`prd`
   `observability`/`root.mjs` 表述不一致，治理/文档一致性角度，非新代码缺陷）是否已妥善处置？请
   核对：① `plan.md` §1.2/§1.4 的交叉引用是否准确指向 `GRILL.md` D4；② `GRILL.md` D4 新增专节是否
   完整覆盖技术原因、收窄依据、触发重评条件三项；③ `prd` `observability` 新增记录格式是否与既有
   `R2-L1` 先例一致、`route: "human"` 标注是否恰当；④ `root.mjs` 语义 4 的交叉引用是否消除了与语义
   6 的内部表述不一致；⑤ 这四处表述之间、以及与 `codex-impl-r6.md` 记录的处置说明之间，是否存在
   任何遗留的不一致或遗漏。
2. 本轮改动是否严格是纯文档/注释变更、零运行时逻辑改动（核对 diff 与 `testChecksums` 变化原因：
   `root.mjs` 字节变化应仅限注释行，`kit-lock.json` 哈希变化应是 `root.mjs` 内容变化的连带效应）。
3. 是否有任何新引入的问题、或对此前五轮已闭合项目的意外破坏。
4. 冻结纪律与凭据/术语边界同前几轮标准。
5. 若你认为当前状态已是合理的最终态（round-2 双路复核可以收口），请明确给出 `PASS` 结论；若仍有
   发现，请标 `HIGH`/`MED`/`LOW` 并给出文件位置与复现方式。

给出总体结论（`PASS` / `CHANGES REQUIRED`）。你在 `read-only` 沙箱内可以自行读文件、跑只读命令来
验证。

---

## 1. 历史发现摘要

`round-1`（fable 汇裁 `arb-impl-r1.md`，7 条采信，已修复）：`A1`（`HIGH`）ROOT 认领槽模块局部变量；
`A2`（`HIGH`）D5 故障矩阵金牌未覆盖全故障域；`A3`（`HIGH`）`boot.mjs` 不入 `testChecksums`；`A4`
（`MED`）金牌原地覆写生产信任根文件；`A5`（`MED`）观测基线规范化非字段级白名单；`A6`（`MED`）
`loadLib` 字符串拼接 `file://` URL 特殊字符解析错位；`A7`（`LOW`）信号自终失败兜底码不符 `128+n`
语义。（另有 pi 提出的 1 条 `HIGH`「`walkPackage()` 用 `isFile()` 漏判软链接」经两层行为级反证驳回，
不入修复清单，见 `arb-impl-r1.md` R1 节。）

`round-2` 第一次跑（`codex` 2 `HIGH`+1 `MED`+1 `LOW`，已修复）：`worker_threads` 边界；槽内容预置
无效值被照单全收；`SPAWN_ERROR`/`NO_STATUS` 断言可假绿；`A6` 缺失回归测试；`C4` 孤儿锁文件。

`round-2` 第二次跑（`codex` 1 `HIGH`，已修复）：外部预置合法 ROOT 后，幂等复用路径未冻结，可再
改写成另一个合法 ROOT。

`round-2` 第三次跑（`codex` 1 `MED`+1 `LOW`，已修复）：显式 `envRoot` 同值分支缺永久回归测试；
`isFrozenBySelf()` 命名过度声明。

`round-2` 第四次跑（`codex` 1 `HIGH`+1 `LOW`，已修复）：`node:vm` 的 `Context` 各有独立
`globalThis` 且 `isMainThread` 恒为 `true`，无法像拦 `worker_threads` 那样拦下，处置为纯文档化
范围收窄（非运行时防护）；C7 的 `out.first.includes('a')` 断言过宽（`marker-root` 本身含字母
`a`），改精确 `realpath` 比对。

`round-2` 第五次跑（`codex` 1 `HIGH`，治理/文档一致性角度，本轮处置对象；`pi` 同料判 `PASS`）：
第四次跑把 `root.mjs` 运行时注释的「进程唯一」范围收窄为「默认 Node.js 主 realm 内唯一」，但已签
设计 `plan.md`/`GRILL.md` 仍无条件写「进程唯一」，`prd` `observability` 未登记该范围豁免，`root.mjs`
语义 4 也未与语义 6 交叉引用——`codex` 指出实现文件注释不能单方面缩小已签 kernel 契约，此前
`round-1 A2` 的「未经设计授权的豁免必须回收」先例这次没有走相同治理流程。详见
`docs/plans/loop-kit-extract/review/codex-impl-r6.md`。

## 2. 本轮新增处置（针对第五次跑 `HIGH`）

采纳 `codex` 建议的选项①（保持纯文档方案、同步全部权威契约表述），四处改动、全部纯文档/注释，
零运行时逻辑改动：

- `docs/plans/loop-kit-extract/plan.md`：§1.2（`lib/root.mjs` 条目）与 §1.4（`shim`/`boot.mjs` 条目）
  各补一句交叉引用「进程唯一」范围精确表述见 `GRILL.md` D4 附注；§4 标题范围从「5–6 待续裁」改
  「5–7 待续裁」并新增 route:human #7 条目（范围精确化的治理定性 + 技术依据 + 触发重评条件）；§7
  新增对应挂账条目。
- `docs/plans/loop-kit-extract/proposed/GRILL.md`：D4 段原文后补一段完整的范围精确表述专节——
  `worker_threads` 与 `node:vm` 的对比、`codex` 复现结论、三条范围收窄依据、触发重新评估的条件，
  并指向 `root.mjs` 头注与 `codex-impl-r5.md`。
- `loop/prd-loop-kit-extract.json`：`observability` 新增一条 `route: "human"` 记录，格式对齐既有
  `R2-L1` 先例（`dimension` + `route` + `note` 三字段），内容与 plan.md route:human #7 一致。
- 包仓 `/mnt/d/ctx/heren/loop-kit` 的 `lib/root.mjs`：语义 4 补「（『进程唯一』的准确范围见语义 6，
  下同）」交叉引用，消除语义 4 单独出现「进程唯一」而语义 6 才给出精确范围之间的内部表述不一致；
  运行时逻辑（`resolveRoot`/`claimAtomic`/`writeClaimed`/`revalidateClaimed` 等函数体）零改动。

`testChecksums` 连带变化：`root.mjs` 注释字节变化 → 包内容变化 → `kit-lock.json`（全包清单 sha256）
哈希变化 → `prd` 的 `loop-kit/kit-lock.json` 与
`tests/fixtures/loop-kit-expected/package/lib/root.mjs` 两条 `testChecksums` 同步更新（期望存档
`root.mjs` 副本随包仓改动同步复制，逐字节一致）。5 个 story 的 `evidence` 时间戳随本轮 `gate` 重跑
刷新。

## 3. 门禁证据（本轮，disposition 落地后独立重跑，非转录）

```
$ node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json
gate: GREEN —— story 5/5 过

$ node tests/_golden/loop-kit-extract.golden.mjs
loop-kit-extract golden: 73/73 GREEN

$ node bin/casey.mjs selftest --tier1
selftest --tier1: 全链路 GREEN —— 确定性内核 + 统一语言双向有效。

$ node loop-kit/bin/ratchet.mjs verify
ratchet verify: RED -- 69 PRD / 190 冻结文件 / 2 问题
RED FILE_MISSING cases/tc_wf_history_version/expected.frozen.json
RED FILE_MISSING cases/tc_wf_publish_states/expected.frozen.json
```

上述 2 项 `FILE_MISSING` 是本契约无关的既有缺口（`prd` `observability` 已记档，历次跑同为这 2 项，
本轮改动前后无变化）。

Casey 树 HEAD：`7349441a560a61735eccc1b3f357ec4a9629ae62`（父 `4dcc91845cdaab6322a2fb03bcacf1b8d891fec9`）。
包仓 `/mnt/d/ctx/heren/loop-kit` HEAD：`ea5ed858b1406c99ed4b0089a624a9b6f8985560`（父
`462c455...`）。

## 4. Diff（Casey worktree，本轮新增处置：`4dcc918`→`7349441`）

> 说明：`31e71de`→`4dcc918` 的累积 diff（round-1 全部 7 条修复 + round-2 第一至四次跑全部修复）已
> 在 `material-impl-r2.md`~`material-impl-r5.md` 中完整呈现并经 `codex`/`pi` 逐轮审过，此处不再
> 重复；本节只含第五次跑发现的 `HIGH` 在本轮的处置 diff（纯文档/注释，无断言或降级矩阵相关代码
> 改动）。另本 diff 不含同一提交内新增的 `docs/plans/loop-kit-extract/review/codex-impl-r6.md`（63
> 行）——那是上一轮的评审记录归档，纯文本证据，不参与本轮代码/文档审查。

```diff
diff --git a/docs/plans/loop-kit-extract/plan.md b/docs/plans/loop-kit-extract/plan.md
index bda6e39..3cf1c3b 100644
--- a/docs/plans/loop-kit-extract/plan.md
+++ b/docs/plans/loop-kit-extract/plan.md
@@ -28,12 +28,12 @@
 A. 包仓侧（`/mnt/d/ctx/heren/loop-kit`，新独立 git 仓，fresh init）
 
 1. `bin/` 十脚本迁入，字节保真：唯一允许差异 = ROOT 锚定行换 `resolveRoot()`（涉及 `breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet` 七件）；`hook-stop`/`hook-loop-triage`/`review-deepseek` 逐字节照搬。`contract.mjs` 以 Casey 版为准（含 `worktree` baton 全套）；`ratchet.mjs` Casey 独有件入包。CLI 尾块（`isMain` 判据）零改动。
-2. `lib/root.mjs`（新，包内唯一新逻辑，契约按评审 M2/M3 收严）：...异根解析/认领立即抛结构化错误；另导出探针 = 认领值只读查询口（评审 R2-H3 采信，取代 round-1「import 后核对探针」）。
+2. `lib/root.mjs`（新，包内唯一新逻辑，契约按评审 M2/M3 收严）：...异根解析/认领立即抛结构化错误；另导出探针 = 认领值只读查询口（评审 R2-H3 采信，取代 round-1「import 后核对探针」）。「进程唯一」范围精确表述见 GRILL.md D4 附注（round-2 实现审第四轮 codex 采信：准确范围是默认 Node.js 主 realm 内唯一，不含 `worker_threads`/`node:vm` 等替代执行环境，route:human #7 待续裁）。
 3. `package.json`（name `loop-kit`、private、`type: module`、engines node>=22.12、零依赖）+ `README.md`（出处 SHA、双消费者、ADR-0008 与 autotester ADR-0001 指针、兄弟目录布局约定）。
 
 B. Casey 侧（单提交切换点，GRILL D9）
 
-4. `loop-kit/bin/*.mjs` 十件原地换同名 `shim` ...库模式零环境突变——`boot` 经包 `lib/root.mjs` 显式 API 在目标模块求值前原子认领进程唯一 ROOT，异根立即抛结构化错误...
+4. `loop-kit/bin/*.mjs` 十件原地换同名 `shim` ...库模式零环境突变——`boot` 经包 `lib/root.mjs` 显式 API 在目标模块求值前原子认领进程唯一 ROOT（范围精确表述见 GRILL.md D4 附注），异根立即抛结构化错误...
 5. `loop-kit/kit-lock.json`（**包身份锁**，git 跟踪，评审 H2 + R2-M2/R2-M3 采信后版本）：...
 6. `tests/fixtures/loop-kit-expected/`：期望包内容存档...
 7. `tests/_golden/loop-kit-extract.golden.mjs`：C0–C7（见 §3）。
@@ -61,7 +61,7 @@ story 划分与红/绿判据：
 
 验收命令在 acceptance 冻结时定稿，形如：`node tests/_golden/loop-kit-extract.golden.mjs`（内分 C0–C7 checks）；`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json`。
 
-## 4. route:human（须 Steven 拍板；1–4 已由 Steven 2026-07-13 裁定，5–6 待续裁）
+## 4. route:human（须 Steven 拍板；1–4 已由 Steven 2026-07-13 裁定，5–7 待续裁）
 
 1. **实现开工闸**——Steven 2026-07-13 裁定：**有条件签署**...
 2. **D5 降级加严（评审 H1 采信后扩围）**——Steven 2026-07-13 裁定：**加严接受**...
@@ -69,6 +69,7 @@ story 划分与红/绿判据：
 4. **D8 依赖声明（评审 M5 采信后收紧为二选一，装饰性声明不可接受）**——Steven 2026-07-13 裁定：**取甲**...
 5. **C0 跨仓棘轮形态**：包字节 pin 进 Casey 期望存档 + `kit-lock.json`...
 6. **运行时包身份锁（评审 H2 采信新增机制，round-2 R2-H2/R2-L1 修订后）**：...
+7. **「进程唯一 ROOT」范围精确化（round-2 实现审第四轮 codex 采信，实现阶段发现，非设计阶段决策）**：kernel 级人签时的 GRILL D4/plan §1.2 原文对「进程唯一 ROOT」无条件表述；实现阶段 round-2 第四轮实现审 codex 独立复现：node:vm 的 Context 各有独立 globalThis 且其中 isMainThread 恒为 true，与 worker_threads 不同、Node 无对等可靠运行时判据可拒绝，故该场景下「进程唯一」不成立。实现方已把准确范围收窄为「本机制运行所在的默认 Node.js 主 realm 内唯一」，选择精确文档化边界（loop-kit/lib/root.mjs 头注 + 本文件 + GRILL.md D4 均已同步）而非引入可被绕过的运行时启发式检测，理由：① 触发需 --experimental-vm-modules 显式旗标，本仓与消费侧任何默认调用路径均不带此旗标、该 API 默认不可用；② 构造该场景要求攻击者已在同进程内拥有任意代码执行能力，此前提成立时同进程本就不是可信边界；③ grep 核验本仓与消费侧零 node:vm 使用。此为实现阶段发现对已签设计的表述收紧，非重开设计讨论——待 Steven 在契约收尾人签时一并确认是否接受该范围表述，或要求改走 codex 建议的备选方案（跨 cooperative VM loader 共享宿主对象 + 补 VM 回归测试）。
 
 ## 5. 非目标（本契约不做）
 
@@ -88,3 +89,4 @@ story 划分与红/绿判据：
 ## 7. 挂账（已记债务，不阻塞开工）
 
 - R2-L1（round-2 异构冗余设计审，`LOW`）：每调用锁校验的性能预算未量化收口...
+- 实现审第四轮记债（round-2 实现审，`codex`，见 §4 #7）：「进程唯一 ROOT」范围收窄为「默认 Node.js 主 realm 内唯一」，`node:vm` 的 `Context` 场景以文档化边界处置、非运行时防护；触发重新评估的条件——任何一方引入 `node:vm` 消费面，或 VM Modules 转为 Node 默认可用（不只是加装 `--experimental-vm-modules` 实验旗标）；待 Steven 契约收尾人签时一并确认。
diff --git a/docs/plans/loop-kit-extract/proposed/GRILL.md b/docs/plans/loop-kit-extract/proposed/GRILL.md
index 51f49c7..bb4d1ff 100644
--- a/docs/plans/loop-kit-extract/proposed/GRILL.md
+++ b/docs/plans/loop-kit-extract/proposed/GRILL.md
@@ -40,7 +40,7 @@
 
 ## D4 `shim` 协议与 ROOT 解析（唯一语义改动面）
 
-- 包内新增 `lib/root.mjs`，单点 `resolveRoot()`...含 ROOT 锚定的七件（`breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet`）换用它；`hook-stop`/`hook-loop-triage`/`review-deepseek` 无 ROOT 锚定、逐字节照搬。
+- 包内新增 `lib/root.mjs`，单点 `resolveRoot()`...含 ROOT 锚定的七件（`breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet`）换用它；`hook-stop`/`hook-loop-triage`/`review-deepseek` 无 ROOT 锚定、逐字节照搬。**「进程唯一」范围精确表述（round-2 实现审第四轮 codex 采信，route:human #7 待续裁）**：准确范围是「本机制运行所在的默认 Node.js 主 realm 内唯一」——`worker_threads` 的 `Worker` 由 `resolveRoot()` 检测 `isMainThread` 显式拒绝（运行时判据可靠）；`node:vm` 的 `Context` 各有独立 `globalThis` 且其中 `isMainThread` 恒为 `true`，Node 无对等可靠判据，选择精确文档化边界而非引入可被绕过的启发式检测（codex 复现验证：两个 `vm.SourceTextModule` 上下文加载真实 `root.mjs` 源码可各自认领不同 ROOT 零冲突）。范围收窄依据：① 触发需 `--experimental-vm-modules` 显式旗标，本仓与消费侧任何默认调用路径均不带此旗标、该 API 默认不可用；② 构造该场景要求攻击者已在同进程内拥有任意代码执行能力，此前提成立时同进程本就不是可信边界；③ `grep` 核验本仓与消费侧零 `node:vm` 使用。触发重新评估的条件：任何一方引入 `node:vm` 消费面，或 VM Modules 转为 Node 默认可用（不只是加装该实验旗标）。详见 `loop-kit/lib/root.mjs` 头注、`docs/plans/loop-kit-extract/review/codex-impl-r5.md`。
 - Casey 侧新增共享引导助手 `loop-kit/lib/boot.mjs`（评审 H2/M2 采信）：...
diff --git a/loop/prd-loop-kit-extract.json b/loop/prd-loop-kit-extract.json
index 3a8eebd..145ba39 100644
--- a/loop/prd-loop-kit-extract.json
+++ b/loop/prd-loop-kit-extract.json
@@ -3,7 +3,7 @@
   "specPath": "docs/plans/loop-kit-extract/plan.md",
   "testChecksums": {
-    "loop-kit/kit-lock.json": "3b31a33ff8c26c3b39a58bd3956715c20a14c4ccb06d0f9e8f3061ed36396d2e",
+    "loop-kit/kit-lock.json": "1c952af1eca9b5e2799080e691b25deae3405efc414a528c8aee7b954b1cbde5",
     "loop-kit/lib/boot.mjs": "9e0cf9ccf0d79975d07676139a30782b31f54411f7f7b64cbcb7b3dc58f89720",
     ...（其余 88 项 testChecksums 字节不变，此处省略）
@@ -90,7 +90,7 @@
-    "tests/fixtures/loop-kit-expected/package/lib/root.mjs": "2f2caf693c7d6aa07b82c6b0f998c311922cdc04eef1b7895b86ca3bf1541b04",
+    "tests/fixtures/loop-kit-expected/package/lib/root.mjs": "f94d84365dbf681c06426b86f2ced61bc512a5787e85257f140eefc57c3153e6",
     "tests/fixtures/loop-kit-expected/package/package.json": "1f435d74bae0b8db750cdd85033b3364b6431212d3b24702c7e4f6a0cf1b1279",
     "tests/fixtures/loop-kit-expected/shim-template.mjs": "57d2271c6b9608445d24f45af84e4c23be14993d00c292c38f67a3b65c3dfb13"
   },
@@ -118,6 +118,11 @@
       "note": "若日后在「worktree-baton」为活动任务的 worktree 里跑本金牌，三者应全绿；本记录只说明本次落地环境下的真实复跑现状与比对口径。"
+    },
+    {
+      "dimension": "「进程唯一 ROOT」范围精确化（route:human #7）：kernel 级人签时 GRILL D4/plan §1.2 对「进程唯一 ROOT」的表述无条件；round-2 实现审第四轮 codex 独立复现：node:vm 的 Context 各有独立 globalThis 且其中 isMainThread 恒为 true，与 worker_threads 不同、Node 无对等可靠运行时判据可拒绝，该场景下「进程唯一」不成立。实现方已把准确范围收窄为「本机制运行所在的默认 Node.js 主 realm 内唯一」，plan.md/GRILL.md/loop-kit/lib/root.mjs 头注已同步该表述，选择精确文档化边界而非引入可被绕过的运行时启发式检测。范围收窄依据：① 触发需 --experimental-vm-modules 显式旗标，本仓与消费侧任何默认调用路径均不带此旗标、该 API 默认不可用；② 构造该场景要求攻击者已在同进程内拥有任意代码执行能力，此前提成立时同进程本就不是可信边界；③ grep 核验本仓与消费侧零 node:vm 使用。",
+      "route": "human",
+      "note": "此为实现阶段发现对已签设计表述的收紧，非重开设计讨论——待 Steven 契约收尾人签时一并确认是否接受该范围表述，或要求改走 codex 建议的备选方案（跨 cooperative VM loader 共享宿主对象保存槽 + 补 VM 回归测试）。触发重新评估的条件：任何一方引入 node:vm 消费面，或 VM Modules 转为 Node 默认可用（不只是加装实验旗标）。在 Steven 确认前，现状（文档化边界、无运行时防护）按本记录原样生效，不视为阻塞项。"
     }
   ],
   "stories": [
@@ -129,7 +134,7 @@（其余 4 处 story evidence 时间戳同型刷新，格式：gate@<ISO时间戳> 全部 acceptance exit 0，此处省略逐条罗列）
```

（完整逐字节 diff 见本仓 `git show 7349441 -- docs/plans/loop-kit-extract/plan.md docs/plans/loop-kit-extract/proposed/GRILL.md loop/prd-loop-kit-extract.json`，评审方 `read-only` 沙箱内可自行核对；上方已呈现全部实质性改动内容，仅 `testChecksums`/`evidence` 中格式重复的其余条目做了省略标注。）

## 5. Diff（包仓 `/mnt/d/ctx/heren/loop-kit`，本轮新增处置：`462c455`→`ea5ed85`）

> 说明：`0f34cc0`→`462c455` 的累积 diff（root.mjs 全部运行时逻辑改动：认领槽进程级共享、
> worker_threads 拒绝、槽防篡改冻结、同值分支补冻结、命名修正、node:vm 边界文档化）已在
> `material-impl-r2.md`~`material-impl-r6.md` 中完整呈现并经 `codex`/`pi` 逐轮审过，此处不再重复；
> 本节是第五次跑发现的 `HIGH` 在包仓侧的处置 diff（纯注释，零运行时逻辑改动）。

```diff
diff --git a/lib/root.mjs b/lib/root.mjs
index 331aafa..9eaa2c5 100644
--- a/lib/root.mjs
+++ b/lib/root.mjs
@@ -9,9 +9,10 @@
 //      cwd（缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
 //   3. 两路皆空/皆无效 → 抛结构化 RootResolutionError；本函数绝不 process.exit 终止宿主进程——
 //      受支持入口（Casey 侧 shim/boot）总先注入有效 ROOT，本函数在受支持路径不会失败。
-//   4. 解析成功即原子认领进程唯一 ROOT：首次认领后不可变、同根幂等；异根立即抛、绝不静默采用
-//      他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前以显式 envRoot 参数调用本函数完成
-//      认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一值，不依赖 cwd 恰好匹配。
+//   4. 解析成功即原子认领进程唯一 ROOT（「进程唯一」的准确范围见语义 6，下同）：首次认领后不可变、
+//      同根幂等；异根立即抛、绝不静默采用他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前
+//      以显式 envRoot 参数调用本函数完成认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一
+//      值，不依赖 cwd 恰好匹配。
 //   5. claimedRoot() 是认领值的只读探针；未认领返回 null。
 //   6. 「进程唯一」准确表述为「本机制运行所在的默认 Node.js 主 realm 内唯一」——不含 worker_threads
 //      的 Worker、不含 node:vm 的 Context 等任何创建独立 globalThis 的替代执行环境（round-2 实现审
```

（本 diff 已是完整逐字节改动——仅 1 处 4 行注释交叉引用，无省略。）
