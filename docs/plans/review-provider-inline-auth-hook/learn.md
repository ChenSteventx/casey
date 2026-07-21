# Learn：评审供应方内联认证纪律

1. 供应方认证属于既定调用链能力，不是仓库、环境变量、用户目录或公开配置中的可发现物；裸 CLI 的负结果只证明走错入口。
2. 宿主 hook 与 Codex 接入面不同：Casey 的 `.claude/settings.json` 负责 `UserPromptSubmit`，`AGENTS.md` 负责 Codex，二者必须同义维护。
3. 固定上下文 hook 应保持零输入、零文件、零 env、零网络、零子进程；任何真实供应方失败只据实际任务输出记录为 `HARNESS_ERROR`。
4. 纯函数测试不足以证明 hook 主入口；验收必须真实启动 settings 中的生产命令，并核退出码、signal、stdout、stderr 和多类 stdin。
5. 当前 Node 24/WSL 的嵌套 stdout pipe 捕获可能失真；用每次独占临时文件承接子进程 stdout/stderr，可保留真实进程证据而不放宽断言。
6. Claude Code 当前无额度是明确路由约束：不探测、不调用、不回退；Grok/pi.dev 直接走各自已配置入口。
7. 最终冻结 SHA256 已由 Steven 于 2026-07-21 明确批准；签认只覆盖该精确字节，测试后续变化必须重新冻结、重跑门禁并重新人签。
