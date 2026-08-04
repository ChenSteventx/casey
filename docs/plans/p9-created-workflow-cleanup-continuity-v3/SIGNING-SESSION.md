# P9 v3 签署会话跑单（一场会话连续走完）

日期：2026-08-04　编制：Claude（收口备料 subagent）　基线：`dev` @ `2b05659`　状态：待 Steven 跑
对象：`plan.md` §11 第 7–8 步（三例重表达 → 三次 fresh compile → v3 锁/expected/清单人签 →
五成员同批 Tier2 → 录像/残留扫描/终签）。体例照 `docs/plans/p9-uat-close/resign-runbooks.md`。

配套：备料证据见 `evidence/signing-prep-20260804.md`；chief 缺件见 `CHIEF-EVENTS-MISSING.md`。
本文件**不代裁、不代签**；所有 `--signer` 位一律由 Steven 本人给。

全程纪律：`--sut` 只吃隧道回环基址，真目标地址绝不进命令行、日志、报告；只许 `autotest` 账户、
`ctx` 禁用；凭据值零出现；裁定按四态如实报，`NEEDS_HUMAN` 既不当失败也不当通过。

---

## 〇、机器已经备到哪一步（开工前 30 秒读完）

- 八枚 v3 相关金牌本轮实跑**全绿**（逐条退出码见第十节）。**机器面没有欠账**。
- 三例的 `flow` / `testcase` / `profile` 现役字节已闭合到「可产 v3 结构授权边」，
  逐字段绑定表 + 生产入口预演（起草→冻结→读回→preflight 正反控全过）见证据文件第一、二节。
- `cases/tier2-suite.manifest.v3.draft.json` 已备（新件，`draft: true`，未覆盖已签件）：
  结构过校验器，只差字节与人签。
- `cases/tc_chiefcomplaint_smoke/execute-authority.draft.json` 已备（生产 CLI 由真字节产，未签）。
- **剩下的红全是人签缺席**，逐条映射见第十节。

## 一、依赖序（两条链 + 一个汇合点）

```
A 链（chief，解 Tier2 起跑闸）
  A1 再授权 → A2 权威件 → A3 真机重编译 → A4 补缝 → A5 第 5 件人签 → A6 记账

B 链（三例，逐例各走一遍；例与例之间可串可分开跑）
  B0 G3 confirm flow → B1 flow.confirmed.json 就位 → B2 execute 草案重产 + 人签
  → B3 PRD 登记 → B4 fresh compile（真机、真建真删） → B5 v3 三件就位
  → B6 casey draft → B7 确认件 + 冻结预演 → B8 expected 与实体锁重签（人签）
  → B9 v3 结构锁 draft + freeze（人签） → B10 逐例回放前自检

汇合
  C 清单定稿 + 人签 + checksumAmendment  →  D 五成员同批 Tier2  →  E 录像/残留扫描/终签
```

硬顺序，别调换：

1. **A 链先于 D**：chief 的 `events.json` 不在场，五成员同批 Tier2 一例都跑不起来（见 `CHIEF-EVENTS-MISSING.md` 第三节）。
2. **B0 先于 B2**：人 confirm 会改 flow 字节 → `flowSha256` 变 → 现役 execute 草案立即作废。
3. **B4 先于 B9**：v3 结构锁绑 fresh `events.json` 字节与 compile 分配的终端 `stepId`，
   编译之前造不出（实测两红，证据文件第三节）。
4. **B8 与 B9 都先于 C**：清单要登记它们的哈希。
5. **C 先于 D**：Tier2 采集层只认已签清单，且逐件重核字节。

## 二、开工前必须知道的五条硬事实（每条都有本轮实测）

