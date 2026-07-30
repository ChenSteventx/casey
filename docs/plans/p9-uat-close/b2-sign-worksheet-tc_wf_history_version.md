# B-2 签字工单：`tc_wf_history_version`

日期：2026-07-29　编制：B-2 摘清理链会话（只造件、不签字、不做 git 动作）　状态：签字就绪，待 Steven 执行

依据：`docs/plans/p9-uat-close/resign-runbooks.md` 六节「路 B-2：把清理链移出用例」。
本工单只列 Steven 要执行的命令；机器段（造件 + 彩排）已跑完，证据见第九节。

---

## 一、本例改了什么

| 项 | 改前（07-22 已签） | 改后（B-2） |
|---|---|---|
| 事件数 | 20（`atstep_0`–`atstep_19`） | 13（`atstep_0`–`atstep_12`） |
| 削掉的事件 | — | `atstep_13`–`atstep_19`，全部 `workflow.deleteByName` |
| 事件里的意图 | `intent_0`–`intent_7` | `intent_0`–`intent_6` |
| 实体锁绑定 | 20 | 13 |
| 断言总数 | 7 | 6（削 1） |
| `eventsSha256` | `sha256:e8fb876c3b93…` | `sha256:62a1a1c42b38…` |
| 用例文本意图 | 4（含 `intent_cleanup`） | 3 |

破坏链是事件流的尾部连续段，所以「摘掉」就是截断：保留的 13 步逐字节沿用 07-22 已签的原字节，
没有重编译、没有改任何保留字段。造件脚本对这一点有机械断言。

## 二、削账（逐条，护栏 #14 如实挂账）

削掉 `intent_7` 的 1 条断言：

| # | 断言 | 削掉后失去的语义 |
|---|---|---|
| 1 | `countChange` `equals` `0` | 删后按唯一名重搜计数归零不再被验证。本例的特有语义在于**被删的工作流带版本历史**（已发布、有版本记录）—— 「带子版本的实体仍可整条删除、删后列表计数归零」这条从此零覆盖。 |

连带失去的覆盖面（不是断言，但同样不再跑）：

- 带版本历史的工作流的删除路径在真机上不再被走到（是否级联删版本记录，无人验证）。
- 列表页按名搜索隔离（`atstep_14`/`atstep_15`）与删后重搜（`atstep_18`/`atstep_19`）不再被验证。

保留下来的 6 条断言仍完整覆盖本例的主命题：未发布态历史版本弹窗断「暂无数据」、
发布后断「导出」出现、再开历史版本断版本表「创建时间」「查看」，外加两条全局断言。

## 三、前置条件

1. 工作目录是仓根 `/mnt/d/ctx/heren/casey`（`bin/sign.mjs:205` 要求 `--prd` 恰是 `loop/prd-<caseId>.json`）。
2. `runs/resign-20260729-b2/tc_wf_history_version/` 下五份 `.b2-draft` 件在场（第四节第 0 步核对）。
3. `--against-build` 取 `1.1.2`：`cases/tc_wf_history_version/observed-tc_wf_history_version.json` 的
   `capturedAgainstBuild` 是 `1.1.2`。**若真机平台已升级**，按 `resign-runbooks.md` 四节的口径先读一次
   入口页脚本 `src` 的 `?v=` 值再签。
4. 本工单会动已签字节（归档旧实体锁 + 摘 PRD 校验和），属 `resign-runbooks.md` 三节点名的
   「显式撤销/归档流程」—— 仓里没有对应命令实现，这里是为本次收口开的一次性人工路径，留痕即本文件。

## 四、命令序（Steven 执行）

### 0　核对造件（只读）

```
node -e "const fs=require('fs'),c=require('crypto');for(const f of ['events.b2-draft.json','expected.b2-draft.json','entity-bindings.b2-draft.json','entity-confirmations.b2-draft.json','testcase.b2-draft.json'])console.log(f,c.createHash('sha256').update(fs.readFileSync('runs/resign-20260729-b2/tc_wf_history_version/'+f)).digest('hex').slice(0,12))"
```

期望逐行：`events.b2-draft.json 62a1a1c42b38` / `expected.b2-draft.json 60e55965dc2e` /
`entity-bindings.b2-draft.json 735820fcf44c` / `entity-confirmations.b2-draft.json 4f65f2439f51` /
`testcase.b2-draft.json 82e911561cdd`。任一不符即停手。

### 1　归档旧事件与用例文本，提升 B-2 件

