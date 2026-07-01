# 接缝冻结 v2 —— grill 决策包

> 状态：草稿 / 未冻 / 待 grill-with-docs 拍板，勿当已决。
>
> 用途：把三份精修草稿（`1-run-history.grill.md`、`2-action-vocabulary.grill.md`、`3-failure-ledger.grill.md`）里的承重决策抽出来，逐条给「决策陈述 / 可选项 / 权衡 / 推荐 + 依据 / 是否需人签」，供真起 `grill-with-docs` 契约时直接照单拍板，减少现场展开论证的时间。本文件本身不冻结、不登记 `CONTEXT.md`、不改任何草稿之外的文件。
>
> 依据来源：本目录三份 grill 草稿 + 其 schema/fixture、已冻 `tests/_golden/schemas/`（`events`/`observed-reality`/`report-model`/`drift-patch`/`expected-frozen`）与 `tests/_golden/fixtures/seams/`、`loop/prd.schema.json`、`loop/prd-seams-freeze.json`（第一层先例）、`CONTEXT.md`、`docs/adr/0002/0004/0005/0007`、`loop/GUARDRAILS.md`、`docs/plans/seams-freeze/grill.md`（light 车道判据先例）、`loop-kit/bin/contract.mjs`（lane 判定矩阵）。

## 如何读本文件

每条决策统一给五项：

1. 决策陈述
2. 可选项（A/B…）
3. 各选项权衡（对齐既有约定/ADR/护栏，逐条给出根据）
4. 推荐项 + 依据
5. 标注：**需人签的真承重决策** 或 **可机械定**——前者指没有强先例、涉及真实设计权衡，机械比对已冻范式解不出来；后者指已冻范式/护栏/ADR 里已有清晰、一致的先例或硬性规则，比对即可定，现场不必展开辩论。

---

## seam1：run-history.jsonl / run-metrics.json

### 决策 1.1 —— `cacheStatus` 保留还是整删

**决策陈述：** `run-history.jsonl` 单行是否保留 `cacheStatus` 字段（及 `run-metrics.json` 的 `cacheHitRate`），承载「本次回放所加载冻结产物是否复用自既有编译产物」的溯源信号。

**可选项：**

- A（草稿倾向）：保留字段名，重定语义为编译产物复用溯源标记，枚举 `hit`/`miss`/`stale`/`bypass`，纯回放恒 `bypass`；`cacheHitRate` 同生共死，无缓存参与时为 `null`（非 0）。
- B：整删 `cacheStatus`/`cacheHitRate`，编译产物复用溯源全部归编译期证据（如另开一个编译侧字段），`run-history` 只保留「这次实际发生了什么」。

**权衡：**

- 已冻姊妹接缝（`observed-reality`/`drift-patch`/`report-model`/`expected-frozen`）里没有「借一个回放期字段名、重定义成编译期语义」的先例；相反它们的字段都直接对应回放期真实事实（如 `drift-patch` 的 `locatorBefore`/`locatorAfter`、`status` 状态机）。方案 A 的「留字段名、换语义」做法在这批已冻范式里找不到对照。
- `events.schema.json` 已有编译期 provenance 字段的现成先例：`compiledBy`（「编译来源标识...仅 provenance，不进裁定」）。如果确实需要「编译产物是否复用」这个可观测点，`compiledBy` 式的编译期字段是更贴合已冻分层原则的落点，而不是塞进回放期证据接缝。
- 方案 A 的代价是留一个语义错位字段——回放期字段名却记编译期事实，纵有 schema 描述强约束，仍会让未来读者/新代理第一眼误判成「回放期解析缓存」，与草稿自己承认的「Stagehand 的 cacheStatus 原样塞进来会语义错位」矛盾未真正解除，只是移到描述文字里兜底。
- 方案 B 的代价是丢掉一个诊断点（编译产物复用溯源），但该诊断点目前在编译期也没有对应产物承接（`compile.log` 未见于已冻列表），即便删掉也不构成信息倒退——只是这次不建它，需要时可另起一个编译期字段，不必挤占回放期接缝的纯粹性。
- 这是草稿自己标注「本接缝最该被拷打的一条」的真实设计张力，两个选项都自洽，机械比对已冻范式给不出唯一解——已冻范式提示方向（方案 B 更贴合分层原则），但不构成强制。

