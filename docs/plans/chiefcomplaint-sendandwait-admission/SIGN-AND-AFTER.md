# 请签清单 + 签完之后的可执行清单

日期：2026-07-31　编制：Claude（`chiefcomplaint-sendandwait-admission` 契约）
状态：机器段已收口，**全部停在人签前**。本文件不代裁、不代签。

---

## 一、还差哪几件人签（逐件写清签的是什么）

| # | 签什么 | 落点 | 现状 | 性质 |
|---|---|---|---|---|
| 1 | 甲案登记进人签冻结权威源（第 10 行 `chat.sendAndWait`） | `loop/prd-teachin-admission-side-effect-policy.json` 的 `checksumAmendments`（`1cec5a3b` → `3c997414`） | 字节已备好，`signedBy: PENDING_STEVEN` | ADR-0004 |
| 2 | 甲案造成的断言重钉 | `loop/prd-admission-policy-facets.json` 的 `checksumAmendments`（`a445cbde` → `a0de0556`） | 同上 | ADR-0004 |
| 3 | 甲案造成的行为基线位移（672 条里恰 2 条） | 同上 PRD（`e44e2d5f` → `277e9dcd`） | 同上 | ADR-0004 |
| 4 | flow 扩绑定的重确认 | `cases/tc_chiefcomplaint_smoke/flow-tc_chiefcomplaint_smoke.json` 的 `bindingsProvenance.confirmationStatus` | `PENDING_STEVEN`；顶上的 `confirmedBy/confirmedAt` 仍是 2026-07-03 对**步骤表**的确认，本次未改一个步骤 | G3 人 confirm 门 |
| 5 | `expected.frozen.json` 重签 + `entity-locks.frozen.json` 首签 | 见第三节命令 | 请签包已备齐 | ADR-0004 |
| 6 | （仅当要走真机重编译）预执行权威件的 `signerId` | 见第四节 | **未铸**，因为铸它就是代签 | ADR-0004 |

**第 1–3 件已经把字节写进仓里了**（走 `checksumAmendment` 机制，原件均已存档回验），
所以金牌现在是绿的。绿不等于已签——账在 `checksumAmendments` 的 `signedBy: PENDING_STEVEN` 上。
若 Steven 否掉甲案，回滚路径见第五节。

### 顺带要一并裁的三个开放问题（沿用 `resign-runbooks.md` 第七节）

- **A**：重签会丢掉 `expected.frozen.json` 顶层的 `schemaVersion` 字段（`bin/sign.mjs` 从不写它），
  与 07-22 签的另三例形状对齐。这是改动人签过的字节，要不要认可？
- **B**：收据 `code` 用的是显式待办占位符 `ROUTE-HUMAN-CODE-READBACK-PENDING-20260731`
  （被测智能体的平台编号未经真机读回）。本例走 v1、回放不比对身份三元组，占位符可用——认不认？
- **C**：`--against-build` 取 `1.1.2`（同期同平台值；本例自己的 `observed` 的
  `capturedAgainstBuild` 是 `null`，07-03 编译早于该字段接线）。**若真机平台已升级，
  签之前须先读一次入口页脚本 `src` 的 `?v=` 值**，不要照抄。

---

## 二、请签包在哪

```
runs/resign-20260731/tc_chiefcomplaint_smoke/
  entity-bindings.draft.json                 10 条绑定，schemaVersion 1，signed=false
  entity-confirmations.json                  10 条 + 单张 agent 锁收据，带 PENDING_STEVEN provenance
  expected.draft-tc_chiefcomplaint_smoke.json 由现役冻结件反推的脱签草稿，无 pending
runs/resign-20260731/craft-chief.mjs          造前两件的脚本（可复跑自证）
runs/resign-20260731/craft-designed-draft.mjs 造第三件的脚本
loop/prd-tc_chiefcomplaint_smoke.json         新建，testChecksums 为空（首次发布前必须为空）
```

冻结预演（与 sign 侧同一入口 `freezeEntityBindingsDraft`）已过：
`ok=true` / `replayReady=true` / `schemaVersion=1` / 10 条绑定。**预演过了才请签**，是纪律。

