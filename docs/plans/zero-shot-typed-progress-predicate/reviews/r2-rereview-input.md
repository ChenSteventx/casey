# 复审任务：只看已确认 finding 的修复 hunk

仓库（只读，勿改）：`/mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate`
修复前：`446881b`　修复后：`981b4a3`　差异：`git diff 446881b..981b4a3`

上一轮两路异构评审确认的 finding，本轮只核这些的修复是否真成立、有没有引入新矛盾：

- F1（High，driver 层截断）：`playwright-page-driver.mjs:71-72` 在候选数达 MAX_DISCOVERED 时丢弃元素
  且只置 sourceTruncated，`pageCount` 因此在幸存集上低估，`roleVisible` 假绿。
- F2（High，before 侧脱敏抑制）：`observationBlocker` 不查 `redactionSuppressed`，目标元素动作前
  已可见却被抑制、动作后干净出现时判据由假翻真，因果闸放行未发生的进展。
- F3（Medium，空目录）：动作后整页无候选时 `roleHidden` 平凡成立。
- F4（Medium，金牌假绿腿）：删 `visible===true` 或 `pageCount===1` 原先仍全绿。

## 你要回答的问题

1. 修法「按是否读目录划线」是否真的堵住 F1/F2/F3？给可复现反例或明确说无。
2. 修复有没有**过度收紧**——把本该判过的合法场景误拒？特别是 `urlPathname` 豁免是否仍正确、
   P14 是否被削弱。
3. 有没有引入**新的**假绿或新矛盾？特别看 before/after 两次 `completenessBlocker` 的顺序与
   短路是否会掩盖更严重的拒因。
4. 作者挂账称「删 `pageCount===1` 仍不红，因该状态经生产路径不可达」。请独立验证这条不可达
   主张。若可达，是 Critical。
5. 新增 P21-P24 四钉有没有假绿（断言过松、实现削弱仍绿）？自己做变异验证。

## 必跑

```
cd /mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate
node tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs   # 期望 24/24 exit 0
node tests/_golden/zero-shot-action-progress.zero-sut.golden.mjs
node tests/_golden/zero-shot-authority-runner.zero-sut.golden.mjs
node tests/_golden/page-observer-main-frame.zero-sut.golden.mjs
```
判绿只信退出码。变异请在 /tmp 副本里做，原树零改动。

只报 Critical/High/Medium。结尾一行 `VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。
