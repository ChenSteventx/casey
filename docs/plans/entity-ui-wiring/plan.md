# entity-ui-wiring · plan（阶段 1）

> 2026-07-22。契约 full，worktree `casey-entity-ui-wiring`。GRILL 见同目录（三分岔已拍板 + 继承边界零触碰）。
> 主题：语义锁 UI 接线第一波（hermetic 轨）——W1 `agent.searchOpen` 联合定位输入侧收紧；W2 `workflow.bindAgent` 原子接线与双 receipt 锁链贯通。

## W1 `agent.searchOpen` 收紧 + 编码收敛

现状病灶（`lib/compile-atoms.mjs:1102-1111`）：点击 `{kind:'text', name: openName, exact:false}` 子串命中——同名前缀/超集（如「主诉」命中「互联网问诊-主诉」）会点错对象且绿过；回放侧无专用门，落通用兜底只断文本子串唯一。

改法：

1. **点击锚收紧**：`exact:false`→`exact:true`，加记录容器归属闸（命中必须落在智能体条目容器内，容器外硬阻断 fail-closed；镜像 `compileWorkflowOpen` `lib/compile-atoms.mjs:601-620` 先例）。容器选择器默认 `.agent-item`（chat-sut 实测），`profile.agents.itemContainer` 可覆写，真机类名采样挂 route:human。
2. **编码收敛（D2）**：registry `agent.searchOpen` 补 `code` 可选参数；`code` 在场时搜索框填 `code`（真机 placeholder 明文支持「名称或编码」），点击仍按 `openName` 精确锚。`code` 只作输入侧收敛，不冒充读回。
3. **编译门=回放门同刻**（openNode F2 元教训）：条目定位+容器闸抽为单一共享 helper（新 `lib/agent-search-gate.mjs`），编译与回放同函数消费；回放在 `lib/replay-actions.mjs` `performAction` 加 `agent.searchOpen` click 专用分支走同一门，多匹配→AMBIGUOUS 语义、缺席→硬阻断，绝不 `.first()`。
4. **夹具对抗场景**：chat-sut 补同名双条目场景（同一列表两条同名不同条目），红先行证明旧面（子串/first）会假绿、新面 AMBIGUOUS 硬阻断。名称文本是夹具既有通道，非投机接缝；平台 ID 读回本轮零触碰（GRILL 边界）。

## W2 `workflow.bindAgent` 原子接线

语义锁四层已泛化就位（策略 `entity-semantic-lock-preflight.mjs:51` relation/[source,target]；provenance/sign/回放准入均数据驱动），断缝只有三处原子识别面 + 金牌面：

1. **编译器**：`COMPILE_ATOM_COMPILERS`（`lib/compile-atoms.mjs:27-53`）注册 `workflow.bindAgent` → 新 `compileWorkflowBindAgent`。配方按 fake-sut 抽屉模式（D1）：域锁打开节点配置抽屉（复用 `doOpenNode` 同族域锁纪律）→ 智能体选择控件选中 `agentName` 精确项 → 抽屉内回读选中值【精确】双证。step 携 source（workflow）+ target（agent）双 `entityBindings`，由 flow 文档给出、编译投影已泛化（`compileFlow` `:516-528` 不改）。
2. 原子注册表快照：`lib/atoms-registry.snapshot.json` 登记 `workflow.bindAgent`（params：`nodeLabel`、`agentName`、可选 `agentCode`；post：选中值精确回读），使 flow-bridge 结构闸（`lib/flow-bridge.mjs:134`）放行；bridge 的 relation 双角色校验（`:130-132`）复用既有 preflight 策略不改。
3. **回放分支**：`lib/replay-actions.mjs` `performAction`（`:21-45`）加 `workflow.bindAgent` 专用分支（仿 `workflow.deleteByName` 分支形状）：抽屉域锁内定位选择控件、选中、精确回读；缺席/多匹配 fail-closed，绝不 first。
4. **夹具**：fake-sut 节点配置抽屉纯加法补智能体选择控件（含同名双选项对抗形态），双守卫不动既有金牌行为。
5. **端到端锁链金牌**：`prepareSignCase` 双 receipt 变体（provenance 两行 source+target、两 `createEntityLockReceipt`、两 lockId）跑 compile-draft→confirm→sign→replay 准入全链；负面：source-only / target-only 单边缺失必红 `FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID`（样板：`teachin-semantic-lock-runtime-authority` 的 relation-source-only/target-only 夹具对）。

## 验收点（阶段 2 冻结为红测试）

- A1 同名双条目下旧面假绿被证（红先行）：新面 `agent.searchOpen` 多匹配 AMBIGUOUS 硬阻断、绝不点 first；精确唯一时绿。
- A2 `code` 在场时搜索框填入值为 `code`（事件级断言）；registry 词条含 `code` 可选参数。
- A3 编译与回放消费同一共享 helper（结构性断言：两处 import 同源 + 行为对照）。
- A4 `COMPILE_KNOWN_ATOMS` 25→26 含 `workflow.bindAgent`；flow-bridge 对带双 binding 的 bindAgent flow 放行、缺 binding 拒。
- A5 bindAgent 双 receipt 端到端链绿（draft→sign→replay 准入）。
- A6 source-only / target-only 必红 `FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID`。
- A7 bindAgent 回放分支：选中值精确回读；选项缺席/同名双选项 fail-closed 硬阻断。
- A8 接线红基线守恒：`teachin-semantic-lock-runtime-discrimination-successor` 金牌字节 sha256 不变且仍 exit 1（0/26 诚实红不动）。
- A9 涟漪收口：受影响 prd 重签后全仓 gate 绿；CONTEXT.md 词条登记过 term-lint。
- A10 真机 spike 清单文档产出（智能体列表行属性 / 点击后 URL / 详情接口三通道观察项 + bindAgent 真机配方复核项），挂 route:human。

## route:human 挂账（本轮不做）

- 智能体平台 ID 读回通道真机只读 spike（A10 清单执行）；
- `agent.searchOpen` 容器类名与 bindAgent 真机配方四停站复核；
- 名称+ID 双定位真机 UAT 与同名敌意真机用例；
- 接线红基线填绿（唯一路径=真机运行时权威，2026-07-18 已裁）。