| # | 事实 | 实证 |
|---|---|---|
| F1 | 三例 flow 未经人 confirm，`compile --execute` 直接 exit 66，不启浏览器 | 带 `CASEY_LAUNCH_SENTINEL` 实跑：exit 66、哨兵未落盘 |
| F2 | confirm 改 flow 字节 → 现役 `execute-authority.draft.json` 三件作废，必须重产 | 三件经生产 CLI 重建后与现役草案逐字节相同，即它们绑的是「未 confirm」的字节 |
| F3 | fresh `events.json` 会让三例现役 v1 实体锁失配；不供锁同样拒 → **三例实体锁必须重签**（`plan §12` 漏列，账记在证据文件第四节） | 生产入口三探针：正控 `ok=true`；fresh events + 旧锁 `FROZEN_ENTITY_LOCKS_EVENTS_MISMATCH`；fresh events 不供锁 `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID` |
| F4 | v3 结构锁在 fresh compile 之前造不出 | `entity-authority created-workflow-draft` exit 65；`issueCreatedWorkflowCompileProvenance` 判 `TERMINAL_EVENT_INVALID` |
| F5 | delete adapter 的 `body.masProcessId` 这一格**未经真机确认**；`POST /ai-manager/process/delete` 两格是真机实采 | 三例 2026-07-22 `observed-*.json` 的 `requestLog` 各一条 200；`idLocation` 只有推断旁证（证据文件第六节） |

F5 的兑现点在 B4：出站守卫在删除确认落笔前按已签 adapter 精确核 `method`/`path`/唯一 `idLocation`
并逐字比对当轮 `platformId`。**形状不符 = 零发送 + 干净中止**（第九节给中止后的分支）。

## 三、逐件人签清单（一张表看全）

| 序 | 签什么 | 落点 | 谁跑 | 前置 |
|---|---|---|---|---|
| 1 | chief 重编译**再授权**（口头/书面明示即可） | 会话留痕 | Steven | 判读为 `INDETERMINATE`、`rerunAuthorized:false`；**机器不会拦第二次** |
| 2 | chief 预执行权威件（沿用 08-03 那份或换新签） | `runs/real-uat-attestation/tc_chiefcomplaint_smoke/execute-authority.json` | Steven | 换新则须重登 PRD 校验和 |
| 3 | chief `expected.frozen.json` 重签 + `entity-locks.frozen.json` 首签（v2） | `cases/tc_chiefcomplaint_smoke/` | Steven | A3 重编译成功 |
| 4 | 三例 flow 的 G3 confirm（各一次） | `cases/<caseId>/flow-<caseId>.json` 的 `confirmedBy`/`confirmedAt` | Steven | 无 |
| 5 | 三例预执行权威件（各一次，只授权本次 compile） | `runs/p9-v3-20260804/<caseId>/execute-authority.json` | Steven | 序 4 完成后重产的草案 |
| 6 | 三例 `expected.frozen.json` 重签 + 实体锁重签（v2） | `cases/<caseId>/` | Steven | B4 编译成功 + B6/B7 备件 |
| 7 | 三例 v3 结构授权边 | `cases/<caseId>/created-workflow-authority.frozen.json` | Steven | B4 编译成功 |
| 8 | Tier2 清单重签 + `checksumAmendment` | `cases/tier2-suite.manifest.json`、`loop/prd-p9-tier2-live-smoke.json` | Steven | 序 3/6/7 全部落地 |
| 9 | 逐轮录像与报告过目 | 会话留痕 | Steven | D 段跑完 |
| 10 | 残留扫描结论 + P9 UAT 终签 | `docs/plans/p9-uat-close/` | Steven | E 段跑完 |

---

## A 段　chief：把 `events.json` 找回来

完整考古与再生说明见 `CHIEF-EVENTS-MISSING.md`；此处只给动作。

### A1　再授权（人）

停止条件：Steven 不明示再授权，**A 段到此为止**，P9 保持 open。
理由：2026-08-03 那次失败的第 5 步是 `chat.sendAndWait`（持久非实体副作用），
判读 `INDETERMINATE` ——不能断言「上次没发出去」，也就不能把这次当「重试无害」。

### A2　权威件（人）

沿用 08-03 那份即可（已登记、字节有效）。若要换新签：

```
node bin/entity-authority.mjs execute-freeze tc_chiefcomplaint_smoke \
  --draft cases/tc_chiefcomplaint_smoke/execute-authority.draft.json \
  --flow cases/tc_chiefcomplaint_smoke/flow-tc_chiefcomplaint_smoke.json \
  --testcase cases/tc_chiefcomplaint_smoke/testcase.json \
  --audience production \
  --signer Steven --signed-at <ISO 时点> \
  --out runs/real-uat-attestation/tc_chiefcomplaint_smoke/execute-authority.json
```

换新后必须把新件 sha256 覆盖登记进 `loop/prd-tc_chiefcomplaint_smoke.json` 的 `testChecksums`
（键 = 该文件的仓内相对路径）。写 `loop/prd-*.json` 触发阶段互锁，须在活契约下做。

