# 真机只读尖峰采集结果（2026-07-22）

> 采集方式：隧道回环 + 登录预备动作 + 三轮只读探针（登录、导航、看、记录；零建零删零改）。
> 纪律：只记字段名、DOM 属性名、类名、路由形态与值形态（位数+字符集）；凭据、真实基址、业务数据零回显。
> 原始采集件：会话 scratchpad `id-spike-findings{,2,3}.json`（/tmp 重启即清，本文是持久权威）。

## 一、智能体列表（路由已实测：`/heren/aimanagement/agent/list`）

- 列表接口：`/ai-manager/agent/setup/queryAgentPageList`，查询参数 `queryType/pageSize/pageIndex`，搜索追加 `nameLike`（名称与编码一参通吃）。
- 行字段清单（值形态）：`agentId`＝string 19 位纯数字（**平台 ID 通道**）、`agentCode`＝string ascii（**编码通道**）、`agentName`、`agentDesc`、`tenantId`（19 位纯数字）、`roleCode`、`agentClassId`/`agentClassName`、`promptTemplateId`（19 位纯数字）、`enable`/`enableAgentSet`（boolean）、`versionEnable`/`category`/`requestType`（number）、`buttons`（object）。
- 条目 DOM：卡片布局 `article.agent-card`，内部 `agent-card__title`（带 `title` 属性，渲染名称）与 `agent-card__subtitle`（带 `title` 属性，实测 ascii 短串＝**编码在卡片可见**）。条目根元素**无任何 `data-id`/`key` 类身份属性**（仅构建期作用域 `data-v-*`）——DOM 通道只有名称+编码，平台 `agentId` 只能走网络信封。
- 搜索框 placeholder：「输入智能体名称或编码进行搜索」（与 `agent.searchOpen` 的 `code` 编码收敛参数语义吻合）。

## 二、智能体详情

- 点击卡片标题导航 `/heren/aimanagement/agent/detail`，query 参数名：`promptTemplateId`、`enableAgentSet`、`queryType`（身份随 query 携带，路径段无 ID）。
- 详情期接口（字段名采样）：`agent/setup/getRequestApi?promptTemplateId=…` 回 `baseUrl/requestUrl/requestMethod/agentName/…`；另有 `agentPlus/queryPlus`、`agentParameter/queryAgentCustomerParameterList` 等。
- 详情页 DOM 未见「复制 ID」类控件（`[class*=id]/[class*=copy]` 采样无命中；有 `no-editable-code` 只读代码块）。

## 三、工作流列表（对照面）

- 列表接口：`/ai-manager/process/queryProcess`，行字段：`masProcessId`（**工作流平台 ID**）、`masProcessDataId`、`masProcessName`、`masProcessCode`（**编码**）、`masProcessDesc`、`enable`、`versionEnable`、`masProcessClassId`/`masProcessClassName`、`category`、`buttons`。
- ⚠️ 初始视图 DOM：渲染 6 个 `article` 元素；`.hr-table-row`、`.hr-card.hr-card--bordered` 均 0 命中——**删除域记录选择器（RECORD_SELECTOR）在未搜索的初始视图一个不中**。今晨三链真机全 PASS 与此不矛盾：删除链恒先搜索隔离，搜索后渲染为记录选择器可命中的卡片布局（今晨 countAudit 实测 layout=card 1:1）。结论：现行选择器面只对「搜索后」视图成立，初始视图形态不同，未搜索直扫的任何未来用法都会 fail-safe 成 none——设计上安全（fail-closed），但值得在原子知识里记明「先搜索隔离是前置」。

## 四、`profile` 待填值（`searchOpen` 容器归属闸消费）

- `profile.agents.itemContainer` 真机应填 `.agent-card`（chat-sut 夹具缺省 `.agent-item` 仅限 hermetic）。

## 五、尚未采到（余留 route:human 尾巴）

- `workflow.bindAgent` 真机抽屉配方：初始视图无可点记录、不碰业务工作流名，未进画布。补法两选：Steven 人工开任一带智能体节点的工作流画布采样抽屉控件类名；或下一轮真机契约用 `atl_` 自建工作流+智能体节点走完整配方（属变更操作，须另立契约不在只读尖峰内）。
- 同名对抗观察：环境是否已有同名智能体未核（列表首页 9 条未逐条比名——业务数据不进记录）；如需实证「同名不同 ID」可由管理员预置一对同名后重跑只读探针。
- 详情页 ID 的人工目检（悬浮提示、更多菜单里是否有 ID 展示）——机器采样只覆盖了类名启发式。

## 对「名称+ID 双定位」接线的直接结论

1. 平台 `agentId` 唯一可靠读回通道是列表接口网络信封（回放取证层已具 `requestLog` 基建，可在 `agent.searchOpen` 搜索步归因的响应里提取 `agentId`/`agentCode` 与 `agentName` 三元组做联合判别）。
2. DOM 侧可锚「名称+编码」双通道（卡片标题+副标题都带 `title` 属性），足以支撑无 ID 时的降级联合定位与同名歧义检测（同名不同码→AMBIGUOUS 有 DOM 证据）。
3. 收据（`entity-identity-receipt`）的 `code` 通道此后可用真机 `agentCode` 填充，`platformId` 用 `agentId`——今晨真机签署里的「code 待真机回读」显式待办标记自此有兑现路径。
