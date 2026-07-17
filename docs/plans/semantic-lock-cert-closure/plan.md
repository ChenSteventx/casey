# semantic-lock-cert-closure（light）——语义锁认证漂移收口

> 基线：`observation-contract-closure` tip `e0ffe16`。上游评审档案：主树 `docs/plans/closed-loop-evolution/review-claude-20260717.md`。
> 分工确认：Steven 2026-07-17 选定「停 codex、Claude 接管」，本契约是接管后第一步（W1 红账收口）。

## 背景

语义锁 v2 的 5 个 P0 防御代码已闭合（Claude 攻击式评审 PASS），但给它们作证的冻结金牌全线红：后续硬化改了 `verifyEntityLockSet` 入参形态（`{lockSetBytes,...}` → `{authority}`）并故意清空 publications 表之后，没有重跑 gate——两个 prd 带着 `passes:true` 的漂移失实，5 个 P0 判别逻辑没有任何可执行绿证明。另有四件测试异常（孤儿 import 与接线未至）。

## 范围（做）

1. 重写三个漂移金牌，使攻击断言重新可达并按新权威面执行：
   - `tests/_golden/teachin-semantic-lock-v2.zero-sut.golden.mjs`（V2-A..D 四攻击）
   - `tests/_golden/teachin-semantic-lock-capability-hardening.golden.mjs`
   - `tests/_golden/teachin-semantic-lock-runtime-authority.golden.mjs`
   注入方式沿用仓内既有测试专用权威注入手法（隔离 loader + 测试密钥），生产 publications 表保持空、不得回填。
2. 孤儿测试处置（先取证再定）：`-artifacts` / `-runtime`（import 不存在模块）按 git 考古结论恢复模块或按仓内吊销惯例正式吊销；`-intake-joint` 修 import；`-cli-wiring` 确认属下一波接线的故意红基线则保持红、不动。
3. gate 重证：受影响 prd 全部重跑 gate，`passes` 以实跑为准（该绿则绿、该红诚实红）；改动的冻结金牌按纪律重签 `testChecksums` 并在提交说明记录。

## 范围（不做）

- 不动 `lib/`、`bin/` 实现（若发现实现真 bug，停下上报，不在本契约顺手修）；
- 不做 v2 引擎接线（那是下一契约）；
- 不合并回 dev（合并编排另走）。

## 铁则

- 禁倒着裁：不许削弱攻击断言迁就实现；测试打不到断言时修的是夹具构造，不是断言本身。
- fail-safe 不 fail-open：实现若确实拒得过宽导致合法夹具被拒，如实红、上报，不绕。

## 验收点

- 三个漂移金牌的攻击断言全部可达且结果与实现一致（预期全绿）；
- 受影响 prd gate 实跑与账面 `passes` 一致，零漂移失实残留；
- 孤儿四件各有明确处置与证据；
- 全仓 ratchet 对本树无新增问题。

## 2026-07-17 补记：结构性不可达与分面处置（loop 期发现，已亲核）

重写代理按反空洞停手规则上报、主会话亲核坐实：提交 `819015f`（13:46）按更新的冻结意图「运行时出处不可执行且不透明」（冻结件 `57b3579`）刻意拆除运行时权威铸造接缝——`runtimeBundleVerified` 硬编码 false（`lib/entity-semantic-lock-v2.mjs` 约 464 行，带注释），`evaluateEntityAction`/`createRunSuccessorProof` 恒拒于 `ENTITY_LOCK_RUNTIME_UNAUTHORIZED`。因此 5 个 P0 中 (c) 重复候选、(d) 畸形候选、(e) successor 三类攻击断言对任何注入手法均结构性不可达；13:14 冻的 `teachin-runtime-authority-bundle-successor` 金牌（期待可执行 bundle）已被 32 分钟后的新意图事实性取代、未做形式处置。

处置（不削弱总攻击清单）：
- 三金牌重写为「可达面」全绿：篡改与外部锚（V2-A）、schema/策略不降级与收据侧 platformId（V2-B）、PRD 唯一权威与三元组绑定（H4/H1）、四类动作角色策略拒绝（runtime-authority 可达检查）。
- 不可达面（V2-C/V2-D/H2/H3 + runtime-authority 三条空洞检查）逐条迁入新前瞻金牌 `teachin-semantic-lock-runtime-discrimination-successor`，按「运行时权威可验证成立后」的目标态书写，今日诚实红；配套新 prd `passes:false`。
- 迁移映射表（旧检查 → 新位置）随交付出具，逐条核对无丢失。
- 填绿路径是真决策分岔，挂 route:human 待 Steven：① 只认真机运行时权威（联网 publication 落地后真机填绿）；② 恢复测试可注入的可验证接缝（部分回退 `819015f` 的不透明姿态，kernel 车道另立契约）；③ 导出判别内部函数做单元级攻击测试（最小 lib 面改动，另立契约）。本契约不选边。

## 风险

- 权威注入手法若与 v2 新 API 不匹配，可能需要小幅扩展测试夹具助手（仍属测试面）；
- `-artifacts`/`-runtime` 若考古发现模块在合并中被丢，恢复动作触 `lib/`——届时按「不做」条款停下上报，改开后续契约。
