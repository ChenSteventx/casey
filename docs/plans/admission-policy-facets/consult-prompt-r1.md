# 咨询：准入策略「三面拆分」的建模取舍（定稿前一次）

你是 Casey 仓（当前工作树）的异构评审顾问，只读。先自己读代码建立事实，不要信我的转述：

- `lib/entity-semantic-lock-preflight.mjs`（策略表在 :43-53；`policyForAtom` :454、`legacyEventProjectionPolicyForAtom` :460、`containsMutation` :465、`inspectOperationBindings` :483、`requiredEntityBindings` :518、`expectedRoles` :626、`checkReplayEntityAdmission` :826、`checkCompileIdentityAdmission` :895）
- `tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json`（人签冻结权威源，被 `loop/prd-teachin-admission-side-effect-policy.json` 的 testChecksums 冻结）
- `tests/_golden/teachin-admission-side-effect-policy.zero-sut.golden.mjs`（同样被冻结的消费金牌）
- `lib/entity-destructive-continuity.mjs` 的 `requiresTargetContinuityRef`（另一模块里已经独立表达的「目标身份连续性」闭集）

## 我要解决的问题

`SIDE_EFFECT_POLICY` 只登记 9 个原子，并且把三件本质不同的事压成了一个 `effect` 字段：

1. 这个原子改不改业务实体（结构性变更）；
2. 它要不要目标身份连续性（破坏性/定向操作必须确认「我删的正是我建的那个」）；
3. 它有没有外部副作用（真向被测智能体发一条消息、在对方会话记录里留痕）。

未登记原子默认 `mutation + subject`。后果：`chat.sendAndWait`（真外部副作用、不改业务实体、无身份可钉）与 `agent.searchOpen`（身份敏感读取、不改业务实体、无外部副作用）都落进同一档，照这张表签绑定会签出语义上虚构的绑定。

## 硬约束

- 现役用例的准入判定、绑定要求、`effect` 语义改后必须逐字节等价（这是重构表达，不是改判定）；
- 未登记原子的默认必须同等严格或更严；
- 冻结件只读，改走 `checksumAmendment` + `signedBy: PENDING_STEVEN`，我不签；
- 我不碰用例件、不签绑定、不跑真机。

## 我的建模方案（请证伪）

策略表每个原子改成三个正交面，`effect`/`requiredRoles` 变成纯函数派生的兼容投影：

```
facets = {
  entityChange:  'none' | 'entity' | 'relation',   // 结构性变更
  identityRoles: [] | ['subject'] | ['source','target'],  // 须钉住身份的角色闭集
  externalEffect:'none' | 'outbound' | 'unknown',  // 外部副作用
  allowedActions: ...（仅只读原子有，保持原样）
}

readAdmissible(f) = f.entityChange === 'none' && f.identityRoles.length === 0 && f.externalEffect === 'none'
effect(f)         = f.entityChange === 'relation' ? 'relation' : (readAdmissible(f) ? 'read' : 'mutation')
requiredRoles(f)  = f.identityRoles
未登记默认 facets = { entityChange:'entity', identityRoles:['subject'], externalEffect:'unknown' } → 派生回 mutation + ['subject']
```

对 9 个已登记原子逐条派生，得到与现表逐字节相同的 `{effect, requiredRoles(, allowedActions)}`。

两个目标原子的如实描述：
- `chat.sendAndWait` = `{none, [], outbound}` → 派生 `effect:'mutation'`, `requiredRoles:[]`。注意这个组合在现有绑定检查里是**不可满足**的（`inspectOperationBindings` 对非 read 要求 bindings 非空且角色集恰等于 requiredRoles，空集永远不成立）→ fail-closed。
- `agent.searchOpen` = `{none, ['subject'], none}` → 派生 `effect:'mutation'`, `requiredRoles:['subject']`，与今天「未登记默认」逐字节相同。

## 请回答（要判断，不要复述）

1. 三面切分对不对？「目标身份连续性」在 `requiresTargetContinuityRef` 里已有独立闭集，我把它在策略表里表达成 `identityRoles`（须钉身份的角色）而不是再加一个布尔，是不是把两件事又混了一次？如果该加第四面/该改名，给出具体形状。
2. `readAdmissible` 要求三面全清白（尤其外部副作用非 none 就绝不走只读通道）——这条对 `checkReplayEntityAdmission:858` 的 `allRead && !authorityWasSupplied` 短路是不是充分的 fail-open 封堵？还有别的路能让一个有外部副作用的原子拿到零绑定放行吗？
3. 我倾向**不**把 `chat.sendAndWait` / `agent.searchOpen` 登记进现表（登记是人签的策略判断），只交付表达能力 + 可登记的 schema。这个边界划得对吗？如果 `chat.sendAndWait` 登记后必然 fail-closed（现有通道没有「有外部副作用但无身份可钉」的合法档），我应该现在就设计这个新档，还是把它作为人签待决挂账？给出你的取舍理由。
4. 人签冻结件 `entity-admission-policy.frozen.json` 该不该一并 amend 成带三面的 schema（内容语义不变、只增字段），还是只改生产镜像、让权威源继续只有 `effect`？两种做法各自的风险。
5. 有没有我漏掉的耦合会因为这次改写破掉现役行为？特别看：`allowedActions` 只在 read 分支被读、`legacyEventProjectionPolicyForAtom` 的 `requiredRoles: null`（恰一角色）默认、`expectedRoles` 的三分支、`containsMutation` 的 `effect !== 'read'` 口径。

只报 Critical / High / Medium，每条给出你依据的文件与行号。
