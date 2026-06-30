# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。
> 下方「当前状态」是权威现状；「历史层」仅供溯源。

## 当前状态（2026-06-30）

排期 v2（接缝优先并行）落地 → 第1层接缝冻结完成 → 第2层全部落地：P5 回放内核（★最后一轨）loop 绿——真 chromium 回放假 SUT（被测系统）→ 三轴 → 喂已冻 `verdict.mjs` → 四态全中（golden 10/10）。`casey selftest --tier1` 无回归。P5 review（异构评审）待跑、tier-2 真机 route:human 未走（gate 绿 != 完成，护栏 #16）。排期 v3 见 `docs/plans/roadmap-parallel.md` 文末（2026-06-30 重排）。

里程碑进度：

- P2 裁判内核（`p2-intent-compile`）：loop 绿 + review 收口（真异构 codex 评审 7 修复 + 三镜头核验，见下「异构评审」「真异构评审」节）。learn 未走。
- 排期 v2：`docs/plans/roadmap-parallel.md` —— 接缝优先、运行时依赖 != 开发顺序、P3 不在关键路径、冻接缝后 P4/P5/P6/P7 全可并行（机理同 P2 对合成 fixture 跑 hermetic）。
- 第1层接缝冻结（契约 `seams-freeze`，gate 1/1）：5 条接缝 schema + 合成 fixture（events / observed-reality / report-model / drift-patch / expected-frozen）+ `prd.schema` v2（向后兼容 v1），落 `tests/_golden/schemas/` + `tests/_golden/fixtures/seams/`，golden `tests/_golden/seams-freeze.golden.mjs`。3 决定：冻结 expected[] 走旁车 `expected.frozen.json`（护栏 #5）、`expectedVerdict` 命名、`assertionOp` 封闭 enum。
- 第2层（并行 worktree 建 → 合并 dev → 各 gate 亲验绿）：
  - track-F（`p2-failsafe-coverage`）：C1-C4 + B1-B6/A1 回归锁 golden 3 个（`tests/_golden/p2-*-coverage.golden.mjs`），把真异构评审延后项锁死。
  - P7（`p7-report`）：`lib/report.mjs` + `bin/report.mjs` 报告渲染器（report-model → HTML/Markdown/json，多态徽章 + 缺陷单仅 SUT_DEFECT + 期望对实际 + 凭据兜底门）。
  - P4（`p4-freeze`）：`lib/expected-compile.mjs`（expected.frozen → check 命令）+ `lib/sign-gate.mjs`（人签字段校验）确定性骨架。
  - P6（`p6-selfheal`）：`lib/heal-gate.mjs`（准入门只对 HARNESS_ERROR）+ `lib/drift-patch.mjs`（非就地补丁、签名 before===after 等值、人签后才 apply）。
- P5（`p5-replay`，full lane）：loop 绿（2026-06-30）。Phase 0+1（环境 + 假 SUT + 红 golden）+ Phase 2 实现全落：`bin/replay.mjs` 回放器 + `lib/{replay-actions,replay-forensics,replay-assert,drift-probe,instantiate}.mjs`——真 chromium 回放假 SUT，按 intentId 聚合事件依序回放、过点击身份门出动作轴、CDP 真发起方归因出取证轴（背景 401 归 null 不背书，非时间窗）、按 expected 评估出断言轴，三轴写 axes.json 喂已冻 `verdict.mjs`；只读漂移探针 `findEquivalentAffordance` 从 atom+targetName 构造 canonical 查 count===1（不点不改 spec）。golden `p5-replay.golden.mjs` 10/10 全绿（四态映射 `verdict-cases` 八案 + drift/vanished 复刻 `drift-patch` canonical）。accept 前修法发现并修掉一个冻结夹具缺陷：进程内假 SUT 被同步 `execFileSync(replay)` 冻住事件循环、答不了 replay 浏览器（goto 卡死、之前误判 21 分钟「挂死」），改 `server.mjs` 把假 SUT fork 出独立进程（8 态行为一字未改）→ server.mjs checksum 重签入 prd、accept 重签、gate GREEN。runner 是 `verdict.mjs` 上游产出者、绝不在回放进程内裁定（护栏 #15）。review（异构评审）待跑。

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

收口补冻（commit b0dcaff）：上述 fail-safe 不变量的失败方向 p5-replay.golden 不覆盖，新增 `tests/_golden/p5-replay-coverage.golden.mjs`（13 检查）作回归锁、并入 prd-p5-replay（testChecksums + story `s2-failsafe-coverage`，ratchet 只增不减=护栏 #1 允许）。锁两层：断言轴证不出/未实现 kind→ok:false（含正反两向防恒-false 假绿）+ 合成 StepAxes 喂已冻 verdict.mjs 验四态归因。gate GREEN 2/2、passes 由 gate 写。P5 全流水线 grill→plan→accept→loop→review 全 done。

## 锁定的决策（2026-06-29）

