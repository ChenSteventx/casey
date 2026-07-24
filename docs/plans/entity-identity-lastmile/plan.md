# 实体身份与双定位 · 最后一公里（entity-identity-lastmile）

> 三方规划闭环产物：fable 起草 → codex `gpt-5.6-sol` max 异构压测 → opus 4.8 xhigh 仲裁（含三路只读代码核验）。
> Steven 2026-07-23 定：本轮范围「一轮全落 5 契约」；执行 subagent 全走 opus 4.8 xhigh；spine 承重文件串行、外围真并行。
> 本文是所有执行 subagent 的共享权威规格。状态事实仍以各契约 `loop/prd-*.json`、`loop/active-contract.json`、`git` 为准。

## 0. 一句话目标

身份裁判内核（同名不同 ID 判 DIFFERENT、多匹配必 AMBIGUOUS、缺 ID 不推 SAME、联合五元定位）已建；本轮把「真实 UI 消费者 + 生命周期强制」推到最远的 hermetic 可验面，同时**堵住一个当前就存在的隐性 fail-open**，其余诚实挂账。整体需求保持 🟡（内核已完成、真机与形式收据消费未完成）。

## 1. 承重结构事实（opus 三路核验，坐标已对代码复核）

身份机制是**三套并行子系统**，务必别混：

- **A 形式收据链（successor 内核）** = `lib/entity-semantic-lock-v2.mjs`。纯函数已实现（`createRunSuccessorProof` 是唯一导出；`canonicalReceipt`/`parseActionIdentityPolicy` 是私有函数、未导出）。被死门封住：`runtimeAuthorized!==true` 硬拒（:1386 evaluate、:1499 successor）、`runtimeBundleVerified=false` 硬编码（:464）、`rootId:null`（:469）、`createEntityRuntimeAdapter`(:1313)/`issueEntityRunContext`(:1323) 恒拒桩、`lib/entity-semantic-lock-publications.mjs` 与 `lib/entity-runtime-authority-bundles.mjs` 全空。lib+bin 零消费者。commit 819015f 字面意图 `fix: keep runtime provenance non-executable and opaque`——这是**有意的信任根撤销安全姿态**。v2 被 `prd-semantic-lock-cert-closure` 与 `prd-semantic-unit-discrimination` 以 sha `b7b5a47e` 冻结。**本轮不碰 A**：动它须过 kernel 设计门 + Steven 人签（`ratchet-security-revocation` 先例，仅 GRILL 无 plan）。
- **B 接线态 admission 旁车** = `lib/entity-semantic-lock-preflight.mjs`。已串 compile/sign/replay，按名与计数判。`SIDE_EFFECT_POLICY`（:42-52，9 键）已是「按原子分 effect/role」的骨架：`workflow.bindAgent={effect:'relation',requiredRoles:['source','target']}`；默认兜底 `mutation/[subject]`。**新发现**：表里有 `agent.removeToolByName`（mutation/[subject]）但**无对应编译器**——孤儿策略项。策略驱动逻辑**不得假设每个 policy 键都有编译器**。
- **C 智能体平台 ID 读回** = `lib/agent-identity-gate.mjs`（`resolveDualIdentity` 做 platformId 比对）+ `lib/agent-identity-observation.mjs`（`createIdentityObservationLedger` 纯逻辑零 IO、通道无关）。**真机 UAT 已过闸**（`docs/plans/real-uat-attestation/evidence/uat-signoff.md`，Steven 2026-07-23，用例 `tc_agent_id_readback_real_uat_v1`）。今天真跑的就是这套。用户说的「喂进门」目标是 C 的 `resolveDualIdentity`，不是 A。

**关键物理事实**：智能体列表 DOM 卡片**无 ID 属性**，platformId 只在网络信封（listApi `queryAgentPageList` 行）。故「名+ID 联合定位」结构上等价「启用 listApi 身份通道」——不存在「给 DOM 点击加读 ID」这条路。

