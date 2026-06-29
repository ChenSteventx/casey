# seams-freeze — grill（light 车道，跳实质 grill）

light 车道：本契约只新增接缝 schema + 合成 fixture + golden 校验器 + prd，不碰任何已冻内核 impl（`verdict.mjs`/`check.mjs`/`compile-gate.mjs`/`forensics.mjs` 一字不改），无争议设计——五条接缝的形状已在并行起草中扎根 design+regress+已冻 P2、并经用户冻前人审定案。故不做实质 grill。

定案的人审决定（用户 2026-06-29）：① 冻结 typed expected[] 走独立旁车 `expected.frozen.json`（护栏 #5 物理隔离）② 契约期望裁定命名 `expectedVerdict`（区别 runtime verdict.json）③ `assertionOp` 先封闭 enum。

阶段台账需 grill.done 才解锁 plan（互锁线性），以本 stub 如实登记跳过缘由。
