# p2-failsafe-coverage — plan（补冻结 golden）

## 背景与边界

真异构评审（codex gpt-5.5）引出 7 条 fail-safe 修复（已落 impl、commit `7923088`）+ C1-C4 覆盖缺口。本契约把这些新 fail-safe 行为锁成回归 golden，防将来回归。**只加 tests + prd、不碰已冻内核 impl**（light 车道、跳 grill）。新 golden 自包含（cases 内联）、各单元独立。

## 三个独立单元（可并行撰写）

### 单元1 — verdict 覆盖：`tests/_golden/p2-verdict-coverage.golden.mjs`
钉 `bin/verdict.mjs`（CLI），验收点：
- B1 非布尔 soft：失败硬断言把 `soft` 设成 `"false"` / `1` 等非布尔 truthy 时不被静默降级 → verdict ≠ PASS。
- B2 漂移正向证据：`action` 无 `resolution==='none'` 但 `driftProbe.sameSignatureUniquePresent=true` → `NEEDS_HUMAN(INDETERMINATE)`（非 HARNESS_ERROR）；带 `resolution==='none'` + 探针 → `HARNESS_ERROR`。
- B3 入参 fail-closed：`steps` 非数组 → exit 65；`steps` 空数组 → exit 65。
- C1 归因辨别：`ap=true` + 硬断言失败 + 5xx 归因到**别步** → `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)`（非 SUT_DEFECT）。
- C2 取证背书边界：crash 归因本步 → `SUT_DEFECT`；pageerror 归因别步 → 不背书；缺 `stepId` → 不背书。

### 单元2 — compile-gate 覆盖：`tests/_golden/p2-compile-coverage.golden.mjs`
钉 `lib/compile-gate.mjs` 的 `validateDraft`，验收点：
- B4 无 states 旁路：registry 无 `states` 但有 `entityNameParam` 原子 + 裸名 → `ok:false`（破坏性硬闸仍拦）；带正确前缀 → `ok:true`。
- B5 空/缺实体名：`entityNameParam` 值为空串 / 缺失 → `ok:false`。
- C3 前缀硬闸边界：`prefix=''` → `ok:false`；`prefix` 缺失(undefined) → `ok:false`。

### 单元3 — forensics 覆盖：`tests/_golden/p2-forensics-coverage.golden.mjs`
钉 `lib/forensics.mjs` 的 `checkErrorEnvelope`，验收点：
- B6 信封 fail-closed：缺 `successValue` → `ok:false`；body 缺字段 → `ok:false`；空白 `successField`（`'   '`）→ `ok:false`；正常配置 → `ok:true`。
- A1 凭据红线：`successField` 命中敏感字段名（`token` 等）→ `ok:false` 且 `actual===undefined`（不回传值）。

## 红基线（如实验证）

对修复前 impl（`594ecf4`）跑这三新 golden：B1/B2/B3/B4/B5/B6/A1 系列应**红**（证明锁的是修复、非 vacuous）；C1/C2 系列对 `594ecf4` 已绿（per-step 归因在 loop 即落，属特征化补钉、非红先行）。对当前 impl（`7923088`）三新 golden 全绿。

## 完成判据

`gate --prd loop/prd-p2-failsafe-coverage.json` = GREEN；三新 golden 全过；`testChecksums` 冻结三文件；`casey selftest --tier1` 无回归。