### A3　真机重编译（机器跑，Steven 在场）

```
node bin/casey.mjs compile tc_chiefcomplaint_smoke --execute \
  --sut <隧道回环基址> \
  --out-dir cases/tc_chiefcomplaint_smoke \
  --profile cases/tc_chiefcomplaint_smoke/profile.json \
  --testcase cases/tc_chiefcomplaint_smoke/testcase.json \
  --entity-authority runs/real-uat-attestation/tc_chiefcomplaint_smoke/execute-authority.json \
  --unique-name <本次令牌>
```

**这条命令会向真实智能体「互联网问诊-主诉」发一条主诉正文并等流式回复跑完**，
该问答留在被测方会话记录里，工装不代清。

停止条件：exit ≠ 0 即停，**不许连跑**（每跑一次多一条真消息）。失败只留新的 `compile-report.json`，
按 `route:human` 挂账（先查流式接口是否可用）。

### A4–A5　补缝与人签（第 3 件）

```
node bin/casey.mjs draft tc_chiefcomplaint_smoke \
  --observed cases/tc_chiefcomplaint_smoke/observed-tc_chiefcomplaint_smoke.json \
  --compile-report cases/tc_chiefcomplaint_smoke/compile-report.json \
  --testcase cases/tc_chiefcomplaint_smoke/testcase.json \
  --out-dir runs/resign-20260804/tc_chiefcomplaint_smoke [--patch <补缝件>]
```

确认件（`entity-confirmations.json`）照 `runs/resign-20260731/` 的现成脚本重跑一遍（收据编号用
2026-07-31 真机读回的 `chiefComplaint`），**尾部必须用 `freezeEntityBindingsDraft` 预演，预演不 `ok` 就别请签**。

人签（Steven 本人跑）：

```
node bin/casey.mjs sign tc_chiefcomplaint_smoke \
  --draft runs/resign-20260804/tc_chiefcomplaint_smoke/expected.draft-tc_chiefcomplaint_smoke.json \
  --prd loop/prd-tc_chiefcomplaint_smoke.json \
  --frozen-out cases/tc_chiefcomplaint_smoke/expected.frozen.json \
  --signer Steven --against-build <入口页 ?v= 实读值> \
  --events cases/tc_chiefcomplaint_smoke/events.json \
  --entity-bindings-draft cases/tc_chiefcomplaint_smoke/entity-bindings.draft.json \
  --entity-confirmations runs/resign-20260804/tc_chiefcomplaint_smoke/entity-confirmations.json \
  --entity-observations cases/tc_chiefcomplaint_smoke/identity-observations.compile.json \
  --entity-locks-out cases/tc_chiefcomplaint_smoke/entity-locks.frozen.json \
  --audience production --resign \
  --archive-dir cases/tc_chiefcomplaint_smoke/archive
```

要点：本例实体锁是**首次发布**，不带 `--resign-entity-locks`；`--resign` 只作用于
`expected.frozen.json`。`--against-build` 在 v2 下是**门不是标签**（与观察件的 `capturedAgainstBuild`
等值比对，不符拒签），取值必须在浏览器里经代理按规范源站装载、走完登录预备动作之后读
（读法与坑见 `resign-runbooks.md` 第七节第 4 条）。

### A6　记账

`expected.frozen.json` 会掉顶层 `schemaVersion`（已裁：认可，与三例对齐）。
把新哈希留着，C 段填清单要用。

---

## B 段　三例：逐例走一遍（`tc_catalog_wf_crud` / `tc_wf_publish_states` / `tc_wf_history_version`）

下文用 `<caseId>` 指代当前这一例。**三例互不耦合，可一例走完再下一例**；但每例内部必须严格按序。

### B0　G3 人 confirm（人签点）

往 `cases/<caseId>/flow-<caseId>.json` 填两格：`confirmedBy`（如 `Steven`）与
`confirmedAt`（ISO 时点）。这是「破坏性原子上真机前人眼一道」的门。

停止条件：不 confirm → B4 必 exit 66。

### B1　`flow.confirmed.json` 就位（机器）

把 confirm 后的 flow 原样复制一份：

```
cp cases/<caseId>/flow-<caseId>.json cases/<caseId>/flow.confirmed.json
```

