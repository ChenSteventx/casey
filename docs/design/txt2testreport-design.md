# txt2testreport 架构设计（评审稿 v0.2）

> **项目名**：**Casey**（中文 **测易**）。`casey` 是 skill · MCP · CLI 三处统一标识符（CLI = `bin/casey.mjs`，命令 `casey`；skill `casey`；MCP server `casey`）。仓库目录 `casey`（重命名前为 `autotesterv2`）。`txt2testreport` 是 Casey 的核心端到端能力（文本用例 → 测试报告）。
>
> 本文是 Casey 的奠基设计。它把姊妹项目 `autotester`（零 LLM 的录制·回放·报告 CLI）的 **loop engineering** 与 **DDD** 方法论，迁移到一个 **LLM 驱动**的新业务上。
>
> 一句话目标：**输入一段测试用例（excel / json / txt / 自由文本均可）→ LLM 编译成确定性可回放脚本 → 确定性回放（录屏 + 抓取输出）→ 确定性裁判出严格断言结论 → 自动产出自包含测试报告。**
>
> **v0.2 修订**：经 4 路异构红队对抗审查（determinism / verdict-logic / loop-fidelity / buildability，全部对照 autotester 源码核验），修正了 v0.1 的多处「不可复现」「假缺陷」「复用过载」硬伤。逐条见 §12。

## 与实现的已知偏离（对账表，2026-07-07 审计核定；正文是历史决策记录、以此表为准）

| 设计文面 | 实现真身 |
|---|---|
| §9.2 recorder-as-library（录制器库化） | 已被 ADR-0006 取代：相1 = `compile-gate` + `compile-atoms` 三段式（NL→atom flow→真机执行产 events）；库化仅存「陌生站点孵化」支线概念 |
| §6 录屏 mp4 内嵌单文件报告 | webm 独立文件 + 报告引用（`recordVideo`，replay-video 契约）；报告三形态 html/md/json 拆分式（report-spec） |
| §6 trace 归档 / 截图 | 均未建（全链无 tracing/screenshot 调用，缺陷单 traceRef 恒 null）——挂账 |
| §6.2 取证「标注」小节 | 取证全量进机读 report-model；人看 HTML 只在缺陷单背书处展示，非缺陷步取证小节未建——挂账 |
| §8 prd sv2 加 verdict 枚举 + signedAgainstBuild | 实际 sv2 加 caseId/channel/expectedFrozenPath；签署元数据在 `expected.frozen.json` 旁车、期望裁定在 `--verdict-baseline`（功能等价、字段归属不同） |
| §3.1 熔断器每步进展哈希（--progress） | 未建（breaker 仍按 git HEAD 判进展）——挂账 |
| §7 cef/arbitrary 双通道 | 数据面（channel enum/channelDriver 接缝）已冻，回放仅 web 真实现（P8 未启动） |
| §2.1 countChange 计数选择器 | 硬编码 `.hr-table-row` 未走通道剖面——挂账 |
| §5 checkFingerprint spec 指纹 gate 检查项 | 未建（prd-p4-freeze observability 挂 route:human） |

---

## 0. 设计立场：autotester 翻了个面，但内核不让渡

`autotester` 是 **人录、机回放、零 LLM**。它的灵魂是一句话：

> **确定性是默认；LLM 是只在确定性够不到的地方才动的手术刀；「完成」是一个退出码，永远不是一句声明；每一个 `passes` 都由唯一的确定性写入者裁定，任何模型无权翻绿。**

`txt2testreport` 把输入端**翻面**：不再人录，而是 LLM 读懂用例、直接在真实浏览器里跑。但上面这句灵魂**一个字都不能改**。

执行模型 = **「编译 + 自愈」混合**（你选的方案 1）：

- LLM **只在编译期**读一次用例、把它翻译成 autotester 风格的确定性 spec；
- 之后**确定性回放**，每次回归都不再烧 LLM、结果可复现；
- **只有当某一步是「确证的工装漂移（HARNESS_ERROR）」时**，才让 LLM 回到现场做有界自愈。

### 0.1 v0.2 的两条总原则（红队逼出的不变量）

1. **失败要 fail-safe，不能 fail-open。**机器只能终判两种结果：`PASS` 与**有取证背书的** `SUT_DEFECT`。**凡机器无法证明的，一律路由给人**（`NEEDS_HUMAN` 族），绝不默认成「可自愈」。自愈**只对正向确证的定位漂移**开闸 —— 缺取证 ≠ 工装错。
2. **裁判（确定性）与自愈（LLM）彻底分进程。**多态裁定由零 LLM 的 `bin/verdict.mjs` 出；自愈是它的**下游消费者**，不得反向进入裁判进程（否则 LLM 把真 bug「重锚」成绿 = 最危险的假绿）。

---

## 1. 五层职责模型（LLM 准入边界）

镜像 autotester「确定处零 LLM、语义处人/LLM 评审」的二分。**智能与频率成反比（ADR-0003）**：越频繁跑的层越不许有 LLM。

