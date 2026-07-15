# Stagehand 动作对象借鉴备忘录

> 日期：2026-06-30
>
> 目的：记录 `Casey` 应该从 Stagehand 借鉴的动作对象、缓存证据、运行历史和浏览器基座设计，并明确哪些地方必须按 `Casey` 的统一语言、硬规则与护栏改造。
>
> 边界：本文是设计备忘录，不直接修改 `events.schema.json`、`bin/replay.mjs` 或 `bin/verdict.mjs`。真正落地时仍需另开实现计划、补 golden，并过 `Quality Gate`。

## 开发准则对齐

本文写作和后续改造必须遵循这四个项目内文件，而不是凭外部项目术语直接搬运：

- `CONTEXT.md`：统一语言注册表。所有核心概念命名以它为准；弃用别名是黑名单；新概念要先查既有学科术语，造词必须先登记。
- `docs/adr/0005-ubiquitous-language-enforcement.md`：统一语言强制的 `ADR`。写入的 `md/json` 会被 `term-lint` 检查，术语违例、繁体字、未登记的加粗英文术语都会红。
- `CLAUDE.md`：项目级硬规则。关键约束包括 `裁判零 LLM`、`fail-safe` 不 `fail-open`、凭据不得进入输出，以及 `Casey` 当前架构边界。
- `loop/GUARDRAILS.md`：工程护栏清单。本文尤其受护栏 #4、#5、#7、#13、#14、#15、#16、#17 约束。

因此，本文只把 Stagehand 作为外部参考；所有落地建议都要回到 `Casey` 的 `编译`、`确定性回放`、`三轴`、`多态裁定`、`人签门`、`自愈准入门` 和 `非就地自愈` 模型。

## 来源

