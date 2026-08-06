# 聚焦代码评审 · wf-create-entry-anchor-wait（单轮）

## 验证执行摘要

**变更面核全量**：`git diff c977fde..f50c6ed` 恰 5 文件（lib +10 行、金牌 181 行、plan/红证/PRD），白名单外零改动（`loop/active-contract.json` 是 gate 生成的 gitignore 文件，非变更）。

**实测复核**（全部于工作树只读验证 + `/tmp` 拷贝变异）：

| 证据 | 结果 |
|---|---|
| 金牌 HEAD 实跑 | 3/3 exit 0（17.4–17.6s，S2 内耗 ~15.3–15.8s） |
| 红基线复现（/tmp 拷 c977fde + 最终金牌字节） | S1 红/S2 绿/S3 红、exit 1，与红证**逐字节一致**（仅差红证尾行 `EXIT=1`） |
| 突变闭环 | 还原 lib → exit 1；复原 → sha256 恒 `2ec8bc14…` → exit 0 |
| PRD `testChecksums` 三条 sha256 | 全部自算核对相符 |
| 邻接 | wf-crud-sleep-import 4/4、agent-delete-confirm-import 4/4、term-lint --registry 0、selftest --tier1 GREEN |

**关键核验（风险 1 的锚同一性）**：`lib/compile-atoms-run.mjs:locatorFor` 对 `{kind:'role', role:'button', name:'新增工作流', exact:true}` 映射为 `getByRole('button',{name, exact:true})`，与锚 `run.page.getByRole('button',{name:'新增工作流', exact:true})` **逐字段同一**（role/name/exact 全等）。预算耗尽路径：锚不落任何 event/note/blocker，事件序逐位不变（S2 钉死 + 手推 6 事件序一致），fail-closed 语义不动。回放侧/冻结件：emit spec 字节未动（diff 仅在 emit 前插入锚块）、无断言/adapter/冻结档变更——零影响证伪成立。

## Findings

- **[Medium] lib/compile-atoms-workflow-crud.mjs:135-138 —— 120s compile 看门狗余量在失败路径被 +15s 收窄，hermetic 不可证 ——** 预算耗尽（按钮永不挂载）时全链路照跑：登录 ~15s + create nav ~14.5s（load 11.4s+quietPoint 2.5s）+ 锚 15s + create 五步 ~21s + 读回 ~3s + save/publish ~7s + delete nav 14.5s + delete 链 ~9s ≈ **95s 最坏，余量 ~25s**。上一轮 exit 65 完成时总时未知（<120s），+15s 后若原跑 >105s 将触发看门狗 exit 1（比 exit 65 更差——无报告产出）。建议：B4 重跑（已在计划中）首例记录失败路径总耗时；若余量吃紧，把锚预算降到 10s（真机实测 15s 内挂载窗口充足）。
- **[Low] tests/_golden/wf-create-entry-anchor-wait.zero-sut.golden.mjs:154 —— S2 上界 20s 实际余量仅 ~4s ——** 实测 S2 自身 ~15.3–15.8s（15s 预算 + sleep(250) 尾拍 + 序列开销），20s 阈值余量 ~4s；事件循环被重度抢占时 `setTimeout` 尾拍过冲（60 拍累积）可误红。慢机本身不误红（deadline 是钟驱动的），仅病态 stall 有风险。建议：可接受；如想加保险把上界提到 22s 或注明余量依据。
- **[Low] lib/compile-atoms-workflow-crud.mjs:135-136 —— `Date.now()` 非单调，时钟回拨会超预算 ——** 若 NTP 回拨，等待按回拨幅度延长（`quietPoint` 同款 idiom，全库既有先例；S2 用同一时钟测耗时故金牌抓不到）。后果有界（watchdog 是 timer 驱动照走）。建议：维持现状（与库内 idiom 一致）；如要根治可换 `performance.now()`，但属全库性改动、超出本契约。
- **[Low] lib/compile-atoms-workflow-crud.mjs:134-138 —— 锚期网络请求归因边界位移 ——** 锚在 `currentStepId=null` 期间轮询（最多 15s），渲染尾请求由旧代码归 `atstep_1` 变为归 `background`，`observed-*.json` 的 atstep_1 requestLog 切片与旧跑字节不同（observed 每次重生成、非冻结件，断言不依赖该切片）。零正确性影响。建议：无需动作，知悉即可。
- **[Low] tests/_golden/wf-create-entry-anchor-wait.zero-sut.golden.mjs（S2 全量跑）—— 邻接金牌运行时被 +15s 通胀 ——** wf-crud-sleep-import（执行 compileWorkflowCreate 于零命中空页）由 ~6–7s 涨至 20.3–22.7s（实测），无计时断言、gate 全绿，纯运行时成本。建议：可接受；未来如有多例执行该原子的金牌需留意总和。
- **[Low] tests/_golden/wf-create-entry-anchor-wait.zero-sut.golden.mjs:134-136 —— S1 理论作弊窗：连续两次立即 count() + 固定 sleep 可过钉 ——** （samples≥2 且 emit 时已挂载即绿，不要求「轮询间隔」）。S3 结构钉（15s 预算 + count() 轮询在 emit 前）+ 计数键绑死同语义锚（错锚轮询 samples=0 必红）联合封堵；「不等待直接点」与「等了但没轮询」两类回退均被挡，判别力成立。属金牌固有局限，可接受。

零 Critical / 零 High。唯一 Medium 已由计划自身路由至 B4 真机重跑核验（observability route:human，乙授权一例一跑），实现本身最小、锚同一、耗尽零行为差、fail-closed 语义不动——不构成阻塞。

IMPLEMENTATION_VERDICT: APPROVE
