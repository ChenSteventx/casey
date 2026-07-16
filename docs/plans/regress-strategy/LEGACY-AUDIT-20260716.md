# regress_autotest 遗产只读审计（2026-07-16）

> 范围：`/mnt/d/ctx/heren/regress_autotest`。本审计只读源码与既有文档；未运行该仓浏览器、fixture、fake-SUT、旧测试或网络动作。旧报告与旧绿不作为 Casey 完成证据。

## 可迁移遗产

1. **业务流语义**：regress 冻结 flow 共 38 条，Casey 已覆盖 5 条；剩余 33 条可作迁移输入，其中 agent/tool 约 10 条、workflow/canvas 约 23 条。只迁移自然语言意图、业务顺序与必要字段，须在 Casey 重编译、重签并跑真实 SUT。
2. **覆盖地图**：`CATALOG-COVERAGE-AUDIT.md` 记录约 380 个业务项的覆盖缺口；其账面口径为 covered 32、乐观可执行 19、缺原子 187、越界 135。适合做按业务流补原子的路线图，不适合据此宣称现有原子完备。
3. **真实 UI 语义地图**：`PLAN-atomic-flows.md` 和 `tests/flows/` 可帮助恢复画布、智能体、工具等业务顺序。
4. **提示词资产**：`tests/_lib/README.md`、通用边界/安全提示词、主诉与用药分析提示词包含提示词泄漏、Base64 混淆、函数参数泄漏、伪管理员污染等有价值向量。迁入后须按 Casey promptset schema 冻结并真机 UAT。
5. **Hi 小助 CEF/CDP 勘察脚本**：`tmp/cef-connect.mjs`、`tmp/cdp-probe.mjs`、`tmp/cef-history-track3.mjs` 等记录了历史容器形态、CDP 接缝和历史消息页面语义。只能作 bring-up 线索；当前容器、端口、页面与 DOM 必须重新真机发现。
6. **SSE 判据**：`tests/code-agents/SEMANTICS.md` 明确 HTTP 200 不等于成功，须同时证明 event-stream 且非空。适合作为未来 arbitrary/API 通道的确定性取证契约。

## 已覆盖、无需重复搬运

- regress 的 60 个 atom ID 已 60/60 进入 Casey `lib/atoms-registry.snapshot.json`。
- 这只是注册表菜单，不代表可执行覆盖；Casey 当前只有约 18 个命名编译实现，连同 login/assert 分支也不能宣称 60 个完备。

## 明确拒绝直接复用

- 旧 `_atoms.ts` 两态 Playwright 动作与软 expectation。
- 旧 `deleteByName`（全局唯一删除 + 最后一个确认）、仅 edge count 的 `connectNodes`、未验证的 `noErrorToast`。
- 自动重放全部旧脚本且可能泄露 URL/账号的 recorder。
- Windows Node 经 WSLInterop 作为正式运行路径。
- 旧报告、trace、录像、绿灯与任何未重新真机核验的结论。

## P0 安全债

regress 本地 Git 账面约有 1,400 份 `tmp/_trace_r20|r25` 原始 trace 资源，可能包含内部 URL、原始 API 数据与业务配置。禁止复制到 Casey 或公开仓；应另立历史/secret/PII 审计，必要时清理远端历史并轮换暴露凭据。

## 推荐迁移顺序

1. P0：Hi 小助当前 CEF/CDP 真机重新发现；发布/测试阻断流；regress Git 敏感历史审计。
2. P1：10 条 agent/tool 流、promptset、模型/MCP/echo/并行网关。
3. P2：11 类节点配置矩阵、剩余业务覆盖地图、SSE 纯逻辑判据。

迁移完成的唯一口径仍是：当前 Casey spec + 已签 expected + 同次真实回放 + 确定性 verdict + 录像/视觉复核 + 单例 HTML；遗产本身不提供完成背书。
