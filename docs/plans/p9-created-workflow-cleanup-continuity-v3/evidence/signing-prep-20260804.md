# 签署会话备料证据（2026-08-04）

编制：Claude（P9 收口备料 subagent，受主循环调度）　基线：`dev` @ `2b05659`
性质：只读勘察 + 零 SUT 预演 + 草案落盘。**全程零网络、零浏览器、零凭据接触；未跑 `casey sign`；
未改 `lib/`、`bin/`、`tests/`、`loop/`；未动任何 `*.frozen.json` 与已签 `cases/tier2-suite.manifest.json`。**

配套：跑单见 `SIGNING-SESSION.md`；chief 缺件考古见 `CHIEF-EVENTS-MISSING.md`。

---

## 一、三例 v3 结构授权边：逐字段绑定表

三例的 `flow` / `testcase` / `profile` 现役精确字节已闭合到「可产 v3 结构授权边」，
本节列出草案将逐字段绑定什么。**表里只有两类值是签署会话当场才定的**：
`eventsSha256`（fresh compile 产的 `events.json` 字节）与两个 `stepId`（compile 分配的终端步号）。

| 字段 | `tc_catalog_wf_crud` | `tc_wf_publish_states` | `tc_wf_history_version` |
|---|---|---|---|
| `schemaVersion` / `artifactKind` | `3` / `created-workflow-ownership-authority` | 同左 | 同左 |
| `authorizedFor` | `created-workflow-continuity` | 同左 | 同左 |
| `flowSha256` | `sha256:e11deb4e90f7cacc…` | `sha256:59a915f84657b9ba…` | `sha256:d52d05177137b143…` |
| `testcaseSha256` | `sha256:577fd47e8d8b7b87…` | `sha256:b74206ccd815cf0b…` | `sha256:c966f6e2450fd6b5…` |
| `profileSha256` | `sha256:65720124cb3815b2…` | `sha256:312c5a9c0e59709e…` | `sha256:3a559af811d75874…` |
| `eventsSha256` | 待 fresh compile | 待 fresh compile | 待 fresh compile |
| create `intentId` | `intent_create` | `intent_create` | `intent_create` |
| create `atom` / `role` | `workflow.create` / `subject` | 同左 | 同左 |
| create `candidateId` | `candidate-wf-atl-create` | `candidate-wf-pub-s1` | `candidate-wf-hist-s1` |
| delete `intentId` | `intent_cleanup` | `intent_cleanup` | `intent_cleanup` |
| delete `atom` / `role` | `workflow.deleteByName` / `subject` | 同左 | 同左 |
| delete `candidateId` | `candidate-wf-atl-create` | `candidate-wf-pub-s1` | `candidate-wf-hist-s1` |
| create/delete `stepId` | 待 compile 分配（终端步） | 同左 | 同左 |
| `listApiScope` | `/ai-manager/process/queryProcess` | 同左 | 同左 |
| `nameTemplate` | `atl_{{uniqueName}}` | 同左 | 同左 |
| `consume` | `once` | 同左 | 同左 |
| `mutationAdapter.method` | `POST` | 同左 | 同左 |
| `mutationAdapter.path` | `/ai-manager/process/delete` | 同左 | 同左 |
| `mutationAdapter.idLocation` | `body.masProcessId` | 同左 | 同左 |
| `audience`（freeze 时由人给） | `production` | 同左 | 同左 |

三例 create 与 delete 绑同一 `candidateId`，即 v3 要求的「同一条生命周期边」；`ownershipEdges` 恰一条，
满足回放控制器的 `edges.length === 1` 硬要求。

## 二、预演实证（生产面，零 SUT）

预演脚本合成一份「fresh compile 会产的最小形状 events」，其余五源全用现役真实字节，
走的是 Steven 会跑的同一条生产 CLI 与同一组纯函数。

| 步 | 入口 | 三例结果 |
|---|---|---|
| 起草 | `node bin/entity-authority.mjs created-workflow-draft <caseId> --events … --flow … --testcase … --profile … --compile-provenance … --out …` | 均 exit 0 |
| 冻结预演 | `freezeCreatedWorkflowOwnershipAuthority`（signer 位填 `REHEARSAL_NOT_A_HUMAN_SIGNATURE`） | 均 `ok=true` |
| 读回 | `readCreatedWorkflowOwnershipAuthority`（五源字节全绑） | 均 `ok=true` |
| preflight 正控 | `checkCreatedWorkflowOwnershipPreflight`（已签 create/delete 端点） | 均 `ok=true` / `allowExecution=true` |
| preflight 反控 | 同上，create `stepId` 换成未签值 | 均 `ok=false`、`CREATED_WORKFLOW_PREFLIGHT_EDGE_NOT_AUTHORIZED`、`allowExecution=false` |

