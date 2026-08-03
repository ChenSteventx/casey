# chiefcomplaint-sendandwait-admission：甲案准入 + v2 后继闭环

契约 lane=light（入口分流理由见 `loop/active-contract.json` 的 `laneReason`）。
甲案裁定来源见同目录 `GRILL.md`；2026-07-31 异构评审后的 v2 后继裁定见
`SIGN-AND-AFTER.md` 第七节。**本契约不自签任何字节**：预执行权威、冻结断言、
v2 实体锁和 tier-2 清单都必须由 Steven 对最终字节明签。

## 1 目标

Steven 已选择甲案：`chat.sendAndWait` 登记为
`entityChange:'none'` / `identityBindingRoles:['subject']` /
`nonEntityEffect:'persistent'`。原计划把目标停在「离线 v1 草稿只差最后签」，但评审已证明
v1 回放不消费已签编号与平台标识，可能向同名错误实体发送持久消息。该路径作废。

正式目标改为 v2 后继闭环：

1. 用 `profile.agents.identityMode:'network-code-dom-name-v1'` 表达真实页面事实：DOM 只证
   精确唯一名称和同一物理点击句柄，编号与平台标识只取完整网络信封；`cardFields` 只含
   `name`，禁止把卡片描述误当编号。
2. Steven 先签绑定 flow/testcase 的预执行权威，之后才允许真机 `compile --execute`；
   编译必须 fresh 产出 v2 `entity-bindings.draft.json` 与
   `identity-observations.compile.json`，不得复用 2026-07-31 的离线 v1 草稿或只读读回值冒充。
3. Steven 使用 fresh 身份观察件重签 `expected.frozen.json` 并首签
   `entity-locks.frozen.json` v2；签后回放必须在点击前对已签名称、编号、平台标识全等。
4. 真机流式回放完整产生确定性 `verdict.json`、录屏和独立报告；随后把 tier-2 成员的
   `effect` 改正为 `mutation`，启用每 run 逐次授权，补 v2 实体锁 artifact，并完成人签
   manifest 与其 owner PRD checksum 换签。

完成判据不是「文件已备」或「等待最后签」，而是上述链条按序完成、真机产物齐全、
零 `LLM` 裁判给出四态结果，并经 Steven 视觉复核与签认。

## 2 交付物

1. `docs/plans/admission-policy-facets/plan.md` 的 `chat.sendAndWait` 结论与甲案一致；
   对应人签策略权威与 checksum 修正案保留完整审计链。
2. `lib/entity-semantic-lock-preflight.mjs` 的 `ATOM_ADMISSION_FACETS` 登记
   `chat.sendAndWait`；`GRILL.md` 中判定不登记的另四枚原子仍不登记。
3. 人签冻结权威源
   `tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json`
   与生产镜像一致，相关 PRD 的 checksum 修正案闭合。
4. `cases/tc_chiefcomplaint_smoke/flow-tc_chiefcomplaint_smoke.json` 全部需绑定步骤携
   `sourceIntentId` 与恰一条 subject `entityBindings`。
5. `cases/tc_chiefcomplaint_smoke/profile.json` 增加闭合 `agents` 身份通道：
   `identityMode:'network-code-dom-name-v1'`、`listApi` 完整信封投影、`itemContainer` 和
   仅含 `name` 的 `cardFields`。路径和字段名由 fresh 真机只读核对，不在计划中写真目标值。
6. 人签 `entity-pre-execution-authority`：绑定最终 flow/testcase 原始字节、caseId、
   production 受众和全部 mutation 口径步骤；checksum 先发布进用例 registry PRD，缺失或
   错配时 `compile --execute` 必须在浏览器前拒绝。
7. fresh 真机编译产物：`events.json`、`compile-report.json`、v2
   `entity-bindings.draft.json`、`identity-observations.compile.json` 与 observed reality；随后只从
   本轮观察件和已确认 flow 生成 `entity-confirmations.json` 对账草稿。失败路径不得留下可被误签的半套件。
8. Steven 重签后的 `expected.frozen.json` 与 v2 `entity-locks.frozen.json`；用例 registry
   PRD 直接登记两件 checksum，不再保留“`testChecksums` 必须为空”的错误论断。