**推荐：** 倾向方案 B（整删），若 grill 认为诊断价值不能丢，退而求其次是登记一个新的、明确挂在编译期的 provenance 字段（类比 `compiledBy`），不复用 `cacheStatus` 这个名字，避免回放期字段承载编译期语义。若最终仍选方案 A（保留+重定义），至少要把「纯回放恒 `bypass`、`cacheHitRate` 无缓存参与恒 `null`」的不变量钉进 schema（草稿已做到）。

**标注：需人签的真承重决策。**

---

### 决策 1.2 —— 字段名 `method` 还是 `action`

**决策陈述：** `run-history.jsonl` 记录动作类型的字段该叫 `method`（草稿现状）还是跟随已冻 `events.schema.json` 的 `action`。

**权衡：** 已冻 `events.schema.json#/definitions/event/properties/action` 的字段名就是 `action`，枚举与草稿 `method` 字段的枚举逐字相同（`click`/`dblclick`/`fill`/`selectOption`/`press`/`nav`/`newpage`）。这是同一概念的同义双名，ADR-0005 统一语言强制的机制正是为了消灭这类翻译损耗；`CONTEXT.md` 是唯一事实源，没有理由在下游证据接缝另起一个名字表示同一件事。

**推荐：** 改 `method` → `action`。

**标注：可机械定。** 无设计权衡空间，纯粹是遵循已确立的 ADR-0005/`CONTEXT.md` 统一语言规则，比对已冻 `events.schema` 即可定。

---

### 决策 1.3 —— `intentId` 形态：严格 pattern 还是宽松 `minLength:1`

**决策陈述：** `run-history.jsonl` 的 `intentId` 字段该用 `^intent_[0-9]+$`（草稿现状，跟随已冻 `events.schema` 源头形态）还是 `minLength:1`（跟随下游姊妹接缝的宽松形态）。

**权衡（已核实已冻范式的实际写法，草稿原文对此的转述不够准确）：**

- `events.schema.json`（intentId 的产出源头，编译期唯一权威）：`pattern: "^intent_[0-9]+$"`。
- `observed-reality.schema.json`（下游消费者）：`minLength: 1`，无 pattern。
- `report-model.schema.json`（下游消费者，报告层）：`type: ["string","null"]`，更宽松，甚至允许为 `null`。
- `drift-patch.schema.json`（下游消费者，自愈层）：纯 `string`，无 pattern 无 minLength。
- `expected-frozen.schema.json`（下游消费者，断言契约层）：纯 `string`。
- 即：已冻范式里是**源头钉紧格式，全部四个下游消费接缝一律放宽**，没有一个下游接缝复刻源头的严格 pattern。这是一致且非偶然的分层惯例——下游不重复上游的格式校验，格式权威只在编译产出的 `events.schema` 一处；下游只信任「非空字符串」，避免格式一旦在编译期演进，所有下游都要连带改动。
- `run-history.jsonl` 的地位是回放期证据接缝，与 `observed-reality`（同样是回放/编译期证据）同类，不是产出 `intentId` 的权威接缝。草稿目前推荐反向（跟随源头严格 pattern），与已确立的四出一致先例相悖。

**推荐：** 改用 `minLength: 1`，与 `observed-reality` 对齐，不跟随 `events.schema` 的严格 pattern。

**标注：可机械定。** 已冻范式有 4/4 一致先例可直接比对，不构成开放式权衡；草稿现状与先例方向相反，grill 现场应当场纠正。

---

### 决策 1.4 —— 本接缝走 `full` 车道还是 `light` 车道

**决策陈述：** `run-history`/`run-metrics` 这条接缝的 `contract init --lane` 该选 `full`（实质 grill）还是 `light`（跳过实质 grill，直接进 plan/accept）。

**权衡：**

