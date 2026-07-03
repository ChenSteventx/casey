# wf-publish-states — 飞轮第三条移植：发布状态机×按钮态（full）

## 背景

飞轮第三条（`dom_crud` 余量首条，验证「机制缝递减」：第二条 3 缝 → 本条 1 缝）：把 `regress_autotest` 的 `wf_publish_states`（登录→建空工作流→断未发布态【发布 present/保存 present/导出 absent】→点发布→断已发布态【导出 present/新建版本 present + D3 补「发布 absent」】→删除清理）移植到 casey，全程吃现成命令面 `compile`→`draft`→人签→`run`。决策全表见 `proposed/GRILL.md`（D1 词表收窄 present/absent + enabled/disabled 挂账后补 / D2 role 必采 + profile 可选补采 / D3 补负向断言，Steven 逐条拍板）。

源侧实现知识（已挖全）：`assert.buttonState` = `getByRole('button', { name })` 四态判（present=visible / absent=count 0）；`workflow.publish` = 单击「发布」不强断后置；编辑器顶栏按钮 role 可达（regress 2026-06-08 真机确认，bring-up 停站按纪律重验）。唯一新原子 `workflow.publish` 照 `workflow.save` 形状。

## 改动

1. `bin/check.mjs`（D1）：词表 `buttonState: ['enabled','disabled']` → `['present','absent']`——词表 = 可草拟 = 已实现；`enabled`/`disabled` 随 `publish_blocked` 维度契约带实现回归（Steven 明令「后面需要补完整」，挂 prd observability，不许静默丢）。
2. `tests/_golden/schemas/expected-frozen.schema.json`（M3）：`assertionOp` enum +`present`（`absent` 已在；`enabled`/`disabled` 字符串留位不删）；`prd-seams-freeze` checksum 重签 + 其 gate 复验 GREEN（p4-drafter 双 enum 对齐先例）。
3. `lib/replay-assert.mjs`：`IMPLEMENTED_KINDS` 10→11（+`buttonState`）；`evalOne` 加 case——`hits = c.buttonHits?.[a.value]`：缺采集（非数字）→ `ok:false`/`actual:null`（证不出）；op `present` → `hits>0`；op `absent` → `hits===0`；其他 op（enabled/disabled 遗留）→ `ok:false`/`actual:hits`（证不出方向，绝不判真）。
4. `bin/replay.mjs`（D2）：
   - `profile.buttons` 可选段：present 则 `extraSelector` 须非空字符串，形状非法 fail-closed exit 65（`routes` 先例；非凭据：纯选择器）；
   - 代表步静默点采 `buttonHits`（同 `textHits` 范式）：枚举本 intent + global 的 `buttonState` 断言值，role 通道 `getByRole('button', { name: value, exact: true }).count()` + 补采通道（配置时：`locator(extraSelector)` 过滤 `textContent.trim() === value` 计数）合计；评估上下文加 `buttonHits` 键，缺采集 `undefined` → 证不出；
   - 同构口径修正（对 GRILL D2 的机械句）：按 kinds-harden 先例取回放侧单点采集——`textHits` 同型；观测现状 schema `additionalProperties:false` 零动，草拟走 `assert.buttonState` 原子留痕映射、不吃观测采集。
5. `lib/assertion-draft.mjs`：`mapAtom` 的 `assert.buttonState` 条件翻转——state 为 `present`/`absent` 才映射（kind 已实现 → 硬断言）；`enabled`/`disabled` 回 null → `pending[]` route:human（直到挂账兑现）。
6. `lib/compile-atoms.mjs`（M4）：`compileWorkflowPublish`——单击「发布」（semantic role button exact:true），照 `workflow.save` 形状、不强断后置（完整=发布成功/不完整=校验拦，交断言判）；分派表 +`workflow.publish`。编译知识真机验证在 bring-up 停站（chat 五原子先例）。
7. 新夹具 `tests/fixtures/publish-sut/server.mjs`（fork 模式，login-sut 进程教训）：编辑器单页假 SUT——顶栏真 button「保存/发布」（未发布态），点「发布」→ 按钮群翻面（「发布」消失、「导出/新建版本」出现）；对抗场景位（M6，query 参数切换、chat-sut 五场景先例）：
   - `plainText`：非按钮 span 文本「导出」常驻（探 role 通道不混文本采集）；
   - `divButtons`：div 假按钮形态（role 盲区）——配 `extraSelector` 补采可见 / 不配则盲；
   - `dupButtons`：多匹配同名按钮。
