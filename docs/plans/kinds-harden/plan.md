# kinds-harden — textVisible / noErrorToast 提硬（light）

## 背景

相2 首航签的 7 条断言里 3 条 soft（`noErrorToast` + 两条 toast 文案 `textVisible`）——D2 既定「未实现 kind 冻 soft、补实现后重签提硬」。本轮补实现这两种（`buttonState`/`switchState` 等其余 8 种不动），随后真机重签提硬。判据人签 GRILL G1（`noErrorToast` 词表判）；采集口径 G3（代表步静默点同构 compile）。

## 改动

1. `bin/replay.mjs`：intent 代表步静默点后现场采 toast 快照（选择器复刻 `compile-atoms`）+ 本 intent `textVisible` 断言值命中计数（`getByText` + toast 文本双通道）；存 `intentToasts`/`intentTextHits`，评估上下文加 `toastTexts`/`textHits` 两键。
2. `lib/replay-assert.mjs`：实现 `textVisible`（命中数>0，actual=命中数）与 `noErrorToast`（词表 `失败|错误|异常` 零命中，actual=实采 toast 串）两分支；缺上下文一律 `ok:false`/`actual:null`（证不出）；`IMPLEMENTED_KINDS` 5→7。
3. 三份冻结 golden 范例换 kind / soft 翻硬（清单 GRILL G2，红先行 + 各 prd 补冻 + gate 复验）。
4. 新 golden `tests/_golden/kinds-harden.golden.mjs`：单元向（两 kind 正反 + 缺上下文证不出 + actual 口径）+ 集成向（login-sut 假 SUT 回放：`textVisible` 命中页面标题真过 / 未命中真败 / `noErrorToast` 无弹窗真过——axes 实测）。

## 非目标

其余 8 种未实现 kind；错误 toast 结构类名判（G1 挂账）；真机重签提硬本体（route:human，收口后即做）。

## 验收

新 golden 全绿（实现前红）；三份翻转 golden 各自红先行改绿、prd 补冻、gate 复验 GREEN；p5 两份冻结 golden + tier1 回归。
