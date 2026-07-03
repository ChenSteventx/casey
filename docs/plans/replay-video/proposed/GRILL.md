# GRILL — replay-video（full，实质 grill，2026-07-03 Steven 拍板）

授权：Steven 本日点单 `docs/NEXT-SESSION.md` 下一步选项 C「回放视频录制」（碰回放器须 full），并对下列四分岔逐一点选拍板。
源材料：`docs/NEXT-SESSION.md`（报告无视频根因 = `replay.mjs` 未启 `recordVideo`，非隧道问题）、`docs/HANDOFF.md`、五路并行侦察（回放器内核 / 报告侧 / 凭据卫生 / 流程件 / 测试式样，证据以 `file:line` 落各决策条目）。
摸底要点：冻结 schema 早已预留 `attachments`（`tests/_golden/schemas/report-model.schema.json:314-353`，含 `video`/`videoAt`，缺陷单另有 `videoAt`），渲染器已会渲染 `at.video`（`lib/report.mjs:132-143`），装配器从不产该字段（`lib/report-model.mjs:237,325-339`）——缺口在生产侧填值，schema 与渲染骨架零解冻。`@playwright/test` 精确 pin 1.60.0，`recordVideo` 为 context 级选项、每 page 一个视频文件、context 关闭后才保证落盘，`Video.path()/saveAs()/delete()` 全可用（`node_modules/playwright-core/types/types.d.ts:10424-10450,21568-21593`）。

## D1 登录期镜头不入镜机制（Steven 拍板：同 context 双 page + 登录页视频即删）

- 事实：`recordVideo` 是 context 级；现登录预备与回放共用同一 context 同一 page（`bin/replay.mjs:176-198`），开录必拍到账号键入（`lib/login-bootstrap.mjs:87-89` 明文 fill）。视频是二进制，文本型凭据门管不住（`lib/cred-gate.mjs:44-56`），卫生只能结构保证。
- 拍板：录像与登录预备同开时，登录跑在 page1，完成后另开 page2 承载回放；page1 关闭后对其视频 `video.delete()`，删除失败重试一次、仍失败非零退出（fail-closed，凭据卫生优先于回放结果）。
- 依据：同 context 双 page 会话载体覆盖最全（cookies/localStorage/IndexedDB 全共享，真机断链风险最小）；备选「双 context + `storageState`」登录零录制结构更纯，但 `storageState` 只搬 cookies+localStorage、真机登录态载体未取证（仓内 `storageState` 零命中，应用有发送期自取临时凭据路由），断链风险不可控；「ffmpeg 后期裁切」引新依赖且裁切前完整凭据镜头在盘上，弃。
- 代价确认：登录镜头在 gitignored `runs/` 内短暂落盘、退出前必删——与 `.auth/credentials.json` 明文在盘同威胁面，不越界。

## D2 视频信息进报告的装配路线（Steven 拍板：装配器直产 attachments）

- 事实：两条路线都不破冻结——schema 预留位允许可选 `attachments` 键，layer3 golden 禁键扫描不含 `video`（`tests/_golden/layer3-wiring.golden.mjs:21-32,60-61`）。
- 拍板：replay 落视频元数据旁件 → 装配器 `assembleReportModel` 吃可选入参、直填 `step.attachments{video,videoAt}` 与 `defectTicket.videoAt`。用的正是 schema 预留位，渲染器与 `renderJson` 机读旁车零动；不照抄 report-diagnostics 路 B（那是 schema 无位时的绕行，此处有位）。

## D3 报告呈现（Steven 拍板：升级 `<video>` 可播）

- 事实：现渲染器只把 `at.video` 显示成 `<code>` 路径文本（`lib/report.mjs:132-137`）；`prd-p7-report` observability 本就写「录屏内联可播（tier-2 目检）」；p7 冻结 golden 的自包含不变量只拦 `http(s)://` 外链与外部 script/link（`tests/_golden/p7-report.golden.mjs:52-57`），相对 `src` 合法。
- 拍板：`attachments.video` 有值时渲染 `<video controls>`（相对路径 `src`）+ 保留路径文本；绝不 base64 内嵌（HTML 膨胀数十 MB，且长 base64 会随机撞凭据门关键词）。报告单独拷走则视频不随行，接受（自包含指零外链，非零外部文件）。