9. 同次真机流式 run 的 `axes.json`、`verdict.json`、`run-history.jsonl`、
   `run-metrics.json`、`video.json`、非空录屏和 HTML/Markdown/JSON 独立报告。
10. `cases/tier2-suite.manifest.json` 中本员改为 `effect:'mutation'` +
    `perRunApproval:true`，artifacts 增 v2 实体锁并更新 profile/expected 等实际变化项；manifest
    人签换版后，同步更新 `loop/prd-p9-tier2-live-smoke.json` 的冻结 checksum 与修正案。

## 3 验收

判绿只信退出码，不 grep 失败标记串。A1-A10 保留原编号；A7/A8 按已裁 v2 后继纠正，
不再接受 v1 预演充当完成。

| 验收点 | 判据 | 手段 |
|---|---|---|
| A1 甲案落进事实源 | `admissionPolicyForAtom('chat.sendAndWait')` 返 `entityChange:'none'` / `identityBindingRoles:['subject']` / `nonEntityEffect:'persistent'`，派生 `admissionClass:'entity-lock'`、`effect:'mutation'`、`requiredRoles:['subject']` | 纯函数探针 |
| A2 主策略通道零行为位移 | 登记前后 `policyForAtom('chat.sendAndWait')` 的 `{effect, requiredRoles}` 逐字节相同 | 改前改后对比 |
| A3 遗留 event 投影位移被如实枚举 | 登记后 `legacyEventProjectionPolicyForAtom` 由 `requiredRoles:null` 收紧到 `['subject']`，方向为收紧 | 纯函数探针 + 请签包记账 |
| A4 镜像等于权威不分裂 | `admission-policy-facets` 金牌 `authority` 段登记前后退出码记账；权威源同步加行后该段复绿 | 逐段跑金牌记退出码 |
| A5 flow 绑定闭合 | `requiredFlowEntityBindings(flow)` 不再返 `ENTITY_BINDING_REQUIRED_ROLES_INVALID`，逐步一条 subject | 纯函数探针 |
| A6 连续性闸不被误触 | 本例五枚原子 `requiresTargetContinuityRef` 全 `false`，空 ref 表下破坏性闸返 `{ok:true}` | 纯函数探针 |
| A7 真机编译过全部浏览器前闸 | 缺/错预执行权威时 `compile --execute` 浏览器前拒绝；人签权威、最终 flow/testcase 与 production 受众全匹配后，fresh 真机编译 exit 0 并产齐 v2 五件套 | 负控哨兵 + 真机编译 |
| A8 v2 草稿锁可冻结 | `freezeEntityBindingsDraft` 对 fresh v2 草稿与身份观察件预演返 `ok:true` / `replayReady:true` / `schemaVersion:2`，双 digest 与原始字节精确相等；v1 草稿或缺观察件恒拒 | 真实 sign 接缝预演，不落人签件 |
| A9 邻接零陈旧绿 | 消费方金牌逐个复跑记退出码，改前改后对比；HEAD 既有红如实挂账不修 | 护栏 #19 |
| A10 凭据零泄漏 | 全部输出、日志、文档零凭据值、零真目标地址，`--sut` 只喂回环基址 | 逐件复核 |
| A11 网络信封单证编号剖面 | 共享剖面解析成功且模式为 `network-code-dom-name-v1`；`cardFields.code`、未知模式、缺完整信封字段均浏览器前拒绝；编译与回放所得 `identityProfileDigest` 相同 | case 专项静态验收 + 既有身份模式金牌 |
| A12 fresh 身份观察闭合 | 观察件来自本轮 compile，恰覆盖终端 `agent.searchOpen` 点击，完整信封同名恰一；观察行、确认件、v2 草稿按五元键双射，构建标记、events hash、profile digest 任一错配均拒签 | 产物校验器 + 负控矩阵 |
| A13 v2 签发与回放消费 | `sign` 带 `--entity-observations` 后 exit 0；冻结锁 schemaVersion=2 且签名、观察 hash、profile digest、events hash 全闭合；回放同名替换、编号错配、平台标识错配均零点击并落非 PASS | sign 金牌 + 真机回放 |
| A14 流式正式 run | `chat.sendAndWait` 动作成功，硬 `streamReplyReceived` 经真实流式取证裁定；同次 run 产物与录屏齐全，四态只来自 `verdict.json` | 真机 `casey run` + 报告附件清点 |
| A15 tier-2 成员纠偏 | manifest 本员为 mutation 且逐次授权，artifact 集含 v2 锁并与磁盘 hash 全等；manifest 与 owner PRD 换签后漂移扫描 exit 0；缺本轮 mutation 授权必须拒跑 | manifest 校验 + tier-2 负控 |
| A16 真机完成闸 | 本员在 fresh tier-2 batch 中产生 `pipeline_complete_with_verdict` receipt，流式覆盖非空、无 `HARNESS_ERROR`、正式附件齐全；Steven 复核录屏和持久消息副作用后签认 | 真机 tier-2 + 人签 |

