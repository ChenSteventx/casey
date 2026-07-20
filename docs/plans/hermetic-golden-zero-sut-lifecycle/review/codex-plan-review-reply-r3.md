总判：**仍有阻断项，v3 暂不可进入 accept**。

R2-F4、F6、F7 已在计划设计层消解；F1/F3 与 F5 仍各有一个 High 级闭环缺口，其中包含 v3 新引入的集合定义冲突和双状态问题。

## 逐条复核

1. R2-F1/F3：仍残留，High；新引入集合定义冲突

已消解部分：

- 独立 `source-obligations` 已明确到 check 粒度，包含源 span、原文件 sha 和 category，[plan.md:29](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:29)。
- 矩阵删行、加行、重复 ID 的突变红证已进入验收，[plan.md:74](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:74)。如果实现采用 `matrix.keys === obligations.keys`，删矩阵一行确实会红。
- 混合金牌清单改由 category 推导，不再依赖示例枚举，[plan.md:31](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:31)。

阻断：

- 四集合公式自相矛盾：同一行先要求 `fake-sut-behavior obligations ⇔ matrix 全部行`，随后又要求 `matrix.keys === 全部 obligations.keys`；后者还包含 `zero-SUT-unit`，[plan.md:37](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:37)、[plan.md:39](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:39)。两条不可能同时成立。
- 收据 successor 也不是单一 UAT 集：收据允许同时指向 manifest UAT 和存活 unit golden，[plan.md:47](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:47)，但闭合公式又把全部 `收据.successors` 与 `manifest.cases` 严格等同，[plan.md:39](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:39)。
- 文中称“四集合”，实际链上是 obligations、matrix、receipt successors、manifest cases、successor stories 五个集合，也反映出分区尚未定清。
- category 的 check 级归因缺专门正负控。现有 detector 电池只承诺覆盖“启动方式”和“安全前置闸”，[plan.md:25](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:25)、[plan.md:27](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:27)。但真实混合形态包含“服务器在 check 外启动，多个后续 check 共享”的情况：[btn-enable-ops.golden.mjs:84](/mnt/d/ctx/heren/casey/tests/_golden/btn-enable-ops.golden.mjs:84)，行为 checks 从 [btn-enable-ops.golden.mjs:103](/mnt/d/ctx/heren/casey/tests/_golden/btn-enable-ops.golden.mjs:103) 延续至 [btn-enable-ops.golden.mjs:131](/mnt/d/ctx/heren/casey/tests/_golden/btn-enable-ops.golden.mjs:131)。仅命中启动 span 不能机械证明哪些 check 依赖该 SUT；当前主要靠“+人复核”兜底。

具体修法：

- 固定 `matrix.keys === obligations.keys`。
- 分区校验：
  - zero-SUT 行严格对应存活 unit check；
  - fake-SUT 行才进入 UAT receipt→manifest→story 链。
- 给 receipt successor 增加明确类型，例如 `kind:unit-golden|uat-case`，分别做严格等集。
- detector 验收增加 check 归因 fixture：check 前共享启动、check 内启动、纯 check 位于启动前、共享资源跨多个 check 等正负控。

2. R2-F5：仍残留，High；新引入双状态源

已消解部分：

- manifest 路径唯一并纳入新 PRD checksum/ratchet，[plan.md:33](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:33)。
- 每个 UAT case 对应一条 `passes:false` successor story，并要求证据、触发、人签迁移门，[plan.md:35](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:35)、[plan.md:79](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:79)。这比 v2 的游离 JSON 明显进了一步。

阻断：

- manifest case 自身含 `route:"human-pending", passes:false`，PRD successor story 又另有 `passes:false`，[plan.md:35](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:35)。这是两个状态源。
- manifest 同时被 checksum 冻结；未来 PRD story 变 true 后，manifest 是继续永久 `passes:false`，还是修改并重签，没有定义。前者留下陈旧状态，后者使“冻结用例定义”和“运行状态”混为一体。
- “定义 evidence schema、触发里程碑、迁移门”目前仍是待实现承诺，没有给出证据产物路径、签名/哈希绑定关系以及可执行的 true 条件，[plan.md:35](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:35)。验收点只要求 schema 字段完备，[plan.md:79](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:79)，一个字段齐全但从未执行的 case 仍可永久 pending。

