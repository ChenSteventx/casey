# 空心验收普查 —— gpt-5.6-sol max 只读咨询结论（2026-07-31）

> 完整转录约 96 万字节，只留结论正文。咨询问的是：17 条判据可信吗 / 能否机械区分被掏空与本来就没有 / 三类处置够不够 / 有没有比修 17 处更根本的做法 / 最大翻车风险。

结论先说：你的 17 条是高精度命中，17 条里没有误判；但召回不完整。按同一形态应是 19 条，另外还有 6 条“只剩 flow-bridge、却仍宣称 E2E”的确定漏项。机制层确实存在系统性假绿入口。

先纠正两个前提：

- 隔离账不是 239 条全为 `uncertain + partialSuccessors:[]`。实数是 233 条 `uncertain`、6 条 `partial`；那 6 条有部分 unit 后继，但仍明确保留浏览器因果缺口、`agentExecution:forbidden`、`route:human`，所以不改变“不得重跑”的结论。[隔离账 partial 实例](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json:228)，汇总账为 349 条义务、99 survive-unit、239 retain-isolated、11 superseded、0 retire，[implementation-evidence.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md:3)。
- `passes:true` 并不代表整个 gate 绿。Test Ratchet 或术语检查已红时，`red` 会置真，但 story 回写仍只看 `storyGreen`，完全不看全局 `red`：[gate.mjs](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:50)、[gate.mjs](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:89)。所以“acceptance 全 exit 0 就写 true”是对的；若把 `passes` 解读为质量门禁整体通过，则前提不完整。

## 1. 17 条判据可信吗？

可信但只适合作为高精度探针，不适合作为完整判据。

我静态扫到同样的 32 条：`passes:true`、acceptance 恰一条且精确等于 tier1。对照 story 描述与 `b3bee6b^` 历史后：

- 13 条名副其实：它们在 `b3bee6b` 前本来就只有 tier1，义务明确是“新增门面不得破坏确定性内核/统一语言”：
  `casey-demo#s2-tier1-regression`、`gen-prompts#s2-tier1-regression`、`ingest-scaffold#s2-tier1-regression`、`loop-kit-extract#s5-tier1-regression`、`ratchet-reverse-index#s2-regression`、`record-capture#s2-tier1-regression`、`record-distill#s2-tier1-regression`、`record-intake#s2-tier1-regression`、`report-cleanup-evidence#s2-tier1-regression`、`report-nl-atomic#s2-tier1-regression`、`report-video-block#s2-tier1-regression`、`report-workflow-structure#s2-tier1-regression`、`worktree-baton#s2-tier1-regression`。可见代表：[casey-demo](/mnt/d/ctx/heren/casey/loop/prd-casey-demo.json:34)、[ratchet-reverse-index](/mnt/d/ctx/heren/casey/loop/prd-ratchet-reverse-index.json:28)、[worktree-baton](/mnt/d/ctx/heren/casey/loop/prd-worktree-baton.json:34)。
