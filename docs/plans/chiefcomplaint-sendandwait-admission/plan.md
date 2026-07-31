# chiefcomplaint-sendandwait-admission：把甲案推到「只差人签」

契约 lane=light（入口分流理由见 `loop/active-contract.json` 的 `laneReason`）。
裁定来源见同目录 `GRILL.md`。**本契约不自签任何字节**：一切人签面挂 `PENDING_STEVEN`。

## 1 目标

Steven 在决策岔口选甲案（`chat.sendAndWait` 登记为可锁：`none` / `['subject']` / `persistent`）。
把这条裁定从「一句话」推到「只差他人签」：设计文档改到甲案、生产镜像登记该原子、
用例 `tc_chiefcomplaint_smoke` 的 flow 扩实体绑定、真机重编译出草稿锁与确认件，停在人签之前。

## 2 交付物

1. `docs/plans/admission-policy-facets/plan.md` 第 49 行由乙案改甲案，改动理由与裁定原话入档；
   第 67 行的 `PENDING_STEVEN` 保持待签，签的内容如实反映甲案。
2. `lib/entity-semantic-lock-preflight.mjs` 的 `ATOM_ADMISSION_FACETS` 登记 `chat.sendAndWait`；
   另四枚原子按 `GRILL.md` 的逐条判据**不登记**。
3. 人签冻结权威源 `tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json`
   加第 10 行（镜像≡权威是既有金牌硬断言，只改镜像会让权威源与实际放行规则分裂），
   `loop/prd-teachin-admission-side-effect-policy.json` 追一条 `checksumAmendments`，`signedBy: PENDING_STEVEN`。
4. `cases/tc_chiefcomplaint_smoke/flow-tc_chiefcomplaint_smoke.json` 逐步补 `sourceIntentId` + `entityBindings`。
5. `loop/prd-tc_chiefcomplaint_smoke.json`（新建，`testChecksums` 必须为空——`bin/sign.mjs:214-217`）。
6. 真机 `compile --execute` 产物 + `entity-bindings.draft.json` + `entity-confirmations.json`（预演冻结过闸）。
7. 签完之后的可执行清单（含 `cases/tier2-suite.manifest.json` 本员 artifacts 哈希同步与清单重签）。

## 3 验收

判绿只信退出码，不 grep 失败标记串。

| 验收点 | 判据 | 手段 |
|---|---|---|
| A1 甲案落进事实源 | `admissionPolicyForAtom('chat.sendAndWait')` 返 `entityChange:'none'` / `identityBindingRoles:['subject']` / `nonEntityEffect:'persistent'`，派生 `admissionClass:'entity-lock'`、`effect:'mutation'`、`requiredRoles:['subject']` | 纯函数探针 |
| A2 主策略通道零行为位移 | 登记前后 `policyForAtom('chat.sendAndWait')` 的 `{effect, requiredRoles}` 逐字节相同 | 改前改后对比 |
| A3 遗留 event 投影位移被如实枚举 | 登记后 `legacyEventProjectionPolicyForAtom` 由 `requiredRoles:null` 收紧到 `['subject']`，方向为收紧 | 纯函数探针 + 请签包记账 |
| A4 镜像≡权威不分裂 | `admission-policy-facets` 金牌 `authority` 段登记前后退出码记账；权威源同步加行后该段复绿 | 逐段跑金牌记退出码 |
| A5 flow 绑定闭合 | `requiredFlowEntityBindings(flow)` 不再返 `ENTITY_BINDING_REQUIRED_ROLES_INVALID`，逐步一条 subject | 纯函数探针 |
| A6 连续性闸不被误触 | 本例五枚原子 `requiresTargetContinuityRef` 全 `false`，空 ref 表下破坏性闸返 `{"ok":true}` | 纯函数探针 |
| A7 真机编译过全部浏览器前闸 | `compile --execute` 走到 `CASEY_LAUNCH_SENTINEL`（`exit 66`）证闸早于浏览器启动，随后真跑出四件套 | 哨兵 + 真机 |
| A8 草稿锁可冻结 | `freezeEntityBindingsDraft` 预演返 `ok:true` / `replayReady:true` / `schemaVersion:1` | 预演，不请人签就不落人签件 |
| A9 邻接零陈旧绿 | 消费方金牌逐个复跑记退出码，改前改后对比；HEAD 既有红如实挂账不修 | 护栏 #19 |
| A10 凭据零泄漏 | 全部输出/日志/文档零凭据值、零真目标地址，`--sut` 只喂回环基址 | 逐件复核 |

## 4 边界（本契约不做）

- 不代签、不写 `signedBy: "Steven"`；不写 `passes`（只有 `gate.mjs` 有权）。
- 不登记 `GRILL.md` 表里判「不登记」的四枚原子。
- 不开「有非实体持久副作用」的独立授权档。
- 不碰 `../loop-kit`、不碰 `lib/report.mjs` 与 `p7-report` 相关夹具（另有会话在跑）。
- 不碰破坏性三例的连续性 ref 接线（`resign-runbooks.md` 第三节的路 B-1/B-2，另行裁）。
