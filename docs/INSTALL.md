# Casey 安装与安装成功检验

本页面向从公开源码仓库安装的操作员。安装检验只检查本机运行时、浏览器和 `CLI` / `MCP` / `skill` 三面，不启动、连接或回放任何假被测系统，也不把“安装通过”冒充“真实环境可用”。

推荐先进入 [`../onboarding/`](../onboarding/README.md)，按实际 OS 选择 Codex、Claude Code 或通用 agent 提示词，让 agent 自动完成环境、本体、入口与 MCP 配置；各 OS 人读说明的后半部才是人工安装与操作兜底。本页保留完整的共同事实与验收边界。

## 支持矩阵

| 环境 | 安装与本机检验 | 真实环境回放 | 当前限制 |
|---|---|---|---|
| Windows 11 原生 `PowerShell` | 以系统自带 Windows PowerShell 5.1 为基线；PowerShell 7 仅可选；不使用 Docker Desktop | 代码与零 SUT 操作面已验；真实回放待完整现场 UAT | `LOCAL_PROXY_READY` 不等于真站可达；未有真实 HTTP + 报告证据前保持 `route:human` |
| Windows 11 + `WSL2` | 支持，Casey 命令在 `WSL` 内执行 | AI 中台已有完整真实 UAT 的路径 | Windows 承担真站网络侧转发，Node.js / Chromium / `MCP` 留在 `WSL` |
| Linux | 支持 | 具备组织内回环代理时可接真实 web 目标 | 本仓没有通用 Linux 真站代理安装器；未在公开环境完成真机验收 |
| macOS | 支持源码安装与静态检验 | 具备组织内回环代理时才可接真实 web 目标 | 当前没有 macOS 真机验收证据 |

医生站和 Hi 小助若运行在 `CEF` 中，可走独立的 CDP 示教与机械回放入口；这条能力目前只有代码与零 SUT 静态验收，尚无真实医生站 / Hi 小助现场证据。若目标是普通 web，可走 Chromium 通道；若是原生控件或多窗口混合容器，当前版本不支持。不能因为 Casey 本机安装通过就声称这些目标已经真机可用。

## 共同前置

- 64 位 Git。
- Node.js 22.12 或更新版本。
- 可访问 npm 与 Playwright 浏览器下载源的网络。
- 中文字体；缺字体时页面仍可能被定位，但截图和录屏可能无法阅读。

源码使用方式是仓内运行，不要求全局安装：

```bash
git clone https://github.com/ChenSteventx/casey.git casey
cd casey
npm install
```

### Windows 11 原生 `PowerShell`

前置为 64 位 Windows、64 位 Git、Node.js ≥ 22.12，以及可访问 npm 与 Playwright 浏览器下载源的网络。使用系统自带 Windows PowerShell 5.1 即可；已经安装的 PowerShell 7 也可运行，但不是前置条件：

```powershell
git clone https://github.com/ChenSteventx/casey.git casey
Set-Location .\casey
& .\scripts\install.ps1
```

安装器使用 `npm.cmd` / `npx.cmd`，避免 PowerShell 执行策略误命中同名 `.ps1` shim；它安装依赖和 Windows Chromium，再运行零 SUT 检验。已安装环境只做复核时可用：

```powershell
& .\scripts\install.ps1 -VerifyOnly
```

全部 PASS 只表示 Windows 本机执行面安装完成，末行仍必须是 `REAL_SUT NOT_VERIFIED`。脚本不创建账户、不生成 `site.json`、不探测真站。若组织执行策略阻止本地脚本，应使用组织批准的签名或策略流程，不要改用 `Invoke-Expression`。

### Windows 11 + `WSL2`

先在 Windows 启用 `WSL2` 并安装一个受支持的 Linux 发行版，然后在 `WSL` 终端完成上面的 clone 和依赖安装。浏览器与 Linux 系统依赖也在 `WSL` 侧安装：

```bash
npx playwright install --with-deps chromium
```

中文字体要装在 `WSL` 的 Linux 字体库，而不是只依赖 Windows 字体。安装后用 `fc-list :lang=zh` 检查。

