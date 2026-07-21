# A 家族反向锁 mutant 突变红证（实录）

对应 prd 第 5 条 route:human 观测项：一次性 worktree 内冻结金牌投影 sha 一致 + baseline GREEN → mutant RED 同树对照实录 + 主树字节前后 sha 双录一致。

本证由主线自己在隔离树内做（涉及冻结投影与裁判纯度，按编排纪律守在主线手里，不下放异构评审/子代理）。落地时间 2026-07-21。

## 结论

A 家族新增的反向锁 check（`flow-bridge.golden.mjs` 的 C17）对内核实体绑定执法（`lib/flow-bridge.mjs:132` 的 `requiredFlowEntityBindings`）有真实且排他的探测力：绕掉该执法后，17 条 check 里唯独 C17 由绿翻红，其余 16 条全保绿。反向锁不是摆设，主树字节全程未动。

## 流程与实录

### 一次性隔离树

```
node loop-kit/bin/contract.mjs worktree mutant-probe --lane direct --reason "..."
→ git worktree add -b mutant-probe /mnt/d/ctx/heren/casey-mutant-probe HEAD（a5b59dd）
→ 树内立独立 direct baton（护栏 #18）
```

worktree 从 HEAD 起，不含主树未提交的定稿金牌；node_modules 软链主树（共享依赖、非突变靶点）。

### 冻结金牌投影 sha 一致

把主树定稿的 `tests/_golden/flow-bridge.golden.mjs` 投影进树内，sha256 对账：

| 位置 | sha256 |
| --- | --- |
| 主树定稿金牌 | `1864f99249d688cf4bb52e0e3bb0659e8c702bcc804927afcda6137cd7e6d701` |
| 树内投影副本 | `1864f99249d688cf4bb52e0e3bb0659e8c702bcc804927afcda6137cd7e6d701` |

投影忠实：MATCH。

### baseline 必 GREEN（同树、未突变）

```
node tests/_golden/flow-bridge.golden.mjs
→ flow-bridge golden: 17 过 / 0 败，exit 0
```

树内 `lib/flow-bridge.mjs` sha256 此刻 `617fd227f26872766d84b4e892732a7c38e2297bef4abf9e3292e2a3db46012c`（= 主树，未突变）。

### 突变点（仅树内）

`lib/flow-bridge.mjs:132`：

```
- const entityPolicy = requiredFlowEntityBindings(flow);
+ const entityPolicy = []; // MUTANT: 绕掉 requiredFlowEntityBindings 执法，恒返回合法空数组
```

即绕掉桥闸对实体绑定策略的执法调用，让缺绑定的 mutation 步不再被拦。

### mutant 必 RED（同树重跑）

```
node tests/_golden/flow-bridge.golden.mjs
→ flow-bridge golden: 16 过 / 1 败，exit 1
→ FAIL C17 反向锁：mutation 步缺 entityBindings → exit 65 + 精确 ENTITY_BINDING_REQUIRED_ROLES_INVALID + 零落盘：缺绑定应 exit 65，实际 0
```

唯一翻红 = C17；其余 16 条（含 happy 与各负向分支）全保绿。GREEN → RED 同树对照，把红精准归因于内核执法被绕，排除环境/夹具差异。

树内 `lib/flow-bridge.mjs` 突变后 sha256 `a3ed0f22026c34c25a68a5b8df71bf6f31f97c4de55a457fed96bdc82a9708da`（≠ 617fd2，证突变真实且隔离在树内）。

## 主树字节前后双录一致

| 时点 | 主树 `lib/flow-bridge.mjs` sha256 |
| --- | --- |
| 突变前（before） | `617fd227f26872766d84b4e892732a7c38e2297bef4abf9e3292e2a3db46012c` |
| 突变后（after） | `617fd227f26872766d84b4e892732a7c38e2297bef4abf9e3292e2a3db46012c` |

主树字节全程未动，生产零改（D1）成立。

## 现场清理

```
git worktree remove --force /mnt/d/ctx/heren/casey-mutant-probe → removed
git branch -D mutant-probe → deleted（was a5b59dd）
```

复核：worktree 无残留、分支无残留、兄弟目录已清、主树 lib/bin 干净（只三金牌 + 两 support 件脏）。
