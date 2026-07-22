# Casey 需求、缺陷与完成进度总表

> 当前快照：2026-07-22，`dev@82484ab`（另有本地未提交增量：真机三链重表达 + 报告固定模板）。
>
> 本文补齐原 P0–P10 排期没有持续吸收的后续用户需求、真机暴露缺陷、易用性审计、原子能力审计与 regress 战略项。它是“需求有没有兑现”的对账入口，不替代 `CONTEXT.md` 的术语权威、ADR 的决策权威、PRD/gate 的机器证据或逐次真机 UAT 收据。
>
> 判断顺序：实际代码与实时 PRD/gate > 当前交接 > 本文 > 历史排期。`passes:true` 只证明对应机器验收，不自动等于真机、人签或业务完成。

## 1. 状态口径

| 标记 | 含义 |
|---|---|
| ✅ 已完成 | 需求实现、对应机器验收完成；要求真机/人签的，相关证据也已核销 |
| 🟡 部分完成 | 主机制已建，但仍缺真实消费者接线、真机 UAT、人签或完整业务覆盖 |
| ❌ 未完成 | 尚无可用实现，只有设计、桩、前瞻红基线或历史线索 |
| ⛔ 退役/阻断 | 曾实现，但被现行安全或生命周期政策禁止作为用户能力继续使用 |

总体情况：P0–P4 主需求完成；P5–P7 主机制已建但仍有严格完成闸；P8–P10 未收口。原子 registry 现有 60 项，其中 25 个动作编译器，加 `login` 与断言特殊路径后共 34/60 可进入编译路径，仍有 26/60 未实现编译路径。

## 2. P0–P10 主需求进度

| ID | 需求 | 当前进度 | 主要缺口 | 状态 |
|---|---|---|---|---|
| P0 | loop 开发治理机制 | loop、gate、ratchet、契约工作流已建 | P0-4a/P0-4b 改革仍暂停 | ✅（现役机制） |
| P1 | DDD 统一语言与 ADR | `CONTEXT.md`、ADR、术语守卫已建 | 无主需求缺口 | ✅ |
| P2 | TestCase、输入归一、意图编译 | 规范模型、fail-safe 编译输入和裁定接缝已建 | 历史 learn 尾项不影响机制 | ✅ |
| P3 | 编译与 authoring | 编译机制与 WSL 真机 bring-up 已收口 | 旧 recorder 支线已退出 MVP 关键路径 | ✅ |
| P4 | 断言草拟、冻结、人签 | 草拟器、冻结、重签、人签门和真实签署用例已建 | 无核心机制缺口 | ✅ |
| P5 | 回放、取证、零 LLM 裁定、漂移探针 | 回放内核和四态裁定已建并有真机运行 | 部分 owner/tier-2 真机义务未正式核销 | 🟡 |
| P6 | 有界自愈 | `heal-gate`、非就地 drift patch 等库机制已建 | `casey heal` 仍为 exit 3 诚实桩；真实 HARNESS_ERROR 首触闭环未完成 | 🟡 |
| P7 | 自包含报告 | HTML/Markdown/JSON、录屏、诊断、缺陷证据主链已建并有真机报告 | 个别消费与交付增量仍挂账 | 🟡 |
| P8 | web/CEF/arbitrary 多通道 | web 主路径已建 | CEF/arbitrary 真驱动、编译器、用例与回放未收口 | ❌/🟡 |
| P9 | tier-1 自检 + tier-2 真机 UAT | tier-1 已建；WSL 有部分真机证据 | 全量 tier-2、隔离浏览器义务和 Windows 原生真机闭环未完成 | 🟡 |
| P10 | 可信闭环自进化 | record→intake→distill、身份/语义锁和证据底座已建 | 正式原子晋升、跨运行真机复验、版本撤销、反馈闭环与可运行 heal 未完成 | 🟡 |
| 实体身份 | 实体身份与双定位（名称+编号/平台 ID 联合定位，详见 §3） | 身份模型与判别内核、`agent.searchOpen` 输入侧+DOM/信封双证门、`workflow.bindAgent` hermetic 全链已建；真机权威链（权威件+冻结实体锁+回放准入）2026-07-22 三链走通；平台 ID 网络信封读回 hermetic 轨全收口（codex 四轮异构评审 R4 PASS、含 sol 五面构造字节棘轮 R18-R21，已合并 `dev@648e09e`） | runtime adapter 同源读回、名称+ID 完整真机 UAT 链（绑 `uatCaseId=tc_agent_id_readback_real_uat_v1`、后继契约 `real-uat-attestation`）、同名敌意真机用例、关系双锁真机 | 🟡 |

