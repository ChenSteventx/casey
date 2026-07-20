总判：有阻断项，当前 plan 不可进入 accept。

本轮只做了静态、只读核验；没有运行任何 golden/gate，没有启动、连接或回放假 SUT。

## 逐条结论

1. 冗余声明真伪：成立，Critical 阻断

`p2-verdict` 只对 `p5-replay` 的裁定结果形成明确冗余：

- p5 的 10 案逐案声明映射到 8 个冻结案，[replay-cases.json:2](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/p5/replay-cases.json:2)；runner 也明确先产 axes，再校验 verdict，[p5-replay.golden.mjs:62](/mnt/d/ctx/heren/casey/tests/_golden/p5-replay.golden.mjs:62)、[p5-replay.golden.mjs:95](/mnt/d/ctx/heren/casey/tests/_golden/p5-replay.golden.mjs:95)。
- 但 `kinds-harden` 根本不测 verdict 冗余：它在 zero-SUT 单元层钉死 `textVisible`、`noErrorToast` 的命中、未命中、证不出语义，[kinds-harden.golden.mjs:28](/mnt/d/ctx/heren/casey/tests/_golden/kinds-harden.golden.mjs:28)。整文件墓碑会直接删掉这些有效纯函数覆盖。
- 同类问题不止一处：`btn-enable-ops` 前半钉词表、断言评估矩阵和草拟映射，[btn-enable-ops.golden.mjs:29](/mnt/d/ctx/heren/casey/tests/_golden/btn-enable-ops.golden.mjs:29)、[btn-enable-ops.golden.mjs:37](/mnt/d/ctx/heren/casey/tests/_golden/btn-enable-ops.golden.mjs:37)、[btn-enable-ops.golden.mjs:66](/mnt/d/ctx/heren/casey/tests/_golden/btn-enable-ops.golden.mjs:66)。这些既不是 replay 保真，也不被 `p2-verdict` 收纳。

`flow-bridge` 的冗余声明明确不成立：

- 它只检查 flow 形状、mapping 顺序和 intent 覆盖，[flow-bridge.golden.mjs:57](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:57)、[flow-bridge.golden.mjs:113](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:113)。
- 所谓 round-trip 只跑 compile 闸段并确认落了 `flow-<caseId>.json`，[flow-bridge.golden.mjs:69](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:69)。它没有 `--execute`，不读 `events.json`，更没有 events 字节级或结构级保真。
- `p3-compile` 实际钉的是 events 顶层字段、事件数、atom、intent、stepId、稳定定位和模板纪律，[p3-compile.golden.mjs:181](/mnt/d/ctx/heren/casey/tests/_golden/p3-compile.golden.mjs:181)、[p3-compile.golden.mjs:190](/mnt/d/ctx/heren/casey/tests/_golden/p3-compile.golden.mjs:190)。
- 工作流金牌还钉精确事件序列和原子参数，例如 [wf-add-node.golden.mjs:121](/mnt/d/ctx/heren/casey/tests/_golden/wf-add-node.golden.mjs:121)、[wf-select-node-dropdown.golden.mjs:132](/mnt/d/ctx/heren/casey/tests/_golden/wf-select-node-dropdown.golden.mjs:132)。

因此 [plan.md:37](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:37) 的 `auxiliarySuccessor: flow-bridge` 是高估；compile→events 覆盖目前全部只能记入真机 UAT-pending。整文件墓碑前还必须拆出 mixed golden 中已有的纯函数覆盖。

2. 墓碑机制诚实性：需补证，High 阻断

`exit 78 + passes:false` 能诚实消除“陈旧绿”；问题是拟议 meta-golden 尚未闭合：

