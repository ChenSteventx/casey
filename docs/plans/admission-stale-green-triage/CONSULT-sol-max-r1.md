# CONSULT-sol-max-r1 —— gpt-5.6-sol max 只读咨询结论（2026-07-31）

> 完整转录（含推理与工具调用）约 380 万字节，只留结论正文。
> 原始转录在会话临时目录，重启即清；如需完整过程请重跑咨询。

结论先行：你的主结论应改成——**六枚 live golden 的 exit 65 是已裁定的夹具隔离态，不应补锁复活；但相关 PRD 里确有另一层“缩空验收/范围漂白式假绿”。`tc_chiefcomplaint_smoke` 是生产用例迁移债，不过不能简单把五类 atom 全叫“纯只读”后逐 event 硬签 subject。事实 E 是明确的契约冲突，不能靠刷新 SHA 掩平。**

## Q1：分类判据

### 1. “夹具级/用例级”在对象归属上成立，但治理不能只靠这一个二分

应至少分三轴：

| 轴 | 六枚 golden | `tc_chiefcomplaint_smoke` |
|---|---|---|
| 测试对象 | 临时合成 case + fixture SUT，属夹具级 | `cases/` 下生产 audience 用例，属用例级 |
| 冻结治理 | 部分 fixture/server 被多个 PRD checksum 共享冻结 | expected 已人签，缺 entity locks，tier2 manifest 冻结 |
| 执行生命周期 | live executable 禁止代理执行，route:human | 应重表达、生产 audience 人签后走真机 |

所以，修改 `tests/fixtures/*/server.mjs` 仍是“夹具级改动”；但若它被多个 PRD 的 `testChecksums` 冻结，就同时是“共享冻结面改动”，必须同步全部 owner PRD 的 checksum amendment 和受影响门禁。反向索引实核到：

- `fake-sut/server.mjs` 被 drawer-lock、p5-replay、replay-nth、replay-settle 四份 PRD 冻结；
- `chat-sut/server.mjs` 被 agent-id-readback、chiefcomplaint 冻结；
- `login-sut/server.mjs` 被 replay-login-bootstrap、video-login-carry 冻结；
- `publish-sut/server.mjs` 被 wf-history-version、wf-publish-states 冻结；
- `workflow-sut/server.mjs` 没有 owner。

“是否必须人签”不由 `tests/fixtures/` 路径决定。普通 checksum 锁只保证字节一致；若改的是 expected、entity locks、生命周期账等人签语义面，则必须重签。单纯 server 字节并不自动等于 ADR-0004 人签件，但当前这些 live fixture 已禁止代理跑，所以想靠改 server 复活它们，必须先走正式生命周期重裁，而不是先问要不要补签。

依据：读了 [六枚 golden 源码](/mnt/d/ctx/heren/casey/tests/_golden/p5-replay.golden.mjs:15)、[Casey 执行边界](/mnt/d/ctx/heren/casey/.claude/skills/casey/SKILL.md:109)、[ADR-0004](/mnt/d/ctx/heren/casey/docs/adr/0004-assertion-freeze-sign-versioning.md:15)；跑了全 `loop/*.json` 的 `testChecksums` 反向索引脚本。

### 2. 六枚 runtime-RED 可以不算“待补锁债”，但七份 PRD 不能一概洗成“非假绿”

我建议分开定性：

- **六枚 executable 本身**：诚实隔离红，不是待修红。隔离账中这六枚共 52 条 isolated obligation，实际全部都是 `coverageRelation:"uncertain"`、`agentExecution:"forbidden"`、`route:"human"`。
- **PRD story 的 `passes:true`**：至少部分是“范围漂白式假绿”。

最硬的实证是 `prd-p5-replay`：

1. `p5-replay.golden.mjs` 的 17 条义务全部 `retain-isolated`，没有 surviving unit。
2. `b3bee6b` 重裁时明确把 s1 留成 `passes:false`。
3. `4ebe2ed` 在 07-22 又仅凭 `selftest --tier1` 将它翻成 `true`。
4. 07-19 方向文档明确规定原 p5 story 应保持 false/superseded，不能靠缩 acceptance 翻绿。[方向文档](/mnt/d/ctx/heren/casey/docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md:45)