---

## 三、签（Steven 本人跑，不可代签）

```
node bin/casey.mjs sign tc_chiefcomplaint_smoke \
  --draft runs/resign-20260731/tc_chiefcomplaint_smoke/expected.draft-tc_chiefcomplaint_smoke.json \
  --prd loop/prd-tc_chiefcomplaint_smoke.json \
  --frozen-out cases/tc_chiefcomplaint_smoke/expected.frozen.json \
  --signer Steven \
  --against-build 1.1.2 \
  --events cases/tc_chiefcomplaint_smoke/events.json \
  --entity-bindings-draft runs/resign-20260731/tc_chiefcomplaint_smoke/entity-bindings.draft.json \
  --entity-confirmations runs/resign-20260731/tc_chiefcomplaint_smoke/entity-confirmations.json \
  --entity-locks-out cases/tc_chiefcomplaint_smoke/entity-locks.frozen.json \
  --audience production \
  --resign \
  --archive-dir cases/tc_chiefcomplaint_smoke/archive
```

逐旗标依据见 `docs/plans/p9-uat-close/resign-runbooks.md` A4（已逐条核过，仍成立）。
两处要点：`--resign` 只作用于 `expected.frozen.json`（实体锁是首次发布，
`bin/sign.mjs:175` 的既存拦截不触发）；**不带** `--entity-observations`（本例走 v1）。

---

## 四、签完之后（可执行清单）

按顺序做，每步只信退出码。

1. **确认 sign 自己写了什么**（`bin/sign.mjs:488-493` 的落盘顺序，PRD 最后落位）：
   `loop/prd-tc_chiefcomplaint_smoke.json` 应出现两条 `testChecksums`
   （`expected.frozen.json` 与 `entity-locks.frozen.json`）+ `expectedFrozenPath`。
   `passes` 不该有任何变化（只有 `gate.mjs` 有权写）。

2. **真机验证回放**（本例是流式对话用例，会真给被测智能体发一条消息）：

   ```
   node bin/casey.mjs run tc_chiefcomplaint_smoke \
     --sut http://127.0.0.1:15519 \
     --run-dir runs/tc_chiefcomplaint_smoke/run_resign_20260731 \
     --unique-name <新令牌> \
     --login-bootstrap
   ```

   实体锁按约定自动解析（`bin/casey.mjs:83,107,155`），不必手写 `--entity-locks`。
   纪律：只许 `autotest` 账户、`ctx` 禁用；`--sut` 只喂回环基址，真目标地址绝不进命令行或日志。
   裁定按四态如实报——`NEEDS_HUMAN` 既不当失败也不当通过。

3. **同步 tier-2 清单并重签**（本条是本清单的必做项）：
   `cases/tier2-suite.manifest.json` 里 `tc_chiefcomplaint_smoke` 成员的 `artifacts` 现登记 4 个哈希
   （`events.json` / `expected.frozen.json` / `profile.json` / `testcase.json`）。签完之后：
   - `expected.frozen.json` 的哈希**会变**（重签盖了新 `signedAt`，且可能掉 `schemaVersion`，见开放问题 A）；
   - 新增了 `entity-locks.frozen.json`，按同族先例应一并登记进 `artifacts`；
   - `events.json` / `profile.json` / `testcase.json` 本轮未改，哈希不该动——**逐个复核，别整体重刷**。

   清单顶层是人签件（`signed: true` / `signerId: Steven` / `signedAt`），改 `artifacts` 属重签事件。
   而且 `cases/tier2-suite.manifest.json` 被 `loop/prd-p9-tier2-live-smoke.json` 的 `testChecksums` 冻结，
   所以要**同时**走 `checksumAmendment`（记 `oldSha`/`newSha`/`signedBy`，原件存档回验）。
   代理只备字节、不自签。

4. **全仓漂移扫**：`node loop-kit/bin/ratchet.mjs verify`，须 `GREEN`、零 checksum 失配。
   （本轮机器段收口时实测 `GREEN`：151 PRD / 625 冻结文件 / 0 问题。）

