# teachin-semantic-lock-capability-hardening — plan（full）

## 目标

本契约取代 `teachin-semantic-lock-v2` 当前仍由调用者直接提交锁字节、摘要和扫描结果的授权接缝。授权链必须由三件不可伪装的能力串起：固定 `PRD`/checksum reader（从仓库冻结契约读取校验和的固定读取器）产生锁集 authority，真实 `events.json` 文档把事件角色、候选和锁 authority 精确相连，runtime adapter（运行期适配器）产生不透明读回能力。普通对象、裸数组、调用者自报摘要和调用者自报扫描均只能拒绝，不能返回 `SAME`、`MISSING` 或 successor。

本轮只冻结零 `SUT` 的确定性安全契约；不写生产实现，不启动浏览器，不连接网络、真实 `SUT`、fake 或 fixture server。旧 `a7a49f2` 冻结文件保持逐字节不变。

## 交付接口

实现阶段新增或收窄以下接口；具体文件可由实现者保持在 `lib/entity-semantic-lock-v2.mjs`，但公开行为必须满足本契约：

1. `readFrozenEntityLockSetAuthority({contractId,lockSetKey})`
   - `contractId` 只用于确定性定位仓库内 `loop/prd-<contractId>.json`；`lockSetKey` 必须是该 PRD 的 `testChecksums` 精确键。
   - reader 自行读取锁集字节并按 PRD checksum 验证，返回不透明 authority；不接受 `prdPath`、`lockSetBytes`、`trustedSetSha256` 或调用者提供的 reader。
   - authority 的可见字段、展开副本或结构相同普通对象都不能替代原能力。
2. `verifyEntityLockSet({authority,caseId,eventsBytes})`
   - 只消费上述 reader 产生的 authority；旧的 `lockSetBytes + trustedSetSha256` 同传方式必须拒绝。
   - `eventsBytes` 必须是 schemaVersion 2 的真实 `events.json` 文档，不接受裸事件数组。
   - 每个受锁事件必须携带 `entityBindings[]`；其中 `role + candidate + lockAuthority.{lockId,receiptHash}` 必须与锁集 binding 精确一致，缺失、额外、重复或任一错配都拒绝。
3. `createEntityRuntimeAdapter({adapterId,read})` 与 `readEntityRuntimeCapability({adapter,binding,runContext})`
   - adapter 读取函数返回候选读回，但只有模块签发的不透明 runtime capability 可进入动作门。
   - `evaluateEntityAction({handle,binding,runtimeCapability})` 不再接受 `scan`、`complete`、`candidates` 或 `physicalId` 直传。
   - `SAME` 与 `MISSING` 只能由完整 runtime capability 得出；重复实际匹配不得按 `physicalId` 折叠，返回的 `candidateCount` 必须保留适配器本次实际匹配数。
4. `createRunSuccessorProof({handle,binding,transitionId,previousHeadHash,runtimeCapability})`
   - successor 只能消费同一 runtime adapter 签发、携带同一不透明 run context 的变更后读回能力。
   - 普通 `authoritativeReadback`、普通 `runId`、其它 adapter 或其它 run 的能力均拒绝；拒绝不得推进 active head。

## 四条 HIGH 信任边界

### H1 真实事件文档与三元绑定

- 合法固定 fixture 使用真实 `events.json` 顶层信封：`schemaVersion/channel/caseId/url/recordedAt/compiledBy/authored/events`。
- 事件的 `entityBindings` 同时声明业务角色、候选标识与锁 authority；锁集 binding 持有同一组值。
- 裸数组、无 `entityBindings`、角色错配、候选错配、`lockId` 错配、`receiptHash` 错配和重复 binding 全部验证失败。

### H2 运行期不透明能力与真实匹配数

- 调用者直接提交 `{complete,candidates}`，或把 `physicalId`/`complete` 塞进普通对象，不能得到 `SAME`/`MISSING`。
- 合法 runtime capability 的唯一完全匹配可得 `SAME + allowAction:true + candidateCount:1`；完整零匹配可得 `MISSING + candidateCount:0`。
- 两个实际匹配即使复制同一 `physicalId` 也不得折叠成一个；必须零动作并保留 `candidateCount:2`。不完整读回、adapter 抛错或伪造 capability 一律 `UNVERIFIED`。

### H3 successor 的同源读回与 run context

- 合法 successor 使用变更后 runtime capability 内的不透明读回 proof 和 run context，不接受字段等值的普通对象。
- 其它 adapter、其它 run、旧 runtime capability、普通 `authoritativeReadback + runId` 都不能建立 successor，且失败后原 head 仍可按原 runtime capability 授权。
- 合法 successor 链接当前 head；成功后旧 head 失效，只有同 run 的新 head proof 可继续。

### H4 PRD/checksum reader 是唯一锁 authority 来源

- reader 只认冻结 PRD 中登记的 `lockSetKey` 和实文件 checksum；未知 contract、未知键或 checksum 不符拒绝。
- verifier 不再暴露可由同一调用者同时提交锁字节与摘要的自签入口。
- authority 展开、序列化、复制、Proxy 包装或手工构造都不能通过 WeakMap/私有状态校验。

## 验收点

### 可命令化

1. `node tests/_golden/teachin-semantic-lock-capability-hardening.zero-sut.golden.mjs`
   - H1：真实事件文档和三元 binding 对齐；裸数组及六类错配拒绝。
   - H2：raw scan 拒绝；runtime capability 唯一/零/重复匹配与真实计数。
   - H3：successor 只认同源 runtime capability/run context，失败不推进 head。
   - H4：固定 PRD/checksum reader 签发不透明 authority，旧自签入口和能力副本拒绝。

### 可观察性申报

- route:human：真实 AI 中台 workflow/agent adapter 必须联网只读采样同记录的名称、编号、平台 ID、revision 与实际匹配数；每案录屏、视觉复核、独立 HTML 与附件。
- route:human：真实 `compile → sign → replay` 接线必须证明 `entityBindings` 来源、固定 PRD 路径、登录后 runtime adapter 和 mutation 前即时复核处在同一 run context。
- route:human：真实 rename/create 后 successor readback proof 的平台来源与跨运行重签入口。

## 停止条件

新 golden 与 fixture 真实红、sha256 冻结进独立 PRD、`gate --dry`、术语检查和 `git diff --check` 全通过后提交。本契约阶段不得修改 `lib/`、`bin/` 或 `a7a49f2` 的旧 plan/golden/fixture/PRD。
