# entity-ui-wiring · GRILL（阶段 0 决策归档）

> 2026-07-22。契约：`entity-ui-wiring`（full，独立 worktree `casey-entity-ui-wiring`）。
> 本轮主题：语义锁 UI 接线第一波（hermetic 轨）——`agent.searchOpen` 联合定位输入侧 + `workflow.bindAgent` 原子接线。
> 决策树来源：Steven 需求清单（名称+ID 联合定位 / 双边锁定 / successor / 后置复核）+ 三分岔当场拍板 + 既有已裁裁定继承。

## 已裁决策（本轮新拍板，Steven 2026-07-22）

- **D1 bindAgent 配方 hermetic 先行**：按 `wf-open-node` 先例，编译配方对 fake-sut 抽屉/下拉模式落地；真机配方复核挂 prd observability（route:human），若真机证伪按先例修订配方并重签。否决「等真机探针再动编译器」（会把锁链与金牌一起压住）。
- **D2 编码参数纳入**：`agent.searchOpen` registry 补 `code` 可选参数——有编码时搜索值用编码收敛候选（真机搜索框 placeholder 明文「输入智能体名称或编码进行搜索」，输入侧通道今日真实存在）、点击仍按名称精确锚。平台 ID 读回不在本轮（见继承边界）。
- **D3 worktree 施工**：主树 baton 虽空闲，但主树有并行会话未暂存文档改动；起第 5 棵 worktree（≤5 上限内）独立 baton，零冲突收口后合回。

## 继承的已裁边界（本轮零触碰，机制强制）

- **接线红基线只准真机权威填绿**（Steven 2026-07-18「单元导出+真机双轨」，丙案「恢复可验证接缝」已否决）：`tests/_golden/teachin-semantic-lock-runtime-discrimination-successor.zero-sut.golden.mjs` 与其 prd **字节零触碰**；任何使其转绿的旁路属违例。
- **不新增可铸权威入口**：不碰 `createEntityRuntimeAdapter` / `issueEntityRunContext` / `readEntityRuntimeCapability`；不改 `evaluateEntityAction` / `createRunSuccessorProof` 行为。
- **生产 publications 保持 fail-closed 空态**，零触碰。
- **平台 ID 读回通道不投机**：真机上 ID 在哪（行属性 / URL / 详情接口）尚无实证（observation-sidecar 计划明文 pending 真机只读 spike）；夹具只复现已冻接缝、不另造。本轮只预留消费缝 + 产真机 spike 清单，UI 读回接线等 spike 定案后另立契约。

## 范围

**做（hermetic，全部零 SUT 可验）**：

1. `agent.searchOpen` 收紧与联合定位输入侧：点击 `exact:false`→`exact:true` + 记录容器归属闸（镜像 `compileWorkflowOpen` 先例 `lib/compile-atoms.mjs:601-620`）；registry 补 `code` 可选参数（D2 语义）；chat-sut 夹具补同名双条目对抗场景（同名不同项必须 AMBIGUOUS 硬阻断，绝不取 first——名称文本本就是夹具已有通道，非投机接缝）。
2. `workflow.bindAgent` 三处原子识别面接线：`COMPILE_ATOM_COMPILERS` 注册 + 新编译器 `compileWorkflowBindAgent`（产 source+target 双 `entityBindings`，UI 配方按 fake-sut 抽屉模式）；`lib/atoms-registry.snapshot.json` 登记词条（过 flow-bridge 结构闸）；`lib/replay-actions.mjs` 回放分支（双实体分别定位、身份回读、fail-closed）。语义锁四层（策略/provenance/sign/回放准入）已泛化就位，不改。
3. 金牌：bindAgent 双 receipt 端到端面（compile-draft→confirm→sign→replay 准入；单边缺失必红 `FROZEN_ENTITY_LOCKS_REQUIRED_ROLES_INVALID`）+ searchOpen 收紧红先行金牌（同名双条目旧面必绿新面必红的翻转证明）。
4. CONTEXT.md 补词条（agent.searchOpen 联合定位输入侧语义、bindAgent 关系原子），涟漪 prd 重签按棘轮纪律。
5. 产出真机 spike 清单（route:human 交付物）：智能体列表行属性 / 点击后 URL / 详情接口三通道逐项观察项，供 Steven 真机趟一次采齐。

**不做（显式出界）**：接线红基线转绿；平台 ID 读回接线；真机 UAT / 同名敌意真机用例（挂 route:human）；runtime adapter / publication（真机轨）；`agent.searchOpen` 点击锚从名称换 ID（无读回通道，换不了）。

## 主要风险与对策

- bindAgent 真机配方与 fake-sut 抽屉模式不符 → openNode 先例：真机四停站证伪后修订配方 + 重签，прd observability 已挂明。
- `exact:true` 收紧误伤真机既有用例（名称带省略号/前后缀）→ 收紧只动 `agent.searchOpen` 点击锚，搜索框定位维持现役 exact 语义；金牌带正反两面钉住。
- 涟漪面：动 `compile-atoms.mjs`/registry 触既有 prd checksum → 按「陈旧绿普查跑全 gate」纪律，收口前全仓 gate 复跑。
