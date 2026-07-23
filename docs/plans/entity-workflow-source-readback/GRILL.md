# GRILL · entity-workflow-source-readback（C2）

> 三方规划已拷问。母规格 `docs/plans/entity-identity-lastmile/plan.md`。依赖 C0 注册表（55a3bc4）。

## 决策树（已清空）

- **D1 双锁编译/回放/裁定链要重建吗?** 否。已建冻结（dev@82484ab、codex 四轮 PASS）：`compileWorkflowBindAgent`、`doBindAgent`、裁定 `verifyRequiredActionRoles` 校验双角色。v2 已支持 workflow kind + source/target + created-in-run→platform-readback。**C2 只补 source 侧读回，不碰 v2、不重建链。**
- **D2 缺口在哪?** 读回被硬钉 agent-only——C0 已把 sign 准入泛化成注册表，C2 只需**往注册表加 workflow 条目（数据）**+ `workflows.listApi` 注入（镜像 agents.listApi）+ `compileWorkflowCreate/Open` 武装 source 读回。
- **D3 sign 白名单泛化的安全边界?**（codex Q3）闭集：`action policy→required role→bound kind/provenance→允许 issuer/atom` 恰好匹配。**否决**「任何同 kind 观察行都接受」——伪造 `kind:'workflow'` 观察行必须被拒。C0 注册表已是此形状，C2 加数据即继承。
- **D4 真字段名怎么办?**（codex Q5④/⑤）agent 侧第一轮猜 `data.records` 被真机纠正——workflow 侧**务必先采不猜**。真 `recordsPath`/`totalPath` + 抽屉真实类名 = route:human 挂账；hermetic 用仿造 workflow-list fixture。
- **D5 provenance 约束?** workflow source 若 existing 走 user-approval；created-in-run 必须 platform-readback（读回）。缺 ID/坏候选/扫描不全不得推 SAME。

## 半硬确认
Steven 2026-07-23 确认范围与边界、回「同意」；grill 用户确认成立。
