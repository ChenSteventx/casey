# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。
> 下方「当前状态」是权威现状；「历史层」仅供溯源。

## 当前状态（2026-07-01）

2026-07-01（跨两 session）开发流程兜底 + 收口一批（最近一 session 6 提交 `9a9ff03`→`9c5e4cf` 全入 dev；当下工作树以 git status 为准）：

1. 模型分层升级——`loop/config.json` 改 Opus 4.8 ultracode 主环 + Sonnet 5 max subagent 轻车道 + 三级兜底梯（详见「锁定的决策」2026-07-01 条）。
2. `term-guard` 契约（统一语言强制兜底，6 阶段全绿）：甲 `bin/term-guard.mjs`（零 LLM 拦 R3 比喻格式 / R6 加粗未登记英文与弃用别名，引用豁免只认反引号）+ 乙 `bin/term-judge.mjs`（语义评分员，待非 Claude 密钥）；codex 九轮异构评审 pass；Stop 钩子 warn-only 接线（不改 loop-kit）。
3. `model-lane-guard` 契约（模型分层强制兜底，6 阶段收口）：I1 `bin/verdict-purity-guard.mjs`（静态扫 `verdict.mjs` 依赖闭包无 LLM/网络客户端，接入 `casey selftest --tier1`，护栏 #15）+ I2 `bin/config-lane-guard.mjs` + `.claude/settings.json` 独立 PostToolUse 钩子（断言 config 异构不塌同族，护栏 #9）；codex 四轮异构评审 6→5→2→0 收敛，逐轮钉红 golden 硬化（全局 fetch/注释插入/目录 index/minified import/未映射族 fail-closed/路径穿越+软链）。**两条不变量从文档策略变成机制强制，守卫已上线。**
4. `hermetic-gap-freeze`（direct）：两份缺口 coverage golden 补冻——P7 credentialGate（护栏 #7 落盘前拒写）入 `prd-p7-report`、P6 nextStatus superseded 状态边入 `prd-p6-selfheal`，gate 各 2/2。
5. `p5-replay` learn 收口——P5 回放核心契约 6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；tier-2 真机 route:human 仍未走。
6. `seams-freeze-v2`（full）grill 进行中——接缝冻结第二批，3 承重决策已人签、run-history 三改已落（见「契约 / 运维」与「下一步」1）。

以下 P5 与排期为 2026-06-30 快照（★注意：其中 P5 的 review/learn 已在最近一 session 收口、6 阶段全 done，见「当前状态」与「契约 / 运维」；本段只溯源、勿据其中「待跑」字样判现状）：

排期 v2（接缝优先并行）落地 → 第1层接缝冻结完成 → 第2层全部落地：P5 回放内核（★最后一轨）loop 绿——真 chromium 回放假 SUT（被测系统）→ 三轴 → 喂已冻 `verdict.mjs` → 四态全中（golden 10/10）。`casey selftest --tier1` 无回归。P5 review（异构评审）+ learn 后续已收口（本句为 2026-06-30 快照，收口详见「当前状态」）；tier-2 真机 route:human 未走（gate 绿 != 完成，护栏 #16）。排期 v3 见 `docs/plans/roadmap-parallel.md` 文末（2026-06-30 重排）。

里程碑进度：

