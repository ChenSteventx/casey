# report-video-block — grill 决策（P7 报告第二增量，full）

背景：report-spec §3 目标态余四项之一——回放录像块（顺序 4：测试用例 → 原子操作 → **回放录像** → 裁定概览）。承 report-nl-atomic 已落前两块，本契约续加录像块。数据源 `videoMeta.file`（已白名单文件名）已在 `assembleReportModel` 入参。

## D1 replayVideo 数据源与形态

- 定夺：装配器恒设顶层 `replayVideo` = 有 `videoMeta` 时 `{ file: videoMeta.file }`，否则 `null`。新模型恒带键（含 null）。
- 理由：与 naturalLanguage 同姿态——键存在即渲染块（缺席零行为差靠「键不在」区分旧模型）。

## D2 渲染位置

- 定夺：HTML/MD 主页「原子操作」块之后、「裁定概览」(summary) 之前（report-spec §3 顺序 4）。JSON 旁车带 `replayVideo`。

## D3 无录像明示（report-spec #10）

- 定夺：`replayVideo === null`（键在）→ 块显式「无录像」不静默略。缺席零行为差：模型无 `replayVideo` 键（旧模型/共享 fixture）→ 不产块。
- 缺失原因：本增量只标「无录像」；「登录凭据卫生→两上下文」的具体原因文案数据未在模型内，留后续（prd observability）。

## D4 自包含（不破 p7-report 自包含闸、不违 §1 主页轻量）

- 定夺：HTML 用相对 `src` 的可播放 `<video src="<file>" controls>`（非 base64 内联、非 http 外链）。MD 给文件名（可点链接）。
- 理由：相对文件名不撞 p7-report 的「无 http 外链 / 无 script[src] / 无 link[href]」闸；不 base64 内联即不违 §1「主页轻量、录屏内联在子页」。录像文件与报告同 run 目录（§1 拆分式）。

## D5 凭据卫生

- `file` 是 replay-video 契约已收窄的纯文件名白名单 `[A-Za-z0-9._-]`（非全点），无 host/凭据；登录期不入录像是回放侧保证（replay-video D2），报告只引用不重录。
