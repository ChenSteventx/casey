# PLAN · delete-spec-magnifier

前置：同目录 GRILL.md（Steven 裁闸学精确形状）。

## 改法（一个文件）

`lib/workflow-delete-spec.mjs` · `validateWorkflowDeleteBindings` 循环内、文案白名单
判定之前：`label == null ∧ (value 缺/非串/空白) ∧ fallbackCss === '.hr-input__suffix
.search-icon'` → `continue`（放大镜搜索触发器，无目标绑定义务）；css 对但携文案或携
value → 不入此形（落回原判定，文案对则查 value、文案错则拒——形状矛盾不放）。

## 验收金牌（accept 冻结，六钉）

- M1 放大镜双击真产物形（过滤 + 删后重搜，逐字节自十五跑事件）→ ok（实现前必红）。
- M2 css 错一字（`.search-ico`）→ 照拒 `unsupported_click_label`。
- M3 css 对但携 value → 落回原判定（文案 null → 拒；形状矛盾不混装）。
- M4 css 对但携文案「删除」→ 原 value 义务照常（缺 value 拒 `missing_target_binding`）。
- M5 既有三面逐字等价：base ok / 缺 value 拒 / 未知文案拒（镜像冻结金牌夹具）。
- M6 css 对但 semantic.name 在场 → 照拒（文案定义=semantic.name ?? text，同闸原口径）。
- 红/绿基线运行验证、sha256 冻结进 `loop/prd-delete-spec-magnifier.json`。

## 冻结面与收口

- 邻接必绿：`workflow-delete-spec-preflight.static`（冻结金牌零触碰）+
  `wf-delete-search-filter` + `wf-delete-card-layout` + term-lint + selftest。
- 突变闭环 + 全仓串行扫描 + 双路异构评审（ext4 克隆姿势）+ 收据/learn/audit →
  merge → replay 重跑（票据核销态先查，已占则重铸披露）。

## 非目标

同 GRILL 第 4 条。