`prd-chief-bringup` 也明显空心：desc 仍声称 “chiefcomplaint golden 11/11”，acceptance 却只剩 tier1。[当前 story](/mnt/d/ctx/heren/casey/loop/prd-chief-bringup.json:16) 而 tier1 的五项只是术语白/黑名单、breaker reset、gate demo、verdict 纯度，[源码在此](/mnt/d/ctx/heren/casey/bin/casey.mjs:180)，不证明 chief bringup。

`prd-login-traffic-drop` 同理：replay-login 的 8 条义务全隔离，story 仍只靠 tier1 为真。[当前 story](/mnt/d/ctx/heren/casey/loop/prd-login-traffic-drop.json:17)

反向闭包本身也有漏洞：它只要求某条 surviving-unit 聚合命令出现在“任意一个 true story”，没有校验该后继是否由原 owner/story 承载、是否与该 story 的 desc 有语义关系。[扫描逻辑](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs:70)

因此准确说法是：

> 六枚 runtime 红已被合法隔离；但 `p5-replay` s1、`chief-bringup`、`login-traffic-drop` 等 story 的真态仍不可信。签过字的重裁只能证明当时冻结的账和门，不能让不相干的 tier1 证明业务义务。

`prd-replay-settle-mount` s1 保持 `false` 是正确示范。其余应逐 story 拆分，不能整批判七份都真或都假。

依据：读了 [生命周期 plan](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)、[implementation evidence](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md:4)、[p5 当前 PRD](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:29)；跑了 JSON 义务统计，并用 `git show b3bee6b`、`git blame`、`git show 4ebe2ed`核过 false→true 历史。

### 3. 事实 E 是直接契约冲突；生命周期隔离裁定优先，活 acceptance 错

我实跑：

- `hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs`：exit 1；
- 精确报出三条：
  - stale-red s1 → report-diagnostics；
  - stale-red s2 → p3-compile；
  - entity-destructive-continuity s7 → p3-compile。

这枚 scanner 本身属于 07-20 人签生命周期 PRD 的 acceptance；规则明确禁止任何隔离 executable 留在任何 story acceptance。[规则实现](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs:46)

所以“谁对谁错”是：

- 隔离策略和 `agentExecution:forbidden` 是现行权威；
- 07-22/07-24 后来加入的三条 live acceptance 是不合规边；
- 相应 `passes:true` 不成立；
- 但账内 SHA 也确已陈旧，不能拿旧账字节继续声称完成了当前源码的逐义务分类。

换言之：**策略上隔离账赢；字节上隔离账已漂；活 PRD acceptance 最错。**

依据：读了 [隔离账 p3 区域](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json:1642)、[report 区域](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json:3224)、[stale-red PRD](/mnt/d/ctx/heren/casey/loop/prd-stale-red-admission-refit.json:20)、[destructive PRD](/mnt/d/ctx/heren/casey/loop/prd-entity-destructive-continuity-guard.json:112)；跑了 reverse-closure，exit 1。

## Q2：补测试受众锁是否掩盖问题

### 1. 给六枚补 `audience:test` 锁只治准入症状；但默认 fail-closed 不是应删除的根因

`SIDE_EFFECT_POLICY` 的未知 atom → `mutation/subject` 是有意的安全默认，源码注释就写明“只有明确列为 read 才跳过，未知一律 mutation”。[策略表](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:41) [默认分支](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:454)

真正的问题是策略模型过窄，把三件事压成一个 `effect`：

- 是否持久化修改业务实体；
- 是否需要目标身份连续性；
- 是否产生外部/会话副作用。

你说五类 atom “全是纯只读”过强：

- `agent.searchOpen` 不改业务实体，但它选择特定 agent，身份连续性不能丢；仓内观察注册和金牌还明确把它当 `agent/subject`。
- `chat.sendAndWait` 会发送消息并等待模型流，它不是纯读取，只是未必属于“业务实体 mutation”。
- 其余导航、开关面板、关面板更接近无持久化 UI 交互。

因此正确根修是把“实体 effect”和“目标绑定/外部 effect”拆开，给已知 atom 人工冻结策略；未知仍应 fail-closed。不能简单把五类全列为零绑定 read，也不能照当前默认给 10 个 event 机械签十条虚构 subject。

我用当前真实 events 调纯函数，结果是：

- `eventsContainEntityMutation` → `true`
- `checkReplayEntityAdmission` → `ok:false`
- `allowBrowserLaunch:false`
- `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`

