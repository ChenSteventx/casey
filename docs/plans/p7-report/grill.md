# P7 报告渲染器 grill（light 道）

> 入口分流 `light`：本阶段按车道约定 skip 正式 grill 拷问，仅留此 stub 如实说明为何免拷问。
> 如实声明：本增量不引入难逆转决策，数据契约（`report-model` 接缝）已在排期 v2 第 1 层冻结、不在本增量重开。

## 为何 light（免正式 grill）

1. 数据契约已冻：`report-model.json` 的 schema 与 fixture 已由 `seams-freeze.golden.mjs` 钉死，本增量**只读消费**它，不改接缝、不改 `verdict.mjs`/`StepAxes`/取证契约。设计自由度低，无需拷问拍板。
2. 判据已定：渲染规格见 `docs/design/report-spec.md`（v0.1，已实读 autotester `report.ts` + regress `per-spec-report.ts` 两套参考定调）。本增量是该规格的落地，不重新设计。
3. 产物可验证面收敛：`report-model.json` 是唯一 golden 对象；HTML/录屏/时间戳不做字节 golden（含非确定性的生成时间、base64、ffmpeg 输出），只对 HTML 校结构不变量。无字节 golden 的拍板争议。
4. 无难逆转面：渲染器是纯函数 + 薄壳，输出是人看产物，错了可改、不污染裁判与冻结契约。不触 auth/计费/安全（护栏 #8 无关）。

## 本增量边界（非目标）

- 不实现真机回放、不接 Playwright reporter 生命周期；渲染器只吃已合成的 `report-model.json` 对象。
- 不做 ffmpeg 转码（autotester 的 `webmToMp4` 当 helper 保留接口、本增量不在路径上跑）；附件只引用相对路径，子页内联留后续增量。
- 不做多用例总目录聚合（待第二条 flow 接入再定，见 report-spec §7）。
- 不渲染未冻字段、不二次推断裁定：`defectTicket`/`verdictSummary` 由上游 `report-model` 合成，渲染器直读不再派生（护栏 #15 裁判零 LLM 的下游纪律）。

## 待人裁决（route:human，本增量不闭环）

- 真机生成的报告在浏览器里自包含、无外链、可双击打开（tier-2 真机目检）。
- 报告文字对人是否「读得懂、信得过」（语义质量，gate 测不到，护栏 #16）。
