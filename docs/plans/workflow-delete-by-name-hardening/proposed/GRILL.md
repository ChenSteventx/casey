# workflow-delete-by-name-hardening 决策

背景事实：2026-07-15 的真实回放中，`workflow.deleteByName` 的删除触发事件全页命中 5 个“删除”而拒点，后续确认事件缺席；目标卡片仍在，但 cleanup intent 因只看代表事件与全局无错误断言而被机器报成 `PASS`。根线程另行修复 intent 内事件失败折叠；本契约只加固现有删除原子，不碰裁定内核。

## D1 原子边界

- 只修改现有 `workflow.deleteByName`，禁止新增同义原子。
- 清理失败不得改写前序业务 intent 的结果，但 cleanup intent 自身必须如实暴露 `none`、`ambiguous` 或 `action_failed`，绝不声称“尽力成功”。

## D2 目标记录域锁

- 删除目标名优先取编译参数；回放旧 events 不扩 schema，而从当前唯一搜索框的非空值读取并与实例化上下文一致使用。
- 支持 Heren 当前卡片布局与兼容表格布局：只认包含精确目标名可见叶节点的 `.hr-card.hr-card--bordered` 或 `.hr-table-row`。
- 两类容器物理去重后必须恰好一个；目标容器内精确可见“删除”动作也必须恰好一个。缺席、多匹配都零落笔。

## D3 确认弹层域锁

- 确认动作只在唯一可见的对话框、消息框或二次确认弹层内寻找编译期实采的“确定”或“确认”。
- 域外同文案按钮不参与计数；可见弹层为零、多个，或域内确认目标非唯一时零落笔。
- 编译期不再猜一个全页“确定”兜底；证不出即留下阻断证据。

## D4 物理身份连续性

- 扫描域时立即保留物理句柄并盖一次性 pin；动作前重验：域内唯一者仍是原句柄、pin 全页唯一、pin 承载者仍是原句柄、目标叶节点与动作仍在原域内唯一可见。
- 任一重验失败记 `action_failed`，并在 `finally` 清 pin、释放句柄。页面在扫描与点击间替换节点时绝不点后来者。

## D5 编译与回放对称

- 新建一个共享的删除域模块，编译器与回放器调用同一算法。
- 编译器的 `customAct` 接收结构化动作轴，使 `unique`、`none`、`ambiguous`、`action_failed` 原样进入 verification；旧的无返回 callback 维持原行为。
- 不修改 `bin/replay.mjs`、`bin/verdict.mjs` 与 events schema；不与 intent 失败折叠轨重叠。

## D6 计数与人签边界

- `auditDeleteCount` 的表格口径改为目标行，不再数全表；卡片口径维持目标卡。目标容器数与域内删除目标数相等才放行破坏性链。
- 三条真机用例的 Heren profile 候选都显式使用卡片计数，并带相同加载遮罩；本契约只产候选草稿，不写 gitignored 真机件。
- cleanup 硬断言候选：CRUD 与发布为 `intent_3`、历史为 `intent_7`，均为 `countChange equals 0`。只写待签草稿，绝不代 Steven 签署 frozen expected。

## D7 验收与现场

- fake-SUT/fixture 只读，禁止启动；旧金牌只作迁移历史，不作为验收。
- 真机发布、历史、CRUD 三链共用 `atl_r1` 并在共享环境串行；每案独立录屏、独立 HTML、同次 run 附件齐全。
- 真实验收发现 replay 默认实体为 `atl_r1`，首次报告批次的 profile 却计 `atl_realuat0715a`，该批次立即作废；修正精确计数锚后完整重跑到 `real-uat-20260715-final-b2`，不得复用错误批次结论。
