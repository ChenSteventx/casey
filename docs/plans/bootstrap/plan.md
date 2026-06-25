# 落地计划：Casey（测易）/ txt2testreport（评审稿 v0.2）

> **项目名**：**Casey**（中文 **测易**）。`casey` 是 skill · MCP · CLI 三处统一标识符（CLI = `bin/casey.mjs`，命令 `casey`；skill `casey`；MCP server `casey`）。仓库目录 `casey`（重命名前为 `autotesterv2`）。
> **能力名**：`txt2testreport`（Casey 的核心端到端能力：文本用例 → 测试报告）。
>
> 配套设计：`docs/design/txt2testreport-design.md`（v0.2，已并入 4 路红队修订）。本计划重业务、轻技术，每阶段给**流程 + 逻辑 + 验收点**。验收点可命令化的 → 进 `prd-<slug>.json` story；不可命令化的 → 进 Observability `route:human`。
>
> 节奏沿用 autotester：`grill → plan → accept → loop → gate → 异构评审 → 真机 UAT → handoff`。lane：`direct`（仅需契约 + 一行理由）/ `light`（加 plan 门）/ `full`（全链）。

---

## 总体顺序（里程碑，v0.2 重排）

```
P0 引导 loop 机制(direct)  →  P1 DDD 词表 + ADR(plan)  →  P2 TestCase + 归一(full)
   →  P3 编译期 recorder-as-library + authoring agent(full)
   →  P4 断言草拟 + 冻结 + 人签(full)
   →  P5 确定性回放 + 取证 + verdict.mjs 分类器 + 只读漂移探针(full) ★
   →  P6 自愈准入门 + 非就地有界自愈(full)
   →  P7 报告 + 裁定徽章 + 缺陷单(full)
   →  P8 多目标 web/cef/arbitrary(full)
   →  P9 两层 selftest + 真机 UAT(full)
```

**MVP 第一刀**：打通 **P0→P5 + P7 的 web 单用例**（串行），跑出第一份带多态裁定的报告；再回头做 P6 自愈与 P8 多目标。
**并发约束（红队 loop-C）**：MVP **串行跑用例**（每条一进一出：单 active-contract + 单 breaker reset）。

---

## P0 · 引导 loop 机制（lane: direct/toil）

**目标**：把 autotester 通用子域 `loop-kit` 搬来，纪律机制立即生效（ADR-0001「提取」首战）。