**承重坐标（对代码复核，注意 compile-atoms 在 lib 不在 bin）**：
- `lib/compile-atoms.mjs:1267` `compileAgentSearchOpen`，分叉判据 `:1284 if(!ledger)`（无 ledger 走 v1 只按名 `exact:true`+容器闸零 ID 读回；有 ledger 走双证）。
- `lib/compile-atoms.mjs:28-55` `COMPILE_ATOM_COMPILERS`（25 键）：`workflow.bindAgent`→`compileWorkflowBindAgent` 在；**无 rename 编译器**（缺口坐实）。
- `bin/sign.mjs:247` `IDENTITY_OBSERVATION_ATOM='agent.searchOpen'` 写死；`:275-276` 签署时 `row.kind==='agent'` 硬校验 die(65)。
- `bin/compile.mjs:236-266` ledger 唯一从 `profile.agents.listApi` 注入（`routes.workflowList` 只是导航路由，支持 kind 只有 agent）。
- `bin/replay.mjs:284-311` 身份激活须冻结件是 v2 且指纹对齐；v1 件默认放行走旧路径。
- opaque-string ID：`lib/replay-forensics.mjs:38` `projectIdentityEnvelope` 对 id 纯属性访问、全链零 `Number()/parseInt`，`rowsValid` 用 `/^[0-9]+$/` 显式拒 JSON number 形态。**19 位 ID 已全程 opaque**——codex 的精度顾虑已落地，本轮只需加一条碰撞回归锁金牌防未来回退。

## 2. 最承重项：堵当前的隐性 fail-open（不可再缩内核）

今天 v1 路径（无 listApi）对实体存在性用例是「按名唯一 → 推 SAME → 出 entity-level PASS」，而需求明令「缺 ID/坏候选/扫描不完整不推 SAME」。**名唯一推 SAME 违反信任边界，是当前就存在的隐性 fail-open。** 把身份通道升为可信默认的同时，**必须同步把 v1 实体裁定降级为 `NEEDS_HUMAN`（`LEGACY_IDENTITY_UNVERIFIED`）**，否则升级动作本身制造「双轨静默低保真」。这条（C0+C1）是本轮不可再缩的 fail-safe 内核。

## 3. 五契约链（C0→C1→C2→C3 串行；C4 并行）

| 契约 slug | 内容 | 车道 | 依赖 |
|---|---|---|---|
| C0 `entity-identity-spine` | sign/compile 泛化为 per-kind channel/observer **闭集**注册表；agent 行为**逐字不变** | full | 无（地基） |
| C1 `entity-agent-identity-default` | fail-closed 编译闸（实体定向原子无已签身份剖面 adapter → exit 65，绝不静默退 v1）+ adapter-scoped 已签剖面**物化进冻结件**+ 有剖面 adapter 强制 v2 + **v1 实体裁定降级** + **C7 重签** | full | C0 |
| C2 `entity-workflow-source-readback` | `workflows.listApi` 注入 + 注册 workflow kind + sign 白名单泛化落地 + `compileWorkflowCreate/Open` 武装 source 读回；真字段名/抽屉类名 route:human 挂账 | full | C0 |
| C3 `entity-destructive-continuity-guard` | 策略驱动的目标连续性守卫（限 targeting/破坏性原子）：携带 `identityObservationRef`、**拦截并核对出站 mutation 请求 URL/body 的 platformId 后放行**、归零走 target-ID absence-proof 稳定窗口 | full | C2（compile-atoms/replay-actions 在 C2/C3 间串行） |
| C4 `entity-rename-negative-guard` | 冻结 rename 拒绝行为（浏览器副作用前拒、手造 replay artifact 必拒、不产 PASS、0/26 保红）；**不加假 rename 编译器**——只冻结「缺席即拒绝」 | light | 独立（并行） |

### sign 泛化必须是闭集（codex Q3 铁律）
`action policy → required role → bound kind/provenance → 允许的 observation issuer/atom`，校验角色、数量、来源、关联 ID **恰好匹配**。不能改成「任何同 kind 的观察行都接受」——否则伪造一条 `kind:'workflow'` 的观察行可混入。

### C3 的六条（codex Q1，用 identityObservationRef 非 receiptHash）
1. 创建/首读后生成**不可覆盖**的 observation，绑完整五元 + profile 指纹 + scope + 请求关联 + 步序。
2. 后续动作**携带该 observation 的 ref**，而非再按名生成新预期值。
3. 删前完整可证明扫描；坏候选/分页不全/不可关联 → `NEEDS_HUMAN`。
4. **拦截暂停 delete/update/add-tool 的 mutation 请求，放行前核对请求 URL/body 里的 platformId，不同则中止并证明 SUT 未改**——只看 response 太晚。
5. 若 mutation 请求本身无可验证 ID 且 DOM 无 ID → 结构上不能安全自动化 → route:human。
6. 收尾按目标 ID 稳定窗口 absence proof，非 name count===0。
> 语义边界：C3 是「运行时目标连续性守卫」，**不是**「消费同一份形式收据」（差签发根/授权/provenance/联合五元/TOCTOU 五层）。「消费同一份形式收据」这条形式义务本轮**结构性关不掉**（要唤醒 A）。报告必须拆开写两种能力，别用 C 冒充 A 强度。

