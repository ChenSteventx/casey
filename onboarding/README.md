# Casey 按 OS 装载与上手

优先使用本目录提供的提示词，让 agent 完成运行环境、本仓、skill / 指令入口、MCP、本机安装检验和安全配置。只有不能使用 agent，或需要人工排障时，才照各 OS 的 `README.md` 后半部手工执行。

开始前先看 [`PERMISSIONS.md`](PERMISSIONS.md)。Casey 日常运行只需要标准用户对本仓、当前用户 agent 配置、Node.js/Chromium 和回环端口的最小权限；权限不足时只补缺失项，不授管理员、Docker 或整盘权限。

先选择 Casey 实际运行在哪个 OS，再选择 agent 类型：

| 运行面 | Codex | Claude Code | 其它 agent |
|---|---|---|---|
| Windows 原生 | [`windows/PROMPT-CODEX.txt`](windows/PROMPT-CODEX.txt) | [`windows/PROMPT-CLAUDE-CODE.txt`](windows/PROMPT-CLAUDE-CODE.txt) | [`windows/PROMPT-GENERIC-AGENT.txt`](windows/PROMPT-GENERIC-AGENT.txt) |
| WSL2 内 Linux | [`wsl/PROMPT-CODEX.txt`](wsl/PROMPT-CODEX.txt) | [`wsl/PROMPT-CLAUDE-CODE.txt`](wsl/PROMPT-CLAUDE-CODE.txt) | [`wsl/PROMPT-GENERIC-AGENT.txt`](wsl/PROMPT-GENERIC-AGENT.txt) |
| Linux 原生 | [`linux/PROMPT-CODEX.txt`](linux/PROMPT-CODEX.txt) | [`linux/PROMPT-CLAUDE-CODE.txt`](linux/PROMPT-CLAUDE-CODE.txt) | [`linux/PROMPT-GENERIC-AGENT.txt`](linux/PROMPT-GENERIC-AGENT.txt) |
| macOS | [`macos/PROMPT-CODEX.txt`](macos/PROMPT-CODEX.txt) | [`macos/PROMPT-CLAUDE-CODE.txt`](macos/PROMPT-CLAUDE-CODE.txt) | [`macos/PROMPT-GENERIC-AGENT.txt`](macos/PROMPT-GENERIC-AGENT.txt) |

“其它 agent”是一份通用提示词，适用于 pi.dev、WorkBuddy、CodeBuddy、Qoder、Cursor、Grok Build 等能够操作本机仓库的 agent。各产品的 skill 和 MCP 发现机制不同，因此通用提示词要求先查实际能力、再挂载和验证，不会假定某个品牌自动支持 Claude Code skill。

给人读的完整说明：

- [`windows/README.md`](windows/README.md)：系统自带 Windows PowerShell 5.1 为基线，PowerShell 7 仅可选。
- [`wsl/README.md`](wsl/README.md)：Casey、Node.js、Chromium 和 MCP 全部留在 WSL 侧。
- [`linux/README.md`](linux/README.md)：需要部署方提供真实目标的本地回环代理。
- [`macos/README.md`](macos/README.md)：源码安装可用，真实回放仍需回环代理和现场证据。

提示词可以帮助安装和配置，但不会绕过这些事实边界：安装检验不连接 SUT；正式测试只连接联网的真实 SUT；凭据只经隐藏输入，真目标只进入 gitignored 的 `site.json`；正式结论只来自零 LLM 的确定性 verdict；示教录制和 CEF 机械回放都不能冒充正式 PASS。