- plan 只要求“读收据后逐条检查 marker、fs、archive、exit 78”，[plan.md:31](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:31)，没有要求收据集合恰等于冻结的 27 路径、数量恰为 27。
- 因此“只删墓碑体、保留收据项”应当红，但“同时删收据项和墓碑体”可能漏过。
- plan 的 meta 描述没有明确复核实际墓碑字节等于 `tombstoneSha256`；该字段只出现在收据设计，[plan.md:28](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:28)。
- 仓内先例会硬断收据数量为 2，[observation-unsafe-golden-revocation.zero-sut.golden.mjs:24](/mnt/d/ctx/heren/casey/tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs:24)，并在 spawn 前先验 marker/archive，[同文件:32](/mnt/d/ctx/heren/casey/tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs:32)，还用 canonical sentinel 检查执行副作用，[同文件:54](/mnt/d/ctx/heren/casey/tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs:54)。新 plan 没把这些强度全部写进验收。

修法：meta 必须冻结精确 27 路径闭集及数量，核 executable/archive/tombstone sha，墓碑体最好限制为无 import 的规范模板；accept 时必须实际做删体、删 marker、改 exit、篡 archive、加 fs/child_process、副删“收据项+体”等 mutation，逐个证明必红。

3. D2 subsumption 审核：成立，High 阻断

当前审核不足以防静默丢覆盖：

- 工序明确写的是“静态比对 verdict 映射断言”，[plan.md:44](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:44)。
- 验收只要求一份散文证据表，[plan.md:63](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:63)。
- 它没有逐 `check`/逐 case 的输入谓词、输出和副作用语义比较；也没有覆盖 mixed golden 的纯函数子测试。
- `p2-verdict` 本身也不是完整裁判分支基线：`verdict.mjs` 仍有 `phase==='compile' && affordanceAbsent` → `CASE_DEFECT` 分支，[verdict.mjs:94](/mnt/d/ctx/heren/casey/bin/verdict.mjs:94)，而源码直接承认该分支“无 golden 钉”。

修法：产出机读、闭集的逐子测试覆盖矩阵，而非逐文件散文：

`原 golden/check → 输入条件 → 精确断言 → zero-SUT successor/check 或 UAT case → successor 当前状态`

任何行无 successor 必须阻断墓碑；compile 类不能再自动映射到 `flow-bridge`。

4. output-seal：需补证；R 组分类正确，但修复定义不够

它确实不启动夹具 SUT，死端口只是预启动闸探针，因此不应进 T 组。

但 plan 没指出真正的假绿位置：

- A9 仍会先在 compile caseId 重验处退出，[output-seal.golden.mjs:115](/mnt/d/ctx/heren/casey/tests/_golden/output-seal.golden.mjs:115)、[compile.mjs:145](/mnt/d/ctx/heren/casey/bin/compile.mjs:145)。
- A10 仍在 replay 身份准入前先过签名和 caseId 绑定闸，[output-seal.golden.mjs:124](/mnt/d/ctx/heren/casey/tests/_golden/output-seal.golden.mjs:124)、[replay.mjs:203](/mnt/d/ctx/heren/casey/bin/replay.mjs:203)。
- 真正被抢跑的是 B5：它用 `workflow.create`，[output-seal.golden.mjs:214](/mnt/d/ctx/heren/casey/tests/_golden/output-seal.golden.mjs:214)，该 atom 被准入策略认作 mutation，[entity-semantic-lock-preflight.mjs:42](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:42)，无冻结 authority 会在登录凭据失败分支之前拒绝，[同文件:783](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:783)、[replay.mjs:256](/mnt/d/ctx/heren/casey/bin/replay.mjs:256)。

修法：把 B5 改为准入允许的固定路由只读事件 `nav.workflowManagement`，保留原“登录预备动作失败、种子不回显”的原因断言，并加启动哨兵不存在。不能只改成“任意 exit 65”。

5. 真机 UAT 延迟诚实性：成立，High 阻断

D3 允许“不实跑”，这个延迟本身诚实；但现在只有名字，不足以证明 successor 真存在：

- plan 只要求拟一个案标识和一句描述，[plan.md:45](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:45)。
- 真机执行整体排除在范围外，[plan.md:54](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:54)。
- 验收只检查 observability 里有 route-human 声明，[plan.md:64](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:64)。

这能公开覆盖真空，但不能防止永久 vaporware。gzip 归档是旧 fake-SUT 测试代码，不等于定义好的真机 UAT。

