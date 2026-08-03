# GRILL — teachin-authoring-runtime-profile

## D0 真机事实

2026-08-03 真机示教两击均为 `unique / candidateCount=1 / performOk=true`，source
axes 与 frozen verdict 已越过；同次闭环随后在 authoring compile 返回
`AUTHORING_COMPILE_FAILED`。独立真机探针复现内层异常 `NO_ACTIVE_PAGE`。

## D1 直接根因

`compile-runtime-adapter` 只把 `executionTargetAuthority` 交给
`createCompileRun`。后者仅在 authority 与 runtime 都缺席时走兼容解析；authority
存在而 runtime 缺席时，`executionTargetUrl` 得到 null，导航器按 fail-closed 关闭
active page，后续访问固定成为 `NO_ACTIVE_PAGE`。

## D2 紧邻缺口

- authoring compile 未消费与 `channelProfileDigest` 绑定的 exact profile bytes，因而
  会静默退到 `ROUTE_LIST`。真机探针已证默认路由 403、case profile 路由 200。
- authority 路径缺 `sut` 时，run 内会出现字面量 `"undefined"`，形成第二事实源。
- `nav.workflowManagement` 吞掉列表后置锚缺席；错误同源路由仍可能产
  `acted=true / blockers=0`，是假成功。

## D3 边界

- runtime 只能由 genuine execution-target authority 投影，不得另铸或采 caller URL。
- exact channel profile bytes 必须先与冻结 digest 对账，再经 pair-bound 的一次性
  authoring baseline grant 传入 compile；caller 不能直塞 route。
- profile 缺席的 legacy 路径保持原行为；profile 畸形、摘要不符、跨 pair 换绑都在
  物理动作前拒绝。
- 列表后置锚缺席必须形成 blocker，authoring candidate 不得发布。

## D4 完成

新金牌真实红→绿，owner/邻接/P9/Tier-1/drift/term 全绿，Grok 或 pi.dev 内联全仓
实现评审通过后合并；最终仍需同进程真机两击，只有 cycle exit 0 与同次
capture/sidecar hash 对账成立才闭环。
