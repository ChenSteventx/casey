# 失败记录台账（`failure ledger`）接缝 — grill 草稿

> 状态：**草稿 / 未冻 / 待 grill 拍板**。
>
> 边界：本文只起草开放问题与推荐答案，**不冻结、不登记 `CONTEXT.md`、不碰已冻接缝、不写 `lib`/`bin`**。`failure ledger`（失败记录台账，待登记）、`fingerprint`（失败指纹，待登记）、`humanResolution`（人裁决回填，待登记）等英文概念在落地前一律以反引号或纯文本出现，绝不当作已登记术语加粗。所有判断须经 grill-with-docs 拍板后才动 `CONTEXT.md` 与 schema 冻结。
>
> 上游事实源：`docs/design/autonoma-adaptation.md` §10（失败学习，含「失败记录台账…待登记」注与边界）、§11（自治测试修复旁证），`CONTEXT.md` 的 `自愈`/`自愈准入门`/`重签`/`期望版本化` 行，`loop/GUARDRAILS.md` #5/#13/#14/#15。

## 这条接缝是什么、挂在哪

`failure ledger` 是 `多态裁定` 下游的「只读诊断台账」：`verdict.mjs` 出完四态后，把每条非 `PASS` 的步级裁定追加成一条不可变记录，供人做失败聚类、优先级排序、编译期建议。它在数据流里的位置：

```
三轴 → verdict.mjs → verdict.json ─(只读追加)→ failure ledger ─(人读)→ 分诊/优先级/编译期建议
                                                      │
                                  绝不回流 verdict.mjs，绝不喂自愈准入门
```

它是 `自愈` 的兄弟而非输入：`自愈` 只认 `verdict===HARNESS_ERROR` + 漂移三证（护栏 #13/#15），绝不认「这个失败在台账里出现过 N 次」。台账只记账、不行动——这正是选「台账（`ledger`，会计里的分类账：追加不改、只录不判）」这个词的用意。

---

## 开放问题与推荐答案

### Q1 — 定名「失败记录台账 / `failure ledger`」是否合适？SRE/ITIL 有没有现成术语？

**现成学科术语核查（按 `CONTEXT.md` 造词顺序 DDD→SRE→控制论→CI/CD→XP/BDD→ITIL）：**

- ITIL 问题管理里有「已知错误库」（Known Error Database，下称 `KEDB`）：记已知错误 + 根因 + 临时规避，归 Problem Management；单条叫 Problem Record / Incident Record。这是与本接缝最贴的现成术语——一份跨运行的失败 + 人裁决记录正对应 `KEDB` + Problem Record。
- SRE 的对应物是 postmortem（事后复盘文档）/ error budget，偏单次事故叙事，不是可聚类的结构化台账，匹配度低于 `KEDB`。
- 测试域口语有 flaky test registry / quarantine，但非已登记学科术语，且「隔离（quarantine）」带「自动跳过用例」含义，与本仓库「绝不自动删/跳用例」红线相悖，不宜借名。
- 会计的 `ledger`（分类账/台账）贡献的是语义而非分类：追加式、不可变、只录不判——恰好把「只读诊断」的边界写进名字里。

**推荐答案：** 保留中文名「失败记录台账」，英文 `failure ledger`；但登记 `CONTEXT.md` 时**血缘显式锚到 ITIL 问题管理（`KEDB` / Problem Record）**，白话解释写「失败学习的只读账本，借 ITIL 已知错误库之意、借会计台账之追加不改，绝不进裁判/自愈」。单条记录建议定名「失败记录条目 / failure record」。

**留给 grill 的子问：** 是否拆成两个概念——「原始失败记录（未诊断的 `NEEDS_HUMAN`）」与「已知错误（已人裁带规避）」？推荐不拆，用单条 + 生命周期状态（`humanResolution` 由 `null` 到非空表征从「未裁」到「已裁」），镜像 `漂移补丁` 的 `proposed→signed/applied` 状态机，避免概念膨胀。

### Q2 — `fingerprint`（失败指纹）怎么算？

**目标与张力：** 指纹要跨运行稳定（同一失败模式聚成一簇，才能排优先级、辨 flaky 与系统性失败），又要够区分（不同失败别塌成一簇）。核心红线：**绝不把易变的逐运行实例值喂进哈希**——`atl_<ts>` 实例名、时间戳、`runId`、实体 ID、含 query 的整串 URL、流式回复全文若进哈希，每次运行都成唯一指纹、聚类彻底失效（与 `观测现状`→`expected[]` 的模板化同一道理）。