```
mv cases/tc_wf_history_version/events.json cases/tc_wf_history_version/archive/events.pre-b2-20260729.json
cp runs/resign-20260729-b2/tc_wf_history_version/events.b2-draft.json cases/tc_wf_history_version/events.json
mv cases/tc_wf_history_version/testcase.json cases/tc_wf_history_version/archive/testcase.pre-b2-20260729.json
cp runs/resign-20260729-b2/tc_wf_history_version/testcase.b2-draft.json cases/tc_wf_history_version/testcase.json
```

事件必须先落到约定路径再签：实体锁把 `eventsSha256` 绑死在 `--events` 的原始字节上，回放按约定读
`cases/<caseId>/events.json`（`bin/casey.mjs:83,107,155`），两者不同源会被
`FROZEN_ENTITY_LOCKS_EVENTS_MISMATCH` 拒。

### 2　归档旧实体锁（`bin/sign.mjs:175` 硬闸）

```
mv cases/tc_wf_history_version/entity-locks.frozen.json cases/tc_wf_history_version/archive/entity-locks.frozen.tc_wf_history_version.1.1.2.fe44a786ab16.json
```

归档名里的 `fe44a786ab16` 是旧锁文件字节的 sha256 前 12 位，与 PRD 里登记的那条校验和同源。

### 3　摘 PRD 里的旧实体锁校验和（`bin/sign.mjs:214-217` 硬闸）

```
node -e "const f='loop/prd-tc_wf_history_version.json',fs=require('fs');const p=JSON.parse(fs.readFileSync(f,'utf8'));delete p.testChecksums['cases/tc_wf_history_version/entity-locks.frozen.json'];fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
```

只摘实体锁那一条；`expected.frozen.json` 与 `execute-authority.json` 两条留着不动。

### 4　人签（签字点，不可代签）

```
node bin/casey.mjs sign tc_wf_history_version \
  --draft runs/resign-20260729-b2/tc_wf_history_version/expected.b2-draft.json \
  --prd loop/prd-tc_wf_history_version.json \
  --frozen-out cases/tc_wf_history_version/expected.frozen.json \
  --signer Steven \
  --against-build 1.1.2 \
  --events cases/tc_wf_history_version/events.json \
  --entity-bindings-draft runs/resign-20260729-b2/tc_wf_history_version/entity-bindings.b2-draft.json \
  --entity-confirmations runs/resign-20260729-b2/tc_wf_history_version/entity-confirmations.b2-draft.json \
  --entity-locks-out cases/tc_wf_history_version/entity-locks.frozen.json \
  --audience production \
  --resign \
  --archive-dir cases/tc_wf_history_version/archive
```

逐旗标依据同 `resign-runbooks.md` 五节 A4：四个实体旗标成组（`bin/sign.mjs:134-138`）；
`--audience production` 因为验证回放要带 `--login-bootstrap` 走真凭据（`bin/replay.mjs:289`）；
不带 `--entity-observations`（v1 草稿，`bin/sign.mjs:246`）；不带 `--force`；不带 `--verdict-baseline`。

## 五、预期产物

- `cases/tc_wf_history_version/expected.frozen.json`：顶层键仍是 `caseId`/`intents`/`globalAssertions`，
  意图 `intent_2`/`intent_4`/`intent_5`，共 6 条断言（形状零漂移，只少了 `intent_7` 整段）。
- `cases/tc_wf_history_version/entity-locks.frozen.json`：`schemaVersion:1`、13 条绑定、
  `audience: production`、`eventsSha256` 为 `sha256:62a1a1c42b38…`。
- `cases/tc_wf_history_version/archive/expected.frozen.tc_wf_history_version.1.1.2.b8ddd427ab5c.json`
  （sign 自动归档的旧断言契约）。
- `loop/prd-tc_wf_history_version.json`：`testChecksums` 回到三条，`expectedFrozenPath` 不变。

## 六、验证命令（不接触被测系统）

```
CASEY_LAUNCH_SENTINEL=/tmp/casey-b2-sentinel-history node bin/replay.mjs \
  --events cases/tc_wf_history_version/events.json \
  --sut http://127.0.0.1:1 \
  --expected cases/tc_wf_history_version/expected.frozen.json \
  --profile cases/tc_wf_history_version/profile.json \
  --out /tmp/casey-b2-axes-history.json \
  --entity-locks cases/tc_wf_history_version/entity-locks.frozen.json
```

期望：`exit 65`，stderr 只出现 `CREDENTIAL_AUDIENCE_MISMATCH`。**关键判据是「没有」这两条**：
`DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` 与 `frozen identity locks 未过`。

## 七、真机回放（机器执行，Steven 在场开闸）

```
node bin/casey.mjs run tc_wf_history_version \
  --sut <隧道回环基址> \
  --run-dir runs/tc_wf_history_version/run_b2_20260729 \
  --unique-name <本轮新令牌> \
  --login-bootstrap
```

