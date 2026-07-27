# 自适应页面测试 SOP

> 状态：目标流程，供后续实现契约引用；不是已经全部实现的能力。
>
> 适用优先级：AI 中台的连续页面改版是第一目标；医生站、Hi 小助用于跨站点、跨业务域验证。
> 本 SOP 复用现有 `TestCase → flow → compile → draft → sign → replay → verdict → report`
> 主链，不另造一套裁判。

## 1. 目标与三个执行区

Casey 的目标不是让 LLM 自由控制浏览器，而是把不确定性逐步压缩成可确定执行的测试资产：

```text
确定性区
  已登记 atom、状态机、身份锁、断言、回放、取证与 verdict
        ↓ 只有发生可分类的不确定性才升级
受约束 LLM 区
  用例归一、atom 候选映射、陌生页面单步提案、候选语义分组
        ↓ 仍无法证明才升级
人工区
  grill、示教、签署、主观/专业语义复核
```

总原则不是「不确定都交给 LLM」，而是：

- 能由现有规则证明的，直接确定性执行；
- 能被封闭 schema、动作集和效果边界约束的不确定性，只让 LLM 提候选；
- 身份、用户意图、未冻结断言和主观专业判断等不可约束的不确定性，交给人；
- 任意兜底成功后都要回到签署后的确定性回放，探索或模型自评不能产生正式 PASS。

## 2. 阶段 0：接收用例、grill 与可执行规格

### 2.1 先判编排就绪度

输入是用户的自然语言测试用例。系统保留原文，并先输出三种局部状态之一：

- `READY`：目标、操作对象、业务效果和预期结果足够明确；
- `READY_WITH_ASSUMPTIONS`：只有不会改变业务效果的非关键空缺，可列明假设后继续；
- `NEEDS_GRILL`：目标实体、动作边界、前置条件或通过标准存在阻塞性歧义。

以下问题需要 grill：

- 测哪个环境或产品面；
- 操作哪个实体，是否有名称、业务编码或平台 ID；
- 「正常」「可用」「成功」具体由什么可观察结果证明；
- 是查看、保存、发布还是删除；
- 测试数据不存在时应创建、停止还是由人补齐；
- 主观或专业语义结果由谁确认。

以下问题不问用户，由执行层解决：

- 按钮在哪里、页面是表格还是卡片；
- CSS selector、Playwright API、等待时长；
- AI 中台本次改了哪些 DOM；
- 底层 CLI/MCP 参数。

grill 采用渐进式追问：先利用上下文、现有 atom 和已知实体信息补齐，只问会改变测试语义的最少问题。

### 2.2 形成候选可执行规格

grill 后的候选规格至少明确：

```jsonc
{
  "intent": "打开指定智能体并验证可对话",
  "target": { "product": "ai-platform", "channel": "web" },
  "entity": {
    "kind": "agent",
    "name": "客服助手",
    "code": "AGT-001",
    "platformId": "opaque-platform-id"
  },
  "preconditions": [
    "目标智能体存在",
    "目标智能体已发布"
  ],
  "effects": ["send-chat-message"],
  "assertions": [
    "对话请求完成",
    "产生一条非空助手回复",
    "操作前后智能体 platformId 不变"
  ]
}
```

这是说明形状，不直接新增现役 schema 字段。实施时先用旁车承载新增信息，再经独立契约决定是否升级
`TestCase` schema。

原始描述、grill 问答、显式假设、候选规格和最终 TestCase 必须保持可追溯关系。系统不得静默增加保存、
发布、删除等业务效果。

## 3. 阶段 1：冻结身份、效果和断言

编排前先冻结四件事：

1. `intentId` 与原始意图；
2. 目标实体的 `kind + name + code + platformId + scope`；
3. 允许的 effect class；
4. 执行前的断言计划。

名称只用于发现候选；有业务实体时，名称和业务编号/平台 ID 同时一致才可建立身份锁。涉及 relation
时分别锁 source/target；mutation 后按同一平台 ID 做 post-readback。

断言计划至少回答：