两件必须**逐字节相同**：`compile --execute` 从 `<out-dir>/flow-<caseId>.json` 读，
而 Tier2 与回放读 `cases/<caseId>/flow.confirmed.json`，v3 权威绑的是后者的 `flowSha256`。
B0 之后若再改 flow，两件都要重同步、且 B2 起全部重来。

### B2　预执行权威（草案重产 = 机器；freeze = 人签点）

```
node bin/entity-authority.mjs execute-draft <caseId> \
  --flow cases/<caseId>/flow.confirmed.json \
  --testcase cases/<caseId>/testcase.json \
  --audience production \
  --out cases/<caseId>/execute-authority.draft.json

node bin/entity-authority.mjs execute-freeze <caseId> \
  --draft cases/<caseId>/execute-authority.draft.json \
  --flow cases/<caseId>/flow.confirmed.json \
  --testcase cases/<caseId>/testcase.json \
  --audience production \
  --signer Steven --signed-at <ISO 时点> \
  --out runs/p9-v3-20260804/<caseId>/execute-authority.json
```

`execute-freeze` 会用当前精确字节重建草案再比对，不一致即 exit 65——这就是 F2 的机器兑现。

### B3　PRD 登记（人或经授权代理）

把 `runs/p9-v3-20260804/<caseId>/execute-authority.json` 的 sha256 写进
`loop/prd-<caseId>.json` 的 `testChecksums`，键 = 该仓内相对路径。
不登记即 `IDENTITY_AUTHORITY_CHECKSUM_NOT_PUBLISHED`，compile 在浏览器前拒。
旧键（`runs/real-uat-20260722/<caseId>/execute-authority.json`）留着不碍事，本轮不用它。

### B4　fresh compile（真机；本步会真建一条工作流、真删一条工作流）

```
node bin/casey.mjs compile <caseId> --execute \
  --sut <隧道回环基址> \
  --out-dir cases/<caseId> \
  --profile cases/<caseId>/profile.json \
  --testcase cases/<caseId>/testcase.json \
  --entity-authority runs/p9-v3-20260804/<caseId>/execute-authority.json \
  --unique-name <本次唯一名令牌，三例两两不同>
```

编译期就会跑完整链：建 → 按名读回 → 出站精确 ID 守卫 → 删。产物落
`cases/<caseId>/`：`events.json`、`compile-provenance.json`、`observed-<caseId>.json`、
`entity-bindings.draft.json`（`schemaVersion: 2`）、`identity-observations.compile.json`、`compile-report.json`。

⚠️ `--out-dir cases/<caseId>` 会**先清空**该目录的上述成组产物（失败路径不许旧件冒充本轮）。
本步跑之前，**先把现役 `events.json` / `observed-*.json` 另存 `cases/<caseId>/archive/`**——
chief 就是没存这一手，旧件被一次失败编译清没了。

停止条件与失败分支见第九节（尤其「delete 形状不符」那条）。

### B5　v3 三件就位（机器核对）

`cases/<caseId>/` 下须同时在场：`flow.confirmed.json`（B1）、`compile-provenance.json`（B4）、
`created-workflow-authority.frozen.json`（B9 产）。清单校验器对这三例硬要求三件**成组在场**，
缺一即「未接 created-workflow v3 动态 ID/清理生产链」结构红。

### B6–B7　补缝与确认件（机器）

```
node bin/casey.mjs draft <caseId> \
  --observed cases/<caseId>/observed-<caseId>.json \
  --compile-report cases/<caseId>/compile-report.json \
  --testcase cases/<caseId>/testcase.json \
  --out-dir runs/p9-v3-20260804/<caseId> [--patch <补缝件>]
```

确认件照 2026-07-22 的 `craft-confirmations-*.mjs` 形态造：本轮是 `created-in-run`
（`bindingMode` 非 `existing` 时 `source` 必须是 `platform-readback`），身份值取
`identity-observations.compile.json` 的当轮读回值，不许填占位符。
**尾部必须 `freezeEntityBindingsDraft` 预演，预演不 `ok` 不请签。**

### B8　expected 重签 + 实体锁重签（人签点；F3 的兑现）

