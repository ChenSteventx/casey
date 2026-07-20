# GRILL — hermetic-golden-zero-sut-lifecycle（阶段二：hermetic 金牌套件生命周期重裁）

> 车道 full（kernel 纪律，碰冻结金牌套件的生命周期归属）。前置：阶段一 admission-trust-root-separation 已收口（六阶段 done + codex 六轮 PASS）。方向源 `docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md` 阶段二节。
>
> 决策树逐支 grill，每支 Steven 亲裁（AskUserQuestion 记录）。plan 落定后按 Steven 2026-07-20 指令找 codex gpt-5.6-sol high 讨论到共识，再走 accept。

## 背景 grounding（承重发现，重塑契约形状）

只读 Explore 子代理对 zero-SUT 转化模式取料，逼出一个推翻 DIRECTION 原「(a) zero-SUT = 主力出路」假设的发现：

**对「replay/compile 行为金牌」，zero-SUT 转化 ≈ 删掉金牌。**

- 它们的 **verdict 裁定覆盖与 `tests/_golden/p2-verdict.golden.mjs` 完全冗余**：都映射到 `verdict-cases.json` 8 冻结案；现役已有三套 zero-SUT 骨架（p2-verdict / intent-event-fold / replay-entity-anchor）喂冻结 axes 给 `bin/verdict.mjs`（该文件无 exports、只 spawn）。转 zero-SUT 那份覆盖零损失但也零增量。
- 它们的**独有价值是 replay/compile 行为覆盖**：replay→三轴 StepAxes 保真、只读漂移探针、CDP 网络取证按发起方归因、compile→events 保真。转 zero-SUT 恰好删掉这份增量。
- 而这份行为覆盖**没有 zero-SUT 出路**：agent 侧确定性产冻结 axes 的唯一路 = 回放 fake-sut 采样，被 `SKILL.md:107` 禁（fake-sut 只读、任何 agent 不得启动/连接/回放）；只剩手写合成（不证 replay）或真机 UAT（证 replay）。

即约 21 个行为金牌（A 组 15 待转 + C 组 6；flow-bridge 已纯化、p5-replay-coverage 已合规、replay-settle-mount 已迁完不计）的生命周期终点只能是 **(b) 真机 UAT 墓碑** 或 **(c) 教义作废墓碑**，不是 (a) zero-SUT。

## 决策树

### D1（根）— 阶段二形状 [Steven 2026-07-20 裁 = 墓碑行为金牌→真机 UAT]

> grounding 逆出：zero-SUT 对行为金牌近乎空转。阶段二实质 = 墓碑化 + 保真覆盖移交真机 UAT，非转 zero-SUT。

裁决：**(A) 墓碑行为金牌 → 真机 UAT**。承认 ~21 行为金牌不能 hermetic 跑（SKILL.md:107），其 verdict 覆盖已由 p2-verdict 保留；逐个墓碑化（`superseded-tombstoned-not-pass` 收据、原 story 保持 false、命名后继）+ replay/compile 保真覆盖显式移交真机 UAT（route:human，ADR-0009 升必过闸）。合 SKILL.md + ADR-0009，代价是 hermetic 浏览器套件退役、覆盖名义上移 route:human。

### D2 — 覆盖保真纪律 [Steven 2026-07-20 裁 = 逐金牌证子集再墓碑]

裁决：**逐金牌 subsumption 审核再墓碑**。每个行为金牌墓碑前核其 verdict 映射断言确已被 `p2-verdict.golden.mjs` 冻结案收纳；只把 replay/compile 行为保真那部分移真机 UAT。发现 verdict 缺口（某金牌有 p2-verdict 未含的裁定案）→ 先用 zero-SUT 扩充 p2-verdict 再墓碑。不把已 hermetic 覆盖的 verdict 案伪称丢去、不银派未证实的覆盖损失。

### D3 — 真机 UAT 后继存在性 [Steven 2026-07-20 裁 = 先墓碑、后继 route:human-pending]

裁决：**先墓碑、后继标 route:human-pending**。每金牌现在就墓碑（换成 zero-SUT 墓碑断言 exit 78）+ observability 声明命名的真机 UAT 后继为 route:human-pending（延给 Steven）。诚实延迟：hermetic 金牌本就不该被 agent 跑（SKILL.md:107），退役不阻真机准入；保真覆盖白纸黑字记 route:human 待真机。与阶段一真机 UAT 同样 route:human 延迟一致。agent 侧可在 dev 收口。

### D4 — 墓碑机制 [循仓内先例，plan 时定形]

不新造：复用 `tests/_golden/fixtures/semantic-lock-cert-closure/supersession-revocation.json` 先例形（`ratchetStatus:"superseded-tombstoned-not-pass"`、marker `SECURITY_REVOKED_GOLDEN_TOMBSTONE` exit 78）。要点：墓碑体走 zero-SUT（不启动 fake-sut，故 gate 可安全跑它——解「gate 不得跑 fake-sut 金牌」的死结）、exit 非零 → gate 权威写 `passes:false`；原 story 保持 false + superseded 标注 + observability route:human 后继。plan 时核 gate 对 exit 78 的实际处置与冻结形。

### D5 — (b) 真机 UAT vs (c) 教义作废归类 [循教义、plan 时逐金牌定]

准则：(c) 仅当金牌所验行为不再是真需求（教义已死）；否则 (b)。DIRECTION 已划：p5 drift/vanished 两案 = (c)（属本契约，出案级吊销 + 后继 PRD 承 8 存活案，需 ADR-0004 人签）；自愈 liveness（护栏 #13 无活触发器）= **出本契约范围**，另立自愈 liveness 契约。逐金牌归类是 plan 清点工作。

