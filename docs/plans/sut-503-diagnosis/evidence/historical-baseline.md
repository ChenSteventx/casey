# 503 历史基线投影

> 本文件只投影 `real-uat-attestation` 已有本地真机产物中的非敏感事实，不复制原始 URL、
> 请求体、响应体、凭据或业务数据。完整权威账仍在
> `docs/plans/real-uat-attestation/evidence/uat-run.md`。

## run-1

- `axes.json` sha256：
  `795cc3d2638e2bc6712acb4b74fe96eee2f0a64180211ad1c3b4266a20999044`
- `verdict.json` sha256：
  `bb9fdd396a0b96e82c204c5d13135879599eee07ce424df2aa2f242debc4635a`
- 导航步：`PASS`
- `agent.searchOpen`：`SUT_DEFECT`
- 本步网络取证：

| 方法 | 端点路径 | 状态 | `attributedStepId` |
|---|---|---:|---|
| 未在冻结投影中声明 | `/ai-manager/agentPlus/queryPlus`（URL 无查询参数） | 503 | `atstep_3` |
| 未在冻结投影中声明 | `/ai-manager/agent/setup/getAgentDetail`（`promptTemplateId` 为 19 位纯数字形态） | 503 | `atstep_3` |

两条响应均被现役错误信封剖面识别到 `status` 字段。未在本投影中出现的响应细节不作推断。

## run-2 replay-1

- `axes.json` sha256：
  `e4ac5201553ab2dcc5305cd8b909e09882301e587293ffe9856857d0a5168786`
- `verdict.json` sha256：
  `29b63e5c1f36006bf4eca6a84d4ca095fee7b4aec7504031e0354d706b9b6074`
- `visual-review.json` sha256：
  `c47a4bf626133ffbcab63b003a67c7338534b09f0a45444583063fe3a9d13b11`
- 终帧 sha256：
  `a39c57963de42f1e25654be52b9748480d184e6d477c9750d055b82ad6f77b35`
- 导航步：`PASS`
- `agent.searchOpen`：`PASS`
- 视觉复核：`INCONSISTENT`
- 同次网络取证：

| 方法 | 端点路径 | 状态 | `attributedStepId` |
|---|---|---:|---|
| 未在冻结投影中声明 | `/ai-manager/agentPlus/queryPlus`（URL 无查询参数） | 503 | `null` |
| 未在冻结投影中声明 | `/ai-manager/agent/setup/getAgentDetail`（`promptTemplateId` 为 19 位纯数字形态） | 503 | `null` |

两条 `503` 被聚合到首个意图的孤儿网络账，未归因给打开详情的动作步；因此确定性裁判按
ADR-0007 的因果作用域规则输出 `PASS`。终帧仍显示两条失败提示，视觉通道据此判
`INCONSISTENT`。

## 已能推出与不能推出

已能推出：

- 两个不同的新建测试实例均出现相同两端点 `503`；
- run-1 的本步取证足以背书既有 `SUT_DEFECT`；
- run-2 的 `PASS` 与视觉异常并存，是因果归因窗差异，不是缺陷消失证据。

不能仅由历史基线推出：

- 服务端根因；
- 哪个表单字段或详情路由参数是必要触发条件；
- 两端点是同一根因还是一个失败引发另一个失败；
- 账户权限、缓存或异步加载是否参与触发。