- 观察什么；
- 从哪个确定性证据源观察；
- 使用什么比较操作；
- 绑定哪个实体；
- 在哪一步检查；
- 证据不足时如何路由。

LLM 可以在执行前草拟断言，但必须经过现有词表/形态闸和人签；执行开始后不得根据实际结果修改
expected。未实现或主观断言只能作辅助观察或路由人，不能悄悄成为机器终判依据。

## 4. 阶段 2：把业务前置条件编排成 setup flow

现役 `TestCase.preconditions` 是状态机初始状态种子，不是可执行步骤。目标实现应新增候选
`setup-flow` 旁车，把可操作的业务前置条件映射成 atom 工作流，不在第一版直接改写现役字段语义。

```text
业务前置条件
  → 查已登记 atom 的 requires/provides
  → 拓扑排序
  → 先检查当前状态
  → 不满足才执行建立动作
  → 读回状态与实体 ID
  → 产出后续步骤可消费的收据
```

示例：

```text
agent.ensureExists
  provides: agentName, agentPlatformId, agentExists

agent.ensurePublished
  requires: agentExists
  provides: agentPublished

workflow.bindAgent
  requires: workflowExists, agentPublished
  consumes: workflowPlatformId, agentPlatformId
```

`ensure` 必须先观察再建立，已满足时直接产状态收据，不能每次盲目重复创建或发布。前置条件没有取得
确定性收据，主体操作不得开始。

登录是明确例外：凭据只经现有登录预备动作进入内存，继续不做 atom、不进 spec。

## 5. 阶段 3：确定性 atom 优先编排

执行计划采用 known-atom dominance：

```text
intent 有可编译的已登记 atom
  → 输入完整
  → requires 已满足
  → effect 与用例一致
  → entityBindings 完整
  → 直接生成 CALL_ATOM
```

只要上述条件成立，LLM 不得把已有 atom 展开成自行点击，也不得改走另一个业务效果不同的 atom。

执行顺序固定为：

1. 当前 atom 的首选已登记变体；
2. 同一 atom 的其他已登记变体；
3. role/label + TestCase 固定值 + page-wide unique 的零 LLM 规则解析；
4. 只有上述路径全部发生正向确证的 grounding/定位漂移，才允许 zero-shot 为同一 atom 提议新变体；
5. 若新路径的输入、requires/provides、effect 或后置断言不同，则只能成为候选新 atom，不能冒充旧 atom。

## 6. 阶段 4：确定性执行与逐步取证

执行器在干净浏览器上下文中：

```text
建立会话
→ 登录预备动作
→ setup flow
→ 主体 flow
→ 每步 settle
→ 每步 progress/readback
→ assertions
→ axes
```

每个动作至少产出：

- 动作是否实际执行；
- locator resolution；
- 动作前后 observation；
- 页面生命周期与网络归因；
- typed progress 结果；
- 相关实体身份读回；
- effect receipt。

「执行了动作」和「业务结果正确」是两件事；前者不能代替后者。

## 7. 阶段 5：失败分类后才能使用兜底

失败不能统一称为「需要自愈」。先按证据分类：

| 失败证据 | 处理 |
|---|---|
| 页面未稳定、请求仍在途等暂态 | 同一 atom 有界重试 |
| 录制 locator 不命中，但存在同稳定语义唯一候选 | 同一 atom 的已登记变体或 zero-shot grounding |
| 同名、缺 ID、错 ID、身份漂移 | 硬停止，路由人 |
| 动作已确认提交，但业务后置条件失败 | 缺陷取证，不换路径绕过 |
| 用例意图/效果/通过标准不明确 | grill 用户 |
| 无法区分页面漂移和 SUT 故障 | `NEEDS_HUMAN` |
| 自动探索预算耗尽 | 人工示教 |

涉及 mutation 的动作一旦确认已提交，不允许 LLM 另走路径重试，避免重复副作用。
旧签资产在新 build 上失败时，当前 run 先按原资产产出诚实结果；不得在同 run 静默切探索、修改 expected、
覆盖旧资产后再宣布 PASS。重新探索只能产生独立 candidate，重新签署并以新 run 回放。

