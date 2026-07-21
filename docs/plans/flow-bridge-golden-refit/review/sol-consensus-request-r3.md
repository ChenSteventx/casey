# sol max 共识请求 R3 — flow-bridge-golden-refit plan v3

你 R2（`review/sol-consensus-reply-r2.md`）判 BLOCKED 余五硬阻断，Claude 已逐条并入成 v3（`plan.md` 顶部 v3 标注 dispositions）。复核五条是否消解、有无新引入，总判可进 accept 与否。

五条修法对照：

1. C8：mutation 原子补合法绑定 + 断 exit 1 + 凭据门精确诊断 + 零落盘。
2. mutant：移一次性 git worktree（树内独立 direct baton，护栏 #18）执行，主树字节双 sha 录核不动，避开 `contract.mjs:69` 互锁。
3. B1：独立正控先行（同包同 loader 直调 `bin/intake.mjs` 必先成功）；降级判据改三条件与（正控成功 ∧ MCP 无 loader 拒 `DRIVER_NOT_PUBLISHED` ∧ MCP 有 loader 仍拒同码）。
4. B2：撤回纯函数直调 distill 内联门（`bin/distill.mjs:130/:183` 未导出且 import 即 main）；C2f/C2h 红证改直调闭合 validator 导出纯函数（新链路真实执法点）；原内联门行为覆盖如实入丢失列+登记接手条件；C2d 断实测精确拒因（候选 `CAPTURE_URL_LEAK`，validator:199，accept 定谳后冻）。
5. B3：bootstrap/worker 两段式——bootstrap 零 authority-root import、生成临时密钥/发布/loader 后以显式 loader spawn 新 worker 文件（纳 checksum+人签），worker 内才 import 并断言。B1/B2 无悖论（金牌本体不需 loader、只 spawn 子进程带）。
6. R2-⑥ 已采纳：执行账 accept 实际生成冻结为准入硬条件。

同标准对抗核，只读（绝不运行金牌/夹具 SUT）。产出：逐条判 + file:line + 总判（可进 accept / 阻断项+修法）。
