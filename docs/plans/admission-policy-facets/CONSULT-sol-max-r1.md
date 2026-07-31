# admission-policy-facets —— gpt-5.6-sol max 定稿前设计咨询结论（2026-07-31）

> 完整转录 864 KB（含 trace），只留结论正文。三条 High 全采纳，其中一条促成实测证伪自己的探针。

## Critical

无。两件冻结文件的实际 SHA-256 与 PRD 登记值一致。

## High

1. `identityRoles` 不能代表目标身份连续性；应按四面建模。

`requiredRoles` 表达的是“冻结实体绑定必须覆盖哪些角色”；目标连续性表达的是“本破坏步的 `platformId` 是否与实际出站目标一致”。代码也明确声明连续性不是形式收据消费：[entity-destructive-continuity.mjs:3](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-destructive-continuity.mjs:3)。

反例已经存在：

- `workflow.create` 要 `subject` 绑定，但明确不要求连续性：[entity-semantic-lock-preflight.mjs:46](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:46)、[entity-destructive-continuity.mjs:20](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-destructive-continuity.mjs:20)。
- `agent.searchOpen` 要 `subject` 身份观察，但不在连续性闭集：[entity-observation-registry.mjs:35](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-observation-registry.mjs:35)、[entity-destructive-continuity.mjs:27](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-destructive-continuity.mjs:27)。

建议形状：

```js
facets: {
  entityChange: 'none' | 'entity' | 'relation',
  identityBindingRoles: [] | ['subject'] | ['source', 'target'],
  nonEntityEffect: 'none' | 'persistent' | 'unknown',
  allowedActions?: [...]
}

targetContinuity:
  | { mode: 'none' }
  | {
      mode: 'same-platform-id',
      granularity: 'per-step',
      anchor: 'platformId',
      bindingRole?: 'subject' | 'source' | 'target'
    }
```

第四面不要在两张表重复登记；当前应由 `requiresTargetContinuityRef` 作为唯一来源拼入聚合策略。`outbound` 也建议改成 `persistent`：普通只读 HTTP 同样是 outbound，而你真正要表达的是外部持久留痕。

2. `readAdmissible` 足以封住无 authority 的短路，但 `mutation + []` 并非全链不可满足。

在 `checkReplayEntityAdmission` 内，无 authority 的唯一成功出口确实是 `allRead` 分支；外部效果派生成非 read 后会落入 authority 检查，因此这部分判断成立：[entity-semantic-lock-preflight.mjs:847](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:847)、[entity-semantic-lock-preflight.mjs:858](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:858)。

但你对 `chat.sendAndWait`“空角色永远不可满足”的判断不成立：

- `inspectOperationBindings` 确实拒绝非 read 空绑定：[entity-semantic-lock-preflight.mjs:490](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:490)。
- 可是 frozen artifact 的生产校验器允许 `bindings: []`：[entity-semantic-lock-preflight.mjs:172](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:172)、[entity-semantic-lock-preflight.mjs:277](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:277)。
- `expectedRoles` 遇 `requiredRoles: []` 时，空集合会精确匹配成功：[entity-semantic-lock-preflight.mjs:626](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:626)。
- 最终可由已铸 authority 走到成功出口：[entity-semantic-lock-preflight.mjs:881](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:881)。

这还与冻结 JSON Schema 的 `minItems:1` 不一致：[entity-locks-frozen.schema.json:1](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/tests/_golden/fixtures/teachin-entity-binding-sidecar-successor/entity-locks-frozen.schema.json:1)。

现在应只设计一个统一的 `deny/unsupported` 档：

```js
admissionClass(f) =
  unboundReadAdmissible(f) ? 'unbound-read'
  : f.identityBindingRoles.length > 0 ? 'entity-lock'
  : 'unsupported'
```

不要现在开放合法的“外部副作用 authority”档；那需要另行人签其授权对象、事件字节绑定和执行次数语义。

3. 不登记 `chat.sendAndWait` / `agent.searchOpen` 的边界是对的。

这不是单纯补描述：

- `chat.sendAndWait` 当前默认是 `mutation + subject`；登记成 `mutation + []` 会立刻改变绑定推导结果：[entity-semantic-lock-preflight.mjs:454](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:454)。
- 它同一原子产生 `fill/press/press/click` 四事件，只有最终点击真正发送；合法新档还涉及作用粒度判断：[compile-atoms-agent.mjs:297](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/compile-atoms-agent.mjs:297)。
- `agent.searchOpen` 虽投影仍为 `subject`，登记后会改变遗留 event 投影的未知原子兼容行为。

因此本轮只交付表达能力、兼容投影与 `unsupported` 状态；两项登记和外部副作用合法授权通道均挂人签待决。

4. 如果 facets 会参与准入判断，冻结权威件必须一并 amend。

只改生产镜像会让未签的 `nonEntityEffect` 决定是否走零绑定短路。当前冻结件甚至不含生产侧实际使用的 `allowedActions`，也没有完整未知默认角色：[entity-admission-policy.frozen.json:1](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json:1)、[entity-semantic-lock-preflight.mjs:43](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:43)。