预演产物只落会话临时目录，**没有任何一件写进 `cases/`**；`REHEARSAL_NOT_A_HUMAN_SIGNATURE` 不是签名、
不可复用，签署会话必须用真字节重跑一遍。

## 三、红证：v3 结构锁在 fresh compile 之前造不出

| 探针 | 命令/入口 | 结果 |
|---|---|---|
| 现役（陈旧）`events.json` 起草 | `entity-authority created-workflow-draft tc_catalog_wf_crud …` | exit 65，`--compile-provenance 不可读`（该件根本不在场） |
| 由陈旧 `events.json` + 现役 flow 推 provenance | `issueCreatedWorkflowCompileProvenance` | `ok=false`、`CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID` |

根因：三例现役 `events.json` 是 2026-07-22/07-30 的旧编译产物，`intentId` 还是 `intent_0/1/2` 一路，
既无 `workflow.deleteByName` 步，也无 `compilePhase: terminal` 标记；而重表达后的 flow 走
`intent_create` / `intent_save` / `intent_cleanup`。两边不同源，v3 provenance 闭不上——**这不是缺陷，
正是 v3 要求「结构边只能绑当轮真编译字节」的机制在挡**。

## 四、承重发现：三例实体锁必须随 fresh events 重签

`plan §12` 的 route:human 清单列了「v3 entity locks、三例 expected、Tier2 suite manifest」，
**漏了三例 v1 实体锁的重签**。实测（生产入口、零 SUT）：

| 探针 | 输入 | 结果 |
|---|---|---|
| ① 正控 | 现役 `events.json` + 现役 v1 锁（经 `loop/prd-tc_catalog_wf_crud.json` 信任锚铸权） | `ok=true`，`frozen-entity-locks-internal-policy` |
| ② fresh events + 现役 v1 锁 | 同上锁，events 换成 fresh 形状 | `ok=false`，`FROZEN_ENTITY_LOCKS_EVENTS_MISMATCH`，下一步 `RESIGN_LOCKS_FOR_EXACT_EVENTS_BYTES` |
| ③ fresh events + 不供锁 | 不传 `--entity-locks` | `ok=false`，`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID` |

原因链：v3 回放控制器只覆盖 `workflow.create` 与 `workflow.deleteByName` 两条 `intentId + atom`
（`coveredIntentAtoms`），而三例 flow 还有 `workflow.save` / `workflow.publish` /
`workflow.clickEditorButton` / `workflow.closeDrawer` / `login` 等步——它们在人签冻结的副作用策略里
一律是 `entityChange: entity` + 必备角色 `subject`，于是 `bin/replay.mjs` 的
`needsLegacyIdentityAdmission` 为真，旧准入门照旧要一份绑当轮 `events` 字节的冻结锁。

好消息：撤销/换签路径已实现（`--resign --resign-entity-locks` + `entity-locks.frozen.json.publish.json`
恢复日志 + `archive/entity-locks.revocations.jsonl`），不再是 `resign-runbooks.md` 第三节写的
「只有文案没有实现」。跑法见 `SIGNING-SESSION.md` B8。

另一条连带：三例 `profile.json` 现已声明 `workflows.listApi`，`workflow` 也已在
`ENTITY_KIND_COMPILE_CHANNELS` 与观察注册表在册，所以 fresh compile 会产 `schemaVersion: 2`
的实体绑定草稿 + `identity-observations.compile.json`。**新锁是 v2**：`casey sign` 必须带
`--entity-observations`，且 `--against-build` 会与观察件的 `capturedAgainstBuild` 做等值比对、不符拒签。

## 五、承重发现：flow 的 G3 人 confirm 会作废现有预执行权威草案

三例 `flow-<caseId>.json` 现为 `confirmedBy: ""` / `confirmedAt: null`。实测（带
`CASEY_LAUNCH_SENTINEL`，哨兵未落盘 = 从未到浏览器启动点）：

```
node bin/compile.mjs tc_catalog_wf_crud --execute --sut <本地回环> --out-dir <临时目录> …
→ compile: flow 草稿未经人 confirm（confirmedBy/confirmedAt 空）……拒跑
→ exit 66
```

