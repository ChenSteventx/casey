总判：**仍有阻断项，v2 暂不可进入 accept**。

R1 的 Critical 级错误结论已经撤销，但 v2 尚缺三个 High 级闭环：源子测试闭集、跨 PRD 反向依赖处置、真机 UAT 的可消费生命周期。

## 逐条复核

1. F1 冗余高估：仍残留，High

已消解部分：

- `flow-bridge` 已明确降为 flow-gate 层，不再冒充 events 保真；compile→events 全部进入真机 UAT，[plan.md:13](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:13)。
- 混合金牌先拆 zero-SUT 子测试再墓碑行为壳，方向正确，[plan.md:19](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:19)、[plan.md:26](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:26)。

残留：

- 混合金牌不止点名的 `kinds-harden`、`btn-enable-ops`。至少还有：
  - `replay-settle-mount`：U1–U7 是 stub page 的 zero-SUT 单元覆盖，[replay-settle-mount.golden.mjs:72](/mnt/d/ctx/heren/casey/tests/_golden/replay-settle-mount.golden.mjs:72)，到 I1 才启动 fake SUT，[同文件:199](/mnt/d/ctx/heren/casey/tests/_golden/replay-settle-mount.golden.mjs:199)。
  - `wf-publish-states`：U1–U3、D1 是词表/评估/草拟纯覆盖，[wf-publish-states.golden.mjs:41](/mnt/d/ctx/heren/casey/tests/_golden/wf-publish-states.golden.mjs:41)、[同文件:82](/mnt/d/ctx/heren/casey/tests/_golden/wf-publish-states.golden.mjs:82)，I0 才启动 publish SUT，[同文件:144](/mnt/d/ctx/heren/casey/tests/_golden/wf-publish-states.golden.mjs:144)。
  - `chiefcomplaint-smoke`：U1–U5 是断言纯函数覆盖，[chiefcomplaint-smoke.golden.mjs:34](/mnt/d/ctx/heren/casey/tests/_golden/chiefcomplaint-smoke.golden.mjs:34)，I1 才启动 chat SUT，[同文件:123](/mnt/d/ctx/heren/casey/tests/_golden/chiefcomplaint-smoke.golden.mjs:123)。
  - `regress-promptset`、`report-diagnostics` 也同型，[regress-promptset.golden.mjs:45](/mnt/d/ctx/heren/casey/tests/_golden/regress-promptset.golden.mjs:45)、[同文件:161](/mnt/d/ctx/heren/casey/tests/_golden/regress-promptset.golden.mjs:161)、[report-diagnostics.golden.mjs:62](/mnt/d/ctx/heren/casey/tests/_golden/report-diagnostics.golden.mjs:62)、[同文件:168](/mnt/d/ctx/heren/casey/tests/_golden/report-diagnostics.golden.mjs:168)。
- v2 虽要求“逐子测试一行”，但没有独立、机械冻结的“原子覆盖义务闭集”。删掉矩阵一行后，“所有剩余行都有 successor”仍会全绿，[plan.md:55](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:55)、[plan.md:77](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:77)。

修法：先冻结 `source-obligations` 清单，含稳定 check ID、源 span、原文件 sha、类别；矩阵 key 集必须与该清单严格相等，并对删行、加行、重复 ID 做 mutation 红证。混合金牌清单应由该闭集推导，不能只靠示例。

2. F2 meta-golden：已消解

- 收据集合严格等于冻结墓碑闭集且数量硬断，能抓住“同删收据项+墓碑体”，[plan.md:40](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:40)。
- marker、规范体、archive sha、tombstone sha、exit 78、无副作用均逐项检查，[plan.md:41](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:41)。
- mutation 电池已明确覆盖删体、删 marker、改 exit、篡 archive、加能力、同删收据项+体、收据增减，[plan.md:42](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:42)。
- 强度已达到并超过仓内先例的数量硬断、spawn 前 marker、archive sha 和 canonical sentinel，[observation-unsafe-golden-revocation.zero-sut.golden.mjs:24](/mnt/d/ctx/heren/casey/tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs:24)、[同文件:32](/mnt/d/ctx/heren/casey/tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs:32)、[同文件:54](/mnt/d/ctx/heren/casey/tests/_golden/observation-unsafe-golden-revocation.zero-sut.golden.mjs:54)。

