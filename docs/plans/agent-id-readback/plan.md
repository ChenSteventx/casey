# agent-id-readback — plan（full，v4）

v1 经 sol max 判 CHANGES REQUIRED（review/sol-r1.log，三 P0）；v2 吸收后 R2 复审 5 过 4 败（review/sol-r2.log）；v3 修 R2 四点；v4 再修 R3 两点（观察件 signed/replayReady 入 source、范围化例外机器可判分类），R4 终判可进 accept：分页语义统一（R2-2）、观察件字段与 join 基数（R2-4）、差分面扩全（R2-6）、夹具治理二选一（R2-§6，Steven 拍板）。四分岔拍板见 GRILL.md。通道事实源：2026-07-22 真机尖峰（副本 `evidence/realmachine-spike-findings.md`）。

## 0. 术语与命名（sol P1-7）

沿用 CONTEXT 既有「身份观察」概念：编译期产物命名**身份观察件**，`artifactKind: 'compile-identity-observation'`（与示教录制侧 `identity-observations.json` 旁车同概念不同来源，`source.kind` 区分），文件名 `identity-observations.compile.json`。不另造同义词。

## 1. 信封捕获：请求级事务协议（sol P0-1，取代 v1「intent 窗口」）

新纯函数模块 `lib/agent-identity-observation.mjs`——**身份观察事务**：

- `arm({ intentId, generation, expectedQuery })`：fill 前武装；返回事务 token。
- 采集器在 `requestWillBeSent` 时刻冻结归属 `{ ownerIntentId, generation, requestSeq, queryEcho }`——归属绝不在 `loadingFinished` 读「当前 intent」；晚到 body 只能写回原 token，绝不进新事务。
- `settle(token)`：Enter 后、点击前等待本事务全部合格请求到达 body 解析**终态**（成功/失败/超时都是显式终态；`loadingFailed`、body 超时、解析失败≠空数组）。多响应按 request-start 序管理，不按完成序取「最近」。
- `seal(token)` → `consume(token)` 一次性消费；未决/冲突/超时/重复消费全部阻断。
- 有界投影冻结（sol P1-6）：解码后 body ≤256KiB、records ≤200 行、单字段 ≤256 字符，超限=invalid；路由按同源+method+规范化 pathname 精确匹配（禁子串）；`recordsPath`/`total` 路径显式配置；**整页任一坏行=整页 invalid**（禁过滤后判唯一——防注入坏行造假唯一）；`agentId` 必须无损字符串（JSON number 越过安全整数即拒，禁 `String(Number(id))`）；完整响应体仅瞬时内存解析、不进 `records()`/report、解析后释放——`identityRows` 走私有事务存储，不挂通用取证记录（防未来 spread 外泄）。
- 采集器扩展点仍在 `watchNetworkForensics` 的 `loadingFinished` 路径，但以独立回调注入（`onIdentityBody`），归因语义零动。

## 2. 双证门语义（sol P0-2/P0-3 修正表）

`lib/agent-identity-gate.mjs` 纯函数 `resolveDualIdentity({ domCard, envelope, expected })` 判定表（外部动作轴词表不扩）：

**完整性先决**（R2-2 统一口径）：信封集合必须先证完整——`totalPath` 取值合法且 `total === records.length`；若剖面声明了 `hasNextPath` 则其值必须严格 `false`。缺失、非法、大小不等、未声明路径一律 `action_failed`（**不是 ambiguous**）。所有元数据路径（`recordsPath`/`totalPath`/可选 `hasNextPath`）在剖面显式声明并进 identityProfileDigest。只有已证完整的集合内才谈同名计数。

| 条件 | 结果 | 点击 |
|---|---|---|
| 事务无合格请求 / HTTP·API 失败 / body 超时 / 解析·字段·ID·上限失败 / **完整性先决未过** / 响应冲突 | `action_failed` | 禁止 |
| 完整集合、名称命中 0 | `absent`（轴映射 none） | 禁止 |
| DOM 多卡 或 完整集合内 `sameName>1`（**先数同名，再查唯一行 code**——禁先按名+码过滤成一条） | `ambiguous` | 禁止 |
| 名称唯一但 期望 code / DOM 副标题 code / 信封 code / 已签 platformId 任一不等 | `action_failed` | 禁止 |
| DOM 同一物理卡片(name+code) 与 完整信封 与 已签期望 三方全等 | `unique` | 放行 |

