# codex 异构评审请求 — hermetic-golden-zero-sut-lifecycle plan（阶段二）

你是异构评审家族（gpt-5.6-sol high），评审 Claude 设计的 plan。铁律：**对抗式找漏，默认怀疑**——不是背书，是逼出设计缺陷。不确定就判「需补证」。此前阶段一你（codex）六轮逐轮逮出 Claude 自审看漏的洞（弱证/假绿：断言拒了≠为对的原因拒、产物缺席≠没执行到那一步），本轮同样标准。

## 评审目标（文件白名单，只读这些 + 核其引用）

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（主审对象）
- `docs/plans/hermetic-golden-zero-sut-lifecycle/GRILL.md`（决策树 D1–D6，Steven 亲裁）
- `docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md`（方向来源，你上轮参与）
- `docs/plans/replay-admission-hermetic-migration/DRIFT-VANISHED-DECISION.md`（C 组处置来源）

允许只读访问仓库**核验 plan 的承重声明**（不要漫游、不要改任何文件）：可读 `tests/_golden/*.golden.mjs`、`tests/_golden/fixtures/**`、`loop/prd-*.json`、`.claude/skills/casey/SKILL.md` 来验证据是否成立。

## 背景（Casey 内核不变量）

Casey = LLM 驱动「文本用例→测试报告」确定性回放测试系统。硬规则：裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结断言只读、改动需人签（ADR-0004）；`loop/prd-*.json` 的 `passes` 只有 `gate.mjs` 有权写。`SKILL.md:107` 铁律：假被测系统（fake-sut）与夹具 SUT 只读源码、任何 agent 不得启动/连接/回放；golden/gate/selftest 仅在可证不启动/不连接/不回放任何假 SUT 时才允许跑。

## 阶段二问题

准入门 enforcement 提交（9ee2731/dfee72c，2026-07-17）落地未复跑浏览器回放金牌 → 整套 hermetic 浏览器金牌 runtime-RED 但 prd `passes:true`（陈旧绿，基础债）。这些金牌启动 fake-sut，按 SKILL.md:107 任何 agent 不得跑。

Steven 亲裁的决策树（GRILL D1–D6）：墓碑行为金牌 → 真机 UAT（非转 zero-SUT）；逐金牌证映射覆盖⊆基线再墓碑；先墓碑、真机后继 route:human-pending；全 27 金牌一次扫净。

## 承重风险清单（请逐条对抗式核，这是评审重点）

1. **冗余声明真伪**：plan 断言「行为金牌的 verdict/compile 映射覆盖与 p2-verdict/flow-bridge 冗余，墓碑不丢覆盖」。逐行为类型核：① `p2-verdict` 的 8 冻结案是否真收纳 replay 类金牌（如 p5-replay/kinds-harden）的 verdict 断言？② `flow-bridge` 是否真覆盖 compile 类金牌（wf-add-node/p3-compile）的 compile→events 保真？还是 flow-bridge 只做「集计数/映射」、根本不含 events 字节级保真——若是，则 compile 类金牌的覆盖**全部**移真机 UAT、plan 的「auxiliarySuccessor: flow-bridge」是**高估**（伪称有 hermetic 基线保留）。这是最可能的设计漏洞。

2. **假绿风险（墓碑机制是否真诚实）**：墓碑体 exit 78 + passes:false 是否真解决陈旧绿，还是只是把覆盖损失藏起来？meta-golden（拟 `hermetic-golden-retired-tombstones.zero-sut.golden.mjs`）是否真能在墓碑不诚实时红（marker 缺、归档 sha 失配、体 exit 0、体带 fs 写能力）？它的 enforcement 能否被反例突变证伪（删掉某墓碑体 → meta-golden 必红）？对照仓内先例 `observation-unsafe-golden-revocation.zero-sut.golden.mjs` 的机械验强度。

3. **D2 subsumption 审核是否足够**：plan 说墓碑前逐金牌审「verdict 覆盖⊆基线，缺口先 zero-SUT 扩基线」。这个审核是静态比对断言文本，还是要证语义等价？若某金牌验的 verdict 案不在 8 案内，审核能否可靠逮出、防静默丢覆盖？

4. **output-seal 碳出正确性**：plan 把 output-seal 划 R 组（死端口 127.0.0.1:1、不启动 fake-sut、zero-SUT 重验非墓碑）。核：它真不启动任何 SUT 吗？新准入门下它的 honest 断言该是什么？划 R 组（契约内可修）而非 T 组（墓碑）对吗？

5. **真机 UAT 延迟诚实性**：D3 先墓碑、真机后继标 route:human-pending。这是诚实延迟还是造了永不兑现的覆盖真空？后继只是命名（未定义真机案）够不够？还是墓碑该至少阻塞在「定义出真机 UAT 案」（哪怕不跑）才算不 vaporware？

6. **p5-replay 双处置一致性**：p5-replay 既是墓碑（启动 fake-sut）又含案级吊销（drift/vanished 教义作废）。8 存活案的 successor PRD——那 8 案也是 replay 行为、同样不能 hermetic 跑，故 successor PRD 也是真机 UAT-pending。这个链是否自洽、有无循环或假绿？

7. **清点完备性**：plan 信 Explore 静态清点的 27 金牌 + 3 台账未归账。这是启动 fake-sut 金牌的**完整**集吗？枚举法（grep import 四夹具 server）会不会漏掉间接启动、或非标准端口启动的？

## 产出

逐条风险给结论（成立/不成立/需补证）+ file:line 证据。总判：plan 可进 accept，还是有阻断项须先改。阻断项按严重度排序，每条给具体修法。诚实划界哪些是你没核到的。