实现时“规范模板”应做 exact/AST allowlist，不能仅靠几个禁词正则；但这不再是 plan 阻断项。

3. F3 D2：仍残留，High

矩阵字段形态已经正确：输入条件、精确断言、successor、状态俱全，[plan.md:55](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:55)。

但“机读闭集”目前只是自称闭集，没有第二个独立源集合与矩阵做严格等集校验，因此仍无法防静默删行；这与 F1 的混合漏拆是同一个承重缺口。

CASE_DEFECT 补法本身正确：

- 源分支是 `ap===false`、无取证、非 drift 后，`phase==='compile' && affordanceAbsent===true` → `NEEDS_HUMAN/CASE_DEFECT`，[verdict.mjs:91](/mnt/d/ctx/heren/casey/bin/verdict.mjs:91)、[verdict.mjs:96](/mnt/d/ctx/heren/casey/bin/verdict.mjs:96)。
- `p2-verdict` 已是合成 axes 驱动的纯确定性基线，fixture 增一案即可钉住该分支，[p2-verdict.golden.mjs:22](/mnt/d/ctx/heren/casey/tests/_golden/p2-verdict.golden.mjs:22)、[同文件:39](/mnt/d/ctx/heren/casey/tests/_golden/p2-verdict.golden.mjs:39)。

修法同 F1：独立冻结 source-obligations，并要求 `matrix.keys === obligations.keys`；accept 增删矩阵行 mutation。

4. F4 output-seal：仍有可执行性残留，Medium

原因定位正确：B5 的 mutation atom 会在登录预备失败前被准入拒绝；改用只读事件并保留原因断言、启动哨兵，方向正确，[plan.md:72](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:72)。

但只改 atom 不够。当前 B5 的信封和事件 URL 都是 `/plain`，[output-seal.golden.mjs:214](/mnt/d/ctx/heren/casey/tests/_golden/output-seal.golden.mjs:214)。无 authority 的 `nav.workflowManagement` 还要求：

- 信封 URL 属于固定白名单；
- event URL 与信封 URL 相等；
- action 为 `nav`；
- 无 `pre`。

见 [entity-semantic-lock-preflight.mjs:54](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:54)、[同文件:62](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:62)。否则仍会在登录前被 `REPLAY_READ_EVENT_TARGET_INVALID` 抢跑。

修法：明确把信封和 event URL 同改为 `{{baseUrl}}/ai-manager/process/list` 或 `/workflow` 的合法固定信封，`action:"nav"`、无 `pre`；设置现成 `CASEY_LAUNCH_SENTINEL`，断 exit 65、登录预备原因、种子不回显、哨兵不存在。并把此项补入验收点；当前 [plan.md:74](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:74) 后没有 output-seal 验收条目。

5. F5 真机 UAT manifest：仍残留，High

v2 已消除“只留字符串”的 vaporware：manifest 要有真实 case、完整字段、矩阵引用存在，[plan.md:44](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:44)、[plan.md:46](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:46)。

但它还不足以防“永久 pending”：

- 允许普通 docs JSON 或 PRD 二选一，未要求 manifest 必须进入某个 PRD 的 `testChecksums`/ratchet；
- 只校验矩阵→manifest，未要求收据 successor→manifest 及 manifest→来源 obligation 的双向闭合；
- 除 p5 外，没有要求所有 UAT case 都有可被 loop 消费的 successor story；
- 明确不实跑且没有触发里程碑、证据回填 schema 或状态迁移门，[plan.md:86](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:86)。

修法：固定唯一 manifest 路径并 checksum 冻入新 `prd-hermetic-retired-uat`；每个 UAT case 对应一个保持 `passes:false` 的 successor story，acceptance 不得引用墓碑；矩阵、收据、manifest case 三集合双向严格闭合；定义 human evidence 字段、执行触发点和 false→true 的人签迁移条件。本轮仍可不跑真机，但不能只生成无人消费的 JSON。

6. F6 p5 双处置：p5 本体已消解；仓库级仍残留并新暴露 High 问题

p5 自身链正确：

- s1 保持 false/superseded；
- s2 纯覆盖保持 true；
- 8 存活案进入新 UAT successor；
- 不拿墓碑或 `p2-verdict` 冒充 replay 保真。

