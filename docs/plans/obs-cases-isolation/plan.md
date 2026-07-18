# obs-cases-isolation（full）——observation 金牌租约幂等自回收

> 基线 dev@a3f2ea1。上游诊断：`docs/HANDOFF.md` 2026-07-18 傍晚节 + `prd-cli-authority-wiring-fill` observability。决策：Steven 2026-07-18 可点选项确认 full 契约 + 租约幂等自回收（严格安全边界）。

## 目标

三个 observation 金牌共享签名冻结 caseId `tc_observation_driver_provenance` 的租约，正常路径不清 → 顺序跑互污 + 重跑自残留，主树 gate 结构性卡 3/4。改租约助手幂等自回收 + 金牌 release 清租约，使其在主树（有真实 cases/ 与历史残留）稳定绿、且绝不误删真实用户 case。

## 2026-07-18 方案修正（侦察 SAFE_V2 rename + DrvFs 探针后，实质推翻初案，更简更低风险）

侦察探针决定性修正了根因与方案：

- T2 EACCES **非** DrvFs 目录-rename 固有限制（隔离 rename、120 次 churn、5+ 次真跑 T2 全过 EACCES=0），是 9p `cache=0x5` 固定路径 churn 时外部句柄瞬时占用的偶发 Windows sharing-violation（flaky，非确定性）。
- `rename`→`copy` **否决**：copy 铸新 inode，破坏 T2 靠 inode 身份证明「拒删被换目录」的承重语义（cleanupOwned 身份不符→反而失败）。正解是 rename 包有界 retry。
- 确定性根因是 supersession `spawnSync` 30s timeout：SAFE_V2 在 9p 主树跑 ~47s（isolated ~61s）≫ 30s → 确定性 ETIMEDOUT。这才是主树必红的根因。
- 租约自回收 **不需要**（侦察证：retry+timeout 足够；自回收触双冻结安全 primitive + D7 断言、高风险）——**否决自回收**，不碰 `canonical-case-lease.mjs`。
- cli-authority + unsafe **零改动**：二者健康、cleanup 生效，此前红纯被 supersession 崩溃残留连累；supersession 修好不崩→不留残留→连累自消。

### 修正后范围（做）

1. `tests/_golden/observation-active-suite-supersession.zero-sut.golden.mjs` L14：`spawnSync` timeout `30000`→`180000`（DrvFs 裕度，慢观测 61s + 9p 尖峰）。
2. `tests/_golden/teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs` T2（约 L265–319）：block-2/block-3 的 `renameSync`/`mkdirSync`/`rmdirSync` 包有界 retry-on-EACCES/EPERM/EBUSY/ENOTEMPTY helper（~10 次 × 50–100ms），保 inode 身份语义与全断言不变；真实拒绝（耗尽重试）仍抛。

### 修正后不做

- 不动 `canonical-case-lease.mjs`（否决自回收，不碰安全 primitive）。
- 不动 cli-authority / unsafe（健康，零改动）。
- 不改 `active-suite.json` 的 11/6 契约（T2 本就应过，只让它可靠达成既定 PASS）。
- 不改 caseId、不触 kernel lib/bin。

## 范围（不做）

- 不触 kernel lib `teachin-observation-authority-root.mjs`（钉真实根是要证明的安全不变量，不加可注入案根）。
- 不改 caseId（Ed25519 签名冻结，改名 route:human）。
- 不改 `cleanupOwned` 的本进程清理安全语义（只在 acquire 前加自回收前置）。

## 安全判据（承重，主会话亲定，codex 异构评审必盯）

`reclaimOwnedResidue(caseDir, caseId)` 只在**全部满足**时 rmSync 残留，否则一律返回失败（让 acquire 继续 throw `CASE_LEASE_PREEXISTING`，绝不误删）：

1. `caseDir` 是目录、非 symlink、`realpath` 自洽（防 symlink 逃逸）。
2. `caseDir` 内存在 `.casey-golden-case-lease.json` marker：先 `lstat` 拿其 identity，再 `O_NOFOLLOW` open + `fstat` identity 一致（防 TOCTOU 换文件），size ≤ 4096、nlink===1、非 symlink。
3. marker JSON 自洽：`schemaVersion===1` && `artifactKind==='casey-golden-case-lease'` && `caseId===` 本 caseId && `directoryIdentity===` 目录当前实际 dev:ino（防 marker 移植到别的目录/别的 case）。
4. 判据核心逻辑：**真实用户 case 不会携带 casey-golden-case-lease marker**（它是租约独有产物），故「有自洽合法 marker」= 自有残留的充分判据；`directoryIdentity` 匹配 + `caseId` 匹配防移植；无 marker（真实 case）/marker 不符/身份不匹配 → fail-closed 保持 PREEXISTING。
5. 不校验 `leaseId`（残留是上次进程建的、leaseId 不同，自回收本就是跨进程回收自有残留；本进程 cleanup 仍校验 leaseId 不变）。

## 验收点

1. 红先行「自有残留可回收」：预置携带自洽合法 marker + directoryIdentity 匹配的残留 → acquire 自回收再取成功（不再 PREEXISTING）。
2. 红先行「真实 case 不误删」：预置无 marker 的真实用户 case（含 archive/events.json 等）→ acquire fail-closed 拒删、保持 PREEXISTING、目录字节不变。
3. 红先行「marker 不符拒删」：artifactKind 错 / caseId 错 / directoryIdentity 不匹配 / marker 是 symlink → 各拒删、保持 PREEXISTING。
4. 幂等：正常 acquire→release→再 acquire 不残留、不撞 PREEXISTING；崩溃路径 finally 清租约。
5. 三金牌主树（有真实 cases/ 与历史残留）顺序跑全绿、跑完零残留；契约树 gate GREEN。
6. 全仓 ratchet 对本树无新增问题；tier1 GREEN。

## 风险

- 自回收逻辑写错 = 测试代码误删真实 cases/ 目录（数据毁灭）——由严格判据 + 红先行「真实 case 不误删」断言 + codex 异构评审三重防。
- 父目录 rename race（identity 对账与 rm 之间）无跨 OS dirfd 原语，与既有 `cleanupOwned` 同限，route:human 挂账（不在本契约扩大）。