| 层 | 工作 | 执行者 | 铁律 |
|---|---|---|---|
| **L0 确定性内核** | 快照/取证捕获、动作后检查、`gate.mjs`（写 `passes`）、`verdict.mjs`（多态裁定）、熔断器、`atl_` 清扫、录屏转码、报告渲染、凭据兜底门 | **零 LLM 脚本** | 内核底线。任何 LLM 都不得进入此进程。退出码即真相。 |
| **L1 输入归一** | 杂乱 excel/txt/自由文本 → 规范 `TestCase` | LLM（提案） | 输出由确定性 `parseTestCase` 校验；不合规 fail-closed。 |
| **L2 断言草拟** | 从 `intent` + `observedReality` 推导**带类型** `expected[]` | LLM（提案） | **冻结 + 人签**后才算数；Test Ratchet 锁死。 |
| **L3 编译/自愈执行** | 编译期：intent→稳健动作 + 观测现状 → spec；自愈期：仅对确证漂移重锚 | LLM（真实浏览器 agent） | 受熔断器约束；动作后跟 L0 检查；指不到要**响亮报红**。**产出是提案，必经 L0 复核。** |
| **🧑 人签门** | 签掉冻结断言；裁定 `NEEDS_HUMAN` 时三选一裁决（修用例 / 记缺陷 / 重签基线） | 人 | autotester 的「语义边界人评审」；gate 绿 ≠ 完成，人签真机才完成。 |

---

## 2. 核心实体：`TestCase`（DDD 聚合根）+ 断言词汇

excel / json / txt / 自由文本全部归一到一个内部 `TestCase`（推广 autotester 的 `scaffoldDataset`）。

```jsonc
{
  "schemaVersion": 1,
  "caseId": "tc_workflow_create_smoke",
  "title": "新建工作流冒烟",
  "source": { "kind": "excel|json|txt|freetext", "raw": "<原文>", "ingestedAt": "..." },
  "target": { "startUrl": "...", "auth": "ref:site.json", "channel": "web|cef|arbitrary" },
  "preconditions": ["已登录"],
  "steps": [
    {
      "intentId": "intent_0",                // 用例语义步 id（人/LLM 写）；区别于回放事件的 stepId
      "intent": "在「工作流管理」里新增一条工作流",
      "actionHint": "click|fill|select|send|navigate|assert",
      "inputValue": "{{uniqueName}}",        // 模板，回放期实例化为 atl_<...>_<ts>；绝不冻成字面量
      "uniqueGuard": true,
      "expected": [                          // 严格、机器可判，且**默认结构式**（见下）
        { "kind": "urlPathname", "op": "startsWith", "value": "/heren/aimanagement/edit" },
        { "kind": "textVisible",  "op": "appears",    "value": "新增成功" }
      ]
    }
  ],
  "globalAssertions": [ { "kind": "noPageError" }, { "kind": "noErrorEnvelope" } ],
  "uniquePrefix": "atl_",
  "boundContract": "loop/prd-tc_workflow_create_smoke.json"   // **扁平在 loop/，不嵌 cases/**（§8 hook 正则原样生效）
}
```

**ID 两层（v0.2 修正）**：`TestCase.steps[].intentId`（语义、authoring）≠ 回放 `events[].stepId`（位置式 `atstep_i`，复用 autotester 方案）。编译期一条 intent 可裂成 N 个 event，每个 event 回填其 `intentId`，使裁定/取证/报告能把 N 个 event 卷回一条 intent。

### 2.1 断言词汇表（带类型，LLM 不准发明自由断言）+ op 约束

| `kind` | 含义 | 允许的 `op`（v0.2 收紧） | 强/软 | 复用原语 |
|---|---|---|---|---|
| `urlPathname` | 路径变化 | **默认 `startsWith`/`matches`(正则)**；**`equals` 仅人工显式批准** | 硬 | `waitForURL` 谓词式（非 equals） |
| `textVisible` | 干净提示/标题出现 | **只允许 `appears`（子串可见）**；**取消 `equals`** | 硬（结构式） | `expectTextVisible`（子串 + 标题主体兜底） |
| `countChange` | 弹窗/抽屉方向增减 | `up`/`down`；**baseline 回放期实时采，绝不冻绝对值**；例外 `equals 0`（删后绝对归零——空集与基线无关、确定性安全；canonical 名 = `countChange`+op，非 `countEquals`） | 软（`equals 0` 为取证类硬判） | `expectCountChange(liveBaseline, dir)` |
| `inputReadback` | 填写回读 | `equals`，**但值含 uniqueName 必模板化**（check 期实例化再比） | 硬 | `robustFill` 回读 |
| `dropdownReadback` | 下拉回读 | 同上 | 硬 | `expectDropdownValue` |
| `requiredFilled` | 提交前必填已填 | 前置 | 硬 | `expectRequiredFilled` |
| `streamReplyReceived` | LLM 流式吐完 | **只判「匹配 urlPattern 的响应回了 expectedStatus 且 finished()」**；**禁用 bodyText/durationMs 入裁定** | 硬 | `waitForReplyByStream` |
| `replyContains`/`replyMatches` | 回复正文含关键词/正则 | 显式谓词，绝不「语义相似」 | 硬 | 新建 check |
| `noPageError` | 全程无 crash/pageerror | 取证 | 硬 | `watchPageLifecycle` |
| `noErrorEnvelope` | **新增**：无「HTTP200 但 body 成功字段不符」软失败（成功字段按 channel 参数化，Heren=`status===200`，非写死 `code`） | 取证 | 硬 | **新建** `watchNetworkForensics` |
| `noErrorToast` | **新增**：DOM 错误弹窗缺席（扫 `.hr-message`/`[role=alert]` 找「操作失败/系统异常」，ABSENCE 断言；逐条断言续跑、不首错即停） | 取证 | 硬 | **新建** DOM 探针 |

