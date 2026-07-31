# 设计三：实体锁的撤销 / 归档流程

状态：设计稿，**未实现**。

## 现状

`bin/sign.mjs:175` 只有一句文案，没有实现：

```
if (existsSync(entityLocksOut) && !recoveryJournal) die(65, 'entity-locks.frozen.json 已存在；身份锁重签须另走显式撤销/归档流程');
```

对比之下，`expected.frozen.json` 的重签路径是**完整的**（`bin/sign.mjs:395-451`）：
`--resign` 显式旗标 + 内容哈希后缀的归档名 + publication journal 崩溃恢复 +
凭据兜底门 + `commitWrites` 的 PRD 最后落位。

所以本设计的主张是：**不另造一套，照抄这套已经跑熟的形状**，只补实体锁特有的那一件事——撤销声明。

## 为什么归档不等于撤销

`expected.frozen.json` 过时了，旧字节归档就够了：它描述的是「期望长什么样」，
旧期望被新期望取代，没有残余效力。

实体锁不一样。它是**授权破坏动作的权威件**。一份旧锁被新锁取代之后，
如果只是被挪进 `archive/`，档案里就没有任何一句话说「这份锁从某时起不再有效、是谁决定的、为什么」。
对一件授权删除的东西，这个区别是承重的。

所以实体锁的流程要两件产物，不是一件：**归档件**（旧字节原样留存）+ **撤销声明**（新产物，说明失效事实）。

## 流程设计

### 旗标

新增 `--resign-entity-locks`，与既有 `--resign` 并列、互不蕴含。
两件事各自显式：期望重签不自动带上锁重签，反之亦然。

无该旗标时，`bin/sign.mjs:175` 的现行拒绝**逐字保留**（anti-clobber 不放松）。

### 步骤

1. **读旧锁并严校**。旧锁必须能过 `validateFrozenArtifact`（签名自洽、形状合法）。
   过不了就拒，**不归档**——照抄 `bin/sign.mjs:416` 的 `旧 frozen 非法，拒绝生成重签 archive`。
   理由：归档一份自己都证不出完整性的字节，档案就是噪声。

2. **备归档件**（写盘留到最后，同既有 `archivePlan` 姿势）：

   ```
   <archiveDir>/entity-locks.frozen.<caseId>.<audience>.<旧内容 sha256 前 12>.json
   ```

   内容哈希后缀是照抄 `bin/sign.mjs:404-408` 的理由：不同旧内容必得不同归档名
   （防稳定碰撞覆盖毁审计），同内容重归档同名（幂等无损）。

3. **备撤销声明**：

   ```
   <archiveDir>/entity-locks.revoked.<caseId>.<旧内容 sha256 前 12>.json
   ```

   ```
   {
     schemaVersion: 1,
     artifactKind: 'entity-locks-revocation',
     caseId,
     revokedLockSignature,      // 旧锁的 signature，唯一指认被撤销的那一份
     revokedLockSha256,         // 旧锁字节哈希，与归档件对得上
     revokedAt,                 // 人签时刻
     revokedBy,                 // 人签者 ID —— 见下方「代签禁令」
     reason,                    // 一句为什么，人写
     supersededBy,              // 新锁的 signature；纯撤销不重签时为 null
     signature                  // calculateIdentityAdmissionSignature 同款，覆盖除自身外全部键
   }
   ```

   撤销声明也过 `calculateIdentityAdmissionSignature`（`lib/entity-semantic-lock-preflight.mjs:313-321`
   对除 `signature` 外全部键取哈希，可直接复用，无需新算法）。

4. **过凭据兜底门**。归档件与撤销声明一并进 `gateInputs`（照抄 `bin/sign.mjs:481-484` 的做法），
   命中即零落盘。

5. **落盘走 `commitWrites` + publication journal**，PRD 最后落位。
   实体锁本来就已经有 journal 恢复路径（`bin/sign.mjs:156` 的 `<path>.publish.json`），
   把归档件与撤销声明挂进同一 journal 的 `entries`，崩在中间可恢复。

6. **PRD `testChecksums` 换值**。新锁的哈希覆盖旧值——`bin/sign.mjs` 现有逻辑已经在做，
   不需要额外动作。`passes` 字段不碰（只有 `gate.mjs` 有权写）。

### 归档件会不会被拿去当权威

设计上不会：`readIdentityAdmissionAuthorityFromPrd({ prdId, artifactKey })` 要求
`artifactKey` 登记在 PRD 的 `testChecksums` 里，归档路径从不登记，
所以 `--entity-locks <归档路径>` 应当取不到权威。

**但这是设计假定，本轮没有实测证据。**落地时必须补一条验收把它钉死：
拿归档路径喂 `--entity-locks`，断言 `exit 65` + 权威读取失败，且哨兵缺席。
不补这条就等于口头承诺。

## 代签禁令（承重）

`revokedBy` 与 `signerId` 是**人签身份**，任何自动化路径都不得填真人姓名。

- 机器起草的撤销声明，`revokedBy` 一律写 `PENDING_STEVEN`；
- provenance 同文件注明：凭据出处、撤销范围（哪个 `caseId`、哪份 signature）、
  以及「本字段由 Claude 代填、非本人书写」；
- 真值只能由 Steven 本人在签署动作里落。

绝不写 `signedBy: "Steven"` 这类冒名字节。

## 轻量替代：一次性人工归档

如果只是为了让本轮收口过去、不想现在就实现旗标，`docs/plans/p9-uat-close/resign-runbooks.md`
提过一条一次性路径：人工把旧锁挪进 `archive/`、人工从 PRD 摘除对应 `testChecksums` 条目。

可行，但要认清代价：

- 没有撤销声明，档案里缺「谁在何时以什么理由让它失效」；
- 手工摘 `testChecksums` 是编辑 PRD，须确认不触碰 `passes`；
- 每做一次就欠一次账，第二次做的时候没人记得第一次的规矩。

建议只在「确定只做一次」时用，并且当场把这次的归档路径与理由写进 `docs/HANDOFF.md`。
做第二次就该实现旗标了。

## 与本主题的耦合

本设计是 v3 锁落地的**前置**，不是可选项：
v3 格式一旦启用，三例现役 v2 锁全都要换成 v3 锁，
而换锁就撞 `bin/sign.mjs:175` 那句拒绝。没有撤销/归档流程，v3 锁根本签不出来。

排序上：先有撤销流程，才谈得上换 v3 锁，才谈得上让红验收 R2-R5 转绿。
