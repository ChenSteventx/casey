# macOS 装载与操作

macOS 支持源码安装、Chromium 和零 SUT 检验。真实 web 回放还要求部署方提供组织批准的本地回环代理；当前没有 macOS 现场真机验收证据。

## 首选：把安装提示词交给 agent

在 macOS 中启动对应 agent，并复制提示词全文：

- Codex：[`PROMPT-CODEX.txt`](PROMPT-CODEX.txt)
- Claude Code：[`PROMPT-CLAUDE-CODE.txt`](PROMPT-CLAUDE-CODE.txt)。选择 Fable + high；不可用时不要静默换模型。
- pi.dev、WorkBuddy、CodeBuddy、Qoder、Cursor、Grok Build 等：[`PROMPT-GENERIC-AGENT.txt`](PROMPT-GENERIC-AGENT.txt)

agent 会识别芯片架构、补齐运行时、安装 Casey 与 Chromium、接入真实支持的 skill / 指令入口和 MCP，并把管理员确认、隐藏输入或组织代理事项单独列出。

装好后只需自然语言，例如：“在真实 AI 中台运行已签的用例，逐例生成独立 HTML，并在看完同次录像后正式收口。”

## 备用：人工安装

使用 Apple、Node.js 官方或组织批准的包管理方式安装 Git 和 Node.js 22.12 或更高版本。先确认 `git --version`、`node --version` 和 `npm --version`，再执行：

```bash
git clone https://github.com/ChenSteventx/casey.git casey
cd casey
npm install
npx playwright install chromium
npm run verify:install
```

Casey 会检查 PingFang 等中文字体。零 SUT 检验全部 PASS 后仍显示 `REAL_SUT NOT_VERIFIED`；源码安装成功不等于真实目标可用。

## 人工接入 agent

Claude Code 从仓根打开并读取 `.claude/skills/casey/SKILL.md`，模型使用 Fable + high。Codex 先读 `AGENTS.md`，按当前官方能力安装仓库 plugin，或通过官方 skill installer 安装 `skills/casey` 薄路由。MCP 从当前 macOS 运行面生成：

```bash
node bin/casey.mjs mcp-config --agent claude
node bin/casey.mjs mcp-config --agent codex
```

只执行对应 agent 的一条并安全合并。其它 agent 先读 `AGENTS.md`，确认官方 stdio MCP 格式，再将 Codex 输出的实际 command / args 转换为该格式；刷新后实际枚举到 Casey 工具才算成功。

## 安全配置与真实链路

优先让 agent 执行“安全配置 AI 中台账户”。人工兜底：

```bash
node bin/casey.mjs account configure ai-middle
node bin/casey.mjs account status
```

隐藏输入不能工作时不要把秘密改贴进聊天。账户留在 gitignored 的 `.auth/`，目录尽量为 `0700`、文件为 `0600`；当前没有 Keychain 集成。真目标只写 gitignored 的 `site.json`，命令和日志只使用回环基址。

`node bin/casey.mjs doctor` 不能证明真站可达。正式回放前，部署方必须提供本地回环代理，并取得 macOS 网络侧到真站、经 `target.devProxyUrl` 到真站的真实 HTTP 证据。做不到时只能停在“本机安装完成”。

## 操作纪律

正式测试只连接联网的真实 SUT。新用例须真机编译、断言草拟和人签。每例独立 HTML 要包含已签自然语言用例、动作与断言原子、同次录屏和附件。正式 verdict 由零 LLM 裁定；视觉复核不能改判。

人工示教只生成未签候选，CEF 机械回放也不具备正式 verdict 资格。`casey heal` 当前 exit 3。任何代理缺失、工具不兼容或真机证据不足都必须如实报告。