```
node bin/casey.mjs sign <caseId> \
  --draft runs/p9-v3-20260804/<caseId>/expected.draft-<caseId>.json \
  --prd loop/prd-<caseId>.json \
  --frozen-out cases/<caseId>/expected.frozen.json \
  --signer Steven --against-build <入口页 ?v= 实读值> \
  --events cases/<caseId>/events.json \
  --entity-bindings-draft cases/<caseId>/entity-bindings.draft.json \
  --entity-confirmations runs/p9-v3-20260804/<caseId>/entity-confirmations.json \
  --entity-observations cases/<caseId>/identity-observations.compile.json \
  --entity-locks-out cases/<caseId>/entity-locks.frozen.json \
  --audience production \
  --resign --resign-entity-locks \
  --archive-dir cases/<caseId>/archive
```

`--resign-entity-locks` 是本轮新用到的旗标：旧锁在场时**必须显式带**，否则
`ENTITY_LOCK_RESIGN_EXPLICIT_FLAG_REQUIRED`；且必须与 `--resign` 同时给。
撤销痕落 `cases/<caseId>/archive/entity-locks.revocations.jsonl`，
中断可由 `entity-locks.frozen.json.publish.json` 恢复日志续跑（此时 `--signed-at` 必须与日志一致）。

### B9　v3 结构授权边（人签点）

```
node bin/entity-authority.mjs created-workflow-draft <caseId> \
  --events cases/<caseId>/events.json \
  --flow cases/<caseId>/flow.confirmed.json \
  --testcase cases/<caseId>/testcase.json \
  --profile cases/<caseId>/profile.json \
  --compile-provenance cases/<caseId>/compile-provenance.json \
  --out cases/<caseId>/created-workflow-authority.draft.json

node bin/entity-authority.mjs created-workflow-freeze <caseId> \
  --draft cases/<caseId>/created-workflow-authority.draft.json \
  --events cases/<caseId>/events.json \
  --flow cases/<caseId>/flow.confirmed.json \
  --testcase cases/<caseId>/testcase.json \
  --profile cases/<caseId>/profile.json \
  --compile-provenance cases/<caseId>/compile-provenance.json \
  --audience production \
  --signer Steven --signed-at <ISO 时点> \
  --out cases/<caseId>/created-workflow-authority.frozen.json
```

签下去的边应当与备料表逐字一致（`evidence/signing-prep-20260804.md` 第一节）：
create/delete 同 `candidateId`、角色都是 `subject`、`listApiScope` = `/ai-manager/process/queryProcess`、
`nameTemplate` = `atl_{{uniqueName}}`、`consume` = `once`、adapter = `POST` +
`/ai-manager/process/delete` + `body.masProcessId`。**签前请对着这张表逐格看一眼**——
签下去的就是「运行时唯一被允许的删除形状」。

`created-workflow-freeze` 同样会用当前五源精确字节重建草案再比对，不一致 exit 65。

### B10　逐例回放前自检（机器，零 SUT）

三例都签完后，逐例跑一次读回自检（不启浏览器）：用 `readCreatedWorkflowOwnershipAuthority`
读 `created-workflow-authority.frozen.json` + 五源字节，再对已签 create/delete 端点跑
`checkCreatedWorkflowOwnershipPreflight`，须 `ok=true` / `allowExecution=true`。
任一例不过 → 说明某源字节在签后又动过，回 B9 重来。

---

## C 段　Tier2 清单定稿与重签（人签点）

### C1　由草案定稿

草案已备：`cases/tier2-suite.manifest.v3.draft.json`（**不要直接改已签的
`cases/tier2-suite.manifest.json`，定稿时整体替换**）。定稿动作恰好四类：

1. 把八类 `PENDING_*` 占位换成真实 sha256（草案的 `draftPendingArtifacts` 逐条写了各是什么件）；
2. 摘掉 `draft: true` 与 `draftBuiltBy` / `draftPendingArtifacts` 三格；
3. 补 `signed: true` / `signerId` / `signedAt` / `signNote`；
4. 逐格复核未变的哈希（`tc_agent_id_readback_real_uat_v1` 五件、三例与 chief 的 `testcase.json`），
   **别整体重刷**。

草案里已经替你做完的：三例各补 `flow.confirmed.json` / `compile-provenance.json` /
`created-workflow-authority.frozen.json` 三格、`perRunApproval: true` 保留、`caseLimit: 5`
与它的留痕原样沿用、`cleanupObligation` 按 v3 语义改写（**措辞是草案，请过目**）、
历史先例与先例分歧原样保留、`profile.json` 与 `testcase.json` 已按当前真实字节填好。

