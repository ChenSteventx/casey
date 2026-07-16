# Casey（测易）

LLM 驱动的「文本用例 → 测试报告」自动化测试系统：一段文本用例（excel/json/txt/自由文本）→ LLM
编译成确定性可回放 spec → 确定性回放（录屏 + 抓输出）→ 零 LLM 多态裁定出严格结论 → 自包含测试报告。
内核纪律：**确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM**（详见 `docs/adr/`）。

## 三面统一标识符 `casey`

| 面 | 入口 | 用法 |
|---|---|---|
| CLI | `bin/casey.mjs` | `node bin/casey.mjs help` 看全命令表 |
| skill | `.claude/skills/casey/` | Claude Code 打开本仓即自动可用 |
| MCP server | `mcp/casey-server.mjs` | 见下「MCP 挂载」 |

七相流水线（相0 归一 → 相1 编译 → 相2 草拟+人签 → 相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告）
已有命令面；`casey heal` 仍是诚实桩（exit 3），示教蒸馏 v1 也仍把全部步骤交人处理。
当前能力与限制见 [`docs/USAGE.md`](docs/USAGE.md)。

## 安装

```bash
# 前置：node >= 22.12（见 package.json engines）
npm install                          # @playwright/test 精确 pin 1.60.0
npx playwright install chromium      # 回放/编译执行段硬依赖真浏览器
npm run verify:install               # 只验安装，不连接任何被测系统
```

Windows + `WSL2`、Linux、macOS 的完整步骤与支持边界见 [`docs/INSTALL.md`](docs/INSTALL.md)。Windows 正式路径是在 `WSL` 内安装并运行；Windows 原生终端不承担回放。`WSL` / Linux 另需中文字体，装好后用 `fc-list :lang=zh` 核实。

## 环境验收

`npm run verify:install` 检查 Node.js、Playwright、Chromium、中文字体与 `CLI` / `MCP` / `skill` 三面；它不连接任何被测系统。全部通过只代表“本机安装完成”。

`node bin/casey.mjs doctor` 继续检查凭据、`site.json` 与回环端口，但它的 exit 0 只由本机就绪项决定；真机可用还必须有 Windows→真站与 `WSL` 回环→真站两段真实 HTTP 成功证据。没有真实回放、确定性 `verdict.json`、同次录屏、视觉复核和独立单用例 HTML，不得声称行为验收完成。

项目中的假被测系统和夹具只允许静态阅读，不作为安装或行为验收命令运行。

## 凭据面（格式说明——真值一律带外交付，绝不入库/提交/回显）

推荐直接对 Casey skill 说“安全配置 AI 中台账户”或“检查账户状态”。skill 会启动本机隐藏输入；绝不要把账户或口令粘贴到聊天、命令行参数、工单或报告。配置均已 gitignored，本节只写字段形状，不含任何真值：

- `.auth/credentials.json`：`{ "user": "<账号>", "pass": "<口令>" }`。env 覆盖：`AT_CREDS_USER` /
  `AT_CREDS_PASS`（值对）或 `AT_CREDS_FILE`（换文件路径）。
- `.auth/desktop-account.json`：医生站 / Hi 小助的安全账户引用与人工就绪声明。它不保存或推导登录页面规则，自动登录固定为未验证；真实 CEF 操作仍须人工确认专用账户、已登录且无真实患者数据。
- `site.json`（仓根）：`target.startUrl`（真机入口地址）与 `target.devProxyUrl`（WSL 内隧道基址，
  形如 `http://127.0.0.1:15519`）为必备；`login` / `select` 两段可选覆盖内置选择器（深合并，
  字段见 `lib/login-bootstrap.mjs` 的 `DEFAULT_SITE`）。env 覆盖：`AT_SITE_JSON`（换文件路径）。

目标地址只活在 `site.json`，绝不进命令行/日志/输出（护栏 #7）——CLI 的 `--sut` 参数**只喂隧道
回环基址**（即 `devProxyUrl`，形如 `http://127.0.0.1:15519`），真目标地址
绝不出现在 shell 历史里。

`casey account status` 与 `casey doctor` 只报告配置是否存在、形状是否有效和人工就绪状态，不回显账户值、桌面账户引用或本机绝对路径。AI 中台文件沿既有 `login-bootstrap` 原路径消费；医生站 / Hi 小助在真实登录页采样前不宣称自动登录。

## 真机链路（反向隧道，仅真机需要）

启动顺序敏感（先 WSL 后 Windows，反了会留僵尸连接占池不补）：

1. WSL 侧：`node scripts/wsl-reverse-listen.mjs`（后台，监听 15519/15520）；
2. Windows 侧：双击 `scripts/win-forward-start.cmd`。

**真机命令一律 WSL 侧跑**（G6 人签硬约束：Windows 侧回放必败——playwright 浏览器装在 Linux 侧，
且 Windows 直连需把真目标地址写进命令行、违护栏 #7）。

## MCP 挂载（WSL 侧）

跑一句自适应吐出本仓正确挂载配置（绝对路径由结构派生，免手抄改盘符——消灭 F10「抄命令改路径」反模式）：

```bash
node bin/casey.mjs mcp-config --agent claude   # claude code：.mcp.json 片段 + 一行 claude mcp add
node bin/casey.mjs mcp-config --agent codex    # codex：~/.codex/config.toml 的 [mcp_servers.casey] 段
```

必须挂 WSL 侧 node（回放依赖 Linux 侧 playwright，Windows 原生侧挂载必败，G6）。分家 agent（codex 等无
`skill` 自动加载机制）接入入口见 `AGENTS.md`；跨平台上手与同事移交清单见 `docs/runbooks/onboarding.md`。

当前有 16 个工具（`casey_ingest` … `casey_run`，含 web 示教、入账及 CEF 示教/机械回放）。正式 web 测试采用二段式交付：`casey_run` 只产同次录像/裁定/待视觉报告，代理看完录像后由 CLI-only `finalize-run` 零 SUT 收口；只有全 PASS + 录像完整 + 视觉一致才 GREEN。`finalize-run`、`casey_distill` 与学习原子的 propose/sign/promote 尚未进入 `MCP` 面，因此这些步骤由 `skill` 在代理内部转调 `CLI`；不能声称三面已经完全同构。

账户配置故意不进入 `MCP`：skill 只转调本机 CLI 的隐藏交互、stdin 或环境导入，避免把账户值装进工具参数或协议日志。账户状态同样由 skill 在本机读取安全投影。

自然语言测试、示教兜底、医生站 / Hi 小助与自学习能力边界见 [`docs/USAGE.md`](docs/USAGE.md)。

## 分发边界

`cases/`、`runs/`、`.auth/` 与 `site.json` 均不入公开源码仓库，真机现场须带外补齐。参与源码开发还需要匹配版本的独立 `loop-kit`；普通操作员使用已签用例时不应修改 loop 工具。

开发者先读 `CONTEXT.md`、`loop/GUARDRAILS.md` 与 `docs/adr/`。本公共仓库不附内部计划、评审原文、现场凭据、真实用例或运行产物。
