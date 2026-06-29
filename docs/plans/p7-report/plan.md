# P7 报告渲染器 plan（第一 hermetic 增量）

> 目标：消费已冻 `report-model` 接缝，把一条用例的报告数据源渲染成**自包含**测试报告的三形态——给人看的 HTML、给终端/评审/Claude Code 看的 Markdown、给聚合机读的 json 旁车。
> 判据：`docs/design/report-spec.md`（v0.1）+ 已冻 fixture `tests/_golden/fixtures/seams/report-model.fixture.json`（符合 `tests/_golden/schemas/report-model.schema.json`）。
> 内核纪律：渲染器是 `report-model` 的**纯下游消费者**，不二次推断裁定、不改任何冻结契约（护栏 #15）；落盘前过凭据兜底门（护栏 #7）。

## 1. 业务流程（人怎么用）

1. 上游 `casey report` 一步合成 `report-model.json`（`verdict.mjs` 输出 ⋈ `StepAxes` ⋈ 观测现状 ⋈ 冻结契约）。本增量不做合成，只吃这份对象。
2. 人或 CLI 把 `report-model.json` 喂给渲染器，得到一组报告文件：主页 HTML（目录式）、Markdown（可 diff、当异构评审输入）、json 旁车（供多用例聚合）。
3. 人打开 HTML：先看裁定概览四态计数，再看置顶横幅（若有被测缺陷/待人裁决步直接顶到最上），再按裁定态分组逐步看每步的多态裁定徽章、期望对实际、缺陷单、附件链接。
4. 评审道/终端读 Markdown：同一份事实的文本形态，轻量、可 diff、能当异构评审的证据输入。

## 2. 逻辑描述（渲染器怎么算）

### 2.1 纯函数核心 `lib/report.mjs`

签名：`renderReport(model) -> { html, markdown, json }`。零 fs、零网络、零 LLM、零随机（除把 `model.generatedAt` 原样透传），确定性可测。

- 头部：`caseId` / `title` / `channel` / `signedAgainstBuild`（期望版本，未签显式标注）/ `generatedAt`。
- 裁定概览：直读 `model.verdictSummary` 四态计数（通过 / 被测缺陷 / 过程错误 / 待人裁决），不自己再数（避免与上游打架）。
- 置顶横幅：若存在 `SUT_DEFECT` 或 `NEEDS_HUMAN` 步，红/黄横幅顶到最上、点进对应步——同构 regress「安全软期望置顶」，把该人看的顶上去。
- 按裁定态分组列步骤：每步渲染裁定徽章（四态 + `NEEDS_HUMAN` 子类 reason）+ 具名理由。
- 每步多态裁定：期望对实际表，逐条 `postAssertions[]` 渲 `kind`/`op`/期望 `value` 对实际 `actual` + ✓✗ 字面量可见。
- soft 断言：`soft===true` 的条目单列黄标、标注「不进裁定树」，不让步变红、且**置顶**到该步期望对实际表的醒目位（落实护栏 #17 soft 不进裁定）。
- 缺陷单：仅 `defectTicket != null`（即 `SUT_DEFECT` 步）渲染——失败硬断言 + 取证背书（url/status/归因步）+ 录屏时间点 `videoAt` + trace 引用；直读 `model` 已合成的 `defectTicket`，渲染器不再二次派生。
- 附件：录屏/截图/trace/子页相对路径 + `replyText`（LLM 回复文本）作链接/文本展示；HTML 自包含——只内联 CSS、不引任何外部 URL/CDN/script。
- Markdown 旁车：同事实的文本形态，含头部、四态概览、置顶提示、按态分组步骤、每步期望对实际与缺陷单；非空。
- json 旁车：机读聚合入口，至少含 `caseId`/`title`/`channel`/`generatedAt`/`verdictSummary`/逐步精简态；非空、合法 JSON。

### 2.2 薄壳 `bin/report.mjs`

`node bin/report.mjs --model <report-model.json> --out <dir>`：读文件 → 调 `lib/report.mjs` → 落 `<caseId>.report.html` / `.report.md` / `.report.json`。

- 凭据兜底门（落盘前，护栏 #7）：对将落盘的三份产物做禁字段/凭据深扫（`token`/`authorization`/`cookie`/`password`/`secret` 等及 `.auth/`/`site.json` 内容指纹），命中即 fail-closed 拒绝落盘、非 0 退出，绝不把凭据写进报告。
- 复用 autotester `report.ts` 的自包含 helper（`escHtml`/`fmtMs`/`fmtSize`/`safeSlug`、内联 CSS、`htmlDoc` 外壳）当辅助件；渲染逻辑是改造非照搬——autotester 只二值通过/失败，这里是多态徽章 + 缺陷单 + 期望对实际。

## 3. 红绿基线（ATDD）

- golden `tests/_golden/p7-report.golden.mjs` 先写：喂已冻 `report-model.fixture.json` → 调 `lib/report.mjs` → 校关键结构不变量。
- `lib/report.mjs` 未实现时跑红（模块不存在/导出缺失 → 退非 0）；实现后绿。
- HTML 不做字节比对，只校结构不变量；`report-model.json` 是唯一 golden 对象。

## 4. 验收点（命令化层，本契约冻结）

`node tests/_golden/p7-report.golden.mjs` 退 0，且校验以下不变量全过：

1. **每步多态裁定徽章正确**：每步 HTML/Markdown 含与 `model.steps[i].verdict` 对应的裁定徽章文案（四态各自的中文态名），`NEEDS_HUMAN` 步附 reason 子类。
2. **缺陷单仅 SUT_DEFECT 步渲染**：`defectTicket != null` 的步（且仅该步）出现缺陷单区块；`PASS` 步不出现缺陷单。
3. **期望对实际字面量可见**：每条 `postAssertions[]` 的期望 `value` 与实际 `actual` 字面量在产物中可见，且带 ✓✗ 对应 `ok`。
4. **soft 黄标置顶**：`soft===true` 的断言被标为不进裁定树的黄标，且排在该步期望对实际的非 soft 之前（置顶）。
5. **Markdown + json 旁车非空**：`markdown` 与 `json` 均非空字符串；`json` 可被 `JSON.parse` 解析。
6. **HTML 自包含无外链**：`html` 不含 `http://`/`https://` 外部资源引用、不含 `<script src=`、不含 `<link ... href=` 外部样式（只内联 CSS）。

## 5. 验收点（route:human，本契约不冻，tier-2 真机）

- 真机生成报告在浏览器自包含、双击可看、录屏内联可播（目检）。
- 报告文字对人读得懂、信得过（语义质量，gate 测不到，护栏 #16）。
- 多用例总目录聚合维度（按 flow / 按裁定态），待第二条 flow 接入再定。

## 6. 非目标

见 grill.md「本增量边界」：不接 Playwright 生命周期、不做 ffmpeg 转码与子页内联落盘、不做多用例聚合、不改任何冻结契约。
