# p3-compile — learn（沉淀）

契约收口：grill/plan/accept/loop/review/learn 全绿（lane full）。P3 相1 编译命令化层——`casey compile` 三段式 CLI（闸+人 confirm 门 / 执行 / 回放核验）+ 原子快照 + 登录预备动作件 + 凭据门共享化 + `{{baseUrl}}` 回填接线，hermetic 对假 SUT 全绿。本文沉淀 grill 人签 + loop + 异构评审（codex `gpt-5.5` 非同族，三轮 R1..R3）暴露的教训。事实源：`git log 788bb2b..5f721e2`、`loop/audit.jsonl` 的 p3-compile review 记录、`docs/plans/p3-compile/proposed/GRILL.md`。

## 交付（live）

- `bin/compile.mjs`：三段式编译 CLI——闸段（`compile-gate` 三闸 + 落 `flow-<caseId>.json` 等人 confirm）、执行段（以 `--testcase` 为不可变锚重验三闸 → 登录预备动作 → 骑 atom 知识逐步执行 → `events.json` + `observed-<caseId>.json` + `compile-report.json`；证不出只落诊断报告 exit 65）、核验段（`--verify` 逐 event 扫动作轴全 unique）。
- `lib/compile-atoms.mjs`：原子编译知识（`workflow.create` 拆两 intent、菜单分支线性化、确认按钮文本实采、入口可证缺席 → `CASE_DEFECT` 候选 + 整原子不落步、断言原子折 intent 意图留痕、计数口径对账）。
- `lib/login-bootstrap.mjs`：登录预备动作（拷快照 autotester 登录选择器 + `loadSiteConfig` 深合并 + `loadCreds` env 优先，凭据只进内存；术语已登记 CONTEXT.md）。
- `lib/cred-gate.mjs`：凭据兜底门共享件（自 `bin/report.mjs` 抽出、保留 re-export；补 `token`/`cookie` 关键词 + `stripUrlQuery`；非凭据键形状校验跳过）。
- `lib/atoms-registry.snapshot.json`：regress 注册表整表 60 原子快照（`snapshotOf` 溯源，atomId 钉 registry 原名）。
- 接线：`casey compile` 桩转真；`bin/replay.mjs` URL 通道过 `instantiate` 回填 `{{baseUrl}}`（旧 fixture no-op）+ axes 加性外露 `eventActions`；`lib/compile-gate.mjs` 加性 `initialStates`。
- 回归锁：`tests/_golden/p3-compile.golden.mjs`（13 检查，含 6 条评审驱动新增、全部红先行）。

## 教训

1. **grill 备料三草稿是对的投资——loop 期零方向返工。** 重表达清单/观测采集计划/决策草稿提前把 15 event、雷点、route:human 全部摆上台面，G1–G7 人签半小时收口，loop 期所有分岔都有既定答案可引。人签也真改了方向（G6 分岔三弃倾向 B 改选 C 占位符）——决策草稿给足权衡才让改选有据。
2. **golden 钉断言前先复现已冻接缝，别凭直觉发明形状。** 两处返工都源于此：动作轴不带 `actionPerformed`（由 `verdict.mjs` 从 `resolution` 推导）、axes 按 intent 卷回代表步（非逐 event）。教训同 [[dont-rig-fixtures-reproduce-frozen-seams]]的反向：不 rig 之外还要不臆造——写断言前先读 `bin/replay.mjs` 投影代码与 p5 golden。修正方向是「对齐接缝」非「迁就实现」，checksum 重签有案。
3. **卷回代表步会掩盖中间步——聚合视图之下必须保留全量事实通道。** codex R1-F4（High）：verify 只扫 intent 代表步动作轴，intent 内中间 event 的 ambiguous 被静默掩盖。修法是加性外露 `eventActions`（verdict 不消费、报表不受扰），核验器逐 event 扫。通式：任何「N 事实卷成 1 结论」的接缝，下游若要作核验判据，必须能穿透回 N。
4. **人 confirm 门的锚必须在被 confirm 的文件之外。** codex R1-F1→R2-F1 两轮逼出：flow 文件可编辑，自带 `uniquePrefix`/`preconditions` 可与 flow 一起自洽伪造——执行段重验闸锚点一律取 `--testcase`（不可变层）+ caseId 三方一致。通式：签名对象自带的「防伪字段」都不是锚，锚在信任链上一层。
5. **fail-closed 要闭到「不产成功产物」，不止「非零退出」。** codex R1-F3 + R2-F3：非 unique 仍落 events + exit 0 是显性 fail-open；修成 exit 65 后旧成功产物残留同目录仍会假冒本轮。完整闭合 = 非零退出 + 不落成功产物 + 开跑先清旧产物，诊断报告单独落（route:human 依据）。「证不出→NEEDS_HUMAN」在编译器的物化形态就是这三件套。
6. **点击身份门必须全通道对称，含复合控件内层。** 编译执行起初 count>=1 就 `.first()`（探索式惯性），评审两轮逼平：click/fill/press、selectOption 的 combobox 与选项浮层（限定 `dropdownUnit.scope`）全部 count===1 才动作。编译期是「唯一一次真机跑」且带破坏性原子，身份门纪律与回放期同格——探索便利不是放宽理由。
7. **凭据门的假阳性要用域定义裁，不用直觉裁。** 全量收集 site.json 字面量把 ARIA 角色词（`button`）与信封字段名（`status`）当凭据，拦死一切含语义定位器的合法产物。裁决依据是 CONTEXT 既有定义：通道剖面 = 非凭据配置、tier-2 由 site.json 非凭据子集投影——跳过这些键不是放宽而是兑现接缝边界。codex 建议「取消跳过」被否（R1-F5 修正采纳留案），但其对抗性有真价值：跳过条件收紧成形状校验（role 限 ARIA 枚举白名单、profile 键限标识符/路径形），走私值照收。同 layer3 教训 5：脱敏边界 = 域会产生的内容 × 分层兜底，非「能否构造绕过串」。
8. **诊断遮蔽比直觉快。** 凭据门误拦时不读凭据值、写遮蔽诊断脚本（只回报命中的我方常量 + 字面量长度）两轮定位到 `role: "button"` 与 `successField: "status"`——红线内照样可以精确定位。

## 挂账（route:human，护栏 #16 gate 绿 ≠ 完成）

- 真机 bring-up 六项全在 `prd-p3-compile.json` observability：隧道 spike（CDP 归因/录屏不失真，失真退 Windows 侧）→ 真机编译 `tc_catalog_wf_crud`（需先手写规范 TestCase + LLM 出 flow 草稿 + 人 confirm）→ 编译期核验清单（⑤⑦④③ + 计数口径三方对账）→ 回放核验真机第二轮 → P4 交接面四件套 → `capturedAgainstBuild` 来源。
- `blockers` 计数不恒等分支 hermetic 无法造景（假 SUT 每行恰一删除按钮）：机制由 C8 走 `nonUnique∪blockers` 同一 fail-closed 路径锁住，行为差异留真机核验。
- 原子编译知识只覆盖 `catalog_wf_crud` 所用原子；扩表随飞轮条目（`chiefcomplaint_smoke` 将触发流式/对话原子知识）。
- `uniqueGuard` 建名查重字段已落 events、真查重逻辑未建（残留兜底靠保留前缀清扫，G7-1）。
