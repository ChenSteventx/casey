# Casey 安装与安装成功检验

本页面向从公开源码仓库安装的操作员。安装检验只检查本机运行时、浏览器和 `CLI` / `MCP` / `skill` 三面，不启动、连接或回放任何假被测系统，也不把“安装通过”冒充“真实环境可用”。

## 支持矩阵

| 环境 | 安装与本机检验 | 真实环境回放 | 当前限制 |
|---|---|---|---|
| Windows 11 + `WSL2` | 支持，所有 Casey 命令在 `WSL` 内执行 | Heren 中台的已验证路径 | Windows 只承担真站网络侧转发；不要在 Windows 原生终端跑回放 |
| Linux | 支持 | 具备组织内回环代理时可接真实 web 目标 | 本仓没有通用 Linux 真站代理安装器；未在公开环境完成真机验收 |
| macOS | 支持源码安装与静态检验 | 具备组织内回环代理时才可接真实 web 目标 | 当前没有 macOS 真机验收证据 |
| Windows 原生（无 `WSL2`） | 不作为正式支持路径 | 不支持 | 当前回放、浏览器和反向代理约束均以 `WSL` 侧为准 |

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

## 第二级：真实环境就绪

先准备带外交付、已被 `.gitignore` 排除的两类本地文件：

- `.auth/credentials.json`，形状为 `{ "user": "<账号>", "pass": "<口令>" }`；
- `site.json`，至少含 `target.startUrl` 与 `target.devProxyUrl` 两个键。

真值不得提交、复制进报告或写进命令行。`--sut` 只使用 `site.json` 中的回环代理基址。

然后运行：

```bash
node bin/casey.mjs doctor
```

`doctor` 的退出码只代表 Node.js、Playwright 和 Chromium 的本机就绪项；凭据、站点与隧道仍要逐行确认，不能只看 exit 0。Windows + `WSL2` 的正式路径还必须按顺序启动：

1. `WSL` 侧 `node scripts/wsl-reverse-listen.mjs`；
2. Windows 侧 `scripts/win-forward-start.cmd`。

真实环境可用的最终证据必须同时包含：Windows 到真站的 HTTP 成功、`WSL` 回环到真站的 HTTP 成功，以及一次真实回放产生的确定性裁定、录屏和独立单用例 HTML。只看到本地端口在监听，不算真实连通。

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

仓库同时是一个 Codex plugin：`.codex-plugin/plugin.json` 把同一份 Casey skill 与 `.mcp.json` 暴露给 Codex。插件安装只解决入口发现，不会替用户生成凭据、真实目标代理或签署测试契约。

## 开发者附加依赖

操作员执行回放不需要修改 loop 工具。要参与 Casey 源码开发，当前还需要与 Casey 同层的独立 `loop-kit` 仓库，或显式设置 `LOOP_KIT_PKG`。`loop-kit` 不随本仓源码内置；若未取得匹配版本，`gate`、`contract`、`lint` 等开发命令不可用，但不影响安装检验和已签用例的操作员回放路径。
