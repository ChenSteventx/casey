# chief-bringup — 真机 bring-up 四修（direct）

## 改动

1. `bin/compile.mjs` + `lib/compile-atoms.mjs`：通道剖面 `routes.agentList` 接线（形状校验同 `workflowList`）；`nav.agentManagement` 路由导航优先、点击通路降兜底（真机点击被 `hr-submenu`/spacer 拦截 + 父 `li` 多匹配，探针实证）。
2. `lib/compile-atoms.mjs`：三个 chat 原子的 30s 级后置等待只在本步 `unique` 时执行（失败步堆等曾把 120s 看门狗撞死、诊断都不落）。
3. 消息框语义 `exact:false`（真名「请输入消息...」带省略号，`exact` 必 0 命中，探针实证）。
4. `agent.openTestPanel`：networkidle 前置（5s 有界，codex R1 加界）+ 点空重点采集自愈（真机间歇吞点实证；重点不产 event，回放期单击风险 fail-safe 兜、挂账观察）。

## 验收

`chiefcomplaint-smoke.golden` 11/11（C2 新增「单路由 nav event」断言钉红修绿）+ 补冻 + gate GREEN；真机编译验证到凭据门前（零非 unique 步）。