**推荐答案：** `fingerprint = "sha256:" + sha256(canonicalJSON(fingerprintInputs))`，其中 `fingerprintInputs` 是一组**只含稳定、已模板化字段**的定长元组：

| 字段 | 取值 | 为何稳定 / 为何入指纹 |
|---|---|---|
| `channel` | web/cef/arbitrary | 通道决定失败语义 |
| `verdict` | 四态（非 PASS） | 失败类别 |
| `reason` | `NEEDS_HUMAN` 子类或 null | 失败子因 |
| `atom` | atomId（如 `workflow.save`） | 稳定语义动作 id；不用 `stepId`（位置式、会随 spec 平移） |
| `assertionKind` | 断言 kind 或 null | 断言失败按种类聚（urlPathname/textVisible/...） |
| `assertionOp` | op 或 null | 同 kind 不同 op 算不同失败 |
| `signatureTemplate` | 稳定签名模板（role+可访问名模板）或 null | 定位/漂移类失败按稳定签名聚，不用 raw CSS/坐标 |

**显式排除（绝不入哈希）：** `caseId`、`stepId` 位置序号、`runId`、`observedAt`/时间戳、`atl_` 实例名、实体 ID、query 串、`replyText` 全文、raw locator 坐标、任何凭据/PII。`caseId`/`stepId` 作为同级定位字段保留在记录里、但不进指纹，从而同一失败模式可跨用例聚类。

落地铁律（属后续 `lib/bin`，本草稿只钉契约）：哈希前先复用 `观测现状`→`expected[]` 那条模板化把易变值打成模板；`canonicalJSON` 用排序键、零 `LLM`、可复现（要进 golden）；`fingerprintInputs` 随记录一并落盘，让人/golden 能复算校验指纹。

**留给 grill 的子问：**（a）粒度——指纹按「失败模式（atom+reason+kind）」还是「用例步（case+step）」？推荐前者（为聚类），`caseId`/`stepId` 另存。（b）是否需要把「同稳定签名但 accessibleName 文案微调」归一进模板，避免文案改字就裂簇。

### Q3 — 边界红线（最硬的一节）

以下每条都是不可违反的红线，多数已由护栏背书；建议 grill 时逐条确认、落地时尽量机制化：

1. **只读诊断、追加不改。** 台账是 `verdict.mjs` 说完话之后才产生的记录；条目不可就地改、不可删，人裁决是**新增字段/追加**而非改写原 `verdict`（台账语义 + 护栏 #5 精神）。
2. **产出绝不进 `bin/verdict.mjs`。** 裁判进程不得 import/读取台账（护栏 #15 进程隔离）。建议落地时加一条测试：`verdict.mjs` 对台账模块零依赖。
3. **绝不作 `自愈` 输入。** `自愈准入门` 只认 `verdict===HARNESS_ERROR` + 漂移三证，绝不认台账历史（护栏 #13）。奖励钻营防线：历史出现次数绝不降低自愈门槛、绝不把「常失败」洗成「可自愈」。
4. **不能自动改断言 / 删用例 / 把 `NEEDS_HUMAN` 改 `HARNESS_ERROR`。** 台账记下一条 `NEEDS_HUMAN` 后，自身永远改不动那条 `verdict` 的类别；只有人经签署链路才能重判（design §10 + 护栏 #5/#13/#14）。`humanResolution` 里不含 `verdict` 字段，结构上就改不了原裁定。
5. **编译期建议须经人签链路（奖励钻营防线，护栏 #13/#14/#5）。** 台账可向编译期吐「`workflow.save` 这个 atom 频繁 `AMBIGUOUS_ACTION`，建议收紧 locator」之类纯提示；但提示只是提示，任何由此引出的 `expected[]` 改动一律走 `冻结断言契约` + `人签门` + `期望版本化`/`重签`，绝不自动收紧/放松断言。
6. **凭据兜底。** 条目只携带模板化/脱敏后的稳定字段，绝不含 raw body/headers/cookie/token/PII/`replyText` 全文（schema 用 `additionalProperties:false` 兜底，护栏 #7）。指纹输入本就已模板化。
7. **pass rate 绝不成为台账驱动的优化目标**（autonoma §11 不可借鉴清单）。

