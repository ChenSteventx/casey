# 「允许清理实跑」阻断复核 —— 逐层实证

基线提交：`019d24f`（`dev`）。全部证据为本工作树实跑，`--sut` 恒指死回环端口 `http://127.0.0.1:1`，
零浏览器、零真机、零 `--sut` 真站地址。未改任何 `lib/`、`bin/` 生产件。

## 结论先说

此前「清理实跑卡在等人到机器前收集 `route:human` 身份」的判断**不成立**。人到场不会把 ref 填进表里——
全仓没有任何代码往 `destructiveContinuityByStep` 写值。破坏链的阻断是**结构性的**，与人在不在机器前无关。

复核确认原五层全部属实，另**新增三条**原描述未覆盖的阻断/风险，其中一条（第 ⑥ 层）是安全相关的硬阻断。

## 逐层证据

### ① 回放侧逐破坏步 ref 表零写入 —— 属实

- `bin/replay.mjs:203` 建空 `Map`，`bin/replay.mjs:206` 立即拿它做准入。
- 全仓 `destructiveContinuityByStep` / `resolvedRefByStep` 出现处：`bin/replay.mjs:200,201,203,206,269`、
  `lib/entity-destructive-continuity.mjs:192,194`、`lib/replay/event-runner.mjs:193,194,334,335`、
  `lib/teachin/prepared-runtime-seam.mjs:186`、金牌三处。**全部是 `new Map()` 或 `.get()`，零 `.set()`。**
- 实测：`tests/_golden/entity-destructive-continuity-guard.failclosed-replay.golden.mjs` → `exit 0`
  （其 D1 断言破坏原子在锁下 exit 65 且浏览器前哨兵缺席）。
- 本轮红验收 R1（现役 v2 形状 + `agent.delete`）→ `exit 65`，`DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`，
  哨兵缺席。**人到场与否不改变这个退出码。**

### ② 冻结锁投影字段不足以铸 ref —— 属实，且比原描述更硬

`mintTargetContinuityObservation`（`lib/entity-destructive-continuity.mjs:35-39`）索要 11 个非空字符串
（`platformId`/`name`/`code`/`role`/`atom`/`evidenceStepId`/`sourceIntentId`/`candidateId`/
`profileFingerprint`/`scope`/`requestCorrelationId`）+ 整数 `stepOrder`。

v2 冻结锁的观察行只有 8 个字段（`lib/entity-semantic-lock-preflight.mjs:370-372` 的 allow-list）：
`name`/`code`/`platformId`/`sourceIntentId`/`candidateId`/`role`/`atom`/`evidenceStepId`。
缺的正是 `profileFingerprint`、`scope`、`requestCorrelationId`、`stepOrder` 四个。

**与原描述不符之处（更严重）**：这四个字段**不能加法式补上**。`closedRecord`
（`lib/entity-semantic-lock-preflight.mjs:221-234`）的 `required` 默认等于 `allowed`，第 233 行对
**任何**不在 allow-list 里的键直接返 `null`。所以往冻结锁塞新字段 = 锁整体判非法，不是「多带点信息」。

实测（红验收 R2/R3/R4/R5，锁带 `destructiveContinuity` 段）→ `exit 65`，
`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`。即：格式扩容是**版本位 + 校验器**的改动，绕不过去。

好消息一条：`calculateIdentityAdmissionSignature`（同文件 `313-321`）对除 `signature` 外的**全部键**取哈希，
故新增段天然被签名覆盖，**签名算法不用动**。

### ③ 实体锁缺显式撤销/归档实现 —— 属实

`bin/sign.mjs:175`：

```
if (existsSync(entityLocksOut) && !recoveryJournal) die(65, 'entity-locks.frozen.json 已存在；身份锁重签须另走显式撤销/归档流程');
```

「另走显式撤销/归档流程」在全仓只有这句文案，无实现、无子命令、无归档目录约定。

### ④ 三例 profile 缺工作流身份通道 —— 机制属实，三例内容**本轮无法核实**

机制侧证据充分：`bin/compile.mjs:233-247` 校验 `listApi` 六字段 + `fields.{id,code,name}`，
`bin/compile.mjs:245-247` 另要 `itemContainer` + `cardFields.{name,code}`，任一缺失 exit 65；
`bin/compile.mjs:257-259` 同时声明多个身份观察通道 kind 直接拒。
`bin/compile.mjs:290` 起 `certifiableDestructiveKinds` 只在 `wellFormedListChannel(profile.workflows)` 为真时
才加 `workflow`。

