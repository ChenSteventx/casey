# onboarding —— Casey 跨平台上手 + 分家接入 + 同事移交

本 runbook 覆盖三 agent 接入路径、四 `OS` 环境矩阵、同事移交清单。凭据只写字段形状占位，真值一律带外交付、绝不入库。分家 agent 的薄路由入口见仓根 `AGENTS.md`；安装真值见 `docs/INSTALL.md`，自然语言用法与能力边界见 `docs/USAGE.md`。

## 一、三 agent 接入路径

### claude code
- `skill` 自动加载：打开本仓即可用 `.claude/skills/casey/`，用户操作面只收自然语言。
- `MCP` 挂载：`casey mcp-config --agent claude` → 取 `.mcp.json` 片段，或一行 `claude mcp add casey -- node <绝对路径>`。

### codex
- 无 `skill` 自动加载机制，走仓根 `AGENTS.md` 上手。
- `MCP` 挂载：`casey mcp-config --agent codex` → 把 `[mcp_servers.casey]` 段追加进 `~/.codex/config.toml`。

### 其它支持 MCP 的 agent
- 当前配置生成器只正式支持 Claude Code 与 Codex。其它 agent 可参考 Codex 的 stdio 结构挂载，但必须在该 agent 的真实运行环境单独验证；未验证前不得声称已支持。

## 二、四 `OS` 环境矩阵

三件事逐 `OS` 就位：node 运行时、中文字体（截图 / 录屏中文不空白）、反向隧道适用性。

| `OS` | node | 中文字体 | 反向隧道 |
|---|---|---|---|
| `WSL`（Windows 内 Linux） | node ≥ 22.12（Linux 侧） | `fc-list :lang=zh` 核实；缺则装用户级 Noto Sans CJK | 需要（详见下方隧道适用性） |
| Windows 原生 | 不作为正式运行面 | 系统内置微软雅黑；但回放须走 `WSL` 侧（G6） | 只承担 Windows 网络侧转发 |
| Linux 原生 | node ≥ 22.12 | `fc-list :lang=zh` 核实；缺则装 Noto Sans CJK | 需组织内回环代理；仓库未提供通用直连安装器 |
| macOS | node ≥ 22.12 | 系统内置 PingFang（苹方）等 CJK 字体；必要时 Font Book 核实 | 需组织内回环代理；尚无真机验收证据 |

隧道适用性（关键）：仓库自带的反向隧道只服务 `WSL` + Windows 组合，把 `WSL` 内回环端口反射到 Windows 侧真机可达网络。Linux / macOS 不使用这组 Windows 脚本，但仍须由部署方提供本地回环代理；`--sut` 只喂该回环基址，真目标地址绝不进命令行（护栏 #7）。真机命令一律 `WSL` 侧跑（G6：Windows 原生侧回放必败——Playwright 浏览器装在 Linux 侧）。

字体一句话：`WSL` / Linux 用 `fc-list :lang=zh` 查、缺则装 Noto Sans CJK；macOS 用内置 PingFang（苹方）；Windows 用内置微软雅黑（但回放在 `WSL` 侧、查 `WSL` 侧字体库）。

安装检验：`npm run verify:install` 不连接任何被测系统，全部 PASS 才代表本机安装完成。`node bin/casey.mjs doctor` 按 `OS` 分支逐项给修复建议，但字体 / 凭据 / 隧道缺只提示不翻退出码；真机可用必须另有真实 HTTP 与真实回放证据。

## 三、同事移交清单（带外补齐，绝不入库）

三件均已 gitignored，新环境须自建、真值带外交付、绝不入库 / 提交 / 回显：

- `.auth/`（凭据）：`.auth/credentials.json` = `{ "user": "<账号>", "pass": "<口令>" }`；env 覆盖 `AT_CREDS_USER` / `AT_CREDS_PASS`（值对）或 `AT_CREDS_FILE`（换文件路径）。
- `site.json`（站点·目标地址·隧道基址）：`target.startUrl`（真机入口地址）与 `target.devProxyUrl`（`WSL` 内隧道回环基址，形如 `http://127.0.0.1:15519`）为必备；只写字段形状，真值带外补齐。
- `cases/`（用例回放产物目录）：按需带外拷贝或在新环境重新采集。

移交动作（建远端 push / `git bundle` / 整目录拷贝）由维护者定夺；本清单只列「要带外补齐什么」，不写「补成什么值」。目标地址只活在 `site.json`（护栏 #7），本文一律不落真值。
