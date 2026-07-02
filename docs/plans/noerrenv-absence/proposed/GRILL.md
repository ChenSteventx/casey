# GRILL — noerrenv-absence（light，单分岔人签）

## G1 noErrorEnvelope 语义（人签）

- 实证（相2 端到端首航，2026-07-02）：真机 `tc_catalog_wf_crud` 回放裁定 3/4 步 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)`，全部指向硬断言 `noErrorEnvelope ok:false`；根因 = `lib/replay-assert.mjs` 评估器硬编码「必须找到 `/saveOrModifyProcessData/` 的好信封」——p5 假 SUT 夹具捷径，真机上未发该请求的步（导航/删除）必假败。裁判本身 fail-safe 方向全对（无假绿）。
- 分岔：A 改缺席语义——本步归因记录中不存在 `ok:false` 坏信封即过（镜像同文件 `noPageError`；零信封记录 = 无错可言 = 过；坏信封归因本步必败，`inject500`/HTTP200 软失败方向不变）；B 保留现实现、草拟器绕开（取证类全局断言名存实亡、语义裂缝留存）。
- 人签：**取 A**（Steven，AskUserQuestion「批，改缺席语义」，2026-07-02）。连带批准：翻转 `p5-replay-coverage.golden.mjs` 的「无 save 记录 → ok:false」冻结检查为缺席语义三向（护栏 #1 契约更新，人已过目）；`prd-p5-replay` 对应 checksum 重签。
