# Midscene 借鉴备忘录

> 日期：2026-06-30
>
> 目的：核对 Midscene 官方资料，记录 `Casey` 可以学习、需要改造、明确不能照搬的设计点。
>
> 边界：本文是设计备忘录，不直接修改 `events.schema.json`、`bin/replay.mjs`、`bin/verdict.mjs` 或 `通道剖面` schema。真正落地时仍需另开实现计划、补 golden，并过 `Quality Gate`。

## 开发准则对齐

本文遵循以下项目内准则文件：

- `CONTEXT.md`：统一语言注册表。本文使用 `Casey` 已登记术语描述落地边界。
- `docs/adr/0005-ubiquitous-language-enforcement.md`：统一语言强制机制。本文写入后必须通过 `term-lint`。
- `CLAUDE.md`：项目硬规则。尤其是 `裁判零 LLM`、`fail-safe` 不 `fail-open`、凭据不得进入输出。
- `loop/GUARDRAILS.md`：护栏清单。本文尤其受 #4、#5、#7、#13、#14、#15、#16、#17 约束。

Midscene 是强运行期 AI UI automation 框架；`Casey` 是文本用例到测试报告的确定性回放与 `多态裁定` 系统。因此本文只把 Midscene 当外部参考，不能让 Midscene 的运行期 VLM、`aiAssert` 或缓存 fallback 进入 `Casey` 的裁判内核。

## 来源