依据：读了 [tc events](/mnt/d/ctx/heren/casey/cases/tc_chiefcomplaint_smoke/events.json:10)、[策略与 replay 门](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:845)、[agent 编译行为](/mnt/d/ctx/heren/casey/lib/compile-atoms-agent.mjs:297)；实际运行了上述两枚纯函数，未启动浏览器。

### 2. 07-22 与 07-19：对窄 ADR-0010 合法，对原 fake-SUT 路线和生命周期裁定仍冲突

07-20 实际交付的不是 07-19 所设想的完整强信任根，只是：

- 准入件必填、自哈希覆盖 `audience:test|production`；
- 凭据上下文与 audience 严格匹配；
- 生产凭据拒绝 test audience。

它明确不覆盖密钥 signer 认证、不可变 manifest、receipt 读路复验、撤销、SUT/环境 scope。[plan 划界](/mnt/d/ctx/heren/casey/docs/plans/admission-trust-root-separation/plan.md:7) [ADR 划界](/mnt/d/ctx/heren/casey/docs/adr/0010-admission-audience-credential-gate.md:20)

所以：

- 07-22 在**无生产凭据的测试上下文**铸 `audience:test`，对 ADR-0010 的有界机制来说合法。
- 但拿它恢复 fake-SUT live golden、再写回代理应执行的 acceptance，仍违反 07-19 “原路径作废”及 07-20 生命周期裁定。[作废原文](/mnt/d/ctx/heren/casey/docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md:7)
- `stale-red-admission-refit` 也不是两枚都“补 test 锁”：p3 确实铸了 test authority；report-diagnostics 是把 E1 重写成 `nav.workflowManagement` 的固定只读信封、零锁。[E1 源码](/mnt/d/ctx/heren/casey/tests/_golden/report-diagnostics.golden.mjs:167)

一句话：**安全接缝合法，不代表被它驱动的 fake-SUT acceptance 合法。**

依据：读了上述方向文档、ADR、trust-root PRD 和 [stale-red PRD](/mnt/d/ctx/heren/casey/loop/prd-stale-red-admission-refit.json:3)，并核了 `b30fdf4` diff。

### 3. 不给六枚补锁是对的，但不能把 `route:human` 报成“问题已解决”

会继续留下四类真实问题：

- 52 条义务全部仍是 `uncertain`，行为回归没有自动化背书；
- 若干 owner PRD 被缩成 tier1 后仍真；
- `tc_chiefcomplaint_smoke` 的生产策略/锁迁移没有完成；
- 生命周期账漂和三条非法活 acceptance 没闭合；
- 07-20 的 trust-root 只解决有界误用，不是完整发布信任根。

因此建议报告措辞：

> 六枚无“待补测试锁”债；其行为义务仍处隔离未交付态，route:human。另有 PRD 真态、生产 atom policy、生命周期账漂三笔独立债。

依据：读了 [source-obligations](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json)、隔离账和 trust-root ADR；跑出的统计为六枚 isolated 分别 2/7/17/7/8/11，全部 uncertain。

## Q3：候选动作裁决

### (a) 应清，但要连配对 scratch 一起核清

`p3-compile` 的 `wx`、owner token、异常残留人工清理约定属实。[源码](/mnt/d/ctx/heren/casey/tests/_golden/p3-compile.golden.mjs:186)

不过审计结束时我发现当前工作树已经显示：

- `D loop/prd-tc_compile_smoke.json`
- `.golden-scratch-p3compile-00867c64/` 仍在；
- 三个 authority 文件的 SHA 与 HEAD 中残留 PRD 所列值吻合。

这个删除不是我做的；本会话沙箱是只读挂载。若这是你并发执行了 (a)，目前只完成了一半：配对 scratch 仍是孤儿。清理只消除 EEXIST/仓库卫生问题，**不等于授权代理跑 p3**。

依据：读了 p3 cleanup 代码；跑了 `git status`、`git show HEAD:loop/prd-tc_compile_smoke.json`、三个 authority 的 SHA 核验。

### (b) 不应简单刷新 SHA，也不应整枚移出隔离账

简单更新两个 `originalFileSha256` 会掩盖分类依据已变：

