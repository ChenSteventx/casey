# casey-doctor — grill 决策记录（`casey doctor` 跨平台就绪自检，full）

> 起草态（零-baton）：本文只落决策，未 `contract init`、未改 `lib`/`bin`/`web`/`mcp`、未 gate、未提交。授权链待 Steven grill 签核。
> 事实源：易用性审计 `docs/plans/usability-audit/proposed/AUDIT-PLAN.md` 的 C5（摩擦点 F13/F14，分发/跨平台）；范式借鉴 `bin/casey.mjs` 的 `selftestTier1`（逐项 `ok`/`RED` + 退出码）；凭据边界依 `lib/cred-gate.mjs` 与护栏 #7。

## 背景

新同事上手 Casey 没有一发入魂的「我齐了吗」（审计 F13）：`README.md` 三级手动验收全靠人抄命令，`selftest --tier1` 自己都声明「不验浏览器/凭据/隧道」（`README.md:32`）。且文档通篇假设 `WSL` + Windows 隧道，纯 linux/macos 原生用户没有成文就绪路径、字体检查命令 `fc-list` 只对 linux（审计 F14）。目标：一条 `casey doctor` 逐项查 node/playwright/中文字体/凭据文件/隧道等运行前置，逐项报 `ok`/缺失/修复建议，按 OS 分支给建议，**绝不回显任何凭据值与真目标地址**。

与 `selftest --tier1` 分工互补：tier1 面向**确定性内核链路**（hermetic、假 `SUT`、零外部依赖）；doctor 面向**环境就绪面**（真 node/真 playwright/真字体/真凭据文件在位）。doctor 借用 tier1 的 `step()` 逐项结构，但探的是环境不是链路。

## D1 车道：full

- 定夺：full（与审计 C5 一致）。三条判据全中：① 新命令、多 OS 分支（win/wsl/linux/macos 各走各法）；② 碰凭据·目标地址回显边界——doctor 要查 `site.json`/`.auth` 在位、要探隧道端口，稍不慎就把 `target.startUrl` 或凭据值漏进输出，是护栏 #7 的高危面，值一道 full 的红先行金牌把「零泄漏」钉死；③ 退出码语义是就绪判据、须金牌固定。
- 不选 light：它不止「加一道 fail-closed 分支」，而是新开一个跨 OS 探测面 + 凭据回显边界，够 full。
- 实现者动 `lib`/`bin`/`tests/_golden` 前须先 `casey contract init casey-doctor --lane full`；本起草文档只读+写自身，未 `contract init`。

## D2 检查项清单与分级

八项，分三级（分级决定退出码，见 D3）。每项 `id` 稳定、供金牌逐项翻红绿。

**就绪级（blocking，驱动退出码）**——真正决定「能不能 hermetic 跑出报告」：

1. `node` 版本 ≥ 要求：要求范围从 `package.json` 的 `engines.node` **单源读**（当前 `>=22.12`），不写死字面量。缺/过低 → `fail`，`hint` 报当前版本与要求范围（版本号非敏感）。
2. `@playwright/test` 已装：`lib/paths.mjs` 的 `hasPlaywright()`（`node_modules/@playwright/test/cli.js` 在位）。缺 → `fail`，`hint`=「跑 `npm install`」。
3. `@playwright/test` 可 `import`：装了不等于能加载——镜像 `bin/replay.mjs:19` 的 `import pw from '@playwright/test'`，采集壳真 `import()` 一次（try/catch 转布尔喂纯层）。加载失败（版本错位/装坏）→ `fail`，`hint`=「重装依赖」。区别于第 2 项「文件在位」，第 3 项证「真能用」。
4. `chromium` 浏览器在位：`import` 成功后 `chromium.executablePath()` 取路径 → `fs.existsSync`。缺 → `fail`，`hint`=「跑 `npx playwright install chromium`」。回放/编译执行段硬依赖真浏览器（`README.md:24`）。

**建议级（advisory，`warn`，不驱动退出码）**——缺了不挡 hermetic 就绪、只降质量或只真机才需：

5. 中文字体（按 OS 分支，见 D4）：缺 → `warn`（不 `fail`）。理由：字体缺只令截图/录屏中文空白，DOM/定位/断言不受影响（`docs/HANDOFF.md` 实锤「headless 无字形可画，DOM/定位/断言不受影响」）——是报告可读性问题、非裁定正确性问题。
6. `site.json` 在位 + 形态（只查存在性/浅形态，绝不读值，见 D5）：缺 → `warn`，`hint` 指 `README.md` 凭据节。理由：`site.json` 只真机 tier-2 才需，hermetic 用户合法地没有它。
7. `.auth` 凭据在位 + 形态（同 D5）：缺 → `warn`。同理只真机需要；`AT_CREDS_USER`/`AT_CREDS_PASS` env 在场亦视同在位。

**route:human 级**——green 路径 hermetic 验不了：

