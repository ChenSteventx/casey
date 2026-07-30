结论：**CHANGES_REQUIRED**。唯一阻断项是 M4 仍存在可稳定复现的完成等待悬挂；其余修复语义正确，未发现新引入的独立缺陷。

| 项 | 判定 | 核验结果 |
|---|---|---|
| M1 | FIXED | legacy 会重新解析盘上 testcase/expected，使用共享 projector，并与内嵌对象比较；不一致折为 `CYCLE_PLAN_INVALID`。[cycle-input-loader.mjs:89](/mnt/d/ctx/heren/casey/lib/teachin/cycle-input-loader.mjs:89) |
| M2 | FIXED | `entityLockBytes` 要求精确等于 `[]` 字节；mapping 重新走 `flowContainsEntityMutation`。[cycle-input-loader.mjs:98](/mnt/d/ctx/heren/casey/lib/teachin/cycle-input-loader.mjs:98) |
| M3 | FIXED | entry 返回 `CYCLE_ENTRY_INPUT_INVALID` 后，record 回收归属，外层 finally 负责关闭。[record.mjs:399](/mnt/d/ctx/heren/casey/bin/record.mjs:399)、[record.mjs:407](/mnt/d/ctx/heren/casey/bin/record.mjs:407) |
| M4 | **PARTIAL / 阻断** | 多页正常关闭路径已实现，但监听安装时活跃页已经为零，或页面在枚举与挂监听之间关闭，会漏掉最后一次 close。[record.mjs:358](/mnt/d/ctx/heren/casey/bin/record.mjs:358) |
| M5 | FIXED | 原 `Map`/数组被原地清空并同步重投影，共享引用保持不变。[prepared-runtime-seam.mjs:335](/mnt/d/ctx/heren/casey/lib/teachin/prepared-runtime-seam.mjs:335) |
| M6 | FIXED | 非消费预检已对齐 `caseId`、`captureSha256`、`expectedSha256`，错绑在消费前拒绝。[raw-axes-adapter.mjs:241](/mnt/d/ctx/heren/casey/lib/teachin/raw-axes-adapter.mjs:241) |
| L2 | FIXED | 完成控件受 `__caseyRecordActive` 激活闸约束，bridge 激活后才挂载。[record.mjs:175](/mnt/d/ctx/heren/casey/bin/record.mjs:175) |
| L3 | FIXED | 死参数已删；`stageClaimedReplayExecution !== true` 时在 formal replay 前零动作拒绝。[runtime-cycle-adapter.mjs:279](/mnt/d/ctx/heren/casey/lib/teachin/runtime-cycle-adapter.mjs:279) |

M4 的具体残缝：当前代码安装监听并枚举现有页面后，没有立即执行一次 `doneWhenNoLivePage()`；`watchPage` 也没有在监听挂好后重新检查 `isClosed()`。按该逻辑做的纯内存探针在 `context.pages() === []` 时得到：

```json
{"scenario":"already-zero-live-pages","settled":false}
```

默认 `--max-ms=0` 时会无限等待。应在监听与枚举结束后立即重检，并在 `watchPage` 挂监听后再重检一次，以闭合枚举/关闭竞态。

M3 当前没有两层双关：仓内 `CYCLE_ENTRY_INPUT_INVALID` 只在 entry 接管前产生；进入 [replayability-cycle-entry.mjs:106](/mnt/d/ctx/heren/casey/lib/teachin/replayability-cycle-entry.mjs:106) 的 lifecycle 后，所有出口都由 entry 的 finally 收尾。以 reason 表达归属仍略脆弱，建议未来冻结其唯一性，但不阻断本轮。

M5 没有并发观察半投影状态的缝：clear 与两段重投影之间没有 `await`，JavaScript 同一 turn 内连续完成；失败也发生在 runner 执行前。

两条挂账：

- L1 技术处置合理：内部 `promotionEligible:true` 虽有误导性，但外层编排始终返回 `promotionReady:false`，[orchestrator-core.mjs:33](/mnt/d/ctx/heren/casey/lib/teachin/dual-replay-orchestrator-core.mjs:33)。不过“交接文档已记账”不完全属实：目前仅见于 [prd R10:170](/mnt/d/ctx/heren/casey/loop/prd-teachin-replayability-closure.json:170)，未见于 `docs/HANDOFF.md`/`docs/NEXT-SESSION.md`。这是非阻断文档缺口。
- M6 键名放宽合理：只增加精确钉值的 `caseId` 和摘要 `expectedSha256`，没有开放 expected 内容；在本探索期威胁模型下可接受。

补跑的 12 枚相关 zero-SUT/static 金牌全部退出码 0；M1/M2 与 M6 的纯内存探针也分别确认拒绝码和零消费行为。

**CHANGES_REQUIRED — 阻断项：[bin/record.mjs:358](/mnt/d/ctx/heren/casey/bin/record.mjs:358)，M4 在零活跃页/枚举竞态下可能永久不收口。**
