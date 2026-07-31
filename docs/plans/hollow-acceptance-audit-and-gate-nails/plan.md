# hollow-acceptance-audit-and-gate-nails（lane=light）

顾问 `gpt-5.6-sol` max 推荐执行顺序的**第一步，且只做第一步**：冻结审计清单 + 补门禁反例测试。
决策树与授权凭据见同目录 `GRILL.md`。零处置——不动任何 story 的验收、不改任何 `passes`、
不处置任何具体 prd，那是第二步的活。

## 背景

2026-07-20 人签重裁 `b3bee6b` 把 27 枚会启动夹具 SUT 或浏览器的历史金牌判入隔离态
（`agentExecution: forbidden`、`route: human`）。副作用：它删掉了 63 条 story 里 168 条指向这些
隔离件的验收命令，却把 `passes` 原样留着。至今其中 51 条仍为真。

这不只是 51 条数据问题。`loop-kit/bin/gate.mjs` 有四个机制口子让「验收面被掏空/失效」照样翻绿：
空验收数组真空翻绿、空 `stories` 报 GREEN、全局红仍给 story 回写真、`evidence` 不绑验收内容。
先立反例把口子钉住，再谈处置——顺序反了会继续产下一批同型。

## 交付物

### 一：审计清单（冻结件）

落 `docs/plans/isolated-golden-acceptance-revocation/hollow-acceptance-audit.json`（机读）
与同名 `.md`（人读）。64 行 = 51 条现绿病例 + 13 条合法 tier1 白名单；另附 12 条现红行闭合 63 条影响面。

每行字段：`prd`、`storyId`、`category`、`acceptanceBefore`（自 `git show b3bee6b^` 取）、
`acceptanceNow`、`removedByIsolation`、`currentPasses`、`evidence`、`obligationMix`、`note`。

`category` 四值：`tier1-hollow` / `flow-bridge-insufficient` / `mixed` / `legitimate-tier1`。
后者是白名单——将来加「只剩 tier1 不得翻绿」判据时没有它必然误伤。

`obligationMix` 取 `tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json` 的真值，
按该 story 被删掉的隔离件逐件汇总 `survive-unit` / `retain-isolated` / `superseded` 条数；
取不到就写「未取到」，不猜。

### 二：门禁反例金牌（红先行）

落 `tests/_golden/gate-hollow-acceptance-counterexamples.zero-sut.golden.mjs`，四钉：

1. 空验收数组不得翻绿（`prd.schema.json` 已写 `minItems: 1`，门禁根本不校验 schema）；
2. 空 `stories` 不得让门禁报 GREEN（同时挂账「可执行质量契约 vs 登记账如何机械区分」这一待裁问题）；
3. 全局红时不得给 story 回写有效真值；
4. 验收变更后旧 `passes` / `evidence` 应失效（`evidence` 现在只有时间戳、不绑验收内容）。

每钉 spawn 真 `gate.mjs` 二进制，用 `LOOP_KIT_ROOT` 指向临时目录里的合成最小根，零真机、零 SUT、
零浏览器、零凭据、不写真仓任何文件。**本步只写测试、让它红，不改 `gate.mjs`**——改门禁是第三步。

## 验收

本契约不建自己的可执行质量契约（`light` 车道无 accept 门）。交付判据：

- 审计清单 51 + 13 条分类计数与逐条字段齐全，`obligationMix` 逐条按账取真值；
- 与顾问结论的每一处分歧在清单 `note` 与 md 正文各记一次；
- 反例金牌**现在必须是红的**——跑 `node tests/_golden/gate-hollow-acceptance-counterexamples.zero-sut.golden.mjs`
  退出码非零，四钉逐条报红，红签名原文回抄进本目录 `RED-BASELINE.md`；判红只信退出码；
- 改动的 md/json 跑 `node loop-kit/bin/term-lint.mjs --file <路径>` 通过。

## 停手边界

- 不改 `gate.mjs` / `contract.mjs` / `prd.schema.json`；
- 不改任何 `loop/prd-*.json`，不手写 `passes`；
- 绝不把 27 枚隔离件以任何形式写回任何验收面；
- 不把 `hermetic-golden-surviving-units` 的聚合命令挂给任何 story，不把部分后继当完整后继；
- 不判现役 8 份空 `stories` 的登记账违规，只把分型问题挂出来待裁；
- 不提交、不推送；不碰 `lib/` 下 `SIDE_EFFECT_POLICY` 相关件。