**determinism 铁律（v0.2，红队 C1/C2）**：
- **不准把易变片段冻成字面量**：URL 里的实体 ID/uuid/时间戳、`atl_<ts>` 名字、query 串 —— 一律用 `startsWith`/`matches`/模板，不用 `equals`。冻结期有 lint：`equals` 字面量含 `atl_`+数字串或像 ID 的数字段 → 报红。
- **`uniqueName` 永不进冻结字面量**：check 期按 `instantiate()` 把 `{{uniqueName}}`/`{{ts}}` 实例化为当次运行名再比（镜像 `_data_runner.instantiate`）。
- 某步唯一可用信号被「≤16 字/无数字」过滤掉 → 标该步**无硬后置断言、route:human**，绝不静默发空断言。

---

## 3. 生命周期：归一 → 编译 → 冻结 → 回放 → 裁定 →（自愈）→ 报告

**LLM 只在相 0/1/2/5 出现；相 3/4/6 是纯 L0、可复现、不烧 token。**

```
相0 归一(L1)      excel/txt/freetext ─parseTestCase→ TestCase
相1 编译(L3 一次)  agent 真机跑一遍：intent→稳健动作 + 观测真实现状
                  ─→ spec/events(可改) + observed-<caseId>.json(观测现状)
相2 冻结(L2→人签)  LLM 草拟 expected[] ─人签→ 进 prd-<caseId>.json + testChecksums 冻结（**只冻断言，不冻 spec**）
相3 回放(L0)      确定性重放 spec：录屏 + 抓回复 + watchPageLifecycle + watchNetworkForensics
相4 裁定(L0)      verdict.mjs 跑 §4.2 判定树 ─→ 每步多态裁定 + verdict.json
相5 自愈(L3 有界)  **仅对确证 HARNESS_ERROR**：重锚→**写 drift 补丁到旁文件（不就地改 spec）**→人签后才应用→重跑
相6 报告(L0)      自包含 HTML（报告骨架改造 + 裁定徽章 + 期望对实际）+ 机读 verdict.json
```

- **「编译」= 文本 → 确定性可回放 spec。** 相 1 是 LLM 唯一一次「直接跑用例」：① 把 intent 解析成稳健动作落 `events.json`；② 落 `observed-<caseId>.json` 当地面真值（真实成功 URL/提示/回复/请求日志）；③ 标 `CASE_DEFECT` 候选（**仅此编译期、人签前有效** —— 见 §4.3）。
- **回放只跑相 3→4(→5→6)。** 可复现性来源：日常回归确定性，LLM 只在确证漂移自愈时回现场。
- **相 1 determinism 契约（红队 M）**：记 `observedReality`/做后检查前，必等**静默点**（networkidle + 无动画 + DOM 稳定 K ms），不靠 `waitForTimeout` 硬睡；spec 落**稳定属性**（role+accessibleName+stepId），**禁止纯坐标步**语义不变（定位必须走稳定属性，坐标绝不作定位依据）；画布拖拽经 `dragTo` 动作类封装为确定性动作——源经语义定位器 + 点击身份门定位，落点坐标（`ox`/`oy`）是内容参数而非定位兜底；无法封装的本质不可复现步仍标 route:human（2026-07-07 真机二号探针实证修订，wf-add-node GRILL D2）。

### 3.1 「loop」的再诠释 + 熔断器（v0.2 修正）

- 内层（执行）：迭代单元 = 一个浏览器动作 + 一道 L0 后检查；终止 = 所有 intent 消费完且 verdict 出齐。
- 外层（构建/修复）：迭代到裁判翻绿或熔断跳闸。
- **熔断器无进展信号（红队 minor）**：autotester 的 `zeroCommitStreak` 以 `git HEAD` 不变记「无进展」—— 浏览器动作循环里**没有每步 commit，照搬会误跳闸**。改喂**每步进展哈希**（快照差分 / 已满足步数）经新 `--progress` 旗标；`maxIterations`/`sameErrorStreak`/`maxHours` 照搬。
- **并发模型（红队 C）**：`contract.mjs`/`breaker.mjs` 是**单活契约 + 单全局状态**。MVP **串行跑用例**（每条用例一进一出：一个 active-contract + 一次 breaker reset，跑完拆掉再下一条）。要并行须按 caseId 参数化两个 singleton（`LOOP_CONTRACT_FILE` 已支持；breaker 需加 `--state <path>` —— 属代码改动，非照搬）。

---

## 4. 多态裁定模型 ★（本设计中枢，回应你的核心要求）

你的关键补充：裁判必须区分**测试过程错误 / 测试用例本身有 bug / 被测真缺陷**。v0.2 把它做成 **fail-safe 的三机器态 + `NEEDS_HUMAN` 族**。

### 4.1 裁定态（v0.2 重构）

| 态 | 中文 | 终判性 | 含义 | 后续动作 |
|---|---|---|---|---|
| `PASS` | 通过 | **机器终判** | 动作执行成功且全部冻结断言满足 | 无 |
| `SUT_DEFECT` | 被测缺陷（真 bug） | **机器终判（需取证背书）** | 用例已人签 + 工装确证做了对的动作 + 可观测响应违反期望 + **取证背书**（pageerror/5xx/crash/error-envelope，或唯一目标点击后断言硬失败） | 自动出缺陷单；**禁止自愈** |
| `HARNESS_ERROR` | 过程错误（工装漂移） | 可自愈 | **正向确证**的定位漂移：录制 locator 不再命中，但**同稳定签名**（accessibleName/semantic.name）的唯一元素在 | 触发**有界自愈**；自愈产出经 L0 复核 |
| `NEEDS_HUMAN` | 待人裁决 | 路由人 | 机器无法证明上述任一者；**绝不自愈、绝不自动记缺陷**。带 `reason` 子类（见 §4.3） | 升级 inbox + route:human，人三选一 |