- `loop-kit/bin/contract.mjs` 的车道判定矩阵：`light` 只加一道 plan 门（`edit-impl` 需 plan、`commit-impl` 需 loop、`push` 需 loop）；`full` 走全链（`edit-impl` 需 accept、`push` 需 review）。
- 第一层 `seams-freeze` 的 `grill.md` 明文写下 `light` 车道的判据：「本契约只新增接缝 schema + 合成 fixture + golden 校验器 + prd，不碰任何已冻内核 impl……无争议设计——五条接缝的形状已在并行起草中扎根 design+regress+已冻 P2、并经用户冻前人审定案。故不做实质 grill。」核心判据是「无争议、形状已在别处扎根」。
- `run-history` 不满足这条判据：它自身携带真实的开放设计张力（决策 1.1 `cacheStatus` 语义错位，尚无强先例可机械推定）和一条凭据红线（`fill`/`press` 值打码），且是 `0-INDEX.md` 里被点名「最该被拷打的开放问题」的那一条——这正是 `full` 车道要解决的「把张力 grill 到收口、把术语登记 `CONTEXT.md`」，与「照抄已定形状」的第一层 `light` 车道场景不同。

**推荐：** `full`。

**标注：可机械定**（对照第一层 `light` 车道判据，结论明确、无需现场辩论是否满足「无争议」前提——草稿自己已举证不满足）；但车道选择本身要通过 `contract init` 走一遍仪式性登记，且需与 action-vocabulary、failure-ledger 是否同批过 `full` 一并在 grill 现场确认（见下方"批次范围"说明）。

> 批次范围提示（非独立决策项，供 grill 现场参考）：三条草稿同目录、同 `0-INDEX.md`、大概率会在同一次 `grill-with-docs` session 里一并过。若 seam1 定为 `full`，通常整批（含 seam2/seam3）也会在同一次 session 走完实质 grill，不必逐条重复走三次 `contract init`；具体是否合并成一次 `full` grill 覆盖三条接缝，还是分三次，属于 grill 现场的编排细节，非本文档要拍板的承重决策。

---

## seam2：action-vocabulary（动作词汇表）

### 决策 2.1 —— 动作真值源钉在 `events.schema` 枚举还是驱动 `actionSpace`

**决策陈述：** 「哪些动作存在」这件事的单一事实源，钉在已冻 `events.schema` 的 `action` 枚举，还是钉在 `channelDriver.actionSpace` 的能力声明。

**权衡：**

- `events.schema.json#/definitions/event/properties/action` 已冻、已是数据层唯一事实源，枚举 7 个动作。
- `channelDriver`/`actionSpace` 目前不存在——`0-INDEX.md` 把它列入「后置接缝（随 canvas / arbitrary 维度，本轮不起草）」，`2-action-vocabulary.grill.md` 自己也说它是「v2 待登记的新接缝」。单一事实源不能钉在一个尚未定义、尚未落地的概念上。
- 断言词汇表的对称先例（kind 权威活在代码 `bin/check.mjs`，schema 只镜像）不能整体照搬到动作侧，因为动作侧的权威载体（`events.schema`）已经是数据 schema 而非代码——这是草稿自己指出的「一处真实不对称」，但这处不对称不影响当下结论：现状唯一可钉的锚点就是已冻 `events.schema` 枚举。

**推荐：** 钉在已冻 `events.schema` 枚举；`action-vocabulary` 是挂在枚举上的治理投影层，配一条 `Quality Gate` 校验 `entries[].action ⊆ events.schema` 枚举。将来 `channelDriver` 真落地后，二者的分工关系（草稿 Q4 已给出「词汇表=字典，`actionSpace`=某驱动会的子集」）需要再校准一次，但不影响现在把权威钉在 `events.schema` 这一步。

**标注：可机械定。** 当前只有一个已冻、已存在的候选锚点，比对现状即可定；`channelDriver` 落地后的二次校准是另一次决策，不在本轮范围。

---

### 决策 2.2 —— `channelDriver` 是否与 `action-vocabulary` 同批 co-grill

**决策陈述：** 本轮 grill 要不要把 `channelDriver`（及其 `actionSpace` 边界）也一并纳入讨论范围，而不是照 `0-INDEX.md` 原排期推迟到「随 canvas / arbitrary 维度」的后续批次。

**权衡：**