## 3. 实体身份与双定位（P0 信任边界：业务实体名称 + 编号/平台 ID 联合定位）

### 3.1 用户需求

智能体、工作流及其它业务实体不得只凭名称或页面上的第一个匹配项确认身份。执行读写、删除、绑定关系或后置复核前，必须以以下联合身份确认：

`kind + name + code + platformId + scope`

其中：

- `kind`：业务对象类型，如 `agent`、`workflow`；
- `name`：当前业务名称；
- `code`：业务编号/编码；
- `platformId`：平台权威稳定 ID；
- `scope`：环境、父对象、租户或其它允许的稳定作用域指纹。

硬规则：

1. 有编号/平台 ID 时，名称与编号/ID 必须同时匹配；同名不同 ID 不是同一对象。
2. 缺 ID、重复命中、扫描不完整、字段矛盾、身份漂移均不得推导为 `SAME`。
3. 多个匹配不得 `.first()` 猜测，必须进入 `AMBIGUOUS`/`NEEDS_HUMAN`。
4. 创建对象后必须从平台权威读回名称、编号/ID，再生成身份收据；调用者、LLM 或视觉不得自签同一性。
5. 破坏性动作必须消费已冻结的实体绑定；不能从搜索框残值、页面顺序或裸文本猜目标。
6. 关系写入必须分别锁定 source 与 target。例如工作流绑定智能体时，workflow source 与 agent target 都必须有独立身份收据。
7. 改名/改码不能静默覆盖旧身份；必须有签署 transition，并在平台读回新身份后产生链接旧 receipt hash 的 successor。
8. 删除、更新、加工具等动作完成后，必须继续用同一平台 ID/身份收据做业务后置复核。

术语定义见 `CONTEXT.md` 的“业务对象身份收据”“身份观察旁车”“身份迁移”“语义锁”。

### 3.2 当前完成度

| 子需求 | 状态 | 证据/说明 |
|---|---|---|
| 冻结 `kind/name/code/platformId/scope` 身份模型 | ✅ | `lib/entity-semantic-lock-v2.mjs` |
| `agent` 策略要求 `platformId: required` | ✅ | semantic-lock v2 夹具与 identity policy |
| 同名不同 ID、同 ID 冲突、缺 ID、坏候选 fail-closed | ✅ | 语义锁单元攻击面与 zero-SUT 金牌 |
| 多候选拒绝，不按调用者可读 physical ID 折叠 | ✅ | `ENTITY_RUNTIME_MATCH_AMBIGUOUS` |
| 名称 + code 成对匹配，策略要求时继续校验 platformId | ✅ | `evaluateEntityAction` / successor readback |
| 身份观察旁车、events binding、冻结 lock、receipt hash 串接 | ✅ | observation/sidecar/runtime authority 契约族 |
| entity-binding operability 与恢复边界 | ✅ | successor 4/4、review-successor 1/1 |
| 智能体真实页面读出平台 ID | 🟡 | 编译/回放双证门 hermetic 轨全收口（`agent.searchOpen` 搜索步网络信封提 `agentId`/`agentCode`/`agentName` 三元组，DOM 无 ID 属性故走信封通道；codex 四轮异构评审 R4 PASS + 差分棘轮 21 检查，已合并 `dev@648e09e`；真机活数据双证实证绿，证据 `docs/plans/agent-id-readback/evidence/realmachine-live-verify.md`）。真机剖面正确字段名已实证：`recordsPath=data.list`、`totalPath=data.pageInfo.totalItems`（第一轮尖峰按惯例猜的 `data.records`/`data.total` 经真机纠正）；完整真机 UAT 链按冻结 `uatDefinition` 走后继契约 `real-uat-attestation`（route:human） |
| `agent.searchOpen` 按名称 + ID 联合定位 | 🟡 | 输入侧已收口（2026-07-22 dev@82484ab）；DOM+信封双证门已并入 dev@648e09e——完整性先决（`total===records.length`）+ 完整集合内同名>1 才 AMBIGUOUS（先数同名再查码，封分页藏同名假唯一）+ 点击前对已签 `platformId` 比对（双定位闭合到点击那一刻）；sol max 四轮设计共识 + codex 四轮实现评审 R4 PASS；真机 UAT 完整链仍 route:human（绑 `uatCaseId` 交 `real-uat-attestation`） |
| `workflow.bindAgent` source/target 双锁完整编译回放 | 🟡 | hermetic 面已完成（2026-07-22 dev@82484ab：编译知识+registry+回放专用门+双 receipt 锁链端到端、单边缺失必红、codex 四轮评审 PASS）；真机链与真机 UAT 未完成（route:human） |
| 可信 runtime adapter/publication 提供同源 ID 读回 | ❌ | 现役 production publication 保持 fail-closed 空态。注：`agent-id-readback` 契约走的是「列表接口网络信封」读回通道（回放取证层归因），非 runtime adapter/publication——两条通道并存，adapter/publication 路径本契约未碰、仍空态 |
| 名称 + ID 双定位真实 SUT UAT | ❌ | `runtime-discrimination-successor` 接线路径仍为 0/26 前瞻红 |
| 同名智能体、缺 ID、改名 successor 等敌意真机用例 | ❌ | 仅有纯函数/zero-SUT 证明，未取得真机权威 |

