# noerrenv-absence — noErrorEnvelope 缺席语义修正（light）

## 背景

相2 端到端首航（真机 `tc_catalog_wf_crud`，2026-07-02）实证：3/4 步 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)` 全部由硬断言 `noErrorEnvelope ok:false` 引起——`lib/replay-assert.mjs` 的评估器硬编码「必须找到 `/saveOrModifyProcessData/` 好信封」（p5 假 SUT 夹具捷径），真机未发该请求的步必假败。裁判 fail-safe 方向全对（无假绿），败在评估器语义。人签取缺席语义（GRILL G1，Steven）。

## 改动（两处）

1. `lib/replay-assert.mjs` 的 `noErrorEnvelope` 分支：改缺席语义——本步归因记录（`c.netRecords` 已按发起方归因裁剪）中不存在 `errorEnvelope.ok === false` 即过；零信封记录 = 无错可言 = 过（镜像同文件 `noPageError` 的缺席范式）；坏信封归因本步必败（`inject500` / HTTP200 软失败方向不变）。
2. `tests/_golden/p5-replay-coverage.golden.mjs`：翻转「无 save 记录 → ok:false」一条为缺席语义三向（零记录→true / 坏信封→false / 仅好信封→true）——护栏 #1 契约更新，Steven 已过目批准；`prd-p5-replay` 与本契约 prd 对该文件 checksum 同步重签。

## 非目标

不动 `verdict.mjs`（消费 ok/soft 不感知语义）；不动 forensics 归因；其余 kind 分支不碰；`streamReplyReceived` 的 URL 模式（同类夹具味）留观察挂账、不在本轮。

## 验收（红先行）

- 覆盖 golden 三向（改后对旧实现预期两红：零记录应 true 实 false、仅好信封应 true 实 false）；
- `p5-replay.golden` 四态映射原样绿（`envelope200bad`/`inject500` 坏信封归因 save 步 → 硬败方向不变；happy 好信封 → 过）；
- 回归锁：`p4-drafter.golden`（`IMPLEMENTED_KINDS` 面不变）+ `p3-compile.golden` + `selftest --tier1`。
- 收口后重跑相2 首航（真机 replay + verdict）核验四态归位。
