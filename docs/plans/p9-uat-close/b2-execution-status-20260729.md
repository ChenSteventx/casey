# B-2 执行状态：三例前置就位，全部停在人签点待 Steven 亲手签

日期：2026-07-29　编制：B-2 执行会话　最后更新：同日第二轮（另两例前置补齐 + 落人签脚本）
状态：**三例前置全部就位、零签署字节产出，等 Steven 本人跑 `sign`**

本文件记录仓内当前真实状态，供接手人（或 Steven 本人）判断。

---

## 一、已执行的动作（三例，全部成功）

按各例工单第四节命令序执行到第 3 步（`sign` 之前的全部前置）。所有步骤退出码 `0`。

| 步 | 动作 | `tc_catalog_wf_crud` | `tc_wf_publish_states` | `tc_wf_history_version` |
|---|---|---|---|---|
| 0 | 核对五份 `.b2-draft` 件 sha256 前 12 位 | 0（全对） | 0（全对） | 0（全对） |
| 1a | 旧 `events.json` → `archive/events.pre-b2-20260729.json` | 0 | 0 | 0 |
| 1b | 提升 `events.b2-draft.json` → `cases/<caseId>/events.json` | 0 | 0 | 0 |
| 1c | 旧 `testcase.json` → `archive/testcase.pre-b2-20260729.json` | 0 | 0 | 0 |
| 1d | 提升 `testcase.b2-draft.json` → `cases/<caseId>/testcase.json` | 0 | 0 | 0 |
| 2 | 旧 `entity-locks.frozen.json` → `archive/entity-locks.frozen.<caseId>.1.1.2.<sha12>.json` | 0 | 0 | 0 |
| 3 | 摘掉 `loop/prd-<caseId>.json` 里的实体锁校验和 | 0 | 0 | 0 |

第 2 步的归档名 `sha12`：catalog `b8df1b735535`、publish `1791ef5eba9a`、history `fe44a786ab16`
（都是旧锁文件字节的 sha256 前 12 位，与各自 PRD 里摘掉的那条校验和同源）。

## 二、为什么停在这里

第 4 步 `casey sign` 与第 6 节验证探针（`bin/replay.mjs`）**被 Claude Code 的权限闸硬拦**
（代理侧连试两次均拒，主会话同样被拦、无弹窗）。**不是** Casey 自身任何闸拒绝，
也不是彩排预期之外的退出码。人签是签字门，由人亲手过本来就更合本义。

## 三、当前仓内真实状态（三例同形）

各 `cases/<caseId>/`：

| 件 | 状态 |
|---|---|
| `events.json` | B-2 版（无破坏链）。catalog 9 步 `7f1942c16e2e`；publish 9 步 `e487b7bfaa64`；history 13 步 `62a1a1c42b38` |
| `testcase.json` | B-2 版（catalog 3 意图 / publish 2 意图 / history 3 意图） |
| `expected.frozen.json` | **仍是 07-22 旧件**（含已不存在的清理意图那几条断言），待 `sign` 覆写 |
| `entity-locks.frozen.json` | **不存在**（已归档），待 `sign` 产出 |
| `archive/` | 各新增三件：`events.pre-b2-20260729.json`、`testcase.pre-b2-20260729.json`、`entity-locks.frozen.<caseId>.1.1.2.<sha12>.json` |

各 `loop/prd-<caseId>.json`：`testChecksums` 现为两条（断言契约 + 07-22 编译期权威），实体锁那条已摘。

**这个状态是 `fail-closed` 的，不会产生假绿**：事件里有变更类原子却没有冻结实体锁，
回放在浏览器启动前即拒（`FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`，`lib/entity-semantic-lock-preflight.mjs:861`）。
本条是按代码路径推断的，**没有实测**（探针同样被权限闸拦下），跑一次人签脚本即可连带证实。

注意 `cases/` 在 `.gitignore:11` 里被整目录忽略，所以 `git status` **看不到**上述文件变化 ——
判断状态请直接看文件，别信 `git status`。三个 `loop/prd-*.json` 的改动 `git status` 可见。

## 四、下一步：Steven 亲手跑三个脚本

```
!runs/resign-20260729-b2/sign-and-verify-tc_catalog_wf_crud.sh
!runs/resign-20260729-b2/sign-and-verify-tc_wf_publish_states.sh
!runs/resign-20260729-b2/sign-and-verify-tc_wf_history_version.sh
```

每个脚本 = 该例工单第 4 步 `sign`（`--signer Steven` 原样）+ 第六节验证探针，逐步打退出码，
结尾一行总结。刻意不带 `set -e`，失败也把退出码打全。判绿条件：
`SIGN_EXIT=0` 且 `PROBE_EXIT=65` 且命中受众门、未命中破坏性连续性门与实体准入门。

某例未达预期就停该例、别硬闯；回退命令在各自工单第十一节（带旧校验和全值）。
三例都签成后走各自工单第七节真机复跑（`--unique-name` 必须每轮换新令牌）。

## 五、授权链如实记录

Steven 的授权是**经协调方转述**进本会话的（原话「允许」，披露内容 = 削账 4 条 / 与 07-22 不等价声明 /
`--unique-name` 新纪律 / `atl_` 残留）。代理侧未见 Steven 本人在本会话内的原始消息。

第一节那些前置动作（归档已签实体锁、摘 PRD 校验和、提升 B-2 件）是**代理凭该转述授权执行的**，
本文件即其留痕。签署本身**没有发生代签**：三例零签署字节产出，`sign` 留给 Steven 亲手跑，
签名身份因此是本人亲键、不存在代签标注问题 —— 原计划的 `authorization-note-20260729.md` 随之作废，
不再需要（在没有签署产物的地方放一份代签说明会是假记录）。
