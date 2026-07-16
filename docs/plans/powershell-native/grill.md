# PowerShell 原生支持——问题压实

## 用户结果

Windows 11 操作员可在 Windows PowerShell 5.1 或 PowerShell 7 中完成源码安装、安装检验、账户配置、就绪诊断、`MCP` 配置和真实 web 回环代理启停。代理与 Casey 进程的命令行、状态文件和标准输出均不得出现真实目标地址或账户值。

## 已证实现状

- 公开 `main` 的 Node.js 代码大多已有 `win32` 分支，Windows PowerShell 5.1、Windows 原生 Node.js 与 Git 在当前 Windows 主机真实存在。
- 当前文档、`MCP` 配置和操作流程明确写着“Windows 原生侧回放必败”，因此现状不算支持 PowerShell。
- 现有 `wsl-reverse-listen.mjs` 与 `win-reverse-agent.mjs` 都是 Node.js TCP 程序；在同一 Windows 主机上以前者监听、后者补给连接，可复用既有回环数据面，无需把真实地址放进 `--sut` 或另造代理协议。
- 当前转发端对 HTTPS 上游仍使用裸 TCP，站点配置异常可能吐 Node.js 裸栈；缺少 start/status/stop、PID 复用校验和部分启动回滚。

## 边界决定

1. PowerShell 是 Windows 原生主壳；实现必须兼容 Windows PowerShell 5.1，不依赖只在 PowerShell 7 存在的语法。
2. `--sut` 仍只允许本机回环基址。真实目标只从 gitignored `site.json` 读入内存，账户只从 `.auth/`、隐藏 TTY、stdin 或环境进入内存。
3. 复用现有反向隧道数据面：Windows 原生模式在同机拉起监听端和转发端；WSL 模式保持原启动顺序与行为。
4. 安装检验、PowerShell 生命周期验收和静态安全检查必须零 SUT；不得启动、连接或回放 fake SUT/fixture。
5. Windows 原生真实环境回放只有在联网真实目标产生 HTTP 证据、真实回放、确定性裁定、同次录屏、视觉复核和独立单用例 HTML 后才算完成。本契约先交付可运行操作面；若本轮没有完整真机证据，文档必须标 `route:human`，不得拔高。
6. 医生站 / Hi 小助 CEF 本轮只保持现有边界，不借 PowerShell 支持声称自动登录或正式裁定可用。

## 主要失败模式

- PowerShell 脚本只通过文本审查，未由真实 `powershell.exe` 执行。
- `npm` / `npx` 在 PowerShell 中误调用脚本策略受限的 `.ps1` shim，而不是稳定的 `.cmd` 入口。
- 状态文件只记 PID，PID 被 Windows 复用后 status/stop 误伤无关进程。
- 监听端已起而转发端失败，遗留半启动代理；或重复 start 造成端口冲突。
- 日志、错误、进程参数或 `MCP` 配置泄露真实地址、账户值或不必要的本机路径。
- HTTPS 目标仍以明文连接 443，表现为“端口在听但真站不通”。
- 安装成功被错误表述为真实环境行为验收成功。

## 最小交付切片

- Windows PowerShell 安装器与统一操作脚本。
- PowerShell 代理 start/status/stop，带同一进程身份校验、回环绑定、启动回滚与消毒日志。
- 站点目标安全解析单点，Windows 转发端支持 HTTP/TLS 上游；目标探针同步支持 HTTPS 且错误消毒。
- `MCP` 配置生成器使用当前 Node.js 绝对启动器，并按当前 OS 给出 PowerShell 或 POSIX 安全命令。
- `doctor`/安装检验/skill/README/安装手册更新真实 Windows 支持边界。
- 实际 Windows PowerShell 5.1 零 SUT 验收脚本与结果记录。