建议：

- 升 `schemaVersion:2`。
- 保留 `effect`、`requiredRoles` 作为派生兼容字段，并验证它们与 facets 一致。
- 增加完整 `unknownFacets`、read 行的 `allowedActions`。
- 同时 amend 冻结 JSON 与消费金牌，走 `checksumAmendments`，`signedBy: PENDING_STEVEN`；当前双 checksum 锚在 [prd:5](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/loop/prd-teachin-admission-side-effect-policy.json:5)。

风险取舍：amend 的风险是版本迁移、棘轮重钉和等待人签；只改生产镜像的风险是权威源与实际放行规则永久分裂。后者更高。

## Medium

1. 遗留 event 投影不能复用新的精确 `identityBindingRoles` 默认。

未登记原子在主策略是精确 `subject`，但遗留 event 投影的 `requiredRoles:null` 表示“`subject/source/target` 任一且恰一个”：[entity-semantic-lock-preflight.mjs:460](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:460)、[entity-semantic-lock-preflight.mjs:507](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:507)。

所以不能只有一个 `requiredRoles(f)=identityBindingRoles` 投影；须保留单独的 legacy adapter，或使用：

```js
{ mode: 'exact', roles: [...] }
{ mode: 'exactly-one-of', roles: ['subject', 'source', 'target'] }
```

否则未知 event 的 `source/target` 会由合法变 invalid。

2. `containsMutation` 必须继续表示“不能走无权只读”，不能改成结构性实体变更判断。

它目前按 `effect !== 'read'` 工作，并同时驱动编译准入及是否生成实体绑定草稿：[entity-semantic-lock-preflight.mjs:465](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:465)、[compile.mjs:164](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/bin/compile.mjs:164)、[compile.mjs:427](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/bin/compile.mjs:427)。

实现上应让它等价于 `!unboundReadAdmissible(f)`，不要改成 `entityChange !== 'none'`；后者会把 `chat.sendAndWait` 放进只读侧。

3. `allowedActions` 与固定 read envelope 仍是独立联锁，不能被 facets 吞掉。

`allowedActions` 只在 read 分支生效，之后还要过固定 URL、无 `pre`、事件载荷检查：[entity-semantic-lock-preflight.mjs:63](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:63)、[entity-semantic-lock-preflight.mjs:848](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:848)。

schema 应强制：只有 `unboundReadAdmissible` 行可携且必须携非空 `allowedActions`；非 read 行携带它应直接判 schema invalid，而不是静默忽略。
tokens used
226,278
## Critical

无。两件冻结文件的实际 SHA-256 与 PRD 登记值一致。

## High

1. `identityRoles` 不能代表目标身份连续性；应按四面建模。

`requiredRoles` 表达的是“冻结实体绑定必须覆盖哪些角色”；目标连续性表达的是“本破坏步的 `platformId` 是否与实际出站目标一致”。代码也明确声明连续性不是形式收据消费：[entity-destructive-continuity.mjs:3](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-destructive-continuity.mjs:3)。

反例已经存在：

- `workflow.create` 要 `subject` 绑定，但明确不要求连续性：[entity-semantic-lock-preflight.mjs:46](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:46)、[entity-destructive-continuity.mjs:20](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-destructive-continuity.mjs:20)。
- `agent.searchOpen` 要 `subject` 身份观察，但不在连续性闭集：[entity-observation-registry.mjs:35](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-observation-registry.mjs:35)、[entity-destructive-continuity.mjs:27](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-destructive-continuity.mjs:27)。

建议形状：

```js
facets: {
  entityChange: 'none' | 'entity' | 'relation',
  identityBindingRoles: [] | ['subject'] | ['source', 'target'],
  nonEntityEffect: 'none' | 'persistent' | 'unknown',
  allowedActions?: [...]
}

targetContinuity:
  | { mode: 'none' }
  | {
      mode: 'same-platform-id',
      granularity: 'per-step',
      anchor: 'platformId',
      bindingRole?: 'subject' | 'source' | 'target'
    }
```

第四面不要在两张表重复登记；当前应由 `requiresTargetContinuityRef` 作为唯一来源拼入聚合策略。`outbound` 也建议改成 `persistent`：普通只读 HTTP 同样是 outbound，而你真正要表达的是外部持久留痕。

2. `readAdmissible` 足以封住无 authority 的短路，但 `mutation + []` 并非全链不可满足。

在 `checkReplayEntityAdmission` 内，无 authority 的唯一成功出口确实是 `allRead` 分支；外部效果派生成非 read 后会落入 authority 检查，因此这部分判断成立：[entity-semantic-lock-preflight.mjs:847](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:847)、[entity-semantic-lock-preflight.mjs:858](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:858)。

但你对 `chat.sendAndWait`“空角色永远不可满足”的判断不成立：

