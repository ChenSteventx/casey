# Casey 最终报告规格（report-spec v0.1）

> 2026-06-29。Casey 最重要的人看产物——自包含测试报告——的设计规格，是设计 §6 的细化与落地。
> 实读两套参考后定调：`D:\ctx\heren\autotester\reporters\report.ts`（单次录制、单文件全内联）与 `D:\ctx\heren\regress_autotest\reporters\per-spec-report.ts`（flow 驱动、多用例、拆分式 + HTML/MD/json）。
> 结论：**以 regress 的拆分结构为骨架 + autotester 的自包含内嵌当 helper + Casey 多态裁定**。本规格同时**反向约束 S1 的 `verdict.json` 必须携带什么**。

> **与实现的已知偏离（对账表，2026-07-07 审计核定）**：§4 两个「verdict.json」命名之争已按本规格
> 落地为 `report-model.json`（富信息装配产物），`verdict.json` 保持最小五字段；§4 `action.describe`
> 装配恒 null（列有名无实）——挂账；§6 trace/截图未建，缺陷单 `traceRef` 恒 null——挂账；
> §7 多用例总目录聚合按原文自留待裁决、未建（非欠账）。
>
> **目标态、部分已落地（2026-07-08）**：§3 的「测试用例自然语言块 / 原子操作块」及 `naturalLanguage` /
> `atomicSteps` JSON 字段**已由 report-nl-atomic 契约落地**（装配器 + 渲染器 HTML/MD/JSON + 冻结 schema 加法
> + golden，commit 0719919）。余「录像置于裁定概览前的排序 / 清理证据（删除前后命中数）/ 工作流画布结构有效 /
> 变量来源默认自定义变量」仍目标态、未落地——各自后续 P7 增量挂账；实现前报告不得据未落地项判过。

## 1. 产物布局：拆分式（照 regress）

单条用例（caseId）的报告是一组文件，不是一个大 HTML：

```
loop/reports/<caseId>/
  <caseId>.report.html      主页 = 目录：裁定概览 + 置顶横幅 + 按裁定态分组列步骤 + 链子页（轻量，不内联录屏）
  <caseId>.report.md        终端 / Claude Code / 人直接读的 Markdown（可 diff、做评审输入）
  <caseId>.report.json      机读旁车（供多用例总目录聚合）
  step/<stepId>.html        每步子页：录屏/截图/LLM 回复/取证/trace（base64 内联在这里，按需点开）
  trace/<caseId>.<stepId>.zip   trace 集中
```

**为什么拆分**：autotester 把所有 base64 塞一个文件，单用例还行，但 Casey 骑飞轮要跑多 flow、一条 flow 多步带录屏，全内联会膨胀到几十 MB 打不开（regress `per-spec-report.ts:10-11` 的原话教训）。主页秒开、按需点进单步。

## 2. 双形态：HTML + Markdown

- `HTML`：给人看，录屏/截图内联在子页。
- `Markdown`：给终端、Claude Code、评审道读——轻量、可 diff、能直接当异构评审的输入证据。autotester 没有 MD，regress 有（`per-spec-report.ts:522 renderMarkdownReportForSpec`）；Casey 必须有，这就是「测试报告文档」的文本形态。

## 3. 报告小节

**主页（目录）**：
1. 头部：caseId / 标题 / 通道 / `signedAgainstBuild`（期望版本）/ 生成时间。
2. **测试用例自然语言表述**：必须是头部之后的第一个人读区块，标题为「测试用例」；内容使用用户输入或人签 TestCase intents 合成的自然语言，不放在证据、JSON、接口取证或折叠区后面。报告一打开必须先能看出“测什么”。
3. **原子操作**：必须紧跟「测试用例」展示用户用例拆解后的原子操作清单。每个原子操作只表达一个可观察动作或一个断言，例如“点击新增工作流”“选择字典类型”“断言变量列表出现该变量”。不能把多个动作合并成一条泛化步骤。
4. **回放录像**：必须在「原子操作」之后、裁定概览之前可见；HTML 主页至少提供可播放 `<video>` 或明确的视频链接。登录/凭据输入过程不得进入录像。
5. **裁定概览**：四态计数（通过 / 被测缺陷 / 过程错误 / 待人裁决）。
6. **置顶横幅**：若有「被测缺陷」或「待人裁决」步，红/黄横幅顶到裁定概览附近、点进对应步——同构于 regress 的「安全软期望置顶」（`per-spec-report.ts:356-358`），把该人看的顶上去。
7. **按裁定态分组**列步骤，每步链到子页。

报告生成器的硬要求（`naturalLanguage` / `atomicSteps` 两块已由 report-nl-atomic 落地；余项仍目标态、各自后续 P7 增量挂账，见顶部对账表；实现前报告不得据未落地项判过）：

