# accept 接口规格（冻结给验收金牌作者的共同事实源；实现必须迎合本规格）

> 本文只钉「验收测试消费的公开面签名与语义」；实现前全部缺席（红先行）。语义细节以 plan.md v4 为准，本文冲突处以 plan 为准。

## 1. `lib/agent-identity-observation.mjs`（身份观察事务，纯逻辑+可注入时钟）

```js
export function createIdentityObservationLedger({ channel }) // channel = 冻结的通道配置（见 §3）
// 返回 ledger：
//   ledger.arm({ intentId, generation, expectedQuery })  -> token（不透明对象）
//   ledger.onRequestWillBeSent({ requestSeq, method, urlPathname, urlOrigin, queryEcho }) -> void
//     归属在此刻冻结到「当前已 arm 未 seal 的 token」；无 armed token 的请求不入账；
//     armed.expectedQuery 非空时 queryEcho 必须严格相等，异查询请求不入账（修单 R1-H2）
//   ledger.onBodyTerminal({ requestSeq, outcome })       -> void
//     outcome = { kind: 'parsed', rows, total, hasNext? } | { kind: 'failed'|'timeout'|'invalid' }
//     晚到 terminal 只写回该 requestSeq 归属的原 token；token 已 seal 则丢弃并记 lateDrops
//   ledger.settle(token, { timeoutMs?, timer? }) -> Promise<void>（等 token 内全部请求到终态；
//     timeoutMs 到点把未决请求显式写 timeout 终态再放行——有界在账本内兑现，timer 可注入（修单 R1-M1）；
//     不传 timeoutMs 维持无界等待（协议单元探针语义））
//   ledger.seal(token)   -> void（封存；此后归属新请求不入本 token）
//   ledger.consume(token) -> { status: 'ok', rows, total } | { status: 'invalid'|'conflict'|'unsettled'|'empty'|'consumed'|'unsealed' }
//     未 seal 即 consume -> 'unsealed'（协议序 arm→settle→seal→consume 机器强制，修单 R1-M1）
//     一次性；重复 consume -> 'consumed'；多响应按 requestSeq 序取最后一个完整终态，冲突（两响应 rows 不一致）-> 'conflict'
```

有界投影在 `onBodyTerminal` 前由采集侧完成；ledger 收到的 rows 已是 `[{ id, code, name }]` 投影。ledger 自身仍复验：行数 ≤200、字段皆非空 string、`id` 全数字 string；违规=该响应 `invalid`（整页拒）。

## 2. `lib/agent-identity-gate.mjs`（双证判定，纯函数）

```js
export function resolveDualIdentity({ dom, envelope, expected })
// dom      = { status: 'unique'|'ambiguous'|'absent'|'failed', name?, code? }（物理卡片双锚读数）
// envelope = consume() 的返回值原样
// expected = { openName, code?, signedPlatformId?, signedCode?, signedName? }（已签期望，可缺=编译首采）
// 返回 { resolution: 'unique'|'ambiguous'|'absent'|'action_failed', reason, matched? }
```

判定顺序（plan §2 表）：信封完整性先决（envelope.status!=='ok' → action_failed）→ DOM failed → action_failed → 完整集合同名计数（>1 → ambiguous；配合 dom ambiguous 同）→ 命中 0 → absent → 唯一行联合判据（expected.code、dom.code、信封 code、signedPlatformId 任一不等 → action_failed）→ 全等 → unique + matched 三元组。
修单 R1-H1：dom.code 缺席/空串 = 证据不齐 → action_failed（缺码不是豁免；DOM 双锚必须从同一物理卡片读出，接线面见 §3 cardFields 与 lib/agent-search-gate.mjs 的 resolveAgentCardTarget/clickAgentCardWithin——点击必须落在检查过的同一句柄内）。

## 3. 通道配置与剖面

profile 新增（形状校验非法 fail-closed）：
```json
"agents": { "itemContainer": ".agent-card", "cardFields": { "name": ".agent-card__name", "code": ".agent-card__code" }, "listApi": { "pathname": "/api/agents/query", "method": "GET", "queryParam": "nameLike", "recordsPath": "data.records", "totalPath": "data.total", "hasNextPath": null, "fields": { "id": "agentId", "code": "agentCode", "name": "agentName" } } }
```
`identityProfileDigest` = sha256(canonical-JSON of listApi 闭合对象)，前缀 `sha256:`。
修单增补：`listApi.queryParam` 必填（查询回声提取参数名，进 digest 域，R1-H2）；声明 `listApi` 即必须同时声明 `itemContainer` 与 `cardFields.name/code`（物理卡片双锚采集面，R1-H1），缺一 fail-closed；采集侧准入=同源（--sut origin 精确等）+ method + 规范化 pathname 精确等 + queryParam 回声（R1-H2），HTTP 只认 2xx 且 successField 在场必须严格等于 successValue（R1-H4）——纯函数面 `matchIdentityRequest`/`projectIdentityEnvelope` 由 lib/replay-forensics.mjs 导出供零 SUT 钉验。