- [Midscene 首页](https://midscenejs.com/)
- [Model Strategy](https://midscenejs.com/model-strategy)
- [API reference](https://midscenejs.com/api)
- [Caching AI Planning and DOM Localization](https://midscenejs.com/caching)
- [Automate with scripts in YAML](https://midscenejs.com/automate-with-scripts-in-yaml)
- [BDD-style scripts with Gherkin](https://midscenejs.com/advanced/bdd-style-scripts-with-gherkin)
- [Use JavaScript to optimize the AI automation code](https://midscenejs.com/use-javascript-to-optimize-ai-automation-code)
- [Bridge mode by Chrome extension](https://midscenejs.com/bridge-mode)
- [Integrate with any interface](https://midscenejs.com/integrate-with-any-interface)
- [Consume Report Files](https://midscenejs.com/consume-report-file)
- [Integrate with Playwright](https://midscenejs.com/integrate-with-playwright)
- [AndroidWorld Benchmark Report](https://midscenejs.com/android-world-benchmark-report)
- [Data privacy](https://midscenejs.com/data-privacy)

核验日期：2026-06-30。

## 总览

Midscene 可以给 `Casey` 的新增借鉴点不止缓存和 XPath 限制，主要还有：

- 视觉优先路线对 canvas、CEF、任意界面的启发。
- Planning / Locate / Insight 分工对 `编译` 模型边界的启发。
- `AbstractInterface` 和 action space 对 `channel` / `arbitrary` 的启发。
- YAML / Gherkin 对输入结构化和 `TestCase` 归一的启发。
- 结构化 API 优先于大段自然语言 `aiAct` 的经验。
- report split / Markdown / JSON dump 对 `report-model.json` 和报告取证的启发。
- Bridge Mode 对真实 Chrome 登录态、人工接管和 CEF 传输层的启发。
- AndroidWorld 稳定化经验对 `静默点`、fixture 准备和 validator（校验器）约束的启发。

Midscene 不能照搬的核心点：

- 运行期 VLM 直接决定动作和断言。
- `aiAssert` 作为最终裁判。
- cache miss 后自动回退 AI。
- XPath / 坐标作为长期冻结主锚。
- `continueOnError` 这类继续跑策略进入 `多态裁定`。
- 把纯视觉的便利性替代 `Casey` 的 `三轴` 和取证。

## 1. 纯视觉定位路线

### Midscene 中如何设计

Midscene 1.0 之后把 UI 操作和元素定位转向纯视觉路线：模型主要看 screenshot，不依赖 DOM 和 accessibility annotations。官方理由是纯视觉对 canvas、CSS 背景图、跨域 iframe、桌面、移动端等界面更通用，也能看到用户真实看到的颜色、布局和高亮状态。

它同时承认代价：纯视觉对模型能力要求更高，运行期更依赖视觉 grounding，成本和稳定性受模型影响。

### Casey 需要怎么做

`Casey` 不能把 web 主路线切成纯视觉主导。Heren web 的第一主锚仍应是 `语义定位器`，因为 `Casey` 要可回放、可取证、可解释、可人签。

可以学习的部分：

- 对 canvas、WebGL、动态 SVG、CEF 纯图形区域，承认 DOM / AX 可能不可用。
- 把视觉证据纳入 `观测现状` 和报告附件。
- 对视觉-only 区域引入单独的视觉模板合同，而不是纯坐标。
- 编译期可用 VLM 生成候选视觉模板；回放期用零 LLM 的像素 / 模板匹配做证据。
- 「视觉模板合同」是待登记的新接缝（`CONTEXT.md` 未收）；其命中结果必须落成 `断言词汇表` 中的 typed 断言，新 kind 只加 `bin/check.mjs` + golden、`verdict.mjs` 不分支（护栏 #17），不得另立平行视觉裁判路径。

不可照搬：

- 运行期每次用 VLM 重新定位。
- 把视觉模型命中的坐标当作 `PASS` 证据。
- 用视觉断言替代冻结断言契约。

## 2. Planning / Locate / Insight 模型分工

### Midscene 中如何设计

Midscene 把模型职责分为默认模型、Planning model 和 Insight model：

- 默认模型主要做 Locate 和未显式分配的任务。
- Planning model 处理 `aiAct` / `ai` 的任务拆解。
- Insight model 处理 `aiQuery`、`aiAsk`、`aiAssert` 这类页面理解和断言。

这个分工能提高复杂任务成功率，但本质仍然是运行期多模型参与执行。

### Casey 需要怎么做

`Casey` 可以借职责分离，但必须放在 `编译` 和提案层：

- Planning：用于 `编译` 期把 `TestCase` 拆成 `intentId` 和候选事件。
- Locate：用于 `编译` 期寻找候选 `语义定位器`、视觉模板或 CEF 传输方案。
- Insight：用于断言草拟，从 `观测现状` 推导候选 `expected[]`。

落地规则：

- 这些模型输出都是提案，不能直接进入 `多态裁定`。
- `Insight` 可以草拟断言，但断言必须进 `冻结断言契约` 并经过 `人签门`。
- `Locate` 可以提出 locator，但回放时必须由确定性解析和 `点击身份门` 验证。
- 模型选择、温度、reasoning 等配置应进入编译元数据，不进入回放 verdict。

不可照搬：

- 运行期 Insight model 做 `aiAssert` 终判。
- 回放期 Locate model 自动重找元素。
- 多模型互相补救后直接翻绿。

## 3. 缓存策略

### Midscene 中如何设计

Midscene 缓存两类数据：

- AI Planning steps。
- web-only 的 DOM localization，缓存 XPath。

它提供 `read-write`、`read-only`、`write-only`、`false` 等策略。缓存 miss 或不可用时会自动回退 AI。对于 plan cache fallback，它不会把半路 fallback 生成的 flow 写回原 prompt cache，因为中途页面状态已经变化。

它还支持手动 `flushCache({ cleanUnused: true })` 清理未使用记录，并说明 `aiBoolean`、`aiQuery`、`aiAssert` 这类 query 结果不缓存。

### Casey 需要怎么做

`Casey` 应借缓存策略语言，但改成治理语言：

- 编译期预热：类似 `write-only`，生成冻结候选。
- CI 回放：类似 `read-only`，只读已冻结产物。
- 人签漂移补丁后：才允许进入受控 apply。
- 调试期：允许 bypass，但必须在证据里显式记录。

建议字段：

```jsonc
{
  "cachePolicy": "read-only|write-only|bypass",
  "cacheStatus": "hit|miss|stale|unsupported",
  "cacheKind": "plan|locator|visual-template",
  "cacheKeyParts": {
    "intentHash": "sha256:...",
    "pageFingerprintHash": "sha256:...",
    "channelProfileHash": "sha256:..."
  }
}
```

> 提案说明：上面 jsonc 字段（`cachePolicy`/`cacheStatus`/`cacheKind`/`cacheKeyParts` 等）为示意，最终以 schema-freeze 冻结为准；其中会进缓存键的 `pageFingerprint`（页面指纹）等新概念落地前须登记 `CONTEXT.md`。

落地规则：

- `cacheStatus` 是证据，不是 verdict。
- query / assert 结果不缓存，这点可以借：`Casey` 也不应缓存最终断言结果当下次事实。
- `cleanUnused` 可映射成 Casey 的 drift/cache gc：清理未被当前冻结契约引用的缓存或模板。
- Midscene 不写回半路 fallback flow 的规则应强化成 `Casey` 的 `非就地自愈`。

不可照搬：

- cache miss 后自动 AI fallback。
- XPath 作为长期 locator cache。
- read-write 自动更新冻结产物。

## 4. YAML runner

### Midscene 中如何设计

Midscene 的 YAML runner 把 web、Android、iOS、HarmonyOS、computer 等平台配置放在不同 section 里，再用 `tasks[].flow[]` 描述 `aiAct`、`aiTap`、`aiInput`、`aiAssert`、sleep、平台专属命令等步骤。

它还支持 `continueOnError`。对于多端场景，YAML 是很强的人工可读 DSL。

### Casey 需要怎么做

`Casey` 可以借 YAML 的分层表达，但不应把 Midscene YAML 作为回放合同。

可以学习：

- 平台 section 分离，可映射到 `通道剖面`。
- `tasks[].name` 可映射到 `intentId` 的人读标题。
- `flow[]` 可启发 `events.json` 的原子事件序列。
- 平台专属动作应通过 channel driver 注册，而不是散落在测试文本里。

落地规则：

- YAML / Gherkin / excel / txt 都应先 `归一` 为 `TestCase`。
- `TestCase` 再经 `编译` 生成冻结 `events.json`。
- `continueOnError` 不应进入 `多态裁定`；`Casey` 可以断言续跑，但每步 verdict 必须独立出四态。
- sleep 只能作为最后兜底；优先使用 `静默点`。

不可照搬：

- 直接把 YAML flow 当作确定性回放脚本。
- 把 `aiAssert` 当作冻结断言。
- 用 `continueOnError` 掩盖失败分类。

## 5. Gherkin / BDD 子集

### Midscene 中如何设计

Midscene 支持一个简化的 Gherkin 子集：

- `Given` / `When` 映射到 `aiAct`。
- `Then` / 后续 `And` 映射到 `aiAssert`。
- 只支持单个 `Scenario`。
- 不支持 `Feature`、`Background`、`Scenario Outline`、Examples、data tables、doc strings、变量替换、多 Scenario。
- 文档明确要求每个 step 自洽，不能写 “click it” 这种依赖前文省略目标的句子。
- Gherkin 场景内部禁用 cache，以避免 stale steps。

### Casey 需要怎么做

这块很值得 `Casey` 借给 `归一` 层：

- 支持导入 Gherkin-like 文本作为 `TestCase.source.kind`。
- 把 `Given` 映射为 preconditions。
- 把 `When` 映射为操作 intent。
- 把 `Then` 映射为候选 expected。
- 保留“单 step 必须自洽”的准则，作为 compile gate 检查。

落地规则：

- Gherkin 输入只参与 `归一`，不能直接执行。
- `Then` 不能直接变成 `aiAssert` verdict；只能变成待草拟 / 待人签断言。
- 不支持的数据表、模板和多 scenario 可以由上游生成器展开成最终 `TestCase`。
- “click it / check result” 这类省略引用应 fail-closed 到 `CASE_DEFECT` 候选或 `NEEDS_HUMAN`。

不可照搬：

- `Then -> aiAssert` 的运行期映射。
- Gherkin step 内部禁 cache 的做法不能直接照搬；`Casey` 应看冻结合同和 checksum，而不是看输入格式。

## 6. 结构化 API 优先于大段自然语言

### Midscene 中如何设计

Midscene 文档明确说，开发者把复杂逻辑塞进一个大 `aiAct` 会带来复现不稳和性能慢。它建议用结构化 API 拆解：用 `aiQuery`、`aiBoolean`、`aiNumber` 提取状态，用 `aiTap`、`aiInput`、`aiScroll` 执行动作，把循环和条件写成代码。

### Casey 需要怎么做

这点和 `Casey` 内核高度一致：

- `编译` 要把自然语言拆成原子 `events[]`。
- 循环、条件、模板展开应在 `TestCase` / 编译层解决。
- 回放期只执行结构化动作，不执行大段自然语言 prompt。

落地规则：

- 长 prompt 是输入，不是回放脚本。
- 编译产物必须是结构化 `events.json` + 冻结断言。
- `aiQuery` 类能力最多用于编译期候选 `观测现状` 或断言草拟。
- 回放期的 actual 应由 `check.mjs` 和确定性采集产生。

不可照搬：

- 用 `aiBoolean` 决定测试分支是否继续。
- 用 `aiQuery` 结果直接作为 verdict actual。
- 让 JS 里的 try/catch 吞掉动作失败。

## 7. `aiAssert` / Insight 断言

### Midscene 中如何设计

Midscene 的 `aiAssert` 是让模型理解页面并判断条件是否满足。它适合视觉检查和快速 UI 验证，也进入 Midscene 报告。

### Casey 需要怎么做

`Casey` 可以借 `aiAssert` 的问题表达方式，但不能借它的裁判地位。

可以学习：

- 把自然语言期望转成候选 typed assertion。
- 对视觉状态给出候选证据，比如颜色、高亮、布局是否出现。
- 在编译期帮助生成 `expected[]` 草案。

落地规则：

- `aiAssert` 风格输出必须经 `断言词汇表` 归一。
- 每条 expected 都要进入 `冻结断言契约`。
- `bin/check.mjs` 执行 typed assertion。
- `bin/verdict.mjs` 只消费 `StepAxes` 中已判好的 hard / soft assertion，不关心 assertion kind。

不可照搬：

- LLM 判 pass / fail。
- `aiAssert` 报告 thought 作为缺陷证据。
- 视觉模型认为“看起来对”就判 `PASS`。

## 8. `AbstractInterface` 与 action space

### Midscene 中如何设计

Midscene 的 `AbstractInterface` 要求自定义界面实现：

- `screenshotBase64()`：提供截图。
- `size()`：提供逻辑尺寸。
- `actionSpace()`：声明可执行动作集合。
- 可选 `beforeInvokeAction` / `afterInvokeAction` / `destroy` 等 lifecycle hook。

`actionSpace` 中每个动作有 name、description、paramSchema、call。Midscene 会把 action 描述和参数 schema 提供给模型做规划。

### Casey 需要怎么做

这是 Midscene 对 `arbitrary` 通道最值得借的设计。

`Casey` 可以设计 channel driver 合同：

```jsonc
{
  "channelDriver": {
    "channel": "arbitrary",
    "interfaceType": "sample-device",
    "capabilities": ["screenshot", "tap", "input", "scroll"],
    "coordinateSpace": {
      "width": 1920,
      "height": 1080,
      "dpr": 1
    }
  }
}
```

> 提案待登记：`channelDriver` / action space（驱动声明的可执行动作集）是为 `arbitrary`/`cef` 通道新引入的端口适配器式接缝，`CONTEXT.md` 仅有 `通道剖面`/`channel`，二者语义不同。落地前须先经 grill 登记并界定与 `通道剖面` 的边界（参 DDD 端口适配器）。

落地规则：

- driver 必须声明 action space，供 compile gate 校验动作是否可执行。
- screenshot / size 是取证输入，不是 verdict。
- paramSchema 可借鉴为动作参数 schema，减少自由字符串。
- `beforeInvokeAction` / `afterInvokeAction` 可映射为 `三轴` 采集 hook。
- 任意界面可以没有 DOM，但仍要产出动作、断言、取证三组事实。

不可照搬：

- 让模型运行期直接选择 action space 并执行。
- 把 action description 当成回放指令。
- 对 arbitrary 通道默认接受纯坐标主锚。

## 9. Bridge Mode 与真实浏览器

### Midscene 中如何设计

Midscene Chrome extension 的 Bridge Mode 允许本地脚本控制桌面 Chrome，可以连接新 tab 或当前 tab，复用 cookies、插件和页面状态。连接时扩展会弹确认框，用户可 Allow 或 Always Allow。它也支持远程 bridge server，但有安全提示。

Bridge Mode 下部分选项会被桌面浏览器设置覆盖，例如 viewport、userAgent、cookie、extraHTTPHeaders、downloadPath 等。

### Casey 需要怎么做

这对 `Casey` 的真实 Heren 登录态和 CEF 很有价值，但要更保守：

- bridge / CDP attach 属于 `通道剖面`，不是事件语义。
- 连接现有浏览器必须显式记录 profile checksum。
- 用户授权应进入 `人签门` 或 `Escalation Path`，不能静默连接。
- 真实 cookies 和插件状态不能写进报告。
- bridge 模式下不可控的 viewport / cookie / header 应进入可复现（reproducibility）风险。

建议证据：

```jsonc
{
  "channelProfile": {
    "channel": "web|cef",
    "transport": "bridge|cdp|playwright",
    "controlledBrowser": "existing-chrome",
    "profileHash": "sha256:...",
    "uncontrolledOptions": ["viewport", "cookie", "extraHTTPHeaders"]
  }
}
```

不可照搬：

- Always Allow 这类长期授权默认开。
- 远程 bridge server 默认暴露网络。
- 用现有浏览器状态替代可复现 `通道剖面`。

## 10. 报告拆解与原始 dump

### Midscene 中如何设计

Midscene HTML report 会捕获单个 Agent 的完整执行历史。从 v1.7.0 起，它可以用 CLI 或 SDK 拆成 JSON、截图和 Markdown，也能合并多个报告。它还提醒 JSON / Markdown 结构可能随版本变化，应以实际转换结果为准。

### Casey 需要怎么做

`Casey` 的报告链已经更严格，但可以借报告拆解思想：

- `axes.json`：原始确定性事实。
- `verdict.json`：零 LLM 四态裁定。
- `report-model.json`：报告渲染模型。
- HTML / Markdown / JSON：人读和机读输出。

落地规则：

- 报告可以展示 `run-history.jsonl`、截图、trace、取证，但不能重新分类 verdict。
- 原始 dump 应稳定版本化，不应像 Midscene 一样以“实际转换结果”为事实源。
- Markdown 输出很重要，方便终端阅读、评审和 diff。
- 多报告 merge 可以借，但合并只能聚合已有 verdict，不重新判定。

不可照搬：

- HTML report 作为唯一事实源。
- 从报告反推出 verdict。
- 报告字段无版本承诺。

## 11. `freezePageContext`

### Midscene 中如何设计

Midscene 提供 `freezePageContext()`，让后续多个 query / locate 操作复用同一页 snapshot，提高并发查询性能。它明确提醒不要在交互操作中使用，因为模型会看不到最新页面状态。

### Casey 需要怎么做

这个设计可借到 `观测现状` 和 `静默点`：

- 在 `静默点` 后冻结 snapshot。
- 多条断言 actual 可从同一 snapshot 派生，减少竞态。
- snapshot hash 进入 `axes.json`。

落地规则：

- snapshot 只用于读事实，不用于交互动作。
- 动作执行后必须重新等待 `静默点` 并采新 snapshot。
- snapshot 过期时不能继续断言。
- 并发断言可以共享 snapshot，但 verdict 仍按逐条 hard assertion AND。

不可照搬：

- 在交互操作中冻结上下文。
- 用旧 snapshot 修复新页面状态下的失败。

## 12. `deepThink` / `deepLocate`

### Midscene 中如何设计

Midscene 区分：

- `deepThink`：在 `aiAct` 中增强 planning，拆分任务规划和 UI element locating。
- `deepLocate`：增强元素定位，通常多调一次模型，提高小目标或难辨目标的定位精度。

这说明复杂任务的规划和定位是两个不同问题。

### Casey 需要怎么做

`Casey` 可以借这个分解，但只能放在 `编译` 层：

- `deepThink` 对应更强的 `编译` 分解。
- `deepLocate` 对应更强的候选 locator / 视觉模板生成。
- 两者产物都必须落成结构化 `events.json` 和 `观测现状`。

不可照搬：

- 回放期打开 `deepLocate` 重找元素。
- 回放期因为 `deepThink` 产生新步骤。
- 用多调模型提高成功率来绕过 `NEEDS_HUMAN`。

## 13. 文件上传、触摸、长按、右键等动作能力

### Midscene 中如何设计

Midscene API 覆盖 `aiTap`、`aiInput`、`aiScroll`、`aiKeyboardPress`、`aiPinch`、`aiLongPress`、`aiDoubleClick`、`aiRightClick`、file chooser 等动作，并标注不同平台支持差异。

它还说明右键后不能操作浏览器原生菜单，原生 select dropdown 需要特殊渲染策略。

### Casey 需要怎么做

这些是 `Casey` 动作词汇表（action vocabulary，与 `断言词汇表` 对称、即 `events.schema` action 枚举的治理层，**待登记 `CONTEXT.md`**）的候选输入：

- web P5 先做 click / fill / select / keyboard / scroll / wait / assert。
- CEF 和 mobile 再扩展 longPress / swipe / pinch。
- file chooser 必须单独建模，文件路径不能混在自然语言参数里。
- 原生控件和系统菜单要标记为 route:human 或通道专属动作。

落地规则：

- 每种动作都要有 schema、driver 实现、`三轴` 证据和 golden。
- 平台不支持时 fail-closed 到 `NEEDS_HUMAN`，不能静默换动作。
- 文件上传路径要走凭据 / 敏感信息检查。

不可照搬：

- 直接开放全部 Midscene 动作到 `Casey` 回放。
- 让模型在运行期自由选择动作。

## 14. Playwright / CDP 经验

### Midscene 中如何设计

Midscene Playwright 集成说明：部分能力依赖 CDP，推荐 Chromium。它支持 connectOverCDP 连接远程浏览器，也说明新 tab 默认会被 force same tab，若要恢复新 tab，需要为新 tab 创建新的 Agent。

它还记录了网络空闲等待、截图字体加载超时、deviceScaleFactor 闪烁、原生 select 渲染等工程经验。

### Casey 需要怎么做

这些可直接进入 P5 / P8 实机准备清单：

- P5 web 优先 Chromium。
- `通道剖面` 固化 viewport、locale、timezone、deviceScaleFactor。
- CDP URL / remote browser 属于 profile，不属于 `events.json`。
- 多页必须显式建模 page target。
- 字体加载、网络空闲、原生 select 应进入 `静默点` 和错误分类。

不可照搬：

- force same tab 默认改变业务语义。
- 网络 idle timeout 失败但“nothing happens”的语义；`Casey` 必须落证据并分类。

## 15. AndroidWorld 稳定化经验

### Midscene 中如何设计

Midscene AndroidWorld benchmark 把稳定化工作列出来：canvas 像素 flush、加粗绘制 stroke、重试读 accessibility tree 文本、预置短信和联系人、等待数据库表创建、预装离线地图、修正 validator 边界歧义等。

这些不是模型能力本身，而是 fixture 和 validator 工程。

### Casey 需要怎么做

这对 `tier-1` / `tier-2` 很重要：

- `静默点` 不只是 networkidle，还包括 DOM / AX / animation / canvas pixel 稳定。
- 真机前置条件要可执行检查，不要写成散文。
- fake SUT 和 live smoke 都要区分 SUT 准备失败、用例缺陷和真实回归。
- validator 边界要和 intent 对齐，避免“自然语言边界词”导致误判。

落地规则：

- 每个 `TestCase.preconditions` 应尽量对应可执行检查。
- fixture / 前置准备失败一律走 `NEEDS_HUMAN`（按证据落 `INDETERMINATE` 或 `CASE_DEFECT`），不要记成 `SUT_DEFECT`，也**不构成可自愈 `HARNESS_ERROR`**——`HARNESS_ERROR` 仅限只读漂移探针正向确证的定位漂移（护栏 #13/#14）。
- 视觉区域要采最终像素，而不是中间帧。

不可照搬：

- 为了 benchmark 通过而放松 validator。
- 把 validator 修改当作运行期自愈。

## 16. Data privacy

### Midscene 中如何设计

Midscene 说明页面数据，包括 screenshot，会直接发送给用户选择的 AI model provider；Midscene 本身没有第三方平台访问这些数据，隐私风险主要取决于模型提供方。

### Casey 需要怎么做

`Casey` 的隐私边界要比 Midscene 更严：

- `.auth/` 和 `site.json` 绝不进输出、日志、报告、提交。
- 编译期如需发截图或 DOM 给模型，必须先脱敏。
- 回放期不应调用模型，因此不应发送真实 SUT 数据给外部模型。
- 报告落盘前过凭据兜底门。

不可照搬：

- 默认把页面截图发给模型 provider。
- 把 provider 隐私政策当作 `Casey` 的唯一隐私边界。

## 可借鉴清单

- 纯视觉对 canvas / CEF / arbitrary 的覆盖思路。
- Planning / Locate / Insight 职责分离。
- cache strategy 的 `read-only` / `write-only` / bypass 语言。
- cache 清理和 query 不缓存原则。
- YAML 的平台 section 和 flow 结构。
- Gherkin 单 scenario、step 自洽和不扩展成完整脚本语言的约束。
- 结构化 API 优先于大段自然语言 prompt。
- `AbstractInterface`、action space、paramSchema、lifecycle hook。
- Bridge Mode 的本地 Chrome 接管和显式授权。
- report split / Markdown / JSON dump / merge。
- `freezePageContext` 对 snapshot 复用的启发。
- `deepThink` / `deepLocate` 的规划与定位分解。
- 多端动作能力表和平台支持差异。
- Playwright / CDP / Chromium 工程经验。
- AndroidWorld fixture 稳定化经验。
- 页面数据发模型 provider 的隐私提示。

## 不可借鉴清单

- 运行期纯视觉重新定位作为默认回放路径。
- `aiAssert` 作为最终裁判。
- cache miss 后自动 AI fallback。
- XPath 或纯坐标作为冻结主锚。
- `continueOnError` 掩盖失败分类。
- 报告作为唯一事实源。
- 运行期 `deepLocate` 或 `deepThink` 生成新动作。
- 模型 query 结果直接作为 verdict actual。
- 远程 Bridge 默认暴露网络或长期授权。
- 为通过 benchmark 放松 validator。
- 默认把真实页面截图发给外部模型。