### Linux

在 Linux 终端完成 clone 和依赖安装，再安装浏览器与系统依赖：

```bash
npx playwright install --with-deps chromium
```

用 `fc-list :lang=zh` 检查中文字体；没有结果时安装 Noto Sans CJK 后重新检查。

### macOS

在 Terminal 完成 clone 和依赖安装，然后执行：

```bash
npx playwright install chromium
```

Casey 会检查系统的 PingFang 等中文字体。源码能安装不等于 macOS 已具备真实目标代理；没有回环代理与真实 HTTP 证据时，只能认定本机安装完成。

## 第一级：安装成功

运行无被测系统安装检验：

```bash
npm run verify:install
```

它只做以下检查：

- Node.js 版本与 package 版本锁；
- `@playwright/test` 可加载且 Chromium 二进制在位；
- `CLI` / `MCP` / `skill` 文件在位；
- `CLI` 帮助与 Claude Code / Codex 的 `MCP` 配置生成器能执行；
- 中文字体可用于截图和录屏。

全部显示 `PASS` 且进程退出码为 0，才可说“Casey 已安装”。末行始终标记 `REAL_SUT NOT_VERIFIED`，因为该命令故意不接任何被测系统。

Windows 原生操作员后续统一使用 `scripts/casey.ps1`；其中 `verify` 等价于本机零 SUT 安装检验：

```powershell
& .\scripts\casey.ps1 verify
```

## 第二级：真实环境就绪

先准备带外交付、已被 `.gitignore` 排除的两类本地文件：

- `.auth/credentials.json`，形状为 `{ "user": "<账号>", "pass": "<口令>" }`；
- `site.json`，至少含 `target.startUrl` 与 `target.devProxyUrl` 两个键。

真值不得提交、复制进报告或写进命令行。`--sut` 只使用 `site.json` 中的回环代理基址。

Windows 原生由 `PowerShell` 操作面安全配置账户。两条配置动作都启动隐藏输入，不接受账户值参数，也不要求管理员；仓库和 `.auth/` 必须位于当前用户拥有的本地目录：

```powershell
& .\scripts\casey.ps1 account-ai
& .\scripts\casey.ps1 account-doctor-hi
& .\scripts\casey.ps1 account-status
```

不要把账户或口令作为命令参数、普通聊天文本或 PowerShell 历史内容。AI 中台账户写入 `.auth/credentials.json` 并由登录预备动作读取；Windows 原生写入同时收紧 ACL。若 ACL 收紧失败，应把仓库移出 `Program Files`、共享盘或公共同步目录，不得通过管理员提权接管。医生站 / Hi 小助动作仍只保存安全账户引用与人工就绪声明，自动登录固定为未验证。

Windows 原生 web 回环代理由同一个脚本管理：

```powershell
& .\scripts\casey.ps1 proxy-start
& .\scripts\casey.ps1 proxy-status
```

状态 `LOCAL_PROXY_READY` 只证明两个身份绑定的本地进程存活且端口仅在回环监听。目标只从 `site.json` 读，不进参数、状态或日志；真实 HTTP 仍须单独取证。重复 start 会 fail-closed，stop 只收口状态中身份匹配的 Casey 进程。

代理启动后运行真实环境严格诊断：

```powershell
& .\scripts\casey.ps1 doctor
```

缺账户、完整 `site.json`、安全账户 ACL 或回环监听时退出非零。即使全部前置到位，摘要仍是 `REAL_SUT_HTTP_NOT_VERIFIED`：本命令不发送真站 HTTP，不能据此开始宣称真机可用。

完成真实 HTTP 取证和本次测试后收口代理：

```powershell
& .\scripts\casey.ps1 proxy-stop
```

`WSL2` / Linux / macOS 继续运行：

```bash
node bin/casey.mjs doctor
```

这些运行面上，`doctor` 的退出码只代表 Node.js、Playwright 和 Chromium 的本机就绪项；凭据、站点与隧道仍要逐行确认，不能只看 exit 0。Windows + `WSL2` 路径还必须按顺序启动：