- P2 裁判内核（`p2-intent-compile`）：loop 绿 + review 收口（真异构 codex 评审 7 修复 + 三镜头核验，见下「异构评审」「真异构评审」节）。learn 未走。
- 排期 v2：`docs/plans/roadmap-parallel.md` —— 接缝优先、运行时依赖 != 开发顺序、P3 不在关键路径、冻接缝后 P4/P5/P6/P7 全可并行（机理同 P2 对合成 fixture 跑 hermetic）。
- 第1层接缝冻结（契约 `seams-freeze`，gate 1/1）：5 条接缝 schema + 合成 fixture（events / observed-reality / report-model / drift-patch / expected-frozen）+ `prd.schema` v2（向后兼容 v1），落 `tests/_golden/schemas/` + `tests/_golden/fixtures/seams/`，golden `tests/_golden/seams-freeze.golden.mjs`。3 决定：冻结 expected[] 走旁车 `expected.frozen.json`（护栏 #5）、`expectedVerdict` 命名、`assertionOp` 封闭 enum。
- 第2层（并行 worktree 建 → 合并 dev → 各 gate 亲验绿）：
  - track-F（`p2-failsafe-coverage`）：C1-C4 + B1-B6/A1 回归锁 golden 3 个（`tests/_golden/p2-*-coverage.golden.mjs`），把真异构评审延后项锁死。
  - P7（`p7-report`）：`lib/report.mjs` + `bin/report.mjs` 报告渲染器（report-model → HTML/Markdown/json，多态徽章 + 缺陷单仅 SUT_DEFECT + 期望对实际 + 凭据兜底门）。
  - P4（`p4-freeze`）：`lib/expected-compile.mjs`（expected.frozen → check 命令）+ `lib/sign-gate.mjs`（人签字段校验）确定性骨架。
  - P6（`p6-selfheal`）：`lib/heal-gate.mjs`（准入门只对 HARNESS_ERROR）+ `lib/drift-patch.mjs`（非就地补丁、签名 before===after 等值、人签后才 apply）。
- P5（`p5-replay`，full lane）：loop 绿（2026-06-30）。Phase 0+1（环境 + 假 SUT + 红 golden）+ Phase 2 实现全落：`bin/replay.mjs` 回放器 + `lib/{replay-actions,replay-forensics,replay-assert,drift-probe,instantiate}.mjs`——真 chromium 回放假 SUT，按 intentId 聚合事件依序回放、过点击身份门出动作轴、CDP 真发起方归因出取证轴（背景 401 归 null 不背书，非时间窗）、按 expected 评估出断言轴，三轴写 axes.json 喂已冻 `verdict.mjs`；只读漂移探针 `findEquivalentAffordance` 从 atom+targetName 构造 canonical 查 count===1（不点不改 spec）。golden `p5-replay.golden.mjs` 10/10 全绿（四态映射 `verdict-cases` 八案 + drift/vanished 复刻 `drift-patch` canonical）。accept 前修法发现并修掉一个冻结夹具缺陷：进程内假 SUT 被同步 `execFileSync(replay)` 冻住事件循环、答不了 replay 浏览器（goto 卡死、之前误判 21 分钟「挂死」），改 `server.mjs` 把假 SUT fork 出独立进程（8 态行为一字未改）→ server.mjs checksum 重签入 prd、accept 重签、gate GREEN。runner 是 `verdict.mjs` 上游产出者、绝不在回放进程内裁定（护栏 #15）。（本条为 2026-06-30 快照；review 异构评审 + learn 后续已收口，见「P5 回放异构评审收口」与「当前状态」。）

## 实现产物（live）

