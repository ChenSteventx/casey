# 计划：回放侧逐破坏步连续性 ref 重建（旧固定 ID 路径写入侧）

上位契约：`docs/plans/p9-created-workflow-cleanup-continuity-v3/plan.md` §5（replay 面）、§6（出站 guard）。
设计事实源：`docs/plans/destructive-continuity-ref/design-per-step-ref.md`、`design-replay-rebuild.md`。
决策记录：本目录 `GRILL.md`（D1–D8）。

## 1. 要解决什么

`bin/replay.mjs` 建【空】的 `destructiveContinuityByStep` 后立刻拿它做准入，全仓零处 `.set()`。
故只要冻结锁在力且事件里含破坏原子，回放恒 `exit 65`——人到机器前也一样，人不会把 ref 填进去。
缺的是「观察」与「破坏」之间那条**显式的授权边**：没有任何签署过的东西说
「`atstep_3` 看到的那个实体，授权 `atstep_4` 去删」。

本计划落该授权边在**旧固定 ID 路径**上的诊断与写入侧。动态 ID 路径（`--batch-token` 起
`createdWorkflowController` 的那条）本轮零改动。

## 2. 落地面

### 2.1 `lib/entity-semantic-lock-preflight.mjs`

1. `validateFrozenEntityLockArtifact` 认 `schemaVersion === 3`：
   闭合面 = v2 的 + `destructiveContinuity`；观察行闭合面 = v2 的 + `kind`（必填，值域
   `agent` / `workflow`）。v1/v2 分支逐字不动。
2. 新增 `destructiveContinuity` 逐条闭合校验：九字段全必填、八个非空字符串 + `stepOrder` 非负整数。
3. `readFrozenIdentityObservations` 兼收 v3（v1 仍回 `null`，零行为差）。
4. 新增 `readFrozenDestructiveContinuity(frozenLockAuthority)`，与既有观察读取器同族：
   只对已铸 `verify` 域不透明句柄暴露只读投影，非 v3 回 `null`。

### 2.2 `bin/replay.mjs`

唯一写入点：紧接 `const destructiveContinuityByStep = new Map();` 之后、准入门之前，
且在 `chromium.launch` 哨兵之前。不能早于身份通道指纹比对（指纹没核完就铸 ref，等于承认一份与
现行通道剖面不配对的锁），不能晚于准入门（准入门是浏览器前最后一道）。

逐条授权边按 I1–I8 校验，任一不成立即具名硬退出 `exit 65`、不启动浏览器；全通过则由既有铸造
适配器 `mintDestructiveTargetContinuity` 铸 ref 并按破坏步 `stepId` 入表。
既有准入门（I9：漏授权的破坏步在这里被拒）一字不改。

## 3. 验收

验收件 = 冻结红件 `tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs`
（`loop/prd-p9-replay-ref-rebuild.json` 登记 checksum，实现者只读）。
五个场景一律 spawn 真 `bin/replay.mjs`，零浏览器 / 零被测系统 / 零假被测系统，
`--sut` 恒指死回环端口，`CASEY_LAUNCH_SENTINEL` 证「有没有越过浏览器前门」。
判红判绿只信退出码。

| 场景 | 验收点 | 落地前 | 落地后 |
|---|---|---|---|
| R1 ref 缺失 | `exit 65` + `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` + 哨兵缺席 | 绿 | 须仍绿 |
| R2 ref 错配·平台 ID | `exit 65` + `DESTRUCTIVE_CONTINUITY_PLATFORM_ID_MISMATCH` + 哨兵缺席 | 红 | 绿 |
| R3 ref 错配·跨类别 | `exit 65` + `DESTRUCTIVE_CONTINUITY_KIND_MISMATCH` + 哨兵缺席 | 红 | 绿 |
| R4 ref 挂错步 | `exit 65` + 拒因点名未获授权的破坏步 `atstep_4` + 哨兵缺席 | 红 | 绿 |
| R5 ref 合法 | `exit 66` + 哨兵在场 | 红 | 绿 |

红基线实证：`docs/plans/p9-created-workflow-cleanup-continuity-v3/accept/red-proofs/destructive-continuity-ref-rebuild.red.txt`
（`exit 1`，R2–R5 四条红，红因逐条为 `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`——v3 段被闭合面判非法键）。

## 4. 复跑集（护栏 #19）

本红件转绿之外，须逐枚实跑并只信退出码：

- 八枚 `p9-created-workflow-continuity-v3.*.golden.mjs`（动态 ID 路径零漂移，任一红即停机）；
- 九枚 `entity-destructive-continuity-guard.*`；
- `entity-workflow-source-readback` 的 admission / wiring 两枚、`admission-policy-facets`、
  `p2-verdict`、`p0-p2-report-delete`、`p9-tier2-final-batch`、`intent-event-fold`、
  `teachin-semantic-lock-flow-provenance`、`entity-ui-wiring.bindagent-lockchain`；
- `p9-tier2-selftest`（预期仍红，且红因仍恰为 T7 / T9a 两条签署缺席，多一条少一条都算异常停机）；
- `lib/replay/` 邻接消费者金牌（按实际圈定）；
- `prd-drift-scan`、`term-lint --registry`、`selftest --tier1`。

## 5. 停机条件

冻结金牌需要任何修改才能绿；动态 ID 路径行为漂移；`p9-tier2-selftest` 红因增减；
出现计划外文件改动。任一成立立即停、不提交、带证据回报。

## 6. 落地后仍未闭的半边（诚实挂账）

表填满、准入门放行之后，破坏动作才走到 `lib/replay/event-runner.mjs` 的出站拦截。
那一段的正确性——`page.route` 真拦住了出站请求、平台 ID 真被核对、`route.abort` 真在请求发出前
生效——hermetic 证不出，需要真浏览器，仍挂 `route:human`。
故本计划落地后的正确说法是：**浏览器前的授权链闭合了**，出站消费链仍待真机确认。
不得宣称「破坏链已闭」。

另一条落地时会当场绊倒人的：`profile.mutationUrlPattern` 是
`lib/replay/event-runner.mjs` 的必需输入且 `requirePattern: true`，但 `bin/compile.mjs` 的剖面
形状门从不校验它。ref 全对之后，剖面少这个字段会让破坏步整步判 `action_failed`（方向安全但会白跑
一趟真机）。列进真机前的检查单，本轮不扩面。
