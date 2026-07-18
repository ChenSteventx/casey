# plan：cli-authority-wiring-fill

契约 lane=full。目标：让被 trust-root 迁移（提交 `1e6c3c5`）废止的两块旧规格金牌对齐现役模型，并补 `bin/intake.mjs` 与 observation 现役金牌不冲突的真接线缺口。grill 决策见同目录 `grill.md`（Steven 2026-07-18 裁定「对齐现役模型」）。

## 业务流程与逻辑

现役 trust-root 模型：示教入账（intake）唯一成功路径是权威内核 `appendAcceptedObservationPackage` 的固定路径 signed append transaction——capture 必须精确落在 `<PROJECT_ROOT>/cases/<caseId>/record-capture/teach-in-capture.json`，且同级须有完整三件套（capture、`identity-observations.json` 旁车、`teach-in-package.json` 清单）加 signed driver readback receipt。蒸馏（distill）以 `rehydrateAcceptedObservationTransaction` 跨进程重铸不透明 pair，禁 `verifyIntakenPackage`（该函数已下移进权威内核）。

本契约不改这套内核语义，只做两件事：

1. 重写两块旧金牌，让规格对齐上述现役行为。
2. 给 `bin/intake.mjs` 补命令行层三件套预检——现役 intake 直接把 capturePath 交给权威内核，命令行层没有自己的三件套派生+校验；补上它（对齐 `bin/distill.mjs` 的消费方式），使命令行层先以人话报错拒不完整/被换的三件套，再委托权威内核落 committed 事务。这是纵深防御，与 observation 金牌要求的「intake 用 `appendAcceptedObservationPackage`、不用 `appendIntakeLedger`」不冲突。

### 金牌重写逻辑

- `teachin-semantic-lock-intake-joint.zero-sut.golden.mjs`（零 SUT 静态源码断言）：
  - distill 侧：去掉与 trust-root 互斥的「distill 必含 `verifyIntakenPackage`」断言；改断言 distill 含 `deriveTeachInPackagePaths`、`verifyTeachInPackage`、`rehydrateAcceptedObservationTransaction`，且不含 `verifyIntakenPackage`，并绑 `currentCaptureSha256`/`currentSidecarSha256`/`currentManifestSha256`——与 observation 金牌 L92-93 同口径。
  - intake 侧：保留三件套真接线断言（含 `deriveTeachInPackagePaths({ capturePath })`、`readFileSync` 读 manifest/sidecar 原始字节、accepted 台账联合绑五字段），补断言 intake 用 `appendAcceptedObservationPackage`、不用 `appendIntakeLedger`，不接受任意 manifest/sidecar 路径参数。
- `record-intake.golden.mjs`（跑真命令行、hermetic、无浏览器/网络/fake/fixture）：重写为 trust-root 固定根 canonical 路径契约——命令行门面参数校验（缺参 64、caseId 形状/凭据关键词 65）、非规范布局拒、命令行层三件套预检对缺件以人话报错拒（点名缺失旁车、退出码 65、零台账残留、零凭据、零裸协议前缀）。旧模型的 tmpdir happy 路径与八条 reviewCapture 拒账台账逐条断言退役——这些已被现役 observation 金牌以固定根 + 完整签名三件套的跨进程 happy/off-root/拒账全套覆盖。

### 实现逻辑（只动 bin/intake.mjs 与必要 lib 胶）

`bin/intake.mjs` 补三件套预检，结构对齐 `bin/distill.mjs`：门面校验 → 规范布局与软链硬化 → `deriveTeachInPackagePaths({ capturePath })` → `readFileSync` 读三份原始字节（缺件人话报错、退出码 65）→ `verifyTeachInPackage` 联合闸（拒则 65）→ 取五字段事实 → `appendAcceptedObservationPackage` 落 committed 事务 → 以权威句柄事实交叉核对命令行层三件套事实（防 TOCTOU 换包）。退出码 64（用法）/65（数据/规格），凭据零出现，路径不回显。权威内核 `lib/teachin-observation-authority-root.mjs`、判别内核 entity-semantic-lock-v2 零触碰。

## 验收

- s1 intake 三件套接线：`node tests/_golden/teachin-semantic-lock-intake-joint.zero-sut.golden.mjs` exit 0。红先行：重写后、实现接线前该金牌红（intake 源码缺三件套 token）。
- s2 record-intake 对齐：`node tests/_golden/record-intake.golden.mjs` exit 0。红先行：重写后、实现接线前该金牌红（命令行层三件套预检未接线，缺件仍走权威内核 `CAPTURE_PATH_NOT_CANONICAL` 而非点名旁车）。
- s3 零回归：以下现役绿金牌与 tier1 实现后仍全绿——
  - `node tests/_golden/observation-cli-authority-wiring.zero-sut.golden.mjs`
  - `node tests/_golden/observation-identity-contract-closure.zero-sut.golden.mjs`
  - `node tests/_golden/observation-temp-commit-integrity.zero-sut.golden.mjs`
  - `node tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs`
  - `node tests/_golden/observation-active-suite-supersession.zero-sut.golden.mjs`
  - `node tests/_golden/teachin-semantic-lock-package-integrity.zero-sut.golden.mjs`
  - `node bin/casey.mjs selftest --tier1`

验收测试字节由 `loop/prd-cli-authority-wiring-fill.json` 的 testChecksums 冻结；passes 只由 `loop-kit/bin/gate.mjs` 写入。

注：observation 全套依赖 gitignored 的 `cases/` 目录存在（本 worktree 已补建，不进提交）。旧模型残留的其它陈旧红金牌（`record-distill`、`cli-mcp-face` 的 intake happy、`teachin-observation-authority-*`、`teachin-observation-safe-case-lease-v2`）同源于固定根迁移，超本契约两金牌范围、不在本契约处置，如实挂账。
