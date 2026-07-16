# WSL2 装载与操作

这条路径把 Casey、Node.js、Linux Chromium、agent 与 MCP 全部放在 WSL2 内。Windows 只提供真实目标所在的网络侧和转发端。不要混用 Windows Node.js、Windows Playwright 缓存或 Windows agent 配置。

## 首选：把安装提示词交给 agent

先在 WSL2 中启动对应 agent，并复制提示词全文：

- Codex：[`PROMPT-CODEX.txt`](PROMPT-CODEX.txt)
- Claude Code：[`PROMPT-CLAUDE-CODE.txt`](PROMPT-CLAUDE-CODE.txt)。开始前选择 Fable + high；不可用时不要静默换模型。
- pi.dev、WorkBuddy、CodeBuddy、Qoder、Cursor、Grok Build 等：[`PROMPT-GENERIC-AGENT.txt`](PROMPT-GENERIC-AGENT.txt)

agent 会检查 WSL2、安装 Linux 侧依赖、把仓库放在 WSL 原生文件系统、配置正确运行面的 skill / 指令入口和 MCP，并引导隐藏输入。管理员动作、Windows 重启和安全输入仍需你本人确认。

装好后只需自然语言，例如：“在真实 AI 中台回放已签的工作流历史版本用例，逐例生成独立 HTML，并在观看同次录像后正式收口。”

## 备用：人工安装

尚未启用 WSL2 时，在管理员 Windows PowerShell 中按微软当前支持方式启用 WSL 并安装 Linux 发行版，完成所需重启。进入 WSL 后确认版本是 WSL2。

在 WSL 中安装 Git、Node.js 22.12 或更高版本、fontconfig 和中文字体。使用发行版或组织批准的软件源，不要执行来源不明的 `curl | shell`。把仓库放在 Linux 用户家目录，而不是默认放进 `/mnt/c`：

```bash
git clone https://github.com/ChenSteventx/casey.git ~/casey
cd ~/casey
npm install
npx playwright install --with-deps chromium
fc-list :lang=zh
npm run verify:install
```

字体查询没有结果时，按发行版方式安装 Noto Sans CJK 后复查。零 SUT 检验全部 PASS 后仍显示 `REAL_SUT NOT_VERIFIED`，这只代表 WSL 本机安装完成。

## 人工接入 agent

Claude Code 从 WSL 仓根打开并读取 `.claude/skills/casey/SKILL.md`，模型使用 Fable + high。Codex 先读 `AGENTS.md`；按当前 Codex 官方能力安装仓库 plugin，或通过官方 skill installer 安装 `skills/casey` 薄路由。两者都必须从 WSL 运行面生成 MCP：

```bash
node bin/casey.mjs mcp-config --agent claude
node bin/casey.mjs mcp-config --agent codex
```

只执行对应 agent 的一条并安全合并，不要拿 Windows 生成结果改路径。其它 agent 先读 `AGENTS.md`，确认官方 stdio MCP 格式，再把 Codex 输出的实际 command / args 转换为该格式；刷新并枚举 Casey 工具后才算挂载成功。

## 安全配置与真实链路

优先让 agent 执行“安全配置 AI 中台账户”。人工兜底使用 WSL 隐藏终端：

```bash
node bin/casey.mjs account configure ai-middle
node bin/casey.mjs account status
```

账户文件留在 gitignored 的 `.auth/`；目录应在 WSL 原生文件系统，不要用挂载盘的 POSIX mode 冒充真实 ACL。真目标只写仓根 gitignored 的 `site.json`，命令和日志只出现回环基址。

真实 AI 中台回放使用既有反向隧道，顺序不能反：

1. WSL 侧先启动 `node scripts/wsl-reverse-listen.mjs`。
2. Windows 侧再启动 `scripts/win-forward-start.cmd`。
3. 证明 Windows 网络侧可达真站，并证明 WSL 经 `target.devProxyUrl` 可达真站。

只看到监听端口不算真实 HTTP。`node bin/casey.mjs doctor` 也不能替代这两段证据。

## 操作纪律

正式测试只连接联网的真实 SUT。新用例须真机编译、断言草拟和人签。每例独立 HTML 要包含已签自然语言用例、动作与断言原子、同次录屏和附件。正式 verdict 由零 LLM 裁定；视觉复核不能改判。

人工示教只生成未签候选，不能冒充正式回放。CEF 机械回放也不具备正式 verdict 资格。`casey heal` 当前 exit 3。任何缺失证据或能力都必须如实显示。
