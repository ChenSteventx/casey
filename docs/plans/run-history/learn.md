# learn — run-history（light，2026-07-03）

六阶段全走完（grill 六条机械决策 Steven 确认 → plan → accept 红先行（I1/I3 红核）→ loop 一把绿 gate GREEN → codex 两轮 R2 PASS → learn）。沉淀四条：

1. **「接缝先冻、实现后至」的接线合同就是 schema 本身**：`seams-freeze-v2` 冻结在前，本轮实现零设计争议——所有判断点都是「schema 字面 vs 现机制事实」的翻译题（枚举缝合、口径落档），light 车道六条机械决策足够。经验：接缝冻结时把枚举、pattern、allOf 钉得越死，后续接线越像填空；golden 直接读 schema 文件取 required/枚举/pattern 做复核，真值源零副本。
2. **纯观察者红线是生产者设计的第一约束**：回放器的取证归因窗（`currentStepId` 开合）对时序敏感，诊断产出若加任何等待就会改归因事实。本轮全部计时用 `Date.now()` 差值旁路测量、行构造放迭代尾、落盘放 axes 同刻——「诊断件与被诊断行为零互扰」应成为后续台账（失败记录台账）接线的同款前提。
3. **内部词汇与冻结枚举的缝合要显式列白名单**：动作轴内部值（`action_failed`）不在冻结枚举，兜底折叠（`else → none`）会把枚举内合法值（`ambiguous`）也误折——codex R1-F2 抓的正是这个。经验：投影层用「白名单透传 + 显式改写 + 兜底」三段式，别用二分支。
4. **JSONL 的零行边界**：`join('\n') + '\n'` 在空集合下产单个空行、不是空文件——golden I4 钉红修绿。经验：凡「每行一条」的产物，零行语义（空文件）要在实现与 golden 两侧同时钉。

配套：`casey run` 现每跑必产 `runs/<caseId>/<runId>/run-history.jsonl` + `run-metrics.json`（runId=目录名）；报告消费侧（P7 呈现）与失败记录台账仍未接（后者是下一条同款接线的候选）。真机顺产核验挂 observability route:human（顺手核，非门槛）。
