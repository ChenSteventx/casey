# plan — admission-trust-root-separation（阶段一：生产/测试信任根分离）

> 契约 lane=full（kernel 车道）。设计源 = 同目录 `GRILL.md` + `docs/adr/0010-admission-audience-credential-gate.md`（五决策）。本文把设计落成可执行计划 + 红先行验收点，供 acceptance-gate 冻结。

## 目标（一句话）

给冻结身份准入件加签名进自哈希的必填 `audience` 字段（准入受众），并在准入铸权后、启动浏览器前插入纯函数**凭据上下文门**：真凭据 run 只放行 `production` 受众件、无凭据 run 只放行 `test` 受众件，不符 fail-closed 不启动浏览器——机制阻断「测试锁被误指向真 SUT 授权真实改动」。

## 范围 / 不覆盖

- 范围：schema 加 `audience` 必填 + 校验 + 铸权带受众进 handle provenance；新纯函数凭据上下文门；`bin/replay.mjs` 与 `bin/compile.mjs --execute` 接线；现存 5 夹具重签迁移。
- 明确不覆盖（ADR-0010 划界，各另立后续契约）：密钥签名 / signerId 认证；不可变发布 manifest 根；receipt 内容读路复验；撤销 / CRL；锁绑 SUT 或环境 scope。

## 改面（kernel，承重接缝）

1. **闭合结构加校验**（`lib/entity-semantic-lock-preflight.mjs`）：`FROZEN_ARTIFACT_FIELDS`（:24-27）与 `EXECUTE_ARTIFACT_FIELDS`（:20-23）各加 `audience` 到 allowed+required；`validateFrozenArtifact`（:242-257）与 `validateExecuteArtifact`（:224-240）校 `audience ∈ {test, production}`；`calculateIdentityAdmissionSignature`（:209-217）自然覆盖新字段（无须改，剔除的只有 `signature` 键）。铸权 `mintAuthority`（:268-272）把 `audience` 记进 provenance。
2. **凭据上下文门纯函数**（`lib/` 新件或 preflight 内导出，zero-SUT 可测）：签名 `checkCredentialAudienceGate({ audience, credentialContext })` → `{ ok, reason, nextAction }`（对齐现役 `denied`/`allowed` 形态）。规则（严格匹配）：`credentialContext==='production' && audience!=='production'` → deny；`credentialContext==='test' && audience!=='test'` → deny；匹配 → allow。入参闭合（`closedRecord`）、`audience`/`credentialContext` 枚举校验，畸形 fail-closed。
3. **接线**（`bin/replay.mjs`）：凭据加载（:259-262，`--login-bootstrap` 触发 `loadCreds`/`loadSiteConfig`）后派生 `credentialContext`（真凭据加载成立=`production`、否则 `test`——由实际加载结果派生，非旗标自报）；在 `chromium.launch`（:343）**前**取 handle 的 `audience`（经准入铸权带出）调门，deny 则打印拒因 + exit 65 + 不启动浏览器。`bin/compile.mjs --execute` 同接缝同调（其执行段亦驱浏览器 mutation）。
4. **迁移**（5 committed 夹具）：`teachin-entity-binding-sidecar-successor` / `teachin-semantic-lock-admission-authority`（frozen+execute）/ `teachin-semantic-lock-capability-hardening`（被 6 successor prd 共注册）/ `teachin-semantic-lock-v2` 各加 `audience:'test'` 重算自哈希签名 → 更新各 prd `testChecksums`（capability-hardening 一次波及 6 prd）→ 更新消费它们的 `*.zero-sut.golden.mjs` 断言。走 sign/重签流程，人签收尾（ADR-0004）。

## 验收点（红先行，全过才算完）

