# real-uat-attestation · plan（light，v1）

> 兑现 `prd-agent-id-readback` observability 冻结 uatDefinition 四步（uatCaseId=
> `tc_agent_id_readback_real_uat_v1`，GRILL 三分岔 Steven 全 A）。生产 `lib`/`bin` 零改；
> 产物=用例件（`cases/`，不入库）+ 权威件（`runs/real-uat-<date>/`，不入库）+ prd（入库，唯一账）
> + 报告三形态 + 证据文档。真机产物含时间戳：按行为与裁定核验，不宣称跨运行逐字基线。

## 1. 只读探测（先行闸）

登录+导航 `/heren/aimanagement/agent/list`，复核尖峰事实仍立：卡片 `article.agent-card` /
`agent-card__title` / `agent-card__subtitle`；端到端隧道实证（不通即停，报探测证据）。
输出全脱敏：只记类名/计数/值形态。

## 2. 预置（D1=A）

autotest 创建单个测试智能体 X（名=「测易同名对抗<日期>」，全场唯一）；创建证据=搜索计数 0→1。

## 3. 用例件与铸权

- `cases/tc_agent_id_readback_real_uat_v1/`：testcase（preconditions 已登录、uniquePrefix `atl_`）+
  flow（`nav.agentManagement` + `agent.searchOpen{openName=X}`，entityBindings 全步）+ profile
  （三链 denylist/successField 复用 + `routes.agentList=/heren/aimanagement/agent/list` +
  `agents.listApi{pathname=/ai-manager/agent/setup/queryAgentPageList, method=GET, queryParam=nameLike,
  recordsPath=data.list, totalPath=data.pageInfo.totalItems, hasNextPath=null,
  fields{id=agentId,code=agentCode,name=agentName}}` + `agents.itemContainer=.agent-card` +
  `agents.cardFields{name=.agent-card__title, code=.agent-card__subtitle}`）。
- 铸权按三链配方：`entity-pre-execution-authority`（audience=production、signerId=Steven 授权条件直签、
  `calculateIdentityAdmissionSignature`），sha 入新 prd `loop/prd-tc_agent_id_readback_real_uat_v1.json`。

## 4. UAT 四步执行（uatDefinition 字面）

1. `casey compile --execute`（身份通道声明激活）→ v2 产物：events + entity-bindings.draft v2 双 digest
   + `identity-observations.compile.json`（观察行 platformId=19 位纯数字，X 三元组）。
2. 草拟断言（happy 锚：详情路由 `startsWith /heren/aimanagement/agent/detail` 等）→ 五元 join 对账表
   → `sign --entity-observations` 直签（signerId=Steven，D2=A）→ frozen v2 + entity-locks。
3. 回放①（全新令牌）：X 全场唯一 → 双证 unique、对已签 platformId 全等 → verdict PASS → 报告①。
   创建第二个精确同名 X → 回放②（同一冻结件）：信封 total=2 同名=2 → 必 AMBIGUOUS 不点击
   （verdict NEEDS_HUMAN·AMBIGUOUS_ACTION，详情未开）→ 报告②。
4. 报告三形态交付（①②各一套）+ 清理：删除两个 X、搜索计数归零证据。四步全过=UAT 过闸（ADR-0009）。

## 5. 验收与记账

- 新 prd `tc_agent_id_readback_real_uat_v1`：authority/冻结件 checksum + observability 记录两放行为
  （回放②的 NEEDS_HUMAN 是预期正确行为，记账明示、绝不改判）。
- `prd-agent-id-readback` observability 该 route:human 项核销记账（执行完成引用本契约证据）。
- 证据文档 `docs/plans/real-uat-attestation/evidence/uat-run.md`（全脱敏）；报告三形态随 runs/ 本地留存。
- C7 竞态真机观察义务顺带核销：回放事件环 press→click 在真机 fetch 渲染列表页的表现如实记录
  （身份账本路径 settle 有界等待已内建，预期不受旧 DOM-only 竞态影响；如现异常如实落账）。

## 6. 评审

light 车道：执行见证类契约，材料=本 plan + 对账表 + 报告 + 证据文档；按额度纪律先确定性自检，
异构评审按 Steven 指示定（评审家族≠实现家族）。