- `isolation-pending` 确实按当前源字节比对，不符就 65。[源码](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-isolation-pending.zero-sut.golden.mjs:32)
- `source-obligations` 与 isolation manifest 必须同值；只改隔离账会让 lifecycle closure 红。[闭合规则](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-lifecycle-closure.zero-sut.golden.mjs:169)
- p3 的旧 `sourceSpan` 已和当前行号大幅错位，说明需要重新原子化，不是换一个摘要。
- 当前 p3 仍有 10 条 isolated/4 条 unit，report 仍有 1 条 isolated/11 条 unit。
- 07-22/07-24 的 fake-SUT 绿并不是 full zero-SUT successor 或可信真机 UAT，不能据此整枚移账。
- 仓内没有这两枚完整原 golden 的 gzip 存档；只找到一份 p3 unit 的旧计数 amendment archive。

正确动作应是：先撤非法活 acceptance；再对现源码逐义务重审，只有已有 full 后继的行才改生命周期分类；同时更新 source ledger、isolation/subsumption、归档、生命周期 PRD checksum amendment，并由 Steven 实签。exit 65 目前是在正确报警，不必急着把它“修”回 78。

依据：跑了当前 SHA、`git show b3bee6b:<file> | sha256sum`、提交历史和全仓 gzip 搜索；账内旧 SHA 与 `b3bee6b` 字节完全一致。

### (c) 应做草稿并停在人签前，但先修策略表达

草稿顺序应是：

1. 定义这些 atom 的“实体 effect / 身份连续性 / 外部副作用”，保持未知 fail-closed；
2. 重新编译用例；
3. 生成 `audience:production` 的锁草稿与必要身份观察；
4. 更新 tier2 manifest/owner 冻结面；
5. 停在人签门前。

还要一并处理一个你没提到的问题：`testcase.json` 的 intent ID 是 `intent_nav/open/panel/send/close`，而 events/expected 使用 `intent_0…4`/`intent_3`，血缘不一致。[testcase](/mnt/d/ctx/heren/casey/cases/tc_chiefcomplaint_smoke/testcase.json:10) [expected](/mnt/d/ctx/heren/casey/cases/tc_chiefcomplaint_smoke/expected.frozen.json:5)

依据：读了 testcase/events/expected、tier2 manifest notes 和实体观察注册表。

### (d) 同意：不给六枚补锁

这既符合 07-19 作废裁定，也符合当前 Casey 的 fake-SUT 禁跑边界。补锁只会复活被明确隔离的 executable。

依据：[DIRECTION](/mnt/d/ctx/heren/casey/docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md:35)、[SKILL 边界](/mnt/d/ctx/heren/casey/.claude/skills/casey/SKILL.md:109)。

## 你陈述中需要纠正的点

- 事实 A 主体正确，但 `workflow-sut` 未被六枚使用；你还漏列了 `tc_settle_replay`，以及 compile 侧的 `tc_chat_smoke`、`tc_hist_smoke`。
- 事实 B 主体正确；精确说是七份 PRD 共 12 个 story，11 个有那句 boilerplate，`prd-p5-replay` s2 没有。
- 事实 C 的表述自相矛盾：不是“七份 acceptance 全 exit 0”，而是“所有当前 `passes:true` acceptance 据你实测为 0；唯一 false story 的静态门为 65”。我未完整复跑：tier1 会写 `cases/_selftest`，六枚 live golden 又被 Casey 规则禁止；`p4-drafter`/`draft-cli` 在只读沙箱分别遇到嵌套进程 EPERM、临时目录 EROFS，不能据此判产品红。
- 事实 D 的缺锁、五类 atom、默认 mutation/subject 都核对成立；但“全是纯只读语义”不成立，至少 `agent.searchOpen` 是身份敏感读取，`chat.sendAndWait` 有外部会话副作用。
- 事实 E 的核心矛盾和 SHA 漂移成立；但“report-diagnostics 的 E1 因缺 `case-meta` 才 NEEDS_HUMAN”不成立。`case-meta` 是可选输入，只在 verdict 之后传给 report-model；run 的最终真假来自 `verdict.json`。[编排顺序](/mnt/d/ctx/heren/casey/bin/casey.mjs:100) 我没有违规启动 publish-sut，因此不能替你确定 E1 当前真正的 verdict 红因。