- 你的 17 条全部成立，没有误判。
- `story id` 排除 `regression` 会漏 2 条：
  [wf-connect-nodes#s2-resign-and-regression](/mnt/d/ctx/heren/casey/loop/prd-wf-connect-nodes.json:26)、
  [wf-open-node#s2-resign-and-regression](/mnt/d/ctx/heren/casey/loop/prd-wf-open-node.json:26)。
  `b3bee6b` 前两者都是 `[p5-replay, e2e-chain, p3-compile, tier1]`，重裁删掉前三条后仍为 `passes:true`。

所以确定的 tier1 空心绿名单是 19 条：

- [btn-enable-ops#s1](/mnt/d/ctx/heren/casey/loop/prd-btn-enable-ops.json:16)、[chiefcomplaint-smoke#s1](/mnt/d/ctx/heren/casey/loop/prd-chiefcomplaint-smoke.json:26)、[e2e-chain#s1](/mnt/d/ctx/heren/casey/loop/prd-e2e-chain.json:16)、[kinds-harden#s1](/mnt/d/ctx/heren/casey/loop/prd-kinds-harden.json:16)、[p3-compile#s1](/mnt/d/ctx/heren/casey/loop/prd-p3-compile.json:37)、[plan-debt-sweep#s1](/mnt/d/ctx/heren/casey/loop/prd-plan-debt-sweep.json:16)、[regress-promptset#s1](/mnt/d/ctx/heren/casey/loop/prd-regress-promptset.json:16)、[replay-login-bootstrap#s1](/mnt/d/ctx/heren/casey/loop/prd-replay-login-bootstrap.json:17)、[replay-video#s1](/mnt/d/ctx/heren/casey/loop/prd-replay-video.json:20)、[report-diagnostics#s1](/mnt/d/ctx/heren/casey/loop/prd-report-diagnostics.json:16)、[run-convention#s1](/mnt/d/ctx/heren/casey/loop/prd-run-convention.json:22)、[run-history#s1](/mnt/d/ctx/heren/casey/loop/prd-run-history.json:16)、[sign#s1](/mnt/d/ctx/heren/casey/loop/prd-sign.json:18)、[video-login-carry#s1](/mnt/d/ctx/heren/casey/loop/prd-video-login-carry.json:17)、[wf-add-node#s3](/mnt/d/ctx/heren/casey/loop/prd-wf-add-node.json:37)、[wf-history-version#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-history-version.json:17)、[wf-open-smoke#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-open-smoke.json:16)，以及上述两条 `resign-and-regression`。

历史证据非常干净：19 条在 `b3bee6b^` 都含至少一个后来隔离的 executable；13 条合法 tier1 story 都不含。`b3bee6b` 的 `e2e-chain`、`sign`、两条 workflow diff 也直接显示“删实义金牌、留 tier1、保留 true”。

此外还有 6 条确定漏项，不是 tier1 形态：它们的描述明确承诺浏览器/E2E，而当前验收只剩 `flow-bridge.golden.mjs`：

- [drawer-lock-hardening#s1](/mnt/d/ctx/heren/casey/loop/prd-drawer-lock-hardening.json:22)
- [wf-add-node#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-add-node.json:16)
- [wf-connect-nodes#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-connect-nodes.json:16)
- [wf-open-node#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-open-node.json:16)
- [wf-select-node-dropdown#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-select-node-dropdown.json:16)
- [wf-set-node-field#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-set-node-field.json:20)

`flow-bridge` 可能证明编译登记这一小片，但生命周期设计自己已规定它不能替代 compile→events 或浏览器因果链，[plan.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:10)。因此这 6 条不是“命令完全毫无关系”，而是“相关但远不足以支撑 story-wide true”。

我还核到 26 条混合态当前为 true：它们保有至少一条表面相关的 residual acceptance，同时删掉过隔离义务。包括 `btn-enable-ops#s2`、`caseid-echo-mask#s2`、`chiefcomplaint-smoke#s2`、`compile-caseid-shape#s2`、`cred-route-mask#s1`、`drawer-lock-hardening#s2`、`ingest#s2`、`kinds-harden#s2`、`noerrenv-absence#s1/s2`、`output-seal#s1`、`p3-compile#s2`、`p4-drafter#s2`、`plan-debt-sweep#s2`、`regress-promptset#s2`、`replay-login-bootstrap#s2`、`replay-nth-visible-hardening#s2`、`replay-video#s2`、`report-diagnostics#s2`、`report-fidelity#s2`、`run-history#s2`、`wf-add-node#s2`、`wf-history-version#s2`、`wf-open-smoke#s2`、`wf-select-node-dropdown#s2`、`wf-set-node-field#s2`。

这里我只确认了“曾删隔离义务、当前仍 true”；没有执行这些 residual tests，故其残余覆盖充足性未核实。不能把它们一概叫“全不相干”，但单一 `passes:true` 确实掩盖了未覆盖部分。

整体闭合为：`b3bee6b` 影响 63 条 story、移除 168 个引用，[implementation-evidence.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md:9)；当前其中 51 true＝19 条 tier1 空心＋6 条核心不充分＋26 条混合，另 12 条保持 false。

## 2. 能否机械区分“被隔离掏空”与“本来就没有”？

能机械证明“被隔离拿掉过”，不能仅靠该信号证明“已完全掏空”。

可靠的历史判据应是：

```text
oldAcceptance ∩ signedIsolatedExecutables 非空
且
该交集中的命令确实在 b3bee6b diff 中被删除
```

这足以证明因果来源，不只是时间相关。对 19 条它还叠加了“删除后只剩 tier1”，因此已经足以判空心。

但“重裁前指向 27 件之一”本身不充分，反例很多：

- [output-seal#s1](/mnt/d/ctx/heren/casey/loop/prd-output-seal.json:16) 曾含隔离回归件，但当前仍有自己的 `output-seal.golden.mjs`，不能判为完全掏空。
- [btn-enable-ops#s2](/mnt/d/ctx/heren/casey/loop/prd-btn-enable-ops.json:26) 仍有 `p4-drafter` 与 `p2-check-vocab` 两个直接残余面。
- 27 个 source 中 21 个本来就是混合体；生命周期计划明确写了这一点，[plan.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:6)。

而且它还会漏：

- `b3bee6b` 后新落的 3 枚浏览器金牌；
- story 重命名或拆分；
- shell wrapper/聚合器间接启动旧 executable；
- acceptance 中不出现原路径、内部却间接 import/spawn 的情况。

真正充分的机械规则应落到原子义务：

```text
story 可绿 ⇔
每个有效 obligation
要么有 owner-bound 的 full 后继且该后继本轮 exit 0，
要么有已签 supersession 收据；
只要存在 retain-isolated / partial / uncertain 未闭合义务，
story-wide passes 就不得为 true。
```

当前仓有 obligation 血缘账，但没有 `storyId → obligationId → acceptance command` 的 owner 绑定，所以还不能完整机械判定。

## 3. 三类处置够不够？

不够，必须加“混合 story”第四类；而且你的 (b) 要拆成“当前无后继”和“本质上只能人验”。

| 类别 | 边界 |
|---|---|
| A 全量机器后继 | 每个有效义务都有已落盘、血缘正确、`coverageRelation:full` 的后继；partial 不算。 |
| B 人工义务 | 行为因果、视觉、时序等确实需浏览器/真机；哨兵＋`route:human`＋false。 |
| C 作废/被取代 | 必须有逐义务的人签 supersession 收据；“别的 PRD 看起来覆盖了”不够。 |
| D 混合 | 一部分有真实 zero-SUT 后继，另一部分仍 retain-isolated。必须拆 story 或改成义务级状态。 |

另应有一个临时状态“待重裁”：能机械化但后继尚未建成。它不是“只能人验”。

对上面的 19 条：

- 16 条对应 source 同时有 `survive-unit` 和 `retain-isolated`，属于 D；不能整条换哨兵，也不能整条配一个 unit 后继翻绿。
- `replay-login-bootstrap` 当前 8 条全 retain-isolated，但其中 3 条账面标了 `judgmentCanRunZeroSut:true`；`run-convention` 9 条中也有 4 条如此。因此它们是“待拆出机器后继＋剩余人工”，不是纯 B。[source-obligations](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json:4647)
- `video-login-carry` 的 5 条当前均依赖 SUT/browser，才最接近纯 B。
- 当前 `retire=0`，没有哪条能整 story 归 A；也没有证据支持把这 19 条整 story 归 C。

`52eb29b` 的哨兵做法对“当前没有合法完整机器面”是诚实的，但它是状态钉，不是“这些义务永远只能人验”的证明。

## 4. 是否应做机制修复？

应做，而且逐条修 17/19 不能替代机制修复。

建议分两层。

第一层是立即可落的结构判据：

- 空 `acceptance` 一律不能绿。schema 已经写了 `minItems:1`，[prd.schema.json](/mnt/d/ctx/heren/casey/loop/prd.schema.json:33)，但 gate 完全没校验 schema；当前循环从 `storyGreen=true` 开始，空数组直接真空翻绿。
- 空 `stories` 也不能让质量门禁报 GREEN。
- 非显式 `storyKind:tier1-regression` 的 story，acceptance 只剩 tier1 时拒绝翻绿。不要用 id 子串：它已经漏了两条，也可以靠改名绕过。
- acceptance 或义务映射变化后，旧 `passes/evidence` 自动失效。当前 evidence 只有时间戳，没绑定 acceptance digest；`b3bee6b` 删除命令却保留旧 true 正是实例。
- Test Ratchet/术语检查已红时，不得继续给 story 回写有效 true；或者至少把字段拆成 `acceptancePass` 与 `qualityGatePass`，禁止消费者混用。

空数组规则会碰到现役数据：当前 [prd-cli-mcp-face.json](/mnt/d/ctx/heren/casey/loop/prd-cli-mcp-face.json:12) 有两条空 acceptance；另有 8 份 `stories:[]` 的 PRD/注册表型文件。因此应先区分“可执行质量契约”和“注册/调查账本”，不能把后者继续伪装成可跑 PRD 后再用例外放行。

第二层才是根治“不相干命令也能绿”：

- acceptance 应声明它证明哪些 obligation，以及 `full|partial`；
- gate 只认 owner story 的 full 边；
- `retain-isolated` 应是结构化 manual hold，门禁不能靠“故意放一条失败哨兵”间接表达；
- surviving-unit 聚合绿只能证明 99 个 unit 全局可跑，不能自动给原 owner story 背书。

当前反向闭包正有这个漏洞：它为每个 surviving unit 取到聚合命令后，只检查该命令是否出现在“某一个” true story 中，[hermetic-golden-prd-reverse-closure](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs:92)。因此 lifecycle 的一个 s3 aggregate 就能满足全部 99 条全局存在性，却不证明任何原 PRD story 已获得后继。

先后关系应是：先加只读扫描器和反例测试、明确 13 条合法 tier1 例外；再拆分和重裁现有 19＋6＋混合项；最后把门禁判据切成 blocking。直接先硬封 tier1 会撞现役 13 条，直接先修 17 又会继续产生下一批同型。

## 5. 最大翻车风险

你担心的第一名仍成立：重新把 27 枚隔离 executable 塞回 acceptance，尤其加测试锁锁绿，直接违反 Steven 2026-07-19 的裁定，[HANDOFF.md](/mnt/d/ctx/heren/casey/docs/HANDOFF.md:804)。

除此之外，最大的是“部分后继洗成完整后继”：

1. 把 `hermetic-golden-surviving-units` 聚合命令挂给所有 story，或把 partial unit 当 full；机器会真绿，但 239 条隔离义务仍没被证明。
2. 只补“tier1-only”规则后，有人加第二条无关 exit-0 命令绕过；没有义务血缘，命令数量规则没有根治力。
3. 当前 census 已从 27 变成 30，但新增三枚尚未进入原子义务账；账本明确写了若入账将连带 4 条当前绿 story，需要人裁，[isolated-golden-acceptance-revocation plan](/mnt/d/ctx/heren/casey/docs/plans/isolated-golden-acceptance-revocation/plan.md:58)。它们目前是“未重裁”，不能假定有效，也不能擅自判隔离。
4. isolation sentinel 当前按静态路径会先因 `p3-compile`、`report-diagnostics` 两处摘要漂移 exit 65，而非设计态 exit 78，[sentinel](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-isolation-pending.zero-sut.golden.mjs:43)、[账本说明](/mnt/d/ctx/heren/casey/loop/prd-hermetic-golden-zero-sut-lifecycle.json:117)。它仍能守红，但若有人为“恢复 78”直接重签摘要，就可能替违规改动洗白。
5. 混合 story 整条换哨兵会把真实机器覆盖一并抹红，随后很容易诱发“为了恢复绿再删哨兵”的反复；正确做法是先拆义务。
6. acceptance 变更不使旧 evidence 失效，以及全局 gate 红仍能回写 story true，会继续制造陈旧绿，即使 19 条全修完。

全程只做了源码、账本与 git 历史静态核查，没有执行 acceptance、SUT 或浏览器，也没有修改文件。

**推荐执行顺序：先冻结 19＋6＋26 的审计清单并补门禁反例测试，再拆混合义务、处置具体 story，最后启用空数组／tier1 类型／owner 血缘／evidence digest 强制；最大风险是把隔离件或 partial 聚合包装成“完整机器后继”重新洗绿。**
tokens used
469,978
结论先说：你的 17 条是高精度命中，17 条里没有误判；但召回不完整。按同一形态应是 19 条，另外还有 6 条“只剩 flow-bridge、却仍宣称 E2E”的确定漏项。机制层确实存在系统性假绿入口。

先纠正两个前提：

- 隔离账不是 239 条全为 `uncertain + partialSuccessors:[]`。实数是 233 条 `uncertain`、6 条 `partial`；那 6 条有部分 unit 后继，但仍明确保留浏览器因果缺口、`agentExecution:forbidden`、`route:human`，所以不改变“不得重跑”的结论。[隔离账 partial 实例](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json:228)，汇总账为 349 条义务、99 survive-unit、239 retain-isolated、11 superseded、0 retire，[implementation-evidence.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md:3)。
- `passes:true` 并不代表整个 gate 绿。Test Ratchet 或术语检查已红时，`red` 会置真，但 story 回写仍只看 `storyGreen`，完全不看全局 `red`：[gate.mjs](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:50)、[gate.mjs](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:89)。所以“acceptance 全 exit 0 就写 true”是对的；若把 `passes` 解读为质量门禁整体通过，则前提不完整。

## 1. 17 条判据可信吗？

可信但只适合作为高精度探针，不适合作为完整判据。

我静态扫到同样的 32 条：`passes:true`、acceptance 恰一条且精确等于 tier1。对照 story 描述与 `b3bee6b^` 历史后：

- 13 条名副其实：它们在 `b3bee6b` 前本来就只有 tier1，义务明确是“新增门面不得破坏确定性内核/统一语言”：
  `casey-demo#s2-tier1-regression`、`gen-prompts#s2-tier1-regression`、`ingest-scaffold#s2-tier1-regression`、`loop-kit-extract#s5-tier1-regression`、`ratchet-reverse-index#s2-regression`、`record-capture#s2-tier1-regression`、`record-distill#s2-tier1-regression`、`record-intake#s2-tier1-regression`、`report-cleanup-evidence#s2-tier1-regression`、`report-nl-atomic#s2-tier1-regression`、`report-video-block#s2-tier1-regression`、`report-workflow-structure#s2-tier1-regression`、`worktree-baton#s2-tier1-regression`。可见代表：[casey-demo](/mnt/d/ctx/heren/casey/loop/prd-casey-demo.json:34)、[ratchet-reverse-index](/mnt/d/ctx/heren/casey/loop/prd-ratchet-reverse-index.json:28)、[worktree-baton](/mnt/d/ctx/heren/casey/loop/prd-worktree-baton.json:34)。
- 你的 17 条全部成立，没有误判。
- `story id` 排除 `regression` 会漏 2 条：
  [wf-connect-nodes#s2-resign-and-regression](/mnt/d/ctx/heren/casey/loop/prd-wf-connect-nodes.json:26)、
  [wf-open-node#s2-resign-and-regression](/mnt/d/ctx/heren/casey/loop/prd-wf-open-node.json:26)。
  `b3bee6b` 前两者都是 `[p5-replay, e2e-chain, p3-compile, tier1]`，重裁删掉前三条后仍为 `passes:true`。

所以确定的 tier1 空心绿名单是 19 条：

- [btn-enable-ops#s1](/mnt/d/ctx/heren/casey/loop/prd-btn-enable-ops.json:16)、[chiefcomplaint-smoke#s1](/mnt/d/ctx/heren/casey/loop/prd-chiefcomplaint-smoke.json:26)、[e2e-chain#s1](/mnt/d/ctx/heren/casey/loop/prd-e2e-chain.json:16)、[kinds-harden#s1](/mnt/d/ctx/heren/casey/loop/prd-kinds-harden.json:16)、[p3-compile#s1](/mnt/d/ctx/heren/casey/loop/prd-p3-compile.json:37)、[plan-debt-sweep#s1](/mnt/d/ctx/heren/casey/loop/prd-plan-debt-sweep.json:16)、[regress-promptset#s1](/mnt/d/ctx/heren/casey/loop/prd-regress-promptset.json:16)、[replay-login-bootstrap#s1](/mnt/d/ctx/heren/casey/loop/prd-replay-login-bootstrap.json:17)、[replay-video#s1](/mnt/d/ctx/heren/casey/loop/prd-replay-video.json:20)、[report-diagnostics#s1](/mnt/d/ctx/heren/casey/loop/prd-report-diagnostics.json:16)、[run-convention#s1](/mnt/d/ctx/heren/casey/loop/prd-run-convention.json:22)、[run-history#s1](/mnt/d/ctx/heren/casey/loop/prd-run-history.json:16)、[sign#s1](/mnt/d/ctx/heren/casey/loop/prd-sign.json:18)、[video-login-carry#s1](/mnt/d/ctx/heren/casey/loop/prd-video-login-carry.json:17)、[wf-add-node#s3](/mnt/d/ctx/heren/casey/loop/prd-wf-add-node.json:37)、[wf-history-version#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-history-version.json:17)、[wf-open-smoke#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-open-smoke.json:16)，以及上述两条 `resign-and-regression`。

历史证据非常干净：19 条在 `b3bee6b^` 都含至少一个后来隔离的 executable；13 条合法 tier1 story 都不含。`b3bee6b` 的 `e2e-chain`、`sign`、两条 workflow diff 也直接显示“删实义金牌、留 tier1、保留 true”。

此外还有 6 条确定漏项，不是 tier1 形态：它们的描述明确承诺浏览器/E2E，而当前验收只剩 `flow-bridge.golden.mjs`：

- [drawer-lock-hardening#s1](/mnt/d/ctx/heren/casey/loop/prd-drawer-lock-hardening.json:22)
- [wf-add-node#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-add-node.json:16)
- [wf-connect-nodes#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-connect-nodes.json:16)
- [wf-open-node#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-open-node.json:16)
- [wf-select-node-dropdown#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-select-node-dropdown.json:16)
- [wf-set-node-field#s1](/mnt/d/ctx/heren/casey/loop/prd-wf-set-node-field.json:20)

`flow-bridge` 可能证明编译登记这一小片，但生命周期设计自己已规定它不能替代 compile→events 或浏览器因果链，[plan.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:10)。因此这 6 条不是“命令完全毫无关系”，而是“相关但远不足以支撑 story-wide true”。

我还核到 26 条混合态当前为 true：它们保有至少一条表面相关的 residual acceptance，同时删掉过隔离义务。包括 `btn-enable-ops#s2`、`caseid-echo-mask#s2`、`chiefcomplaint-smoke#s2`、`compile-caseid-shape#s2`、`cred-route-mask#s1`、`drawer-lock-hardening#s2`、`ingest#s2`、`kinds-harden#s2`、`noerrenv-absence#s1/s2`、`output-seal#s1`、`p3-compile#s2`、`p4-drafter#s2`、`plan-debt-sweep#s2`、`regress-promptset#s2`、`replay-login-bootstrap#s2`、`replay-nth-visible-hardening#s2`、`replay-video#s2`、`report-diagnostics#s2`、`report-fidelity#s2`、`run-history#s2`、`wf-add-node#s2`、`wf-history-version#s2`、`wf-open-smoke#s2`、`wf-select-node-dropdown#s2`、`wf-set-node-field#s2`。

这里我只确认了“曾删隔离义务、当前仍 true”；没有执行这些 residual tests，故其残余覆盖充足性未核实。不能把它们一概叫“全不相干”，但单一 `passes:true` 确实掩盖了未覆盖部分。

整体闭合为：`b3bee6b` 影响 63 条 story、移除 168 个引用，[implementation-evidence.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md:9)；当前其中 51 true＝19 条 tier1 空心＋6 条核心不充分＋26 条混合，另 12 条保持 false。

## 2. 能否机械区分“被隔离掏空”与“本来就没有”？

能机械证明“被隔离拿掉过”，不能仅靠该信号证明“已完全掏空”。

可靠的历史判据应是：

```text
oldAcceptance ∩ signedIsolatedExecutables 非空
且
该交集中的命令确实在 b3bee6b diff 中被删除
```

这足以证明因果来源，不只是时间相关。对 19 条它还叠加了“删除后只剩 tier1”，因此已经足以判空心。

但“重裁前指向 27 件之一”本身不充分，反例很多：

- [output-seal#s1](/mnt/d/ctx/heren/casey/loop/prd-output-seal.json:16) 曾含隔离回归件，但当前仍有自己的 `output-seal.golden.mjs`，不能判为完全掏空。
- [btn-enable-ops#s2](/mnt/d/ctx/heren/casey/loop/prd-btn-enable-ops.json:26) 仍有 `p4-drafter` 与 `p2-check-vocab` 两个直接残余面。
- 27 个 source 中 21 个本来就是混合体；生命周期计划明确写了这一点，[plan.md](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:6)。

而且它还会漏：

- `b3bee6b` 后新落的 3 枚浏览器金牌；
- story 重命名或拆分；
- shell wrapper/聚合器间接启动旧 executable；
- acceptance 中不出现原路径、内部却间接 import/spawn 的情况。

真正充分的机械规则应落到原子义务：

```text
story 可绿 ⇔
每个有效 obligation
要么有 owner-bound 的 full 后继且该后继本轮 exit 0，
要么有已签 supersession 收据；
只要存在 retain-isolated / partial / uncertain 未闭合义务，
story-wide passes 就不得为 true。
```

当前仓有 obligation 血缘账，但没有 `storyId → obligationId → acceptance command` 的 owner 绑定，所以还不能完整机械判定。

## 3. 三类处置够不够？

不够，必须加“混合 story”第四类；而且你的 (b) 要拆成“当前无后继”和“本质上只能人验”。

| 类别 | 边界 |
|---|---|
| A 全量机器后继 | 每个有效义务都有已落盘、血缘正确、`coverageRelation:full` 的后继；partial 不算。 |
| B 人工义务 | 行为因果、视觉、时序等确实需浏览器/真机；哨兵＋`route:human`＋false。 |
| C 作废/被取代 | 必须有逐义务的人签 supersession 收据；“别的 PRD 看起来覆盖了”不够。 |
| D 混合 | 一部分有真实 zero-SUT 后继，另一部分仍 retain-isolated。必须拆 story 或改成义务级状态。 |

另应有一个临时状态“待重裁”：能机械化但后继尚未建成。它不是“只能人验”。

对上面的 19 条：

- 16 条对应 source 同时有 `survive-unit` 和 `retain-isolated`，属于 D；不能整条换哨兵，也不能整条配一个 unit 后继翻绿。
- `replay-login-bootstrap` 当前 8 条全 retain-isolated，但其中 3 条账面标了 `judgmentCanRunZeroSut:true`；`run-convention` 9 条中也有 4 条如此。因此它们是“待拆出机器后继＋剩余人工”，不是纯 B。[source-obligations](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json:4647)
- `video-login-carry` 的 5 条当前均依赖 SUT/browser，才最接近纯 B。
- 当前 `retire=0`，没有哪条能整 story 归 A；也没有证据支持把这 19 条整 story 归 C。

`52eb29b` 的哨兵做法对“当前没有合法完整机器面”是诚实的，但它是状态钉，不是“这些义务永远只能人验”的证明。

## 4. 是否应做机制修复？

应做，而且逐条修 17/19 不能替代机制修复。

建议分两层。

第一层是立即可落的结构判据：

- 空 `acceptance` 一律不能绿。schema 已经写了 `minItems:1`，[prd.schema.json](/mnt/d/ctx/heren/casey/loop/prd.schema.json:33)，但 gate 完全没校验 schema；当前循环从 `storyGreen=true` 开始，空数组直接真空翻绿。
- 空 `stories` 也不能让质量门禁报 GREEN。
- 非显式 `storyKind:tier1-regression` 的 story，acceptance 只剩 tier1 时拒绝翻绿。不要用 id 子串：它已经漏了两条，也可以靠改名绕过。
- acceptance 或义务映射变化后，旧 `passes/evidence` 自动失效。当前 evidence 只有时间戳，没绑定 acceptance digest；`b3bee6b` 删除命令却保留旧 true 正是实例。
- Test Ratchet/术语检查已红时，不得继续给 story 回写有效 true；或者至少把字段拆成 `acceptancePass` 与 `qualityGatePass`，禁止消费者混用。

空数组规则会碰到现役数据：当前 [prd-cli-mcp-face.json](/mnt/d/ctx/heren/casey/loop/prd-cli-mcp-face.json:12) 有两条空 acceptance；另有 8 份 `stories:[]` 的 PRD/注册表型文件。因此应先区分“可执行质量契约”和“注册/调查账本”，不能把后者继续伪装成可跑 PRD 后再用例外放行。

第二层才是根治“不相干命令也能绿”：

- acceptance 应声明它证明哪些 obligation，以及 `full|partial`；
- gate 只认 owner story 的 full 边；
- `retain-isolated` 应是结构化 manual hold，门禁不能靠“故意放一条失败哨兵”间接表达；
- surviving-unit 聚合绿只能证明 99 个 unit 全局可跑，不能自动给原 owner story 背书。

当前反向闭包正有这个漏洞：它为每个 surviving unit 取到聚合命令后，只检查该命令是否出现在“某一个” true story 中，[hermetic-golden-prd-reverse-closure](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs:92)。因此 lifecycle 的一个 s3 aggregate 就能满足全部 99 条全局存在性，却不证明任何原 PRD story 已获得后继。

先后关系应是：先加只读扫描器和反例测试、明确 13 条合法 tier1 例外；再拆分和重裁现有 19＋6＋混合项；最后把门禁判据切成 blocking。直接先硬封 tier1 会撞现役 13 条，直接先修 17 又会继续产生下一批同型。

## 5. 最大翻车风险

你担心的第一名仍成立：重新把 27 枚隔离 executable 塞回 acceptance，尤其加测试锁锁绿，直接违反 Steven 2026-07-19 的裁定，[HANDOFF.md](/mnt/d/ctx/heren/casey/docs/HANDOFF.md:804)。

除此之外，最大的是“部分后继洗成完整后继”：

1. 把 `hermetic-golden-surviving-units` 聚合命令挂给所有 story，或把 partial unit 当 full；机器会真绿，但 239 条隔离义务仍没被证明。
2. 只补“tier1-only”规则后，有人加第二条无关 exit-0 命令绕过；没有义务血缘，命令数量规则没有根治力。
3. 当前 census 已从 27 变成 30，但新增三枚尚未进入原子义务账；账本明确写了若入账将连带 4 条当前绿 story，需要人裁，[isolated-golden-acceptance-revocation plan](/mnt/d/ctx/heren/casey/docs/plans/isolated-golden-acceptance-revocation/plan.md:58)。它们目前是“未重裁”，不能假定有效，也不能擅自判隔离。
4. isolation sentinel 当前按静态路径会先因 `p3-compile`、`report-diagnostics` 两处摘要漂移 exit 65，而非设计态 exit 78，[sentinel](/mnt/d/ctx/heren/casey/tests/_golden/hermetic-golden-isolation-pending.zero-sut.golden.mjs:43)、[账本说明](/mnt/d/ctx/heren/casey/loop/prd-hermetic-golden-zero-sut-lifecycle.json:117)。它仍能守红，但若有人为“恢复 78”直接重签摘要，就可能替违规改动洗白。
5. 混合 story 整条换哨兵会把真实机器覆盖一并抹红，随后很容易诱发“为了恢复绿再删哨兵”的反复；正确做法是先拆义务。
6. acceptance 变更不使旧 evidence 失效，以及全局 gate 红仍能回写 story true，会继续制造陈旧绿，即使 19 条全修完。

全程只做了源码、账本与 git 历史静态核查，没有执行 acceptance、SUT 或浏览器，也没有修改文件。

**推荐执行顺序：先冻结 19＋6＋26 的审计清单并补门禁反例测试，再拆混合义务、处置具体 story，最后启用空数组／tier1 类型／owner 血缘／evidence digest 强制；最大风险是把隔离件或 partial 聚合包装成“完整机器后继”重新洗绿。**
exit=0