8. 隧道就绪：只探 `site.json.target.devProxyUrl` 的**回环端口**（形如 `127.0.0.1:15519`，回环基址非敏感，`README.md:49` 已定性）在不在听 + 耗时，镜像 `scripts/win-probe-target.mjs` 只回状态码先例。`status = route-human`：端口在听只证「本地隧道监听器起了」，「端到端经隧道到真站通」须真隧道 + Steven 在场（审计 R1/R3 家族），是本命令的 route:human 尾巴，**不进退出码**。探针绝不碰 `target.startUrl`。

## D3 退出码语义：就绪级驱动，建议/`route:human` 级不阻塞

- 逐项四态：`ok` / `warn` / `fail` / `route-human`。
- **退出码**：`0` 当且仅当就绪级（D2 第 1–4 项）全 `ok`；任一就绪级 `fail` → `1`。`warn` 与 `route-human` 逐行列出带 `hint`，但**绝不翻退出码**。
- 「不阻塞」的两层意思：① doctor 绝不接进阶段互锁/gate/hook——非零退出纯信息、不挡任何下游动作；② 建议级/`route:human` 级缺失不把退出码翻红，故一台装齐 node+playwright+chromium 但没真机凭据/隧道的 hermetic 开发机能拿到 exit 0、逐项就绪级 `ok`。
- 为何建议级不驱动退出码（**推荐默认，grill 可翻**）：doctor 的 exit 0 承诺 =「hermetic 回放就绪」。真机凭据/隧道天然 route:human、字体缺只降截图可读性——拿这些去惩罚一台合法的纯 hermetic 装机、逼它永远 exit 1，既不准确也让人学会无视退出码（信号自毁，护栏 #14 精神）。审计「缺项非零并列清单」的要求在**就绪级**面足额兑现。
- 待 grill 的岔（记开放项）：是否要一个 `--strict` 模式让 `warn` 也翻 exit 1（给「必须连真机」的场景）。默认不做，避免过度设计；若 Steven 要，作为纯加法旗标另议。

## D4 中文字体按 OS 分支

分支键 = `process.platform`（`linux`/`darwin`/`win32`）+ `isWSL` 探测（读 `/proc/version` 含 `microsoft`，或 `WSL_DISTRO_NAME` env 在场）。纯层收「已解析的字体探针布尔 + 平台」，分支只决定**探法与建议文案**：

- linux / `WSL`：`fc-list :lang=zh` 输出非空即 `ok`。`WSL` 这条是关键坑——playwright 跑在 Linux 侧，所以要查的是 **Linux 侧**字体库（`fc-list`），不是 Windows 字体；`docs/HANDOFF.md` 实锤「录屏整片无中文=`WSL` 零中文字体」。缺 → `warn`，`hint`=「装用户级 Noto Sans CJK 后 `fc-list :lang=zh` 核实」。
- macos（`darwin`）：系统自带 PingFang SC，一般 `ok`。探法：查已知 CJK 字体文件在位（`/System/Library/Fonts` 下 PingFang/苹方），或 `fc-list`（若装了 fontconfig）。缺 → `warn`，`hint` 指系统字体册。
- win（`win32` 原生 node）：微软雅黑/宋体一般自带。探法：查 `%WINDIR%\Fonts`（`msyh`/`simsun`）。缺 → `warn`，`hint` 指 Windows 字体设置。路径分隔符按 OS（win 用 `\`，其余 `/`）。
- 分支的建议文案正确性进金牌（注入各 platform 断言出对应 `hint`，见 GOLDEN-TESTPLAN A9）。

## D5 凭据/`site.json` 只查存在性与形态，绝不读内容

- 三态：`在位` / `缺失` / `形态不符`。判法：`fs.existsSync` → `JSON.parse` 成功 → 顶层**键名**在（`site.json` 查 `target.startUrl`/`target.devProxyUrl` 键名；`credentials.json` 查 `user`/`pass` 键名）。**只看键名在不在、绝不把任何值取进变量或输出。**
- 路径解析复用 `lib/login-bootstrap.mjs` 既有范式（`AT_SITE_JSON` / `AT_CREDS_FILE` env 覆盖，`loadSiteConfig`/`loadCreds` 用的同一套解析），但**只复用路径解析、不复用其读值**——doctor 自己只做 `existsSync` + 浅键名检查。`AT_CREDS_USER`/`AT_CREDS_PASS` env 在场视同凭据在位（内存值，doctor 不读其值、只看 env 键存在）。
- 报「形态不符」时只报「顶层缺 `xxx` 键」这类**结构**信息，绝不回显任何字段值。

## D6 绝不回显敏感值与真目标地址（贯穿全命令）

- 隧道探针（D2 第 8 项）只从 `devProxyUrl` 取回环端口号做 TCP 连接，**绝不碰 `target.startUrl`**；输出只「端口在听/不在听 + 耗时」，镜像 `scripts/win-probe-target.mjs`（只回状态码、目标地址不回显）。
- doctor 全输出自证零泄漏（金牌背书）：注入含哨兵密文的假 `site.json`/`.auth`（经 `AT_SITE_JSON`/`AT_CREDS_FILE` 指到临时夹具），断言 `stdout` 零哨兵字面量、零裸 `://`（无 URL 形态的目标地址）、零凭据关键词。口径对齐 `lib/cred-gate.mjs` 的 `FORBIDDEN_KEYWORDS` 与 `collectSecretLiterals`。
- 成功回显不含用户绝对路径（output-seal 纪律）——只报定名产物与命令建议（如「跑 `npm install`」），不把 `/home/xxx/...` 或 `/mnt/d/...` 抛进输出。