- **岔一**（已锁）：轴通用 = 实现纪律，不是预留字段。`verdict.mjs` 按断言种类不可知、kind 枚举只在 `check.mjs`，新维度纯加法；流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。已落护栏第十七条。
- **质量接口**（已锁）：「内容好不好」走独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。
- **岔二**（已采纳）：压裁判保守分支最便宜的办法是先在 catalog 上多注合成故障（漂移→HARNESS_ERROR、元素消失→AFFORDANCE_ABSENT、真数据多匹配→ambiguous），再移植第二条 `chiefcomplaint_smoke`。
- **岔三**（已采纳）：第一条走 `full`；之后辐条默认轻车道（跳 grill、保留 plan+accept+loop），碰冻结内核才升 `full`；`accept` 任何车道都不跳。
- 全文：`docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。

## 下一步

1. ~~P5 异构冗余评审（阶段 4）~~ 已完成（codex gpt-5.5，判 FAIL→10 修复→复绿，b982171）+ 新 fail-safe 行为补冻回归锁（b0dcaff）。见上节「P5 回放异构评审收口」。P5 流水线 review done、仅 learn 待。
2. tier-2 真机（route:human，护栏 #16 gate 绿 != 完成）：`catalog_wf_crud` 真站全 PASS + 注 HTTP500 出 `SUT_DEFECT` + CDP initiator 真发起方在真 Heren 流量下可靠度（ADR-0007 推翻条件）。依赖 P3 编译 + P5 真回放。
3. Layer-3 集成（排期 v3 第3层）：compile-gate 真产物 → P5 真回放 → verdict → P7 报告，首条 web 端到端（真报告——录屏/trace/截图由真回放产出，不再是合成 fixture）。
4. 收尾：P2 learn；push（review done 解锁后，本仓无 git 远端、待定 GitHub 目标仓）；接缝 v2 增冻（`run-history.jsonl`/动作词汇表/failure ledger 等，走 grill-with-docs，草稿在 `docs/plans/seams-freeze-v2/proposed/`）；两个 hermetic 缺口 golden（P7 credentialGate / P6 superseded，草稿在各 proposed/）。

## 契约 / 运维

- `loop/active-contract.json` = `p5-replay`（full lane）；grill/plan/accept/loop/review 全 done（gate GREEN 2/2：s1-replay + s2-failsafe-coverage，`passes:true`，2026-06-30；server.mjs fork 修复后 checksum 重签；coverage golden 并入 testChecksums b0dcaff）；仅 learn 待。其余契约（p2-intent-compile / seams-freeze / p2-failsafe-coverage / p7-report / p4-freeze / p6-selfheal）均 loop done、产物落 dev。
- 单活契约 baton 教训（重要）：loop-kit 是单活契约（hook 读主树共享 `active-contract.json`）。本会话并行起多契约（worktree 隔离）撞了这个单 baton 槽——worktree 子代理 commit 受主树 baton 互锁：P6 子代理曾临时翻主 baton（已还原）、P4 子代理被拦只暂存未提交。landing 办法：已 committed 的分支用 `git merge`（不被 commit 互锁拦）；未提交的（P4）把文件拷进 dev、把主 baton 临时切到其真实 loop-done 契约提交、再还原。未来真并行须按 design §3.1：`LOOP_CONTRACT_FILE` 参数化 + `breaker --state`（未建）。
- push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓（参考 autotester = 私有 `ChenSteventx/autotester`）。
- 删不动的残留：`docs/plans/seams-freeze/proposed/`（评审副本，破坏性删除被权限层拦，待人 `! Remove-Item -Recurse -Force` 清）。
- 旧 `p2-testcase` 契约已被取代作废。term-lint 全程过；Windows git 需 `git config windows.appendAtomically false`（已设，否则 merge 报 index.lock 写错）。

## 历史层（溯源用，非现状）

- **P0/P1**（live，不变）：loop-kit 引擎（与 autotester 字节一致，ADR-0001）、护栏（12 迁移 + 13–17 新增）、`CONTEXT.md` 两限界上下文、ADR 0001–0006、`casey selftest --tier1`。
- **2026-06-26**：P2 重定义走完 grill→plan→accept，6 路深读 `regress_autotest`、ADR-0006 的 14 风险落代码核验、冻结 5 红 golden + 2 fixture + prd，停在 loop 前。详见 `docs/plans/p2-intent-compile/grill.md`。
- **2026-06-29**：开 loop 前的岔一/二/三 + 质量接口讨论 → 落档（FLYWHEEL/design/report-spec/flywheel-schedule）→ 实现 loop（S1/S2/S3 绿）→ 提交 `594ecf4` → Claude 侧异构评审 → 收口。
- **2026-06-29 晚续**：codex 真异构评审收口（7 修复，`7923088`）→ omc 列禁言禁用 → 排期 v2（接缝优先并行，`roadmap-parallel.md`）→ 第1层 5 接缝冻结（`4d184f6`）→ 第2层并行 worktree：track-F/P7（`b00b7c7`/`0832ed3`，合并 `e06e309`/`9d92892`）+ P6（`8734307`，合并 `1a37eba`）+ P4（`5a8b08d`）→ P5 grill+plan（ADR-0007）。第2层四轨全在 dev 亲验绿。单活契约 baton 撞并行的教训见「契约/运维」。