`--unique-name` 现在是**必填纪律**，见第八节。

## 八、`atl_` 残留与重跑冲突（护栏 #14 如实挂账）

1. **每跑一次留一个残留，而且是已发布 + 带版本历史**：本例流程走到发布并生成版本记录，
   清理链摘掉后，真机上逐轮累积**已发布且带版本历史**的 `atl_<uniqueName>` 工作流。
   三例里这一例的残留清理成本最高。
2. **`--unique-name` 从「可选」升为「必填」**：`bin/replay.mjs:65` 规定缺该旗标时令牌恒为 `r1`。
   以前有清理链兜底、重跑不冲突；现在第二次用同一令牌重跑会撞上已存在的 `atl_r1`。**每轮必须给新令牌**。
3. **清理手段仍缺**：仓里没有独立的残留清理工具（`resign-runbooks.md` 七节开放问题 7 仍未裁）。
4. 残留不污染本例剩余断言：保留的 6 条是弹窗文本、按钮态与全局断言，与列表里有多少条残留无关。
   但要注意本例断言里有「暂无数据」这类空态文本，它断的是**本轮新建工作流自己的版本弹窗**，
   不是全局列表空态，残留不影响。

## 九、明示：与 07-22 含清理链的 `PASS` 不等价

07-22 的 `8/8 PASS` 是「建 → 看空历史 → 发布 → 看版本记录 → 删干净」整条闭环的绿。
本工单签出的是前四段的绿，删除段整段不再跑。**两次绿不可互相引用、不可合并计入同一覆盖面**。

另有两处结构性欠账，随本工单一并挂账：

- `cases/tc_wf_history_version/flow-tc_wf_history_version.json` 仍是 07-22 的含清理链版本，与新事件不同步；
  今后若从该 flow 重编译会把删除链重新编回来。
- 提升 `testcase.json` 之后，`runs/real-uat-20260722/tc_wf_history_version/execute-authority.json` 里绑的
  `testcaseSha256` 不再与仓内用例文本匹配。该权威只在 `compile --execute` 时校验，今后拿它重编译会
  `fail-closed` 被拒 —— 这是正确行为，不是需要修的破。

## 十、彩排证据（机器已跑，零真机接触）

全部在一次性副本树里跑真码路径，本仓 `loop/` 与 `cases/` 一个字节没碰。

| 场景 | 结果 |
|---|---|
| 现役件复现拦截（负控）：真 `bin/replay.mjs` + 本仓真 PRD/真已签锁/原 20 步事件 | `exit 65`，命中 `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` |
| B-2 件走到浏览器前（受众 `test`） | `exit 66`，哨兵在场 —— 全部浏览器前闸放行 |
| B-2 件（受众 `production`） | `exit 65`，只命中 `CREDENTIAL_AUDIENCE_MISMATCH` |
| 第四节命令序全序彩排（真 `bin/sign.mjs`） | 第 2 步前跑 → `exit 65`「已存在」；第 3 步前跑 → `exit 65`「PRD 已含 entity-locks checksum」；两步做完 → `exit 0`，产物与第五节逐项一致 |

脚本与原始结果：`runs/resign-20260729-b2/craft-b2.mjs`、`rehearse-b2.mjs`、`sign-rehearse-b2.mjs`、
`b2-ledger.json`、`b2-rehearsal-results.json`、`b2-sign-rehearsal-results.json`。
彩排用的签署件一律 `signerId = REHEARSAL-NOT-A-SIGNATURE`，绝不冒充人签。

## 十一、回退

第 4 步 sign 若非零退出，仓内状态是「新事件 + 新用例文本 + 无实体锁 + PRD 少一条校验和」，
回放会 `fail-closed` 拒（不会假绿）。回退：

```
mv cases/tc_wf_history_version/archive/events.pre-b2-20260729.json cases/tc_wf_history_version/events.json
mv cases/tc_wf_history_version/archive/testcase.pre-b2-20260729.json cases/tc_wf_history_version/testcase.json
mv cases/tc_wf_history_version/archive/entity-locks.frozen.tc_wf_history_version.1.1.2.fe44a786ab16.json cases/tc_wf_history_version/entity-locks.frozen.json
node -e "const f='loop/prd-tc_wf_history_version.json',fs=require('fs');const p=JSON.parse(fs.readFileSync(f,'utf8'));p.testChecksums['cases/tc_wf_history_version/entity-locks.frozen.json']='fe44a786ab165f8d5ba2c5959ed49ee4f99ca445000c8cb81535eeaf505edce4';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
```
