# layer3-wiring — learn（沉淀）

契约收口：grill/plan/accept/loop/review/learn 全绿（lane light）。第 3 层集成 hermetic 骨架——补上 `verdict→report` 唯一断链的报表模型装配器 `lib/report-model.mjs` + 薄 CLI + `casey run` 编排。本文沉淀 loop + 异构评审（codex gpt-5.5 非同族，七轮 R1..R7）暴露的教训。事实源：`git diff`（本 session 未提交改动）、`loop/audit.jsonl` 的 layer3-wiring review 记录、HANDOFF「当前状态」。

## 交付（live）

- `lib/report-model.mjs`：报表模型装配器（零 LLM 纯函数）——verdict.json ⋈ StepAxes ⋈ observed ⋈ events → 符合已冻 `report-model.schema.json` 的只读报告数据源；缺陷单仅 SUT_DEFECT。
- `bin/report-model.mjs`：薄 CLI（`--verdict/--axes/--out [...]`，退出码 0/64/1）。
- `casey run` 编排（`bin/casey.mjs`）：串 相3回放→相4裁定→报表模型装配→相6报告，`runs/<caseId>/<runId>/` 布局 + 退出码归一 fail-closed。
- 回归锁：`tests/_golden/layer3-wiring.golden.mjs`（e2e 假 SUT × 2 场景）+ `tests/_golden/layer3-wiring-coverage.golden.mjs`（51 检查，装配器 fail-safe/凭据/schema 覆盖）。

## 教训

1. **只读消费者的第一要务是一致性自守，不是重裁定。** 装配器最危险的 fail-open（codex R3 High）——只信 verdict.json 逐步裁定、不验它与 axes 一致，失败硬断言可被装成 PASS（假绿）。解法是**镜像 `verdict.mjs decide()` 作一致性门**：每步复算 `expectedVerdict(ax)` 与 verdict.json 所载 `{verdict,reason}` 比对，不一致 fail-closed 抛——**只比对不重写**（护栏 #15 装配器不重裁定 与 护栏 #14 fail-safe 在这里合流）。真管线 verdict.json 由 verdict.mjs 吃同一 axes 产出、二者必然一致，此门只在损坏/篡改/上游 bug 时开火，不误伤合法产物。同族自建看不见这个洞。
2. **别倒着裁夹具——rig 的夹具会把 fail-open 藏起来。** 原覆盖 golden 的 D4 用 `action.resolution:unique`（ap=true）+ 无失败断言却标 SUT_DEFECT，这是 `verdict.mjs` 永不会产的态。codex 的「语义洞」发现逼出真相：`buildDefectTicket` 无失败断言时无条件合成 `actionPerformed=false`、未验 `ap===false`。修夹具到可复现态（`resolution:none` 真未达成）+ 加 ap 前置校验 + 新增「ap=true 却判 SUT_DEFECT → fail-closed」的反向 golden。教训同 [[dont-rig-fixtures-reproduce-frozen-seams]]：夹具要能从冻结接缝复现，不能裁到预定裁定。
3. **join 要双射、不能只单向。** codex R4 High：只遍历 verdict.steps、不验 axes.steps 全消费——axes 多出一个失败步而 verdict 漏掉它会被静默丢（漏报假绿）。修：map 后断言 `seenStep.size === axByStep.size`（verdict 步已逐个唯一 join，size 相等即双射）。
4. **无 ajv 就得逐字段自守 schema。** additionalProperties:false 的冻结 schema 靠装配器手工守：枚举/reason 一致性/真 ISO date-time（形状正则放过 2026-99-99，须补日期范围）/passes 布尔/status 整数/errorEnvelope.field 字符串（否则收敛 null，因 frozen checkErrorEnvelope 合法回 field:null）/id·label 类型收敛 string|null。错型即产物损坏 → fail-closed 或收敛为合法值。
5. **凭据脱敏要按威胁面分层、收敛到现实形状——别对着假想敌 gold-plate。** codex 逐轮把 redaction 推向越来越刁的构造串（多词 `api key:`/`session id:`、Basic base64 短值、SSN/身份证/手机号 本地化 PII）。产品负责人一句话点破：业务中台不会把这些吐进 toast/URL/报错。裁决——装配器只覆盖**现实凭据形状**（URL 剥 query/hash + 路径逐段、邮箱、敏感词单 token、长不透明串、percent-decode 双判），**真凭据的权威末道闸是下游 `bin/report.mjs` credentialGate**（落盘前按 `.auth/site.json` 真实字面量精确比对拒写）。装配器是上游 defense-in-depth，不是最后一道。教训：redaction 是无底洞，正确的边界是「本应用会产生的内容」×「有无下游字面量兜底」，不是「能否构造出绕过串」。
6. **信任边界决定脱不脱敏。** `signerId`/`signedAgainstBuild` 唯一来源是人签门授权元数据（非 SUT/网络/observed 观测面），不属护栏 #7 的 SUT→报告 凭据外泄威胁面；且构建标识常含长 git sha、签署者身份是审计核心，脱敏会毁掉 期望版本化 + 人签审计。codex R5 认可此信任边界。脱敏跟着数据来源的可信度走，不是见字段就脱。
7. **异构评审要给对范围才有牙。** 前六轮 codex 一路 FAIL 逼出全部结构真 fail-open（价值最高），但也一路把 redaction 推进假想领域。第七轮**把已定评审范围（现实形状 + 下游 credentialGate 分层 + 本中台不产生某些内容）写进评审包**，codex 才在正确范围内判 PASS。教训：异构评审的价值在结构 fail-open；对开放式问题（redaction 完备性）要给它明确的范围与分层，否则会陷入 whack-a-mole。

## 挂账（route:human，护栏 #16 gate 绿≠完成）

- 真数据端到端未走：依赖 P3 真编译产真 events.json + 观测现状（`catalog_wf_crud`）→ 灌 `casey run` 管线（已对合成数据跑通）→ tier-2 真站 UAT。
- `casey run` 编排器接 `run-history.jsonl`/`run-metrics.json` 产出（seams-freeze-v2 刚冻的接缝、编排器是天然生产者）——本轮不产，另起 light 辐条。
- 一致性门镜像 `verdict.mjs decide()`：二者是两份复制、有漂移风险。当前靠覆盖 golden（喂同一合成 StepAxes 比对两侧）钉住；`verdict.mjs` 冻结不动是前提，若将来改 decide 须同步镜像并复验 golden。
