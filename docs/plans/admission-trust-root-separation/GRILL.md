# GRILL — admission-trust-root-separation（阶段一：生产/测试信任根分离）

> 契约 lane=full（kernel 车道，触强制层 `entity-semantic-lock-preflight` + replay/compile 读路）。grill 决策树逐支已走完（Steven 2026-07-20 五决策全拍），决策晶化进 ADR-0010 + CONTEXT（准入受众/凭据上下文门）。本文记决策树与事实底座，供 plan 阶段直接接手。

## 事实底座（grounding 代理只读侦察，file:line 承重）

- 唯一信任锚 = 工作树 `loop/prd-<prdId>.json` checksum（`entity-semantic-lock-preflight.mjs:289-297`）；无 signerId 白名单/无「出自 sign.mjs」证明/无 audience（closed schema `:20-27`）；自承缺口注释 `:274-275`。
- 「签名」= 内容自哈希 `calculateIdentityAdmissionSignature`（`:209-217`），非密钥签名；signerId 仅 `nonEmpty` 校验、不认证。
- receipt 写强读弱：sign 路真验 `verifyEntityLockReceipt`（`:682`），读路只校 `receiptHash` 格式（`inspectBindings:178`）、从不复验；占位 `sha256:dddd…` 过门（admission-authority 夹具实证）。
- 锁绑 events 字节不绑 `--sut`（`checkReplayEntityAdmission:765`）；准入门 `replay.mjs:238` 早于读 `--sut :248`；`{{baseUrl}}` 回填在准入后、锁字段外（`:250-253`）。
- 凭据加载 `replay.mjs:259-262`（`--login-bootstrap` 触发 `loadCreds`/`loadSiteConfig`）在准入门后、`chromium.launch :343` 前——新门天然插入点。
- 无撤销机制；v2 有休眠发布 manifest（`entity-semantic-lock-publications.mjs` 空表 route:human）但 replay 准入未接入。
- 现存 5 committed 夹具（`teachin-entity-binding-sidecar-successor` / `teachin-semantic-lock-admission-authority` 的 frozen+execute / `teachin-semantic-lock-capability-hardening`（被 6 successor prd 共注册）/ `teachin-semantic-lock-v2`），signerId 全 `fixture-human`、全无 audience；消费者是 `*.zero-sut.golden.mjs`（纯函数、不启动 SUT，SKILL.md:107 下可跑）。
- 已做对的防御（设计不推翻）：`closedRecord`/`closedArray` 闭合、WeakMap opaque handle、execute/verify 分域互拒、prd checksum 绑定、路径规范化闭合、签名自哈希、`exactBindingSet`、sign 侧真 receipt 强校、prd-last 事务。

## 决策树（五支，全定）

1. `Q1` **契约定位**：独立安全加固、非阶段二前置阻塞（阶段二 zero-SUT 主力不碰准入门/不需锁）。→ 本契约与阶段二并行，修既有缺口 + 为「必须真机 UAT 仍碰准入门」的件建正确信任根。
2. `Q2` **生产上下文判据**：凭据门判（加载真 `.auth`/登录预备动作=生产），不按 `--sut` 地址（hermetic 与真机 UAT 都回环）。
3. `Q3` **威胁模型边界**：防误用/泄漏（测试件被误指真 SUT），加签名进自哈希的 `audience` 字段。铁心伪造者（改夹具重算自哈希）不覆盖、需密钥签名另立。
4. `Q4` **准入受众落法**：`audience` 必填字段（非可选缺省），每件显式声明；重签 5 夹具为 `audience:'test'` + prd checksum + zero-SUT golden 断言（ADR-0004 人签）。
5. `Q5` **凭据门方向**：严格匹配（真凭据↔production、无凭据↔test，不符 fail-closed），把「受众必须匹配运行上下文」立成不变量。

## plan 阶段接手要点

- 改面（kernel）：`lib/entity-semantic-lock-preflight.mjs`（schema 加 `audience` 必填 + validate 校验 + 铸权带 audience 进 provenance）；新纯函数 `凭据上下文门`（lib，入 `{audience,credentialContext}` 出 allow/deny+reason）；`bin/replay.mjs`（`:262` 后 `:343` 前调门）；`bin/compile.mjs --execute`（同接缝）。
- 红先行：zero-SUT golden 证凭据门三态（test+生产凭据→deny / production+无凭据→deny / 匹配→allow）+ 现存 5 夹具重签后仍过其 zero-SUT golden。
- 迁移：5 夹具重签 `audience:'test'`（走 sign 流程）+ 更新 prd checksum（注意 capability-hardening 锁被 6 prd 共注册、一次波及）+ 更新 golden 断言。
- 明确不覆盖（ADR-0010 划界）：密钥签名/signerId 认证、不可变发布 manifest 根、receipt 读路复验、撤销、SUT/环境绑定。
- 车道纪律：kernel 全流水线——双设计审 + 异构冗余实现审（codex，评审家族≠实现家族）+ round-2 + 全仓门禁 + 人签（改冻结面 ADR-0004）。
