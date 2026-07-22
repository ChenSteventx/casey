# 真机只读实证（agent-id-readback 双证门·活数据）

> 采集：2026-07-22，隧道回环，autotest（Steven 带外已核）。只登录只搜索只读，零建零删零改；值全打码（只记形态：位数+字符集）。
> 探针：会话 scratchpad `id-live-verify.mjs`（活数据喂 `createIdentityObservationLedger` + `resolveDualIdentity` 纯函数）。

## 判定结果（三场景全部符合设计）

| 场景 | 信封 consume | 双证判定 | 结论 |
|---|---|---|---|
| 一：精确名搜索（列表首卡名） | `ok`（rows=2, total=2, sameName=1） | **`unique`** | matched 三元组 name=<3长纯数字> code=<7长ascii> platformId=<19长纯数字> |
| 二：不存在名 | `ok`（rows=0, total=0） | **`absent`**（envelope-name-zero-hit） | 命中 0 硬阻断 |
| 三：已签错码对抗（signedCode=探针假值） | `ok` | **`action_failed`**（signed-code-mismatch） | 已签期望不符绝不放行 |

**场景一的关键印证**：`nameLike` 子串搜索首卡名返回 **2 行**（`total=2` 完整集合），但同名恰 **1 行**（另一行 name 长度 17、是首卡短名的子串命中，非真同名）——判定 `unique`。这正实证「完整集合内才数同名」的设计：total 证完整、sameName===1 才 unique。若换旧 DOM-only 门或「单行即唯一」的朴素实现，这里会误判或漏检。

## 真机剖面字段名修正（三层，本次实证最有价值的产出）

2026-07-22 第一轮尖峰（`realmachine-spike-findings.md`）只记了 `queryAgentPageList` 的**行字段名**，未记响应**容器结构**。本次活数据实测：搜索接口 `GET /ai-manager/agent/setup/queryAgentPageList?nameLike=…` 响应容器是——

- `data.list` ← 记录数组（**不是**尖峰按 catalog 惯例假设的 `data.records`）
- `data.pageInfo.totalItems` ← 完整性 total（**不是** `data.total`、也不是 `pageInfo.total`）
- `data.pageInfo = { pageIndex, pageSize, totalItems, totalPages, offSet }`
- 行字段：`agentId`(19长纯数字) / `agentName` / `agentCode`(ascii) / `agentDesc` / `tenantId` / `promptTemplateId` / … （与尖峰行字段清单吻合）

**真机 `profile.agents.listApi` 正确填值**（下个契约接线真机时直接用）：
```json
{
  "pathname": "/ai-manager/agent/setup/queryAgentPageList",
  "method": "GET",
  "recordsPath": "data.list",
  "totalPath": "data.pageInfo.totalItems",
  "hasNextPath": null,
  "fields": { "id": "agentId", "code": "agentCode", "name": "agentName" }
}
```

> hermetic 夹具（chat-sut id* 场景）用 `data.records`/`data.total` 是 interface-spec §6 定的**夹具契约**，与真机字段名不同**不冲突**——剖面字段名本就是每环境可配置的适配面，双证门/账本纯函数对字段名无感（只消费投影后的 `{id,code,name}` 与 total）。真机与 hermetic 同门同判已由本实证与金牌双证。

## 挂账

- 首版探针在 `response` 时刻入账被竞态咬（consume 得 `empty`），改 `request` 时刻冻结归属才正常——**在真机上复现了 sol R1-P0「归属须在 requestWillBeSent 冻结」的必要性**，反证请求级事务协议不是过度设计。
- 完整真机用例链（执行权威→sign 消费观察件→回放点击前对已签 platformId）仍 route:human（需人签链）。
- 同名对抗真机用例（管理员预置一对真同名智能体验 ambiguous）仍挂账——本次场景一的 2 行是子串命中非真同名。