## 4 可命令验收

实现阶段须新增 case 专项零 SUT 金牌
`tests/_golden/chiefcomplaint-v2-successor.zero-sut.golden.mjs`，至少覆盖 A5-A8、A11-A13
和 A15 的负控；该文件在 production 实现或用例字节变更前先跑出真实红基线，再冻结 checksum。
最小机器验收集：

```text
node tests/_golden/chiefcomplaint-v2-successor.zero-sut.golden.mjs
node tests/_golden/agent-network-code-identity.zero-sut.golden.mjs
node tests/_golden/agent-network-code-identity-page-context.zero-sut.golden.mjs
node tests/_golden/agent-id-sign-observation.zero-sut.golden.mjs
node tests/_golden/admission-policy-facets.zero-sut.golden.mjs
node tests/_golden/p9-tier2-selftest.zero-sut.golden.mjs
node tests/_golden/support/prd-drift-scan.mjs
node loop-kit/bin/term-lint.mjs --registry
node bin/casey.mjs selftest --tier1
```

真机链只在相位 0 全绿、Steven 已签预执行权威之后运行：先 fresh compile，再由 Steven 签
fresh v2 产物，然后跑单例流式正式 run，最后才进入带本轮 mutation 授权的 tier-2 batch。
每段都以进程退出码和结构化产物判定；不得把旧 run、旧 v1 草稿或文件存在当成通过。

## 5 人工可观察性

| 维度 | 人工动作与完成证据 |
|---|---|
| 真实身份通道 | Steven 只读确认网络信封字段、DOM 名称选择器及目标恰一；编号不从 DOM 描述推断，真实值不写入计划、日志或报告 |
| 预执行授权 | Steven 对最终 flow/testcase hash、production 受众和全部 mutation 步签 `entity-pre-execution-authority`；代理只可备草稿，不得填真人签名冒充授权 |
| fresh compile 身份观察 | 人在场见证本轮 compile，确认观察来自本次真实页面与完整网络信封；07-31 旧只读收据只作参考，不可升级成签署输入 |
| v2 冻结签发 | Steven 审阅 expected、确认件、观察件和 v2 草稿后执行 sign；`capturedAgainstBuild` 必须与 `--against-build` 精确相等 |
| 持久消息副作用 | 本例 manifest 按 mutation 管理；每次真机 run 另取一次明确授权，授权次数不由甲案策略登记推断 |
| 真机流式与视觉复核 | Steven 复核录屏中目标智能体、发送动作和流式回复完成态；机器 verdict 保持原值，人签不改写四态 |
| 清单换签 | Steven 对 manifest 的 effect、逐次授权、artifact 集和 hash 变化签字；owner PRD 的 checksum 修正案绑定旧/新摘要与归档件 |

## 6 边界（本契约不做）

- 不代签、不写成 Steven 本人书写；不写 `passes`（只有 `gate.mjs` 有权）。
- 不登记 `GRILL.md` 表里判「不登记」的四枚原子。
- 不新增“非实体持久副作用”专用授权类型；tier-2 复用现役 mutation 逐次授权门，但不因此豁免人签。
- 不把 DOM 卡片描述、列表位置或同名猜测当编号；网络信封不完整一律 fail-closed。
- 不复用离线 v1 包作为 successor，不把 `schemaVersion:1` 预演或“只差最后签”写成当前状态。
- 不碰 `../loop-kit`、`lib/report.mjs` 与 `p7-report` 相关夹具。
- 不碰破坏性三例的连续性 ref 接线；它们由独立契约承担。
