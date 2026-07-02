# GRILL — kinds-harden（light）

授权：HANDOFF「直接下一步 ②」+ Steven「再继续跑」（2026-07-02 深夜）。

## G1 noErrorToast 判据（人签）

- 分岔：A 词表判（代表步静默点实采 toast 文本命中 `失败|错误|异常` 即败，`actual` 携实采文本串供人核）/ B 等真机错误形态采样后按 UI 结构类名判 / C 双轨。
- 人签：**取 A 词表判**（Steven，AskUserQuestion，2026-07-02）。结构类名采样收紧留观察挂账（真机造错误弹窗属 route:human，撞上时顺手采）。

## G2 冻结 golden 范例换 kind（棘轮更新清单，D2 生命周期既定涟漪）

`textVisible`/`noErrorToast` 提硬后，三份冻结 golden 把它们钉作「未实现范例」的检查语义随 D2「补实现后重签提硬」翻转——逐份红先行改 + 补冻 + gate 复验：

- `p4-drafter.golden.mjs`：S3 骨架 `textVisible` 由 soft 翻硬；C-map `noErrorToast` 由 soft 翻硬（`buttonState` 仍未实现、保 soft 不动）；S3b 的「未实现漏 soft 应拒」范例 `textVisible` → 换 `buttonState`。
- `draft-cli.golden.mjs`：D1 `textVisible` 翻硬；D2/D9 的 patch 条目去 `soft:true`（提硬后带 soft 会被 D2 闸拒——正是闸该有的行为）。
- `report-fidelity.golden.mjs`：F2b「未实现 kind actual 恒 null」范例 `textVisible` → 换 `buttonState`。

## G3 采集同构（机械决策）

- replay 在**代表步静默点**（同 compile 观测采集时机）现场采：toast 快照（选择器逐字复刻 `compile-atoms`：`.hr-toast,.hr-message,[role="status"],[role="alert"]`，同构注释互指）+ 本 intent `textVisible` 断言值的命中计数（`getByText` count，另兼收 toast 文本包含——toast 短暂、正文与弹窗双通道）。事后卷回评估只吃采好的事实（既有 `intentUrl`/`intentCount` 范式）。
- `textVisible`：命中数 > 0 即过，`actual` = 命中数；未采到（无上下文）→ `ok:false`、`actual:null`（证不出）。
- `noErrorToast`：实采 toast 词表匹配零命中即过；`actual` = toast 文本串（`；`连接，脱敏由装配器既有通道管）；未采到 → `ok:false` 证不出。

## G4 重签提硬（route:human）

真机 `casey draft` 重产草稿（新 kind 自动出硬）→ Steven 重签（新 `signedAt`）→ `casey run` 重跑——今天签的三条 soft 升硬后全链复验。