见 [plan.md:60](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:60)、[plan.md:64](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:64)。这也符合当前真实状态：[prd-p5-replay.json:29](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:29)、[同文件:40](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:40)、[同文件:46](/mnt/d/ctx/heren/casey/loop/prd-p5-replay.json:46)。

新暴露的仓库级问题：v2 没有扫描所有 PRD acceptance 的反向引用。许多既有 story 同时引用多个待墓碑金牌和存活覆盖。例如 `prd-chiefcomplaint-smoke` s2 同时接受 `kinds-harden`、`p5-replay`、存活的 `p5-replay-coverage`、`layer3-wiring`、`run-history`，[prd-chiefcomplaint-smoke.json:28](/mnt/d/ctx/heren/casey/loop/prd-chiefcomplaint-smoke.json:28)、[同文件:32](/mnt/d/ctx/heren/casey/loop/prd-chiefcomplaint-smoke.json:32)。墓碑后：

- 保持该 story true，会因多个 exit 78 自动红；
- 整 story 翻 false，又会把仍存活的 `p5-replay-coverage` 一起制造成假红。

`prd-replay-video` 的 regression story 也有同型多金牌 acceptance，[prd-replay-video.json:31](/mnt/d/ctx/heren/casey/loop/prd-replay-video.json:31)、[同文件:35](/mnt/d/ctx/heren/casey/loop/prd-replay-video.json:35)。

修法：增加 `loop/prd-*.json` acceptance 反向依赖闭包；对每个引用墓碑路径的 story 做 story 内拆分或用活 successor 替换 acceptance。校验“所有墓碑路径不再出现在任何 true story acceptance”，同时保持剩余活体检查所属 story 真态。当前 [plan.md:37](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:37) 和 [plan.md:83](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:83) 只有原则，没有这道机械闭包。

7. F7 清点：replay-video 已覆盖；严格性仍残留，Medium

已消解部分：

- 明确扫描 `node:http/net` listener，且点名 `replay-video` 的 `createServer().listen()`，[plan.md:50](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:50)、[replay-video.golden.mjs:349](/mnt/d/ctx/heren/casey/tests/_golden/replay-video.golden.mjs:349)。
- 26/27 冲突已订正，手工 27 仅作候选、扫描结果才是权威，[plan.md:92](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:92)、[plan.md:108](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:108)。

残留/新引入问题：

- “扫描器结果等于由扫描器首次产出的冻结闭集”是同源自证；扫描器若漏识别一种启动方式，冻结集也会同步漏掉。
- 判据还需区分安全的前置闸探针。例如 `admission-audience-wiring` 真传了 `--sut` 死地址，[admission-audience-wiring.golden.mjs:35](/mnt/d/ctx/heren/casey/tests/_golden/admission-audience-wiring.golden.mjs:35)，但用启动哨兵机械证明浏览器未启动，[同文件:44](/mnt/d/ctx/heren/casey/tests/_golden/admission-audience-wiring.golden.mjs:44)。粗粒度 `--sut` 数据流会把它误列为墓碑对象。
- 多个 zero-SUT/static golden 只读取源码并搜索 `chromium.launch` 字符串；扫描器若不是 AST/调用数据流级也会误报。

修法：给扫描器建立独立 detector fixture/mutation 电池，至少覆盖直接/间接 helper、re-export、dynamic import、别名 `createServer/listen`、拼装/展开的 child argv、`--sut` 传递，以及带 `CASEY_LAUNCH_SENTINEL` 的安全前置闸反例。扫描器输出须同时给出命中原因和 source span；accept 要证明每种正控必入、负控必不入，再与仓库冻结闭集比较。

## 阻断项排序

1. High：为 subsumption 增加独立冻结的源子测试/覆盖义务闭集，并与矩阵严格等集。
2. High：扫描所有 `loop/prd-*.json` acceptance 反向引用，拆开含墓碑和活体检查的混合 story。
3. High：把 UAT manifest 纳入 checksum/PRD ratchet，并建立收据—矩阵—manifest—successor story 双向闭环。
4. Medium：把 output-seal B5 的完整合法只读信封及验收点写实。
5. Medium：给依赖闭包扫描器增加独立正负控和 mutation 红证，消除同源自证。

诚实划界：本轮仅做静态只读核验，没有运行任何 golden/gate，也没有启动、连接或回放假 SUT；拟议扫描器、矩阵、墓碑收据和 UAT manifest 尚未生成，因此无法核其实现质量或真实 mutation 结果。