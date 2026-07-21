# review-provider-inline-auth-hook：决策记录

> Steven 2026-07-21 明确裁定：Grok 与 pi.dev 都可使用，认证由调用链内联；agent 不得到公开位置寻找
> 账号、密码或 API key。Claude Code 当前无额度，后续不用。

## D1：落点

新增 Casey 专用 `UserPromptSubmit` hook `bin/review-provider-context-hook.mjs`，在每次用户提示提交时注入评审
供应方上下文；接入 `.claude/settings.json`。该规则是本机/项目的供应方配置，不进入通用兄弟 `loop-kit` 包。

Codex 不执行 Claude hook，因此 `AGENTS.md` 同步写入等价硬规则。两面必须由验收测试逐字核对，防漂移。

## D2：注入语义

每次提示都注入，不依赖“实现/评审”关键词：

1. Grok 与 pi.dev 已配置、可使用，认证由各自调用链内联处理。
2. 禁止在仓库、环境变量、用户目录、公开配置或命令行帮助中搜索、读取、推断、回显账号、密码、token、
   API key；不得要求用户提供。
3. 禁止用裸 CLI 的 `--list-models`、`No API key`、公开配置缺失等预检结果判供应方不可用；这只证明走错了
   未配置入口。
4. 直接使用项目既定的已配置 Grok/pi.dev 调用入口；只有该真实任务调用失败，才按实际输出记
   `HARNESS_ERROR`，不得改写成“账号/额度不可用”。
5. Claude Code 当前无额度：不探测、不调用、不作为回退。

hook 零输入依赖：不读取 stdin、文件或环境变量，不触网，不启动评审工具，不包含任何凭据值；空/坏输入也
照常输出同一固定上下文并 exit 0，保持 `UserPromptSubmit` 软层不阻塞。

## D3：验收

- 正常提示、实现提示、评审提示三类输入均得到同一供应方上下文；实现提示原有 loop triage hook 仍独立生效。
- malformed/空 stdin 时新 hook 仍注入固定上下文并 exit 0、无凭据探测、无外部副作用。
- 静态检查禁止源码出现 key/token 环境变量读取、用户目录配置探测、`--list-models` 或子进程调用。
- `.claude/settings.json` 精确接线，`AGENTS.md` 等价规则齐全；JSON/JS 语法、term-lint、既有 tier1 不回归。

## 非目标

- 不保存、搬运、显示或验证任何真实认证信息。
- 不修改 Grok/pi.dev 的认证实现或安装。
- 不修改通用 `loop-kit`、ratchet、安全撤销契约或 Casey 业务运行时。
