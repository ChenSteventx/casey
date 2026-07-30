# B-2 签字工单：`tc_catalog_wf_crud`

日期：2026-07-29　编制：B-2 摘清理链会话（只造件、不签字、不做 git 动作）　状态：签字就绪，待 Steven 执行

依据：`docs/plans/p9-uat-close/resign-runbooks.md` 六节「路 B-2：把清理链移出用例」。
本工单只列 Steven 要执行的命令；机器段（造件 + 彩排）已跑完，证据见第九节。

---

## 一、本例改了什么

| 项 | 改前（07-22 已签） | 改后（B-2） |
|---|---|---|
| 事件数 | 16（`atstep_0`–`atstep_15`） | 9（`atstep_0`–`atstep_8`） |
| 削掉的事件 | — | `atstep_9`–`atstep_15`，全部 `workflow.deleteByName` |
| 事件里的意图 | `intent_0`–`intent_3` | `intent_0`–`intent_2` |
| 实体锁绑定 | 16 | 9 |
| 断言总数 | 8 | 6（削 2） |
| `eventsSha256` | `sha256:6e30366437b3…` | `sha256:7f1942c16e2e…` |
| 用例文本意图 | 4（含 `intent_cleanup`） | 3 |

破坏链是事件流的尾部连续段，所以「摘掉」就是截断：保留的 9 步逐字节沿用 07-22 已签的原字节，
没有重编译、没有改任何保留字段。造件脚本对这一点有机械断言（`runs/resign-20260729-b2/craft-b2.mjs`
里 `破坏链不是尾部连续段，拒绝机械截断`）。

## 二、削账（逐条，护栏 #14 如实挂账）

削掉 `intent_3` 的全部 2 条断言：

| # | 断言 | 削掉后失去的语义 |
|---|---|---|
| 1 | `textVisible` `appears` `删除成功` | 删除动作的成功回执不再被验证。这是全套已签用例里唯一一处对「删除成功」提示的断言。 |
| 2 | `countChange` `equals` `0` | 删后按唯一名重搜计数归零不再被验证；即用例的自清理闭合性（建了就删干净）不再有机器背书。 |

连带失去的覆盖面（不是断言，但同样不再跑）：

- `workflow.deleteByName` 原子在真机上的唯一一条执行路径没有了 —— 编译侧该原子与回放侧对应的动作门，
  从此在真机 UAT 里零覆盖。
- 列表页按名搜索隔离（`atstep_10`/`atstep_11` 填搜索框 + 回车）与行内删除确认弹窗
  （`atstep_12`/`atstep_13`）的可达性不再被验证。

## 三、前置条件

1. 工作目录是仓根 `/mnt/d/ctx/heren/casey`（命令里的相对路径按仓根解析；`bin/sign.mjs:205` 要求
   `--prd` 恰是 `loop/prd-<caseId>.json`）。
2. `runs/resign-20260729-b2/tc_catalog_wf_crud/` 下五份 `.b2-draft` 件在场（第四节第 0 步核对）。
3. `--against-build` 取 `1.1.2`：`cases/tc_catalog_wf_crud/observed-tc_catalog_wf_crud.json` 的
   `capturedAgainstBuild` 是 `1.1.2`。**若真机平台已升级**，按 `resign-runbooks.md` 四节的口径先读一次
   入口页脚本 `src` 的 `?v=` 值再签，不要照抄。
4. 本工单会动已签字节（归档旧实体锁 + 摘 PRD 校验和），属 `resign-runbooks.md` 三节点名的
   「显式撤销/归档流程」—— 仓里没有对应命令实现，这里是为本次收口开的一次性人工路径，留痕即本文件。

## 四、命令序（Steven 执行）

### 0　核对造件（只读）

```
node -e "const fs=require('fs'),c=require('crypto');for(const f of ['events.b2-draft.json','expected.b2-draft.json','entity-bindings.b2-draft.json','entity-confirmations.b2-draft.json','testcase.b2-draft.json'])console.log(f,c.createHash('sha256').update(fs.readFileSync('runs/resign-20260729-b2/tc_catalog_wf_crud/'+f)).digest('hex').slice(0,12))"
```

期望逐行：`events.b2-draft.json 7f1942c16e2e` / `expected.b2-draft.json 4c2ce9d73e79` /
`entity-bindings.b2-draft.json c77a91666e17` / `entity-confirmations.b2-draft.json 96559c9eb948` /
`testcase.b2-draft.json 52580dd30e92`。任一不符即停手。

### 1　归档旧事件与用例文本，提升 B-2 件

```
mv cases/tc_catalog_wf_crud/events.json cases/tc_catalog_wf_crud/archive/events.pre-b2-20260729.json
cp runs/resign-20260729-b2/tc_catalog_wf_crud/events.b2-draft.json cases/tc_catalog_wf_crud/events.json
mv cases/tc_catalog_wf_crud/testcase.json cases/tc_catalog_wf_crud/archive/testcase.pre-b2-20260729.json
cp runs/resign-20260729-b2/tc_catalog_wf_crud/testcase.b2-draft.json cases/tc_catalog_wf_crud/testcase.json
```

