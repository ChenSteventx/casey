# p5-replay — 执行排期（内部并行/串行结构）

> 补 `plan.md`（组件+验收）与 `grill.md`（7 决策）缺的那一层：P5 内部怎么排并行/串行、为什么。
> 事实源：`docs/plans/roadmap-parallel.md`（跨轨并行模型）、`docs/HANDOFF.md`「契约/运维」（单活契约 baton 教训）、本契约 `plan.md`/`grill.md`/`docs/adr/0007`、autotester `lib/robust-actions.mjs`+`lib/replay-guards.mjs` 实读耦合度。2026-06-29 落。

## 边界：跨轨并行红利已吃尽，这一层只剩内部

`roadmap-parallel.md` 第 2 层 6 轨（P5/P7/P4/P6/P3/F）里，P7/P4/P6/F 已 loop-done 落 dev，P3 是 route:human 支线不占关键路径。P5 是第 2 层最后一条轨、旁边没有别的轨能并行。所以"哪些能并行"只问 P5 内部。

## 硬约束：单活契约 baton 卡死跨契约并行

loop-kit 是单活契约（hook 读主树共享 `active-contract.json`），`design §3.1` 的 `LOOP_CONTRACT_FILE` 参数化 + `breaker --state` 未建（HANDOFF 教训）。推论：

1. 绝不再起第二个 full 契约跟 P5 并行——会撞主树单 baton 槽（第 2 层并行 worktree 已栽过）。
2. P5 内部即便开 worktree 子代理，它们共用同一 baton（同 slug 不撞），accept 后能改 `lib`/`bin`，但 `commit-impl` 需 loop-done、中途不能各自落地；且 7 条 golden 测的是整条管线集成、绿是单树事件。
3. 故 worktree 隔离对 P5 内部收益低于开销：组件是一条运行时管线、强耦合、按集成 golden 收敛，不像第 2 层那种各自独立子系统+各自 golden。

## 依赖结构（互不依赖的可并行模块 vs 串行集成主干）

```
            ┌─ 互不依赖的可并行模块（可并行起草）─────────────────┐
fixture     │  robust-actions 移植+三轴埋点 ★动作轴，喂 runner    │
server  ──> │  replay-guards 移植（coordClick/必填/下拉回读）     │
(假 SUT)    │  instantiate（uniqueName 模板，7 行）               │
            │  watchPageLifecycle 移植（crash/pageerror 按本步）   │
            │  waitForReplyByStream 移植（SSE finished 静默点）    │
            │  watchNetworkForensics ★新建（CDP 发起方+denylist+null）│
            │  findEquivalentAffordance ★新建（只读漂移探针）      │
            └───────────────────────────────────────────────────┘
                          │（各模块收敛进主干）
                          v
   串行集成主干（我亲手、coherence-critical）：
   回放 runner（events.fixture → 按 intentId 聚合依序回放 → 驱动 robust-actions → 出动作轴）
        → StepAxes 合并（动作轴 ⋈ postAssertions ⋈ 取证轴，形态对齐已冻 verdict-cases.json）
        → 喂已冻 verdict.mjs → 7 golden 转绿 → gate 绿 + selftest tier1 → loop-done
```

软序：`robust-actions` 的三轴埋点产「动作轴」在动作原语处，是主干入口的前置；其余模块（取证/生命周期/流式/漂移）喂后段的 StepAxes 合并。

## 并行结论

- 可并行：7 个互不依赖的模块——文件互不相交、无相互依赖、对 `@playwright/test` 零值依赖（实读 `robust-actions`/`replay-guards` 证实）。以 fan-out 子代理起草（读 autotester 源 + 按 casey 三轴改写），我串行落地到不相交文件。不开 worktree（不提交、落地归我，worktree 纯增开销）。
- 必串行：集成主干（runner → StepAxes 合并 → 喂 verdict → golden 绿）。它产出三轴数据契约，是裁判·桥·报告共吃的命脉，且飞轮要求三轴/取证抽象按「将来喂三四种 flow 形状」设计、不能只对着 `catalog_wf_crud` 长（NEXT-SESSION 飞轮条）。碎片化主干会让轴抽象走形——必须一个脑子统着。
- 命门单列：`watchNetworkForensics` 虽文件独立，但是 fail-safe 命门（CDP 发起方真归因、背景 401 进不了背书、证不出归 null，ADR-0007 决策 2），按新建慎做、不是机械移植。

## 分阶段

### Phase 0（现在就能起，pre-accept、不被 loop-guard 拦）
fixture server（假 SUT）落 `tests/` 而非 `web/`——它是测试脚手架不是实现，放 `tests/` 既标明是测试件、又绕开 `web/` 的 accept 前互锁（`web` 在 IMPL 正则内）。先定路由脚本契约：覆盖 8 态所需的 200 / 500+错误信封 / 背景轮询 401 / SSE 流 / 触 pageerror。这是 7 条 golden 的共同靶子。

### Phase 1（accept，串行 barrier，护栏 #11 + #1）
对 fixture server 写 7 条命令化红 golden（plan.md 验收点）→ 跑出真红基线（组件未建该红，ATDD）→ `contract advance accept --artifact`，冻 testChecksums、解锁 `lib`/`bin`/`web`。内部小并行：路由契约先定（串行）→ fixture server 实现 ∥ 7 golden 起草（双流并行）→ 合拢 → 验红（串行）→ 冻。

### Phase 2（loop，实现）
fan-out 起草 7 个模块（并行，先交 `robust-actions` 三轴埋点这条主干入口）→ 我串行搭主干（runner → StepAxes 合并 → 喂 verdict）→ 7 golden 转绿 + gate 绿 + selftest tier1 无回归 → loop-done。

## 不在 loop 绿范围（route:human，护栏 #16）
真 Heren 站回放 `catalog_wf_crud` 全 PASS、真 save POST 注 HTTP500 出 `SUT_DEFECT`、CDP 发起方在真站流量下可靠度（ADR-0007 推翻条件）。进 prd observability，不卡 loop。

## 执行模型一句话
P5 = 一条串行集成主干（我）+ 七个可并行起草的模块（fan-out 子代理，不开 worktree、不起第二契约）。并行在 toil 起草，串行在集成与轴抽象。