## 4. 身份观察件（compile 落盘 `identity-observations.compile.json`）

plan §4 v4 字段逐字：`{ schemaVersion:1, artifactKind:'compile-identity-observation', caseId, capturedAgainstBuild, identityProfileDigest, eventsSha256, source:{ kind:'compile-envelope', atom:'agent.searchOpen', signed:false, replayReady:false }, observations:[{ kind:'agent', name, code, platformId, sourceIntentId, candidateId, role, atom, evidenceStepId, sourcePath }] }`
join 只对终端 click binding；见 plan §4。
修单增补（R1-C1/R1-M2）：含身份观察的编译产物必须落 `entity-bindings.draft.json` v2（v1 全字段 + schemaVersion:2 + identityProfileDigest + identityObservationsSha256=观察件原始字节 sha）——真实 compile→sign 接线由 chat-sut 金牌 C6 全链钉死，手造 v2 只作 sign 面单元考场；声明身份通道时 events 内每个 agent.searchOpen 终端 click 必须恰有一条观察行，基数不齐 compile exit 65 不产成功产物；双证门硬阻断时 compile-report 携结构化 `identityGate: { resolution, reason }`（类别机器可判，不钉 blocker 文案）。

## 5. sign 面

`--entity-observations <f>` 进 `lib/sign-cli-args.mjs` 白名单；v2 判别只按 draft `schemaVersion:2`；v2 强制观察件（缺=65）；join 五元 `{sourceIntentId,candidateId,role,atom,evidenceStepId}`；三错配（build/digest/eventsSha）任一=65；拒签零新增产物（frozen/prd/journal/tmp）。v1 路径逐字不变。
修单增补（R1-H5）：观察义务集合从 events 的 atom+action 独立推导、锚定字面量 `agent.searchOpen`——`source.atom` 与观察行 `atom` 必须精确等于该字面量、观察行 `kind` 必须精确 `'agent'`，任一不符 65；观察件自报 atom 绝不参与终端集合推导。回放侧（R1-H5/R1-M3）：v2 冻结权威在场时目标 click 缺已签三元组=action_failed 绝不按首采模式续跑；身份账本只由已验证 v2 权威激活，真 v1 件配声明身份通道的新剖面固定走旧 DOM-only 路径。

## 6. chat-sut 新场景（fixture 纯加法）

`startChatSut({ scenario })` 新场景 `idhappy|idtwins-hidden|idcode-mismatch|idmissing|idpaged`：搜索 Enter 触发 `fetch('/api/agents/query?nameLike=…')`，服务端按场景回 `{ data: { records: [{agentId,agentCode,agentName}], total } }`（idmissing 回 500；idpaged total=2 records=1；idtwins-hidden DOM 渲一卡但 records 两行同名）。既有场景与页面字节零动。
修单增补（纯加法）：`iddom-skew`=信封正常但 DOM 卡片副标题渲假码 AG-DOM-999（R1-H1 双锚考场）；`idpaged-dupdom`=idpaged 同信封但 DOM 渲两张同名卡（R1-M2 判定序考场）；`idtwins-sync`=按键同步渲一张主卡+照发 fetch 且信封回两行同名（R1-M3 版本语义考场——回放 press→click 零等待，旧 DOM-only 门对 fetch 渲染页有固有竞态，考场必须确定性：修后 v1 不建账本走同步 DOM 确定 unique，修前坏代码消费未签信封必 ambiguous）；id* 场景详情页携版本化脚本 `?v=chat-sut-id-1`（真实 sign 对账链需非 null capturedAgainstBuild）。

## 7. 差分棘轮基线

