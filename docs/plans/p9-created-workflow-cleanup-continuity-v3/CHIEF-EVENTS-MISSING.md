# `tc_chiefcomplaint_smoke` 的 `events.json` 为什么不在场，以及怎么再生

编制：Claude（P9 收口备料 subagent，2026-08-04）　性质：考古 + 再生路径说明。
**本文件不做任何再生尝试**：再生要真机、要发真消息、要 Steven 明示再授权，全在人签门后面。

---

## 一、事实（逐条可复核）

1. 现役已签清单 `cases/tier2-suite.manifest.json`（Steven 2026-07-31 签）为本成员登记了四件哈希，
   其中 `cases/tc_chiefcomplaint_smoke/events.json` = `9b517067ce9134…`。
2. 该文件**当前不在磁盘上**。本轮做过全仓按内容哈希普查（跳过 `.git` 与 `node_modules`、
   跳过大于 200 KB 的文件），命中数 `0`——`cases/`、`runs/`、`archive/` 里都没有副本。
3. 同目录还缺 `observed-tc_chiefcomplaint_smoke.json`、`entity-bindings.draft.json`、
   `identity-observations.compile.json`——这三件与 `events.json` 是同一次编译的成组产物。
4. 目录里留着 `compile-report.json`（2026-08-03 16:23 落盘，293 字节）：

   ```
   status: failed / phase: execute / stage: compile-flow
   failedStepOrdinal: 5 / failedAtom: chat.sendAndWait
   persistentActionAttempted: false / eventsEmitted: 9 / identityObservationsCaptured: 1 / blockerCount: 0
   ```

5. `archive/compile-report.pre-tristate-indeterminate.interpretation.json`（同日 16:41）把上面那份报告
   按三态实现重新判读：

   ```
   persistentActionStatus: INDETERMINATE / persistentActionStage: click-event-not-recorded
   priorAuthorizationDisposition: consumed / rerunAuthorized: false
   ```

6. `runs/real-uat-attestation/tc_chiefcomplaint_smoke/execute-authority.json`：Steven 本人签，
   `signedAt` = `2026-08-03T07:57:24.058Z`，`audience: production`，8 条绑定；
   其哈希已登记进 `loop/prd-tc_chiefcomplaint_smoke.json` 的 `testChecksums`，且与磁盘字节一致。
   这就是 `chiefcomplaint-sendandwait-admission/SIGN-AND-AFTER.md` 第一节的**第 6 件**。

## 二、机理：被本轮失败编译自己清掉了

`bin/compile.mjs` 的执行段在跑 flow **之前**先清旧成功产物，理由写在代码注释里——
「失败路径不得让上一轮结果冒充本轮」：

```
rmSync(<outDir>/events.json)            rmSync(<outDir>/entity-bindings.draft.json)
rmSync(<outDir>/identity-observations.compile.json)   rmSync(<outDir>/observed-<caseId>.json)
rmSync(<outDir>/compile-report.json)    rmSync(<outDir>/compile-provenance.json)
```

失败时只落 `compile-report.json`，成功件一件不产。

2026-08-03 那次跑的 `--out-dir` 就是 `cases/tc_chiefcomplaint_smoke`（证据：新报告落在该目录、
时间戳 16:23、且四件成组产物同时消失）。于是 2026-07-03 那次编译留下的 `events.json`
在第 5 步 `chat.sendAndWait` 失败之前就已被清除，失败后也没有任何一件被写回。

**这是设计内行为，不是缺陷**：机制拒绝让旧轮产物冒充本轮。代价是「旧成功件被新一轮失败清空」
这种情形没有自动归档——本例即第一次实证。

（顺带如实记一笔：第 5 步失败时那次点击有没有真送出一条消息，机器**证不出**。三态判读给的是
`INDETERMINATE`，即被测智能体的会话里**可能**已经多了一条主诉消息。不许写成「没发」。）

## 三、后果

- 已签清单的这一格哈希**永远对不上了**：文件不在场，采集层 `readSuiteManifest` 直接
  「成员冻结件不在场」→ `checksumOk=false` → 五成员同批 Tier2 一例不跑。
  这正是 PRD `s5` 记的「`p9-tier2-selftest` 因 Chief artifact 缺席而红」。
- 因此 **P9 收口的五成员同批 Tier2 在 chief 的 `events.json` 再生之前不可能起跑**，
  与三例 v3 链的进度无关。

## 四、再生路径（哪件人签解锁哪条命令）

再生只有一条路：**真机重编译**。离线造不出——`events.json` 是 `compile --execute` 的产物，
其 `stepId` 由编译器分配、`requestLog` 由真实浏览器采集，没有任何纯函数入口能产。