> **核心安全规则（红队 verdict-C1/C2/M）**：`HARNESS_ERROR` 只发于**正向漂移证据**；`SUT_DEFECT` 只发于**取证/唯一目标背书**；二者都证不出 → `NEEDS_HUMAN`。这样「真 bug 表现成元素不见了」**不会**被默认成可自愈而被抹平。

### 4.2 确定性判定树（零 LLM，`verdict.mjs`）

每步 L0 记录三组事实：
- `actionPerformed` —— **且必须是「对的动作」**：仅当 **(a) 解析目标唯一（text/visible 过滤后 count===1）** 或 **(b) 点击后身份回读成立**（被点元素/行带期望稳定令牌：aria-selected / 含 atl_ 名 / 开出的抽屉标题匹配 intent）才置 true。多匹配 `.first()` 兜底或落到 dispatchEvent/坐标兜底 → `actionPerformed=ambiguous`。
- `postAssertions` —— 每条冻结 `expected[]` 结果。
- `forensics` —— `watchPageLifecycle`(crash/close/pageerror) + **新建** `watchNetworkForensics`（`page.on('response')`/`requestfailed` 记 {url,status,ts,initiator} + error-envelope body 检查）；**按请求发起方归因，不按时间窗**（红队 M：背景轮询 401 不得翻 verdict）。

```
if actionPerformed===true 且 postAssertions 全过:                  → PASS

elif actionPerformed==='ambiguous':                               # 不能信「点对了」
                                                                  → NEEDS_HUMAN(reason: AMBIGUOUS_ACTION)

elif actionPerformed===true 且 postAssertions 失败:                # 做对了动作，结果不对
    if forensics 背书(5xx/pageerror/crash/error-envelope 且按发起方归因到本步):
                                                                  → SUT_DEFECT（终判，出缺陷单）
    else:                                                         # 干净失败：回归 or 期望过时？
                                                                  → NEEDS_HUMAN(reason: SUT_DEFECT_OR_STALE)

elif actionPerformed===false:                                     # 这步没做成
    if forensics 背书 SUT 错误且归因到本步:                         → SUT_DEFECT（终判）
    elif 确定性漂移信号成立(同稳定签名唯一元素在、仅 locator 漂移):    → HARNESS_ERROR（可自愈）
    elif 编译期/人签前 且 入口可证缺席(目标 role/text 全 DOM count===0): → NEEDS_HUMAN(reason: CASE_DEFECT 候选)
    else:                                                         → NEEDS_HUMAN(reason: INDETERMINATE)
```

> **catch-all 默认是 `NEEDS_HUMAN` 不是 `HARNESS_ERROR`（红队 minor）**：未知失败 fail-safe 升级，而非 fail-open 自愈。`NEEDS_HUMAN` 步可做**有界「同步骤原样重试」**抗抖动，但**重试绝不调 L3 自愈**。

### 4.3 `NEEDS_HUMAN` 的子类与人裁决（区分三类错误的落点）

人在 inbox 看到子类与证据，**三选一**裁决，这就是「区分过程错误 / 用例 bug / 真缺陷」的最终落点：

| `reason` 子类 | 机器为何不敢终判 | 人的裁决选项 |
|---|---|---|
| `SUT_DEFECT_OR_STALE` | 动作对、断言硬失败、但取证干净 | **(a) 确认回归 → SUT_DEFECT 记缺陷**；**(b) 系统是有意改版 → 重签新基线**（新 checksum + `signedAgainstBuild`，旧期望归档） |
| `CASE_DEFECT` 候选 | 编译期/人签前入口可证缺席或期望自相矛盾 | **修用例**（用例本身有 bug） |
| `AMBIGUOUS_ACTION` | 多匹配/坐标兜底，点没点对存疑 | 收紧用例 locator 语义 → 重编译 |
| `AFFORDANCE_ABSENT`（人签后） | 编译时够得到的入口、回归时没了，又无漂移信号无取证 | 走 SUT_DEFECT-或-HARNESS_ERROR 分诊（**绝不**判 CASE_DEFECT —— 用例当时是对的） |
| `INDETERMINATE` | 纯未知 | 看证据人判 |

三条让区分站得住的支点（v0.2 加固）：
1. **人签是 CASE_DEFECT 与 SUT_DEFECT 的分水岭，且只在编译期判 CASE_DEFECT。**「入口可证缺席」在**人签前**=用例缺陷候选；在**人签后**（同入口编译时够得到）=回归或漂移，**绝不**再判用例缺陷（红队 verdict-M）。判别量：*这个入口在本冻结 spec 下曾被够到吗？*
2. **期望版本化 / 重签（红队 verdict-C3）**：每条冻结 `expected[]` 带 `signedAt`/`signedAgainstBuild`/`signerId`。有意改版导致的失败走 `SUT_DEFECT_OR_STALE`→人重签，**不**自动记缺陷 —— 否则每次合理 UI 改版都误报，操作员会学会无视 verdict，信号自毁。
3. **取证背书提升置信度，且按请求发起方精确归因**（非时间窗）。

### 4.4 裁定与「流程通过」「回复质量」（继承 autotester Req-1）

