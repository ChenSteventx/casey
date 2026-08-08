# plan · replay-identity-channel-kind

承 GRILL 两裁（①锁行 atom 反查注册表推导 kind、③控制器覆盖步豁免），修
`bin/replay.mjs` v2 身份锁闭环的 agent 通道硬编码。裁判零 LLM、全部新门
fail-closed、加法门控不碰既有拒因语义。

## 1. 改动面（一纯守卫 + bin 两块接线）

### 1a. `lib/entity-observation-registry.mjs`：新纯守卫 `deriveFrozenLockChannelKind`

入参 `(rows, registry = ENTITY_OBSERVATION_REGISTRY)`，零 IO：

- rows 非数组或空 → `{ ok:false, rejectCode:'IDENTITY_LOCK_ROWS_EMPTY' }`；
- 任一行 atom 非非空 string 或不在注册表 → `IDENTITY_LOCK_ATOM_UNREGISTERED`；
- 行经 `boundKind` 推导出的 kind 集大小 ≠ 1 → `IDENTITY_LOCK_KIND_MIXED`
  （镜像 C2「多 kind 不得静默择一」单通道约束）；
- 否则 `{ ok:true, kind }`。

### 1b. `bin/replay.mjs:141-153` 通道剖面解析块 → 闭集遍历

镜像 `bin/compile.mjs:230-245`：按 `ENTITY_KIND_COMPILE_CHANNELS` 逐 kind 取
`profile[profileKey]`，声明即施形状律（段非对象、或 `listApi` 在场但
`parseAgentIdentityProfile` 不过 → 浏览器前 exit 65；未声明零行为差），产
`identityChannelsByKind` / `identityDigestsByKind` 两映射。
`identityChannelCfg`/`identityProfileDigest` 改为初值 null，选定推迟到 v2 门内。

**与 compile 的有意分歧（评审必咬点）**：不镜像「声明多 kind 即拒」——replay
的选择由锁驱动（锁行推导出的 kind 点名唯一剖面段），非静默择一；compile 拒是
因为编译期无锁可依。分歧在代码注释与评审提示词双登记。

**新增 fail-closed 边**：`profile.workflows` 声明但畸形，今日 replay 不看、此后
exit 65（与 compile 同律）。经 compile 产出的真件必良构；邻接风险由全仓扫描兜。

### 1c. `bin/replay.mjs:291-309` v2 门重写（门序：先锁级两门、后行级豁免）

```
rows = readFrozenIdentityObservations(frozenLockAuthority)   // 不变
if (rows 非空) {
  ① derived = deriveFrozenLockChannelKind(rows)              // 不 ok → 具名 exit 65
  ② cfg = identityChannelsByKind.get(derived.kind)
     缺 → exit 65：「v2 冻结锁携 <kind> 身份观察但通道剖面未声明
     <profileKey>.listApi（剖面只是适配器、不得降级）」——今日文案的 kind 参数化
  ③ digest 比对：锁顶层 identityProfileDigest vs 该段 live digest
     （读锁文件姿势与错配文案不变）→ 错配 exit 65
  ④ 行级豁免分区：建 stepId→event 首现索引（同 :351 姿势）；行 evidenceStepId
     所指事件 (intentId, atom) ∈ createdWorkflowCovered → 豁免排除；
     evidenceStepId 不在 events → 视为非覆盖（fail-closed 倾向）
  ⑤ 余行处置：kind==='agent' → 建 identityExpectedByStep（今日等价）；
     kind≠agent 且余行非空 → exit 65 具名 IDENTITY_EXPECTATION_CONSUMER_MISSING
     （回放无该 kind 点击前双证消费面——诚实边界，绝不带不可兑现期望启动浏览器）；
     余行为空 → identityExpectedByStep 保持 null、不建账本
  ⑥ identityChannelCfg/identityProfileDigest ← 选定 kind 的 cfg/digest
}
```

- `:410` 账本与 `:388` v3 铸造指纹沿用选定值，字节语义不变（两处均被
  `identityExpectedByStep` 非空 gate 住，选定必已发生）。
