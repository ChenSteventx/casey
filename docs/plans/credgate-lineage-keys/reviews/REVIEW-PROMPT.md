# 评审提示词 · credgate-lineage-keys

你是异构评审方，对已提交不可变快照做代码评审。只报 Critical / High / Medium；结论行
`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给文件:行号、严重级、失败场景。
本契约改的是**安全门**（护栏 #7 凭据兜底门），请以「找绕过」为第一优先级。

## 仓与基线

- 仓：当前工作目录即契约树克隆（可自跑命令验证）。
- 基线：dev `1a601fa`；评审对象 = `git diff 1a601fa..HEAD`。
- 背景（按需读）：`docs/plans/credgate-lineage-keys/GRILL.md`、同目录 `plan.md`。

## 改动白名单（超出即报）

1. `lib/cred-gate.mjs` —— 新闭集 `NON_CREDENTIAL_JSON_KEYS`（恰两键）+
   `neutralizeDomainLineageKeys`（扫描副本键中和）+ `credentialGate` 关键词分支
   改扫中和副本；字面量分支扫原文不变。
2. `tests/_golden/credgate-lineage-keys.zero-sut.golden.mjs`、
   `loop/prd-credgate-lineage-keys.json`、`docs/plans/credgate-lineage-keys/**`。

## 风险清单（请优先证伪）

- R1 走私面：能否借两个豁免键把真凭据带出门？（值仍在中和副本中受关键词扫描 +
  原文受字面量扫描；值形状字符集不含引号/反斜杠——请构造反例：JSON 转义、嵌套引号、
  Unicode 转义、重复键、键名大小写变体 `BatchToken`、非 JSON 上下文裸文本中的
  `"batchToken": "..."` 形串。）
- R2 中性标记 `<nc-lineage-key>` 自身与替换后的拼接是否可能合成新关键词
  （如替换边界与相邻文本拼出 `bearer ` 等）。
- R3 正则 `"key"\s*:\s*(null|"<形状>")` 的全局多命中、跨行、`\s` 含换行的行为；
  ReDoS 面（模式为线性、无嵌套量词——请核）。
- R4 既有语义零回归：五关键词 + token/cookie/apikey/x-api-key/bearer 在非豁免
  上下文全部照拦；first-hit 顺序、大小写无关、hit 措辞不变；
  `p7-credgate-coverage` 冻结金牌零触碰绿（可自跑）。
- R5 消费面：compile/report/replay 三处 credentialGate 调用行为差异仅限
  「合形世系键值对不再误伤」；compile/report 产物今日不含这两键（可全仓检索证）。
- R6 G5 在真凭据环境的跳过分支是否构成假绿面（工作树无凭据文件故本轮实跑）。

## 既有证据（可自行复跑）

- 六钉金牌 exit 0；红基线 G1/G5/G6 红（`accept/red-proofs/`）；突变三把
  （键闭集扩容 / 值形状放空 / 标记携关键词——各红、还原 sha256 逐字节同）；
  邻接七命令全绿（含 p7 冻结金牌零触碰）；全仓串行扫描对基线零新增另录；
  真机两跑（票据 c/d）实证缝本体与执行链全通。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、API key、真实目标地址。