## 4. WS1 安全迁移语义（codex Q2，非全局硬翻 replay）

- 可信 adapter-scoped 默认剖面：解析结果**物化进冻结件 + 签 profile 指纹**，不用随安装变的当前默认。
- 无精确 adapter/字段不全/scope 分页完备性未知 → compile exit 65，绝不退 v1。
- 新生成 `agent.searchOpen` 只允许 v2（语义上就是实体定位）。
- 历史 v1 不得因新剖面**静默升级**；**C7 核心不变量保留**，但期望从「续跑旧路径判 unique」改「保持 v1 但拒绝/隔离、不产权威 entity 裁定」。
- v1 破坏性动作须**第一次浏览器副作用前**拒绝。
- v1 只读实体用例不得再产权威 entity-level PASS → 最多 legacy diagnostic 输出 `LEGACY_IDENTITY_UNVERIFIED`/`NEEDS_HUMAN`。
- 合法非身份用例不该复用 `agent.searchOpen`；本轮**挂账**（另设非 targeting 原子拆分），以裁定层「entity-level 结论闸」兜底；仅当实测发现 v1 searchOpen 结果无法在裁定层拦住流入实体裁定时才升级（实现者带兜底自决，非前置 Steven 决策）。

### opus 补的四洞（codex 未讲清）
1. **身份剖面自身的信任根**：剖面是一条身份权威声明（断言 adapter 的 listApi 路径、recordsPath/totalPath 字段），错了就读回错 ID 判错对象（mini-A 问题）。hermetic 用 fixture 绑定剖面（指纹冻进金牌）；**真 adapter 剖面=route:human，Steven 签**；无已签剖面的 adapter → exit 65。故 WS1「强制」精确说是「对有已签剖面的 adapter 强制、对无剖面的拒」。
2. **读侧点击窗 TOCTOU**：DOM 卡片无 ID，点击时物理卡重锚只有 name+code、无 ID；listApi 读回（有 ID）到点击（仅 name+code）之间同 name+code 实体替换抓不到。**结构性极限**，须显式写进能力表当已知洞：name+code 不足够唯一 → AMBIGUOUS/route:human，别静默吞。
3. **0/26 失败模式漂移风险**：C0 泛化注册表可能改到 runtime-authority 检查之前的路径，令 0/26 仍红但**换了拒绝原因**——那也是行为漂移。收口须验 0/26「红且拒绝原因不漂」，不是只验「仍红」。
4. **孤儿策略项 `agent.removeToolByName`**（策略有、编译器无）：C3 策略驱动逻辑不得对无法编译的原子索要 subject observation。

## 5. 红先行测试清单

| 红条目 | 钉在 | 归属 |
|---|---|---|
| 8 条准入反例（伪造 kind / 角色数不匹配 / 来源不符 / 关联 ID 不符 / observation issuer 非法 / atom 越界 / 数量不恰 / provenance 缺） | sign 注册表闭集校验金牌 | C0 |
| 毒化-重复 exact name（两条同名全不得点击 → AMBIGUOUS） | searchopen golden + `resolveDualIdentity` | C1/C3 |
| 毒化-重复 name+code（码不再是唯一化捷径） | `resolveDualIdentity` | C1 |
| 毒化-预期 ID 在第二行（不得 nth(0)/array[0]/DOM 顺序绑错） | 双证路径 golden | C1 |
| 毒化-坏候选夹中间（坏候选不得被跳过静默取好的） | envelope 完整性金牌 | C1 |
| 19 位 Number 碰撞（`9007199254740992` vs `9007199254740993`） | opaque-string 回归锁金牌 | C1 |
| v1 实体裁定不得产权威 PASS（降级 NEEDS_HUMAN） | 改后的 C7 + 新增 v1 entity-verdict 降级断言 | C1（须 C7 重签） |
| 完备性因果：`total>records.length` / cursor 未尽 / 背景刷新 / 错 scope → 不得证 SAME/absent | listApi 分页完备性金牌 | C1(agent)+C2(workflow) |
| 出站 mutation 请求 platformId 不符 → 中止并证 SUT 未改 | C3 拦截金牌 | C3 |
| 无可验出站 ID 且 DOM 无 ID → route:human | C3 fail-closed 金牌 | C3 |
| 归零走 target-ID absence-proof 稳定窗口非 name count | C3 归零金牌 | C3 |
| rename 浏览器副作用前拒 + 手造 replay artifact 拒 + 0/26 保红 | rename 拒绝金牌 | C4 |