### Q4 — 与 P6 `自愈`、`重签`/`期望版本化` 链路的接口：`humanResolution` 怎么回流？

**回流是单向、人签门控的。** `humanResolution` 由人裁步骤写入，写入后它是一个**指针/审计引用，不是执行器**：

- 结构建议 `humanResolution = { decision, resolvedAt, resolverId, ref, note? }`，其中 `ref` 指向权威产物路径，绝不复制权威状态（权威态活在 `冻结断言契约`/`漂移补丁`/`缺陷单` 里，台账只引用，免双写漂移）。
- `decision` 枚举镜像 `CONTEXT.md` 里人裁的几条出口：
  - `intended-change-resign`（有意改版→`重签`）：`ref` 指向新签署元数据（`signedAt`/`signedAgainstBuild`/`signerId` + 新 checksum）。**台账只记「已由重签解决→引用」，重签动作本身走 `冻结断言契约` 路径，台账不执行重签。**
  - `confirm-regression-defect`（确认回归→记缺陷）：`ref` 指向 `缺陷单`。
  - `tighten-locator-recompile`（`AMBIGUOUS_ACTION` 收紧 locator 后重编译）。
  - `fix-case`（`CASE_DEFECT` 修用例）。
  - `drift-healed`（确证漂移已自愈）：`ref` 指向 `drift/<caseId>.<ts>.patch`。**红线：此 decision 仅当原 `verdict===HARNESS_ERROR` 才合法**——`NEEDS_HUMAN` 条目的人裁绝不能直接路由去自愈；要走自愈必须先以新证据重跑产新 `verdict`，那是新一轮裁定、不是改台账。
  - `acknowledged-flaky` / `needs-more-evidence`（承认 flaky / 证据不足待复跑）。
- **与 P6 的方向**：`漂移补丁` 人签应用后，台账条目的 `humanResolution.ref` 可回指该补丁做审计——又是回望式引用、非前向执行器。

一句话契约：台账 **读** `verdict.json`/`观测现状` → 人 **读** 台账做分诊 → 人经 `冻结断言契约`/`重签`/`漂移补丁` 签署链路 **行动** → 这些链路把一个 `ref` 写回 `humanResolution`。台账是只读读模型 + 审计指针，永远不是通往 `verdict`/`自愈` 的写路径。

### Q5 — 归哪条轨？是否进 prd `testChecksums`？

**归轨：** 这是 v2 新接缝，且必须与 `自愈` **进程隔离可见到 prd 这一层**（护栏 #15）。推荐**单开一条轻轨/独立 prd（如 `prd-failure-ledger.json` 或并入 `prd-seams-freeze-v2.json`），绝不并进 `prd-p6-selfheal.json`**——免得台账与自愈在 prd 层就纠缠，给「历史喂自愈」留口子。

**是否进 `testChecksums`：** 推荐**是，但只冻 schema + fixture 这条数据契约**（与 v1 各接缝同法：schema 校验 golden + fixture 进 `prd-seams-freeze.json` 的 `testChecksums`）。理由：下游要对合成 fixture 并行开发，就得先把数据契约钉死，且 schema 本身要把红线编码进去（无 verdict 可消费的字段、追加不改、指纹确定性）。`fingerprint` 的哈希函数（确定性、可复现）将来落 `lib/bin` 时也要单独配 golden，但函数实现不在本草稿范围。

**留给 grill 的子问：** 本轮到底冻不冻？§10 把「失败学习」列为 Autonoma 的未来方向，可选「本轮只冻 schema 让下游可建、实现 deferred 走 route:human」或「连实现一起排进 P6 之后的新里程碑」。推荐前者：先冻数据接缝、缓建实现，把哈希函数与编译期建议通道留作后续 route:human。

---

## 不在本草稿（deferred / route:human）

- `fingerprint` 哈希函数与模板化复用的真实实现（`lib/bin`）。
- 编译期建议通道的具体形态（怎么把台账聚类结果安全地喂回 `编译`/`断言草拟` 而不破奖励钻营防线）。
- 台账聚类/优先级的读时聚合视图（first/last seen、occurrence count 由追加条目派生，非逐条存）。
- 登记 `CONTEXT.md`（`failure ledger`/`fingerprint`/`humanResolution`/失败记录条目）——须 grill 拍板后另做。