当前机器账：

- `prd-teachin-semantic-lock-v2`：1/1 GREEN；
- `prd-semantic-unit-discrimination`：2/2 GREEN；
- entity-binding operability 两契约：5/5 GREEN；
- `prd-teachin-semantic-lock-runtime-discrimination-successor`：0/1，目标态 0/26，保持诚实 RED，等待真实运行时权威和真机 UAT；
- `prd-agent-id-readback`（已合并 `dev@648e09e`）：6/6 GREEN——事务内核/双证门/sign 观察对账/差分棘轮（21 检查，含 sol 五面构造 R18-R21）/浏览器配方/存量回归全绿，另有真机活数据双证实证绿；codex 四轮异构评审 R4 终判 PASS。

因此本需求的准确结论更新为：身份模型、确定性判别内核、智能体平台 ID 网络信封读回与名称+ID 双证联合定位（编译/回放/签署闭环）已完成并经真机活数据实证；余下 runtime adapter 同源读回、名称+ID 完整真机 UAT 链、同名敌意真机用例、关系双锁真机仍未收口（route:human）。

## 4. 后续高风险缺陷修复台账

| 缺陷/需求 | 当前状态 | 说明 |
|---|---|---|
| 同一 intent 前序失败被末步 `unique` 洗成假 PASS | ✅ | `intent-event-fold` 已接入 replay；失败优先级与 verdict 穿透已冻 |
| `workflow.deleteByName` 全页命中、目标残留却 PASS | ✅ | 目标域锁、精确绑定、后置计数归零已实现 |
| 删除确认可能点到错误/旧弹窗 | ✅ | causal dialog binding 已实现 |
| 删除链真实 UAT | ✅ | 2026-07-22 三链重表达后真机复跑全 PASS 零 error（CRUD 4/4、发布 4/4、历史 8/8；run 目录 `runs/*/run_uat_*_20260722_*`），删后归零双证有清理证据背书；旧冻结件被准入面拦截属设计（重表达配方见 `runs/real-uat-20260722/`） |
| SPA 请求结束后按钮延迟挂载，settle 提前放行 | 🟡 | `profile.loading`、占位消失、三拍静止窗已实现；多次真机标定未核销 |
| 抽屉开错、DOM 漂移、pin 复制/搬移后假绿 | 🟡 | drawer-lock 机器侧多轮加固完成；广泛真机覆盖不足 |
| 语义锁 v1 假 SAME | 🟡 | v2/能力门/运行时权威可达面已加固；运行时接线路径仍待真机 |
| intake 校验后置导致失败留脏账 | ✅ | TOCTOU 校验前移并纳入原子事务 |
| observation 金牌在 DrvFs 超时/sharing violation | ✅ | timeout、有界重试、破坏前身份重验已实现 |
| 强制层改动后未复跑受影响金牌，产生陈旧绿 | ✅（机器侧） | 护栏 #19 + 生命周期重裁 + 复 gate 对账；真实浏览器义务另列 route:human |
| 27 个旧 live browser/fake-SUT 金牌仍被 agent 执行 | ✅（隔离） | 已隔离并禁止 agent 执行；239 项义务待真实 UAT |
| 普通 checksum 漂移 | ✅ | 两处精确 SHA 人签和 gate 已收口 |
| 安全撤销仍表现为普通 mismatch | ❌ | `ratchet-security-revocation` 仍在设计期 |
| Grok/pi.dev 被错误认证探测或公开搜索凭据 | ✅ | provider hook + `AGENTS.md` 已强制内联认证纪律 |
| compile help 遗漏真实执行旗标 | ✅ | `a5b59dd` 已恢复 |