如果只能改一件：**先撤掉 `p3-compile` / `report-diagnostics` 的三条活 acceptance，并把对应 story 拆分或翻回诚实 false，直到逐义务生命周期重审完成。** 若严格只能在 (a)–(d) 四选一，则选 (a)，并连配对 scratch 一起清。
tokens used
725,246
结论先行：你的主结论应改成——**六枚 live golden 的 exit 65 是已裁定的夹具隔离态，不应补锁复活；但相关 PRD 里确有另一层“缩空验收/范围漂白式假绿”。`tc_chiefcomplaint_smoke` 是生产用例迁移债，不过不能简单把五类 atom 全叫“纯只读”后逐 event 硬签 subject。事实 E 是明确的契约冲突，不能靠刷新 SHA 掩平。**

## Q1：分类判据

### 1. “夹具级/用例级”在对象归属上成立，但治理不能只靠这一个二分

应至少分三轴：

| 轴 | 六枚 golden | `tc_chiefcomplaint_smoke` |
|---|---|---|
| 测试对象 | 临时合成 case + fixture SUT，属夹具级 | `cases/` 下生产 audience 用例，属用例级 |
| 冻结治理 | 部分 fixture/server 被多个 PRD checksum 共享冻结 | expected 已人签，缺 entity locks，tier2 manifest 冻结 |
| 执行生命周期 | live executable 禁止代理执行，route:human | 应重表达、生产 audience 人签后走真机 |

所以，修改 `tests/fixtures/*/server.mjs` 仍是“夹具级改动”；但若它被多个 PRD 的 `testChecksums` 冻结，就同时是“共享冻结面改动”，必须同步全部 owner PRD 的 checksum amendment 和受影响门禁。反向索引实核到：

- `fake-sut/server.mjs` 被 drawer-lock、p5-replay、replay-nth、replay-settle 四份 PRD 冻结；
- `chat-sut/server.mjs` 被 agent-id-readback、chiefcomplaint 冻结；
- `login-sut/server.mjs` 被 replay-login-bootstrap、video-login-carry 冻结；
- `publish-sut/server.mjs` 被 wf-history-version、wf-publish-states 冻结；
- `workflow-sut/server.mjs` 没有 owner。

“是否必须人签”不由 `tests/fixtures/` 路径决定。普通 checksum 锁只保证字节一致；若改的是 expected、entity locks、生命周期账等人签语义面，则必须重签。单纯 server 字节并不自动等于 ADR-0004 人签件，但当前这些 live fixture 已禁止代理跑，所以想靠改 server 复活它们，必须先走正式生命周期重裁，而不是先问要不要补签。

依据：读了 [六枚 golden 源码](/mnt/d/ctx/heren/casey/tests/_golden/p5-replay.golden.mjs:15)、[Casey 执行边界](/mnt/d/ctx/heren/casey/.claude/skills/casey/SKILL.md:109)、[ADR-0004](/mnt/d/ctx/heren/casey/docs/adr/0004-assertion-freeze-sign-versioning.md:15)；跑了全 `loop/*.json` 的 `testChecksums` 反向索引脚本。

### 2. 六枚 runtime-RED 可以不算“待补锁债”，但七份 PRD 不能一概洗成“非假绿”

我建议分开定性：

- **六枚 executable 本身**：诚实隔离红，不是待修红。隔离账中这六枚共 52 条 isolated obligation，实际全部都是 `coverageRelation:"uncertain"`、`agentExecution:"forbidden"`、`route:"human"`。
- **PRD story 的 `passes:true`**：至少部分是“范围漂白式假绿”。

最硬的实证是 `prd-p5-replay`：

1. `p5-replay.golden.mjs` 的 17 条义务全部 `retain-isolated`，没有 surviving unit。
2. `b3bee6b` 重裁时明确把 s1 留成 `passes:false`。
3. `4ebe2ed` 在 07-22 又仅凭 `selftest --tier1` 将它翻成 `true`。
4. 07-19 方向文档明确规定原 p5 story 应保持 false/superseded，不能靠缩 acceptance 翻绿。[方向文档](/mnt/d/ctx/heren/casey/docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md:45)

`prd-chief-bringup` 也明显空心：desc 仍声称 “chiefcomplaint golden 11/11”，acceptance 却只剩 tier1。[当前 story](/mnt/d/ctx/heren/casey/loop/prd-chief-bringup.json:16) 而 tier1 的五项只是术语白/黑名单、breaker reset、gate demo、verdict 纯度，[源码在此](/mnt/d/ctx/heren/casey/bin/casey.mjs:180)，不证明 chief bringup。

