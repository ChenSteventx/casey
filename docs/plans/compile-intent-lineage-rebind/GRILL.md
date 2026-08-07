# GRILL · compile-intent-lineage-rebind（前提修正定案）

会话内以代码勘察 + 纯函数探针走完设计树；三轮裁定均由 Steven 当轮点选完成：
① 原「成品段记账双门」岔口初裁 C（案例拆分）→ ② 前提修正后重裁「先修接线取真证再裁」
→ ③ 立项确认（full 六阶段 + worktree）+ 混合态全或无阻断。

1. **十三跑成品段双门是不是同一个语义冲突？** 否——这是本契约的立项前提修正。出处链闸
   `CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID` 的真拒因是意图号命名空间错配：
   生产事件带编译自生序数 `intent_0..intent_4`（十三跑 compile-report verification 实录），
   而 `issueCreatedWorkflowCompileProvenance` 按流步 `sourceIntentId`
   （`intent_create/intent_cleanup`）匹配终端事件
   （`lib/entity-created-workflow-continuity-v3.mjs:208-236`），两套号永不相等 →
   create 步终端事件数 0 必拒。与「单流单发行」无关。
2. **探针证据？** 同一份真实 `cases/tc_catalog_wf_crud/flow.confirmed.json` 字节喂纯函数：
   事件意图号取生产态 `intent_1/intent_4` → 拒
   `CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID`（与十三跑同码）；改成
   `intent_create/intent_cleanup` → ok。双向复现、可重放。
3. **金牌为何没逮住？** `tests/_golden/support/p9-replay-grant-fixtures.mjs:42-49` 手工把
   事件 `intentId` 与流步 `sourceIntentId` 写成同一命名空间（`intent_create`）——夹具喂了
   生产从不产出的理想对齐输入，纯函数金牌假绿模式再添一例（与「抽验证器时金牌只测纯函数=
   假绿」教训同族）。十三跑是史上第一跑抵达此闸（前十二跑全部阻断在执行链更早层，
   `hasCreatedWorkflowPair` 分支从未在零阻断下走到）——「从未走通过」家族第五例。
4. **为什么修生产侧而不是闸侧？** 三重依据：闸字节被多份 PRD checksum 冻结，动闸走改版
   人签、代价大且其语义没错；CONTEXT.md 第 70 行登记 `intentId` = 用例语义步 id（人/LLM
   authoring 时写）——生产事件塞编译器序数本就不符登记词义，重绑是实现回归词表；teach-in
   路径已有同款重绑与原则注释（`lib/compile-atoms-flow.mjs:86-99`「compiler-local
   intent_N 只服务编译运行态，不得进入 formal replay」）——标准路径漏绑属实现缺陷。
5. **修法与行为面？** `compileFlow` 事实产生点：流步带 `sourceIntentId` 时把本步产出事件
   的 `intentId` 重绑为该值，`lastIntentId` 同步（断言折叠锚不让 `intent_N` 旁路泄回，
   镜像 teach-in 块）。行为面当前仅 `tc_catalog_wf_crud`（全仓唯一 `flow.confirmed.json`，
   七步全带 `sourceIntentId`）；其余流零漂移。附带收益：authored 意图号在配方演化下稳定，
   序数号则随步数漂移——后续冻结件按语义号锚定不再无谓翻新。
6. **混合态（同流部分步带、部分不带）？** 初裁全或无（混合掷错）；同日被全仓扫描
   唯一真差异证伪并经 Steven 反转为**逐步存在即绑**：`entity-ui-wiring.bindagent-replay`
   冻结金牌夹具口径明文「变异步携 `sourceIntentId` + 绑定，nav/assert 步不带、assert
   折进前一意图锚」（该金牌 `:108`、`:124` 注释）——混合是本仓预执行门口径的既定合法
   惯例，非 authoring 缺陷；全或无掷错把它截胡成「执行失败 exit 1」。反转后：带号步
   重绑并同步 `lastIntentId`，裸步保持自生号与遗留折叠行为；出处链闸只看 create/delete
   步（确认流里两步均带号），闸语义不受裸 nav 步影响。首版掷错的红证与反转后的
   delta 红证均存 accept/red-proofs/。
7. **原 A/B/C 岔口怎么办？** Steven 重裁：先修接线、十四跑取真证、再裁。前提修正后真语义
   冲突只剩基数双射一道门（`entity-observation-registry.mjs:392`：注册表给 `workflow.open`
   定了无条件恰一行 source 观察义务，让位后终端 0 行必拒）；H1i 单发行方与 C3 同名拒在
   十三跑已被让位机制满足（单原子通过、删除 ref 正常武装、流内真删完成）。初裁 C
   （案例拆分）暂挂，届时以单焦点真证重裁：C 维持，还是改收窄版 A（仅基数门学让位、
   豁免判据由门内重推导——同流同 platformId 的 create subject 观察在场才豁免，不信标记）。
8. **十四跑预期（预登记，防事后解释）？** 出处链闸绿；exit 65 仍在且拒因应恰剩基数门
   `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION` 一道；出现任何其他红即停、不连跑。
9. **非目标？** 不动三道冻结门任何字节；不碰滞后冻结件（`entity-locks.frozen.json`
   签于 2026-07-30、`expected.frozen.json` 仍钉重表达前三意图形，其改版重签属 Steven
   在途的 PRD 冻结清单工作流）；不裁基数门修向；不动观察让位机制。
10. **金牌形？** 双态钉：以真实确认流字节驱动重绑后事件过出处链闸（突变还原重绑必红、
    现行必绿）；混合态阻断钉；「registered 观察原子须各持独立 `sourceIntentId`」边界钉
    （两个观察原子共用一个意图号会塌组）；accept 层须过真实 `compileFlow` 缝而非手搓
    对齐夹具（假绿教训落地）。
