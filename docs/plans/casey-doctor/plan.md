# casey-doctor — `casey doctor` 跨平台就绪自检（full）

> 起草态（零-baton）：本文只落计划骨架，未 `contract init`、未 gate、未提交。实现者继承时先 `casey contract init casey-doctor --lane full --reason "..."`。
> 解易用性审计 C5（摩擦点 F13/F14，分发/跨平台）。决策见 `docs/plans/casey-doctor/proposed/GRILL.md`（D1–D10），红金牌断言清单见 `docs/plans/casey-doctor/proposed/GOLDEN-TESTPLAN.md`。

## 背景

新同事上手没有一发入魂的「我齐了吗」（审计 F13）：`selftest --tier1` 自证「不验浏览器/凭据/隧道」，`README.md` 三级验收全靠人抄命令；文档通篇假设 `WSL` + Windows 隧道，纯 linux/macos 原生用户无成文就绪路径、`fc-list` 只对 linux（审计 F14）。`casey doctor` = 一条命令逐项查 node/playwright/中文字体/凭据·site.json 在位/隧道端口，逐项 `ok`/`warn`/`fail`/`route-human` 带 OS 分支修复建议，**绝不回显凭据值与真目标地址**。

## 0. 涟漪勘定与重签（先勘后动）

- **新文件无冻结涟漪**：`lib/doctor.mjs` + `bin/doctor.mjs` 全新，不碰任何冻结 schema、不改 `lib/cred-gate.mjs`/`lib/paths.mjs`/`lib/login-bootstrap.mjs` 本体（只 `import` 复用其现成导出）。
- **关键跨契约涟漪 —— `doctor` 须进 `cli-mcp-face` 的 `EXCLUDED`**（GRILL D9）：`doctor` 是自检类命令、不进 `MCP` 面（同 `selftest`/`breaker`/`contract`/`heal`）。若 `mcp-parity` 契约（`docs/plans/mcp-parity/`）的「`CLI` 命令集 − `EXCLUDED` ⊆ `MCP` 工具集」覆盖断言已落地，新加 `case 'doctor':` 而不把 `doctor` 加进 `EXCLUDED`，`cli-mcp-face.golden.mjs` 会红（fail-closed 正确）。实现时须：`EXCLUDED` 加 `doctor`；不新增 `casey_doctor` 工具；若因此改了 `cli-mcp-face.golden.mjs`，重签 `loop/prd-cli-mcp-face.json` 的 `testChecksums`（属加严、护栏 #1 合法）。两契约落地先后任意，此处显式挂钩。
- **无 prd 重签涟漪**（除上一条按需触发外）。
- **无新造词**：写入前 `term-lint`；英文走代码体、加粗只给中文（ADR-0004）。

## 1. 改动清单

1. `lib/doctor.mjs`（新，纯函数层，GRILL D7）
   - 每检查项一个纯函数：`checkNode({nodeVersion,requiredRange})` / `checkPlaywrightPresent({present})` / `checkPlaywrightImportable({importable})` / `checkChromium({execResolved,execExists})` / `checkFonts({platform,isWSL,cjkProbeNonEmpty})` / `checkSiteJson({present,shapeOk})` / `checkCreds({present,shapeOk})` / `checkTunnel({proxyPort,portListening,probeMs})`。各出 `{id,status,detail,hint}`，`status ∈ {ok,warn,fail,route-human}`。
   - `runDoctor(env)` 聚合逐项 + 按 D3 算 `exitCode`（就绪级第 1–4 项任一 `fail` → 1，否则 0；`warn`/`route-human` 不翻）。
   - 零 `fs`/零 `spawn`/零 `os`/零 `process.*`——全靠注入的 `env`。要求范围 `requiredRange` 由采集壳从 `package.json.engines.node` 传入（纯层只做 semver 比较，手写解析、无第三方 dep）。
2. `bin/doctor.mjs`（新，采集壳，GRILL D7）
   - 探真环境装 `env`：`process.platform` + `isWSL`（读 `/proc/version` 含 `microsoft` 或 `WSL_DISTRO_NAME` env）；`process.version` + 读 `package.json.engines.node`；`hasPlaywright()`（`lib/paths.mjs`）+ try `import('@playwright/test')`（镜像 `bin/replay.mjs:19`）+ `chromium.executablePath()` → `existsSync`；字体（linux/`WSL` 跑 `fc-list :lang=zh`、macos 查 `/System/Library/Fonts` CJK、win 查 `%WINDIR%\Fonts`，GRILL D4）；`site.json`/`.auth` 只 `existsSync` + `JSON.parse` + 顶层键名在（复用 `AT_SITE_JSON`/`AT_CREDS_FILE` 路径解析、绝不读值，GRILL D5）；隧道只从 `devProxyUrl` 取回环端口做 TCP 连（绝不碰 `target.startUrl`，GRILL D6）。
   - 喂纯层 → 渲染逐项行（沿 `selftestTier1` 的 `ok`/`RED` 配色，加 `warn` 黄 / `route-human` 灰）→ `process.exit(runDoctor(env).exitCode)`。
   - 全输出零凭据值零目标地址（D6）；成功回显不含用户绝对路径（output-seal 纪律）。
3. `bin/casey.mjs`（门面接线 + help，GRILL D8）
   - `main()` switch 加 `case 'doctor': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'doctor.mjs'), rest); process.exit(r.code); }`。
   - help「自检」节加 `casey doctor` 一行（`selftest --tier1` 下）。