`prd-login-traffic-drop` 同理：replay-login 的 8 条义务全隔离，story 仍只靠 tier1 为真。[当前 story](/mnt/d/ctx/heren/casey/loop/prd-login-traffic-drop.json:17)

反向闭包本身也有漏洞：它只要求某条 surviving-unit 聚合命令出现在“任意一个 true story”，没有校验该后继是否由原 owner/story 承载、是否与该 story 的 desc 有语义关系。[扫描逻辑](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs:70)

因此准确说法是：

> 六枚 runtime 红已被合法隔离；但 `p5-replay` s1、`chief-bringup`、`login-traffic-drop` 等 story 的真态仍不可信。签过字的重裁只能证明当时冻结的账和门，不能让不相干的 tier1 证明业务义务。

`prd-replay-settle-mount` s1 保持 `false` 是正确示范。其余应逐 story 拆分，不能整批判七份都真或都假。

依据：读了 [生命周期 plan](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)、[implementation evidence](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md:4)、[p5 当前 PRD](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:29)；跑了 JSON 义务统计，并用 `git show b3bee6b`、`git blame`、`git show 4ebe2ed`核过 false→true 历史。

### 3. 事实 E 是直接契约冲突；生命周期隔离裁定优先，活 acceptance 错

我实跑：

- `hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs`：exit 1；
- 精确报出三条：
  - stale-red s1 → report-diagnostics；
  - stale-red s2 → p3-compile；
  - entity-destructive-continuity s7 → p3-compile。

这枚 scanner 本身属于 07-20 人签生命周期 PRD 的 acceptance；规则明确禁止任何隔离 executable 留在任何 story acceptance。[规则实现](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs:46)

所以“谁对谁错”是：

- 隔离策略和 `agentExecution:forbidden` 是现行权威；
- 07-22/07-24 后来加入的三条 live acceptance 是不合规边；
- 相应 `passes:true` 不成立；
- 但账内 SHA 也确已陈旧，不能拿旧账字节继续声称完成了当前源码的逐义务分类。

换言之：**策略上隔离账赢；字节上隔离账已漂；活 PRD acceptance 最错。**

依据：读了 [隔离账 p3 区域](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json:1642)、[report 区域](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json:3224)、[stale-red PRD](/mnt/d/ctx/heren/casey/loop/prd-stale-red-admission-refit.json:20)、[destructive PRD](/mnt/d/ctx/heren/casey/loop/prd-entity-destructive-continuity-guard.json:112)；跑了 reverse-closure，exit 1。

## Q2：补测试受众锁是否掩盖问题

### 1. 给六枚补 `audience:test` 锁只治准入症状；但默认 fail-closed 不是应删除的根因

`SIDE_EFFECT_POLICY` 的未知 atom → `mutation/subject` 是有意的安全默认，源码注释就写明“只有明确列为 read 才跳过，未知一律 mutation”。[策略表](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:41) [默认分支](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:454)

真正的问题是策略模型过窄，把三件事压成一个 `effect`：

- 是否持久化修改业务实体；
- 是否需要目标身份连续性；
- 是否产生外部/会话副作用。

你说五类 atom “全是纯只读”过强：

- `agent.searchOpen` 不改业务实体，但它选择特定 agent，身份连续性不能丢；仓内观察注册和金牌还明确把它当 `agent/subject`。
- `chat.sendAndWait` 会发送消息并等待模型流，它不是纯读取，只是未必属于“业务实体 mutation”。
- 其余导航、开关面板、关面板更接近无持久化 UI 交互。

因此正确根修是把“实体 effect”和“目标绑定/外部 effect”拆开，给已知 atom 人工冻结策略；未知仍应 fail-closed。不能简单把五类全列为零绑定 read，也不能照当前默认给 10 个 event 机械签十条虚构 subject。

我用当前真实 events 调纯函数，结果是：

- `eventsContainEntityMutation` → `true`
- `checkReplayEntityAdmission` → `ok:false`
- `allowBrowserLaunch:false`
- `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID`