### D6 — 本契约 scope [Steven 2026-07-20 裁 = 全 27 一次扫净]

只读 Explore 静态清点逼出：实际启动 fake-sut 的金牌是 **27 个**（不止方向文档估的 ~21），DEBT-REGISTER 台账不全——A 组 ~17 核心 + D 组 7（登录/发布/视频）+ **3 未归账**（regress-promptset / report-diagnostics / run-convention，台账根本没列的 zero-SUT 违规面）。且 `replay-settle-mount` 台账记「波1 已迁 16/16 绿」是陈旧记录——原路径已被 Steven 作废回滚，磁盘现文件仍启动 fake-sut、prd `passes:false`，未真迁。

裁决：**全 27 一次扫净**。都面临同一墓碑命运（不能 hermetic 跑、保真覆盖移真机 UAT），统一墓碑教义、一次诚实清偿全部陈旧绿基础债（含台账遗漏的 3 个洞）。代价是批量大，但墓碑操作机械均质、subsumption 共享 p2-verdict/flow-bridge 基线；避免后续契约协调风险与遗留陈旧绿。

### D7 — 真机 UAT 迁移机制 scope [Steven 2026-07-20 裁 = 延给未来存证契约]

codex R5 逼出：完整定义「story 如何 false→true」需在本契约内造一整套真机 UAT 证据存证 + 可信签名 + 触发 registry + append-only 迁移 ledger——而可信 signer 机制仓内不存在（P4 signerId 至今挂人审 `prd-p4-freeze.json:15-16`），且真机本轮不实跑。

裁决：**延给未来存证契约**。本契约只交：墓碑 + 拆存活 zero-SUT 覆盖 + 冻结 manifest（不可变 UAT 定义+血缘、checksum 锁、精确账清移了什么）+ 移交覆盖用 loop-kit designed 机制 `observability` route:human 承接（声明、人签、非命令门）。false→true 的存证/签名/ledger 机制**另立命名后续契约**（配合 P4 signerId 落地时做）。无 vaporware（manifest 精确冻结账）、无假绿（诚实 route:human）、scope 干净、尽快进 accept。这消解 R5 的 receipt 可执行定义（③）与 ledger（④）两残留——由延迟消解、非本契约建。

### D8 — 无完整后继的敌意行为覆盖 [Steven 2026-07-20 裁 = 先试桩页转化，剩余隔离不墓碑]

第一次逐 check 静态盘点发现 31 条没有可兑现后继的敌意行为覆盖；随后逐条追到生产判据，得到 19 条可经桩页触达、6 条须先抽纯入口、6 条真 browser-bound。关键不在 19/6/6 的可达性，而在覆盖关系：**31/31 的替代形态都只能覆盖判据分支，不能完整覆盖敌意 DOM 形态生成、Playwright 可见性/句柄语义、MutationObserver 时序、CLI 落盘接线或完整编排中的至少一项。**

裁决：可提取的 zero-SUT 判据覆盖照建，作为净新增保护；但只要原子义务没有 `full` 等价后继，原行为覆盖必须进入隔离清单，原 executable 从所有 PRD acceptance 移除，绝不以 UAT 名义假称已接管，也不进入墓碑闭集。隔离项保持诚实未绿，任何 agent 不得执行；是否由人手工复现另走 route:human。只有完整等价或教义明确作废的原子义务才有资格退役。

### D9 — 对其余去向声明做等价性抽样 [仓代码复核 = D1 收窄为逐原子 full 门]

隔壁 workflow `wf_7dd51d2d-c0a` 虽在界面显示 completed，机读结果实际为 `completed:0`：44/44 子任务均因会话额度中断，不能继承为证据。本 session 以同一 44 条样本重新静态核验，严格把 `full` 定义为“后继可完整顶替、移除原义务无损”，结果：

- 现役 zero-SUT 声明：6 `full` / 18 `partial`；
- 拟真机 UAT：3 `full` / 5 `partial` / 2 `uncertain`；
- 拟新增 unit：7 `full` / 3 `partial`；
- 合计 16 `full` / 26 `partial` / 2 `uncertain`。拟 UAT 与拟 unit 尚未落盘，按当前仓“已有可替代”口径只有现役 6 条成立。

抽样同时坐实两个结构问题：① `wf-*` 四条旧 `COMPILE_KNOWN_ATOMS.size===18` 已被当前 25 项事实推翻，属于教义 supersession，不能伪称 subsumption；② `p2-sign C5`、`e2e-chain C4`、`p3-compile C4` 等单个 check 同时承载纯闸与 live execute，多处复合 check 不能以 checkId 作原子键。

裁决落点：D1 的文件级/批量墓碑前提被推翻，收窄为**先统一 atomization，再逐原子义务过 full-equivalence 门**。义务键至少为 `(sourceGolden, sourceCheckId, subObligationId)`；同一旧 check 可拆出多个互补后继。`partial` 只算新增覆盖、原义务留隔离；`uncertain` fail-closed 留隔离；教义作废单独走 supersession，不混入完整覆盖统计。

## 决策树收口

D1/D2/D3/D6/D7 五承重叉 Steven 亲裁完毕；D8 由 Steven 裁为“先试桩页转化，剩余隔离不墓碑”；D9 的代码复核把 D1 收窄成逐原子 `full` 门。D4/D5 循仓内先例与教义定形。此前 plan/codex 多轮硬化出的独立闭集、血缘边元组与突变红证仍有效，但生命周期已由二分改为“存活 unit / 完整退役 / 隔离保留 / 教义作废”四类，不能再把全部 behavior 一次墓碑。
