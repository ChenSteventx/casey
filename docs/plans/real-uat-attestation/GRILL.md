# real-uat-attestation · GRILL（阶段0：决策树清空）

> 契约定位：`agent-id-readback` 的真机 UAT 后继契约（uatCaseId=`tc_agent_id_readback_real_uat_v1`）。
> UAT 定义已冻结在 `prd-agent-id-readback` observability（uatDefinition 四步，sol 三件套）——本 GRILL
> 不重开定义，只清执行分岔。lane=light：生产 `lib`/`bin` 零改，产物=用例件+权威件+报告+prd 记账。

## 已定事实（不重开）

- 冻结 UAT 四步：①真机重编译产 v2 产物（events + draft v2 双 digest + identity-observations.compile.json，
  platformId=19 位纯数字）；②`sign --entity-observations` 五元 join 人签出 frozen v2；③回放消费 frozen v2：
  点击前信封读回+DOM 双证对已签 platformId 全等才落笔，同名敌意（同名双条目）必 AMBIGUOUS 不点击；
  ④报告三形态交付。四步全过=过闸（ADR-0009）。真机产物含时间戳按行为核验、不宣称逐字基线。
- 真机 `profile.agents.listApi` 填值已实证冻结（realmachine-live-verify）：pathname
  `/ai-manager/agent/setup/queryAgentPageList`、GET、recordsPath=`data.list`、
  totalPath=`data.pageInfo.totalItems`、hasNextPath=null、fields={id:agentId, code:agentCode, name:agentName}。
- 错码对抗已在活数据实证 `action_failed`（signed-code-mismatch）；absent 场景实证硬阻断。
- 账户=autotest（Steven 带外核）；隧道回环（doctor：本地监听 15519 在位；端到端需真反向隧道+人在场）。
- 待采样（本契约首步只读采）：真机智能体卡片 `itemContainer` 与 `cardFields.name/.code` 类名——
  双证门 DOM 侧必需（entity-ui-wiring 挂账继承，hermetic 用 `.agent-card` 是夹具契约、不迁移到真机）。

## 分岔（待 Steven 裁决）

### D1 同名敌意对预置方式（uatDefinition ③ 过闸必需件）

- A：我用 autotest 在真机创建一对**精确同名**测试智能体（显式测试名如「测易同名对抗」×2），
  UAT 后删除并留清理证据（同三链删后归零双证先例）。
- B：Steven/管理员带外预置真同名对，告知名称后我只读消费。
- C：本轮先跑 happy 链+错码对抗，同名敌意押后——**代价：四步不全、UAT 不判过闸**（定义不可裁剪）。

### D2 sign 人签环节的执行方式（uatDefinition ②）

- A：沿三链先例「Steven 授权条件直签」（craft 脚本 confirmedBy=Steven 先例）：我核验草拟↔观察件
  五元 join 全对齐后代跑 sign，签名记 Steven 授权、证据链全留。
- B：我停在草拟+对账表，Steven 亲自跑 sign 命令。
- C：逐件贴对账摘要，Steven 逐件说「签」我再执行。

### D3 动真机时机

- A：现在就跑（隧道端到端通则一气呵成；不通则如实停、报探测证据）。
- B：Steven 先确认反向隧道在线再开跑。

## 裁决记录（Steven 2026-07-22，AskUserQuestion 三分岔全 A）

- D1=A：同名敌意对由我用 autotest 在真机创建（显式测试名、精确同名 ×2），UAT 后删除并留清理证据。
  设计随之定形：**一件两放**——先建单个 X（全场唯一）走完整 happy 链（编译→签→回放①→PASS 报告），
  再建第二个精确同名 X 后回放②同一已签件→必 AMBIGUOUS 不点击（NEEDS_HUMAN·AMBIGUOUS_ACTION 报告）。
  同一冻结件、只变真机状态，正证「双定位闭合到点击那一刻」；全程零业务智能体触碰。
- D2=A：授权条件直签（三链先例）：草拟↔观察件五元 join 对账全对齐后代跑 sign，signerId=Steven、
  对账证据全留档。
- D3=A：现在跑；先只读探测（登录+导航+卡片类名复核），端到端不通则如实停、报探测证据。
