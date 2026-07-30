# 评审包 — teachin-nav-expansion-recipe 实现轮（联审输入）

> 输入=spec+diff+门禁证据（护栏 #9 不含实现者推理）。仓根 /mnt/d/ctx/heren/casey。

## spec
- `docs/plans/teachin-nav-expansion-recipe/GRILL.md`（v2/v3 定案：槽位约束、D6 防合并、D7 碰撞治理、末槽绑定）
- `docs/plans/teachin-nav-expansion-recipe/plan.md`（§1 v3 三文件改动、§2 金牌十组、§6 计划评审四轮至 PLAN_APPROVE）

## diff（三份生产件，全部在 untracked 目录、无 git 基线；改动即 plan §1 v3 所述，实现与四轮验证过的打样逐文件 diff 全等）
- `lib/teachin-distillation/atom-resolution.mjs`：BUILTIN_RECIPES 增带槽双击配方；`normalizeSlots`（形状非法整条弃用）；`matchesAt` 槽位逐位校验 + `spanCrossesBoundIntents` 防合并守卫；`resolveCaptureAtoms` 增可选 `boundIntents`（非 Set/脏成员/投影外幽灵成员均拒 `UNSAFE_DATA_SHAPE`，校验时点在业务事件集之后主循环之前）
- `lib/teachin/cycle-plan-generator.mjs`：`recipeSemanticLabels` 末槽版；`semanticIntentMatches` 标签源改造；`remapKnownUnits` 第二遍传绑定集
- `lib/teachin/resolved-projection.mjs`：`resolveCaptureProjection` 传「投影业务事件∩intentIdBySeq」交集绑定集（保 fidelity 具名拒付语义）

## 冻结金牌
- `tests/_golden/teachin-nav-expansion-recipe.zero-sut.golden.mjs`（N1-N10 十组，sha=da90abfb… 冻入 prd；红先行：修前 6 红 4 绿 exit 1 → 修后 10/10 exit 0）

## 门禁证据
- gate GREEN 3/3（`loop/prd-teachin-nav-expansion-recipe.json` s1/s2/s3 passes:true）
- 补证：`teachin-replayability-resolved-projection` 9/9 绿 + 全家族 29 枚零红（s2 清单漏列该枚已挂账待补强）

## 评审要求
对抗式核验：①两处新校验面（槽位/绑定集）语义正确性与 fail-closed 保持；②金牌可绕过性（奖励钻营面，可自跑金牌与自造反例）；③爆炸半径（`matchesAt`/`normalizeRegistryRecipe`/`semanticIntentMatches` 的其他消费方）；④s2 漏列 resolved-projection 的补强建议核实。首轮只报 Critical/High/Medium；第一行 APPROVE 或 CHANGES_REQUIRED；每条 finding 文件:行号+证据+修法；末行哨兵 REVIEW_DONE_SENTINEL。