1. **必填校验**：缺 `audience` 或 `audience ∉ {test,production}` 的准入件经 `validateFrozenArtifact`/`validateExecuteArtifact` 返回 null（拒），带合法 `audience` 过。
2. **签名覆盖受众**：篡改已签件的 `audience`（不重算签名）→ 签名自校失配 → 拒（证 `audience` 进自哈希、不可脱签改）。
3. **凭据上下文门三态**（纯函数，zero-SUT）：`test` 受众 + `production` 上下文 → deny；`production` 受众 + `test` 上下文 → deny；受众与上下文匹配 → allow。畸形入参（缺字段/非枚举值/Proxy）fail-closed。
4. **反向验收（核心安全属性，红先行）**：现存测试夹具（迁移后 `audience:'test'`）+ 模拟 `production` 凭据上下文 → 门 deny——证「测试锁在真凭据 run 上被机制阻断」。
5. **接线 fail-closed**：`bin/replay.mjs`/`bin/compile.mjs --execute` 在凭据上下文与受众不符时，于 `chromium.launch` 前 exit 65、不启动浏览器（断言退出码 + 无浏览器启动证据）。
6. **铸权带受众**：`readIdentityAdmissionAuthorityFromPrd` 铸出的 handle，其 provenance 携 `audience`，凭据门可据此判（不另信调用者传值）。
7. **迁移零回归**：5 夹具重签 `audience:'test'` 后，消费它们的 `*.zero-sut.golden.mjs` 全绿；各 prd checksum 与实际字节一致；全仓 ratchet 除既有 4 处无关漂移外零新增。
8. **既有防御不破**：`closedRecord`/`closedArray`/WeakMap opaque handle/execute-verify 分域互拒/prd checksum 绑定/路径规范化/签名自哈希/`exactBindingSet`/sign 侧真 receipt 强校 的现有 zero-SUT 断言全保持绿（加 `audience` 不推翻任何一条）。

## 红先行编排

验收 1/2/3/4/6 落一个新 zero-SUT golden（`tests/_golden/admission-audience-credential-gate.zero-sut.golden.mjs`）：实现前逐条验红（schema 未加字段 → 验收 1 合法件被拒或非法件误过；门未建 → 验收 3/4 import 失败红）。验收 5 接线用现有 replay/compile 金牌形态的 zero-SUT 桩或子进程退出码断言。验收 7/8 = 迁移后复跑现存 5 夹具的 zero-SUT golden + ratchet。`contract advance accept --red-verified` 后才动 kernel 字节。

## 实现发现（loop 期，承重）

`audience` 是 **preflight 冻结件 schema**（`validateFrozenArtifact`/`validateExecuteArtifact`）的字段——只该加到经 preflight 读路（`readIdentityAdmissionAuthorityFromPrd`）消费的夹具。`teachin-*` 夹具跨两条校验路：`preflight` 读路（admission-authority 的 entity-locks+execute-authority、sidecar-successor 的 entity-locks，各由 `readIdentityAdmissionAuthorityFromPrd` 消费）**加 audience**；`v2` 授权链（capability-hardening、semantic-lock-v2 的 entity-locks，由 `lib/entity-semantic-lock-v2.mjs` 的 `ENTITY_LOCK_SET` 校验消费，有独立闭合结构、不认 audience）**不加**——误加会让 v2 校验判 `ENTITY_LOCK_SET_INVALID`。迁移前必按「消费 golden 调 preflight reader 还是 v2 verify」判每个夹具的路，别按目录名一刀切。实际迁移面 = 3 个 preflight 夹具（admission-authority ×2 + sidecar），非侦察初列的 5 个。

## 冻结治理 / 车道纪律

- 冻结面：新 golden 冻进本契约 prd；5 夹具重签 + 其 prd checksum 更新 + 各 zero-SUT golden 断言更新，全走 `bin/sign.mjs`/重签流程，改冻结断言人签（ADR-0004）。
- kernel 全流水线：双设计审 + 异构冗余实现审（codex，评审家族≠实现家族，只喂 spec+diff+证据）+ round-2 + 全仓门禁 + 人签。触强制层 `entity-semantic-lock-preflight` + replay/compile 读路。
- 不必 worktree（单契约顺序落地）；但改 lib/bin 须主树复验受影响面（护栏 #19）。