依据：读了 [tc events](/mnt/d/ctx/heren/casey/cases/tc_chiefcomplaint_smoke/events.json:10)、[策略与 replay 门](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:845)、[agent 编译行为](/mnt/d/ctx/heren/casey/lib/compile-atoms-agent.mjs:297)；实际运行了上述两枚纯函数，未启动浏览器。

### 2. 07-22 与 07-19：对窄 ADR-0010 合法，对原 fake-SUT 路线和生命周期裁定仍冲突

07-20 实际交付的不是 07-19 所设想的完整强信任根，只是：

- 准入件必填、自哈希覆盖 `audience:test|production`；
- 凭据上下文与 audience 严格匹配；
- 生产凭据拒绝 test audience。

它明确不覆盖密钥 signer 认证、不可变 manifest、receipt 读路复验、撤销、SUT/环境 scope。[plan 划界](/mnt/d/ctx/heren/casey/docs/plans/admission-trust-root-separation/plan.md:7) [ADR 划界](/mnt/d/ctx/heren/casey/docs/adr/0010-admission-audience-credential-gate.md:20)

所以：

- 07-22 在**无生产凭据的测试上下文**铸 `audience:test`，对 ADR-0010 的有界机制来说合法。
- 但拿它恢复 fake-SUT live golden、再写回代理应执行的 acceptance，仍违反 07-19 “原路径作废”及 07-20 生命周期裁定。[作废原文](/mnt/d/ctx/heren/casey/docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md:7)
- `stale-red-admission-refit` 也不是两枚都“补 test 锁”：p3 确实铸了 test authority；report-diagnostics 是把 E1 重写成 `nav.workflowManagement` 的固定只读信封、零锁。[E1 源码](/mnt/d/ctx/heren/casey/tests/_golden/report-diagnostics.golden.mjs:167)

一句话：**安全接缝合法，不代表被它驱动的 fake-SUT acceptance 合法。**

依据：读了上述方向文档、ADR、trust-root PRD 和 [stale-red PRD](/mnt/d/ctx/heren/casey/loop/prd-stale-red-admission-refit.json:3)，并核了 `b30fdf4` diff。

### 3. 不给六枚补锁是对的，但不能把 `route:human` 报成“问题已解决”

会继续留下四类真实问题：

- 52 条义务全部仍是 `uncertain`，行为回归没有自动化背书；
- 若干 owner PRD 被缩成 tier1 后仍真；
- `tc_chiefcomplaint_smoke` 的生产策略/锁迁移没有完成；
- 生命周期账漂和三条非法活 acceptance 没闭合；
- 07-20 的 trust-root 只解决有界误用，不是完整发布信任根。

因此建议报告措辞：

> 六枚无“待补测试锁”债；其行为义务仍处隔离未交付态，route:human。另有 PRD 真态、生产 atom policy、生命周期账漂三笔独立债。

依据：读了 [source-obligations](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json)、隔离账和 trust-root ADR；跑出的统计为六枚 isolated 分别 2/7/17/7/8/11，全部 uncertain。

## Q3：候选动作裁决

### (a) 应清，但要连配对 scratch 一起核清

`p3-compile` 的 `wx`、owner token、异常残留人工清理约定属实。[源码](/mnt/d/ctx/heren/casey/tests/_golden/p3-compile.golden.mjs:186)

不过审计结束时我发现当前工作树已经显示：

- `D loop/prd-tc_compile_smoke.json`
- `.golden-scratch-p3compile-00867c64/` 仍在；
- 三个 authority 文件的 SHA 与 HEAD 中残留 PRD 所列值吻合。

这个删除不是我做的；本会话沙箱是只读挂载。若这是你并发执行了 (a)，目前只完成了一半：配对 scratch 仍是孤儿。清理只消除 EEXIST/仓库卫生问题，**不等于授权代理跑 p3**。

依据：读了 p3 cleanup 代码；跑了 `git status`、`git show HEAD:loop/prd-tc_compile_smoke.json`、三个 authority 的 SHA 核验。

### (b) 不应简单刷新 SHA，也不应整枚移出隔离账

简单更新两个 `originalFileSha256` 会掩盖分类依据已变：

