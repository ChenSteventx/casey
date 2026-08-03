# plan — teachin-cycle-evidence（v3）

> 前置：`GRILL.md` v3。lane=full。目标：闭环活体段真因可见（开发期边车），
> 裁定路径零沾染、缺省零行为差、凭据面四层闸。

## 1. 生产件改动（按真实链路逐文件，codex r1 M6 校准）

真实链路：`bin/casey.mjs` → 薄别名 `bin/teachin-cycle.mjs` → `bin/record.mjs:411`
→ `lib/teachin/replayability-cycle-entry.mjs` → `lib/teachin/dual-replay-orchestrator.mjs`
（生产 façade，静态绑定 canonical 依赖）→ `lib/teachin/dual-replay-orchestrator-core.mjs`
→ runtime adapter → `lib/teachin/raw-event-observation.mjs` → `lib/teachin/raw-replay-runner.mjs`；
同码拒付另在 `lib/dual-replay/replay-completion.mjs`（source/distilled 两组）、
`lib/teachin/raw-axes-adapter.mjs`（formal）、`lib/teachin/prepared-runtime-seam.mjs`。

改（v3，逐文件全列）：
1. 新 `lib/teachin/cycle-evidence-context.mjs`（纯：`AsyncLocalStorage`+`safeEmit`
   +固定枚举+封存式收集器，**零 fs、零 import output 件**）；新
   `lib/teachin/cycle-evidence-output.mjs`（四层闸+digest 派生文件名+原子写，
   失败只清临时件绝不触目标；**全仓 import 站点仅 `bin/record.mjs`**）。
   读取方归属（codex r3 H4 收口）：output 件导出
   `readCycleEvidence(captureSha256, { outDir })`——目录显式入参（hermetic
   金牌不依赖进程级全局），按全量 digest 派生名定位 + 顶层 `captureSha256`
   复核，失配拒认；E7 消费此 API。口径按已收窄的威胁模型（codex code-r2 M3）：
   单侧误放/残留旧档、或改名但内文摘要未同步——在读取方拦下；协调双改
   （改名 + 同步改内文顶层摘要）在界外，见 GRILL D4。
2. `bin/record.mjs`：`als.run(collector, () => 闭环())` 词法包裹；聚合前封存；
   绑定 `captureSha256`、落盘或 `EVIDENCE_*` 非零；控制台一行。
3. safeEmit 点（零判定/键集/返回值改动）：`replay-completion.mjs`（source 六分支
   +distilled 组+catch，另加公开导出面 `extraInputs` 三员共 **21 员**枚举——
   source/resolved/distilled 三枚 completion 同形同理由，resolved 那枚拒付码为
   `SOURCE_SEMANTIC_COMPLETION_INVALID`，codex code-r1 M2）、
   `raw-replay-runner.mjs`（逐事件+observer begin/finish）、
   `raw-event-observation.mjs`（其拒付点）、`raw-axes-adapter.mjs`（formal）、
   `prepared-runtime-seam.mjs`、`dual-replay-orchestrator-core.mjs`（阶段边界）。
4. 明确不改：`bin/casey.mjs`（纯转发）、`bin/teachin-cycle.mjs`（薄别名）、
   `lib/teachin/replayability-cycle-entry.mjs`（入参键集）、
   `lib/teachin/dual-replay-orchestrator.mjs`（生产 façade，纯委托零拒付语义）、
   `lib/teachin/runtime-cycle-adapter.mjs`（适配层无拒付语义）、
   `lib/replay/prepared-run.mjs`（正式面）、一切 authority 形状、`verdict.mjs`、
   正式面（`casey run` 零接触）。

## 2. 金牌（红先行）

`tests/_golden/teachin-cycle-evidence.zero-sut.golden.mjs`：GRILL D5 的 E1-E9
（E3 逐点矩阵；E4a/E4b 两组分立；E5 产物字节全等+调用/关闭次数+零边车副作用+
控制台全等；E6 逐发射点；E7 绑定单判+失败不触目标；E8 并发双 cycle 零串账；
E9 依赖闭包三钉：context 零 fs 零 import output、output 全仓仅 `bin/record.mjs`
导入、纯核心取证 import 只指向 context 件）。

## 3. prd 与验收

`loop/prd-teachin-cycle-evidence.json`：s1 金牌红→绿；s2 邻接复跑
（cycle-entry / raw-runner / raw-event-observation / raw-axes-adapter /
prepared-run / equivalence-core / equivalence-completion /
equivalence-resolved-completion / **equivalence-production-boundary（静态形状钉）** /
orchestrator / orchestrator-wiring / runtime-cycle-adapter / clear-fill /
nav-expansion + record-capture）；s3 漂移扫+term-lint。