- **码查询完整性缺口**（sol）：`code` 在场时现编译用码填搜索框，单行响应只能证「码唯一」证不了「名无分页同名」。修正：以 `openName` 做完整性查询取证（信封门数据源固定为名称查询），码只做唯一行联合判据。
- **DOM 侧 TOCTOU**（sol）：共享门升级为物理卡片句柄绑定——同一卡片读标题(name)+副标题(code)，点击前重验 connected/visible/name/code，句柄内点击（drawer-lock 同款纪律）。
- **回放闭环到点击前**（sol P0-2）：replay 消费冻结权威里的期望三元组（§4），实时信封+DOM 与已签 `platformId/code/name` 全等才点——「名称+ID 双定位」闭合到 click，而非只到 sign。

## 3. 义务声明：进签署件，剖面只作适配器（sol P0-3）

- flow 步（`agent.searchOpen`）新增显式 `identityChannel: 'agent-envelope-v1'` 声明；进入 execute 权威闭合绑定集的哈希面（flowSha256 已覆盖）。
- 冻结面 v2（§4）携身份通道 digest；**回放期缺剖面、digest 不符=浏览器前拒**。
- 旧版签署件（无 v2 字段）走既有路径（真旧件才允许 DOM-only）；新签一律 v2。剖面 `agents.listApi/identityFields` 只提供路由与字段名适配，不再决定门开关——换旧剖面无法降级新签用例。

## 4. 观察↔确认↔冻结的哈希闭环（sol P0-4）

- 身份观察件字段（R2-4/R3-1 闭合，`signed/replayReady` 随既有身份观察规范置于 `source` 内）：`{ schemaVersion: 1, artifactKind: 'compile-identity-observation', caseId, capturedAgainstBuild, identityProfileDigest, eventsSha256, source: { kind: 'compile-envelope', atom: 'agent.searchOpen', signed: false, replayReady: false }, observations: [{ kind:'agent', name, code, platformId, sourceIntentId, candidateId, role, atom, evidenceStepId, sourcePath }] }`。
- **join 基数裁定**（R2-4）：一个 `agent.searchOpen` flow 步投影 fill/press/click 多条 binding provenance——观察只 join **终端 click binding**（`evidenceStepId` = click 事件 stepId，`atom+action` 判定终端），fill/press bindings 不要求观察也不许携观察；对应关系确定性且逐案唯一，多余/缺失/错位=拒签。join 键 `{sourceIntentId,candidateId,role,atom,evidenceStepId}`。
- **三类错配必拒**（R2-4）：`capturedAgainstBuild !== --against-build`、identityProfileDigest 不符、eventsSha256 不符——任一即 exit 65。digest 闭合字段集与规范化算法在 accept 相冻结；v1/v2 只按 `schemaVersion` 判别，禁按字段缺席猜版本（R2-3 附带）。
- `entity-bindings-draft` v2：新增观察件原始字节 sha256 绑定；`entity-locks-frozen` v2：保留观察 hash + identityProfileDigest + **期望三元组**（供回放 opaque authority 消费做 click 前比对）+ events 原始字节 sha（既有）。v1 件走既有校验路径不动。
- sign：v2 draft 在场即强制要求观察件（由 atom+role policy 驱动，不由旗标缺省/观察件内容/receipt 自报 kind 激活——sol 绕过面全封）；`--entity-observations` 进 `sign-cli-args.mjs` 白名单 + help + MCP schema 同步（sol P1-8）。校验失败 exit 65 零输出。
- 伪造威胁边界如实声明：内容自哈希防误配/换件/陈旧复用，不防有写权限者整链重算（ADR-0010 既有口径），密钥签名不在本契约（诚实挂账，不宣称已解决）。

## 5. 编译/回放接线

