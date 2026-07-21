# entity-ui-wiring 异构评审 R2（复审：只看 R1 已确认 finding 的修复）

R1 结论（codex-r1-raw.md）：FAIL，H1/H2/M1/M2/M3 五条全采信。修复如下，只复核这些修复面：

- H1（隐藏旧值骗绿）：编译/回放两侧回读一律改「被钉抽屉域内 `.agent-bind-select__value:visible` 恰一 + 精确等值」，其他情形硬阻断。见 r2-fix.diff 中 lib/compile-atoms.mjs 后置核验段、lib/replay-actions.mjs doBindAgent 段。
- H2（编译侧无抽屉域锁）：compileWorkflowBindAgent 起手 `pinNodeDrawer(nodeLabel)`，触发器/回读全部限定 bound.root，域锁失败即硬阻断；句柄 finally 释放。与回放门同用 pinNodeDrawer（同刻）。
- M1（容器覆写只在编译侧）：bin/replay.mjs ctx 携 profile、doAgentSearchOpen 从 ctx.profile.agents.itemContainer 取容器；bin/compile.mjs 把 profile 传进 createCompileRun（原 run.profile 通道从未接通，现两侧同参）。
- M2（回放分支无验收覆盖）：s3 金牌追加 R1-H1/H2/M1 三条直连 performAction/compileFlow 的对抗检查，修前红证 evidence/review-r1-fix-red.txt（三条红因与你 R1 的复现一致），修后 s3 7/7、gate 4/4 GREEN。
- M3（临时 prd 固定路径）：两金牌临时 prd 写入改 {flag:'wx'}（同名已存在即抛、绝不覆盖）+ 散置目录带 randomUUID 唯一后缀，finally 只清本次产物。

现成证据：s1 11/11、s2 8/8、s3 7/7、s4 3/3；gate GREEN 4/4；tier1 GREEN。
要求：逐条给 CONFIRMED_FIXED / STILL_OPEN（附 file:line 理由）；如发现修复引入的新缝报 High/Medium；总判 PASS/FAIL。只读，不写文件，结论输出到 stdout。
