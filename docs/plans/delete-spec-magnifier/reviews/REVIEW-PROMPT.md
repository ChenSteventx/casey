# 评审提示词 · delete-spec-magnifier

你是异构评审方，对已提交不可变快照做代码评审。只报 Critical / High / Medium；结论行
`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给文件:行号、严重级、失败场景。

## 仓与基线

- 仓：当前工作目录即契约树克隆（可自跑命令验证）。
- 基线：dev `a470d15`；评审对象 = `git diff a470d15..HEAD`。
- 背景（按需读）：`docs/plans/delete-spec-magnifier/GRILL.md`、同目录 `plan.md`。

## 改动白名单（超出即报）

1. `lib/workflow-delete-spec.mjs` —— 白名单加一精确形（文案 null ∧ value 缺 ∧
   `fallbackCss === '.hr-input__suffix .search-icon'` 才放；矛盾形状落回原判定）。
2. `tests/_golden/delete-spec-magnifier.zero-sut.golden.mjs`、
   `loop/prd-delete-spec-magnifier.json`、`docs/plans/delete-spec-magnifier/**`。

## 风险清单（请优先证伪）

- R1 白名单是否可被滥用制造无绑定破坏 click（css 伪装、混装形状、大小写/空白变体）。
- R2 既有三拒面逐字等价（冻结金牌 `workflow-delete-spec-preflight.static` 零触碰绿）。
- R3 放大镜字面与编译器产出（`lib/compile-atoms-workflow-crud.mjs` 放大镜 emit）是否
  逐字一致——字面漂移会静默回到拒。

## 既有证据（可自行复跑）

- 六钉金牌 exit 0；红基线 5 过/1 红；突变 `git show` 闭环；邻接五命令全绿；
  gate GREEN 2/2。拦点实证：十六跑 replay fail-closed 零启动（`atstep_13`/`17`）。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