4. `tests/_golden/doctor.golden.mjs`（新，红先行，断言清单见 GOLDEN-TESTPLAN）
   - 主体：纯层注入假 `env` 逐项翻红绿 + 验退出码 + 验 OS 分支文案；壳侧：hermetic 冒烟（真跑 `casey doctor`，验结构与零泄漏，不苛求绿）。
5. `loop/prd-casey-doctor.json`（新，acceptance 门）
   - 冻结 `doctor.golden.mjs` 的 sha256 进 `testChecksums`；`stories` 的 acceptance 挂金牌与 `selftest --tier1` 回归。
6. `README.md`（文档，审计 C5）
   - 环境验收节加「`casey doctor` 一键就绪自检」一行。纯文档、无目标地址/凭据值。
7. 若触发跨契约涟漪：`tests/_golden/cli-mcp-face.golden.mjs` 的 `EXCLUDED` 加 `doctor` + 重签 `loop/prd-cli-mcp-face.json`（见 §0）。

## 2. 实现次序（红先行）

1. `contract init casey-doctor --lane full`。
2. 先写金牌 `doctor.golden.mjs`：注入假 `env` 断言全就绪 exit 0 / 缺 playwright·chromium·node 各翻 `fail` / 字体缺 `warn` 不翻 exit / 凭据缺 `warn` / OS 分支文案正确 / 隧道 `route-human` / 输出零哨兵密文零 `://`。跑一遍验**红基线**（`lib/doctor.mjs` 未建，`import` 即失败——纯红）。
3. 实现 `lib/doctor.mjs` 纯层 → 金牌纯层断言转绿。
4. 实现 `bin/doctor.mjs` 采集壳 → 金牌壳侧 hermetic 冒烟转绿。
5. 门面接线 `bin/casey.mjs`（case + help）；补 `README.md`。
6. 处理跨契约涟漪（`doctor` 进 `EXCLUDED`，见 §0）；涟漪回归 + `contract advance` + gate。

## 3. 验收（红金牌，断言清单见 GOLDEN-TESTPLAN）

- **全就绪 exit 0 逐项 ok**：注入 node/playwright/chromium/字体/凭据/隧道全就绪 → `runDoctor().exitCode===0`，每项 `status==='ok'`。
- **缺 `@playwright/test` 报红带建议非崩**：注入 `present:false` → 该项 `fail` + `hint` 非空（指 `npm install`）+ 纯层不 `throw`；`exitCode===1`。chromium 缺、node 版本过低同理各自翻 `fail` 带 `hint`。
- **中文字体缺 → `warn` 不翻 exit**：字体探针空 → 该项 `warn`；就绪级全 ok 时 `exitCode` 仍 `0`。
- **OS 分支建议正确**：注入 `platform=linux/darwin/win32` + `isWSL` → 各出对应字体 `hint`（linux/`WSL`→`fc-list`/Noto、macos→PingFang、win→雅黑）与路径分隔符。
- **凭据/site.json 缺失报清晰指引**：注入 `present:false` → `warn` + `hint` 指 `README.md` 凭据节；绝不因缺真机件翻 `exitCode` 非零。
- **输出零敏感值零真目标地址**：采集壳经 `AT_SITE_JSON`/`AT_CREDS_FILE` 指到含哨兵密文的临时夹具，跑 `casey doctor`，断言 `stdout` 零哨兵字面量、零裸 `://`、零凭据关键词、零用户绝对路径。
- **隧道项标 `route:human` 不阻塞主判**：`portListening` 任意 → `status==='route-human'`、不进就绪级、`exitCode` 不受其影响；输出不含 `target.startUrl`。
- **涟漪回归**：`selftest --tier1` 无回归；`README.md` 过 `term-lint`（写入即扫）；若碰 `cli-mcp-face.golden.mjs` 则其金牌全绿（`doctor` 已进 `EXCLUDED`、无 `casey_doctor` 工具缺失误报）。
- **门禁**：`node loop-kit/bin/gate.mjs --prd loop/prd-casey-doctor.json` 全 acceptance exit 0。

## 4. route:human 尾巴（非阻断，非本契约 hermetic 验收）

- **隧道 green 端到端**：doctor 报「隧道端口在听」是 hermetic 可探的；但「经隧道端到端到真站通」须拉真反向隧道（`scripts/wsl-reverse-listen.mjs` + `scripts/win-forward-start.cmd`）+ Steven 在场，是 `route:human` 尾巴（审计 R1/R3 家族）。命令本体与红路径（端口不在听）hermetic 可测。
- **各 OS 真机上手核验**：doctor 在真 macos/原生 win/纯 linux 上的字体探测与建议文案实机走一遍，route:human（审计 F14 尾巴）。

## 5. 非目标（本契约不做）

- 不自动修（不 `npm install`/不装字体/不 `npx playwright install`/不拉隧道）——只报状态 + 建议（GRILL D10）。
- 不动真机（隧道 green 验证 route:human）。
- 不读凭据/`site.json` 内容、不回显目标地址（GRILL D5/D6）。
- 不接进 gate/阶段互锁/hook（非门禁，非零不阻塞，GRILL D3）。
- 不替代 `selftest --tier1`（验环境就绪 vs 验确定性链路，互补）。
- 不做 `mcp-config` 挂载打印（审计 C6 另案）、不做分家接入/跨平台上手文档（审计 C7 另案）。