- `compileAgentSearchOpen`：fill 前 arm → Enter 后 settle → DOM 物理卡片双锚门 → 双证判定 → 非 unique 硬阻断（blockers、不落步）→ unique 落身份观察件 + compile-report 只记 `{状态, 数量, 观察件 sha}`（不复制三元组，sol P1）。产物清场面把观察件纳入既有 gatedWrite/清场集合（compile.mjs 清场清单 +1）。
- `bin/replay.mjs`：v2 锁在场时装配期望三元组进 ctx；`doAgentSearchOpen` 同门同判（含已签比对）。
- 事件 schema 零动；axes 词表零动。

## 6. 夹具与机器门（sol P0-5 治理修正）

- 机器门分层：①事务/判定门纯函数金牌（零 SUT、mock 采集序列，含 sol 三攻击用例：晚 body 跨 intent 污染 / 降级绕过（旧剖面+缺观察件+空 kind）/ 码查询+分页假唯一）；②sign/schema 差分金牌（零 SUT）；③chat-sut 浏览器行为金牌——**Steven 2026-07-22 拍板范围化例外**（R2-§6 二选一取例外；同 entity-ui-wiring 先例）。机器可执行的一致分类（R3-2）：例外只覆盖**新增非隔离义务**——新浏览器金牌**不入** `isolated-browser-obligations.json` 冻结闭集（该闭集与闭合金牌零改动、继续绿），以新义务身份进本契约 prd acceptance，例外及范围（本契约新增五场景金牌 + §7-6 存量浏览器回归两金牌按其 owner prd 既有裁定原样复跑）落盘 GRILL + prd observability；隔离账内既有义务零触碰、绝不解禁。**完成闸仍=真机**（ADR-0009），金牌只证 hermetic 配方；SKILL.md/HANDOFF 全局条文与例外实践的措辞统一另挂账 route:human 由 Steven 处理（不阻塞本契约——本契约的金牌分类已由上述闭集边界机器可判）。
- chat-sut 新场景（纯加法、既有场景 byte-identical）：搜索走 fetch 的 `idhappy / idtwins-hidden / idcode-mismatch / idmissing / idpaged`（`total=2` 单页一行）。
- 存量零回归证明（sol P0-6，R2-6 扩全）：82484ab 差分棘轮金牌——固定 clock/`signedAt`/uniqueName/mock 采集序列下，未声明路径逐字对照：①CDP listener 注册与 `send` 调用序列；②`records()`/动作轴/events/report 的 JSON 字节；③CLI exit/stdout/stderr 三流；④**完整输出文件集合 + 逐文件 sha256**；⑤poison spy 证身份解析器/事务模块未被触达。不以「旧金牌仍绿」替代、不 normalize 后冒充 byte-identical。
- 存量回归金牌逐项分类（R2-6）：zero-SUT 者（bindagent-lockchain、guards、entity-binding 系）进机器 acceptance；启动浏览器者（searchopen、bindagent-replay）按 §6 治理裁定归类，不整体笼统列跑。

## 7. 验收点（accept 相冻结，红先行）

1. `agent-id-observation.zero-sut.golden.mjs`：事务协议单元攻击（arm/settle/seal/consume、晚 body 回原 token、终态显式、上限与坏行整页拒、ID 无损）。
2. `agent-id-gate.zero-sut.golden.mjs`：判定表全分支 + sol 三攻击用例。
3. `agent-id-sign-observation.zero-sut.golden.mjs`：v2 join/哈希闭环/绕过面（缺件、空 kind、错 provenance、陈旧观察件复用、v1 兼容）。
4. `agent-id-regression-diff.zero-sut.golden.mjs`：82484ab 差分棘轮 + poison spy。
5. `agent-id-readback.chat-sut.golden.mjs`：五场景浏览器配方（hermetic 先例层；完成闸仍真机）。
6. 存量回归：entity-ui-wiring 四金牌、lockchain、tier1。

## 8. 观察义务

- machine：真机只读实证脚本（活数据跑判定纯函数，证据入 evidence/）。
- route:human：完整真机用例链（执行权威→签署消费观察件→回放点击前比对）；SKILL.md 执行边界条文与夹具金牌实践的口径收口；密钥签名威胁面后续契约。

## 9. 评审

本 v2 送 sol max 复审（R2），共识后进 accept；实现后 codex 评审。