## D4 `casey run` 编排器缺省（Steven 拍板：缺省开启录像，`--no-video` 可关）

- 事实：本契约本意即补「真机 run 完报告无视频」缺口；webm 数 MB 级、落 gitignored `runs/`（`.gitignore:33`）。
- 拍板：`casey run` 缺省向 replay 传录像旗标（视频落 runDir），`--no-video` 显式关闭；replay 单跑侧维持 opt-in（见 M3），缺省零行为差。

## 机械决策（可否决，Steven 未否决即生效）

- M1 格式 webm 直出零新依赖：Playwright 自带 ffmpeg 录 webm（`package.json:19-22`）；mp4 转码（`ffmpeg-static`）挂账后续加法。schema 的「录屏路径（mp4）」是描述文字、类型 `string|null`，webm 相对路径结构合法，冻结 schema 零动。
- M2 视频模型 = case 级单录屏：一份 `video.webm` + 每步 `attachments.videoAt` 毫秒偏移（起录时刻 best-effort 记账，取不到为 `null`）；每步 `attachments.video` 填同一相对路径；`defectTicket.videoAt` 取首个败步偏移。不做每步切片（需 ffmpeg，违 M1；fixture 里 `step/atstep_N.mp4` 形态是移植遗形，不取）。
- M3 replay 侧旗标 `--video-dir <dir>`：opt-in、缺省行为一字不变（锁 `replay-login-bootstrap` C1 同款零差异断言方向）；视频元数据旁件 `video.json`（相对文件名/起录时刻/每步偏移，纯文本）与 axes 同刻过凭据门写出，照 `--run-history` 式样（`bin/replay.mjs:34-36,468-493`）。
- M4 视频文件语义名 `video.webm`：context 关闭后由 Playwright 随机 hash 名收敛改名（`saveAs` 或 rename），文件名避凭据关键词；`video.json` 只载相对文件名、零 `://`。
- M5 异常路径尽力收口 + 缺席容忍：看门狗（`bin/replay.mjs:119`）与 `main().catch`（`:500`）两分支补尽力 `browser.close()`（带超时兜底）再退；任何路径视频缺席时 `attachments` 不产/`video.json` 不落，报告照出、裁定零影响（fail-safe：视频永远只是诊断附件）。
- M6 双 page 舞步只在 `--video-dir` 与 `--login-bootstrap` 同开时启用：CDP/forensics 绑定回放 page2（登录流量天然不进其 CDP session，`loginMark` 机制照旧、login-traffic-drop 不变量零弱化）；page2 登录后导航至 `startUrl` 再进事件循环。仅 `--video-dir`（无登录）时单 page 照旧、context 加 `recordVideo` 即可。
- M7 视频绝不进 verdict：护栏 #15/#17 同款——`verdict.mjs` 零感知视频；`renderJson` 机读旁车不投 `attachments`（守 report-diagnostics「json 恒零动」先例）。
- M8 prd 用 schemaVersion 1：不动 `expected.frozen` 旁车、不动任何冻结 schema。

## 冻结涟漪盘点（accept 红先行逐核）

- `tests/_golden/schemas/report-model.schema.json` 与 `report-model.fixture.json`：零动（预留位已冻、fixture 本就带 `attachments` 先例）。
- `tests/_golden/p7-report.golden.mjs`：渲染器升 `<video>` 后逐核其结构不变量（其吃的 fixture 带 `attachments.video`，`<video>` 标签会出现在其渲染产物里）；若有断言被碰红，属评审级涟漪——重钉 golden + `prd-p7-report` testChecksums 重签 + gate 复验，accept 期先盘。
- `tests/_golden/replay-login-bootstrap.golden.mjs`：C1 零行为差断言应原样绿（新旗标缺省不启用）；回归锁进本契约 prd。
- `tests/_golden/layer3-wiring.golden.mjs`：禁键扫描不含 `video`，装配器新增可选键不触；回归锁进本契约 prd。
- `tests/_golden/report-diagnostics.golden.mjs`：U1 单参零差异断言零动（本契约不改 `renderReport` 参数形状，attachments 走 model 本体）。
- `bin/casey.mjs run` 缺省开录像：逐核有无既有 golden 跑全管线 `casey run`（侦察未见，accept 期 grep 定案）；若有，其产物形状变化须钉进对应回归。
