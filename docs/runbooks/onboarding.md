# onboarding —— Casey 跨平台上手 + 分家接入 + 同事移交

本 runbook 覆盖三 agent 接入路径、四 `OS` 环境矩阵、同事移交清单。凭据只写字段形状占位，真值一律带外交付、绝不入库。分家 agent 的薄路由入口见仓根 `AGENTS.md`；三面统一标识符与安装见 `README.md`。

## 一、三 agent 接入路径

### claude code
- `skill` 自动加载：打开本仓即可用 `.claude/skills/casey/`，用户操作面只收自然语言。
- `MCP` 挂载：`casey mcp-config --agent claude` → 取 `.mcp.json` 片段，或一行 `claude mcp add casey -- node <绝对路径>`。

### codex
- 无 `skill` 自动加载机制，走仓根 `AGENTS.md` 上手。
- `MCP` 挂载：`casey mcp-config --agent codex` → 把 `[mcp_servers.casey]` 段追加进 `~/.codex/config.toml`。

### pi（留位，待真机核验）
- 若 pi 支持 `MCP`，法同 codex（配置段挂 `node <绝对路径>`）。当前 pi 从本 `WSL` shell 驱不动（`docs/HANDOFF.md` 有账），成文路径待 pi 从可驱动环境真机核验后补；`mcp-config` 届时按需补 pi 格式。route:human。

## 二、四 `OS` 环境矩阵

三件事逐 `OS` 就位：node 运行时、中文字体（截图 / 录屏中文不空白）、反向隧道适用性。

| `OS` | node | 中文字体 | 反向隧道 |
|---|---|---|---|
| `WSL`（Windows 内 Linux） | node ≥ 22.12（Linux 侧） | `fc-list :lang=zh` 核实；缺则装用户级 Noto Sans CJK | 需要（详见下方隧道适用性） |
| Windows 原生 | node ≥ 22.12 | 系统内置微软雅黑；但回放须走 `WSL` 侧（G6） | 回放在 `WSL` 侧，见 `WSL` 行 |
| Linux 原生 | node ≥ 22.12 | `fc-list :lang=zh` 核实；缺则装 Noto Sans CJK | 不需要（`SUT` 直连） |
| macOS | node ≥ 22.12 | 系统内置 PingFang（苹方）等 CJK 字体；必要时 Font Book 核实 | 不需要（`SUT` 直连） |

隧道适用性（关键）：反向隧道仅 `WSL` + Windows 组合需要（把 `WSL` 内回环端口反射到 Windows 侧真机可达网络）。纯 Linux / macOS 原生 `SUT` 直连，不要 Windows 隧道；此时 `--sut` 仍只喂本地代理回环基址或夹具地址，真目标地址绝不进命令行（护栏 #7）。真机命令一律 `WSL` 侧跑（G6：Windows 原生侧回放必败——playwright 浏览器装在 Linux 侧）。

字体一句话：`WSL` / Linux 用 `fc-list :lang=zh` 查、缺则装 Noto Sans CJK；macOS 用内置 PingFang（苹方）；Windows 用内置微软雅黑（但回放在 `WSL` 侧、查 `WSL` 侧字体库）。

一键就绪自检：`node bin/casey.mjs doctor` 按 `OS` 分支逐项给修复建议（就绪级任一缺 exit 1；字体 / 凭据 / 隧道缺只提示不阻塞）。

## 三、同事移交清单（带外补齐，绝不入库）

三件均已 gitignored，新环境须自建、真值带外交付、绝不入库 / 提交 / 回显：

- `.auth/`（凭据）：`.auth/credentials.json` = `{ "user": "<账号>", "pass": "<口令>" }`；env 覆盖 `AT_CREDS_USER` / `AT_CREDS_PASS`（值对）或 `AT_CREDS_FILE`（换文件路径）。
- `site.json`（站点·目标地址·隧道基址）：`target.startUrl`（真机入口地址）与 `target.devProxyUrl`（`WSL` 内隧道回环基址，形如 `http://127.0.0.1:15519`）为必备；只写字段形状，真值带外补齐。
- `cases/`（用例回放产物目录）：按需带外拷贝或在新环境重新采集。

移交动作（建远端 push / `git bundle` / 整目录拷贝）由维护者定夺；本清单只列「要带外补齐什么」，不写「补成什么值」。目标地址只活在 `site.json`（护栏 #7），本文一律不落真值。