## 8. 阶段 6：受限 zero-shot 探索

zero-shot 只补首次 grounding/执行路径：

```text
observe
→ 生成有界 affordance
→ LLM 提一个 typed proposal
→ 零 LLM admission
→ 执行一个动作
→ settle
→ 零 LLM progress proof
```

模型只能引用当前 observation 中的 `candidateId`，不能输出自由 selector、JavaScript、Playwright 或
Python。每次只能提一个动作，且不能：

- 修改冻结 intent、effect、entity binding 或 expected；
- 绕开已有可用 atom；
- 通过隐藏 API 替代被测 UI；
- 直接写 verdict；
- 把未知页面伪装成已登记 atom；
- 在 platformId 缺失时授权实体 mutation。

探索产物是降权 candidate trace，不是正式回放输入，也不是 PASS。

## 9. 阶段 7：zero-shot 轨迹蒸馏

成功探索先经过确定性忠实投影：

```text
candidate trace
→ 每个动作有 admission/action/progress 证据
→ 动态值参数化
→ 稳定 locator 重建
→ identity observations
→ candidate events + pending
```

蒸馏结果分为：

1. 已有 atom 的候选新执行变体；
2. 多个已有 atom 的候选组合；
3. 候选新 atom；
4. 无法可靠翻译的 pending。

UI 手势不是业务 atom。表格变卡片、抽屉变详情页通常只产生同一 atom 的新变体；只有输入、业务效果
或后置条件发生变化，才考虑新 atom。

候选必须重走 draft/sign，再进入确定性 replay。

## 10. 阶段 8：人工示教兜底

zero-shot 无法完成时，用户在真实界面操作一次。录制器采集：

- 点击、输入、选择、提交和导航；
- 操作前后页面观察；
- role/name/label、容器与局部结构；
- 截图、录屏和必要的网络取证；
- 实体名称、业务编码、平台 ID 与来源步骤；
- setup、action、assert 三段语义边界。

若要教会系统建立前置条件，示教必须从该条件未满足的状态开始；已经发布后才开始录制，最多只能教会
系统检查发布状态，不能证明它学会发布。

现有硬边界保持：

- `teach-in-capture.json` 始终 `signed:false`、`replayReady:false`、`distillRequired:true`；
- capture 不能直通 replay；
- 示教必须先 `record → intake → distill → L0 忠实复核 → 人签`。

## 11. 阶段 9：示教等价回放与 atom 化回放

用户所见的「录制成功」不能以文件存在为准。需要两个回放门：

### 11.1 示教等价回放门

```text
capture
→ intake
→ distill candidate
→ 忠实闸
→ 补齐 mapping/断言
→ 人签
→ 新浏览器上下文
→ 从规定起点完整 replay
```

通过后才能标记局部状态 `REPLAYABLE`。失败时只能显示「录制已保存，但回放验证失败」。

### 11.2 atom 化回放门

```text
已证明可回放的示教候选
→ 映射已有 atom / 候选新变体 / 候选新 atom
→ 重新 compile/draft/sign
→ setup + action + assert 全链干净回放
```

通过后才能标记局部状态 `PROMOTED` 并进入长期能力库。示教等价回放成功但 atom 化回放失败时，
保留可回放候选，不能宣称新 atom 已学会。

创建类用例使用运行期唯一变量并读回新平台 ID；更新类用例保持名称 + ID 双定位；固定 sleep 应改写为
等待可观察状态。

source candidate 与 distilled candidate 字节不同，必须使用不同 artifact role、run namespace、输出目录和
身份锁 hash，但共享同一 TestCase 与 expected checksum。两次回放必须各自 reset，或使用两个独立唯一实体；
不能让第二次回放消费第一次留下的可变状态。

双回放等价比较不要求 event 数量相同，而要求：

- 每个 intent 的 verdict 等价；
- terminal hard predicates 等价；
- entity receipts 指向符合各自运行约束的正确实体；
- effect receipts 等价；
- cleanup/absence proof 等价。

## 12. 阶段 10：确定性裁定与报告