## D7 纯函数层 / 采集壳 分离（可测性设计核心）

这是 full 车道 hermetic 可验的支点。把「判断逻辑」与「探真环境」彻底分离：

- `lib/doctor.mjs`（**纯函数层**，零 `fs`/零 `spawn`/零 `os`/零 `process.platform`——全靠注入）：
  - 每检查项一个纯函数，吃注入的 `env`（`platform`/`isWSL`/`nodeVersion`/`requiredRange`/各探针布尔与端口结果）→ 出 `{ id, status, detail, hint }`。
  - `runDoctor(env)` 聚合逐项 + 按 D3 算 `exitCode`。
  - 金牌构造假 `env` 就能逐项翻红绿、验退出码、验 OS 分支文案——**完全不碰真环境**。
- `bin/doctor.mjs`（**采集壳**，唯一碰真环境处）：探 `process.platform` + `isWSL`、读 `process.version` 与 `package.json.engines`、`hasPlaywright()` + 真 `import('@playwright/test')` + `chromium.executablePath()`、跑 `fc-list`/查字体目录、`existsSync` 凭据/site.json 浅形态、TCP 连隧道端口 → 把结果**装成 `env` 喂纯层** → 渲染逐项行 + `process.exit(runDoctor(env).exitCode)`。渲染沿用 `selftestTier1` 的 `ok`/`RED` 配色范式，另加 `warn`（黄）/`route-human`（灰）两态。

## D8 casey 门面接线 + help 行

- 分派：`bin/casey.mjs` 的 `main()` switch 加 `case 'doctor': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'doctor.mjs'), rest); process.exit(r.code); }`，沿 `ingest`/`compile`/`report` 直通先例。
- help：在「自检」节 `selftest --tier1` 行下加一行：`casey doctor  跨平台就绪自检（node/playwright/中文字体/凭据·隧道在位），逐项 ok/缺失+建议  [可用]`。与 selftest 并列——一个验内核链路、一个验环境就绪。

## D9 涟漪勘定

- **新文件无冻结涟漪**：`lib/doctor.mjs` + `bin/doctor.mjs` 全新，不碰任何冻结 schema、不改 `lib/cred-gate.mjs` 本体。
- **关键涟漪：`doctor` 须进 `cli-mcp-face` 的 `EXCLUDED` 白名单**。`doctor` 是自检类命令、非「测试消费者该驱动的能力」，同 `selftest`/`breaker`/`contract`/`help` 不进 `MCP` 面。`mcp-parity` 契约（`docs/plans/mcp-parity/`，尚在 proposed）拟加「`CLI` 命令集 − `EXCLUDED` ⊆ `MCP` 工具集」覆盖断言；**若该断言先落地**，新加 `case 'doctor':` 而不把 `doctor` 加进 `EXCLUDED`，会让 `cli-mcp-face` 金牌红（fail-closed 正确行为）。故本契约实现时须把 `doctor` 加进 `EXCLUDED = {help,breaker,contract,heal}` → `{help,breaker,contract,heal,doctor}`，并同步 `EXPECT_TOOL_NAMES`/覆盖断言不新增 `casey_doctor` 工具。两契约落地先后任意，交账在此显式挂钩。
- **`README.md` 环境验收节**（审计 C5 说动 `README`）：可在三级验收前或旁加一行「`casey doctor` 一键就绪自检」。纯文档，无目标地址/凭据值。
- **无 prd 重签涟漪**（除非 `mcp-parity` 已落地导致改 `cli-mcp-face.golden.mjs`——那时重签 `prd-cli-mcp-face.json` 的 `testChecksums`，属加 `doctor` 进 `EXCLUDED` 的合法加严）。
- **无新造词**：`就绪自检`/`跨平台` 是平白描述、`route:human`/`fail-safe`/`hermetic`/`通道剖面` 均已在 `CONTEXT.md` 登记；`doctor` 是命令名、非新术语。写入前跑 `term-lint`。

## D10 非目标（本契约不做）

- **不自动修**：只报状态 + 修复建议，绝不替用户 `npm install`/装字体/`npx playwright install`/拉隧道。doctor 是诊断器不是安装器。
- **不动真机**：隧道 green（端到端经隧道到真站）验证是 route:human 尾巴，命令本体与红路径 hermetic 可测。
- **不读凭据/`site.json` 内容、不回显目标地址**：只查在位与浅形态（D5/D6）。
- **不接进 gate/阶段互锁/hook**：非门禁，非零退出不阻塞任何下游（D3）。
- **不替代 `selftest --tier1`**：doctor 验环境就绪、tier1 验确定性链路，两者互补不重叠。
- **不做 `mcp-config` 挂载打印**（审计 C6 另案）、**不做分家接入/跨平台上手文档**（审计 C7 另案）——本契约只做 doctor 命令本体。