- `inspectOperationBindings` 确实拒绝非 read 空绑定：[entity-semantic-lock-preflight.mjs:490](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:490)。
- 可是 frozen artifact 的生产校验器允许 `bindings: []`：[entity-semantic-lock-preflight.mjs:172](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:172)、[entity-semantic-lock-preflight.mjs:277](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:277)。
- `expectedRoles` 遇 `requiredRoles: []` 时，空集合会精确匹配成功：[entity-semantic-lock-preflight.mjs:626](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:626)。
- 最终可由已铸 authority 走到成功出口：[entity-semantic-lock-preflight.mjs:881](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:881)。

这还与冻结 JSON Schema 的 `minItems:1` 不一致：[entity-locks-frozen.schema.json:1](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/tests/_golden/fixtures/teachin-entity-binding-sidecar-successor/entity-locks-frozen.schema.json:1)。

现在应只设计一个统一的 `deny/unsupported` 档：

```js
admissionClass(f) =
  unboundReadAdmissible(f) ? 'unbound-read'
  : f.identityBindingRoles.length > 0 ? 'entity-lock'
  : 'unsupported'
```

不要现在开放合法的“外部副作用 authority”档；那需要另行人签其授权对象、事件字节绑定和执行次数语义。

3. 不登记 `chat.sendAndWait` / `agent.searchOpen` 的边界是对的。

这不是单纯补描述：

- `chat.sendAndWait` 当前默认是 `mutation + subject`；登记成 `mutation + []` 会立刻改变绑定推导结果：[entity-semantic-lock-preflight.mjs:454](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:454)。
- 它同一原子产生 `fill/press/press/click` 四事件，只有最终点击真正发送；合法新档还涉及作用粒度判断：[compile-atoms-agent.mjs:297](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/compile-atoms-agent.mjs:297)。
- `agent.searchOpen` 虽投影仍为 `subject`，登记后会改变遗留 event 投影的未知原子兼容行为。

因此本轮只交付表达能力、兼容投影与 `unsupported` 状态；两项登记和外部副作用合法授权通道均挂人签待决。

4. 如果 facets 会参与准入判断，冻结权威件必须一并 amend。

只改生产镜像会让未签的 `nonEntityEffect` 决定是否走零绑定短路。当前冻结件甚至不含生产侧实际使用的 `allowedActions`，也没有完整未知默认角色：[entity-admission-policy.frozen.json:1](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json:1)、[entity-semantic-lock-preflight.mjs:43](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:43)。

建议：

- 升 `schemaVersion:2`。
- 保留 `effect`、`requiredRoles` 作为派生兼容字段，并验证它们与 facets 一致。
- 增加完整 `unknownFacets`、read 行的 `allowedActions`。
- 同时 amend 冻结 JSON 与消费金牌，走 `checksumAmendments`，`signedBy: PENDING_STEVEN`；当前双 checksum 锚在 [prd:5](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/loop/prd-teachin-admission-side-effect-policy.json:5)。

风险取舍：amend 的风险是版本迁移、棘轮重钉和等待人签；只改生产镜像的风险是权威源与实际放行规则永久分裂。后者更高。

## Medium

1. 遗留 event 投影不能复用新的精确 `identityBindingRoles` 默认。

未登记原子在主策略是精确 `subject`，但遗留 event 投影的 `requiredRoles:null` 表示“`subject/source/target` 任一且恰一个”：[entity-semantic-lock-preflight.mjs:460](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:460)、[entity-semantic-lock-preflight.mjs:507](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:507)。

所以不能只有一个 `requiredRoles(f)=identityBindingRoles` 投影；须保留单独的 legacy adapter，或使用：

```js
{ mode: 'exact', roles: [...] }
{ mode: 'exactly-one-of', roles: ['subject', 'source', 'target'] }
```

否则未知 event 的 `source/target` 会由合法变 invalid。

2. `containsMutation` 必须继续表示“不能走无权只读”，不能改成结构性实体变更判断。

它目前按 `effect !== 'read'` 工作，并同时驱动编译准入及是否生成实体绑定草稿：[entity-semantic-lock-preflight.mjs:465](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:465)、[compile.mjs:164](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/bin/compile.mjs:164)、[compile.mjs:427](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/bin/compile.mjs:427)。

实现上应让它等价于 `!unboundReadAdmissible(f)`，不要改成 `entityChange !== 'none'`；后者会把 `chat.sendAndWait` 放进只读侧。

3. `allowedActions` 与固定 read envelope 仍是独立联锁，不能被 facets 吞掉。

`allowedActions` 只在 read 分支生效，之后还要过固定 URL、无 `pre`、事件载荷检查：[entity-semantic-lock-preflight.mjs:63](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:63)、[entity-semantic-lock-preflight.mjs:848](/mnt/d/ctx/heren/casey/.claude/worktrees/agent-ac11816e7d5d6d009/lib/entity-semantic-lock-preflight.mjs:848)。

schema 应强制：只有 `unboundReadAdmissible` 行可携且必须携非空 `allowedActions`；非 read 行携带它应直接判 schema invalid，而不是静默忽略。
