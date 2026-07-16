# Windows 原生装载与操作

本页以 64 位 Windows 11 和系统自带 Windows PowerShell 5.1 为基线。PowerShell 7 只是可选工具，不是 Casey、Codex 或 Claude Code 的前置条件。Windows 原生安装不使用 Docker Desktop，也不要求 WSL2。

## 首选：把安装提示词交给 agent

先安装并打开你准备使用的 agent，然后复制对应提示词的全部内容交给它：

- Codex：[`PROMPT-CODEX.txt`](PROMPT-CODEX.txt)
- Claude Code：[`PROMPT-CLAUDE-CODE.txt`](PROMPT-CLAUDE-CODE.txt)。开始前选择 Fable 模型和 high 推理强度；不可用时让它明确报告，不要静默换模型。
- pi.dev、WorkBuddy、CodeBuddy、Qoder、Cursor、Grok Build 等：[`PROMPT-GENERIC-AGENT.txt`](PROMPT-GENERIC-AGENT.txt)

提示词会要求 agent 安装 Git / Node.js、克隆 Casey、安装本体与 Chromium、接入正确的指令入口和 MCP、执行零 SUT 检验，并引导你以隐藏输入配置账户。开始前请对照 [`../PERMISSIONS.md`](../PERMISSIONS.md) 核对最小权限。Windows 原生不使用 Docker 或 WSL2；Casey 本体、账户配置与日常运行只需标准用户权限，agent 不得索要管理员或全盘访问。它不应要求你把账户、口令或真实目标地址贴进聊天。

安装完成后，日常只需对 agent 说自然语言，例如：“在真实 AI 中台运行已签署的历史版本用例，逐例生成独立 HTML；看完同次录像后再正式收口。” 用户不需要维护底层 CLI 参数。

## 备用：人工安装

安装 64 位 Git 和 Node.js 22.12 或更高版本。若系统有 winget，可在 Windows PowerShell 5.1 中执行：

```powershell
winget install --exact --id Git.Git
winget install --exact --id OpenJS.NodeJS.LTS
```

关闭并重新打开 Windows PowerShell 5.1，再检查：

```powershell
git --version
node.exe --version
npm.cmd --version
```

把仓库放在当前用户拥有的普通工作目录，不要放 `Program Files`、多人共享目录或公共同步盘：

```powershell
git clone https://github.com/ChenSteventx/casey.git casey
Set-Location .\casey
& .\scripts\install.ps1
```

安装器固定使用 `npm.cmd` / `npx.cmd`，安装精确依赖和 Windows Chromium，再运行零 SUT 检验。全部通过后末行仍是 `REAL_SUT NOT_VERIFIED`。仅复核已有安装：

```powershell
& .\scripts\install.ps1 -VerifyOnly
```

若组织策略阻止本地脚本，走组织批准的脚本签名或执行策略流程；不要永久关闭执行策略，也不要使用远程 `Invoke-Expression`。

## 人工接入 agent

Claude Code 必须从仓根打开项目，并读取 `.claude/skills/casey/SKILL.md`。本项目不要求把它复制成另一份 skill。使用 Claude Code 时选择 Fable + high。

Codex 先读取仓根 `AGENTS.md`。若当前 Codex 提供 plugin 安装，使用仓内 `.codex-plugin/plugin.json`；否则用官方 skill installer 安装 `skills/casey`。后者只是薄路由，执行 Casey 前仍会回到仓根权威 skill。安装后重新启动或刷新 Codex，只有入口实际可发现才算完成。

MCP 配置必须从 Windows 运行面生成，不要照抄别人机器或 WSL 的路径：

```powershell
& .\scripts\casey.ps1 mcp-config -Agent claude
& .\scripts\casey.ps1 mcp-config -Agent codex
```

Claude Code 或 Codex 只运行自己对应的一条，并把输出安全合并到现有配置。其它 agent 先读 `AGENTS.md`，确认其官方 stdio MCP 格式，再把 Codex 生成结果中的实际 command / args 转成该格式；验证前不能声称已支持。若产品没有 stdio MCP，就如实保留为能力缺口。

## 安全配置与真实环境

建议让 agent 执行“安全配置 AI 中台账户”。人工兜底时使用本机隐藏输入：

```powershell
& .\scripts\casey.ps1 account-ai
& .\scripts\casey.ps1 account-status
```

账户 ACL 收紧只应使用当前标准用户对自己目录的权限，不需要管理员。若这里报权限错误，应把仓库移到当前用户拥有的本地目录后重新配置；不要以管理员身份重跑来接管别人的目录。

医生站 / Hi 小助目前只保存安全账户引用与人工就绪声明，不代表自动登录：

```powershell
& .\scripts\casey.ps1 account-doctor-hi
```

真实入口地址只写入仓根 gitignored 的 `site.json`；至少包含 `target.startUrl` 和 `target.devProxyUrl`。不要把真实地址、账号或口令写进聊天、命令参数、日志或报告。

Windows web 回环代理由同一脚本管理：

```powershell
& .\scripts\casey.ps1 proxy-start
& .\scripts\casey.ps1 proxy-status
& .\scripts\casey.ps1 doctor
```

`LOCAL_PROXY_READY` 只表示本地进程与端口就绪；`REAL_SUT_HTTP_NOT_VERIFIED` 只表示还没有真实 HTTP 证据。正式测试前必须同时证明 Windows 网络侧可达真站、同一运行面经 `target.devProxyUrl` 可达真站。结束后：

```powershell
& .\scripts\casey.ps1 proxy-stop
```

## 操作纪律

只在联网的真实 SUT 上执行正式测试。新用例须经过候选归一、真机编译、断言草拟和人签，不能由 agent 代签。每个用例必须有独立 HTML，包含已签自然语言用例、动作与断言原子、同次录屏和附件。正式 verdict 只来自零 LLM 的确定性裁定；视觉复核不能改判。

自动映射失败可以转真实环境人工示教，但录制包仍是未签候选；蒸馏、补全、编译、人签后才可能正式回放。CEF 机械回放固定不具备正式 verdict 资格。`casey heal` 当前仍是 exit 3 诚实桩。任何这些限制都应如实显示，不能包装成 PASS。