具体修法：

- manifest 只存不可变 UAT 定义和来源血缘，删除 `passes` 等运行状态。
- PRD story 成为唯一当前状态源。
- 另定义不可变、人签的 evidence receipt：固定路径、case/manifest hash、真实 run 证据引用、signer、signedAt、build、结论。
- successor story 的 acceptance 必须运行确定性 validator；只有有效 receipt 且满足明确命名的触发条件才 exit 0，由 gate 把 story 翻 true。

3. R2-F6：消解

- v3 明确扫描全部 `loop/prd-*.json` 的 story acceptance，并要求逐个拆分混合 story，[plan.md:52](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:52)。
- 机械不变量同时包含“true story 不再引用墓碑”和“存活检查 story 保持真态”，[plan.md:54](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:54)、[plan.md:80](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:80)。
- 这能覆盖 R2 两个实证：
  - `prd-chiefcomplaint-smoke` s2 的多金牌混引，[prd-chiefcomplaint-smoke.json:28](/mnt/d/ctx/heren/casey/loop/prd-chiefcomplaint-smoke.json:28)、[prd-chiefcomplaint-smoke.json:32](/mnt/d/ctx/heren/casey/loop/prd-chiefcomplaint-smoke.json:32)。
  - `prd-replay-video` s2 的多金牌混引，[prd-replay-video.json:31](/mnt/d/ctx/heren/casey/loop/prd-replay-video.json:31)、[prd-replay-video.json:35](/mnt/d/ctx/heren/casey/loop/prd-replay-video.json:35)。

在当前 PRD 中，acceptance 均为字符串命令，未发现额外的对象/数组型反向引用形态。实现质量和实际闭包结果仍待 accept 产物核验。

4. R2-F4：消解

- v3 已把 B5 信封和 event URL 同改为固定只读路由，明确 `action:"nav"`、无 `pre`、exit 65、原因、种子遮蔽和哨兵断言，[plan.md:56](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:56)、[plan.md:58](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:58)。
- 当前准入实现确实允许该组合：白名单包含 `/ai-manager/process/list`，并要求 event/document URL 相等、action=nav、无 pre，[entity-semantic-lock-preflight.mjs:57](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:57)、[entity-semantic-lock-preflight.mjs:62](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:62)。
- 只读准入发生在登录凭据加载前，[replay.mjs:239](/mnt/d/ctx/heren/casey/bin/replay.mjs:239)、[replay.mjs:256](/mnt/d/ctx/heren/casey/bin/replay.mjs:256)；启动哨兵又在其后，[replay.mjs:356](/mnt/d/ctx/heren/casey/bin/replay.mjs:356)。因此该修法不会再被 `REPLAY_READ_EVENT_TARGET_INVALID` 抢跑，并能命中预期登录预备失败分支。

5. R2-F7：消解，限计划设计层

- detector 已明确 AST/调用数据流、间接 helper、re-export、dynamic import、别名 listener、子进程 argv 和命中 span，[plan.md:23](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:23)。
- 独立正负控、mutation 电池、人复核冻结集三者共同存在，不再只是“扫描器输出等于扫描器首次自产集合”，[plan.md:27](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:27)、[plan.md:73](/mnt/d/ctx/heren/casey/docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md:73)。
- 安全前置闸的现成代表确有死址、哨兵缺席和明确原因断言，[admission-audience-wiring.golden.mjs:35](/mnt/d/ctx/heren/casey/tests/_golden/admission-audience-wiring.golden.mjs:35)、[admission-audience-wiring.golden.mjs:44](/mnt/d/ctx/heren/casey/tests/_golden/admission-audience-wiring.golden.mjs:44)。

这里仅认定“同源自证”的计划缺口已补；check 级 category 归因不足已单列在 F1/F3。

诚实划界：本轮只做静态只读复审，没有运行 golden/gate，也没有启动、连接或回放任何 SUT。拟议扫描器、三个闭集、矩阵、收据、manifest、UAT PRD 和 mutation 证据均尚未生成，因此以上判断只覆盖 v3 设计是否闭合，不代表实现质量已通过。