- `2-action-vocabulary.grill.md` 明确提出一个真实顾虑：「`channelDriver` 本身也是 v2 待登记的新接缝……二者的边界应在同一轮 grill 一并定，避免一个先冻、另一个被它框死。」这是一条没有被 `0-INDEX.md` 排期采纳的意见——`0-INDEX.md` 把 `channelDriver` 列入本轮不起草的后置接缝。
- 若本轮只冻 `action-vocabulary`、不碰 `channelDriver` 边界，`action-vocabulary` 里的 `channels`（词汇表层可用 channel 集合）与 `driver.channelDriver`（provenance 指针）两个字段就要接受「未来 `channelDriver` 落地后可能需要回头校准」的风险——但这风险是可控的，因为词汇表本身是加性治理文档、非破坏性 schema，回头校准不触 Test Ratchet。
- 若把 `channelDriver` 拉进本轮 co-grill，范围会显著扩大（`0-INDEX.md` 已把它和视觉模板合同一起列为「随 canvas / arbitrary 维度」的后置批次，理由未展开但明显是刻意分批控制单次 grill 规模），且 `channelDriver` 目前连草稿都没有——本轮备料任务不包含它，临时拉入会打乱既定的分批节奏。
- 这是一个关于「本轮聚焦 vs 提前扩大范围」的排期取舍，没有客观对错，取决于对 `channelDriver` 紧迫度、当前 `action-vocabulary` 是否能安全地「先冻、后校准」的判断——不是机械比对能给出唯一答案的问题。

**推荐：** 维持 `0-INDEX.md` 原排期，`channelDriver` 留后置批次不纳入本轮，`action-vocabulary` 按「加性治理文档、非破坏性、可回头校准」的性质先行；在 `action-vocabulary` 的 `driver`/`channels` 字段描述里显式注明「与 `channelDriver` 的最终边界待其落地后二次校准」，把风险显式记下而非隐藏。

**标注：需人签的真承重决策。** 涉及本轮 grill 范围是否扩大，属排期/资源取舍，非机械可定。

---

### 决策 2.3 —— 现在冻成纯治理文档 还是 等 `channelDriver` 落地再冻

**决策陈述：** `action-vocabulary` 现在就冻（作为纯治理文档、零 schema 改动、覆盖现有 7 个动作），还是等 `channelDriver`/`actionSpace` 落地后再一起冻。

**权衡：**

- `action-vocabulary` 草稿里的 `driver.channelDriver`/`driver.call` 字段只是 provenance 字符串指针（如 `"web/_data_runner"`），指向「哪个已存在的实现驱动了这个动作」，不依赖尚未存在的 `channelDriver` 新接缝本身——二者是两回事：一个是「引用一个实现名字的字符串字段」，一个是「一整套驱动能力声明的新数据契约」。
- `action` 名集的权威已经钉在已冻 `events.schema`（决策 2.1），与 `channelDriver` 是否存在无关；新增动作本就该是「改 `events.schema` 枚举 + 驱动 + golden」的一次显式棘轮事件，不因 `action-vocabulary` 冻结与否而改变。
- 与第一层 `seams-freeze` 先例一致：先冻 schema + 合成 fixture（数据契约），不等下游/相邻概念全部落地。`action-vocabulary` 现有 7 个动作、`golden` 字段已指向真实存在的 `tests/_golden/p5-replay.golden.mjs` + `tests/_golden/fixtures/p5/replay-cases.json`（已核实这两个文件存在），具备可冻结的完整闭环，不缺前置依赖。
- 等 `channelDriver` 落地再冻的代价是无限期搁置（`channelDriver` 落地时间未定，且明确排在「随 canvas / arbitrary 维度」的后续批次），会拖住本该现在就能加性交付的治理登记表。

**推荐：** 现在冻（纯治理文档），不等 `channelDriver`。

**标注：可机械定。** 两个概念在数据结构上无耦合（provenance 字符串引用 vs 新数据契约），先例（第一层 seams-freeze 加性冻结策略）清晰，golden 依赖已核实存在。

---

## seam3：failure-ledger（失败记录台账）

### 决策 3.1 —— 冻结范围：只 schema+fixture 还是连实现一起冻

**决策陈述：** 本轮 `failure-ledger` 的冻结范围是否止步于 schema + 合成 fixture（数据契约），还是把 `fingerprint` 哈希函数、编译期建议通道等实现也一并排进本轮。

