# GRILL — report-diagnostics（light，实质 grill，2026-07-03 Steven 拍板）

授权：NEXT-SESSION「下一步 C」+ Steven 点单顺序「b再c再a」+ 两分岔点选（AskUserQuestion）。P7 报告消费侧加法：把真机已在产的回放历史/回放指标旁件呈现进报告；replyText 摘录挂账核销。侦察实证（零 baton 只读代理）：渲染器纯函数零 fs、渲染 CLI 只收 `--model`/`--out`、`casey run` 渲染 stage 手握 runDir 且 replay stage 恒产两旁件；p7 golden 只断结构不变量（新栏目不带绝对 URL/外链即不翻）。

## D1 路线（Steven 拍板：路 B + 逐步嵌入）

- 路 B：`report-model` 与全部冻结 schema 零动——`renderReport(model, diagnostics)` 加可选第二参（单参调用行为一字不变，p7 golden 单参续绿）；`bin/report.mjs` 加可选旗标 `--run-history`/`--run-metrics`（薄壳读文件、传第二参）；`bin/casey.mjs` run 渲染 stage 补传两旁件路径（runDir 内既有产物）。
- 形态：`run-metrics` 落全局「回放诊断」栏目（步数/动作成功/`locatorHitRate`/静默点等待/总耗时/`runId` 指标行，报告尾部 groups 之后）；`run-history` 逐行按 `intentId` 嵌进所属 intent 步卡（附件行之后）——一步卡内看到本 intent 全部 event 的 耗时/定位/结果。
- 显式标注「仅诊断，不进裁定」（soft 断言「不进裁定树」同款先例）；`report.json`（`renderJson` 投影）零动。

## D2 replyText 摘录（Steven 拍板：核销 + golden 回归锁）

侦察实证挂账项已被现状满足：`observed.replyText` 走附件栏（`lib/report.mjs` 的 `attachmentsHtml`/MD 镜像），`replyContains`/`replyMatches` 的 `actual`（300 截断）走期望对实际表；真机 `run_1783054730282` 的「会话异常」正是经 `observed.replyText` 通道呈现。处置：不加新呈现，本契约 golden 钉一条「replyText 在 HTML/MD 真渲染」回归保护（冻结时即绿），HANDOFF 核销记档。

## R1 修订（codex 异构评审采信，2026-07-03）

- F1（High 采信）：诊断 CSS 从全局样式单列为 `DIAG_CSS` 按需注入——单参调用输出与加栏目前字节级零差异（原「零行为差」承诺兑现到字节级）。
- F2（High 采信）：旁件值不受装配器脱敏覆盖（路 B 绕过），呈现层补 `://` 零容忍——诊断标量命中即 `<redacted:non-relative>` 占位（login-traffic-drop 先例），HTML 与 MD 双形态受钉；自包含硬约束不 fail-open。
- F3（Medium 采信）：坏行定义收紧——合法 JSON 但非对象、或缺 `stepId`/`intentId` 字符串键 = 坏行，同 fail-closed 拒渲染（M1 措辞随之钉死）。
- F4（Medium 采信）：golden 补钉——单参不含诊断 CSS 类名、MD 同查绝对 URL、E1 嵌入检查改钉嵌入块标题（原子名自带 `nav` 子串会假阳性）。
- R2 一发现（采信）：`run-metrics` 合法 JSON 非对象（null/数字/数组）静默降级——CLI 对象校验 fail-closed（W1e 三形态钉死）；R3 PASS 零新发现。

## 机械决策（可否决）

- M1 旁件缺席 = 零行为差（旗标可选、不传不渲染栏目）；旗标传了但文件坏/不可读 = fail-closed 非零退出（报告宁缺不糊）。`run-history.jsonl` 逐行 parse，坏行同 fail-closed。
- M2 凭据卫生双防线维持：旁件生产端 pattern 强制脱敏（`valueRef` 只许模板/占位形态）+ `credentialGate` 末道闸扫全部落盘文本；新栏目只渲染相对路径/枚举值/数字，不引绝对 URL 与外链（p7 自包含检查续绿）。
- M3 history 行与步卡的对齐键 = `intentId`（报告步是 intent 卷回、history 行是逐 event）；无匹配 intent 的行（理论不存在）落全局栏目尾部「未归属」小节，不静默丢。
- M4 「不进 verdict」红线不动：诊断只进 HTML/MD 呈现层；`verdict.mjs` 闭包零 run-history 引用的既有 U1 红线（run-history.golden）继续背书。
- M5 术语：零新造词（「回放历史」「回放指标」均已登记 CONTEXT.md；栏目名用「回放诊断」为二者合集的呈现名，属既有术语组合非新概念）。