- `HTML` / `Markdown` / `JSON` 三形态都必须携带同一份自然语言用例文本；JSON 字段名用 `naturalLanguage`。
- 自然语言用例文本必须放在 HTML/Markdown 的顶部区域，且先于录像、结论、验收点、接口取证。
- `HTML` / `Markdown` / `JSON` 三形态都必须携带原子操作清单；JSON 字段名用 `atomicSteps`。原子操作区块必须紧跟自然语言用例文本，先于录像、结论、验收点、接口取证。
- 每条原子操作必须有稳定编号，报告中的验收点、截图、网络取证或错误摘要应能回指到对应编号。证据无法回指时，该条不能作为自动通过依据。
- 变量配置类用例若用户没有明确指定变量来源或变量归属，原子操作必须默认并明示选择「自定义变量」；不得把来源留空后直接尝试新增或引用。
- 录像缺失时不能静默通过；报告必须显式标注“无录像”和缺失原因。若原因是登录凭据卫生，则应采用“登录不录、业务步骤录”的两上下文策略。
- 编辑型用例报告必须展示清理证据：删除前命中数、删除后命中数，必要时附精确名称残留复查。
- 工作流发布/导出/历史版本类报告必须证明画布结构有效：至少有开始节点、结束节点、开始到结束连线、开始节点配置、结束节点配置；空工作流件不得算作满足该类验收。

**每步子页**：
1. 操作说明：`intentId` + 意图原文 + agent 实际动作（describe + resolution）。
2. **多态裁定**：裁定徽章（四态 + `NEEDS_HUMAN` 子类）+ 具名理由 + **期望对实际**表（每条 `expected[]`：kind/op/value vs actual + ✓✗）。
3. **缺陷单**（仅 `SUT_DEFECT`）：失败断言 + 取证背书（url/status/归因步）+ 录屏时间点 + trace 引用。
4. 录屏 / 截图 / 文本（LLM 回复）/ 错误 / trace 链接。
5. **soft 断言**：单列黄标、标注「不进裁定树」，不让步变红——照 regress `softMiss`（`per-spec-report.ts:152-155`），落实护栏「soft 不进裁定」。

## 4. 数据契约：`verdict.json` → 报告（反向约束 S1）

报告只渲染 `verdict.json`，所以**报告要展示的，`verdict.json` 就必须携带**：

| 报告要展示 | `verdict.json` 必带字段 |
|---|---|
| 操作说明 | 每步 `intentId` + 意图原文 + `action.describe` |
| 裁定徽章 + 理由 | 每步 `verdict`（四态）+ `reason`（子类或 null） |
| 期望对实际 | 每步 `postAssertions[]`：`{kind, op, value, actual, ok, soft}`（字面量） |
| 取证 | 每步 `forensics`：`network[]{url,status,initiator,attributedStepId}` + `lifecycle{pageerror,crashed}` |
| 缺陷单 | 由失败 `postAssertion` + 背书 `forensics` + `videoAt`（录屏时间点）派生 |
| 附件 | 每步录屏/截图/trace 路径 + `replyText`（LLM 回复文本） |
| 头部 | `caseId`/`title`/`channel`/`signedAgainstBuild`/`generatedAt` |

**与冻结的 `verdict.mjs` 最小输出的关系（一处要拍的 coherence 点）**：S1 冻结的 `verdict.mjs` 只吐最小裁定 `{stepId,intentId,atom,verdict,reason}`（`p2-verdict.golden` 钉死）。报告要的「期望对实际 / 取证 / 附件」来自 `StepAxes` 与观测现状。所以：

- 报告数据源 = `verdict.mjs` 输出 ⋈ `StepAxes` ⋈ 观测现状，由下游 `casey report` 一步**合成**，**不动 S1 冻结的 `verdict.mjs` 契约**。
- 设计 §6 把「带期望对实际 + 取证」的那份叫 `verdict.json`，与 `verdict.mjs` 的原始输出**不是同一份**——建议把合成后的报告数据源单独命名（如 `report-model.json`），并在 §6 对账时澄清，免得两个「verdict.json」打架。**（待 S3 对账拍板）**

## 5. 可复用 helper（从两套报告直接拷的纯函数）

- 自包含内嵌：`webmToMp4`（ffmpeg H.264/crf20/faststart）、base64 视频/截图内联、`escHtml`/`fmtMs`/`fmtSize`/`safeSlug`（autotester `report.ts:29-69`、regress `per-spec-report.ts:55-92`）。
- 内联 `CSS`、`htmlDoc` 外壳、`renderSteps` 步骤树、trace 复制到 `trace/`（regress `per-spec-report.ts:182-266,396-409`）。
- 拆分写盘编排：`onEnd` 按 caseId 聚合、子页 + 主页 + MD + json 旁车（regress `per-spec-report.ts:584-673`）——Casey 不绑 Playwright reporter 生命周期，改成 `casey report` 读 `verdict.json` 驱动，但写盘结构照搬。

## 6. 对 S1 的落点

S1 实现 `verdict.mjs` / `StepAxes` / 取证时，按本规格第 4 节**预留 `verdict.json` 能合成出报告所需的全部字段**（尤其期望对实际字面量、取证归因、intent 卷回）——先定报告 = 先定 `verdict.json` 形状 = 给 S1 上约束。报告渲染器本身（拆分 + 多态 + MD）属 P7，不在 p2 关键路径，但其**数据契约现在就钉死**。

## 7. 待裁决（route:human）

- 报告数据源命名（`report-model.json` vs §6 的 `verdict.json`）+ §6 对账——见第 4 节，留 S3。
- 总目录聚合是否分维度（按 flow 维度 / 按裁定态）——第二条 flow 接入时再定。
