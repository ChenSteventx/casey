我的总判断：

- 路 a “不改 kernel”成立；“生产门零削弱”不成立。
- checksum 复签与 passes 翻红的处理方向正确，但 17/24 的边界不是最干净的边界。
- drift 活触发器失效是真问题；墓碑方向正确，但旧 `p5-replay` 不应借墓碑重新标绿。
- mint 工具能制造“结构合法”的授权件，但不能证明“语义真实”；目前确实存在假绿风险。

## 1. “不削弱生产门”：不同意

WeakMap 只能证明“调用者不能手搓内存 handle”，不能证明“reader 不会替错误主体铸 handle”。

当前实际信任链是：

1. 工作树中的 `loop/prd-<caseId>.json`
2. 其中的 checksum
3. 结构闭合的 artifact
4. 无密钥内容自哈希
5. reader 铸 opaque handle

reader 不检查：

- `signerId` 是否属于生产信任根；
- artifact 是否来自 `bin/sign.mjs`；
- receipt 是否真实；
- test/prod audience；
- SUT 身份或地址；
- 不可变发布根或撤销状态。

代码注释甚至明确承认发布根和撤销语义尚未补齐：[entity-semantic-lock-preflight.mjs](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:274)。

更直接的问题是：锁绑定 events 字节，却不绑定 `--sut`。同一份测试 events 和 committed 测试锁可以被指向另一个 SUT；replay 在准入后才读取任意 `--sut`：[replay.mjs](/mnt/d/ctx/heren/casey/bin/replay.mjs:226)。精确 hash 限制了可用 events，但没有限制这些 events 在哪里执行。

而且在当前 replay 接线里，`frozenLockAuthority` 只用于启动前结构准入；没有看到后续 mutation 前用 receipt/candidate 做真实身份重验。测试锁中的占位 candidate、lockId、receiptHash 不参与实际点击对象选择。

所以更准确的表述是：

> 路 a 不修改准入门代码，但向现有生产 reader 发布了可用于精确测试 events 的新授权数据。它暴露并实际利用了现有 trust-root 缺口，不能称为生产门零削弱。

增量风险是有界的：不能授权任意改写后的 events；但 committed 测试事件如果含模板化基址和 mutation，仍可能被误用于真机。

我会先补真正的域隔离：

- 生产 reader 只读不可变发布 manifest，不直接信任开发工作树 PRD。
- artifact 带不可伪造的 audience，例如 prod/test，并由不同信任根签发。
- 生产 reader 必须拒绝测试 signer/test root。
- 授权至少绑定环境或 SUT scope，而不只绑定 flow/events。
- receipt 内容或 receipt bundle 在生产读路上必须验证。
- 测试 reader/发行物物理分离；不能靠调用者自报 `--hermetic`。
- 增加一条反向验收：测试锁交给生产 reader 必须拒绝。

在这之前，我不会继续批量提交 ready-made 测试锁。

## 2. 规模决策：账务方法同意，17 的边界只部分同意

你在现行 plan §6.6 中写的顺序是对的：

1. 17 个金牌字节确实改变；
2. 所有约 40 个冻结它们的 PRD 都必须复签对应 checksum；
3. 随即运行各自 gate；
4. 还有其他准入红的 PRD，由 gate 把相应 story 写成 false。

复签只表示“接受新的冻结测试字节”，不等于测试通过；passes 仍必须由 gate 裁定。这一区分完全正确。

但必须原子化处理：不能出现“先复签 checksum 并提交，旧 `passes:true` 暂时保留，之后再跑 gate”的中间提交。否则会再造一次陈旧绿。尤其当前 gate 的 ratchet 红只设置整体退出码，不会强制所有 story 的 `passes=false`：[gate.mjs](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:50)。

收口应满足一个硬不变量：

> 40 个受影响 PRD 中，零个保留 enforcement 前的陈旧 true；每个 story 要么有 enforcement 后的新绿证据，要么为 false/superseded，并在债务表保存实际命令、退出码、拒因和时间。

至于 17 vs 24：如果仍接受这批 fake-SUT browser golden 的存在，我倾向一次处理 24，而不是 17。原因是只差 7 个金牌，但共享冻结治理、40 PRD 复签、gate sweep、债务表这些昂贵工作无论如何已经要做。选项三节省的是 7 个测试迁移，却保留一套复杂半迁移状态，边际收益可疑。

更干净的边界不是“5 个核心 PRD 的 s2 闭包”，而是按测试生命状态划分：