- `passes`（gate 写、二值）只看流程断言；`verdict`（verdict.mjs 写、多态）是更细的分类。**回复内容质量不是流程裁定。**
- `streamReplyReceived` 只判「匹配响应回 200 且 finished()」，**禁用 body/duration 入裁定**（它们天生每次变，进报告/judge 道，不进流程裁判）。
- 要语义评分：独立异构家族 LLM-judge，**FAIL 可信、PASS 仍人抽检**，踢出确定性裁判。
- **「内容好不好」走独立下游线，现在人工、将来自动**：回复质量的评分读抓取的回复正文，现阶段人工抽查，将来接 `LLM-judge` 顶上——**同一个下游接口，将来替换时裁判侧一行不动**；它只进报告或转人裁，**永不接进** `verdict.mjs`、绝不写 `passes`/`verdict`。机器裁判对流式永远只判「回来了且传完」，内容质量不进它那张表。

---

## 5. 严格断言：草拟 → 冻结 → 确定性裁判（v0.2 修正）

- **相 2-① 草拟**：从 intent + `observed-<caseId>.json` 推导带类型断言（只用 §2.1 词表 + op 约束）。**默认结构式断言**（startsWith/matches/方向/回读），易变值模板化。
- **相 2-② 冻结 + 物理隔离（红队 loop-M）**：断言写进 `prd-<caseId>.json`，`passes:false`，`testChecksums` 只冻**断言文件**（+ 一个冻结期望旁车）。**spec/events 是另外的文件、不进 testChecksums** —— 这样自愈改 locator 不触 ratchet（合法），改断言必触 ratchet（拦住）。spec/events 的完整性另由 `checkFingerprint`（pin `recordedAt+length`）作为 gate 检查项守。**人签**后才算数。
- **相 2-③ 裁判 = 两个分进程写者（红队 loop-C）**：
  - `gate.mjs`（**二值、唯一写 `passes`**）：每条 `expected[]` **编译成一条可运行 check 命令** `node bin/check.mjs --case <id> --intent <id> --kind <k> --op <op> --value <v>`（exit 0 = 过），仍塞进 `acceptance[]` 字符串数组 —— **prd.schema 的 acceptance 形状不变**，gate 主循环原样。
  - `verdict.mjs`（**多态、写 `verdict.json`**，零 LLM）：读 gate 的逐步事实 + forensics 跑 §4.2 树。**自愈探针不在此进程**（自愈是相 5 的下游消费者）。

**保持严格的纪律**（照搬）：只捕获干净信号；长且每次变的 LLM 输出**抓取展示但不作断言依据**；计数比方向不比绝对值且**实时采 baseline**。

---

## 6. 输出契约（v0.2：机读 verdict 与人看报告分离）

**两个产物（红队 determinism-minor）**：
- **`verdict.json`（可复现、做 golden 的唯一对象）**：caseId + 逐 intent/step 的 `verdict` 枚举 + `passes` + 期望对实际字面量 + 取证引用。golden 只校它。
- **人看 HTML 报告（不做 golden）**：内嵌录屏/截图/时间戳，天生不字节复现。

报告小节（骨架机制复用，但**渲染逻辑是改造非照搬** —— autotester `report.ts` 只有二值 pass/fail，无多态/缺陷单/期望对实际）：
1. **操作说明** —— 编号步骤 = intent + agent 实际动作。
2. **标注** —— `LLM接口`、生命周期取证、**网络取证（5xx/error-envelope）**。
3. **回放录屏** —— Playwright video / CEF `startScreencast` → ffmpeg mp4，内嵌 + 下载。
4. **文本/抓取输出** —— `LLM回复-文本` + `LLM回复-截图`（`waitForReplyByStream` 复用）。
5. **回放步骤/多态裁定** —— 每步**裁定徽章**（通过/被测缺陷/过程错误/待人裁决+子类）+ 具名理由。
6. **缺陷单（仅 `SUT_DEFECT`）** —— 步号 + 期望 vs 实际 + 取证 + 录屏时间点 + trace。
7. **错误 + trace**；8. **截图**。

> 复用边界：保留 `report.ts` 的自包含机制（base64 视频内嵌、webm→mp4、trace 拷贝、附件渲染）当 **helper**；多态徽章/缺陷单/期望对实际从 `verdict.json` 新渲染。

---

## 7. 多目标（你选了三个全要）

裁定/报告/熔断/契约层 **channel 无关**；只编译/回放期按 channel 选实现。

| channel | 复用 | 新增/注意 |
|---|---|---|
| `web`（Heren 中台，主） | 固化登录、语义定位器、`waitForReplyByStream`、site.json、**web events.json 回放管线** | 直接站现成 web 管线 |
| `cef`（Hi小助） | 原生 CDP（`lib/cef.mjs`）、坐标点击/原生 setter、`startScreencast` | **`events.json` 管线只对 web 成立**（`assertWebKind` 对 cef 抛错）；cef 是**另一条 CDP 回放路径**，「复用 runner」**仅限 web** |
| `arbitrary` | site.json 覆盖 | 按站点配置 |

> **红队 loop-M 警告**：`_data_runner.overlayRow` **拒绝 `authored` 场景**（从 events 重生成会丢人工补丁）。LLM 编译产物形同 `authored`。P3 必须先证明 agent 动作→`events.json`→`buildSpecFromEvents` 能不触发 authored/参数化拒绝地往返；否则需新 builder。

---

## 8. loop engineering 映射（**诚实的复用标签**，v0.2 修正）