**流程**
1. 拷 `loop-kit/bin/*`（gate / breaker / contract / term-lint / hook-*）。
2. 起 `loop/`：`GUARDRAILS.md`（迁移 12 护栏 **+ #13 自愈准入门**「只对确证 HARNESS_ERROR 自愈」**+ #14 fail-safe 默认**「未知失败→NEEDS_HUMAN 不自愈」）、`config.json`（lane→模型、熔断阈值；**lane 枚举对齐 direct/light/full**）、`prd.schema.json`、`contracts/`、`inbox.md`、`audit.jsonl`。
3. `.claude/settings.json`：UserPromptSubmit→triage、PreToolUse→guard、PostToolUse→posttool、Stop→stop。
4. 起 `CLAUDE.md`、`.gitignore`（`.auth/`、`site.json`、`*.results.html`、`loop/.breaker-state.json`、`cases/*/`（运行产物 events/video/steps；**契约不在此，扁平在 loop/**）、`drift/`）。

**逻辑/兜底**：hook **fail-open**；term-lint 缺 CONTEXT.md 时 fail-closed。

**验收点**
- [命令] `node loop-kit/bin/term-lint.mjs --registry` exit 0。
- [命令] `node loop-kit/bin/breaker.mjs --reset` 清零。
- [命令] **1-story** 的 `loop/prd-selftest.json`（单条 acceptance = `node -e "process.exit(0)"`，满足 schema `minItems:1`）→ `node loop-kit/bin/gate.mjs --prd loop/prd-selftest.json` exit 0（红队 loop-minor：0-story 与 schema 冲突）。
- [🧑] 写一个含弃用别名的 .md → PostToolUse hook 拦红（机制生效）。

---

## P1 · DDD 词表 + ADR（lane: plan）

**目标**：**先登记后造词**。

**流程**
1. `CONTEXT.md` 两个限界上下文：① `loop-kit 通用子域`（搬）；② 新增 `Casey 核心域`。
2. 核心域词条（四列）至少含：`Casey`/`测易`、`txt2testreport`、`TestCase`、`intentId`、`编译`、`观测现状`(observedReality)、`断言草拟`、`冻结断言契约`、`确定性裁判`、`多态裁定`、`通过/被测缺陷/过程错误/待人裁决`(PASS/SUT_DEFECT/HARNESS_ERROR/NEEDS_HUMAN)、`待人裁决子类`(SUT_DEFECT_OR_STALE/CASE_DEFECT/AMBIGUOUS_ACTION/AFFORDANCE_ABSENT/INDETERMINATE)、`自愈`、`自愈准入门`、`非就地自愈`、`漂移补丁`、`人签门`、`期望版本化/重签`、`点击身份门`、`网络取证`(watchNetworkForensics)、`裁定徽章`、`缺陷单`、`channel`。
3. ADR：`0001` 复用 loop-kit；`0002` 多态裁定 + fail-safe + 自愈准入门（难逆转）；`0003` 编译再回放 + 非就地自愈；`0004` 断言冻结 + 人签 + 期望版本化；`0005` 统一语言强制。

**验收点**
- [命令] `term-lint --registry` exit 0；`term-lint --file docs/design/txt2testreport-design.md` exit 0。
- [🧑] 每个核心域术语先在既有学科找过映射，造词有登记。

---

## P2 · 规范 TestCase + 输入归一（lane: full）

**目标**：excel/json/txt/自由文本 → 规范 `TestCase`（设计 §2）。

**流程**：`parseTestCase`（确定性校验：schema + Reserved Prefix 强制 + 畸形拒绝 + **冻结期 equals-字面量 lint**，fail-closed）；L1 归一适配器（LLM 翻原文）。

**验收点**
- [命令] golden：固定 fixtures（excel 截样/json/txt/自由文本）→ 归一后 `parseTestCase` 全过、关键字段稳定。
- [命令] 畸形用例（缺 startUrl / 实体名无 atl_ / steps 空 / `urlPathname` 用 `equals` 含 ID 串）→ 报红 exit≠0。
- [🧑] LLM 归一对真实杂乱用例还原度（route:human 抽检）。

---

## P3 · 编译期 recorder-as-library + authoring agent（lane: full）

**目标**：L3 agent 真机跑一遍，intent→稳健动作 落 `events.json`/`spec.ts` + `observed-<caseId>.json`。**这是红队点名最重的新建**（设计 §9.2/§9.3）。

**流程**：把 autotester 录制器**重构成 library**（agent 拥有 context、initScript 注入 agent 页、`__atRec` 绑 agent collector、**关人抖动去噪**、避 enrichL0 导航竞态）；复用 `robust-actions`/`describe-action`/`buildSpecFromEvents`；落 `observedReality`（成功 URL/提示/回复/请求日志）；**禁纯坐标步**；记 determinism 契约（静默点后再快照）。

**逻辑/兜底**：指不到→响亮报红；受熔断器约束；编译期才标 `CASE_DEFECT` 候选。

**验收点**
- [命令] 已知动作序列编译产**字节稳定 `events.json`**（红队 buildability-C）。
- [命令] 产出 `spec.ts` 能被 autotester runner 加载 **且不触发 `authored` 拒绝 / 参数化拒绝**（红队 loop-M，**硬门**）。
- [命令] 「点击不存在的按钮」用例 → 编译期标 `CASE_DEFECT` 候选、不静默通过。
- [🧑] 真站编译一条真实用例，人核对动作解析 + observedReality 正确。

---

## P4 · 断言草拟 + 冻结 + 人签（lane: full）

**目标**：设计 §5。LLM 草拟带类型断言（默认结构式）→ 编译成 check 命令进 `prd-<caseId>.json` → 人签 → checksum 冻结**仅断言文件**。

**流程**：草拟器（只用词表 + op 约束，易变值模板化）；每条 `expected[]` 编译成 `node bin/check.mjs --case <id> --intent <id> --kind <k> --op <op> --value <v>`；`--sign` CLI 人签门（写 `signedAt`/`signedAgainstBuild`/`signerId`）；冻结 = `testChecksums`（断言 + 期望旁车），**spec/events 不进 testChecksums**（其完整性由 `checkFingerprint` 作 gate 检查项）。

**验收点**
- [命令] 草拟断言全属词表枚举且 op 合法（越界报红）；含 uniqueName 的值必模板化（lint）。
- [命令] 未签字契约 → 裁定流程拒「算数」。
- [命令] 人签后改一字符断言 → Test Ratchet 报红；改 spec locator → **不**触 ratchet（合法），但 spec 指纹变 → `checkFingerprint` 报红除非走 §P6 重签。
- [🧑] 人评审冻结断言真表达用例意图（CASE_DEFECT 左移关键门）。

---

## P5 · 确定性回放 + 取证 + `verdict.mjs` 分类器 + 只读漂移探针（lane: full）★核心

**目标**：设计 §3 相 3+4、§4.2 判定树。**只读漂移探针在此（分类用），写回自愈在 P6**（红队 buildability-C：拆循环依赖）。

**流程**
1. 确定性重放 spec（录屏 + 抓回复 + `watchPageLifecycle` + **新建 `watchNetworkForensics`**：response/requestfailed/error-envelope，按发起方归因）。
2. `gate.mjs` 跑 check 命令 → 写**二值 `passes`**（唯一写者）。
3. **新建 `verdict.mjs`**（零 LLM）读逐步事实（含**点击身份门**判 `actionPerformed∈{true,false,ambiguous}`）+ forensics → §4.2 树 → 写 `verdict.json` 多态枚举。
4. **只读漂移探针** `findEquivalentAffordance`（无 spec 变更、无重跑）：判 HARNESS_ERROR 用的「同稳定签名唯一元素在」。

**验收点（每态一 golden，喂合成事实给分类器，无需真站）**
- [命令] 断言全过 → `PASS`。
- [命令] locator 漂移但同签名唯一在 → `HARNESS_ERROR`（只读探针正命中）。
- [命令] 动作唯一 + 断言失败 + 5xx 归因本步 → `SUT_DEFECT`；干净失败 → `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)`。
- [命令] 多匹配/坐标兜底点击 → `actionPerformed=ambiguous` → `NEEDS_HUMAN(AMBIGUOUS_ACTION)`，**不**记缺陷。
- [命令] 背景无关 401 注入 → verdict **不**翻成 SUT_DEFECT（按发起方归因）。
- [命令] 未知失败 → `NEEDS_HUMAN(INDETERMINATE)`，**非** HARNESS_ERROR（fail-safe）。
- [命令] `passes` 任何模型写入路径被 loop-guard 拦（write-prd 互锁）。
- [🧑] 真站一条会触发真 bug 的用例 → 正确判 `SUT_DEFECT` 而非 HARNESS_ERROR（**最关键真机验收**）。

---

## P6 · 自愈准入门 + 非就地有界自愈（lane: full）

**目标**：设计 §3 相 5、§9.5。**只对确证 HARNESS_ERROR 自愈**，非就地。

**流程**：自愈准入门（裁定态闸：只 HARNESS_ERROR）；自愈动作（语义梯子重锚 → **写 `drift/<caseId>.<ts>.patch` 旁文件**，原 spec 不变照常回放）→ **人签后**才应用补丁 → 重跑该步 → **由同一冻结 L0 checker 复核**（healed→PASS 仅当确定性后断言过 + 重锚元素唯一且签名匹配）；同一步 N 次漂移 → 升级 inbox（flaky locator 非一次漂移）；受熔断器约束（无进展用每步进展哈希）。

**验收点**
- [命令] 喂 `SUT_DEFECT`/`NEEDS_HUMAN` 步 → 自愈门**拒绝**（未发生重锚）。
- [命令] 喂确证 `HARNESS_ERROR` 步 → 重锚成功 → 写 drift 补丁、**原 spec 未变**；人签应用后重跑转 `PASS`。
- [命令] 自愈连击触发熔断 → 跳闸写 inbox + exit 2。
- [🧑] 「自愈绝不抹平真 bug」「绝不就地悄改 spec」两不变量真站成立。

---

## P7 · 报告 + 裁定徽章 + 缺陷单（lane: full）

**目标**：设计 §6。**report 渲染逻辑改造非照搬**（autotester 只二值）；保留自包含机制当 helper；从 `verdict.json` 渲染多态徽章/缺陷单/期望对实际。

**验收点**
- [命令] 渲染 demo 报告：自包含、8 小节、徽章正确、冻结 `expected[]` 可见。
- [命令] `verdict.json` 是 golden 唯一对象（HTML/视频/时间戳**不**做 golden，红队 determinism-minor）。
- [命令] `SUT_DEFECT` → 生成结构化缺陷单。
- [命令] 凭据兜底门：注入 `token=xxx` 回复 → 落盘前拒写。
- [🧑] 报告可直接转研发当 bug 单。

---

## P8 · 多目标 web/cef/arbitrary（lane: full）

**目标**：设计 §7。裁定/报告/熔断/契约 channel 无关；编译/回放期按 channel 选实现。

**流程**：web 先行（复用固化登录/site.json/流式等待/**web events.json 管线**）→ cef（**另一条 CDP 回放路径**，`assertWebKind` 对 cef 抛错，非「复用 runner」）→ arbitrary（site.json 覆盖）。

**验收点**
- [命令] 同一裁定/报告路径对 web 与 cef 都跑通（channel 无关性回归）。
- [🧑] Hi小助真机一条用例端到端。

---

## P9 · 两层 selftest + 真机 UAT（lane: full）

**目标**（红队 buildability-M：「零依赖」与「真站覆盖」冲突 → 分两层）：
- **tier-1** hermetic：`data:` URL 假 SUT，只验**编译→spec→确定性回放→报告**管线 + 给分类器喂**合成 actionPerformed/postAssertions/forensics 四元组**逐一触发 4 态，证 §4.2 树与徽章。零外部依赖。
- **tier-2** live smoke：需 site.json + creds，覆盖 SUT_DEFECT/取证/流式分支，**gated route:human**。

**验收点**
- [命令] `node bin/casey.mjs selftest --tier1` 全链路 exit 0，4 态徽章全覆盖。
- [🧑] tier-2 live smoke + 真机 UAT 清单全 🧑 通过 = 需求完成（gate 绿 ≠ 完成）。

---

## 风险与 route:human 汇总

- **最高风险**：`SUT_DEFECT` 误判 `HARNESS_ERROR` 被自愈抹平 → P5/P6 真机验收是硬门，不可只靠 golden。已被 fail-safe 默认 + 自愈准入门 + 点击身份门三道收口。
- **第二风险**：编译期 recorder-as-library 与 LLM 驱动的 ownership 反转可行性 → P3 第一验收（events.json 不触 authored 拒绝）是硬门。
- **观测性申报**（gate 测不到、route:human）：LLM 归一还原度、断言草拟语义正确性、真站 SUT_DEFECT 判定、自愈不抹真 bug。

---

## 立即下一步（待拍板）

1. 批准设计 v0.2 + 本计划 → 从 `P0` 引导 loop 机制；或
2. 先定设计 §11 决断点（尤其 §11.4 编译期接口、§11.6 是否现在给 breaker 加 `--state`）；或
3. 调整阶段顺序 / lane 分诊。