事件必须先落到约定路径再签：签出的实体锁把 `eventsSha256` 绑死在 `--events` 的原始字节上，
而回放按约定读 `cases/<caseId>/events.json`（`bin/casey.mjs:83,107,155`），两者不是同一份就会被
`FROZEN_ENTITY_LOCKS_EVENTS_MISMATCH` 拒。

### 2　归档旧实体锁（`bin/sign.mjs:175` 硬闸）

```
mv cases/tc_catalog_wf_crud/entity-locks.frozen.json cases/tc_catalog_wf_crud/archive/entity-locks.frozen.tc_catalog_wf_crud.1.1.2.b8df1b735535.json
```

归档名里的 `b8df1b735535` 是旧锁文件字节的 sha256 前 12 位，与 PRD 里登记的那条校验和同源，
归档件可凭它回溯到第 3 步摘掉的那条登记。

### 3　摘 PRD 里的旧实体锁校验和（`bin/sign.mjs:214-217` 硬闸）

```
node -e "const f='loop/prd-tc_catalog_wf_crud.json',fs=require('fs');const p=JSON.parse(fs.readFileSync(f,'utf8'));delete p.testChecksums['cases/tc_catalog_wf_crud/entity-locks.frozen.json'];fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
```

只摘实体锁那一条；`expected.frozen.json` 与 `execute-authority.json` 两条留着不动
（前者由 sign 覆写，后者是 07-22 编译期权威、本次不碰）。

### 4　人签（签字点，不可代签）

```
node bin/casey.mjs sign tc_catalog_wf_crud \
  --draft runs/resign-20260729-b2/tc_catalog_wf_crud/expected.b2-draft.json \
  --prd loop/prd-tc_catalog_wf_crud.json \
  --frozen-out cases/tc_catalog_wf_crud/expected.frozen.json \
  --signer Steven \
  --against-build 1.1.2 \
  --events cases/tc_catalog_wf_crud/events.json \
  --entity-bindings-draft runs/resign-20260729-b2/tc_catalog_wf_crud/entity-bindings.b2-draft.json \
  --entity-confirmations runs/resign-20260729-b2/tc_catalog_wf_crud/entity-confirmations.b2-draft.json \
  --entity-locks-out cases/tc_catalog_wf_crud/entity-locks.frozen.json \
  --audience production \
  --resign \
  --archive-dir cases/tc_catalog_wf_crud/archive
```

逐旗标依据同 `resign-runbooks.md` 五节 A4：四个实体旗标成组（`bin/sign.mjs:134-138`）；
`--audience production` 因为验证回放要带 `--login-bootstrap` 走真凭据（`bin/replay.mjs:289`）；
不带 `--entity-observations`（本例是 v1 草稿，`bin/sign.mjs:246` 明确 v1 不接受）；
不带 `--force`（草稿无 `pending`）；不带 `--verdict-baseline`（现役件无基线，别新增）。

## 五、预期产物

- `cases/tc_catalog_wf_crud/expected.frozen.json`：顶层键仍是 `caseId`/`intents`/`globalAssertions`，
  意图 `intent_0`/`intent_1`/`intent_2`，共 6 条断言（形状零漂移，只少了 `intent_3` 整段）。
- `cases/tc_catalog_wf_crud/entity-locks.frozen.json`：`schemaVersion:1`、9 条绑定、
  `audience: production`、`eventsSha256` 为 `sha256:7f1942c16e2e…`。
- `cases/tc_catalog_wf_crud/archive/expected.frozen.tc_catalog_wf_crud.1.1.2.ad0209109c8e.json`
  （sign 自动归档的旧断言契约，名里 `ad0209109c8e` 与 PRD 旧校验和同源）。
- `loop/prd-tc_catalog_wf_crud.json`：`testChecksums` 回到三条（断言契约 + 07-22 编译期权威 + 新实体锁），
  `expectedFrozenPath` 不变。

## 六、验证命令（不接触被测系统）

```
CASEY_LAUNCH_SENTINEL=/tmp/casey-b2-sentinel-catalog node bin/replay.mjs \
  --events cases/tc_catalog_wf_crud/events.json \
  --sut http://127.0.0.1:1 \
  --expected cases/tc_catalog_wf_crud/expected.frozen.json \
  --profile cases/tc_catalog_wf_crud/profile.json \
  --out /tmp/casey-b2-axes-catalog.json \
  --entity-locks cases/tc_catalog_wf_crud/entity-locks.frozen.json
```

期望：`exit 65`，stderr 只出现 `CREDENTIAL_AUDIENCE_MISMATCH`（无凭据上下文对 `production` 受众，
`bin/replay.mjs:289`）。**关键判据是「没有」这两条**：`DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`
与 `frozen identity locks 未过` —— 它们不出现就证明实体准入门与破坏性连续性门都已放行。
哨兵文件不会生成（受众门在它之前）。

## 七、真机回放（机器执行，Steven 在场开闸）