## 5. 易用性审计 F1–F14

| ID | 需求 | 当前状态 |
|---|---|---|
| F1 | 零真机查看样例报告 | ⛔ `casey demo` 曾实现，后被 real-SUT-only 生命周期政策阻断；当前不构成可用入口 |
| F2 | `casey run` 不要求手抄长参数 | ✅ 已支持 `casey run <caseId>` 约定布局 |
| F3 | 自由文本不要求代理手搓 TestCase JSON | 🟡 已有 `scaffold-case`；LLM 归一、mapping 与补缝仍在 CLI 外 |
| F4 | 全新 SUT 无真机也能产正式报告 | ❌ 现行纪律要求新业务用例 route:human，不能用 fixture 冒充 |
| F5 | `casey init-profile` 剖面脚手架 | ❌ 已从 ingest-scaffold 拆出，尚未另立实现契约 |
| F6 | 0-error 用例选择不依赖硬编码历史绿 | 🟡 skill 有现验纪律，但仍写当前 `tc_wf_history_version`，无动态选择器 |
| F7 | MCP 补齐 CLI 生命周期命令 | 🟡 record/intake 已补；distill、晋升、撤销等后继面仍不完整 |
| F8 | skill 命令映射补齐 | 🟡 record/intake 已补；distill 与后继闭环动作未完整进入映射 |
| F9 | package/MCP 版本单一事实源 | ✅ 当前 package 为 0.2.0 |
| F10 | MCP 挂载不手抄绝对路径 | ✅ `casey mcp-config` 已实现 |
| F11 | Claude/Codex/pi 分家接入 | 🟡 `AGENTS.md`、runbook 已有；完整 OS onboarding 资产当前在 GitHub `main`，尚未进入 `dev` |
| F12 | 正式分发 | 🟡 GitHub 远端已有；`package.json private:true`，仍无 npm/npx 分发 |
| F13 | 一条 doctor 命令查就绪度 | ✅ `casey doctor` 已实现 |
| F14 | Windows/WSL/Linux/macOS 成文且可验 | 🟡 公共 `main` 有完整 onboarding；`dev` 未统一，Windows 原生真实回放 UAT 未完成 |

## 6. 原子覆盖与三业务面

### 6.1 当前原子覆盖

- registry：60；
- 动作编译器：25；
- 含 `login` 与断言特殊路径的可编译原子：34；
- 尚无编译路径：26。

主要未实现族：

- workflow：switch、模型、MCP 工具、变量、结束输出、版本优化、试运行；
- agent：模型选择、保存、发布、工具移除、详情状态复核；
- picker：仅显示已选、状态快照/恢复、取消等；
- evidence/final：尚无正式编译动作路径。

registry 在场不等于可执行；编译器在场也不等于已通过正式真机六级：

`registry → compile → zero-SUT 正反例 → 人签正式 case → 真机回放 → 视觉/业务后置一致`

### 6.2 业务面

| 业务面 | 当前进度 | 主要缺口 |
|---|---|---|
| Heren 工作流创建/保存/发布/历史/删除窄链 | ✅ 有真实成功证据 | 更多配置与复杂场景未覆盖 |
| Heren 画布 add/connect/open/select/set | 🟡 机器侧较强 | 正式真机覆盖不足，剩余画布原子未实现 |
| Heren 智能体搜索/测试/消息 | 🟡 可跑 | 曾真实裁出 SUT_DEFECT；名称+ID联合定位未接 |
| Heren 智能体 CRUD/模型/MCP 工具 | 🟡 第一纵切已建 | 完整业务流与真机成功基线不足 |
| 医生站 | ❌ | 尚无正式业务模型、profile、case 和真机链 |
| Hi 小助 | ❌ | 只有 CEF schema/历史线索，无现役 driver/compiler/case/回放闭环 |