`tests/_golden/fixtures/agent-id-readback/baseline/`：冻结时在未实现树上录制（等价 82484ab）：mock 采集序列下 records() 字节、api 面、CDP listener/send 调用名序列（四面逐字对照消费）。
修单增补（R1-H6，诚实缩窄+补强）：poison spy 升级为真实加载证据——`spy-loader.mjs`/`spy-hooks.mjs` 经 node --import 注入解析钩子，负控（compile/replay/sign 三 CLI 入口未声明路径零身份模块解析）+ 正控（显式 import 必须被逮到）；compile-atoms/replay-actions 对身份门一律动态按需加载。plan §6 允诺的「CLI 三流 + 完整输出文件集逐字节」面不冻结：sign 产物含 receipt 等跨运行确定性未证的字节，冻不确定字节=制造 flaky 假红；该面改由 chat-sut 金牌 C6（真实全链行为钉）与 C7（v1 零行为差行为钉）覆盖，axes/events/report 字节面依赖浏览器执行、随真机链义务 route:human。此缩窄为修单披露项，评审复核。
二波增补（R2-H6）：面⑤ `sign-v1-cli.json`（sign v1 happy 三流+完整输出集+逐文件 sha+prd 字节；双跑探针实证跨运行字节确定——「receipt 确定性未证」假设实测收回；相对路径零绝对路径泄漏）+ 面⑥ `cli-early-reject.json`（compile/replay 无参三流；sign 无参 usage 含 `--entity-observations` 新旗标文档，属已声明接口合法演进不入未声明面）+ R15-R17 过校验真路径负控。
三波增补（sol 咨询后兑现，2026-07-22 晚）：一波「axes/events/report 字节面零 SUT 不可达」判定被 sol max 咨询证伪（`review/sol-consult-plan6.log`）——五面构造落地为面⑦⑧⑨⑩（`compile-run-v1.json` / `action-axes-v1.json` / `axes-projection-v1.json` / `verdict-report-v1.json`，R18-R21 逐字对照）：mock Page/forensics 测试替身（`fixtures/agent-id-readback/mock-page.mjs`）驱【真实】`createCompileRun`/`compileFlow` 与 `performAction`；`bin/replay.mjs` 浏览器后三轴投影抽生产共用纯函数 `lib/replay-axes.mjs`（逐字搬移，82484ab..实现快照对投影段零改动、搬移 diff 交评审静态核）；`verdict`→`report-model`（`--generated-at` 固定）→`report` 真 CLI 链（四态各一）。基线仍于 82484ab 窗口录制，既有六面字节未变=窗口保真机器证据。两笔明示排除（同 sign usage 排除口径，冻结的是具体调用矩阵）：report 的 html/md 字节属报告模板演进面（义务=report 的 JSON 字节，产物文件名集仍冻）；`bin/report.mjs` 成功 stdout 打印 resolve 后绝对路径，冻它破跨树可移植（R13 零绝对路径纪律），改冻 status/stderr+产物文件名集+逐文件 sha。真实 DOM/CDP/SUT 行为保真与真机 UAT 仍 route:human（绑 uatCaseId、后继契约 `real-uat-attestation`，见 plan §6/§8 修正）。

## 8. accept 期裁量记录（金牌作者申报，实现对表权威）

- `matched` 三元组形状冻结 `{ name, code, platformId }`；编译首采（无已签期望）时 `matched.platformId` 取信封行 `id`。
- ledger 层负责 total 完整性复核；门层只消费 `envelope.status !== 'ok' → action_failed`（门金牌不重测 total 语义）。
- `settle` 以 resolve（非 reject）表达含 failed/timeout 终态的完成；晚到已 seal 事务的响应其 `consume` 共同安全属性=非 `'ok'`（`lateDrops` 计数器不入接口面）。
- channel 配置即剖面 `agents.listApi` 闭合对象原样（origin 匹配由采集侧完成，不入 ledger 面）。
- draft v2 = v1 全字段 + `identityProfileDigest` + `identityObservationsSha256`；frozen v2 另加 `identityObservations[]`（三元组+`evidenceStepId`）。draft 侧携 `identityProfileDigest` 是必要延伸：sign 无剖面输入，digest 对账须有 draft 基准（B 路作者申报，契约内裁定采纳，评审复核）。digest 规范化=递归键排序 JSON 后 sha256、前缀 `sha256:`。
- sign「零输出」口径=零 stdout + 零产物（stderr 诊断行放行）。
- 浏览器金牌 itemContainer 冻结 `.agent-card`（chat-sut id* 场景实渲类名，与真机采样一致；任务括注 `.agent-item` 作废）。
- 硬阻断断言面=非零退出+不落 events.json+compile-report.blockers 非空（不钉 blocker 文案）；idhappy 不带 code（完整性查询固定名称，码判据 idcode-mismatch 专场）。
- C4 idmissing 今日恰绿（500→零卡→旧 DOM 门 absent 恰好硬阻断）已在红证如实注明：绿因与信封门无关、断言面等价、实现后仍须挡。
- worktree 以符号链接借主树 node_modules（两树 lock 同 blob）；收口时裁处保留或真装。