```
node bin/casey.mjs run tc_catalog_wf_crud \
  --sut <隧道回环基址> \
  --run-dir runs/tc_catalog_wf_crud/run_b2_20260729 \
  --unique-name <本轮新令牌> \
  --login-bootstrap
```

`--unique-name` 现在是**必填纪律**，见第八节。

## 八、`atl_` 残留与重跑冲突（护栏 #14 如实挂账）

1. **每跑一次留一个残留**：清理链摘掉后，`atl_<uniqueName>` 工作流建完就不删了，真机上逐轮累积。
   本例每轮留 1 个未发布状态的工作流。
2. **`--unique-name` 从「可选」升为「必填」**：`bin/replay.mjs:65` 规定缺该旗标时令牌恒为 `r1`。
   以前有清理链兜底、重跑不冲突；现在第二次用同一令牌重跑，会撞上已存在的 `atl_r1`，
   新增工作流那一步大概率红（重名）或制造同名重复数据。**每轮必须给新令牌**。
3. **清理手段仍缺**：仓里没有独立的残留清理工具（`resign-runbooks.md` 七节开放问题 7 仍未裁）。
   在补上之前，残留只能人工去真机删。建议每轮令牌带日期（如 `b2 20260729a`）以便人工辨认。
4. 残留不会污染本例剩余断言：留下的 6 条断言不含任何计数类断言，与列表里有多少条历史残留无关。

## 九、明示：与 07-22 含清理链的 `PASS` 不等价

07-22 的 `4/4 PASS` 是「建 → 存 → 删干净」整条闭环的绿。本工单签出的是「建 → 存」两段的绿，
删除段整段不再跑。**两次绿不可互相引用、不可合并计入同一覆盖面**：任何引用 07-22 结论的文档，
不得在 B-2 之后继续把「自清理已验证」算作在册覆盖。

另有两处结构性欠账，随本工单一并挂账：

- `cases/tc_catalog_wf_crud/flow-tc_catalog_wf_crud.json` 仍是 07-22 的含清理链版本，与新事件不同步。
  今后若从该 flow 重编译，会把删除链重新编回来 —— 要么先改 flow，要么明确「B-2 后不再从旧 flow 重编」。
- 提升 `testcase.json` 之后，`runs/real-uat-20260722/tc_catalog_wf_crud/execute-authority.json` 里绑的
  `testcaseSha256` 不再与仓内用例文本匹配。该权威只在 `compile --execute` 时校验，今后拿它重编译会
  `fail-closed` 被拒 —— 这是正确行为（旧权威不该给新用例文本背书），不是需要修的破。

## 十、彩排证据（机器已跑，零真机接触）

全部在一次性副本树里跑真码路径，本仓 `loop/` 与 `cases/` 一个字节没碰。

| 场景 | 命令 | 结果 |
|---|---|---|
| 现役件复现拦截（负控） | 真 `bin/replay.mjs` + 本仓真 PRD/真已签锁/原 16 步事件 | `exit 65`，命中 `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF`（复现 07-29 真机被拦那条） |
| B-2 件走到浏览器前 | 同上，换 9 步事件 + 对应锁（受众 `test`） | `exit 66`，哨兵在场 —— 全部浏览器前闸放行 |
| B-2 件（受众 `production`） | 同上 | `exit 65`，只命中 `CREDENTIAL_AUDIENCE_MISMATCH`，实体门与破坏门均未拦 |
| 第四节命令序全序彩排 | 真 `bin/sign.mjs`，副本树 | 第 2 步前跑 → `exit 65`「已存在」；第 3 步前跑 → `exit 65`「PRD 已含 entity-locks checksum」；两步做完 → `exit 0`，产物与第五节逐项一致 |

脚本与原始结果：`runs/resign-20260729-b2/craft-b2.mjs`、`rehearse-b2.mjs`、`sign-rehearse-b2.mjs`、
`b2-ledger.json`、`b2-rehearsal-results.json`、`b2-sign-rehearsal-results.json`。
彩排用的签署件一律 `signerId = REHEARSAL-NOT-A-SIGNATURE`，绝不冒充人签。

## 十一、回退

第 4 步 sign 若非零退出，此时仓内状态是「新事件 + 新用例文本 + 无实体锁 + PRD 少一条校验和」，
回放会 `fail-closed` 拒（不会假绿）。回退：

```
mv cases/tc_catalog_wf_crud/archive/events.pre-b2-20260729.json cases/tc_catalog_wf_crud/events.json
mv cases/tc_catalog_wf_crud/archive/testcase.pre-b2-20260729.json cases/tc_catalog_wf_crud/testcase.json
mv cases/tc_catalog_wf_crud/archive/entity-locks.frozen.tc_catalog_wf_crud.1.1.2.b8df1b735535.json cases/tc_catalog_wf_crud/entity-locks.frozen.json
node -e "const f='loop/prd-tc_catalog_wf_crud.json',fs=require('fs');const p=JSON.parse(fs.readFileSync(f,'utf8'));p.testChecksums['cases/tc_catalog_wf_crud/entity-locks.frozen.json']='b8df1b735535a32322485db7e5266f1a2d470606ad99af7ee6818ef0f866f8c6';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
```
