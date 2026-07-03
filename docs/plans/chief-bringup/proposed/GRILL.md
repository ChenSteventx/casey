# GRILL — chief-bringup（direct，真机 bring-up 两修）

授权：Steven 停站②在场点选「confirm + 跑真机编译（失败则回报诊断再修）」——本契约即该「回报诊断再修」的兑现。诊断证据（只读探针两轮，2026-07-03）：

- 真机编译撞看门狗 120s 强退、零诊断落盘。
- 探针一：菜单项三种定位全 count=1，但 click 5s 超时——点击点元素链 `SPAN < SPAN.hr-menu__content < DIV.hr-menu__item…spacer < LI.hr-submenu`（regress 记档的拦截真身：submenu + spacer）；父 `li` 还 count=2（多匹配）。点击通路天生脆。
- 探针二：直接路由 `/heren/aimanagement/agent/list` 一击即中（搜索框=1）；短路径 `/agent/list` 也重定向达。

机械决策两条：

- **G1 路由导航优先**：通道剖面 `routes.agentList`（非凭据路径段，形状校验同 `workflowList`）接线到编译运行档；`nav.agentManagement` 编译知识有路由则单 nav event + 搜索框后置等待，无路由退点击通路（保兜底、注明脆性）。flow 文件不变（原子语义「进入智能体管理」不变），Steven 的 confirm 仍有效。
- **G2 失败步不再堆等**：`emit` 已回传 `resolution`——三个 chat 维度原子的后置条件等待（30s 级）只在本步 `unique` 时执行；失败步立即让 fail-closed 走到头、把诊断报告落出来（本次事故：早期步失败后 30s×N 等待先于 exit 65 撞死看门狗）。