修法：墓碑前先冻结一个真实存在的 UAT manifest/PRD；每案至少含唯一 ID、来源 golden/check、archive sha、前置条件、自然语言步骤、预期证据、对应不变量、owner、`route:human-pending`、`passes:false`。可以不跑，但不能只留字符串。

6. p5-replay 双处置：成立，High 阻断

当前方案存在两处不一致：

- 8 个存活案仍然证明真实 replay→axes→verdict 链，[p5-replay.golden.mjs:62](/mnt/d/ctx/heren/casey/tests/_golden/p5-replay.golden.mjs:62)；不能变成 hermetic successor PRD。它们必须是上述真机 UAT-pending。
- plan 的 p5 后继只写“语义锁 v2 successor + p2-verdict”，[plan.md:120](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:120)，没有明确承接 8 案的 replay 保真 UAT。
- 更严重的是 plan 要求每个墓碑 PRD 的 `stories[].passes==false`，[plan.md:62](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:62)。但 `prd-p5-replay` 当前 s1 为 false、s2 的纯确定性 `p5-replay-coverage` 为 true，[prd-p5-replay.json:27](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:27)、[prd-p5-replay.json:39](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:39)。把所有 story 翻 false 会制造新的假红，并与 plan 所称“不动 p5-replay-coverage”冲突。

正确链应为：

- 原 s1：保持 false/superseded；
- 原 s2 pure coverage：保持活体，由 gate 实跑后维持 true；
- drift/vanished：案级吊销，指语义锁 successor + p2 verdict；
- 8 存活 replay 案：新 UAT successor PRD，`route:human-pending/passes:false`；
- 新 PRD 不得把墓碑 executable 当 acceptance，也不得以 p2 verdict 冒充 replay 保真。

如此无循环。

7. 清点完备性：需补证，Medium 阻断

当前磁盘上我静态复核到四个 fixture helper 的直接消费者确实是 27 个；表内实际也是 9 replay + 9 compile + 6 登录发布 + 3 未归账 = 27。

但有两个问题：

- 标题写成“T 组 26 个”，[plan.md:71](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:71)，与表和 D6 的 27 冲突，足以造成实施漏一项。
- “grep 四个 server import”只证明直接引用，不能证明间接 helper、动态 import、子进程 server、非标准本地 listener 不存在。现有 `replay-video` 自己还会额外 `createServer().listen()`，[replay-video.golden.mjs:349](/mnt/d/ctx/heren/casey/tests/_golden/replay-video.golden.mjs:349)，说明“行为端口”不必都来自四个 fixture helper。

修法：accept 前增加静态依赖闭包扫描，对全部 golden 入口检查 fixture server、`node:http/net` listener、Playwright/browser launch、子进程启动及 `--sut` 数据流；结果须与冻结的 27 项闭集严格相等，多一个或少一个都红。并把“26”订正为“27”。

## 阻断项排序

1. Critical：撤销“p2/flow-bridge 已完整冗余”结论；按子测试拆 mixed golden，保留已有 zero-SUT 单元覆盖，compile→events 一律先记 UAT-pending。
2. High：把 D2 从散文静态比对改成闭集、机读、逐子测试的 subsumption 账。
3. High：墓碑前先建立可验证存在的 UAT manifest；p5 的 8 存活案必须进入该清单。
4. High：p5 改为 story 级处置，绝不能把仍合规的 s2 pure coverage 翻 false。
5. High：meta-golden 加精确 27 集合、tombstone sha、无副作用规范体和真实 mutation 红证。
6. Medium：明确 output-seal B5 的原因级修法及浏览器启动哨兵。
7. Medium：修正 26/27 冲突，并增加依赖闭包清点器。

诚实划界：拟议 meta-golden、收据和 successor PRD 尚未生成，因此无法实际 mutation-run；我也没有逐条替作者完成 27 文件的全量 subsumption 矩阵。恰因为这张矩阵尚不存在，当前 plan 不能进入 accept。