**权衡：**

- 第一层 `seams-freeze` 的既定范式：只冻 schema + 合成 fixture + golden 校验器 + prd，不碰 `lib`/`bin` 实现（`grill.md`「不碰任何已冻内核 impl」；`0-INDEX.md`「本目录只起草……不写 lib/bin」）。三条 v2 草稿（含 `failure-ledger` 自身）在各自文档开头都重申了同一条边界。
- `fingerprint` 哈希函数需要「确定性、可复现、要进 golden」（草稿 Q2 已写明），这是一段真实的实现工作量，混进本轮的数据契约冻结会让本该轻量的「先钉住形状、解锁下游并行」目标变重、变慢。
- 下游要对 `failure-ledger` 的合成 fixture 并行开发（例如报告侧怎么呈现台账、`verdict.mjs` 零依赖的 golden 怎么写），只需要数据契约先钉死，不需要哈希函数真实现先落地。
- 没有找到任何理由支持 `failure-ledger` 破例于第一层已确立的范式。

**推荐：** 只冻 schema + fixture；`fingerprint` 哈希函数与编译期建议通道的真实现留作后续 `route:human`（草稿 Q5 已如此标注）。

**标注：可机械定。** 完全遵循第一层 `seams-freeze` 已确立、且本轮三份草稿自己反复重申的范式，没有破例理由。

---

### 决策 3.2 —— prd 落位：独立 prd 还是并入 `seams-freeze-v2`（明确排除并入 `p6-selfheal`）

**决策陈述：** `failure-ledger` 的 schema + fixture checksum 该进哪个 `prd-*.json` 的 `testChecksums`：单独开 `prd-failure-ledger.json`，还是并入本轮三接缝共用的 `prd-seams-freeze-v2.json`；以及是否可以并入 `prd-p6-selfheal.json`。

**权衡（分两层）：**

- **是否可并入 `prd-p6-selfheal.json`：** 不可以。护栏 #15「裁判零 LLM、与自愈分进程」要求 `verdict.mjs`（裁判）与自愈是两条不得纠缠的进程；已核实 `bin/verdict.mjs` 当前只 `import { readFileSync, writeFileSync } from 'node:fs'`，对任何诊断/台账模块零依赖，这条进程隔离目前是干净的。若把 `failure-ledger` 的 `testChecksums` 塞进 `prd-p6-selfheal.json`，会在契约治理层把「自愈」与「失败台账只读诊断」两件事捆进同一份 prd 文件，即便 schema 层已用 `allOf` 钉死「`drift-healed` 仅当 `verdict===HARNESS_ERROR`」，prd 文件层面的物理分离仍是护栏 #15「进程隔离」精神在契约治理层的延伸——类比护栏 #5「`passes` 由 gate 写、断言对实现者只读，二者不同文件」的物理隔离手法。
- **独立 prd 还是并入 seams-freeze-v2：** 第一层 `seams-freeze` 的强先例——`loop/prd-seams-freeze.json` 用单一个 prd 文件、单一个 story，一次性冻了 5 条接缝（`events`/`observed-reality`/`report-model`/`drift-patch`/`expected-frozen`）的 schema+fixture checksum。本轮三条新接缝（`run-history`/`action-vocabulary`/`failure-ledger`）同目录、同 `0-INDEX.md`、大概率同一次 grill 走完，直接类推应该同样一次性冻进一个新 prd（如 `loop/prd-seams-freeze-v2.json`），而不是给 `failure-ledger` 单独再开一个 `prd-failure-ledger.json`——单独开会打破「一批接缝一个 prd」的既定治理惯例，且徒增维护面。

**推荐：** 新开 `loop/prd-seams-freeze-v2.json`，`run-history`/`action-vocabulary`/`failure-ledger` 三条接缝的 schema+fixture checksum 一并进其 `testChecksums`（对齐第一层单 prd 多文件 checksum 的写法）；绝不并入 `prd-p6-selfheal.json`。

**标注：可机械定。** 「不并入 p6-selfheal」有护栏 #15 + 已核实的 `verdict.mjs` 零依赖现状背书；「并入 seams-freeze-v2 而非单独开 prd」有第一层强先例可直接类推，两层都不构成开放式权衡。