验收点（退出码+边车形状）：
- A1 金牌红→绿；A2 邻接零回归；A3 零漂移；
- A4（route:human）：Steven 重录一次，边车落盘且 `RUN_COMPLETION_INVALID`
  的 `refusalPoint` **唯一归因**（每个同码生产点可区分——这是本契约的完成语义）。

## 3b. codex 代码审 r1 五条 Medium 的收口（本轮）

判 `REVIEW_CHANGES_REQUIRED`，五条全采信、逐条配负控实测
（探针与输出在 `fix-probes/`）：
- **M1 时序不等价**：删 `reportedCall` async 包裹，通报同步写进原三处
  `catch (error)` 内、随后原样 `return denied(...)`；金牌 E0b 的 catch 字面量钉换签
  （逐字节钉新形态 + 反 rig 钉禁包裹函数）。活体探针实测：微任务世代 3→2、
  异常栈帧 6→4、包裹帧消失，与取证落地前基线两轴全等。
- **M2 公开可达分支未通报**：`refusalPoint` 枚举 18→21，三枚 `input-shape` 接通
  并各配真实分支钉（直调公开导出、传畸形 `extraInputs`、断言归因、拒付码与事件数）。
  codex 只探了两枚返回 `RUN_COMPLETION_INVALID` 的；`completeResolvedSourceReplay`
  那枚同形同理由（拒付码 `SOURCE_SEMANTIC_COMPLETION_INVALID`）一并接通，
  同形分支不留半接。
- **M3 双伪造可绕**：走收窄口径——威胁模型只防「误放/残留旧档冒充本次证据」，
  不防同一可写目录内的蓄意篡改（那把写权限连 capture 本体都能改）；
  GRILL D4 与金牌 E7 措辞同步，`readCycleEvidence` 实现不动。
- **M4 rig + 合成替身**：静态钉换签为结构断言（闭环调用必须落在
  `runWithCycleEvidence(收集器, …)` 词法内 + 包裹到调用之间禁多铸 await 跳）；
  该静态门的威胁模型按 codex code-r6 写诚实：它是**协作文件的回归闸**，
  防重构走形与迎合钉的 rig 回归，**不防**拥有本仓写权的对抗性混淆——
  那样的对抗者可以直接改金牌本身，静态门在该威胁下自反；
  验收标准只有一条：**真件自然写法原样过、任何走形当场红**；
  `bin/record.mjs` 回自然形态（非 async 回调、零多余 Promise）；
  金牌加 E2 真实路径钉与 E5c 更深双跑（均零 SUT）。
- **M5 自证只扫字面量**：金牌重启进凭据闸隔离根（见 GRILL D5 E4c），
  自证钉升级为机制证明；生产件零改动、凭据源零注入口。

## 4. 评审与风险

codex plan r2 delta → 实现（opus）→ codex 快速 delta（观测面小契约比例适配，
grok 不加轮，如实记账）。
- R1 侧通道逃逸=观测上下文泄进判定（E5/E6+production-boundary 复跑双钉）；
- R2 字符串逃逸=凭据面事故（D3 四层闸+E4 五类反例）；
- R3 误放/残留旧档冒充（D4 收窄口径的绑定单判 + E7；协调双改在界外）；
- R4 异步扩散：`safeEmit` 同步契约、不 await、不进 Promise 链（E6 钉）。

## 5. 后继轮：内层归因下沉（2026-07-30 已批准，2026-08-03 重开 owner）

本 owner 契约按 `docs/plans/cycle-evidence-inner-reason/{GRILL.md,plan.md}`
重开 full 流程，处理已签红先行验收 E10：`raw-axes-adapter.mjs` 的 15 个
拒付位必须先经生产者局部六码归一器同步通报到新归因点
`raw-axes.projection-denied`，再保持原返回值与控制流不变。

验收继续由本 owner 的单一冻结件
`tests/_golden/teachin-cycle-evidence.zero-sut.golden.mjs` 承担；其现役摘要已在
`loop/prd-teachin-cycle-evidence.json` 经 Steven 2026-07-31 明签。不得新建
第二份冻结锁，也不得改验收字节。本轮完成条件是该 owner gate 由当前 s1 红恢复
3/3 GREEN，并完成既有后继 plan 规定的邻接复跑、异构实现评审与诚实留账。