5. **邻接复跑**（护栏 #19，别信分层绿）：23 份消费 `entity-semantic-lock-preflight` 的金牌逐个复跑记退出码，
   与本轮基线对比。本轮基线 = 19 绿 / 4 红，且那 4 红**在 HEAD 版模块上同样红**（已实测，非本次引入）：
   `entity-destructive-continuity-guard.round3` / `...wiring` / `entity-ui-wiring.searchopen` / `p3-compile`。

6. **链路自检**：`node bin/casey.mjs selftest --tier1`（本轮实测全绿）。

7. **回填账本**：`docs/HANDOFF.md` 的迁移账 + `docs/plans/p9-uat-close/resign-runbooks.md`
   跑单 A 的状态（由「待 Steven 裁」改成实际结果），并把 `chat.sendAndWait` 的档位裁定
   写进 `CONTEXT.md` 相关条目（如需）。

8. **异构评审**：本轮碰了 `lib/` 生产件与三份人签冻结件，按纪律要送异构评审（`codex` 评 Claude 实现），
   且**必须对着已提交的不可变快照**跑，不能对着仍在变的工作树。

---

## 五、如果 Steven 否掉甲案（回滚路径）

三处冻结件的原件都已存档、可逐字节还原：

```
docs/plans/chiefcomplaint-sendandwait-admission/archive/
  entity-admission-policy.frozen.pre-sendandwait.json.gz            解压回验 sha = 1cec5a3b…
  behavior-baseline.pre-sendandwait.json.gz                          解压回验 sha = e44e2d5f…
  admission-policy-facets.zero-sut.golden.pre-sendandwait.mjs        sha = a445cbde…
cases/tc_chiefcomplaint_smoke/archive/
  flow-tc_chiefcomplaint_smoke.pre-sendandwait.json                  sha = 3504a493…
```

还原这四份 + 撤掉 `lib/entity-semantic-lock-preflight.mjs` 里那一行登记 + 摘掉两份 PRD 的
三条 `checksumAmendments` 与对应 `testChecksums` 回退，即回到本轮之前的字节。
`loop/prd-tc_chiefcomplaint_smoke.json` 是新建件，删掉即可。

---

## 六、真机重编译（路 β）为什么没走到

任务书原定顺序是「扩 flow 绑定 → 铸权 → 哨兵 → 重编译 → 补缝 → 确认 → 签 → 跑」。
**卡在第二步「铸权」**：本例 flow 全是变更类步骤，`flowContainsEntityMutation` 为真，
于是 `compile --execute` 必须先拿到一份人签的预执行权威件才准启动浏览器。实测：

```
checkCompileIdentityAdmission({mode:'execute', executeAuthority:null, ...})
=> {"ok":false,"allowBrowserLaunch":false,
    "reason":"PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID",
    "nextAction":"LOAD_FIXED_OR_HUMAN_SIGNED_EXECUTE_AUTHORITY"}
```

2026-07-22 那次是靠造件脚本直接往权威件里写 `signed: true` / `signerId: 'Steven'` 过的这道门
（`runs/real-uat-20260722/craft-crud.mjs:43-52`，脚本头注明「须 Steven checkpoint 后」）。
本轮不这么干：那是代签。所以停在铸权前。

**好消息是不必走路 β**。`resign-runbooks.md` 跑单 A 已实证：本例的实体锁草稿是纯函数产物
（`buildEntityBindingsDraft` 入参只有事件字节 + 事件文档 + 来源行），可从现役 `events.json`
离线造出，全程唯一需要真机的是最后一步验证回放。本轮走的就是这条路，
终点恰好是任务书要的停止点——「停在 Steven 人签 `entity-locks.frozen.json` 之前」。

若 Steven 仍要完整重表达（好处：事件对齐当前平台构建，`capturedAgainstBuild` 不再是 `null`，
可解开放问题 C），那就在签实体锁之前先补铸权这一签，命令形态照
`runs/real-uat-20260722/craft-crud.mjs` 但 `signerId` 由他本人给，并把权威件校验和登进
`loop/prd-tc_chiefcomplaint_smoke.json` 的 `testChecksums` 才生效
（信任锚 `lib/entity-semantic-lock-preflight.mjs:299-330`）。
