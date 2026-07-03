# learn — report-diagnostics（light，2026-07-03 收口）

六阶段走完（grill 两分岔 Steven 拍板 → plan → accept 红先行 6/9 红 → loop 一发全绿 → codex 三轮 R3 PASS → learn）。沉淀四条：

1. **挂账先侦察再动手，一半工作量可能已被前序契约消化**：「replyText 摘录」挂账经只读侦察实证已被现状满足（`observed.replyText` 与断言 `actual` 两条通道都在渲染，真机「会话异常」正走前者）——处置是核销 + 回归锁，不是重复实现。挂账列表是历史快照不是现状，动手前先核「它还缺吗」。
2. **绕过既有防线的加法要自带同级防线**（codex R1-F2 教训）：路 B 让旁件绕过装配器的脱敏通道直入渲染器——省了冻结 schema 重签，但装配器侧的「投影必脱敏」纪律也被绕过。凡新增数据通路，要自问「原通路上的每道闸，我这条上有没有等价物」；本例补了呈现层 `://` 零容忍（login-traffic-drop 先例复用）。
3. **「零行为差」要说清楚到什么粒度**：GRILL 承诺「单参行为一字不变」，实现却无条件注入了新 CSS——结构不变但字节变了。承诺兑现粒度（字节级/结构级/语义级）在 grill 期就该钉死，golden 按该粒度钉（本例最终兑现到字节级：CSS 条件注入 + `diag-note` 缺席钉）。
4. **fail-closed 的「坏件」定义要枚举到合法 JSON 的语义坏形态**：JSON.parse 过了不等于件是好的——`null`/`123`/`[]`/缺键对象都是「合法 JSON 的坏件」，codex 两轮各抓一个同族缝（history 行、metrics 件）。凡「读文件→用形状」的口，parse 后的形状校验是标配；golden 按形态枚举钉（W1d/W1e 六形态）。

配套：`renderReport(model, diagnostics)` 可选第二参（单参字节级零差异）；`bin/report.mjs` 旁件旗标（缺席零行为差、坏件六形态 fail-closed）；`casey run` 相6 接线；run-metrics 全局指标行 + run-history 按 `intentId` 嵌步卡 + 「未归属」小节；诊断标量 `://` 零容忍；`report.json` 机读形态零动、诊断不进 verdict 红线不动。真机报告带诊断栏目过目挂 observability（并入下次真机停站）。