「任何实体 atom 不得自取 first」由毒化全族在 searchOpen/delete/add-tool 三个 in-scope 面各钉一遍。hermetic 验证轨=`tests/fixtures/chat-sut`（真 chromium 打本地 http，信封回 19 位纯数字 agentId）；workflow 侧仿造 `workflows.listApi` fixture。

## 6. checksum / 重签纪律

| 触碰点 | owner prd | checksumAmendments | ADR-0004 真补签 |
|---|---|---|---|
| C7 断言语义改（续跑→降级隔离） | `prd-agent-id-readback` | 老→新 sha + 理由 | **是，Steven 硬签**（收口阶段人工终端；loop 期 C7 金牌红/门控，不被签名阻塞） |
| searchopen golden（加 v2-only/降级语义） | `prd-entity-ui-wiring` | amend searchopen 键 | 若在人签集则真补签，否则 accept 重冻 |
| bindagent-lockchain/replay（C2 武装 workflow 读回后行为变） | `prd-entity-ui-wiring` | amend 两键 | accept 重冻（codex 四轮 PASS 既有冻结，改动须复评审） |
| agent-id-observation/gate/sign-observation/regression-diff 四 zero-sut | `prd-agent-id-readback` | C0 行为保序→理想不 amend；实测任一变则 amend | 变则重冻+复评审 |
| `entity-semantic-lock-v2.mjs` | `prd-semantic-lock-cert-closure`+`prd-semantic-unit-discrimination` | **不 amend——本轮不碰 v2** | 收口须验字节仍是 `b7b5a47e`；任何触碰=越界 |
| 0/26 golden | `prd-teachin-semantic-lock-runtime-discrimination-successor` | **不 amend，保红** | C4 不得使其转绿；验红且拒绝原因不漂 |

`passes` 只有 `gate.mjs` 有权写；冻结件对实现者只读。

## 7. 本轮挂账（诚实，逐条带因）

- 缺口 rename→successor 端到端：须唤醒 A → kernel 设计门 + Steven 人签，本轮不碰。
- 子系统 A（形式收据链）：819015f 有意封死信任根；「消费同一份身份收据」形式义务本轮结构性关不掉。
- 0/26 `runtime-discrimination-successor`：保前瞻红/route:human，只真机+A 能填绿；本轮验它红且拒绝原因不漂。
- 全部真机 UAT：真 adapter 字段名（recordsPath/totalPath）、抽屉真实类名、真删/改请求是否携带可验 platformId → route:human，须真机 UAT + Steven 签（ADR-0009）。
- 受控 locator/consumer 层全量中心化重构：本轮以毒化金牌锁不变量，中心层重构挂后继加固契约。
- `agent.searchOpen` targeting/非-targeting 原子拆分：本轮挂账，裁定层结论闸兜底。

## 8. 硬边界（三方一致，不可让渡）

裁判零 LLM；fail-safe 不 fail-open；不碰 v2 字节（`b7b5a47e` 冻结）；不伪造 runtime authority（不把 `runtimeBundleVerified` 设真、不造 hermetic bundle、不临时恢复接缝）；不让 0/26 因 stub 转绿；不加能真执行 rename 但不产 successor 的编译器；冻结断言只读、改字节走 ADR-0004 重签；完成只认退出码 + 真机 UAT 人签（ADR-0009）；碰 lib/bin 真并行走独立 worktree；强制层/迁移后复跑受影响金牌回主树复验；评审家族≠实现家族（实现=Claude/opus，评审=codex/grok/pi）。

## 9. 执行编排（一轮全落、全 opus 4.8 xhigh）

- **串行核**（本 worktree `casey-entity-identity-lastmile`，单 baton）：C0→C1→C2→C3，每契约走 GRILL→plan→accept（红先行+冻结）→loop（实现到绿）→review（异构）→learn。承重文件 `bin/compile.mjs`/`bin/sign.mjs`/profile schema+registry/`lib/compile-atoms.mjs`/`lib/replay-actions.mjs` 只由此串行线动。
- **并行外围**：各契约 accept 阶段的多红先行夹具编写可并行（写互不重叠新文件）；C4 独立 worktree 并行；异构评审并行。
- **收口**：full-gate 全触碰 prd 漂移扫（护栏 #19 复跑受影响金牌回主树）→ 验 v2 字节仍冻 → 验 0/26 红且拒绝原因不漂 → C7 的 Steven ADR-0004 补签+重冻 → 更新需求总表能力表（🟡 拆 hermetic 已证 / route:human / blocked-by-A）→ 刷 HANDOFF/NEXT-SESSION（docs 先于 dev 提交）。
