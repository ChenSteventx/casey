# p2-failsafe-coverage — grill（light 车道，按岔三决策跳过实质 grill）

本契约走 light 车道：依「岔三」标准决策（之后辐条默认轻车道、跳 grill、保留 plan+accept+loop；碰冻结内核才升 full），本契约**只新增 tests + prd、不碰任何已冻内核 impl**（`verdict.mjs`/`check.mjs`/`compile-gate.mjs`/`forensics.mjs` 一字不改），无争议设计，故不做实质 grill。

设计已在两处定死，无需再 grill：
- 被锁行为来自 p2 review 的真异构评审收口（见 `docs/HANDOFF.md`「真异构评审」节的 7 条修复 + C1-C4 延后项）。
- 本契约的覆盖点与红基线策略见同目录 `plan.md`。

阶段台账需要 grill.done 才能解锁 plan（互锁线性），故以本 stub 如实登记跳过缘由。