## 7. regress 战略项

| 需求 | 当前状态 |
|---|---|
| promptset 数据驱动 overlay | ✅ |
| 可编辑 boundary/security 内置提示词库 | ✅ |
| 多用例聚合报告 | ✅ |
| content expect 只作 soft 注解、不污染 verdict | ✅ |
| `gen-prompts` CLI 外 LLM authoring | ✅ |
| agent/tool 第一纵切与 Casey 集成 | ✅ 机器侧 |
| regress 约 10 条 agent/tool 流全部迁移 | 🟡 只完成第一纵切，其余仍待迁 |
| 内置提示词真实 SUT UAT | ❌ |
| Hi 小助历史 CEF/CDP 重新真机发现 | ❌ |
| regress Git 敏感历史审计 | ❌/待核销 |

## 8. 真机与人签待办

1. 智能体名称 + 编号/平台 ID 联合定位、同名敌意样本、改名 successor 的真实 SUT UAT。
2. `admission-trust-root-separation` 冻结件人签与 `compile --execute` 授权路径 UAT。
3. 27 个隔离 live executable、239 项浏览器义务的真实 UAT、可信签名和迁移存证。
4. mountdelay 多轮真机回放、`profile.loading` selector/text/时序标定及新增冻结验收人签。
5. P6 真实 `HARNESS_ERROR → 非就地补丁 → 人签 → 重跑`。
6. Hi 小助 CEF/CDP 和医生站第一条真实闭环。
7. Windows 原生真实 HTTP、回放、确定性裁定、同次录屏、视觉复核和独立 HTML。

## 9. 分支归属风险

GitHub `main@163c745` 与内部 `dev@c573974` 没有共同祖先。公共 `main` 含完整 OS onboarding、Windows PowerShell 操作面、账户配置等文件；当前 `dev` 含完整内部契约、门禁、测试与治理历史，但没有合入上述全部公共分发资产。

因此“公共发布能力”与“内部最新内核”目前分裂在两条历史上。正式更新 `main` 前必须做需求级和文件级对账，不能直接覆盖或把 `dev` 当作 `main` 的严格超集。

## 10. 当前优先级

### P0

1. 智能体名称 + 编号/平台 ID 真实采集、联合定位、source/target 双锁和真机 UAT。
2. `ratchet-security-revocation` 有效设计 R2、D4 人签与强制层实现。
3. admission trust-root 人签/execute UAT。
4. Hi 小助当前 CEF/CDP 真机重新发现；医生站只读勘察与业务建模。
5. 隔离浏览器义务真实 UAT 与可信存证。

### P1

1. 按业务流补齐剩余 26 个不可编译原子，不按 registry 数量平均铺开。
2. `init-profile` 与前半段自然语言脚手架继续收口。
3. regress 其余 agent/tool、workflow/canvas 流迁移并在 Casey 重编译、重签、真机 UAT。
4. 可运行 `casey heal` 与可信闭环晋升/撤销。
5. GitHub `main` 公共发布线与 `dev` 内核线统一。

## 11. 主要证据入口

- 里程碑定义：`docs/plans/bootstrap/plan.md`；
- 当前交接：`docs/HANDOFF.md`、`docs/codex/HANDOFF.md`；
- 业务与原子审计：`docs/atom-readiness-assessment-20260715.md`；
- 易用性审计：`docs/plans/usability-audit/proposed/AUDIT-PLAN.md`；
- regress scope：`docs/plans/regress-strategy/SCOPE-OPTIONS.md`、`LEGACY-AUDIT-20260716.md`；
- 可信闭环：`docs/plans/closed-loop-evolution/plan.md`；
- 删除真实 UAT：`docs/plans/workflow-delete-by-name-hardening/review/real-uat-20260716-final.md`；
- 当前 PRD：`loop/prd-*.json`；
- 术语权威：`CONTEXT.md`；
- 硬纪律：`loop/GUARDRAILS.md`。
