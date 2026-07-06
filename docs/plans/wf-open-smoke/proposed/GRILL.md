# wf-open-smoke — grill 决策记录（direct）

> 授权链：Steven 点单④（飞轮第五条）；NEXT-SESSION 下一步 D 明列 wf_open_smoke 为「只读零缝暖场候选」。
> 全部机械镜像先例（wf-history-version 纯加法原子 direct 先例 + nav.agentManagement/deleteByName 编译知识形态）。

## D1 两纯加法编译原子

- `nav.workflowManagement`（registry 在册无参）：路由导航一击即中（`run.listRoute` = profile.routes.workflowList
  缺省 ROUTE_LIST，镜像 nav.agentManagement 路由优先形态；无点击兜底通路——工作流列表本就是缺省着陆页，
  真机路由已实证）；后置锚 = 列表记录容器可见（表格行/卡片双布局口径同 auditDeleteCount），仅 unique 才等（G2）。
- `workflow.open`（registry 在册，`openName` 必填）：列表按名点开进详情——语义 `{kind:'text', name, exact:true}`
  （td/卡片标题以纯名渲染，同 deleteByName 点「删除」的 text 语义先例）；只读零破坏、不带 uniquePrefix 闸
  （非破坏性原子）；后置 = waitForURL detail 路由（真机 /ai-manager/process/detail 已实证），仅 unique 才等。

## D2 夹具通路（加法）

fake-sut 列表行名 td 加点击 → `go('/ai-manager/process/detail')`（现仅「删除」钮可点）。既有场景
零行为差（无任何金牌点行名；countChange 计数不受 handler 影响）。共享夹具 prd-p5-replay 重签。

## D3 涟漪翻转清单（红先行）

flow-bridge 金牌三钉点拿 `nav.workflowManagement` 当「册内无编译知识」反例——知识加入后例翻
`workflow.addNode`（R9 画布原子，长期无知识、天然反例）：C5 例换 / C14 不可编译名单换 + 集 11→13 /
C15 篡改探针换。prd-flow-bridge 金牌 checksum 重签 + gate 复验。

## D4 端到端与只读保证

金牌走 compile 全程（gate→confirm→execute）→ draft（+patch 给 nav intent 补硬断言防 INDETERMINATE，
e2e-chain 先例）→ sign → casey run → verdict 全 PASS；只读钉死：events 全 nav/click 动作、零破坏原子。

## D5 非目标

真机四停站 route:human（照例挂 observability，可与 publish-states/history-version 合并一次行程）；
不动词表/schema/冻结内核；不建 cases/ 真用例文件（gitignored，真机行程时产）。