| Story | 文件 | 要点 |
|---|---|---|
| S1 裁判内核 | `bin/verdict.mjs` | §4.2 判定树、零 LLM、按断言种类不可知、断言续跑、取证按本步归因、入参 fail-closed |
| | `lib/forensics.mjs` | `checkErrorEnvelope` 信封成功字段参数化；缺配置 fail-closed |
| | `bin/check.mjs` | 断言词表/op 硬闸，`--validate-only`；断言 kind 枚举唯一活在此处 |
| S2 编译门 | `lib/compile-gate.mjs` | 移植 regress `_flow-authoring` 双闸 + 前缀从 `uniquePrefix` 注入；空/缺 prefix 拒绝放行 |
| S3 对账 | design §2.1 / bootstrap plan | 加 `noErrorToast`、信封参数化、`countChange equals 0` 例外；P3 recorder 降级「陌生站点孵化」 |
| S1 回放器 (P5) | `bin/replay.mjs` | 回放假 SUT 产三轴 axes、编排 + 看门狗（绝不挂死）+ 强制退出；裁判零 LLM（只产事实不裁定，护栏 #15）|
| | `lib/replay-actions.mjs` | 语义定位器 + 点击身份门（unique/fallback_first/none）；守卫不抛、动作失败翻译成轴信号交 verdict |
| | `lib/replay-forensics.mjs` | `watchNetworkForensics`：CDP 真发起方归因、背景 denylist 归 null、错误信封复用 `forensics.checkErrorEnvelope`、SSE `finished` 静默点；getResponseBody 套超时防挂死 |
| | `lib/replay-assert.mjs` | 断言轴评估（typed kind 算 ok，verdict 对 kind 不可知，护栏 #17）；未实现 kind 一律 ok:false（fail-safe）|
| | `lib/drift-probe.mjs` | 只读漂移探针 `findEquivalentAffordance`（同稳定签名 count===1，不点不改 spec，拆 P5/P6 循环依赖）|
| | `lib/instantiate.mjs` | 占位符回填（冻占位符不冻一次性值，护栏 #6）|

配套设计落档：
- `docs/design/report-spec.md` —— 最终报告规格（拆分布局 + HTML/Markdown/json + 多态裁定，反向约束 `verdict.json` 字段）。
- `docs/plans/p2-intent-compile/flywheel-schedule.md` —— 飞轮排期表（五维全加法、第二条移植 `chiefcomplaint_smoke`、23 条 R9 坐标 flow 标 route:human）。
- 交互 demo（演示壳、合成数据，HTML + Markdown 双视图）：`M:\home\liufei\casey-report-demo.html`。

## 异构评审（Claude 侧，2026-06-29）

5 镜头对抗评审 + 逐条核验：26 发现 / 18 确认。3 条 major + 一串防御性 minor，全是 fail-safe 反向不变量缺口（当时 latent，P5 回放未建故未触发）。已**不动冻结测试**修掉，gate 仍 GREEN：

- 生命周期取证（crash / pageerror）改为按本步归因（原来全局信号会翻任意步的 verdict）。
- 缺失 action 轴不再误判成 actionPerformed=true（防畸形步假 PASS）。
- 无硬断言不静默 PASS、缺 stepId 不假命中、`verdict.mjs` 入参 fail-closed。
- 编译门空/缺 prefix 拒绝放行（原来 `startsWith('')` 恒真把破坏性硬闸静默清零）。
- 信封缺配置返回 ok:false、不默认放行。

延后项（不静默丢，留后续 acceptance-gate / design 对账）：
- 冻结 golden 边界覆盖缺口：`atom` 卷回未断言、空 prefix 无 case、CASE_DEFECT 分支无 case —— 改 golden 触 ratchet，须走契约更新补冻。
- design §6 把「带期望对实际」的 `verdict.json` 与 `verdict.mjs` 最小输出混名、`passes` 归属错挂；§4.2/§9.1 取证记录缺 `attributedStepId` —— 留 design 对账（`report-spec` §7 已记）。

## 真异构评审（codex 侧，2026-06-29）

补上「非同族」这一环（护栏 #9：只喂 spec+diff+门禁证据，不喂实现者叙事）。codex 实际模型 gpt-5.5、xhigh 推理、只读。Windows 只读沙箱起不了进程（CreateProcessWithLogonW 267、七次重试全败、首轮交白卷），改把评审包 inline 进 stdin、明令不跑 shell 绕过；评审包在 `scratchpad/codex-review/`。11 条发现，分诊后 7 条落 impl（fail-safe hardening，不动冻结 golden、gate 仍 GREEN）：

