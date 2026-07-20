# ADR-0010：准入受众 + 凭据上下文门（生产/测试信任根分离，第一步）

状态：已接受（Steven 2026-07-20 grill 定五决策）
关联：ADR-0004（冻结断言人签）、护栏 #7（凭据红线）、#14（fail-safe 不 fail-open）；CONTEXT「准入受众」「凭据上下文门」；契约 `admission-trust-root-separation`。

## 背景

semantic-lock 准入门（`lib/entity-semantic-lock-preflight.mjs:276-312` 铸权 + `checkReplayEntityAdmission`/`checkCompileIdentityAdmission` 消费）在回放/编译启动浏览器前，校验含 mutation 原子的 events/flow 携带合法冻结身份准入件。codex gpt-5.6-sol high 异构讨论（2026-07-19，`docs/plans/replay-admission-hermetic-migration/review/codex-sol-strategy-20260719.md`）+ 只读侦察坐实现役读路的信任根缺口：

- 唯一信任锚 = 工作树 `loop/prd-<prdId>.json` 里登记的 checksum——能写 prd + 放字节即得权；无 signerId 信任根/白名单、无「件出自 `bin/sign.mjs`」证明、无受众维度（`entity-semantic-lock-preflight.mjs:274-275` 自承发布根/撤销未补）。
- 「签名」是内容自哈希（`calculateIdentityAdmissionSignature`），非密钥签名——任意件可自称任意 `signerId`，signerId 不被认证。
- receipt「写强读弱」：sign 路真验（`:682`），但冻进 `entity-locks.frozen.json` 只剩 `receiptHash` 摘要，读路只校格式（`:178`）、从不复验内容（占位 `sha256:dddd…` 可过门）。
- 准入件绑 events 字节却不绑 `--sut`（`:765` 只哈希 events），且准入门（`replay.mjs:238`）严格早于读 `--sut`（`:248`）——同一把锁可回放到任意 `--sut`，含生产真机。
- 现实威胁（有界）：committed 测试夹具（`signerId:'fixture-human'`、模板化 `{{baseUrl}}`、mutation）被误指向真 SUT 授权真实改动。非「能改仓库的铁心攻击者伪造生产签名」（那已在信任边界内）。

## 决策

分五点（grill 决策树，Steven 2026-07-20 逐一拍）：

1. **定位=独立安全加固，非阶段二前置阻塞**。阶段二（hermetic 金牌生命周期重裁）主力走 zero-SUT（金牌喂冻结 axes 给纯裁判、不碰准入门、不需锁），故信任根缺口不阻塞阶段二 zero-SUT 主力；本契约修既有缺口 + 为「必须真机 UAT 仍碰准入门」的件建正确信任根，与阶段二并行。
2. **生产上下文按凭据门判，不按 `--sut` 地址**。hermetic（fake-sut localhost）与真机 UAT（隧道回环 `http://127.0.0.1:15519`）的 `--sut` 都是回环、按地址分不开；改按「是否加载真 `.auth`/走登录预备动作」判——威胁本质「测试锁改真 SUT」内在需真凭据。
3. **加签名进自哈希的 `audience: test|production` 字段**，防误用/泄漏这一有界威胁。铁心伪造者（改夹具重算自哈希）明确**不覆盖**——需密钥签名/signerId 认证，另立后续契约。
4. **`audience` 做必填字段**（非可选缺省）：每个准入件必显式声明受众、无隐式缺省歧义。代价=重签现存 5 个测试夹具为 `audience:'test'`（诚实标注，它们本就是测试件）+ 更新其 prd checksum + zero-SUT golden 断言（触 ADR-0004 冻结面人签）。
5. **凭据门严格匹配**：真凭据 run ↔ `production` 受众、无凭据 run ↔ `test` 受众，不符即 fail-closed 不启动浏览器。对称、fail-safe、现役零破坏（现存全 `test` 受众 + hermetic 无凭据），把「受众必须匹配运行上下文」立成不变量。

## 落法（承重接缝）

- 闭合 schema（`FROZEN_ARTIFACT_FIELDS:24-27`、`EXECUTE_ARTIFACT_FIELDS:20-23`）各加必填 `audience`；`validateFrozenArtifact`/`validateExecuteArtifact` 校 `audience ∈ {test,production}`；`calculateIdentityAdmissionSignature` 自然覆盖新字段。铸权时 `audience` 进 opaque handle 的 provenance。
- 新增纯函数 `凭据上下文门`（lib，zero-SUT 可测）：入 `{audience, credentialContext}`、出 allow/deny+reason。`bin/replay.mjs` 在凭据加载（`:259-262`）后、`chromium.launch`（`:343`）前调；`bin/compile.mjs --execute` 同接缝同调。凭据上下文由实际凭据加载派生（`loadCreds`/登录预备动作成立=生产），非调用者旗标自报。
- 反向验收（强制，红先行）：zero-SUT golden 证——`test` 受众件 + 生产凭据上下文 → deny；`production` 受众件 + 无凭据 → deny；匹配 → allow。
- 迁移：5 个 committed 夹具（`teachin-*` 系列）重签 `audience:'test'` + 更新各 prd（含 `capability-hardening` 那把被 6 successor prd 共注册的锁）checksum + 更新消费它们的 zero-SUT golden 断言。全走 sign/重签流程，人签收尾（ADR-0004）。

## 明确不覆盖（后续契约）

密钥签名/signerId 认证（现内容自哈希可伪造）；不可变发布 manifest 根（v2 `entity-semantic-lock-publications.mjs` 休眠空表、replay 准入未接入）；receipt 内容读路复验；撤销/CRL；锁绑 SUT/环境 scope。均为后续加固，本契约诚实划界。

## 后果

- 正面：测试夹具在真凭据 run 上 fail-closed，「测试锁改真 SUT」误用被机制阻断；受众成显式签名维度；现役已做对的防御（closedRecord/WeakMap opaque handle/分域互拒/checksum 绑定/签名自哈希/sign 侧真 receipt 强校）全保留不推翻。
- 代价：冻结面破坏有界（5 夹具 + 多 prd + zero-SUT golden 重签，触 ADR-0004 人签）；kernel 车道（改强制层 `entity-semantic-lock-preflight` + replay/compile 读路），须双设计审 + 异构冗余实现审 + round-2 + 人签。
- 残留：铁心伪造者与未认证真 SUT（不需登录即可 mutation）不覆盖，已划界记后续。
