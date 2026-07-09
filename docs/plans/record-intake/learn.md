# record-intake — learn（2026-07-09，full）

示教兜底第二契约落地：`casey intake <caseId> --capture <包>` 把示教录制包经安全复核闸登记进蒸馏前置队列，落 append-only 入账台账。capture 是**不可信输入**，本契约主体是一道对抗性 fail-closed 复核闸。

## 留存学习

1. 兜底入口的入账闸是对抗性接缝，不是薄壳。codex 跨族异构评审跑了 8 轮，逐**类**堵死而非逐个补漏：凭据（英文关键词 + 凭据文件 secret literal，raw + canonical + normConverge 解码三扫，封 `\u` 转义与 `%HH` 编码绕过）/ URL·host·scheme（`normConverge` 通用 `%HH` + 反斜杠归一到不动点；path 字段保守 scheme 边界「任何非 scheme 字符后的 scheme-shaped token 皆拒」一举覆盖全部遗漏 scheme 与 wrapper；多斜杠 `//host`；自由文本用 `DANGER_SCHEME` 黑名单避免误伤散文）/ schema 全闭合（顶层·source·event 键白名单 + 字段类型硬校验 + 元数据 ISO/enum 严格格式，堵住任意自由文本口）/ JSON 重复键（tokenizer 堵结构隐藏）/ symlink 四段（capture 文件·record-capture 目录·caseId 目录·既有台账）/ 敏感字段只认 `<redacted>`（不信包内自声明 `valueMasked`）。
2. 规范化必须**普适前置**于每道检查。任何编码/包裹变体先 `normConverge`（通用 `%HH` + 反斜杠到不动点）归一再判，否则补漏无穷尽（R2→R7 全是同一课的变体）。不收敛（超深嵌套编码）由 `reviewCapture` 字段级 fail-closed 兜。
3. 类别码要避开凭据门禁字段子串。`CREDENTIAL_HIT` 含 `credential` 会让台账行自触凭据门致晚期 exit 1——改名 `CRED_GATE_HIT`；caseId 也前置过 `credentialGate({caseId})` 防含 `token`/secret literal 的合法名自触。
4. JSON 重复键是结构隐藏 keystone。`JSON.parse` 取最后一个，脏内容可藏进被丢弃的键绕过 parsed-doc 全部检查；拒重复键后 parsed doc 即完整内容，`parse`(`\u` 解码) + `normConverge`(`%HH` 解码) 的检查方系统完备。正则凑不出，须极简 tokenizer（跟踪对象作用域键集、解码 `\u` 键名后比对）。
5. 入账台账 ≠ 裁定下游 失败记录台账（CONTEXT:116 / `failure-ledger-entry.schema.json`，seams-freeze-v2 冻结的 KEDB 子系统）。术语分名「示教入账台账」，绝不进 `verdict.mjs`、不作自愈输入、不改任何裁定（护栏 #13/#15）。
6. 缺字段/加性导出零涟漪。`record-capture.mjs` 加性导出 `ALLOWED_ACTIONS`/`ALLOWED_EVENT_KEYS`/`SENSITIVE_FIELD_RE`/`isSensitiveField`/`hasEmbeddedScheme` 作单一事实源复用，纯加 `export` 零行为差，record-capture 金牌不动。本契约零冻结 schema 涟漪，只加一个金牌。

## 明示残留（route:machine，威胁模型内可接受，codex R4-R8 逐轮认可）

- 事件自由文本**值/文本内容**里的：① 非英文（中文）凭据明文、② 裸内网 host（无 scheme 无 `//`，如 `internal-admin.corp.local`）、③ 非白名单 scheme 裸 host（无 `/@[` payload，如 `zzq:internalhost.corp`）——同族兜底评审 F1 实测三例均被 accept。根因：intake 四判据都只看**命名/结构**不看自由文本语义——`credentialGate` 英文关键词 + secret literal（护栏 #7）、`isSensitiveField` 只扫**字段命名**元数据、`FREE_TEXT_SCHEME` 要 `/@[` payload、`DANGER_SCHEME` 有限枚举、裸 host 无判据。**边界要说清**：这些密文/host **不进台账、不进回显**（台账只落类别码+caseId+sha256，实测未破「凭据绝不进台账/回显」不变量），与上游 record-capture 脱敏模型一致（也只按字段元数据遮值）——属全链路共有语义局限、非 intake 引入的回归。intake 结构上无法区分 `我的密码是X` 是凭据还是「密码重置流程确认文案」，真做内容级扫描会**过拒**合法包（两审同判「收紧声明而非内容扫描」）。故由**录制侧字段脱敏 + 相2 人签 + 真机人工录制 route:human 目检**为最终背书；lib 注释已收紧为「字段命名级」，勿把金牌 GREEN 读成全类覆盖。
- 硬链接（nlink>1）与 lstat-then-use TOCTOU：drvfs/9p 上 nlink 语义不稳 + 同机并发恶意写者不在 hermetic 兜底威胁模型内。

## 交到下一阶段的账（record-distill）

- distill 消费「已入账」capture 前**必须**校验当前 capture 字节 sha256 匹配 intake 台账 accepted 条目 + 重跑 `reviewCapture`（TOCTOU 硬门）——intake 侧只能绑 `captureSha256`，enforcement 归 distill 契约（已挂 `prd-record-intake.json` observability）。
- 蒸馏产物形态（候选 atom flow，复用 `source.kind:'json'` 零 schema 涟漪）与 LLM 边界（零 LLM 投影 + LLM 手术刀 CLI 外经闸）见 `docs/plans/record-distill/proposed/DESIGN-DRAFT.md` + `GRILL.md`（子代理起草，待 Steven grill 签核 7 项开放决策）。
- 真机人工录制一次后跑 `casey intake` 过闸、台账 accept、无凭据泄漏目检（route:human）。
