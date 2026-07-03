# learn — wf-publish-states（full，2026-07-03，hermetic 半程收口）

六阶段 hermetic 半程走完（grill 三分岔 Steven 拍板 → plan → accept 红先行 11/13 红 → loop 双 gate GREEN → codex 两轮 R2 PASS → learn）；真机四停站（confirm/execute/人签/报告过目）+ role 可达性探针挂 observability route:human 待 Steven 在场。沉淀五条：

1. **「机制缝递减」假设首次实证，但选型要按机制通路重验归档**：第二条 3 缝 → 本条 1 缝（buttonState 采集/评估）+ 半天收口，飞轮复利真在攒。但候选摸底同时翻出 `echo_default_on` 归 chat 是错档（实测画布维度、坐标拖拽、chat 机制零复用）——排期表的维度归类也是二手结论，选型前按「用了什么机制通路」重验，不按名字/直觉归档。文档纠偏已随本契约落（`FLYWHEEL.md`/`CONTEXT.md`）。
2. **词表 = 可草拟 = 已实现**：`IMPLEMENTED_KINDS` 是 kind 级、D2 soft 机制护不住 op 粒度——词表留未实现 op 是硬断言假红温床（草拟 enabled 过闸→评估恒 false）。收窄比留位诚实；被收走的 op（enabled/disabled）以「带实现回归」形态挂账（Steven 明令补完整），记 prd observability 不静默丢。
3. **负向断言判真要活性反证**（codex R1-F1）：「采不到」与「不存在」的区分必须是机器证据——`absent` 判真前提 = 同刻通道确实看得见按钮群（`buttonSeen`>0），盲区页证不出。这是 absent 类断言的通用范式：负向结论的证据义务比正向重（正向命中自证通道活性，负向零命中什么也不自证）。残余缝（同页混合元素形态）纯机制无法与真缺席区分，留流程防线（真机探针 + 补采配置）并显式记账。
4. **DOM 计数类采集一律可见性口径**（codex R1-F2）：`getByRole`/`getByText` 走可达性树天然滤隐藏，自写 css 通道 `evaluateAll` 裸数 DOM 必带假绿缝——凡新增计数通道，可见性过滤（`getClientRects` + `visibility`）是标配不是选配。对抗夹具场景（隐藏模板/盲区双向）继续是评审发现的放大器，两 High 都靠夹具场景钉成可红可绿的机器事实。
5. **golden 先行把契约面写死，实现一发全绿**：accept 期 golden 已钉死上下文键名（`buttonHits`/`buttonSeen`）、退出码（形状非法 65）、事件形状（publish 单 click event）——实现照 golden 走，首跑 13/13 绿。红先行的价值不止「证明测到了」，还在把实现要对齐的接口面提前冻成机器可核的规格。

配套：`IMPLEMENTED_KINDS` 10→11（buttonState，present/absent 双 op）；词表收窄 + schema `assertionOp` +present（prd-seams-freeze 重签）；`workflow.publish` 编译知识；涟漪四重钉（kinds-harden/chiefcomplaint/p4-drafter 范例与计数移交 + report-fidelity 零改）；publish-sut 四场景对抗夹具。真机四停站与 `cases/tc_wf_publish_states/` 真机件待 route:human；`wf_history_version` 成为下一条最便宜候选（buttonState 已装，只剩 clickEditorButton/closeDrawer 两原子加法）。