| 序 | 动作 | 谁 | 解锁条件 |
|---|---|---|---|
| 1 | 明示**再授权一次** `compile --execute` | Steven | 第 5 步的持久动作判读是 `INDETERMINATE`、`rerunAuthorized: false`。**机器不会拦第二次**——旧权威件仍在册且字节有效，`readIdentityAdmissionAuthorityFromPrd` 会照放。拦它的只有这条纪律 |
| 2 | 用 `cases/tc_chiefcomplaint_smoke/execute-authority.draft.json` 重铸并签一份新权威（换新 `signedAt`），或明示沿用 2026-08-03 那份 | Steven | 本轮已用生产 CLI 由现役真字节产出该草案；实测它与 08-03 已签件除签署三格外**逐字节相同**（`flowSha256`、`testcaseSha256`、8 条绑定全同） |
| 3 | 若换新权威件：把新件哈希登记进 `loop/prd-tc_chiefcomplaint_smoke.json` 的 `testChecksums` | Steven 或经他授权的代理 | 不登记即 `IDENTITY_AUTHORITY_CHECKSUM_NOT_PUBLISHED`。写 `loop/prd-*.json` 会被 `hook-loop-guard` 判成 `write-prd`，须在活契约下做 |
| 4 | 跑重编译 | 机器（Steven 在场开闸） | 见下方命令 |

命令（`--sut` 只喂隧道回环基址，真目标地址绝不进命令行；只许 `autotest` 账户）：

```
node bin/casey.mjs compile tc_chiefcomplaint_smoke --execute \
  --sut <隧道回环基址> \
  --out-dir cases/tc_chiefcomplaint_smoke \
  --profile cases/tc_chiefcomplaint_smoke/profile.json \
  --testcase cases/tc_chiefcomplaint_smoke/testcase.json \
  --entity-authority runs/real-uat-attestation/tc_chiefcomplaint_smoke/execute-authority.json \
  --unique-name <本次令牌>
```

### 这条命令会对真实环境做什么（如实写清，不许含糊）

本例十步链里，`chat.sendAndWait` 是**持久非实体副作用**（人签冻结的副作用策略里
`nonEntityEffect: persistent`）：它会**向真实智能体「互联网问诊-主诉」发出一条主诉正文并等流式回复跑完**，
该次问答会留在被测方的会话记录里。其余步是导航/搜索/开测试面板/关面板，不建不改不删业务对象。
**跑一次 = 在对方会话里加一条真实问答。** 回放链末步只关面板、不删会话，工装不代人清。

`--out-dir` 指向 `cases/tc_chiefcomplaint_smoke` 是**故意**的（产物直接就位）；代价是这一跑**又会先清空**
该目录的成组产物。当前那些件已经不在场，所以本次没有可损失的东西；但下一次再跑之前，
按本轮教训应当**先把成功件另存一份到 `archive/`**。

### 失败分支

- 第 5 步再次失败：目录里只会留新的 `compile-report.json`，`events.json` 仍然不在场，
  P9 收口继续阻塞。此时**不要连跑**——每跑一次就再向真实智能体发一条消息。
  按 `route:human` 挂账，先查被测方流式接口是否可用（`profile.chat.streamUrlPattern`）。
- 编译成功（十步齐、零非 unique 步）：`events.json` / `observed-*.json` /
  `entity-bindings.draft.json`（`schemaVersion: 2`）/ `identity-observations.compile.json` 四件到位，
  接着才轮到 SIGN-AND-AFTER 的第 5 件（`expected.frozen.json` 重签 + `entity-locks.frozen.json` 首签，
  v2 路径必须带 `--entity-observations`，`--against-build` 与观察件的 `capturedAgainstBuild` 等值比对）。

## 五、连带：清单里 chief 那三格都得跟着改

再生成功后，`cases/tier2-suite.manifest.json` 本成员的四格会变三格：

- `events.json`：新哈希（重编译产物）；
- `expected.frozen.json`：新哈希（重签，且按已裁的开放问题 A 会掉顶层 `schemaVersion` 字段）；
- `profile.json`：新哈希（2026-08-03 已补 `agents` 段，**现在就已经与签署值失配**）；
- 另需**新增** `entity-locks.frozen.json` 一格（首签件）；
- `testcase.json`：本轮未改，逐个复核后原样保留，别整体重刷。

清单重签同时要走 `loop/prd-p9-tier2-live-smoke.json` 的 `checksumAmendment`（记 `oldSha`/`newSha`/`signedBy`，
原件存档回验）。详见 `SIGNING-SESSION.md` C 段。
