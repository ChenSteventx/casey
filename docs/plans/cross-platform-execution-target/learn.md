# cross-platform-execution-target 学习记录

## 1. 可复用结论

1. 逻辑目标地址与网络传输方式必须是两份权威输入。回环端点解决连通性，不能替换浏览器可见 origin。
2. `goto` 返回成功不代表导航可信。来源准入应覆盖导航后、异步准备后、每次物理副作用前、等待窗口后和断言采证前。
3. 复合动作不能只在原子首尾核对。包含两次物理点击的下拉选择必须在每次点击前分别重验。
4. 自由错误文本不适合靠 URL 正则做局部清洗。保留错误类、数量和归因，同时把自由文本降为稳定占位，泄漏面更小且仍保留裁定事实。
5. 共享命令行输出边界仍要区分领域错误。把所有未知异常默认归为 authority 错虽然脱敏，却会破坏故障分类和退出码契约。
6. popup generation 的归属边界必须在 binding 到达时同步冻结，不能等异步队列真正执行动作时再取快照；否则同调用栈新页会落在边界外。
7. `gate` 绿色只证明已登记的可执行面。相邻冻结字节、正式 PRD 写账、真实浏览器和用户验收必须分别核销，不能相互替代。

## 2. 对后继的约束

- `page-topology-auth-continuity` 必须正式运行唯一 `gate`，不能用单项 37/37 代替六个 story 写账。
- 示教原始回放中的 `nav` 只能作路径检查点，不得用 `goto` 把错误状态修回正确页面。
- source replay 与 distilled replay 必须使用独立 fresh browser/context；freshness 不能由调用方布尔字段自报。
- atom 蒸馏须按 event 证据覆盖，不能只按共享 `intentId` 覆盖；`newpage` 与触发 click 共 intent 时尤其要防漏译。
- 确定性等价比较业务效果、终末硬断言、身份/副作用/清理证据，不比较动态时间戳、URL、事件数量或不同测试数据的动态平台 ID。
- 后继不得继续膨胀 `bin/compile.mjs`、`bin/replay.mjs` 与 `lib/replay/event-runner.mjs`；新增能力按纯投影、运行器、收据、比较器和薄命令行分层。

## 3. 下一步

1. 正式收口 `page-topology-auth-continuity`；
2. 为 `teachin-replayability-closure` 建独立计划与红先行验收门；
3. 实现 fresh source replay 与 exact capture hash proof；
4. 实现 resolved atom projection、fresh distilled replay 与确定性等价证明；
5. 在 AI 中台真实环境生成至少三份正式报告，经用户明确验收后发布 GitHub technical preview。
