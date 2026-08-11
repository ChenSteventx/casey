# tc_wf_history_version 回放实录（2026-08-10 傍晚，时序竞态修复后）

跑批：`b4replay0810`（批级票据第三格，本跑核销；票据 2026-08-10T23:59:59+08:00 过期）。
产物 `runs/b4-replay-20260810/tc_wf_history_version/`（含 `video.webm`）。
真机操作前已跑账户守卫：`node scripts/assert-sut-account.mjs autotest` → 匹配、exit 0。

## 结论

`PASS 6 / SUT_DEFECT 0 / HARNESS_ERROR 0 / NEEDS_HUMAN 1`，退出码 1。
**与 catalog 那跑的最好结果完全等价**（catalog 同样是六步 PASS + 清理步
`NEEDS_HUMAN(INDETERMINATE)`），不是回退。

| 步 | 意图 | 原子 | 裁定 |
|---|---|---|---|
| atstep_7 | intent_create | `workflow.create` | PASS |
| atstep_8 | intent_hist_empty | `workflow.clickEditorButton` | PASS |
| atstep_9 | intent_hist_empty_close | `workflow.closeDrawer` | PASS |
| atstep_10 | intent_publish | `workflow.publish` | PASS |
| atstep_11 | intent_hist_view | `workflow.clickEditorButton` | PASS |
| atstep_12 | intent_hist_view_close | `workflow.closeDrawer` | PASS |
| atstep_20 | intent_cleanup | `workflow.deleteByName` | **NEEDS_HUMAN(INDETERMINATE)** |

## 一、时序竞态修法在真机上确认生效

动作轴 `atstep_17`（点菜单里的「删除」）带上了加法留痕：

```
"menuDismiss": { "dismissed": true, "waitedMs": 365 }
```

即真机上菜单实际用了 **365ms** 才离场，修法等到它离场才交棒确认步。随后：

| 步 | 动作 | 耗时 | 结果 |
|---|---|---|---|
| atstep_17 | 点菜单「删除」 | 1116ms | `ok`（含等菜单离场 365ms） |
| atstep_18 | **点「确认」** | 756ms | `ok` ← 修复前此步必败 |

对照修复前 publish 那跑的同一步：1ms 即 `actionError`（确认点击撞在未关闭的菜单上被
hit-target 拦下）。修复后的 756ms 与 catalog 成功时的 758ms 同档。**这是修法在真机上的直接
实证，不是夹具推断。**

## 二、拆意图重表达也确认生效

`intent_hist_empty` / `intent_hist_empty_close` / `intent_hist_view` / `intent_hist_view_close`
四步全 PASS。这四步来自本轮把「开抽屉 → 断言 → 关抽屉」拆成独立意图的重表达——原先同意图
形状下断言被推到抽屉关闭之后求值、**必红**。拆开后两对开关各自成立。

## 三、剩下那条 NEEDS_HUMAN 是清理意图的表达形状问题，不是缺陷

清理步的后置断言**全部 ok**：

| 断言 | 期望 | 实测 | ok |
|---|---|---|---|
| `noPageError` / absent | — | 0 | ✓ |
| `noErrorEnvelope` / envelopeOk | — | 0 | ✓ |
| `destructiveContinuity` / `stableTargetAbsence` | 3 samples / 3000ms | **3 samples / 3043ms** | ✓ |

判 INDETERMINATE 的是**动作轴**：清理意图的代表步（末动作步）是 `atstep_20`——删除完成后
再搜一次以确认缺席的那次放大镜点击。删成功之后这一搜**必然候选 0**，于是动作轴恒为
`action_failed`，裁定被拖成 INDETERMINATE。

也就是说：**这个意图按当前表达，PASS 是不可达的**——删得越干净，末动作步越必然失败。
机器拒绝签 PASS 是 fail-safe 正确工作（护栏 #14：只终判 PASS 与有取证背书的 SUT_DEFECT），
不是缺陷。catalog 与 history 两例同形状、同结果，可互为对照。

**欠账**：清理意图的表达要改——把「删后复搜确认缺席」从动作步移出代表步位置（缺席证明本来就
由 `stableTargetAbsence` 后置断言承担，动作步再搜一遍是重复且自相矛盾的）。改法须与
`publish` 拆意图重表达同车考虑，属用例表达层、不碰强制层。

## 四、残留：零，经只读探针实证

```
node scripts/residue-check-readonly.mjs cases/tc_wf_history_version/profile.json b4replay0810-his
→ 未命中：「b4replay0810-his」——该名下无残留（total=0 complete=true hasNext=false），exit 0
```

退出码 0 且查询成立（`complete=true`），**不是「判不出」被当成「无残留」**（该假绿教训记在
脚本头注释里）。

## 票据状态更新

`b4replay0810` 三格现已全部核销（catalog 04:29、publish 04:31、history 本跑）。
**再跑任何一例都须新铸批级票据并重新人签。**

## 更正（2026-08-11，replay-magnifier-dispatch 契约取证推翻本文第三节定性）

第三节写「清理意图按当前表达 PASS 不可达……属用例表达层、不碰强制层」，**两处都错**：

1. flow 里清理只是一个零参原子步（`workflow.deleteByName`），复搜两步长在编译模板的原子
   展开里（`lib/compile-atoms-workflow-crud.mjs`），不是用例作者写的——「用例表达层」定性不成立。
2. 失败直因不是「删干净后搜不到（候选 0）」：放大镜 click 在回放分发层被**无条件拒点、从未
   执行**——分发层对 `workflow.deleteByName` 域的 click 要求 value（目标名绑定），放大镜形状
   恰无 value。同一形状在删除前那次（目标还在、图标可见、定位 unique）一样拒点；本文表格里
   atstep_20 的 4314ms 与 atstep_16 的 752ms 都不是点击耗时，是事件跑道的收尾等待。抽帧另证
   列表全程未过滤（删除链靠首页精确名扫描成功）。

根因是同一「放大镜过滤」契约三层落点不一致：编译模板发射（冻结钉）、前置闸白名单放行
（冻结钉），分发层无对应执行分支（无钉、洞在此）。修复走 `replay-magnifier-dispatch` 契约
（分发层接通 + 谓词单点共享），三例 events 零字节不动、零重编译零重签。
全部证据见 `docs/plans/replay-magnifier-dispatch/GRILL.md`。

本节只更正定性；第三节其余实测数据（后置断言全 ok、`stableTargetAbsence` 3 样本/3043ms、
残留零）仍有效。