8. 新 golden `tests/_golden/wf-publish-states.golden.mjs`（红先行）：
   - U 单元向：`IMPLEMENTED_KINDS === 11` 且含 `buttonState`、不含 `switchState`（前沿计数持有纪律）；`evaluateAssertions` 三向（present 命中真过/absent 命中 0 真过/缺采集 `ok:false`+`actual:null`）+ 遗留 op 证不出；`check --validate-only`：present/absent 合法 + enabled 拒（词表收窄钉死）；
   - D 草拟向：`mapAtom` present → 硬 `buttonState` 断言（不 soft）；enabled → `pending`；
   - I 集成向（publish-sut）：role 通道真计数；`plainText` 场景 span 同名文本不进 `buttonHits`；`divButtons` 无补采 → present 红（盲区方向落红不落绿，D2 fail-open 论证的机器证明）；`divButtons` + `extraSelector` → present 绿、absent 红（双向）；点「发布」后翻面采样（发布 absent 真过、导出 present 真过）；
   - W 接线向：`casey run` 对 publish-sut 端到端——未发布态三断言 + 已发布态三断言（含 D3 补项）全 PASS + 报告产出。
9. 涟漪补冻（GRILL 盘点兑现，各 prd 补冻 + gate 复验）：
   - `kinds-harden.golden` U1：未实现范例 `buttonState` → `switchState`；
   - `chiefcomplaint-smoke.golden` U1：去 `size===10` 精确计数（移交本契约 golden 持有）+ 范例换 `switchState`；
   - `p4-drafter.golden`：C-map 夹具 state `enabled`→`present`、期望翻硬（buttonState 已实现不再 soft）；`validateDraft` r2/r3 未实现范例 kind 换 `switchState`（op on）；
   - `report-fidelity.golden` :75（buttonState enabled 对空上下文）：实现后可观测行为不变（缺采集 → `ok:false`/`actual:null`），预期零改，accept 期实跑核。
10. 真机件（`cases/tc_wf_publish_states/`，gitignored）：手写规范 TestCase（intents 三段：create【未发布态三断言折入】/ publish【已发布态三断言含 D3 补项】/ delete 清理 + 计数对账）、flow 草稿（LLM=CLI 外产）、profile（复用 catalog 剖面形状；`buttons` 段真机采样后定）——route:human 四停站（confirm → `--execute` → `casey draft` 人签 → `casey run` 报告过目）+ D2 只读探针：编辑器顶栏按钮 role 可达性重验（2026-06-08 二手结论重验）。

## 非目标

`enabled`/`disabled` op 实现（挂账 `publish_blocked` 维度契约带实现回归——Steven 明令后补完整）；`wf_history_version`/`wf_open_smoke`（飞轮后续条目，前者等 buttonState 装好只剩两个原子加法）；`switchState`（画布维度）；`echo_default_on`（画布前哨，错档已纠 M5）；错误 toast 结构类名收紧（既有挂账）；报告消费侧加法（本 session C 任务另契约）。

## 验收

新 golden 全绿（实现前红：词表 present 必拒 / 评估走 default 分支 / `buttonHits` 无采集 / 夹具未建）；四份涟漪 golden 重钉后绿 + 各自 prd 补冻 gate 复验；`prd-seams-freeze` 重签复验 GREEN；回归锁 `p5-replay`/`p5-replay-coverage`/`layer3-wiring`/`run-history`/`chiefcomplaint-smoke`/`kinds-harden`/`p4-drafter` + `selftest --tier1` 原样绿；gate GREEN。真机 route:human 四停站 + role 可达性探针挂 observability，人不在场只挂账绝不代签。