| autotester 构件 | 角色 | 复用方式（v0.2 校正） |
|---|---|---|
| `GUARDRAILS.md` | 12 护栏 **+ #13 自愈准入门**（只对确证 `HARNESS_ERROR` 自愈）**+ #14 fail-safe 默认**（未知→NEEDS_HUMAN）；落地另含 #15 裁判零 LLM 分进程 + #16 人签门（gate 绿≠完成） | 改写迁移 |
| `prd-<caseId>.json` + `prd.schema.json` | 冻结断言契约 | **改造**：`acceptance` 仍是命令数组（每条=一次 check 调用）；**新增 schemaVersion 2 的 `verdict` 枚举 + `signedAgainstBuild`**；lane 枚举对齐 `direct/light/full` |
| `gate.mjs` | **二值、唯一写 `passes`** | 几乎照搬（check 命令喂进来） |
| `bin/verdict.mjs` | **多态裁定写者** | **全新建** |
| `bin/check.mjs` | 单条断言确定性检查器 | **全新建**（封装 autotester 原语） |
| `watchNetworkForensics` | 4xx/5xx/error-envelope 取证 | **全新建**（autotester 无此能力，`watchPageLifecycle` 不碰 HTTP） |
| `breaker.mjs` | 约束 agent 自主性 | 改造：无进展信号改喂每步进展哈希（非 git HEAD） |
| `contract.mjs` | 工序接力 + 工序互锁 | 照搬；**MVP 串行跑用例**（单活契约）；契约扁平 `loop/prd-<caseId>.json`（hook 正则原样生效） |
| `term-lint.mjs` + hooks | 统一语言强制 | 照搬 + 扩词表 |
| 录制器注入式捕获 | 编译期 agent 动作→events.json | **新建 recorder-as-library**（见 §9；agent 拥有 context、禁人抖动去噪、避 enrichL0 导航竞态） |
| Reserved Prefix `atl_` + Teardown / 凭据兜底门 / 异构评审 / audit.jsonl | 同义 | 照搬 |

---

## 9. 关键新建组件（红队点名的「不是照搬」清单）

1. **`watchNetworkForensics`**（buildability-C / verdict-C1）：`page.on('response')` + `requestfailed` 记 {url,status,ts,initiator}；error-envelope body 检查（按 site.json 配 `$.code!=0`）。§4.2 的 5xx 分支在它建好前**不可实现**，P5 相关验收**阻塞于此**。
2. **编译期 recorder-as-library**（buildability-C）：autotester `_recorder.mjs` 是**人操作捕获器**（自己 launch 浏览器、阻塞等人关窗、读 clientX/clientY、按 8px 分拖拽/点击、<800ms 合并焦点点击）。改 LLM 驱动须：(a) **agent 拥有 context**、initScript 注入 agent 页、`__atRec` 绑定 agent collector；(b) 明确**哪些 agent 动作映射哪种 event、哪些不支持**（拖拽/自绘下拉/坐标）；(c) **关掉人抖动去噪**（agent 动作本就离散）；(d) 避 `enrichL0` 导航竞态（agent 控时即可）。P3 验收：已知动作序列产**字节稳定 events.json**。
3. **`observed-<caseId>.json`**（buildability-M）：相 1 写、相 2/4 读。每 stepId：`{urlPathnameAfter, cleanTitles[], toastTexts[], replyText, replyStreamUrl, requestLog[]}`。autotester 的 `snap()`（{path,dlg,drw,top}）**最简且有损**（丢长文本/prompt），**不足以**当断言地面真值 —— 这是新捕获路径。
4. **`bin/verdict.mjs` + `bin/check.mjs`**（loop-C）：见 §5。
5. **自愈准入门 + 非就地自愈**（determinism-C3）：仅对确证 `HARNESS_ERROR`；重锚写 **drift 补丁旁文件**（`drift/<caseId>.<ts>.patch`），**原 spec 不变照常回放**直到**人签**应用；同一步 N 次漂移 → 升级 inbox（非一次性漂移，是 flaky locator）。

---

## 10. 风险 × 护栏对照（v0.2 增补）

| 风险 | 会造成 | 中和护栏 |
|---|---|---|
| 把观测值冻成 `equals` 字面量 | 实体 ID/时间戳名每跑变 → **每跑假 SUT_DEFECT** | 默认结构式（startsWith/matches/模板）；冻结期 lint 拦 equals 含 ID/atl_ |
| `uniqueName` 时间戳 vs 冻结字面量 | 名字回读必不符 → 假缺陷 | 永不冻 uniqueName 字面量；check 期实例化再比 |
| 自愈就地改 spec | spec 变动靶 → 不可复现、抹平 flaky | 非就地（drift 旁文件）+ 人签 + spec 指纹进 gate 检查 + 漂移计数升级 |
| **真 bug 表现成元素不见 → 被自愈抹平** ★ | 最危险假绿 | **自愈只对正向漂移证据开闸；缺取证→NEEDS_HUMAN 不自愈** |
| 点错元素 → 断言失败被记成 SUT_DEFECT | **假缺陷、研发被坑** | **点击身份门**：非唯一/坐标兜底点击 → AMBIGUOUS_ACTION→人，不自动记缺陷 |
| 有意改版 → 期望过时 | 每次改版误报、信号自毁 | 期望版本化 + 重签基线通道 |
| 取证按时间窗归因 | 背景 401 翻 verdict | 按请求发起方精确归因 + 站点 allowlist |
| 多用例并发 trample 单活契约/单 breaker | 熔断失效、契约互覆 | MVP 串行；并行须按 caseId 参数化 singleton |
| 多态裁定塞进二值 gate | HARNESS/CASE/SUT 都成「红」→ 区分崩塌、自愈乱开 | gate 二值写 passes；verdict.mjs 另写多态枚举 |
| typed 断言塞进 acceptance 字符串数组 | schema 失效 / 不进 ratchet 可被悄悄放松 | 编译成 check 命令；typed JSON 进 testChecksums |
| LLM 造词/excel 野字段 | 统一语言侵蚀 | CONTEXT.md + term-lint + hooks |
| 真后端残留 / 凭据泄漏 | 污染/不可逆 | Reserved Prefix + 清扫 + Uniqueness Guard / 凭据兜底门 |

