# replay-video — 回放视频录制（full）

## 背景

真机 `casey run` 报告无视频的根因是 `bin/replay.mjs` 未启 `recordVideo`（交接挂账，非隧道问题）。冻结 schema 的 `attachments.video/videoAt` 与缺陷单 `videoAt` 位早已预留、渲染器已会渲染，缺口全在生产侧填值。决策依据见 `docs/plans/replay-video/proposed/GRILL.md`：D1 同 context 双 page + 登录页视频即删（fail-closed）、D2 装配器直产 attachments、D3 渲染升 `<video>` 可播、D4 `casey run` 缺省开启；机械决策 M1–M8（webm 直出 / case 级单录屏 / `--video-dir` opt-in / 语义名收敛 / 异常路径尽力收口 + 缺席容忍 / 双 page 舞步仅视频+登录同开 / 视频绝不进 verdict / prd schemaVersion 1）。

## 改动

1. `bin/replay.mjs` — 相3 回放器（唯一碰冻结内核处，full 由此起）：
   - 新旗标 `--video-dir <dir>`（opt-in）：缺省不带旗标时行为一字不变（含 `newContext()` 无参、收尾顺序原样）；带旗标时 `newContext({ recordVideo: { dir } })`。
   - 双 page 舞步（仅 `--video-dir` 与 `--login-bootstrap` 同开）：page1 跑登录预备 → 另开 page2、CDP/forensics 绑 page2 → page2 导航 `startUrl` → 事件循环全程在 page2；`loginMark` 机制照旧（登录流量天然不进 page2 的 CDP session，login-traffic-drop 不变量零弱化）。
   - 收尾（仅视频开启路径）：事件循环后显式 `await context.close()`（视频落盘保证）→ 收敛：登录 page 视频 `delete()`（失败重试一次、仍失败非零退出 fail-closed）、回放 page 视频改名 `video.webm` → 写 axes 与旁件 → `browser.close()`。
   - 视频元数据旁件 `runDir/video.json`（照 `--run-history` opt-in 式样，`bin/replay.mjs:34-36,468-493`）：`{ schemaVersion, file: "video.webm", startedAt, steps: [{ stepId, videoAt }] }`；`videoAt` = 事件起始相对起录时刻（page2 创建时刻 best-effort）毫秒偏移；纯文本、零 `://`、过凭据门写出；视频未成功落盘则不写（缺席容忍）。
   - 异常路径尽力收口：看门狗（`:119`）与 `main().catch`（`:500`）补尽力 `browser.close()`（带超时兜底）再退；任何路径视频缺席不影响退出码语义与裁定。
2. `bin/casey.mjs` — `runPipeline` 编排（`:98-110`）：
   - 相3 stage 缺省追加 `--video-dir <runDir>`，新增 `--no-video` 旗标显式关闭（D4）。
   - 装配 stage：`runDir/video.json` 存在才追加 `--video-meta <path>`（缺席零行为差，守旁件房例）。
3. `bin/report-model.mjs` — 装配器 CLI 壳：新可选旗标 `--video-meta <path>`；读文件 + 语义校验（对象、`file` 为相对文件名且零 `://`、`steps` 数组行含 `stepId`/数值 `videoAt`），坏件 fail-closed 非零退出零落盘（report-diagnostics 同律）。
4. `lib/report-model.mjs` — `assembleReportModel` 吃可选视频元数据入参：
   - 有值时逐报告步填 `attachments: { video, videoAt }`（intent 卷回时取该 intent 首个事件偏移；对不上的步不产 attachments 键）；`defectTicket.videoAt` 填首个败步偏移（`:237` 现恒 null 处）。
   - 无入参时不产任何 `attachments` 键、`videoAt` 恒 null——装配产物与现行为字节级一致。