**但**：本工作树没有 `cases/`（不入库），三例真 `profile.json` 不可见。全仓只有两份
`tests/_golden/fixtures/admission-audience/{compile,wiring}/profile.json`。
**「三例 profile 无 `workflows` 段」这一条我复核不了，只能挂账**——须在有 `cases/` 的树上或真机侧核。

### ⑤ 现行 fail-closed 行为被人签金牌冻结 —— 属实

`tests/_golden/entity-destructive-continuity-guard.failclosed-replay.golden.mjs:146` D1 断言
「破坏原子 + 锁在力 → exit 65 + 具名 reason + 哨兵缺席」。实测该金牌 `exit 0`（在绿）。
改判据（让合法 ref 放行）会翻动这条断言 = ADR-0004 重签事件。

同族还有 `:157` 的 D2 正控（无破坏原子 → exit 66 + 哨兵在场），它证守卫不是「恒拒」死闸——
本轮红验收 R5 就是把这条正控延伸到「有破坏原子但 ref 合法」。

---

## 新增发现（原五层未覆盖）

### ⑥ 【安全相关】`kind` 在冻结时被丢掉，跨 kind 硬闸在重建路径上结构性不可用

codex round-5 逮的 Critical 是「跨 kind 绕过」：同名的 `agent` 观察能给 `workflow.deleteByName` 铸 ref →
删错目标。收口手段是 `selectObservationForDestructiveTarget` 的 `boundKind` 硬闸
（`lib/entity-destructive-continuity.mjs`，比对 `observation.kind === boundKind`）。

编译侧的观察行**带** `kind`：`lib/compile-atoms-flow.mjs:110` 明确写 `kind: archivedKind`。
但冻结锁的观察行 allow-list（`lib/entity-semantic-lock-preflight.mjs:370-372`）**没有 `kind`**
（`grep` 该文件 observation/allowed/row 相关行，`kind` 零命中）。

后果：**任何「从已签冻结锁重建 ref」的实现，都拿不到 `kind`，跨 kind 硬闸调不起来。**
若实现时不补 `kind`，等于把 round-5 那个 Critical 在重建路径上重新打开。
本轮红验收 R3 就是钉这条（今日红）。

### ⑦ `profile.mutationUrlPattern` 是生产必需字段，却无任何形状门校验

`lib/replay/event-runner.mjs:199` 传 `urlPattern: profile.mutationUrlPattern` 且 `requirePattern: true`；
`lib/entity-destructive-continuity-wiring.mjs:55-58` 在 `requirePattern===true` 且 pattern 缺失时
返 `installed:false, reason:'MUTATION_URL_PATTERN_REQUIRED'`；
`lib/replay/event-runner.mjs:215-220` 据此置 `guardInstallFailed`，
`lib/replay/event-runner.mjs:232-236` 把该步判成 `resolution:'action_failed'` 且**不派发动作**。

方向是安全的（fail-closed，破坏动作不执行）。问题是：`bin/compile.mjs` 的剖面形状门
（`225-247`）**完全没校验 `mutationUrlPattern`**，`grep` 全仓也只有上述消费点与金牌断言。
即：ref 全部弄对之后，真机仍会因为剖面少一个从未被校验过的字段而整步 `action_failed`。
这是路线 B-1 的**第五个 profile 字段**，须一并列入待补清单，别等真机现场才发现。

### ⑧ 不带 `--entity-locks` 不构成绕过（已探针证伪，好消息）

`--entity-locks` 是可选旗标（`bin/replay.mjs:3` 的 CLI 契约、`147` 的 `entityLocksSupplied`），
不给则 `frozenLockAuthority` 为 `null`，`bin/replay.mjs:205` 的破坏性准入门整段被跳过。
这看着像一条绕过路径，**实测不是**：

探针（`agent.searchOpen` + `agent.delete`，不带 `--entity-locks`）→ `exit 65`，
`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`，哨兵 `false`。
上游 `checkCompileIdentityAdmission` 先拦（破坏原子的 `identityBindingRoles` 非空，无锁即无绑定）。
这一侧是闭的，无需额外动作。

---

## 复核方法与可复现命令

```
node tests/_golden/entity-destructive-continuity-guard.failclosed-replay.golden.mjs   # exit 0（现役冻结面在绿）
node tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs       # exit 1（红先行，R1 绿 / R2-R5 红）
node bin/casey.mjs selftest --tier1                                                    # exit 0（基线健康）
```

环境前置：`LOOP_KIT_PKG=/mnt/d/ctx/heren/loop-kit`，`node_modules` 软链到主工作树。
两者缺一会产生与本主题无关的纯解析假红。