- [Stagehand observe()](https://docs.stagehand.dev/v3/references/observe)
- [Stagehand act()](https://docs.stagehand.dev/v3/references/act)
- [Stagehand class reference](https://docs.stagehand.dev/v3/references/stagehand)
- [Stagehand locator reference](https://docs.stagehand.dev/v3/references/locator)
- [Stagehand Caching Actions](https://docs.stagehand.dev/v3/best-practices/caching)
- [Stagehand History Tracking](https://docs.stagehand.dev/v3/best-practices/history)
- [Stagehand Deterministic Agent Scripts](https://docs.stagehand.dev/v3/best-practices/deterministic-agent)

核验日期：2026-06-30。

## 总览

Stagehand 对 `Casey` 有三类价值：

- 冻结回放产物：借鉴紧凑的动作对象形状，但把 Stagehand 的 selector 锚改成 `Casey` 的 `语义定位器` 和稳定签名。
- 回放证据：借鉴缓存命中状态、缓存键来源、运行历史和指标，但这些只能作为证据层，不能改写 `多态裁定`。
- 浏览器基座：借鉴 DOM 稳定等待、变量占位、作用域裁剪、多页处理、`CDP`（Chrome 调试协议）接入和错误分类。

Stagehand 不能作为 `Casey` 的裁判和自愈治理模型。`Casey` 不能借运行期静默 LLM fallback、cache miss 后自动问 LLM、同轮自愈翻绿、LLM 最终裁判。

> 术语说明：本文「动作对象」一词指 Stagehand 外部对象；`Casey` 侧的对应物是 `events.json` 条目与 `三轴` 的动作轴，凡涉及 `Casey` 内部结构以后者为准，避免与已登记术语双名竞争。

## 1. 动作对象形状

### Stagehand 中如何设计

Stagehand 的 `observe()` 返回一组 action 对象，形状接近一个 JSON 化的 Playwright 动作：

```jsonc
{
  "selector": "...",
  "method": "click|fill|type|selectOption|...",
  "arguments": ["..."],
  "description": "<human-readable action description>"
}
```

它的好处是简单：

- `selector` 指向目标元素。
- `method` 表示动作类型。
- `arguments` 存动作参数。
- `description` 存自然语言说明，方便人读和后续恢复。
- `act(action)` 可以直接执行这个对象，不必重新让 LLM 推理动作。

它的问题也在 locator 一侧：Stagehand 文档里的 `selector` 主要是 XPath。XPath 很精确，但常常和 DOM 位置绑定，页面结构一动就容易失效。

### Casey 需要怎么做

`Casey` 可以借动作对象骨架，但不能借 XPath 作为主锚。`events.json` 应该把 selector 改成 `语义定位器` 合同：

```jsonc
{
  "stepId": "atstep_3",
  "intentId": "create_workflow.fill_name",
  "description": "填写工作流名称",
  "action": {
    "method": "fill",
    "arguments": ["{{workflowName}}"],
    "locator": {
      "role": "textbox",
      "accessibleName": "工作流名称",
      "semantic": "workflow.name",
      "fallbackCss": "...",
      "stableSignature": {
        "role": "textbox",
        "name": "工作流名称",
        "within": "新建工作流表单"
      }
    }
  },
  "observedBefore": {},
  "observedAfter": {},
  "checksum": "sha256:..."
}
```

> 提案说明：上面是借鉴形状示意，不是目标 `events.json`。已**冻结**的 `events.schema.json` 用平铺定位字段 + 字符串枚举 `action` + `intentId` 模式 `^intent_[0-9]+$` + `additionalProperties:false`；本示例的嵌套 `action`/`locator`、点分 `intentId`、字符串 `semantic`、以及 `checksum`/`description`/`observedBefore` 等附加字段都不会通过已冻 schema 校验。任何采纳都需另开实现计划、重开冻结接缝（触 `Test Ratchet`）并先登记 `CONTEXT.md`。

落地规则：

- 保留 `method`、`arguments`、`description` 作为最小动作核心。
- 把 Stagehand 的 `selector` 替换为 `{ role, accessibleName, semantic, fallbackCss, stableSignature }`。
- `fallbackCss` 只能作为调试证据或次级兜底线索，不能成为冻结主锚。
- 必须保留 `intentId`，让多个 `stepId` 可以卷回同一条用例意图，服务 `多态裁定` 和报告。
- `observedBefore` / `observedAfter` 要绑定 `观测现状`，不能只是装饰字段。
- `checksum` 用于冻结产物防篡改，落地时应和 schema / fixture / gate 对齐。
- `description` 可以保留，因为它是 `NEEDS_HUMAN` 和漂移评审时低成本的人读锚点。
- ⚠️ 待对齐：示例 locator 内的字符串 `semantic`（如 `workflow.name`）与已冻 `events.schema.json` 的对象 `semantic`（`{kind,name,role,exact}`）冲突，且与已登记术语 `语义定位器` 同词不同义。落地前须二选一：删此字符串键，或先经 grill 登记为独立「语义键」术语并对齐已冻形状。

## 2. observe-then-act 分离

### Stagehand 中如何设计

Stagehand 的典型流程是：

- `observe()`：让模型观察页面并给出候选动作。
- `act(action)`：执行某个已经返回的 action 对象。

这个拆分很关键：发现动作可以用 LLM，执行动作可以用结构化对象。

Stagehand 同时也支持直接 `act("...")`，也就是把自然语言指令直接交给运行期执行。

### Casey 需要怎么做

`Casey` 只借前半个分离思路，不借运行期自然语言执行。

对应生命周期：

- `编译`：LLM 或录制端提出 `events.json`、`观测现状` 和候选断言。
- 冻结和签署：确定性 schema 检查 + `人签门` 让产物进入可回放状态。
- `确定性回放`：`bin/replay.mjs` 只执行冻结事件。

落地规则：

- 回放期不能出现 `act("点击保存按钮")` 这种自然语言执行。
- 回放期的自然语言只能作为 `description` 等元数据存在。
- `event.action.method`、`event.action.arguments`、`event.action.locator` 才是可执行部分。
- 如果编译产物只有自然语言动作，没有结构化动作对象，应 fail-closed，而不是在回放期补问 LLM。

## 3. 缓存命中可观测

### Stagehand 中如何设计

Stagehand 的缓存不是黑盒。它会暴露 `cacheStatus: HIT|MISS`，缓存键和 instruction、page content、options 等输入有关。本地 cache 也可以被复用，甚至提交到 CI 场景中。

这个设计值得借鉴的点不是“有缓存”，而是“缓存是否命中可观察、可解释”。

### Casey 需要怎么做

`Casey` 应借缓存可观测性，但不能借 cache miss 后静默问 LLM。

建议证据字段：

```jsonc
{
  "stepId": "atstep_3",
  "cacheStatus": "hit|miss|stale|bypass",
  "cacheKeyParts": {
    "instructionHash": "sha256:...",
    "pageFingerprintHash": "sha256:...",
    "optionsHash": "sha256:...",
    "contractHash": "sha256:..."
  }
}
```

落地规则：

- `cacheStatus` 只进入 `run-history.jsonl`（证据/历史层），**禁止进入 `axes.json`**：`axes.json` 是零 LLM `bin/verdict.mjs` 的输入接缝，掺入 LLM 编译缓存派生信号会为「按 `cacheStatus` 分支」留口（护栏 #15/#17）。报告层若需展示缓存命中，从 `run-history.jsonl` 读，绝不经 verdict 输入。
- `cacheKeyParts` 用于解释为什么某个冻结产物可复用。
- cache miss、stale、bypass 不能触发运行期 LLM fallback。
- cache miss 后应进入确定性分类：正向证明漂移才是 `HARNESS_ERROR`，证不出就是 `NEEDS_HUMAN`。
- 本地 cache 可以进 CI 的前提是：可复现、无凭据、绑定冻结契约 checksum。
- cache 证据不能覆盖 `bin/verdict.mjs` 的判定树。

## 4. 运行历史与指标

### Stagehand 中如何设计

Stagehand 有 history 和 metrics。history 记录 method、parameters、result、timestamp；metrics 记录运行和模型相关统计。

这提供了第二层事实：动作计划说明“应该做什么”，history 说明“这次实际发生了什么”。

### Casey 需要怎么做

`Casey` 应增加 `run-history.jsonl` 和可选的 `run-metrics.json`。

> 提案待登记：`run-history.jsonl` 与 `run-metrics.json` 是新的回放证据产物，尚未登记 `CONTEXT.md`、也不是已冻接缝。落地前须经 grill 在 Casey 核心域定名登记，并写死「仅报告/调试用，绝不进 `bin/verdict.mjs` 输入、绝不写 `passes`」（护栏 #15）。

建议 `run-history.jsonl` 单行：

```jsonc
{
  "timestamp": "2026-06-30T10:30:00.000+08:00",
  "caseId": "tc_workflow_create_smoke",
  "stepId": "atstep_3",
  "intentId": "create_workflow.fill_name",
  "method": "fill",
  "parameters": {
    "locator": {
      "role": "textbox",
      "accessibleName": "工作流名称"
    }
  },
  "cacheStatus": "hit",
  "locatorResolution": "unique",
  "quietPointReached": true,
  "durationMs": 183,
  "result": "ok"
}
```

建议 `run-metrics.json`：

```jsonc
{
  "caseId": "tc_workflow_create_smoke",
  "totalSteps": 6,
  "passedActions": 6,
  "locatorHitRate": 1,
  "cacheHitRate": 0.83,
  "quietPointWaitMs": 1240,
  "totalDurationMs": 9320
}
```

落地规则：

- `run-history.jsonl` 是报告和调试证据。
- `run-metrics.json` 是趋势、flake 分析和性能诊断。
- history / metrics 不能写 `passes`，也不能覆盖 `bin/verdict.mjs`。
- 不能因为 history 看起来健康就判 `PASS`。
- `多态裁定` 仍然只吃确定性的 `三轴`、冻结断言、`观测现状` 和取证事实。

## 5. DOM settle 与静默点

### Stagehand 中如何设计

Stagehand 提供 `domSettleTimeout`（DOM 稳定等待超时），让动作和观察等 DOM 稳定后再执行。这个设计承认了一个真实问题：如果在半渲染状态下采 selector、截图、文本或指纹，结果会很脏。

它值得借鉴的是：不要用随手 sleep 代替页面稳定条件。

### Casey 需要怎么做

`Casey` 应把它升级为 `静默点` 合同。`观测现状`、指纹、截图、断言 actual 都应在 `静默点` 后采。

建议证据字段：

```jsonc
{
  "quietPoint": {
    "networkIdleMs": 500,
    "domStableMs": 300,
    "animationStableMs": 300,
    "maxWaitMs": 10000,
    "reached": true,
    "waitedMs": 1240
  }
}
```

落地规则：

- `observedBefore`、`observedAfter`、AX 指纹、截图、断言 actual 都必须在 `静默点` 后采。
- `axes.json` 要记录 `静默点` 是否达成和等待耗时。
- 没到 `静默点` 时，不能把断言结果假装成可靠事实。
- 长时间达不到 `静默点` 应进入确定性分类；证不出 SUT 问题时默认 `NEEDS_HUMAN`。
- 若同时有 pageerror、crash、5xx 或错误信封证据，再按 `网络取证` 和生命周期事实考虑 `SUT_DEFECT`。

## 6. 变量与敏感值

### Stagehand 中如何设计

Stagehand 支持变量占位。变量让动作参数可以引用占位符，把具体值和动作结构分开。对敏感值而言，这能减少模型直接接触真实值。

### Casey 需要怎么做

`Casey` 应用占位符表达动态值和敏感值：

```jsonc
{
  "arguments": ["{{workflowName}}"],
  "variables": {
    "workflowName": {
      "kind": "generated",
      "prefix": "atl_",
      "scope": "case-run"
    }
  }
}
```

落地规则：

- 冻结占位符，不冻结一次性生成值。
- 真实环境创建的实体必须使用 `Reserved Prefix`，例如 `atl_`。
- replay 开始时解析变量；需要记录时只能进入无凭据证据。
- `.auth/` 和 `site.json` 内容不得进入日志、报告、提交或示例。
- 敏感值在报告落盘前必须脱敏。
- 变量解析可以进入 `run-history.jsonl`，但不能成为 `多态裁定` 的隐藏输入。

## 7. 作用域裁剪与噪声屏蔽

### Stagehand 中如何设计

Stagehand 的 `observe()` 支持用 `selector` 限定观察范围，也支持 `ignoreSelectors`（排除选择器）排除噪声区域。这样可以避开推荐区、浮窗、聊天插件、重复按钮等干扰。

### Casey 需要怎么做

`Casey` 应把它落到 `通道剖面` 或冻结事件元数据中：

```jsonc
{
  "scope": {
    "include": ["main", "[role='dialog']"],
    "exclude": [
      "[data-testid='floating-chat']",
      ".recommendation-panel",
      ".toast-container"
    ]
  }
}
```

落地规则：

- 用作用域裁剪降低定位歧义和指纹噪声。
- scope / exclude 必须可审计，不能隐式藏在 driver 代码里。
- 不能用 exclude 遮掉业务期望所在区域。
- 如果断言目标落在 exclude 区域，schema 或 compile gate 应报错。
- 报告要展示本次回放启用了哪些屏蔽规则，方便人排查 false negative。

## 8. locator 执行细节

### Stagehand 中如何设计

Stagehand 的 locator 层不只是 `page.click(selector)`，它包含一些浏览器控制细节：

- 动作执行时再懒解析目标。
- 用 CDP 能力辅助执行。
- 在 isolated world（隔离执行环境）中执行，避免被页面脚本污染。
- 支持 iframe 和 shadow DOM。
- 提供 centroid（元素几何质心坐标）等几何信息。
- 提供 `backendNodeId()`（`CDP` 节点后端 id）这类同轮节点身份线索。

### Casey 需要怎么做

`Casey` 应把 locator 执行变成带证据的解析结果：

```jsonc
{
  "locatorResolution": {
    "status": "unique|none|ambiguous|fallback_first|coord_fallback",
    "candidateCount": 1,
    "backendNodeId": 12345,
    "centroid": { "x": 421, "y": 238 },
    "framePath": ["main"],
    "shadowPath": []
  }
}
```

落地规则：

- 每个回放步都重新解析 `语义定位器`。
- 记录候选数量、是否歧义、是否 fallback。
- `unique` 可以作为强动作证据。
- `actionPerformed=true` 与 `PASS` 资格只由 `点击身份门` 授予（过滤后 count===1 或点击后身份回读成立）。
- `coord_fallback`、纯坐标、多匹配 ambiguous 由 `点击身份门` 强制为 ambiguous，**永不经坐标证据落 `PASS`**；至多在有 `网络取证` 背书时升级为 `SUT_DEFECT`，否则路由 `NEEDS_HUMAN`。`fallback_first` 仅当点击后身份回读成立才可达 `PASS`，否则默认 `NEEDS_HUMAN`（删去含糊的「可以安全分类」逃逸口，对齐本节「`点击身份门` 应消费 locator resolution」）。
- `backendNodeId` 只能作为同轮身份线索，不能作为跨 run 冻结锚。
- 纯坐标不能成为主定位锚。
- `点击身份门` 应消费 locator resolution，而不是只看动作 API 有没有抛错。

## 9. 多页与 active page（当前活动页）管理

### Stagehand 中如何设计

Stagehand 有 browser context、active page、新页面和多标签页相关 API。真实业务系统常见弹窗、登录页、新标签预览、支付页、下载页，这些都不能假设只在第一个 page 里发生。

### Casey 需要怎么做

`Casey` 应在事件和 `三轴` 里显式建模页面目标：

```jsonc
{
  "pageTarget": {
    "mode": "active|newPage|popup|named",
    "name": "workflow-preview",
    "urlPattern": "/workflow/preview"
  }
}
```

落地规则：

- 不假设第一个 page 永远是目标 page。
- 记录 page 创建、关闭、聚焦、URL 变化到 `run-history.jsonl`。
- 断言要绑定到预期 page。
- 非预期 page focus 变化应进入确定性错误轴。
- auth、计费、安全类跨域流程应走 `Escalation Path` 或 `人签门`，不能无人值守自愈。

## 10. Browser attachment 与 CDP

### Stagehand 中如何设计

Stagehand 支持本地浏览器、远程浏览器会话，也支持通过 CDP attach 到已有 Chrome。这个设计说明：浏览器传输层应该和动作对象分离。

### Casey 需要怎么做

`Casey` 应把传输层放进 `通道剖面`，不要塞进每个动作：

```jsonc
{
  "channelProfile": {
    "channel": "web|cef",
    "transport": "playwright|cdp",
    "cdpUrl": "ws://127.0.0.1:9222/devtools/browser/...",
    "viewport": { "width": 1440, "height": 900 },
    "locale": "zh-CN",
    "timezone": "Asia/Shanghai"
  }
}
```

落地规则：

- `events.json` 尽量保持 transport-neutral。
- CDP URL、viewport、locale、timezone、permissions、user-data-dir 属于 `通道剖面`。
- `通道剖面` 的 checksum 应进入回放证据。
- CEF 优先走 CDP attach，但仍使用 `Casey` 的 `语义定位器`、`三轴` 和 `裁判零 LLM`。
- 传输层变化不应改变 `多态裁定` 语义。

## 11. 错误分类

### Stagehand 中如何设计

Stagehand 把错误拆成多类，例如 DOM 处理失败、evaluation 失败、iframe 解析失败、XPath 解析失败、shadow root 缺失、LLM 响应失败、模型配置缺失等。

它值得借鉴的是 typed error boundary：失败不应该全叫 action failed。

### Casey 需要怎么做

`Casey` 应在进入 `bin/verdict.mjs` 前把 driver 异常归一成确定性错误轴：

```jsonc
{
  "error": {
    "code": "LOCATOR_NOT_FOUND|LOCATOR_AMBIGUOUS|FRAME_NOT_FOUND|SHADOW_ROOT_MISSING|DOM_NOT_STABLE|ACTION_TIMEOUT|PAGE_CRASH|NETWORK_5XX|ASSERTION_FAILED",
    "message": "...",
    "stepId": "atstep_3"
  }
}
```

落地规则：

- driver-specific exception 必须先归一，再进入 `多态裁定`；但 `error.code` 只承载动作轴的工装/驱动异常（`LOCATOR_*`/`FRAME_NOT_FOUND`/`SHADOW_ROOT_MISSING`/`DOM_NOT_STABLE`/`ACTION_TIMEOUT`）。
- 上面枚举里的 `ASSERTION_FAILED` 必须回逐条断言轴，由 `bin/check.mjs` 写 `postAssertions.ok`，不走 `error.code`；`NETWORK_5XX`/`PAGE_CRASH` 必须回取证轴，由 `网络取证` 按请求发起方背书。把三轴塞进一个错误信封会与「`verdict.mjs` 对断言 kind 不可知」自相矛盾（护栏 #17）。
- `bin/verdict.mjs` 始终只消费已分轴判好的 `三轴` / `StepAxes`，绝不读 `error.code` 分支。
- LLM / compiler 错误不能混入回放 verdict，除非它们影响了冻结产物有效性。
- typed error 用于区分工装陈旧、目标歧义、页面崩溃和真实响应失败。
- 判 `SUT_DEFECT` 必须有断言、生命周期或 `网络取证` 背书。
- generic `UNKNOWN_ERROR` 只能 fail-closed 到 `NEEDS_HUMAN`。
- `verdict.mjs` 应保持对断言 kind 不可知；新断言种类应加在 `check.mjs` 和 golden，而不是改裁判内核。

## 12. 日志 hook 与可观测性

### Stagehand 中如何设计

Stagehand 支持 custom logging 和 inference logs，方便调试 AI 操作与浏览器执行。

### Casey 需要怎么做

`Casey` 可以有结构化日志，但边界要更硬：

- `compile.log`：记录编译提案、schema 失败、确定性校验失败。
- `replay.log`：记录确定性 driver 操作。
- `run-history.jsonl`：逐步结构化证据。
- `run-metrics.json`：聚合诊断指标。
- `redaction.log`：记录报告落盘前做了哪些脱敏。

落地规则：

- 编译期日志只有在明确开启且无凭据时，才可包含 LLM prompt 或 proposal。
- 回放日志必须脱敏，并且不依赖 LLM 上下文才能读懂。
- 报告日志应总结证据，不应倾倒内部敏感信息。
- `redaction.log` 只准记录被脱敏的字段路径、命中的脱敏规则 id、替换计数与占位标记，绝不记录脱敏前原值或任何可还原片段（不存 before/after 对照）。
- `compile.log`/`replay.log`/`run-history.jsonl`/`redaction.log` 等一切日志落盘前都必须过凭据兜底门扫描，与报告同受护栏 #7 约束。
- 日志永远不能成为隐藏 verdict 输入。
- 日志、报告、提交都不得包含 `.auth/` 或 `site.json` 内容。

## 13. 自愈边界

### Stagehand 中如何设计

Stagehand 有 self-healing 行为。它会利用 action description 等上下文，在原 selector 失效时尝试恢复目标。这对“完成网页任务”的 agent 很有用，但对回归测试很危险：真实产品缺陷可能被换目标动作悄悄洗绿。

### Casey 需要怎么做

`Casey` 必须把 `自愈` 放在 `多态裁定` 下游：

- `确定性回放` 不修改 `events.json`。
- `确定性回放` 不问 LLM 找替代目标。
- `bin/verdict.mjs` 先给出四态。
- 只有正向确证的 `HARNESS_ERROR` 才能进入 `自愈准入门`。
- `自愈` 只能产出旁路 `漂移补丁`。
- `漂移补丁` 必须经 `人签门` 后才应用。
- 应用签署补丁后，必须从冻结起点重新回放。

这是 `Casey` 和 Stagehand 的根本分歧之一。

## Casey 落地清单

P5 `确定性回放` 短期可做：

- 输出 `run-history.jsonl`。
- 在回放证据中加入 `cacheStatus` 和 `cacheKeyParts`。
- 在 `axes.json` 中加入 `静默点` 证据。
- 把 locator resolution 归一成 `unique|none|ambiguous|fallback_first|coord_fallback`。
- 在进入 `bin/verdict.mjs` 前归一 typed replay errors。

schema 冻结中期可做：

- 在 `events.schema.json` 中明确动作对象骨架来自 Stagehand action，但主锚是 `语义定位器`。
- 让 `role`、`accessibleName`、`semantic`、`stableSignature` 成为一等字段。
- 保持 `fallbackCss` 次级地位。
- 增加 `pageTarget`、`通道剖面` checksum、变量占位、scope / noise mask 的 schema。
- 若字段名形成新的核心域术语，先回填 `CONTEXT.md`。

CEF / 任意通道长期可做：

- 把传输层和动作语义分离。
- Chromium / CEF 优先通过 CDP attach。
- 任意通道也坚持动作、证据、裁定三层分离。
- canvas 或纯像素目标不能走纯坐标主锚；需要另建签署过的视觉模板合同，否则 route:human。

## 可借鉴与不可借鉴

可借鉴：

- 紧凑动作对象形状。
- `observe()` / `act(action)` 的发现与执行分离。
- 缓存命中状态和缓存键可观测。
- history 和 metrics。
- DOM settle 作为一等运行条件。
- 变量占位。
- 观察作用域与噪声屏蔽。
- CDP 辅助的 locator 执行细节。
- 多页上下文建模。
- browser attachment 作为传输层抽象。
- typed error boundary。
- 结构化日志 hook。

不可借鉴：

- XPath 作为冻结主锚。
- 回放期自然语言动作执行。
- cache miss 后静默 LLM fallback。
- 同轮自愈修改回放路径。
- LLM 最终裁判。
- selector miss、cache miss、动作歧义后静默翻绿。
