# teachin-semantic-lock-wiring — plan（full）

目标：把已交付的业务对象语义锁纯函数内核接入 `record → distill → compile → sign → replay` 全链；未签观察和候选永远不能直通回放，只有绑定真实 events、人签并在当前页面重验为 `SAME` 的对象才允许业务动作。

## 1. 产物与哈希链

新增 `lib/entity-semantic-lock-artifacts.mjs` 管理确定性旁车：

- `createIdentityObservationSidecar` 只接受最小白名单观察，强制 `signed:false`、`replayReady:false`，绑定 `caseId + captureSha256` 并生成旁车 sha256。
- `distillIdentityCandidates` 联合校验 capture/观察旁车，按 event 证据形成 identity candidates 与 `pending`；证不出的观察必须进 `pending`，不能丢弃。
- `buildEntityLocksDraft` 接受真实 events 原始字节，计算 `eventsSha256`，生成 `entity-locks.draft.json`；每个候选绑定 `{stepId,intentId,atom,role}`，并保留原始 `intentId`。
- `freezeEntityLocks` 只接受用户确认或平台权威读回的身份，签发 `entity-locks.frozen.json`；冻结产物含签署元数据、完整 events hash、身份收据与对象角色绑定。
- 所有旁车都使用闭合 schema、确定性 canonical JSON 和凭据门；URL、query、header、Cookie、token、原始响应体和请求载荷均不得进入身份产物。

## 2. 五阶段接线

- `bin/record.mjs` 在页面仍存活时采集观察，关窗后只收口旁车；capture manifest 引用 `identity-observations.json` 的文件名、sha256 和数量。
- `bin/distill.mjs` 消费已入账 capture 及观察旁车，写 identity candidates 与 `pending`，不写 frozen、不置 replay-ready。
- `bin/compile.mjs` 在 events 落定后写 `entity-locks.draft.json`，并拒绝缺 `stepId/intentId/atom/role` 的对象映射。
- `bin/sign.mjs` 联合签 assertion 与身份锁；events 字节或任一 binding 改变后旧 frozen 立即失效。
- `bin/replay.mjs` 在任何 `chromium.launch` 之前调用结构/hash/签名/覆盖门；门不绿则零浏览器、零业务动作。

## 3. 回放重绑定与动作门

新增 `lib/entity-semantic-lock-runtime.mjs`：

- `preflightFrozenEntityLocks` 在浏览器前验证 caseId、artifactKind、签署状态、签名、eventsSha256、receipt hash 和全部角色覆盖，失败返回 `allowBrowserLaunch:false`。
- `rebindEntityLocksAfterLogin` 登录后只读获取当前候选；只有 `SAME` 建立临时句柄绑定，非 `SAME` 返回闭合 `reason + nextAction`。
- `authorizeLockedAction` 在 mutation、关系写、删除触发与删除确认前重新获取当前候选并比较，不复用旧比较结果。
- 关系写要求同一步的 `source + target` 两个角色均为 `SAME`；任一失败，整体 `allowAction:false`、`clickCount:0`。
- runtime 只授权或拒绝动作，不写 verdict、不把拒绝洗成 PASS。

## 4. 弱 agent 硬化与兜底

- 缺观察旁车、hash 不符、缺 binding、重复角色、签名不成立、0/N 候选、对象变化和平台 ID 变化均 fail-closed。
- 非 `SAME` 必带结构化 `reason + nextAction`，自然语言层据此要求用户提供准确编号、确认并重签、重新示教或取消。
- 禁止 `.first()`、`nth()`、名称单锚、输入值冒充平台读回、由名称猜编号、旧句柄跨 mutation 复用和自动放宽 revision。
- LLM/视觉建议只进 candidate/pending，不得成为 frozen receipt 的 authority。

## 5. 验收点

### 可命令化

1. `tests/_golden/teachin-semantic-lock-artifacts.zero-sut.golden.mjs`：冻结未签观察、distill candidates/pending、draft events hash/intent/role、人签 frozen 与篡改拒绝。
2. `tests/_golden/teachin-semantic-lock-runtime.zero-sut.golden.mjs`：冻结浏览器前硬门、登录后重绑定、mutation 前重验、非 SAME 零点击和关系双端锁。
3. `tests/_golden/teachin-semantic-lock-cli-wiring.zero-sut.golden.mjs`：静态冻结五个 bin 的调用顺序与禁止直通不变量；只读源码，不启动进程或浏览器。

### 可观察性申报

- workflow/agent adapter 在真实 AI 中台读取同记录 name+code+platformId，以及五类 SAME/改名/编号冲突/删除重建/重复候选行为：`route:human`，必须联网真机、录像和视觉复核。
- 手录关窗前观察是否覆盖真实对象、关系 source/target 是否识别正确：`route:human`，必须逐 case 人签。
- 其它业务对象是否存在稳定 code/platformId/parent/revision：`route:human` 只读 spike；未证明前保持 `UNVERIFIED`。

## 6. 停止条件

本 acceptance-gate 工序只在三份新验收测试都真实红、sha256 已冻结、PRD 可被 `gate --dry` 消费并提交后结束。不得实现功能，不得运行或连接任何 SUT。