- B4/B5（最关键）：破坏性前缀硬闸原裹在 `checkStateMachine` 里、只在 `registry.states` 存在时跑 —— 无 states 注册表会整条绕过，空/缺实体名旧版静默放行。抽成独立 `checkDestructivePrefix`，不依赖 states、空名 fail-closed。
- B1：`soft` 仅 `=== true` 才不进裁定树（非布尔 truthy 不再静默降级失败硬断言）。
- B2：`HARNESS_ERROR` 须 `resolution==='none'` 正向 miss 证据 + 漂移探针，缺则落 fail-safe（护栏 #13，防真缺陷被误当可自愈）。
- B3：`verdict` 入参 `steps` 非数组/空 → exit 65（不再静默写空 verdict）。
- B6：信封缺 `successValue`、body 缺字段、空白字段名 → 一律 `ok:false`（堵 `undefined===undefined` 假判）。
- A1：`successField` 命中凭据字段名 denylist → 不读不回传值（护栏 #7 落到代码）。

经验证：13 探针全过（含反向不误伤：真漂移仍 `HARNESS_ERROR`、合法前缀仍放行、正常信封仍 `ok:true`）；三镜头对抗核验（回归 / 新 fail-open / 护栏，run `wf_317cbbc4-fb6`）全 sound、0 真问题。评审取证留 `loop/audit.jsonl`（review/pass 记录）。

延后项进展（新增独立回归锁 golden、不动冻结测试，详见下方「P5 回放异构评审收口」）：
- **已补冻**（`tests/_golden/p5-replay-coverage.golden.mjs`，commit b0dcaff，gate GREEN 2/2）：
  - C1 全闭：合成 StepAxes 喂已冻 `verdict.mjs`——「硬断言失败 + 500 归因别步/背景归 null → 非 SUT_DEFECT（落 SUT_DEFECT_OR_STALE）」对「归因对齐本步 → SUT_DEFECT」的辨别 case 已钉。
  - C2 的 pageerror 半边：pageerror 归因本步 → SUT_DEFECT、归因别步 → 不背书本步（非全局布尔）已钉。
- **仍待钉**（下轮 acceptance-gate，多属 verdict/forensics 配置层、非 P5 回放）：
  - C2 余项：crash 背书分支、缺 stepId 不背书。
  - C3：空 / 缺 prefix + 空实体名破坏性硬闸，无 case。
  - C4：信封坏配置（缺 successValue / 空白字段名）+ 敏感字段 denylist，无 case。
  - B1（非布尔 soft）、B2（缺 miss 证据不自愈）、B3（steps 非数组/空 fail-closed）三条分支。

## P5 回放异构评审收口（codex 侧，2026-06-30）

P5 回放内核 loop 绿后接异构评审（与上节 P2/verdict 评审不同轮）。codex（gpt-5.5 真非同族、xhigh、只读、空 cwd 喂 stdin，护栏 #9）判 FAIL、10 发现（5 High + 4 Medium + 1 Low），逐条核实全成立、全修（commit b982171，改 lib/bin 不动冻结 golden；仅 `server.mjs` 的 L10 改动重签 checksum）。最严重 H3：唯一元素 click/fill/goto 抛错被吞却仍谎报 `actionPerformed=true`（同族自建漏掉的 fail-open）。要点修复：动作轴改诚实（失败落 `action_failed`→verdict INDETERMINATE；多匹配绝不点击；统一身份门 count===1 才 unique）、取证归因收紧到动作因果作用域（预导航期 `currentStepId=null`，非时间窗）、pageerror 按步归因不全局污染、网络背书归一到代表步对齐 verdict、断言证不出一律 ok:false、drain 先等在途前台 API。golden p5-replay 10/10 复绿 + selftest tier1 无回归 + gate GREEN。