### C2　冻结面同步

`cases/tier2-suite.manifest.json` 被 `loop/prd-p9-tier2-live-smoke.json` 的 `testChecksums` 冻结，
所以重签必须**同时**走 `checksumAmendment`：记 `oldSha` / `newSha` / `signedBy`，原件存档回验
（照 `chiefcomplaint-sendandwait-admission` 那三笔的形态）。代理只备字节、不自签。

### C3　校验（机器）

```
node -e "import('./lib/selftest-tier2-manifest.mjs').then(m=>{const r=m.readSuiteManifest();console.log(JSON.stringify({present:r.present,signed:r.signed,checksumOk:r.checksumOk,memberCount:r.memberCount,problems:r.problems},null,2));})"
```

须 `signed:true`、`checksumOk:true`、`memberCount:5`、`problems:[]`。
任一不满足即停——D 段一例都不会跑。

---

## D 段　五成员同批 Tier2（真机）

前置门（`judgeTier2Readiness`，任一红即一例不跑、exit 2）：Node/Playwright/Chromium 探针、
凭据形状、登录预备、执行目标、隧道监听、**带外账户回执**（24 小时新鲜度）、
**两段连通结果**（真实目标段 + 回环隧道段，带一次性挑战字）、已签清单。
带外回执与连通结果都有新鲜度窗口，**当天现采**。

```
node bin/casey.mjs selftest --tier2 --sut <隧道回环基址> \
  --authorize-mutation tc_catalog_wf_crud \
  --authorize-mutation tc_wf_publish_states \
  --authorize-mutation tc_wf_history_version
```

- 不带 `--case` = 全五员同批（正式批要的就是这个）。
- 三个 `--authorize-mutation` 就是 `perRunApproval` 的兑现点：**每次调用都要重给**，
  入集授权不豁免逐次授权。漏给 = 该例拒跑并落拒跑回执。
- `batchToken` 由本次调用现生成（`p9-<时间戳>-<随机段>`），三例的 `uniqueNameToken` 确定性派生为
  `<batchToken>-case-1..3`，实体名 `atl_<uniqueNameToken>`。**Steven 不用手给令牌**，
  也不许复用上批的。
- 期望：exit 0，且三条变更型回执 `cleanupSatisfied: true`。

回执逐项核对（机器读，人过目）：`class`、`batchId`/`batchToken`/`uniqueNameToken`/`derivedEntityName`
四格 lineage 闭合、`cleanupSatisfied`、附件齐（`axes.json` / `verdict.json` / `report-model.json` /
`run-history.jsonl` / `run-metrics.json` / `video.webm` / `video.json` / 三份报告）。

## E 段　录像、残留扫描、终签

1. **逐轮录像与报告过目**（人）：A3 与 B4 三轮编译、D 段五成员各一轮，逐轮看录像与报告。
   `plan §12` 要的是「过目」，不是抽查。
2. **残留扫描**（机器跑、人认）：按本批 `batchToken` 派生的三个实体名与 `atl_` 保留前缀，
   在同一 `listApi` scope 内只读查一遍，三例均须**零活跃残留**。
   现状如实说：仓里**没有**独立的清理工具；只读查通道可复用
   `scripts/p9-workflow-adapter-probe.mjs` 那条路径（它只登录只读、`mutationSent:false`）。
   若发现残留 → 按 `route:human` 走人工删除并留归零证据，**不许工装自动补删**
   （恢复清理不得追认原 run 通过）。
3. **终签**（人）：P9 UAT signoff 绑 run 目录与所有承重产物 sha256，落 `docs/plans/p9-uat-close/`。
   任何 open/pending 项存在，P9 保持 open。

---

## 九、失败分支与停止条件

