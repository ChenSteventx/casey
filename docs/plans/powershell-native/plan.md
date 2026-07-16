# PowerShell 原生支持实施计划

## 目标

把 Windows PowerShell 从“只承担 Windows 网络转发”提升为 Casey 的 Windows 原生操作面：在真实 PowerShell 5.1/7 中安装、检验、配置账户、生成 `MCP` 配置、诊断环境，并安全启停只绑定回环的真实 web 代理。任何安装或端口就绪结果都不得冒充真实 SUT 行为通过。

## 实施

### 1. 安全站点与代理底座

- 新增脚本侧安全站点解析模块：只接受 `http:` / `https:`，要求有效 `target.startUrl`，错误固定码且不带输入、路径或 URL。
- `win-reverse-agent.mjs` 改用安全解析模块；HTTP 上游用 TCP，HTTPS 上游用 TLS 且默认验证证书。启动日志只含回环补给口与池大小。
- 修正补给池计数与首包竞态：隧道一经消费立即从“待用补给”计数移除并补新连接；上游建立前暂停隧道，避免首块后的字节丢失。
- `wsl-reverse-listen.mjs` 与 `win-probe-target.mjs` 使用同一安全解析；探针按协议选 HTTP/HTTPS，错误只给固定类别。
- WSL 既有双进程模式保持兼容；Windows 原生模式由 PowerShell 在同一主机启动监听端和转发端，两个连接面都强制 `127.0.0.1`。
- Windows 原生启动器为本次进程组生成随机补给握手令牌，只经子进程环境传递；监听端验过令牌才把补给连接放入 idle 池。令牌不进 argv、日志或状态文件；未设置令牌时保留既有 WSL 兼容模式。

### 2. PowerShell 主操作面

- `scripts/install.ps1`：Windows PowerShell 5.1 兼容；检查 64 位 Windows、Node.js 最低版本、Git/npm/npx，调用 `npm.cmd` 安装精确依赖、`npx.cmd` 安装 Chromium，最后运行零 SUT 安装检验。任一步非零即 fail-closed。
- `scripts/casey.ps1`：提供 `verify`、`doctor`、`account-ai`、`account-doctor-hi`、`account-status`、`mcp-config`、`proxy-start`、`proxy-status`、`proxy-stop`。账户配置保持隐藏 TTY；脚本不接账户值参数。
- 代理状态写 gitignored 本地运行目录，只含 PID、进程启动时间和状态版本，不含目标地址。status/stop 同时校验 PID 与启动时间，避免 PID 复用；start 失败必须回滚已经启动的进程。
- start 明确覆盖监听/补给地址为回环，等待两个端口就绪后才报告启动完成；只证明本地代理进程就绪，不声称真站可达。

### 3. Windows 原生 `MCP` 与诊断

- `mcp-config` 的 JSON/TOML 都使用当前 `process.execPath`，避免 agent 环境找错 Node.js；Claude Code 的一行命令按 win32 输出 PowerShell 引号，按 POSIX 输出 shell 引号。
- 删除“Windows 原生挂载必败”的静态文案，改为按运行平台给出真实边界；安装检验断言生成结果含当前 Node.js 启动器。
- `doctor` 在 win32 明示当前是 Windows 原生运行面，回环端口只证代理监听；真实 SUT 仍需真实 HTTP + 正式报告证据。

### 4. 自然语言与文档

- skill 在 win32 内部优先调用 `scripts/casey.ps1` 完成安装后操作；用户仍只说自然语言，不要求复制底层测试参数。
- README、`docs/INSTALL.md`、onboarding 与真实 UAT 手册加入 Windows PowerShell 原生路径；清楚区分“本机安装完成”“代理就绪”“真实环境行为验收完成”。
- 继续声明医生站 / Hi 小助自动登录未验证，CEF 机械回放不具正式裁定资格。

## 冻结验收点

1. 真实 Windows PowerShell 5.1 能解析并执行 `install.ps1` 与 `casey.ps1`；PowerShell 7 若在位也执行同一零 SUT 验收。
2. Windows 原生 Node.js 版本满足 `>=22.12`，`npm.cmd`/`npx.cmd` 安装后 `npm run verify:install` 全通过；输出末行仍为 `REAL_SUT NOT_VERIFIED`。
3. PowerShell 下 `verify`、`doctor`、`account-status`、Claude/Codex `mcp-config` 均由 Windows Node.js 真执行；输出不含测试金丝雀账户值、目标 URL 或不必要绝对路径。
4. `proxy-start` 在 Windows 真启动两个 Node.js 进程，15519/15520 仅绑定回环；第二次 start fail-closed；`proxy-status` 能识别进程身份；`proxy-stop` 完整收口；部分启动失败无残留。
5. 代理状态文件和日志不含 `site.json` 的 `startUrl`、账户值或测试金丝雀；进程命令行不含真实目标 URL。
6. 静态与零 SUT 测试证明补给连接须先通过可选握手、已消费连接会立即补池、上游连接前暂停客户端流；令牌不落 argv/状态/日志。
7. 静态检查证明 HTTPS 分支使用 `tls.connect` 且证书验证未被关闭；坏 `site.json` / 非 HTTP(S) 只产固定错误，不吐 Node.js 堆栈或原始值。
8. `mcp-config` 的 Windows JSON/TOML 启动器与脚本路径可由 Windows PowerShell/Node.js 解析；含空格和单引号路径的引号函数有零 SUT 回归测试。
9. 本契约的所有自动验收命令不启动、不连接、不回放 fake SUT/fixture；任何真实浏览器行为测试只允许联网真实目标。
10. 文档支持矩阵把 Windows PowerShell 标成“原生安装与操作面已验”，但只有完整真实 UAT 证据后才标“真实环境回放已验”。

## 真机收口

代码与 PowerShell 零 SUT 验收通过后，若当前真实账户、网络和用例均满足安全前置，则在 Windows 原生 PowerShell 启动回环代理，对真实在线 AI 中台执行一条只读或已有清理保证的签署用例，并交付同次确定性裁定、录屏、视觉复核和独立 HTML。若任一前置缺失，停在 `route:human` 并逐项列证据缺口，不以 WSL 或本地端口结果替代。