---

## 11. 待裁决（route:human，评审拍板）

1. **人签门形态**：建议先 CLI `--sign`，webui 后补。
2. **网络取证归因**：已定**按请求发起方**（非时间窗）+ 站点 origin/API allowlist（默认丢跨域遥测）。留 error-envelope 的 `$.code` 路径按站点配。
3. **`CASE_DEFECT` 判别**：已定**只在编译期/人签前**判候选；判据=入口 role/text 全 DOM（含 shadow/iframe）count===0 且页健康；人签后同症状不判用例缺陷。
4. **编译期浏览器接口**：建议复用注入式录制（recorder-as-library，§9.2），但确认其与 LLM 驱动的 ownership 反转可行后再定；P3 第一验收（events.json 能被 runner 加载且不触 authored 拒绝）是**硬门**。
5. **回归触发**：先 CLI；确定性回放天然适合后续 cron。
6. **并发**：MVP 串行；是否需并行决定要不要现在就给 breaker 加 `--state`。

---

## 12. 红队修订记录（v0.1 → v0.2）

4 路异构 critic（全部对照 autotester 源码核验）共 **30 条 finding（含 9 critical）**，已全部并入上文。要点：

**determinism**：① `equals` 冻字面量遇实体 ID/uniqueName 必假红 → 结构式默认（§2.1）；② 自愈就地改 spec = 不可复现 → 非就地 + 人签 + 指纹进 gate（§9.5）；③ countChange baseline 须实时采（§2.1）；④ 编译期活解析非确定 → 静默点 + 禁坐标步（§3）；⑤ report 时间戳/视频非字节复现 → verdict.json 与 HTML 分离（§6）。

**verdict-logic**：① 取证不存在 + 静默 SUT bug → 新建 `watchNetworkForensics`，且未知失败 fail-safe 成 NEEDS_HUMAN 不 HARNESS_ERROR（§4.2）；② `actionPerformed` 不等于「点对了」→ 点击身份门，歧义点击→AMBIGUOUS_ACTION 不记缺陷（§4.2）；③ 合理改版 vs 回归 → 期望版本化 + 重签（§4.3）；④ 「页健康但入口缺」不可确定性判 CASE_DEFECT → 只编译期判、人签后改判（§4.3）；⑤ 自愈探针不得进裁判进程（§5）。

**loop-fidelity**：① typed 断言 vs acceptance=命令 阻抗失配 → 编译成 check 命令（§5）；② gate 二值 vs 多态 → gate 写 passes、verdict.mjs 写枚举（§5/§8）；③ 单活契约 vs N 用例并发 → MVP 串行（§3.1）；④ 契约路径 vs hook 正则 → 扁平 loop/（§2）；⑤ 冻结边界 whole-file → 断言/ spec 物理分文件（§5）。

**buildability**：① 网络取证是全新建非照搬（§9.1）；② recorder 是人操作捕获器、需重构成 library（§9.2）；③ P5 裁定与 P6 自愈循环依赖 → 拆**只读漂移探针**(P5) 与**写回自愈动作**(P6)；④ 取证窗口须确定性定义（§4.2）；⑤ observedReality 须首类化（§9.3）；⑥ selftest「零依赖」与「真站 SUT_DEFECT 覆盖」冲突 → 两层 selftest（计划 P9）；⑦ stepId 两义 → intentId vs stepId（§2）。

---

## 13. 数据驱动被测参数（`promptset` + 注入向量库，regress scope A）

> 姊妹项目 regress 的「数据驱动回归」子系统迁到 Casey：一条冻结 `chat` flow 复用成 N 条独立用例，每行喂一段不同的 `被测参数`（打进 `chat.sendAndWait` 的 `prompt` 槽的消息文本），聚合成一份报告。术语见 CONTEXT.md（`promptset`/`被测参数`/`注入向量库`/`软期望`/`被测参数 overlay`/`多用例聚合报告`）。**只做数据驱动 + 随发注入向量库 + 聚合报告，不做 LLM 合成**（authoring 属后续独立契约）。

### 13.1 消歧（这一维度到底是什么）

- **「参数化」= 数据驱动多行 `被测参数`**，不是 `caseId` 并发参数化（`worktree-baton` 已解、否决共享池，§3.1/护栏 #18），也不是 `entityNameParam` 前缀参数化（R12/`compile-gate` 已落，唯一名令牌破坏性硬闸）。
- **「内置提示词」= 随工具发的 `注入向量库`**（喂给 SUT 的边界/安全测试输入），不是 Casey 自身归一/编译/草拟/自愈的工装提示词（那些委托 CLI 外 LLM、仓内无落地模板，见 `归一提示模板` 词条）。

