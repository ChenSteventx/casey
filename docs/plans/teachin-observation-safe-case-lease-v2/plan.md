# teachin-observation-safe-case-lease-v2 — plan（P0 successor）

目标：替代两份会无条件递归删除固定 `cases/tc_observation_driver_provenance` 的 unsafe golden，并在安全 canonical case lease（规范用例目录租约）下同时复冻 transaction-root 10 组与 driver canonical-root 7 组行为。旧 `teachin-observation-transaction-root` 与 `teachin-observation-driver-canonical-root` 的 plan/golden/fixture/PRD/checksum 一字节不改，只作历史证据，绝不再作为可执行门禁调用。

## 1. P0 case lease

1. 新 support 只接受固定 `PROJECT_ROOT/cases/<caseId>`；若 case 目录预存，立即 fail-safe，字节不变且不尝试删除。
2. case 目录用 exclusive `mkdir` 创建，随后以 `O_CREAT|O_EXCL|O_NOFOLLOW` 创建私有 marker。lease 记录 case 目录与 marker 的 `dev:ino`、随机 leaseId 和 caseId。
3. cleanup 只有在本进程确实创建 lease、case 目录仍为同一普通目录且 realpath 未变、marker 仍为同一普通单链接文件并且私有内容逐字段匹配时，才可递归删除；未持有、目录/marker 被替换、symlink 或 identity 改变一律拒删并留给人。
4. golden 每次 `finally` 调 lease cleanup；自身失败时仍走同一所有权校验。不得出现固定 case 目录的无条件 `rmSync`。最后一次 identity 对账与递归删除间的跨进程父目录 rename race 无跨 OS 统一 dirfd 原语，明确 `route:human`。

## 2. Transaction-root successor（10 组）

完整复冻：off-root 拒；ancestor symlink/lease replacement 拒；ledger symlink/hardlink 外部零写；malformed receipt/ledger 拒绝零 accepted residue；锁占用与唯一 bounded committed transaction；consumer 只认闭合 committed；A receipt+B authority 私有 token 错配拒；四维 safe-own-data limits；巨大稀疏数组与 identity 共享 snapshot。

## 3. Driver canonical-root successor（7 组）

完整复冻：plain source 拒；fixed key registry 与调用者 key/registry/自签拒；signed Ed25519 正向 opaque authority+receipt transaction pair 与 identity trusted；全 payload/signature/keyId/缺签篡改拒；跨 package/case 拒；Proxy/accessor 零执行；旧 frozen checksum + v2 machine-readable supersession receipt。

receipt 必须在 append 前存在；全部负向 append 都验证零 accepted ledger/lock/temp residue。正向只认 committed ledger，公开 JSON 不得泄漏私有 transaction token。

## 4. Frozen 资产与可命令化验收

- `tests/_golden/support/canonical-case-lease.mjs`
- `tests/_golden/teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs`
- `tests/_golden/fixtures/teachin-observation-safe-case-lease-v2/identity-readback-receipt.signed.json`
- `tests/_golden/fixtures/teachin-observation-safe-case-lease-v2/trusted-driver-public-key.pem`
- `tests/_golden/fixtures/teachin-observation-safe-case-lease-v2/supersession.json`

验收命令：

- `node tests/_golden/teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs`

当前 production transaction/driver 行为已由旧 unsafe goldens 证明过，v2 首跑预计 coverage-green；若绿则如实记录 coverage-freeze，不伪造红。case lease support 是新安全机制，必须先用 support 自身的 preexisting/replacement/marker replacement 检查证明。

## 5. 可观察性申报

- cleanup 最后 identity/marker 对账与递归删除间的父目录 rename race，Node 缺跨 Windows/POSIX 统一 dirfd-relative remove，`route:human`。
- Windows 的 `O_NOFOLLOW`、目录/marker file identity、symlink 权限、atomic rename 与 lock/durability 须真机故障注入，`route:human`。
- 真实 driver 私钥保护、signed receipt 是否来自同一次 DOM/平台读回、nonce 持久防重放，`route:human`。
- 本门禁不启动 SUT、fake、server、browser 或 network；GREEN 不得外推为真机闭环，`route:human`。

## 6. 停止条件

v2 golden 实跑；冻结 support/golden/fixtures checksum；`gate --dry` 通过后独立 gate commit；随后运行 normal gate 写 `passes:true` 与 evidence 并独立 closure commit。旧两份 unsafe golden 不得再次执行，且所有 v2 lease 创建的目录都经 ownership 对账清理。