- `isolation-pending` 确实按当前源字节比对，不符就 65。[源码](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-isolation-pending.zero-sut.golden.mjs:32)
- `source-obligations` 与 isolation manifest 必须同值；只改隔离账会让 lifecycle closure 红。[闭合规则](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-lifecycle-closure.zero-sut.golden.mjs:169)
- p3 的旧 `sourceSpan` 已和当前行号大幅错位，说明需要重新原子化，不是换一个摘要。
- 当前 p3 仍有 10 条 isolated/4 条 unit，report 仍有 1 条 isolated/11 条 unit。
- 07-22/07-24 的 fake-SUT 绿并不是 full zero-SUT successor 或可信真机 UAT，不能据此整枚移账。
- 仓内没有这两枚完整原 golden 的 gzip 存档；只找到一份 p3 unit 的旧计数 amendment archive。

正确动作应是：先撤非法活 acceptance；再对现源码逐义务重审，只有已有 full 后继的行才改生命周期分类；同时更新 source ledger、isolation/subsumption、归档、生命周期 PRD checksum amendment，并由 Steven 实签。exit 65 目前是在正确报警，不必急着把它“修”回 78。

依据：跑了当前 SHA、`git show b3bee6b:<file> | sha256sum`、提交历史和全仓 gzip 搜索；账内旧 SHA 与 `b3bee6b` 字节完全一致。

### (c) 应做草稿并停在人签前，但先修策略表达

草稿顺序应是：

1. 定义这些 atom 的“实体 effect / 身份连续性 / 外部副作用”，保持未知 fail-closed；
2. 重新编译用例；
3. 生成 `audience:production` 的锁草稿与必要身份观察；
4. 更新 tier2 manifest/owner 冻结面；
5. 停在人签门前。

还要一并处理一个你没提到的问题：`testcase.json` 的 intent ID 是 `intent_nav/open/panel/send/close`，而 events/expected 使用 `intent_0…4`/`intent_3`，血缘不一致。[testcase](/mnt/d/ctx/heren/casey/cases/tc_chiefcomplaint_smoke/testcase.json:10) [expected](/mnt/d/ctx/heren/casey/cases/tc_chiefcomplaint_smoke/expected.frozen.json:5)

依据：读了 testcase/events/expected、tier2 manifest notes 和实体观察注册表。

### (d) 同意：不给六枚补锁

这既符合 07-19 作废裁定，也符合当前 Casey 的 fake-SUT 禁跑边界。补锁只会复活被明确隔离的 executable。

依据：[DIRECTION](/mnt/d/ctx/heren/casey/docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md:35)、[SKILL 边界](/mnt/d/ctx/heren/casey/.claude/skills/casey/SKILL.md:109)。

## 你陈述中需要纠正的点

- 事实 A 主体正确，但 `workflow-sut` 未被六枚使用；你还漏列了 `tc_settle_replay`，以及 compile 侧的 `tc_chat_smoke`、`tc_hist_smoke`。
- 事实 B 主体正确；精确说是七份 PRD 共 12 个 story，11 个有那句 boilerplate，`prd-p5-replay` s2 没有。
- 事实 C 的表述自相矛盾：不是“七份 acceptance 全 exit 0”，而是“所有当前 `passes:true` acceptance 据你实测为 0；唯一 false story 的静态门为 65”。我未完整复跑：tier1 会写 `cases/_selftest`，六枚 live golden 又被 Casey 规则禁止；`p4-drafter`/`draft-cli` 在只读沙箱分别遇到嵌套进程 EPERM、临时目录 EROFS，不能据此判产品红。
- 事实 D 的缺锁、五类 atom、默认 mutation/subject 都核对成立；但“全是纯只读语义”不成立，至少 `agent.searchOpen` 是身份敏感读取，`chat.sendAndWait` 有外部会话副作用。
- 事实 E 的核心矛盾和 SHA 漂移成立；但“report-diagnostics 的 E1 因缺 `case-meta` 才 NEEDS_HUMAN”不成立。`case-meta` 是可选输入，只在 verdict 之后传给 report-model；run 的最终真假来自 `verdict.json`。[编排顺序](/mnt/d/ctx/heren/casey/bin/casey.mjs:100) 我没有违规启动 publish-sut，因此不能替你确定 E1 当前真正的 verdict 红因。

如果只能改一件：**先撤掉 `p3-compile` / `report-diagnostics` 的三条活 acceptance，并把对应 story 拆分或翻回诚实 false，直到逐义务生命周期重审完成。** 若严格只能在 (a)–(d) 四选一，则选 (a)，并连配对 scratch 一起清。
