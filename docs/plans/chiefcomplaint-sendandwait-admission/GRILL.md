# GRILL：`chat.sendAndWait` 的准入档裁定

日期：2026-07-31　裁定人：Steven（本次会话决策岔口）　记录：Claude（代填字段，非本人书写）

## 岔口原文

问：`chat.sendAndWait` 的准入档（admission class）定成哪一档？

- 甲：登记为可锁——`entityChange: none` / `identityBindingRoles: ['subject']` / `nonEntityEffect: persistent`，
  派生 `admissionClass = entity-lock`，可由人签冻结实体锁满足。被测智能体即 subject。
- 乙：守住 `unsupported`——按 `docs/plans/admission-policy-facets/plan.md` 第 49 行的原设计
  `none / [] / persistent`，派生 `unsupported`，全面 fail-closed。

**Steven 选甲。** 明确不取乙的理由（他的话）：乙会让 `tc_chiefcomplaint_smoke` 永久不可跑、
tier-2 流式面归零。

## 甲案的机械后果（实测，不是推断）

1. 甲案三面的派生投影 = `{ admissionClass: 'entity-lock', effect: 'mutation', requiredRoles: ['subject'] }`，
   与今天「未登记原子保守默认」（`entity` / `['subject']` / `unknown`）的派生投影**逐字节相同**。
   即：主策略通道零行为变更。
2. 唯一的行为位移在遗留 event 投影（`legacyEventProjectionPolicyForAtom`）：未登记时是
   `requiredRoles: null`（三角色任一且恰一个），登记后收紧成「恰 subject」。方向是收紧，不是放松。
3. 若照乙案签，拒付理由会从「缺锁」变成 `REPLAY_EVENT_POLICY_INVALID`——没有任何锁文件能满足
   （`policyForAtom` 对 `unsupported` 返 `null`，四个消费点各自的 `!policy` 分支判死）。

## 另四枚原子为什么不登记

`tc_chiefcomplaint_smoke` 事件里的另四枚原子（`nav.agentManagement` / `agent.searchOpen` /
`agent.openTestPanel` / `chat.closeTestPanel`）**一枚都不登记**。判断依据逐条：

| 原子 | 吃保守默认落哪一档 | 登记会怎样 | 结论 |
|---|---|---|---|
| `nav.agentManagement` | `entity-lock`（默认 `entity`/`['subject']`/`unknown`），已可由签名满足 | 若按「导航不改实体」如实登记成 `none`/`[]`/`none` → `unbound-read`，是**放松**；且 `safeUnboundReadEvent` 的信封白名单只收 `nav.workflowManagement`，登记后零绑定通道仍走不通，白担一次放松风险 | 不登记 |
| `agent.searchOpen` | 同上，已可由签名满足 | `admission-policy-facets` plan §2.1 已如实描述为 `none`/`['subject']`/`none`，派生投影与默认逐字节相同；登记的唯一净效果是把遗留 event 投影从「三角色任一」收紧成「恰 subject」——本例已按 subject 铸锁，收益为零，却要多一次 ADR-0004 人签 | 不登记 |
| `agent.openTestPanel` | 同上，已可由签名满足 | 面板开关如实登记会落 `unbound-read`（放松），同 `nav.agentManagement` 的第二条理由：零绑定通道走不通 | 不登记 |
| `chat.closeTestPanel` | 同上，已可由签名满足 | 同上 | 不登记 |

判据一句话：**保守默认已经把这四枚放在可锁档（`entity-lock`），签名能满足，不构成阻塞；
登记它们要么是放松（增风险）、要么是零收益的收紧（多一次人签）。**「不需要就别为了整齐而登记」。

`chat.sendAndWait` 之所以是例外，不是因为它被卡住（它同样吃默认落 `entity-lock`），
而是因为：① Steven 在岔口上就它作了裁定，裁定必须落进事实源；② 现行设计文档第 49 行
写着的是乙案，不改就是留一颗定时炸弹；③ 它的第三面真值是 `persistent`（真给被测智能体发消息、
在对方会话里留痕）而不是 `unknown`，如实登记把这件事写进人签权威源。

## 本轮不裁的事

- 「有非实体持久副作用」的**独立授权档**（谁签字承认「本次跑会真发消息」、绑哪段事件字节、
  允许执行几次）仍然不开。甲案是把 `chat.sendAndWait` 塞进既有的 `entity-lock` 档，
  用 subject 绑定承载「被测智能体是谁」，**不承载**「允许发几次消息」。这条缺口如实挂账。
- 破坏性三例（`tc_catalog_wf_crud` / `tc_wf_publish_states` / `tc_wf_history_version`）的
  `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` 与本裁定无关，见
  `docs/plans/p9-uat-close/resign-runbooks.md` 第三节。

## v2 后继对授权口径的纠正

2026-07-31 的 v2 裁定不改变上面的甲案，也没有创造新的授权类型，但它纠正了两个后继执行口径：

1. v1 实体锁不能让已签编号和平台标识进入点击前双证，故离线 v1 包不得签发或回放；正式路径必须是
   人签预执行权威 → fresh 真机编译身份观察 → v2 实体锁人签 → 真机流式回放。
2. `chat.sendAndWait` 会在真实会话留下持久消息，tier-2 manifest 的 `effect` 必须如实记为
   `mutation`，并使用现役 `perRunApproval:true` 逐次授权门。这个门只回答「本次是否允许执行一次变更型
   用例」，不替代 subject 身份锁，也不等同于本节明确未新建的“非实体持久副作用专用授权档”。

因此，旧清单里的 `effect:'read'` 和“只差最后签”都不是裁定后的合法完成状态。manifest effect、
profile、v2 实体锁 artifacts 及 owner PRD checksum 的变化须作为同一 successor 换签包交 Steven 明签。
