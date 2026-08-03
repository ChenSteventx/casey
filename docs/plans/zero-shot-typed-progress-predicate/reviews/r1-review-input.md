# 代码评审任务：Casey zero-shot typed progress predicate 闭集扩展

你是独立评审者。请对着**不可变快照**评审，不要相信任何叙述性总结，自己跑命令取证。

## 仓库与基线

- 工作树（只读评审，请勿修改任何文件）：`/mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate`
- 分支：`zero-shot-typed-progress-predicate`
- 基线：`a3a9a28`（评审前状态）
- 候选：`446881b`（评审对象）
- 差异：`git diff a3a9a28..446881b`

## 规格（权威，先读）

- `docs/plans/zero-shot-typed-progress-predicate/plan.md`
- `docs/plans/zero-shot-typed-progress-predicate/GRILL.md`
- `loop/prd-zero-shot-typed-progress-predicate.json`（含 checksumAmendments）
- 上位约束：`CONTEXT.md`（统一语言注册表）、`loop/GUARDRAILS.md`（护栏，尤其 #14 fail-safe 不 fail-open、#15 裁判零 LLM、#17 裁判按断言种类不可知、#19 强制层改动必复跑邻接）

## 改动范围

生产件 4 个：
- `lib/zero-shot/step-contract.mjs`（进展断言闭集校验）
- `lib/zero-shot/progress-verifier.mjs`（判定 + 因果 + 完整性前置）
- `lib/zero-shot/affordance-catalog.mjs`（新增 redactionSuppressed 计数）
- `lib/zero-shot/page-observer.mjs`（公开该计数）

测试件 1 个：`tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs`

## 你必须自己跑的命令（不要接受二手结论）

```
cd /mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate
node tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs   # 期望 exit 0，20/20
node tests/_golden/zero-shot-action-progress.zero-sut.golden.mjs
node tests/_golden/zero-shot-authority-runner.zero-sut.golden.mjs
node tests/_golden/deterministic-resolver-step-contract.zero-sut.golden.mjs
node tests/_golden/page-observer-main-frame.zero-sut.golden.mjs
node tests/_golden/public-observation-redaction.zero-sut.golden.mjs
node tests/_golden/adaptive-module-boundaries.static.golden.mjs
node loop-kit/bin/term-lint.mjs --registry
```

判绿只信退出码，不要 grep 输出里的成功字样。

## 重点风险清单（请逐条给结论，并给出可复现的反例或明确说无）

1. **闭集是否真闭**：模型/调用方能否构造出绕过 `validProgressItem` 的进展断言？原型污染、
   `Symbol` 键、`__proto__`、数组形态、`Object.create(null)` 等。`urlPathname` 的现役已签
   字节兼容有没有被破坏（任何旧的合法项现在被拒、或旧的非法项现在被接受）？

2. **缺席类断言的 fail-open 是否真被堵死**：目录不完整的来源是否只有
   `truncated` / `unsupportedScopes` / `redactionSuppressed` 三种？还有没有第四种能让
   一个**真实可见**的元素不出现在 `PageObservation.affordances` 里，从而使
   `roleHidden` 误判成立？特别检查 `affordance-catalog.mjs` 的投影、排序、
   `maxCandidates` 裁剪、handle 释放，以及 `playwright-page-driver.mjs` 的枚举边界。

3. **`roleVisible` 的唯一性判据**：`matched.length === 1 && pageCount === 1 && visible` 是否
   足够？`pageCount` 由截断前全集算出这一点在截断场景下还成立吗？存在性断言不受完整性
   前置约束（plan §4）这个豁免有没有反例？

4. **因果性**：合取级规则（before 全真则拒、after 非全真则拒）在混入否定式判据后有没有
   漏洞？能否构造一条 expected 使得动作**没有**造成任何进展却判 `progressed`？

5. **授权链**：新增字段 `redactionSuppressed` 进了 `catalogDigest`，但 `PageObservation`
   的完整性靠什么保证？能否伪造/篡改一个带 `redactionSuppressed: 0` 的 observation 通过
   `verifyStepProgress`？WeakMap 身份比较是否有绕过路径？

6. **护栏合规**：产物是否恒 `signed:false`/`replayReady:false`？有没有任何路径让本改动的
   结论进入 `bin/verdict.mjs`、三轴或 report？`conditionKind` 改成 `conditionKinds` 有没有
   下游消费者被打破（自己 grep 全仓确认）？

7. **金牌质量**：这 20 条钉子里有没有假绿——即断言写得过松、实现被削弱后仍然绿的？
   请挑你认为最可疑的 2-3 条，自己做变异（改实现、跑、再改回）验证。

8. **不可达代码**：plan 主张「before 面的完整性检查不可达，故不加」。请独立验证该主张
   （构造截断的 before 看能否走到 `verifyStepProgress`）。若可达，这是 Critical。

## 输出要求

- 本轮只报 `Critical` / `High` / `Medium`，不报 `Low` 与风格建议。
- 每条 finding 必须给：文件:行号、为什么是问题、**可复现的最小反例或命令**、建议修法。
- 若某条风险你验证后认为无问题，明确写「无发现」并说明你是怎么验的。
- 不要修改仓库任何文件。不要提交。
- 结尾给一行总评：`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。