而人 confirm 就是往 flow 里填两格 → flow 字节变 → `flowSha256` 变。现役
`cases/<caseId>/execute-authority.draft.json` 三件绑的是**未 confirm 的 flow 字节**
（本轮已用生产 CLI 逐例重建并逐字节比对：三件与现役草案完全相同，即它们是「当前未确认字节」的忠实草案）。

**顺序铁律：先 confirm flow，再重产 execute 草案，再 freeze。** 反过来做，权威件在 compile 那道门
会以 flow 字节失配被拒。

## 六、delete 请求形状的证据强度（自评）

| 字段 | 值 | 证据 | 强度 |
|---|---|---|---|
| `method` | `POST` | 三例 2026-07-22 真机编译产物 `observed-<caseId>.json` 的 `requestLog` 各一条：`/ai-manager/process/delete`、`POST`、`status 200`、`attributedStepId` 恰为删除确认步 | 强（真机实采、三例互证） |
| `path` | `/ai-manager/process/delete` | 同上 | 强 |
| `idLocation` | `body.masProcessId` | **未经真机确认**。旁证两条：① 列表信封行标识字段就是 `masProcessId`（`profile.workflows.listApi.fields.id`，2026-08-03 只读探针实测 `complete:true`、按名精确命中 1 条、ID 类型 string）；② `scripts/p9-workflow-adapter-probe.mjs` 备了 `matchingLocations` 反查，但 2026-08-03 那轮因真实环境无可删对象返 `NO_DELETE_CAPABLE_RECORD_AVAILABLE`，`mutationSent:false`，未取到请求体 | 弱（推断，未实采请求体） |

`requestLog` 按设计只记 URL/方法/状态，不记请求体，所以历史产物里没有、也不该有 body 形状。

**这一格的运行时验证点在首次签署后的 fresh compile**：`lib/compile-atoms-workflow-crud.mjs` 在删除确认
落笔前装出站守卫，按已签 adapter 精确核 `method`/`path`/唯一 `idLocation` 并逐字比对当轮 `platformId`；
不符即 `route.abort`、`blockers` 硬阻断、不产成功件。**形状不符的后果是零发送 + 干净中止，不是误删**。
中止后按 `SIGNING-SESSION.md` 第九节改草案重签。

## 七、Tier2 清单漂移账（对现役已签 `cases/tier2-suite.manifest.json`）

逐件按磁盘真实字节复核：

| 成员 | 逐件结论 |
|---|---|
| `tc_agent_id_readback_real_uat_v1` | 五件全部与签署值一致 |
| `tc_chiefcomplaint_smoke` | `events.json` **不在场**；`profile.json` 漂移（2026-08-03 补 `agents` 段）；`expected.frozen.json`、`testcase.json` 一致 |
| `tc_catalog_wf_crud` | `profile.json`、`testcase.json` 漂移（2026-08-03 重表达）；`events.json`、`expected.frozen.json`、`entity-locks.frozen.json` 暂一致（fresh compile 后必变） |
| `tc_wf_publish_states` | 同上 |
| `tc_wf_history_version` | 同上 |

结论：现役已签清单**当前就已经过不了采集层**（chief 件缺席 + 多件哈希失配），这与 PRD `s5` 记的
「`p9-tier2-selftest` 因 Chief artifact 缺席而红」是同一件事，不是本轮新引入。

## 八、本轮落盘清单

| 文件 | 性质 |
|---|---|
| `cases/tier2-suite.manifest.v3.draft.json` | v3 接线草案（新件，`draft: true`，八类 `PENDING_` 占位；**未覆盖已签件**） |
| `cases/tc_chiefcomplaint_smoke/execute-authority.draft.json` | chief 预执行权威草案（生产 CLI 由现役真字节产，未签） |
| `docs/plans/p9-created-workflow-cleanup-continuity-v3/SIGNING-SESSION.md` | 签署会话总跑单 |
| `docs/plans/p9-created-workflow-cleanup-continuity-v3/CHIEF-EVENTS-MISSING.md` | chief `events.json` 缺失考古与再生路径 |
| 本文件 | 备料证据 |

`cases/tier2-suite.manifest.v3.draft.json` 的两轮校验器实测：

- 草案原样 → `ok=false`，问题清单恰好是「`draft` 记号 + 未人签 + 八类待产件占位」，零结构问题；
- 演练态（占位换成合法 `sha256` 形状、摘 `draft` 记号、补签署三格）→ `ok=true`。

即：清单结构已完备，只差**字节**与**人签**。
