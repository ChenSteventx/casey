# replay-settle-mount 实现审记录（r1，`pi`）

## 评审元数据

- 评审对象：同 `codex-impl-r1.md`——`replay-settle-mount` 契约实现 diff，评审料 `docs/plans/replay-settle-mount/review/material-impl-r1.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `pi`（`deepseek-v4-pro`，评审家族≠实现家族）。
- 评审方调用：`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro @docs/plans/replay-settle-mount/review/material-impl-r1.md "<评审指令>"`，`pi` 版本 `0.80.3`。
- 前置 smoke 验真：先以最小 prompt（"只回复：已收到材料，字数约多少字，材料标题是什么"）确认模型正确读取料文件——回应「已收到材料。字数约 2.3 万字。材料标题：`replay-settle-mount 实现评审料（r1）`」，模型选中有效、材料读取正确。
- 护栏 #9：同一份评审料（`material-impl-r1.md`），只含 spec 要点 + 完整实现 diff + 门禁证据，不含凭据、不含实现者内心推理。`--no-tools` 保证 `pi` 只能基于料文件内容判断，不会自行读取工作树其他文件。
- 运行备注：进程正常退出，产出完整中文结构化评审。

## 结论（原文）

实现落地评审结论：基于提供的 `git diff dev...HEAD` 完整审阅，代码实现严格遵循了 `plan.md` / `GRILL.md` 的既定设计，未发现 HIGH / MED / LOW 等级的缺陷或漏改。结论：本契约的实现落地质量良好，通过全部核查，无发现。

## 逐维度核查（`pi` 原文摘录）

1. **静默点有界性（全绿）**：`lib/replay-settle.mjs` 的 `settleBeforeCapture` 三段均有硬上界——固定下限经 `finiteNonNeg` 回退至 250、非法值兜底；条件轮询由 `while(Date.now()-t0<budgetMs)` 保证预算上界，每拍 `tickLen` 内用 `Promise.race` 对 `page.evaluate` 套 500ms 竞速；`networkidle` 兜底仅在在途非零时调用且 2000ms 超时被 `catch` 吞。单代表步最坏总耗时约 4.75s，远在 120s 看门狗之内。
2. **归因窗与取证因果作用域（零动）**：接线点位于 `isLast` 块首，此时 `currentStepId` 已置 `null`；`forensics.inFlightCount()` 仅读 `inFlightApi.size`，不涉归因字段；`rhQuietWait` 只用于记账不进裁定。
3. **DOM 稳定判据鲁棒性（无漏洞）**：稳定对不跨零点（`prevZero && zero` 约束，U7 验证）；`evaluate` 抛错/永不返回、`inFlight()` 抛错三条异常路径均有对应金牌验证且不致悬死或外抛。
4. **金牌是否真证伪计时假阴（是）**：I1/I2/I5/I6/W1 逐案核对，认定均真实钉住声称的回归。
5. **即时渲染回归零行为差（达成）**：I3 钉死 `settled:true`、`waited<1500ms`、`quietPointReached:true`。
6. **冻结纪律（合规）**：三份 prd 的 `passes:true` 均由 `gate.mjs` 翻转写入（日志含 `flip` 记录），未见实现者手写 `passes`；`testChecksums` 重签覆盖准确、无遗漏。
7. **凭据外泄（零发现）**：diff 全文无 `.auth/` 内容、无 `site.json` 凭据、无真机地址；`127.0.0.1` 仅为本地夹具。
8. **术语违例（零发现）**：中文均为简体，`CONTEXT.md`「静默点」词条已扩写为跨阶段通用定义，无未登记新造术语。

## 驱动员核验备注（非评审判断，供归档交叉参考）

`pi` 结论为「未发现问题」，与 `codex` 同轮发现的 1 项 MED（条件预算被固定下限吃掉约 250ms）、1 项 LOW（多代表步走时累积未回归锁）形成异构评审的分歧——`pi` 未捕捉到 `t0` 记录点早于 `floorMs` 睡眠这一时序细节。驱动员已对 `codex` 的 MED 发现做最小复现脚本验证（见 `codex-impl-r1.md` 末尾核验记录），判定该发现 `CONFIRMED`；`pi` 侧遗漏本身不代评审对错、仅如实记档供后续处置流程参考。

## 处置与去向

本记录是本契约实现阶段的正式异构冗余评审产出（护栏 #9 达成，非同族兜底）。`pi` 判 PASS（无发现），`codex` 判非 PASS（1 MED + 1 LOW）——两路结论不一致，按契约流程以更严格一路（`codex` 非 PASS + 驱动员复现确认）为准，不应现状直接 `advance review`/`advance learn` 收尾，交实现方/Steven 判断是否需要再走一轮实现审。
