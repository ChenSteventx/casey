# real-uat-attestation · learn（阶段 5 沉淀）

> 状态：契约六阶段全 done。uatDefinition 四步真机见证全过、Steven 终局人签（含 503 SUT_DEFECT
> 采认）；codex 四轮异构评审 R4 终判 PASS（R1-R3 每轮 finding 全采信修复）。

## 交付结果

- agent-id-readback 冻结 uatDefinition 四步真机兑现：①真机重编译 v2 产物（观察三元组 platformId
  19 位纯数字）→②sign 五元 join 授权直签→③一件两放（唯一时双证 unique+回读+落笔+详情路由；
  同名对在场必 AMBIGUOUS 不点击）→④报告三形态×2（录屏+视觉复核+全附件共置三链版式）+清理三面归零。
- 真缺陷上报：autotest 标准表单新建的骨架智能体，详情页 `agentPlus/queryPlus`+`getAgentDetail`
  确定性 503（两实例均复现；run-1 归因窗内→SUT_DEFECT、run-2 归因窗外→孤儿记录+终帧「操作失败!」
  可视面）。Steven 已采认。
- 完整性金牌 V1-V6（checksum 核值/人签核件/真机产物深核/网络账对刺/复核交付面全锁）。

## 教训与沉淀

1. **引证必亲验**：视觉复核引了 end.png 却没真看——帧上两条「操作失败!」漏报，被 codex R2 当场逮。
   复核清单里的每个文件必须逐一打开看过才许署名；「我采了帧」不等于「我看了帧」。
2. **结论先对全量取证账**：凭 verdict PASS 推断「503 未现」是错的——503 在 axes 里以归因窗外孤儿
   记录在案。任何「X 未现/已消失」的断言先扫全量网络账（含孤儿），再落笔。
3. **归因窗与视觉复核互补是设计不是缺陷**：因果作用域取证（非时间窗）会把迟到的 SUT 错误归 null
   ——裁定机械正确；可视异常由视觉复核通道上报。两通道各司其职，谁也不顶替谁。
4. **身份锁绑实例，重跑=重铸不是复用**：冻结件绑已删 X 的 platformId，重跑必须走「审计归档旧件→
   摘 prd 陈旧账→重预置→重签」全仪式；sign 的「无 publication journal 拒猜残留」fail-closed
   在真场景兑现了价值。
5. **棘轮要锁「全部交付面」不是「代表面」**：只核 report-model 时，visual-review 源件/JSON/HTML/MD
   任一面可复活假状态仍 GREEN；同一事实的每个交付投影都要独立核（含渲染层中文状态词与含式子串
   反向排除）。
6. **fail-open 成功判据是自欺**：`≥1` 式创建判定、跳过式清理，都被 codex 判 fail-open——真机操作
   脚本的成功判据必须严格恰等+归零多面核+日志冻结。
7. 真机形态账（原子知识候选）：新增智能体=下拉两跳；编码由名称自动生成、确认前可覆写（同名对=
   同名+覆写异码）；`智能体描述`必填走内联报错；卡删除藏「更多」菜单；列表搜索渲染需 3-4 秒静置。
8. 工装缝挂账：drafter `--patch` 的 intentId 不经 observed intents 存在性校验（错位断言静默孤儿）
   ——另立修单（prd observability 第 2 项）。

## 挂账（route:human / 后继）

- drafter patch intentId 校验修单（见上 8）。
- SUT 503 缺陷上报后续（Steven 渠道）。
- 密钥签名威胁面 / SKILL.md 措辞统一（继承 agent-id-readback observability）。
