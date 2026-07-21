# 异构评审 R1

总体判定：**FAIL**

Critical：无。  
High：2。  
Medium：3。

## High

### H1 `bindAgent` 的选中值回读可被隐藏旧值骗绿

位置：

- `lib/compile-atoms.mjs:1147`
- `lib/replay-actions.mjs:349-352`

两侧均用 `.agent-bind-select__value.first().textContent()` 回读，没有限定 `:visible`，也没有证明回读候选恰一。隐藏的旧值排在真实可见值之前时，即使界面实际选择错误，动作轴仍返回 `resolution:"unique"`、`identityReadback.ok:true`，违反 fail-safe。

可复现验证：

1. 建一个正确标题的节点抽屉。
2. 在选择控件中依次放入：
   - 隐藏 `.agent-bind-select__value`，文本为目标“订单智能体”；
   - 可见 `.agent-bind-select__value`，文本为“错误智能体”。
3. 放置唯一目标选项，但点击后不修改可见值。
4. 调用 `performAction(... workflow.bindAgent ...)`。
5. 实测结果：

```json
{
  "axis": {
    "resolution": "unique",
    "candidateCount": 1,
    "identityReadback": { "ok": true }
  },
  "visibleSelectedValue": "错误智能体"
}
```

### H2 编译侧没有把 `bindAgent` 操作锁在 `nodeLabel` 对应抽屉

位置：

- `lib/compile-atoms.mjs:1120`
- `lib/compile-atoms.mjs:1129-1138`
- `lib/compile-atoms.mjs:1147`

`compileWorkflowBindAgent` 没有调用文件内既有的 `pinNodeDrawer`，触发器、浮层选项和回读均从全页定位。`nodeLabel` 只写入事件和日志，不参与 DOM 归属判断。因此页面只有另一个节点的抽屉时，编译器仍可操作该抽屉并声称目标节点绑定成功。回放侧反而使用了 `pinNodeDrawer`，两门也不“同刻”。

可复现验证：

1. 页面只放一个标题为“另一个节点”的抽屉，内含唯一选择控件和“订单智能体”选项。
2. 用 `createCompileRun`、`compileFlow` 编译：

```js
{
  atom: 'workflow.bindAgent',
  params: { nodeLabel: '模型节点', agentName: '订单智能体' }
}
```

3. 实测输出：

```json
{
  "blockers": [],
  "events": [{
    "atom": "workflow.bindAgent",
    "nodeName": "模型节点",
    "value": "订单智能体"
  }],
  "notes": [
    "workflow.bindAgent 智能体已选中（节点「模型节点」...域锁+身份门+回读双证）"
  ]
}
```

页面不存在“模型节点”抽屉，仍产成功事件。

## Medium

### M1 `agent.searchOpen` 的自定义容器只在编译侧生效

位置：

- `lib/compile-atoms.mjs:1168-1169`
- `lib/replay-actions.mjs:307`

编译侧向共享门传入 `profile.agents.itemContainer`，回放侧不传该值，固定退回 `.agent-item`。两侧虽然 import 同一 helper，实际门参数不同，违反 A3“编译门=回放门同刻”。

可复现验证：

1. 页面放置 `<div class="custom-agent-row">订单智能体</div>`。
2. 共享门传 `containerSelector:'.custom-agent-row'`，得到 `unique`。
3. 调用 `performAction`，即使上下文带同一 profile，回放仍得到：

```json
{
  "compileGate": { "resolution": "unique", "candidateCount": 1 },
  "replayAxis": {
    "resolution": "none",
    "candidateCount": 1,
    "identityReadback": { "ok": false }
  }
}
```

### M2 A7 金牌没有执行实际浏览器回放分支

位置：

- `tests/_golden/entity-ui-wiring.bindagent-replay.golden.mjs:10-13`
- `tests/_golden/entity-ui-wiring.bindagent-replay.golden.mjs:140`
- `tests/_golden/entity-ui-wiring.bindagent-replay.golden.mjs:168`
- `tests/_golden/entity-ui-wiring.bindagent-lockchain.zero-sut.golden.mjs:176-184`

所谓 replay 金牌只运行 `casey compile` 和 `compile --execute`，覆盖的是编译期采集。锁链金牌只调用 `checkReplayEntityAdmission`，验证浏览器启动准入，没有调用 `performAction`/`doBindAgent`。因此新加的实际回放分支没有验收覆盖，H1 也能在 4/4 GREEN 下漏过。

可复现验证：

```bash
rg -n "CASEY, 'replay'|performAction|doBindAgent" \
  tests/_golden/entity-ui-wiring.bindagent-replay.golden.mjs \
  tests/_golden/entity-ui-wiring.bindagent-lockchain.zero-sut.golden.mjs
```

结果没有任何真实回放动作调用；再用 H1 的直接 `performAction` 反例即可得到假绿。

### M3 临时 PRD 使用固定路径，可能覆盖并删除已有文件

位置：

- `tests/_golden/entity-ui-wiring.searchopen.golden.mjs:129-145`
- `tests/_golden/entity-ui-wiring.bindagent-replay.golden.mjs:156-172`

测试直接覆盖固定的 `loop/prd-${caseId}.json`，结束后无条件删除；没有检查目标原本是否存在，也没有备份恢复。并发运行同一金牌会互删 authority/PRD；异常终止还会留下临时权威工件。

可复现验证：

1. 在一次性克隆中预置哨兵文件 `loop/prd-tc_eui_searchopen_a2_event.json`。
2. 运行 searchOpen 金牌。
3. 正常结束后哨兵文件被删除；若在写入后强制终止进程，则临时 PRD 或 `.golden-scratch-*` 会残留。

## 已证伪项

- `agent.searchOpen` 的精确匹配、同名多匹配、容器外命中本身均会硬阻断。
- 四份验收金牌的当前 SHA-256 与 `loop/prd-entity-ui-wiring.json` 登记一致。
- registry 的语义差异仅为新增 `agent.searchOpen.code` 和 `workflow.bindAgent`。
- 未发现冻结准入策略或前瞻红基线被直接修改。