- 仍有效、可转成 zero-SUT 确定性测试；
- 仍有效、只能进入真机 UAT；
- 教义已作废，墓碑并命名后继。

还有一个当前仓库内的直接冲突：Casey skill 已规定 fake SUT 只读，不得启动、连接或回放，browser 行为验收只能驱真机：[SKILL.md](/mnt/d/ctx/heren/casey/.claude/skills/casey/SKILL.md:107)。因此按现行权威纪律，17 和 24 都不能通过“重跑 fake SUT”恢复成真绿。应先由 Steven 解决这条规则与迁移 plan 的冲突；否则迁移验收目标本身不可执行。

## 3. drift/vanished：活触发器失效判断正确，墓碑方式需修正

静态控制流支持你的判断：

- `workflow.deleteByName` 在通用候选定位前被专用域锁截走：[replay-actions.mjs](/mnt/d/ctx/heren/casey/lib/replay-actions.mjs:31)。
- 通用漂移探针只在后面的 `resolveCandidate → gateAndAct` 等路径产生。
- canonical 表唯一登记的 atom 又只有 `workflow.deleteByName`：[drift-probe.mjs](/mnt/d/ctx/heren/casey/lib/drift-probe.mjs:8)。
- verdict 只有在 `resolution==='none' && sameSignatureUniquePresent===true` 时产 `HARNESS_ERROR`：[verdict.mjs](/mnt/d/ctx/heren/casey/bin/verdict.mjs:62)。

因此准确结论是：

> 从现役生产 replay 生成的 axes 出发，正向漂移 `HARNESS_ERROR` 不可达。

不要说整个系统绝对不可达，因为直接向 verdict 喂合成 axes 仍能产生该状态；但那只是单元可达，不是自愈所需的活触发器。

墓碑 + 命名后继是正确方向。给旧夹具补 label/value 会改成“域锁删除成功/缺席”，不再证明漂移，确属倒裁夹具。

但我不同意“墓碑两案后让原 `prd-p5-replay` 合法翻绿”。原 story 明确冻结的是 10 案、漂移探针和 fake-SUT replay：[prd-p5-replay.json](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:27)。删掉两案再标绿，会把“契约被取代”伪装成“原契约通过”。

仓内既有墓碑先例明确写的是 `superseded-tombstoned-not-pass`，旧 story 保持 false：[supersession-revocation.json](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/semantic-lock-cert-closure/supersession-revocation.json:3)。

我会这样处理：

- 原 p5 story 保持 false/superseded；
- 出案级吊销收据，冻结原 hash、作废原因和后继；
- 新建 successor PRD 承载仍活着的 8 案；
- 另立自愈 liveness 契约：必须从真实 replay action 输出一路走到 verdict，证明至少一个现役 atom 可产生 `HARNESS_ERROR`；
- 若不再需要自愈，就正式退役相5活性要求和死码，而不是保留名义开闸。

## 4. mint 工具：结构生成正确，语义授权不可信

作为“让 fixture 满足当前 schema/policy cardinality”的工具，它写得合理：最终门会拒绝 shape、hash、role 数量失配。

但它不能支撑“语义锁覆盖真实”的结论：

- `candidateId`/`lockId` 是按 stepId 现造的；
- receiptHash 是全局占位；
- 没有绑定真实业务对象；
- replay 后续也不使用这些占位身份决定实际点击对象；
- 未登记 atom 默认 subject，关系型新 atom若漏登记，也可能被错误压成单 subject，而门与工具会共同同意；
- execute 模式用生产同一个 `requiredFlowEntityBindings` 生成并校验，存在明显同源盲区。

因此“门是最终裁判”只能证明自洽，不能证明语义真实。门本身只检查结构时，生成器和门一起绿恰恰可能是假绿。

我会：

- 把工具改名为“结构准入 fixture builder”，避免称为 mint semantic authority。
- mutation 不得合成 candidate；必须来自 committed flow/provenance。
- 未登记 atom 在测试生成器中直接拒绝，不默认 subject。
- 为每个允许迁移的旧 atom显式登记 effect/roles，而不是一个 catch-all。
- 使用独立测试信任根生成可验证 receipt；生产 reader明确拒绝该根。
- 加独立预期表核对 bindings，不能只靠生成器与生产门共享同一推导函数。
- 将“测试锁被生产 reader 拒绝”列为强制负向验收。

所以我建议暂停波 2–4。先修正两项承重前提：生产/测试信任根分离，以及 fake-SUT browser golden 的现行生命周期裁决。否则继续迁移会把陈旧红变成结构绿，但没有恢复 semantic-lock 真正想保护的语义。
