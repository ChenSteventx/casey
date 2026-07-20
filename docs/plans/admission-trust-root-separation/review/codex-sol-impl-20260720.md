结论：不同意合入/进入 round-2。未发现可证明的 Critical；有 2 个 High、2 个 Medium。

## High

1. 冻结件写路径未迁移，生产 `sign` 会持续签出读侧必拒的无 `audience` 产物。

   - 读侧已将 `audience` 设为必填：[entity-semantic-lock-preflight.mjs:245](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:245)。
   - 但 `freezeEntityBindingsDraft` 的闭合入参不接受 `audience`：[entity-semantic-lock-preflight.mjs:665](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:665)。
   - 它生成的 artifact 也没有 `audience`：[entity-semantic-lock-preflight.mjs:734](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:734)。
   - `bin/sign.mjs` 调用时同样没有传受众：[sign.mjs:263](/mnt/d/ctx/heren/casey/bin/sign.mjs:263)。

   后果：任何新走正式签署流程生成的 `entity-locks.frozen.json`，都会被 `readIdentityAdmissionAuthorityFromPrd` 判 `IDENTITY_AUTHORITY_ARTIFACT_SCHEMA_INVALID`。这破坏签发→消费邻接面，也使“全走 sign/重签流程”不成立。

   实跑纯函数金牌：

   ```text
   node tests/_golden/teachin-entity-binding-sidecar-successor.zero-sut.golden.mjs
   exit 1
   FAIL S2 sign exact join... frozen locks 与人签 fixture 漂移
   FAIL S4 ... fixture 越界键 audience
   ```

   因此“12 个受影响 zero-SUT golden 全绿”证据不可复现。

2. `compile --execute` 用调用者旗标冒充凭据事实，且实际凭据加载发生在浏览器启动后。

   - 上下文直接由 `--skip-login` 派生：[compile.mjs:191](/mnt/d/ctx/heren/casey/bin/compile.mjs:191)。
   - `chromium.launch` 在前：[compile.mjs:225](/mnt/d/ctx/heren/casey/bin/compile.mjs:225)。
   - 真正的 `loadCreds()` 在浏览器启动后才执行：[compile.mjs:241](/mnt/d/ctx/heren/casey/bin/compile.mjs:241)。
   - 凭据缺失最终进入普通执行异常，退出码是 1，而非门要求的 65：[compile.mjs:252](/mnt/d/ctx/heren/casey/bin/compile.mjs:252)。

   反例：`production` 件、不带 `--skip-login`、但凭据缺失/非法。设计要求实际为 `test` 上下文，与 `production` 件不符，应在浏览器前 exit 65；当前实现把旗标解释成 `production`，门放行，启动浏览器后才发现无凭据。

   所以不同意“compile 同接缝同调”及“上下文非调用者旗标自报”。限定威胁中的“test 件 + 已成功加载真凭据”当前确实会被挡住，但完整的对称不变量和浏览器前 fail-closed 并未实现。

## Medium

3. 既有敌意夹具没有随必填字段迁移，防御金牌出现“因错误原因变绿”。

   这些用于验证未知顶层键、重复 binding、未知 binding 的夹具仍缺 `audience`：

   - [execute-authority.unknown.json:1](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/teachin-semantic-lock-admission-authority/execute-authority.unknown.json:1)
   - [entity-locks.duplicate.json:1](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/teachin-semantic-lock-admission-authority/entity-locks.duplicate.json:1)
   - [entity-locks.unknown-binding.json:1](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/teachin-semantic-lock-admission-authority/entity-locks.unknown-binding.json:1)

   它们现在先因“缺 audience”被拒，已不再证明各自声称的闭合结构/重复 binding 防御。虽然 admission-authority 金牌显示绿色，但验收点 8 的既有防御保持证据已经失真。

4. 冻结验收没有覆盖计划声明的关键接缝。

   当前新 golden 只覆盖纯门和一个无 audience frozen 件，未覆盖：

   - execute artifact 缺失/非法 `audience`
   - 篡改 `audience` 后签名失配
   - Proxy 入参
   - production 件 + 实际无凭据
   - replay/compile 的 exit 65 与无浏览器启动
   - 正式 `sign` 写路径

   尤其接线验收被放入 `route:human`，没有可执行证据，因此没有机会发现上述两个 High。

## 同意项

- 同意：读侧闭合 schema 已把 `audience` 设为必填枚举，且内容自哈希自然覆盖它。
- 同意：`checkCredentialAudienceGate` 的入参闭合、枚举校验和四态匹配本身成立。
- 同意：`replay.mjs` 是在 `loadCreds` 成功派生 `loginPrep` 后、`chromium.launch` 前调用门：[replay.mjs:259](/mnt/d/ctx/heren/casey/bin/replay.mjs:259)、[replay.mjs:277](/mnt/d/ctx/heren/casey/bin/replay.mjs:277)、[replay.mjs:356](/mnt/d/ctx/heren/casey/bin/replay.mjs:356)。
- 不同意：compile 接线、迁移零回归以及所附全绿门禁证据。