---

### 决策 3.3 —— `fingerprint` 规范化粒度

**决策陈述：** 失败指纹的聚类粒度——(a) 按「失败模式」（`atom` + `reason`/`assertionKind`）聚，还是按「用例步」（`caseId` + `stepId`）聚；(b) 「同稳定签名但可访问名文案有微调」是否要归一进签名模板，避免文案改一个字就裂簇。

**权衡：**

- (a) 草稿倾向「按失败模式聚」，理由是这样才能起到「跨用例聚类、辨 flaky 与系统性失败」的诊断作用；但这纯粹是一个产品/运维判断——没有已冻范式或 ADR 对「失败指纹该多粗」给出先例（`drift-patch` 的 `stableSignature.canonical` 解决的是单条补丁内「重锚前后是否同一元素」的等值判据，不是跨运行、跨用例的聚类粒度问题，两者场景不同、不能直接套用）。
- (b) 「文案微调是否归一进模板」是一个阈值型判断：归一得太松会把两个真实不同的失败合并成一簇（掩盖问题）；归一得太紧则同一失败因文案 A/B 测试类的微调被拆成多簇（噪声）。这类精度/召回权衡通常需要真实运维数据或至少一轮人工试跑校准，机械比对已冻范式解不出唯一答案。
- 两条子问都不影响接缝能否先冻——`fingerprintInputs` 的字段集合（`channel`/`verdict`/`reason`/`atom`/`assertionKind`/`assertionOp`/`signatureTemplate`）已经通过决策 3.1 定下来只冻数据契约，真正的哈希算法与模板归一规则属于决策 3.1 里明确 deferred 的实现范围，不阻塞本轮 schema 冻结。

**推荐：** 数据契约层面维持草稿现状（`fingerprintInputs` 字段集合冻结、`atom`/`stepId` 分离），把 (a)(b) 两条粒度判断显式标记为「随哈希函数实现一起 `route:human`」，本轮 grill 只需要确认「粒度判断不阻塞本轮 schema 冻结」这一点，无需现场敲定最终粒度规则。

**标注：需人签的真承重决策**（但不阻塞本轮接缝冻结本身，可延后到哈希函数实现阶段人签）。

---

## 汇总

### 需人签的真承重决策（本轮 grill 现场应重点分配时间的清单）

1. **决策 1.1** —— `run-history`/`run-metrics` 的 `cacheStatus`/`cacheHitRate` 保留（重定义为编译产物复用溯源）还是整删；本文倾向整删或改落编译期字段。
2. **决策 2.2** —— `channelDriver` 边界是否与 `action-vocabulary` 同批 co-grill，还是维持 `0-INDEX.md` 原排期推迟；本文倾向维持原排期、显式标注待二次校准。
3. **决策 3.3** —— `failure-ledger` 的 `fingerprint` 聚类粒度（按失败模式 vs 按用例步）与签名文案归一阈值；本文建议延后到哈希函数实现阶段人签，不阻塞本轮 schema 冻结。

### 可机械定清单（比对已冻范式/护栏/先例即可，现场无需展开辩论）

- 决策 1.2：`method` 改 `action`（跟随已冻 `events.schema`）。
- 决策 1.3：`intentId` 用 `minLength:1`（跟随 4/4 已冻下游姊妹接缝的一致惯例，草稿现状需现场纠正）。
- 决策 1.4：本接缝走 `full` 车道（不满足第一层 `light` 车道「无争议」判据）。
- 决策 2.1：动作真值源钉在已冻 `events.schema` 枚举（`channelDriver` 尚不存在，无法作为当前锚点）。
- 决策 2.3：`action-vocabulary` 现在冻（纯治理文档，`driver` 字段只是 provenance 指针，不依赖 `channelDriver` 落地）。
- 决策 3.1：`failure-ledger` 只冻 schema+fixture，不连实现（遵循第一层既定范式）。
- 决策 3.2：新开 `loop/prd-seams-freeze-v2.json` 承接三接缝 checksum，绝不并入 `prd-p6-selfheal.json`（护栏 #15 + 已核实 `verdict.mjs` 零依赖 + 第一层单 prd 多文件先例）。