| 现象 | 判读 | 动作 |
|---|---|---|
| B4 出站守卫未放行（`COMPILE_WORKFLOW_DELETE_REQUEST_NOT_OBSERVED` 或 ID 位不符） | **delete 形状与已签 adapter 不符**（F5 的运行时验证点） | 请求已在 SUT 前中止、零发送；`blockers` 非空、不产成功件。此时：① 从 `compile-report.json` 取结构化拒因（不回显请求内容）；② 若确认是 `idLocation` 猜错，改的是 `cases/<caseId>/profile.json` 的 `workflows.mutationAdapter`；③ 改 profile = 改 `profileSha256` → **B2 起整段重来**（权威件、compile、v3 锁全部重签）；④ 真机可能已留一条本轮新建的工作流，按第二条残留纪律人工清 |
| B4 exit 66 | flow 未 confirm | 回 B0 |
| B4 报 `PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID` | 权威件缺失/未登记/字节失配 | 查 B2、B3；多半是 confirm 之后没重产草案（F2） |
| B4 有非 unique 步或 `blockerCount>0` | 证不出即不产成功件 | 只落 `compile-report.json`，按 `route:human` 挂账，别改断言迁就 |
| B8 报 `ENTITY_LOCK_RESIGN_*` | 重签旗标或恢复日志状态不对 | 照第 B8 节的两条旗标纪律；有 `publish.json` 时 `--signed-at` 必须与日志一致 |
| B9 exit 65 | 五源字节在签后动过 | 找出动了哪一件，回对应步 |
| C3 `checksumOk:false` | 清单字节与 PRD 冻结值失配 | `checksumAmendment` 没落或落错 |
| D 段 exit 2 | 前置门红（多半是带外回执/连通结果过期） | 当天现采后重跑；**不要**因为想跑而放宽门 |
| D 段某例 `cleanupSatisfied` 非 `true` | 环境清洁面红 | 即使业务面 PASS 也不许当绿；查 axes 的 cleanup 投影（样本数/窗口/完整性/同 ID 缺席四项） |
| 任一步出现「非签署性」的红（金牌红、生产件报错） | 机器缺口 | **停下报主循环**，不要在签署会话里就地改生产件 |

## 十、剩余红 → 待签件映射（本轮实跑）

八枚 v3 相关金牌本轮实跑全部 exit 0：

| 金牌 | 结果 |
|---|---|
| `p9-created-workflow-continuity-v3.created-in-run` | 8/8，exit 0 |
| `…stable-absence` | 8/8，exit 0 |
| `…tier2-cleanup` | 6/6，exit 0 |
| `…role-compile-sign` | 9/9，exit 0 |
| `…authority-cli` | 6/6，exit 0 |
| `…replay-evidence` | 4/4，exit 0 |
| `…tier2-production` | 5/5，exit 0 |
| `…legacy-fixed-id-supersession` | 4/4，exit 0 |

即：**四枚冻结件与四枚后继件都不红**。P9 剩下的红只有两类，全是人签缺席：

| 剩余红 | 对应待签件 |
|---|---|
| `p9-tier2-selftest`（清单采集面）红 | chief `events.json` 不在场（序 1–3）+ 清单未按 v3 重签（序 8） |
| `destructive-continuity-ref-rebuild.red-acceptance` 仍非零 | 旧固定 ID 形状的历史红件；v3 后继已证旧件不能冒充新链，该件本身的处置属另账（见 `evidence/wave1-machine-implementation-20260803.md` 未闭合项） |
| 三例 v3 三件不在场 | 序 4–7 全链 |
| 三例实体锁与 fresh events 失配 | 序 6（`plan §12` 漏列，本轮补账） |

## 十一、送 Steven 的未决问题

1. **chief 重编译是否再授权**（序 1）。不授权则 P9 收口停在这里——请明示，别让代理猜。
2. **三例实体锁重签这件事要不要补进 `plan §12` 的 route:human 清单**（现在漏列，实测必需）。
3. **`plan §12` 说 v3 锁「只授权本次 compile，不授权正式 replay」**，而实现里同一份
   `created-workflow-authority.frozen.json` 既进 compile 面也进 Tier2 回放面（Tier2 采集层就是拿它当执行件）。
   这是措辞与实现的口径差，请裁：按实现口径改计划文字，还是要另立一份回放专用授权。
4. **`idLocation` 要不要在正式批之前先补一次真机形状实采**（拿一条 `atl_` 前缀的自建对象跑
   `scripts/p9-workflow-adapter-probe.mjs`，`mutationSent:false` 拦截取形），把 F5 的弱证据补硬。
   不补也能走——B4 的出站守卫会把形状不符变成零发送 + 干净中止，代价是白跑一轮编译。
5. **清单里三例 `cleanupObligation` 的 v3 新措辞**（草案已写）请过目定稿。