1. `WSL` 侧 `node scripts/wsl-reverse-listen.mjs`；
2. Windows 侧 `scripts/win-forward-start.cmd`。

Windows 原生的网络证据是 Windows 网络侧到真站成功、同一 Windows 运行面经 `target.devProxyUrl` 到真站成功；`WSL2` 路径则是 Windows 网络侧成功、`WSL` 经回环到真站成功。最终还必须有一次真实回放产生的确定性裁定、同次录屏、视觉复核和独立单用例 HTML。只看到本地端口在监听，不算真实连通。

## `skill` 与 `MCP` 安装

Claude Code 打开仓根后会读取 `.claude/skills/casey/SKILL.md`。用户直接说“把这段中台用例跑一遍，给我独立 HTML 报告”即可，不需要手写底层参数。

Claude Code 的 `MCP` 配置由仓内路径自适应生成：

```bash
node bin/casey.mjs mcp-config --agent claude
```

Codex 的配置同理：

```bash
node bin/casey.mjs mcp-config --agent codex
```

在 Windows + `WSL2` 组合中，必须从 `WSL` 侧生成并挂载；否则配置会指向错误运行面。

Windows 原生必须从 Windows `PowerShell` 生成，让配置绑定实际使用的 Windows `node.exe`：

```powershell
& .\scripts\casey.ps1 mcp-config -Agent claude
& .\scripts\casey.ps1 mcp-config -Agent codex
```

两种路径都遵守“在哪一侧运行 Casey，就在哪一侧生成并挂载”；不要混用 Windows 与 `WSL` 的脚本路径或浏览器缓存。

仓库同时是一个 Codex plugin：`.codex-plugin/plugin.json` 把同一份 Casey skill 与 `.mcp.json` 暴露给 Codex。插件安装只解决入口发现，不会替用户生成凭据、真实目标代理或签署测试契约。

## 四 OS 账户安全边界

| OS | 推荐存放位置与权限 | 当前能力边界 |
|---|---|---|
| `WSL2` | 优先把仓库和 `.auth/` 放在 WSL 原生 Linux 文件系统；Casey 尽力设置目录 `0700`、文件 `0600`。挂载 Windows 盘时 POSIX mode 可能不等于真实 ACL，不能只看 mode 判断安全。 | AI 中台正式回放路径；账户文件由 WSL 侧 `login-bootstrap` 消费。医生站 / Hi 小助仍由 Windows 桌面人工建立安全会话。 |
| Linux | `.auth/` 留在当前仓库且 gitignored；Casey 尽力设置目录 `0700`、文件 `0600`，账户文件不要放共享目录。 | 可接组织内真实代理；未有真实目标证据时只算本地账户配置完成。 |
| macOS | `.auth/` 留在当前仓库且 gitignored；Casey 尽力设置目录 `0700`、文件 `0600`。当前未集成 Keychain。 | 只证明本机文件配置；没有回环代理和真机证据时不能声称可回放。 |
| Windows 原生 | PowerShell 账户动作写入后收紧 `.auth/` 与账户文件 ACL，并由严格 `doctor` 检查；仓库仍不要放多人可写共享目录。 | AI 中台登录预备动作已接线，但 Windows 原生真实登录与回放须现场 UAT；医生站 / Hi 小助仍不自动登录。 |

推荐从 skill 发起“配置账户”和“检查账户状态”。配置命令默认隐藏输入，非交互只从 stdin 或环境导入；账户值永远不能放 argv。`account status` 和 `doctor` 只看形状与就绪状态，不回显账户值或路径。

## 开发者附加依赖

操作员执行回放不需要修改 loop 工具。要参与 Casey 源码开发，当前还需要与 Casey 同层的独立 `loop-kit` 仓库，或显式设置 `LOOP_KIT_PKG`。`loop-kit` 不随本仓源码内置；若未取得匹配版本，`gate`、`contract`、`lint` 等开发命令不可用，但不影响安装检验和已签用例的操作员回放路径。
