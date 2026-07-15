# AGENTS.md — Casey 公共发行版接入入口

Casey（测易）把自然语言测试用例编译为确定性可回放 spec，在真实 SUT 上录屏回放，以零 LLM 裁判生成每例独立 HTML 报告。

接入顺序：

1. 先读 `README.md`、`CONTEXT.md`、`docs/INSTALL.md` 与 `docs/USAGE.md`。
2. Codex / Claude Code 执行 Casey 任务前，完整读取 `.claude/skills/casey/SKILL.md`；Codex plugin 的 `skills/casey/SKILL.md` 只是薄路由。
3. 本机安装只用 `npm run verify:install`；它不接任何 SUT。真实可用还需凭据、回环代理、两段 HTTP 连通证据及真实回放。

强制边界：

- 用户操作面只收自然语言；代理内部处理 CLI/MCP 参数。
- fake-SUT 与 fixture 只允许静态阅读；`casey demo` 与未审计整包 `gate` 已禁用。
- 测试裁定只来自 `verdict.mjs`；视觉复核不修改裁定。
- 正式 web 交付分两段：真实 `run` 产证后，代理看录像，再以零 SUT `finalize-run` 收口。
- 每个测试用例一份独立 HTML，含自然语言用例、原子操作、同次录屏和附件。
- `.auth/`、`site.json`、`cases/`、`runs/` 不得提交或回显。