- **不动 `:344` v3 判据**（非目标）：v3 锁 + 控制器全覆盖组合此后会
  `DESTRUCTIVE_CONTINUITY_IDENTITY_CHANNEL_UNVERIFIED` fail-closed——方向安全、
  真到达时（p9-…-v3 s5 深消费）另立契约裁。写进 learn 与评审提示词。

## 2. 验收金牌（红先行，全部 spawn 真 `bin/replay.mjs`、零 SUT、哨兵纪律）

新金牌 `tests/_golden/replay-identity-channel-kind.zero-sut.golden.mjs`，夹具
自哈希自洽（C3 failclosed-replay 同款：手造 v2 锁 + `calculateIdentityAdmission-
Signature` + 临时 prd 注册 checksum；digest 对齐直接 import
`parseAgentIdentityProfile` 现算，不手抄规范化）。断言=退出码 + 具名 reason +
哨兵在场性；判绿只信退出码。

| # | 场景 | 现行（红证） | 改后（钉面） |
|---|------|--------------|--------------|
| W1 | workflow 锁行非覆盖（无控制器）+ workflows 剖面 | 65 但拒因是 agents.listApi 硬编码 | 65 + `IDENTITY_EXPECTATION_CONSUMER_MISSING` + 哨兵缺席 |
| W2 | workflow 锁 + 剖面无 workflows 段 | 65 + agents 文案（点错剖面键） | 65 + 点名 workflows.listApi |
| W3 | workflow 锁 digest 与 workflows 段错配（且行被控制器覆盖，孤立数字段门） | 65 + agents 文案 | 65 + 指纹错配文案 |
| W4 | 锁行 atom 注册表外 | 65 + agents 文案 | 65 + `IDENTITY_LOCK_ATOM_UNREGISTERED` |
| W5 | agent 行 + workflow 行混装 | 65 + agents 文案 | 65 + `IDENTITY_LOCK_KIND_MIXED` |
| W6 | workflow 锁行被 v3 权威覆盖（真 authority/grant/provenance 全参）+ workflows 剖面 | 65（通道门抢跑） | 66 + 哨兵在场（豁免全排除、锁级两门过、不建账本） |

- W6 夹具走导出 mint 链（`prepareCreatedWorkflowOwnershipDraft` →
  `authorCreatedWorkflowOwnershipDraft` → `freezeCreatedWorkflowOwnershipAuthority`、
  `authorCreatedWorkflowReplayGrantDraft` → `freezeCreatedWorkflowReplayGrant`、
  `issueCreatedWorkflowCompileProvenance`），签名皆内容哈希——ADR-0010 威胁边界内
  合法构造（C3 金牌先例注释同款）。
- agent 零行为差不另开正控：C3 金牌 D2（agent 锁抵哨兵）与 agent-id-readback
  家族既有钉面承担，列入邻接复跑。

## 3. 突变闭环（目标突变必红、现行必绿、还原 sha256 逐字节同）

- M-a：kind 推导拗回硬编码 `'agent'` → W1/W2/W6 红；
- M-b：⑤ 非覆盖 kind≠agent 行放行（fail-open）→ W1 红；
- M-c：③ 对 workflow kind 跳过 digest 比对 → W3 红。

## 4. 邻接复跑清单（护栏 #19）+ 全仓

`agent-id-readback` 家族、`entity-destructive-continuity-guard` 两件、
`p9-created-workflow-continuity-v3` 家族、`p9-replay-authority-split` 两件、
`workflow-delete-spec` preflight、`entity-workflow-source-readback` 三件；
然后全仓金牌单侧串行扫描（判绿只信退出码、124 单跑复核）。

## 5. 非目标（承 GRILL §5）

不建 workflow 点击前双证消费面；不动 compile/sign 侧；不改锁件模式；不碰
`:344` v3 判据与破坏性准入门；不动 delete-spec 前置闸。

## 6. 评审必咬点预登记

① 1b 与 compile 的多 kind 声明分歧论证；② `:344` 不动的 fail-closed 后果披露；
③ evidenceStepId 不在 events 归非覆盖的 fail-closed 倾向；④ W3 是否真孤立了
数字段门（夹具须证控制器覆盖在场、消费面门不抢跑）；⑤ 新增 workflows 段形状律
的邻接面。
