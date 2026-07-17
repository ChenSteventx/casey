# observation-runtime-trust-root — plan（P0/HIGH security successor）

目标：把 observation 的 canonical append transaction 真正接进 `intake → distill` CLI 主路径；在 ledger temp rename 前复核同一 inode 的完整最终字节；以显式 security revocation 撤销两份会删除固定用户 case 的旧 executable golden。全程 zero-SUT，不启动 fake/browser/server/network，不把 unkeyed `transactionSha256` 当跨进程权威。

## 1. P0 CLI canonical transaction wiring

1. `bin/intake.mjs` 只通过 `appendAcceptedObservationPackage({ caseId, capturePath })` 接受 canonical v2 package；必须位于固定 `PROJECT_ROOT/cases/<caseId>/record-capture`，并有 release publication root 验过的 Ed25519 signed readback receipt。不得再直接 `appendIntakeLedger`，也不得把 legacy/plain accepted 记录写成成功。
2. ledger committed record 除 package hashes 外，必须精确绑定 `driverReceiptSha256`、`driverKeyId`、`driverSessionNonce`。`transactionSha256` 只校记录完整性，不单独构成 authority。
3. `bin/distill.mjs` 必须从固定 canonical root 稳定重读 package、signed driver receipt 与 latest committed ledger；全部验证后在当前进程重新 mint 同 token 的 opaque accepted authority + readback receipt，再用 transaction-pair consumer 复核。plain/self-made ledger、legacy accepted、错/缺 driver signature、off-root path 均拒绝且零候选。
4. production driver registry 默认 empty；当前冻结 fixture 公钥只能存在于隔离 test publication module，不得进入 production registry。真实 driver public key 只能来自发行资源/签名 publication manifest，不得从 workspace、环境变量或 caller 扩根。真实 publication 尚未交付时，CLI 必须明确 `DRIVER_NOT_PUBLISHED`、`route:human`、零 accepted ledger，绝不假装可用。
5. 人类 intake 决策本身若将来需要不可伪造签名，明确 `route:human`；本故事不在仓内放 intake 私钥或伪签名。真实 driver 私钥保护、发布签名与轮换同样 `route:human`。

## 2. HIGH ledger temp final-integrity

1. temp 写完、fsync、close 后且 `renameSync` 前，必须以 `O_NOFOLLOW` 重新打开同一路径，确认仍是同一普通单链接 inode，完整读到 EOF，并同时比对 byte length、完整 bytes 与 `sha256(completeBytes)`。
2. 同 inode 内容被改写时必须拒绝 commit；不得 rename，不得污染正式 ledger。最终复核与 rename 之间仍有 Node 无法跨 OS 用统一 dirfd 原语闭合的 race，`route:human`。

## 3. P0 unsafe golden security revocation

1. 两份旧 frozen executable golden 属安全撤销例外：不得静默改成 PASS，也不得再次执行旧 body。
2. 原始 bytes 原样压缩进 gzip 二进制容器，receipt 记录原路径、archive 路径、decoded sha256；不得只改扩展名保存 JS 文本。门禁首版曾使用 Base64 JSON，但实跑发现 Node 直接以 `.json` 为入口会 exit 0，故以显式 amendment 改为 gzip，绝不把该 2/3 结果记绿。
3. 原 executable path 替换为无 filesystem import/写删动作的 fail-fast tombstone，固定非零退出；新 receipt 明示 `security-revoked-not-pass`，并指向 v2 safe successor。
4. 新 golden 只在先静态确认 tombstone marker 与 gzip archive 可完整解压并匹配原 sha 后才执行；必须尝试 `node archive.gz`，证明其在任何旧 body/filesystem import 前语法/容器拒绝；再用 canonical safe lease 的 sentinel/identity 证明 archive 与 tombstone 都不改、不删 case。

## 4. Frozen acceptance assets

- `tests/_golden/observation-cli-authority-wiring.zero-sut.golden.mjs`
- `tests/_golden/observation-temp-commit-integrity.zero-sut.golden.mjs`
- `tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs`
- `tests/_golden/fixtures/observation-runtime-trust-root/security-revocation.json`
- `tests/_golden/fixtures/observation-runtime-trust-root/test-driver-publication.mjs`
- `tests/_golden/fixtures/observation-runtime-trust-root/test-driver-publication-loader.mjs`
- 复用并冻结 `tests/_golden/support/canonical-case-lease.mjs`
- 复用并冻结 v2 signed receipt/public key fixtures

验收命令即上述三份 golden 的 `node` 直跑。先保存真实 RED，再 checksum freeze、`gate --dry`、独立 gate commit；实现与撤销另 commit；最后 normal gate 写 `passes:true` 与 evidence 并独立 closure commit。

## 5. 可观察性与停止条件

- Windows 的 `O_NOFOLLOW`、file identity、symlink/rename/lock/durability 需 Windows 真机故障注入，`route:human`。
- signed driver receipt 是否来自同一次真实 DOM/平台 readback、真实 release publication、driver 私钥保护/轮换和 nonce 持久防重放，需联网真机审计，`route:human`；production 目前诚实为 `DRIVER_NOT_PUBLISHED`。
- temp final reread 到 rename 的最后 race 与 safe lease cleanup 最后对账到递归删除的 race，`route:human`。
- 本门禁只证明本地 canonical transaction 与 fail-safe wiring；不运行 SUT，GREEN 不得外推成真机业务闭环。