无论来源是已有 atom、zero-shot 还是人工示教，最终全部汇入现有：

```text
signed assets
→ replay
→ axes
→ verdict
→ report
```

机器终态仍只来自零 LLM 裁定：

- `PASS`：真实回放、身份和冻结断言全部满足；
- `SUT_DEFECT`：有取证支持的系统行为错误；
- `NEEDS_HUMAN`：身份、证据或主观/专业语义不足。

模型可解释报告，不得改变 verdict。

## 13. 渐进兜底等级

```text
L0 已登记 atom 的确定性执行
L1 同一 atom 的暂态有界重试
L2 同一 atom 的其他已登记变体
L3 LLM 为同一 atom 提议候选新变体
L4 LLM 提议候选新 atom/工作流
L5 人工示教
L6 人工确认意图、身份或主观结果
```

兜底升级不得扩大原用例允许的业务效果，也不得降低身份和断言证据要求。任何 L3–L5 产物都只有在
签署后的干净回放通过后，才能产生正式 verdict。

## 14. 工序状态

实现时每个状态转换都要有机器工件，不接受文字声明：

```text
GRILLED
→ BOOTSTRAP_READY
→ BASELINE_OBSERVED
→ DETERMINISTIC_RESOLVED | LLM_EXPLORED | HUMAN_RECORDED
→ SOURCE_REPLAYABLE
→ SOURCE_VERDICTED
→ DISTILLED_CANDIDATE
→ DISTILLED_SIGNED
→ DISTILLED_VERDICTED
→ EQUIVALENCE_PROVED
```

其中 `HUMAN_RECORDED` 只是有 capture，绝不等于 `SOURCE_REPLAYABLE`；`LLM_EXPLORED` 也不等于任何
机器终态。登录/环境 bootstrap 失败单独路由，不计作 zero-shot grounding 失败。

## 15. 场景验收

### 15.1 AI 中台：连续版本漂移主集

同一业务任务跨版本保持身份、effect 与断言不变，主动制造或收集：

- DOM 层级/class 重构；
- 表格与卡片互换；
- 文案和中英文变化；
- 抽屉、详情页和菜单路径变化；
- SPA 延迟挂载、虚拟列表和分页；
- 名称相同但平台 ID 不同；
- 网络读回字段位置变化。

指标分开报告：已有 atom 直接成功率、变体命中率、zero-shot 候选产出率、签后回放率、人工示教率。
同时区分 warm replay survival 与关闭该 build/page memory 后的 cold zero-shot compile；不得把二者合成
一个成功率。

### 15.2 医生站、Hi 小助：跨站留出集

不给 page adapter、profile selector、录制 flow 或页面记忆，验证：

- grill 是否能形成可验证规格；
- 陌生页面是否能产可签 candidate；
- 人工示教是否能形成可回放候选；
- 通用 atom 是否可复用；
- 专业/主观断言是否正确路由人，而不是 LLM 假 PASS。

若 Hi 小助仍为 CEF，它属于跨通道后继；除非先实现 CEF 的 observer/admission/executor/回放证据链，
否则不能把 web MVP 的结果报成 Hi 小助已支持。

## 16. MVP 与后置强化

为优先跑通系统，MVP 必须保留的正确性边界只有：

- known-atom dominance；
- typed proposal 与一次一动作；
- action admission；
- 名称 + ID 身份硬停；
- 冻结断言、运行时不得改 expected；
- capture 不直通 replay；
- 干净回放后才算录制成功；
- replay/verdict 零 LLM；
- 凭据和真实目标地址不进输出。

后置强化包括：

- observation/authority 的跨进程防伪与完整 hash chain；
- 更强的 prompt injection 隔离；
- iframe/shadow DOM、多 tab、上传、拖拽；
- 多版本自动聚类与 atom 撤销策略；
- 更大规模 site/domain-held-out 榜单；
- 多次连续回放、并发和性能预算；
- 更复杂的人签治理。

后置强化可以推迟，但不能用推迟安全性的理由取消前述正确性边界，否则技术闭环本身会产生假成功。