5. `lib/report.mjs` — `attachmentsHtml`（`:132-143`）：`at.video` 有值且不含 `://` 时渲染 `<video controls>`（相对路径 `src`）+ 保留路径文本；含 `://` 沿用零容忍口径不出 `src`（宁失细节不漏形态）；`attachments.videoAt` 有值时并排显示起点时刻。`renderJson` 机读旁车零动（不投 attachments，M7）。
6. `tests/_golden/replay-video.golden.mjs` — 新 golden（真 chromium + 既有假 SUT 夹具，房式照 `p5-replay`）：
   - V1 登录舞步 + 卫生：login-sut + `--login-bootstrap --video-dir`：目录内恰余一份 `video.webm`（登录页视频已删）、`video.json` 形状合法且零凭据值零 `://`、axes 的 login-traffic-drop 不变量原样；
   - V2 缺省零行为差：不带 `--video-dir` 无任何视频产物（C1 同款方向）；
   - V3 无登录单 page：fake-sut + `--video-dir`：`video.webm` + `video.json` 落盘；
   - V4 装配器：带 `--video-meta` 产 `attachments{video,videoAt}` 与败步 `defectTicket.videoAt`；不带时装配产物与现行为一致（不产 attachments 键）；坏件（坏 JSON / 非对象 / `file` 带 `://` / steps 行缺键）逐形态 fail-closed 非零退出；
   - V5 渲染器：`attachments.video` 有值出 `<video controls` 相对 `src` 且整份 HTML 仍零 `http(s)://`；`video` 值含 `://` 不出 `src`；`renderJson` 无 attachments 投影。
7. `loop/prd-replay-video.json` — schemaVersion 1；testChecksums 冻结新 golden（涉共享夹具若有改动则一并入册重签）；stories：s1 新功能（acceptance = 新 golden）、s2 回归锁（`p5-replay` / `replay-login-bootstrap` / `layer3-wiring` / `p7-report` / `report-diagnostics` / `wf-publish-states` / `wf-history-version` golden + `selftest --tier1`）；observability 申报真机维度 route:human（内联可播 + 登录不入镜目检，机器 hermetic 测不到视频帧内容）。

涟漪预案（GRILL 冻结涟漪盘点）：`p7-report.golden.mjs` 吃的冻结 fixture 带 `attachments.video`，渲染器升 `<video>` 后 accept 期逐核其断言；若碰红则重钉 golden + `prd-p7-report` testChecksums 重签 + gate 复验，作为 accept 交付的一部分显式记录，不静默。

## 非目标

- mp4 转码 / `ffmpeg-static` 引入（M1 挂账后续加法）；每步视频切片（M2）；base64 内嵌（D3 明拒）。
- `attachments` 其余位（screenshot/trace/stepPage）继续空置——本契约只接 video 与 videoAt。
- verdict/gate 对视频的任何感知（M7：视频永远只是诊断附件）；相5 自愈；`expected.frozen` 旁车与全部冻结 schema 改动（M8）。
- 真机实跑（拉隧道 + Steven 在场，挂 observability route:human，与真机四停站合并行程）。

## 验收

- 新 golden `tests/_golden/replay-video.golden.mjs` 全绿；实现前红方向：V1/V3 旗标未识别或无视频产物、V4 装配器不识 `--video-meta` 或不产 attachments、V5 渲染器无 `<video>` 标签（V2 缺省零差异属回归方向、冻结即绿）。
- 回归锁全绿：`p5-replay` / `replay-login-bootstrap` / `layer3-wiring` / `p7-report` / `report-diagnostics` / `wf-publish-states` / `wf-history-version` golden + `node bin/casey.mjs selftest --tier1` 原样绿；`p7-report` 若因 `<video>` 升级碰红，按涟漪预案重钉重签并 gate 复验，显式记录。
- `node loop-kit/bin/gate.mjs --prd loop/prd-replay-video.json` GREEN（passes 只由 gate 写）。
- 真机验收挂 observability route:human：真机 `casey run` 报告录屏内联可播、登录期镜头不入镜（人工目检），人不在场只挂账不代签。
