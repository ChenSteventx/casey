All audit points complete. Full verification summary:

---

# 终审报告 · p9-replay-authority-split（候选 9013f42）

## 审点 1 — R11c 重锚（/tmp 突变实证）

在 `/tmp/p9-mut`（`git archive HEAD` 副本）做「外科式删调用块留导出」突变（`const grantScreen = screenTier2CaseReplayGrant({…})` + 拒跑分支整块删除，导出函数保留，`node --check` 语法完好）：

| 突变 | R11c | R11b | 结果 |
|---|---|---|---|
| 删调用留导出 | **红**，红因=「死导出——只剩函数定义没有调用点」 | 仍绿（诚实：本就不证接线） | exit 1 ✓ |
| 调用点前加第二处同名 decoy | **红**，红因=「闸调用点须唯一」 | 仍绿 | exit 1 ✓（fail-closed） |
| 保留调用文本、`if(false)` 掉闸（语义旁路） | **绿** 10/10 | 绿 | 已披露残差：源形态钉钉不住「保留文本但弃用结果」，PRD observability 第 4 条已如实回归 route:human（B4）✓ |

旧钉空转机制确认：`export function screenTier2CaseReplayGrant({`（L335）不含赋值前缀，重锚文本 `const grantScreen = screenTier2CaseReplayGrant({`（L465）在定义行必不命中；`runOneCase({\n      member,`（L490 换行形态）不匹配 L143 同行定义。三断言（存在性 / 唯一性 / 拒跑分支次序 callIdx<refusedIdx<runIdx）在现源中成立。R11b 标题诚实化（「导出契约与形状（不证接线）」）与 PRD observability 订正（r5 注明 + route:human）均已核到位。

## 审点 2 — H1/H2/M1 修复本体（46d6533）

- **H1**：`executeTier2` 成员循环对 `batchContext.cleanup` 成员在 `screenTier2CaseAuthorization` 与 `runOneCase` **之前**真调 `screenTier2CaseReplayGrant`；无票 → `writeRefusalReceipt`（`refused_unauthorized`、`ran:false`、具名拒因）+ `entry.replayGrantRefused = true` + `continue`（零 spawn）。✓
- **H2**：`bin/casey.mjs` 顶层 `v3Requested` 时 `--replay-grant` 与 `--replay-grant-ledger` 与 `--batch-token` 同级必填（exit 64 具名清单），两旗标恒透传进 `--replay-grant', opts['replay-grant']` 实参；`runOneCase` 把 `replayGrantPathAbs`/`replayGrantLedgerRoot` 传 `casey run`；台账根单一路径 `runs/_tier2/replay-grant-ledger`（collect 内硬编码，`bin/replay` 共用同根语义）。✓
- **M1**：`readSessionSettled` 三态（absent/settled/unsettled）；unsettled 单列 `REPLAY_GRANT_SESSION_NOT_SETTLED`，不再落进 `BATCH_SESSION_MISMATCH`；胜者 `writeExclusiveDurable` 写完即 `fsyncSync` 再放行；重读上界 200 轮仍有界、到期 fail-closed；「建了又没了」按 unsettled 处理。✓

## 审点 3 — once 端到端 + fail-safe

R1–R19 全绿（13 spawn + 10 纯层）：R10 先记再放行、R13 台账不可写不放行、R14 异 token 拒、R15 同成员二次拒、R16 同批第二成员放行（正控）、R17 未授权成员拒、R18 两进程并发恰一胜者（真并发，非串行）。抽查未见新洞。控制器全部调用点（`bin/replay.mjs` + 4 枚 amendment 金牌）均带 grant handle；R6 缺 handle 纯层拒。

## 审点 4 — 账本

- **PRD testChecksums 七件实算全中**（plan/GRILL/两金牌/夹具/两份红证，sha256 逐一比对一致）。
- **两条 amendment 只加严逐 hunk 核**：impl-r1（实现审轮）三件 old/new 与提交链实算吻合（golden `56b458c4→e4646a5f`、plan `9474b294→b3986de8`、red `205e4800→25fffdf4`）；46d6533 对金牌只替换标题/锚文本 + 新增 R11c/R11d，**零断言删除**；r5 对金牌零删除行，重锚 + 加严。✓
- **四处 v3 金牌 amendment 请签件**：`checksum-amendment-request.json` 四个 newSha256 与实物一致（922597b7/c4e32505/e9d0f191/047d85c0），四个 oldSha256 与 v3 PRD 现 testChecksums 逐字吻合；请求件 `signed:false`、注「待 Steven C2 签回 v3 PRD」，如实挂账。✓

## 审点 5 — 回归（只信退出码，WSL）

- pure-suite **10/10 exit 0**；cli-session **13/13 exit 0**；八枚 v3 金牌逐枚 **exit 0**；**gate GREEN 5/5 exit 0**；跑完已 `git checkout -- loop/prd-p9-replay-authority-split.json`，恢复后 sha 与 HEAD 逐字节一致（c035066b…）。
- `p9-tier2-selftest`：109 passed / 2 failed，**恰为披露的两红**——T7（`cases/tc_chiefcomplaint_smoke/events.json` 在本工作树确实缺席，环境性）与 T9a（真清单尚未加 `replayGrantPath` 重签，计划内随 C 段重签跟上）。

## Findings（均不阻断）

- **F1 (Low · 文书漂移)**：plan.md §5「二十一条」计数陈旧（实为 23 钉：R11c/R11d 未入表），R11b 表行仍写「采集编排层真接线」，与 r5 诚实化后的金牌标题「导出契约与形状（不证接线）」矛盾；plan sha 自 impl-r1 后未再 amendment。执行面（金牌 + PRD observability）是权威，plan 文本滞后。
- **F2 (Low · 文书失实)**：plan.md §5.1 称 R9「禁止喂时」由金牌文本守卫（「拒因里不得出现 --now」）表达——**任何金牌中不存在该守卫**（已 grep 确认）；「设计约束非机制」的自我披露正确，但守卫存在说为假。
- **F3 (Low · 测试覆盖)**：M1 的 `REPLAY_GRANT_SESSION_NOT_SETTLED` 三态分支已实现但无 hermetic 回归钉（可用「预置非法 session.json + 调 `occupyReplayGrantMember`」可测而未测）。
- **F4 (Info · 设计内观察)**：成员消费标记 `wx` 独占但不 fsync（仅 session.json fsync）；断电窗口理论可丢标记留会话、允许同 token 重 launch。与书面设计一致（plan 只要求 session fsync），按严格 fail-safe 读法可后续加严。

---
PLAN_VERDICT: APPROVE
IMPLEMENTATION_VERDICT: APPROVE

（附 finding 清单：F1/F2/F3 为 Low 级文书与覆盖项，F4 为 Info 设计内观察；均为非阻断。R11c 重锚经删调用留导出突变恰红、decoy 恰红、还原字节全同、10/10 复绿——真钉调用点；文本保留式语义旁路残差已如实 route:human，不冒充机器已观察面。）