### 13.2 `promptset` schema（`lib/promptset.mjs`，零 LLM，fail-closed）

```jsonc
[ { "id": "p01_normal",           // ^[a-z0-9_]+$，唯一 + 文件系统安全（作 caseId slug 与 trace 名）
    "text": "头疼三天，伴轻微恶心",   // 被测参数：打进 chat.sendAndWait 的 prompt 槽
    "source": "user",              // user（人写）| builtin（随库发）；缺省 user
    "category": "normal",          // normal | boundary | security；缺省 normal（库由文件名强制）
    "expect": {                    // 软期望（可选）——只标注、绝不判红
      "mustInclude": ["建议"], "mustNotInclude": ["操作失败"], "note": "正常问诊应给建议" } } ]
```

`parsePromptset` 确定性校验，任一不合（非数组/空/id 非法或重复/text 空/source·category 枚举错/expect 形状错）fail-closed 抛——宁在收集期早失败，不产半成品报告（镜像 regress `parseCaseFile`）。

### 13.3 被测参数 overlay（复用现成占位槽，不漂移 spec）

冻结 flow 的 `chat.sendAndWait` fill event 带 `value:"{{promptText}}"`（占位符、不冻字面量，护栏 #6）。`overlayPromptset` 定位 flow 里**唯一**一个 `{{promptText}}` 槽（0 或 >1 fail-closed——数据驱动无确定锚），**绝不改 flow**：跨行共享同一冻结 events，逐行只把 `ctx.promptText` 换成本行 `text`，`bin/replay.mjs` 既有 `instantiate(ev.value, ctx)` 在 fill 时回填（新增 `--prompt-text` 把本行文本注入 `ctx`）。`RH_PLACEHOLDER` 已覆盖 `{{promptText}}`——回放历史始终显 `{{promptText}}`、绝不落真被测参数（护栏 #7）。这就是「硬断言跨行同一冻结 flow 集、不因行不同而漂移 spec」的机制落点。overlay 是**新纯函数**，不照搬 regress `overlayRow`（其拒 authored 场景，Casey 编译产物形同 authored）。

### 13.4 软期望走现成 soft 通道（绝不进裁判）

`expect` 合成 `soft:true` 断言（`mustInclude→replyContains`；`mustNotInclude→replyMatches` 负向环视），经 `bin/replay.mjs` 新 `--soft-expect` 通道并入 `evaluateAssertions`：

- 该通道**强制 `soft:true`**——本通道定义即软、绝不注入影响裁定的硬断言，故合法不过人签闸（人签保护的是进裁定的断言，护栏 #16），**不碰 `lib/sign-gate.mjs`**（签署 `expected` 契约原样全签闸不变）。
- soft 断言落 axes → `verdict.mjs` 按护栏 #17 只 AND 硬断言 `ok`、忽略 soft（**裁判零改**）→ `report-model` 既有 `projectPost` 带 soft → 报告黄标。

内核不变量逐条守：裁判零 LLM（不碰 `verdict.mjs`）、fail-safe（全链 fail-closed）、不碰冻结/人签闸（冻的是母体 flow + 结构硬断言、非 N 份；soft 另立通道）。

### 13.5 注入向量库（随发、可编辑扩展）

`prompts/_lib/boundary.json` + `security.json` 随仓发。category 由文件名强制、`source` 强制 `builtin`、id 前缀 `bnd_`/`sec_` 强制（缺前缀 fail-closed，防撞）；`overlayPromptset` 按开关（默认并入、`--no-builtin` 关）把两库并进每个数据驱动用例集，跨集合 id 全局唯一硬拒。逐字对标 regress 共享库语义。

> **护栏 #7 优先（凭据门零弱化）**：`credentialGate` 对 token/password/secret/cookie/… 做子串 fail-closed。被测参数必进报告，故随库发的向量**避开这些英文子串**（用中文注入向量：忽略上文/越权/系统提示词回显/超长/角色混淆——对中台 SUT 也更贴切）。用户自写含禁字段英文子串的被测参数，报告落盘 fail-closed（由用户改写消解）。展示字段（promptText/name/note）另走 `redactScalar` 纵深防御。

### 13.6 多用例聚合报告（兑现 report-spec §7）

逐行落各自 run 子目录（`runs/<caseId>/promptset/<promptId>/`）——冻结 events 的 `caseId` 固定、`report-model` 同源校验要求 verdict/axes/events caseId 一致，故逐行 model `caseId` 诚实 = 母体 id、**不伪造**；行与行由 `promptset` 块的 `promptId` 区分（非文件名）。`report-model` 加可选 `--promptset-meta` 投影 `promptset` 块进 `.report.json` 旁车。`assembleAggregateModel` 吃 N 份旁车 → 按 category 分段 + 置顶横幅（`verdictSummary` 有 `SUT_DEFECT`/`NEEDS_HUMAN` 的行顶上去）+ content-expect 黄标（从旁车 `steps[].assertions` 的 `soft===true` 项取，**绝不进裁定**：聚合 `verdictTotals` 只累加旁车自带 `verdictSummary`、其本身已排除 soft）；畸形旁车 fail-closed。`bin/report.mjs --aggregate` 扫旁车 → 装配 → 渲染（`renderAggregate` 三形态）→ 过 `credentialGate` → 落 `index.report.{html,md,json}`。`casey run --promptset` 直通编排器 `bin/promptset.mjs`：逐行 replay→verdict→report-model→report，末了聚合。