收口补冻（commit b0dcaff）：上述 fail-safe 不变量的失败方向 p5-replay.golden 不覆盖，新增 `tests/_golden/p5-replay-coverage.golden.mjs`（13 检查）作回归锁、并入 prd-p5-replay（testChecksums + story `s2-failsafe-coverage`，ratchet 只增不减=护栏 #1 允许）。锁两层：断言轴证不出/未实现 kind→ok:false（含正反两向防恒-false 假绿）+ 合成 StepAxes 喂已冻 verdict.mjs 验四态归因。gate GREEN 2/2、passes 由 gate 写。P5 流水线截至本节（2026-06-30）grill→plan→accept→loop→review done；learn 于最近一 session 收口、6 阶段全 done（见「当前状态」）。

## 锁定的决策（2026-06-29）

- **岔一**（已锁）：轴通用 = 实现纪律，不是预留字段。`verdict.mjs` 按断言种类不可知、kind 枚举只在 `check.mjs`，新维度纯加法；流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。已落护栏第十七条。
- **质量接口**（已锁）：「内容好不好」走独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。
- **岔二**（已采纳）：压裁判保守分支最便宜的办法是先在 catalog 上多注合成故障（漂移→HARNESS_ERROR、元素消失→AFFORDANCE_ABSENT、真数据多匹配→ambiguous），再移植第二条 `chiefcomplaint_smoke`。
- **岔三**（已采纳）：第一条走 `full`；之后辐条默认轻车道（跳 grill、保留 plan+accept+loop），碰冻结内核才升 `full`；`accept` 任何车道都不跳。
- 全文：`docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。

### 模型分层升级 + 三级兜底（2026-07-01，已锁）

> **范围**：仅**开发流程**的模型分层道（谁来跑 loop：`toil`/`implementation`/`review`），**不涉及 Casey 产品功能**——编译/回放/裁定/报告 的运行时 LLM 接缝（相1 编译、相5 自愈、将来 `LLM-judge`）均不在本决策内；`verdict.mjs` 恒零 LLM。即配置顶层「两类 lane 正交」里的「模型分层道」那一类。

- **分层**：`loop/config.json` 模型分层道改——主环 Opus 4.8 跑 ultracode（xhigh + 动态工作流编排）当编排器，承 full 车道与冻结内核；轻车道的活派 Sonnet 5 独立 subagent（max effort）。切 subagent 而非主环换模型：prompt 缓存不被打断、上下文隔离（claude-api 缓存文档明写的正确写法）。`review` 未动，`sonnet` 仍同族末位 fallback。`toil` 缓：夜跑暂无需求，2026-07-01 撤回原 `codex:gpt-5.5`，待有 nightly runner 再议。
- **三级兜底阶梯（运行时 fail-safe 升级）**：开发任务上 Sonnet 5 max 一直卡（`circuitBreaker` 判 `zeroCommitRounds`/`sameErrorRounds` 跳闸）→ 升 Opus 4.8 xhigh（原 plan）重试 → 再卡 → `NEEDS_HUMAN` 写 `loop/inbox.md`（护栏 #14 fail-safe 不 fail-open，能力升满仍证不出就路由人、绝不静默过）。机制锚已在 `circuitBreaker` + `breaker.mjs`；`toil` 不入此梯（机械小修，跳闸照旧写 inbox）。
- **静态强制兜底（两条不变量，机器守；模型能自由换的前提）**：
  - I1 裁判零 LLM（护栏 #15，承重）：`bin/verdict.mjs` 传递依赖闭包零 LLM/网络客户端——「上游随便换模型都不出静默假 PASS」的根兜底。
  - I2 异构评审不塌同族（护栏 #9 / ADR 异构冗余）：`review.model` 家族 ≠ `implementation.model` 家族，`sonnet`/`opus` 只能在 review `fallback`、绝不当主 `model`。
  - I3「Sonnet 5 只作 subagent 不换主环」是编排期运行时属性、静态不可查，不假装可强制；其兜底即 I1（verdict 零 LLM + 冻结 golden + gate 三重网）。
- **已建**（`model-lane-guard` 契约收口，2026-07-01）：I1 verdict 零依赖断言已入 `casey selftest --tier1`（`bin/verdict-purity-guard.mjs` 静态扫依赖闭包）；I2 config 不变量 PostToolUse 钩子已接（`bin/config-lane-guard{,-hook}.mjs` + `.claude/settings.json` 独立条）。**仍待建**：三级兜底 watcher 读 `loop/.breaker-state.json` 自动再派——另起辐条、不在 model-lane-guard 契约内（别 ad-hoc 破护栏 #11、别改 loop-kit engine ADR-0001）。config 的 `_doc` 是当前策略事实源。

## 下一步

> 新会话接续顺序：① 接续活契约 `seams-freeze-v2` 的 grill（见下 1）→ ② 其余任选。活契约现为 `seams-freeze-v2`（full，grill 进行中），切 baton 见「契约 / 运维」。

1. **首推（接续活契约）** `seams-freeze-v2` grill——接缝冻结第二批。3 决策已人签：1.1 run-history 删 `cacheStatus`/`cacheHitRate`、编译期复用溯源字段登记 deferred（不动已冻 `events.schema`、本轮不建）；2.2 `channelDriver` 拉进本轮 co-grill（范围扩到四接缝、channelDriver 净新无草稿）；3.3 fingerprint 聚类粒度延后到哈希实现阶段 route:human。7 机械决策见 `docs/plans/seams-freeze-v2/proposed/GRILL-DECISIONS.md`。run-history 三改已落已提交（`method`→`action` / `intentId` 改 `minLength:1` / 删 `cacheStatus`）。剩：run-history 的 fixture+grill.md 跟 schema 改 → 起草净新 `channelDriver` 接缝（`actionSpace` ⊆ `events.schema` 的 action 枚举、凭据不进护栏 #7）+ 定它与 action-vocabulary 边界（决策 2.2 核心）→ action-vocabulary/failure-ledger 决策落地 → 写合并 grill.md + 登记 `CONTEXT.md` 新词 → advance grill → plan → accept（冻四接缝 schema+fixture 入新 `prd-seams-freeze-v2`）→ loop（golden 校验器）→ codex 异构评审 → learn。
2. `p2-intent-compile` 的 learn（沉淀收尾，轻）。
3. tier-2 真机（route:human，护栏 #16 gate 绿 != 完成）：`catalog_wf_crud` 真站全 PASS + 注 HTTP500 出 `SUT_DEFECT` + CDP initiator 真发起方在真 Heren 流量下可靠度（ADR-0007 推翻条件）。依赖 P3 编译 + P5 真回放。
4. Layer-3 集成（排期 v3 第 3 层）：compile-gate 真产物 → P5 真回放 → verdict → P7 报告，首条 web 端到端（真报告——录屏/trace/截图由真回放产出，不再是合成 fixture）。
5. `term-guard` 乙真接线（待 `~/.loop-kit` 非 Claude 密钥）：`bin/term-judge.mjs` 的 `callRealJudge` 接真评分员（复用 review 道 DeepSeek/codex 路径），观察期无误判后把 `bin/term-guard-hook.mjs` 的 `WARN_ONLY` 置 false 切硬拦。
6. push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓。
7. 坏引用挂账（route:human）：loop 纪律 hook 引的 `docs/decisions/2026-06-12-loop-kit.md` 不存在，根在冻结 `loop-kit/bin/hook-loop-triage.mjs:8` 与 `.claude/skills/acceptance-gate/SKILL.md:8`，真身 `docs/adr/0001-reuse-loop-kit.md`。

## 契约 / 运维

- 活契约 `loop/active-contract.json`（runtime、gitignored）现 = `seams-freeze-v2`（full，grill 进行中、六阶段全 false）。切 baton：`contract init <slug>` 重置台账（不丢磁盘草稿）。要提交而活契约是 pre-loop 的 full：先 `init` 一个 `direct` 契约授权 commit、提完 re-init 原契约恢复 baton（本会话即如此提交 6 笔）。恢复某已 done 契约的台账：re-init + 逐阶段 re-advance（grill 带 `--user-confirmed`、accept 带 `--red-verified`、artifact 交对应产物），gate 复验绿背书。
- 契约一览：
  - `seams-freeze-v2`（full）：grill 进行中（六阶段全 false）。见「下一步」1。
  - `term-guard`：6 阶段 done（gate GREEN 2/2、codex 九轮异构评审 pass、Stop 钩子 warn-only；乙真接线待密钥见「下一步」5）。
  - `model-lane-guard`：6 阶段 done（gate GREEN 2/2、codex 四轮异构评审 6→5→2→0 收敛 pass；I1+I2 守卫上线）。
  - `hermetic-gap-freeze`（direct）：done（两份缺口 coverage golden 补冻入 prd-p7-report / prd-p6-selfheal，gate 各 2/2）。
  - `p5-replay`（full）：6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；tier-2 真机 route:human 未走。
  - `p2-intent-compile`：仅 learn 待。其余（seams-freeze / p2-failsafe-coverage / p7-report / p4-freeze / p6-selfheal）loop done、产物落 dev。
- 单活契约 baton 教训（重要）：loop-kit 是单活契约（hook 读主树共享 `active-contract.json`）。本会话并行起多契约（worktree 隔离）撞了这个单 baton 槽——worktree 子代理 commit 受主树 baton 互锁：P6 子代理曾临时翻主 baton（已还原）、P4 子代理被拦只暂存未提交。landing 办法：已 committed 的分支用 `git merge`（不被 commit 互锁拦）；未提交的（P4）把文件拷进 dev、把主 baton 临时切到其真实 loop-done 契约提交、再还原。未来真并行须按 design §3.1：`LOOP_CONTRACT_FILE` 参数化 + `breaker --state`（未建）。
- push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓（参考 autotester = 私有 `ChenSteventx/autotester`）。
- 删不动的残留：`docs/plans/seams-freeze/proposed/`（评审副本，破坏性删除被权限层拦，待人 `! Remove-Item -Recurse -Force` 清）。
- 旧 `p2-testcase` 契约已被取代作废。term-lint 全程过；Windows git 需 `git config windows.appendAtomically false`（已设，否则 merge 报 index.lock 写错）。

## 历史层（溯源用，非现状）

- `P0/P1`（live，不变）：loop-kit 引擎（与 autotester 字节一致，ADR-0001）、护栏（12 迁移 + 13–17 新增）、`CONTEXT.md` 两限界上下文、ADR 0001–0006、`casey selftest --tier1`。
- **2026-06-26**：P2 重定义走完 grill→plan→accept，6 路深读 `regress_autotest`、ADR-0006 的 14 风险落代码核验、冻结 5 红 golden + 2 fixture + prd，停在 loop 前。详见 `docs/plans/p2-intent-compile/grill.md`。
- **2026-06-29**：开 loop 前的岔一/二/三 + 质量接口讨论 → 落档（FLYWHEEL/design/report-spec/flywheel-schedule）→ 实现 loop（S1/S2/S3 绿）→ 提交 `594ecf4` → Claude 侧异构评审 → 收口。
- **2026-06-29 晚续**：codex 真异构评审收口（7 修复，`7923088`）→ omc 列禁言禁用 → 排期 v2（接缝优先并行，`roadmap-parallel.md`）→ 第1层 5 接缝冻结（`4d184f6`）→ 第2层并行 worktree：track-F/P7（`b00b7c7`/`0832ed3`，合并 `e06e309`/`9d92892`）+ P6（`8734307`，合并 `1a37eba`）+ P4（`5a8b08d`）→ P5 grill+plan（ADR-0007）。第2层四轨全在 dev 亲验绿。单活契约 baton 撞并行的教训见「契约/运维」。
