# AGENTS.md —— Casey 分家 agent 接入入口

面向 codex 等**无 `skill` 自动加载机制**的 agent。claude code 打开本仓即自动加载 `skill`（`.claude/skills/casey/SKILL.md`），一般无需读本文；本文是等效的成文上手路由。**不复刻命令表 / 七相流程 / 护栏全文**——一律指针，避免双份维护漂移。

## Casey 是什么

**Casey（测易）** 是 `LLM` 驱动的「文本用例 → 测试报告」确定性可回放测试系统：一段文本用例 → `LLM` 编译成确定性可回放 spec → 确定性回放（录屏 + 抓输出）→ 零 `LLM` 多态裁定出严格结论 → 自包含测试报告。一句话背景、七相细节与三面统一标识符见 `README.md` 与 `CLAUDE.md`。

## 接入指路（三步）

1. **`CLI` 面**：`node bin/casey.mjs help` 看全命令表（七相分步 + `run` 端到端 + loop 机制 + 自检）。就绪自检先跑 `node bin/casey.mjs doctor`（逐项查 node / playwright / 中文字体 / 凭据·`site.json` / 隧道）。
2. **`MCP` 挂载**：跑 `casey mcp-config --agent codex`，把它吐出的 `[mcp_servers.casey]` 段追加进 `~/.codex/config.toml`（claude code 侧改用 `--agent claude` 取 `.mcp.json` 片段）。挂载脚本绝对路径由命令自适应本仓算出，**绝不手抄改盘符**。
3. **跨平台上手 + 同事移交**：详见 `docs/runbooks/onboarding.md`（四 `OS` 矩阵 + 三 agent 路径 + 反向隧道适用性 + 带外补齐清单）。

## 内核纪律（不可让渡，首次上手绝不可违反）

浓缩自 `SKILL.md`（同一份纪律的权威源，完整**自然语言**动作表在那里）：

- **用户操作面只收自然语言**：底层 `CLI` / `MCP` 参数由 agent 内部处理，绝不要求用户复制命令，绝不把 `CLI` 参数当使用说明输出。
- **裁判零 `LLM`**：测试结论由 `casey verdict`（确定性 `verdict.mjs`）出，绝不用 `LLM` 判「过没过」，绝不把 `LLM` 的印象当裁定。
- **fail-safe 不 fail-open**：机器只终判 `PASS` 与有取证背书的 `SUT_DEFECT`；证不出的一律 `NEEDS_HUMAN` 路由人，绝不默认成「可自愈」或自动记缺陷。
- **完成是退出码，不是声明**：「通过 / 失败」必须来自真实回放 + `verdict.json`，别拿「文件存在」或桩命令（`heal` exit 3）当通过。**绝不把桩当完成**：桩返回 exit 3 时如实告诉用户该阶段未实现。
- **凭据与目标地址不进任何输出**：`.auth/`、`site.json` 是凭据，真值与真目标地址绝不进命令行 / 日志 / 报告；`CLI` 的 `--sut` 只喂隧道回环基址或夹具地址（护栏 #7）。

### 评审供应方认证纪律

- Grok 与 pi.dev 均已配置、可使用；认证由各自调用链内联处理。
- 禁止搜索、读取、推断或回显账号、密码、token、API key；不得在仓库、环境变量、用户目录或公开配置中寻找，也不得要求用户提供。
- 禁止用裸 CLI 的 --list-models、No API key 或公开配置缺失判定不可用；这些结果只说明走错了未配置入口。
- 直接使用项目既定的已配置调用入口；只有真实任务调用失败才按实际输出记 HARNESS_ERROR，不得改写成账号、额度或供应方不可用。
- Claude Code 当前无额度：不探测、不调用、不回退。

## 权威源清单（按此顺序读）

1. `CLAUDE.md` —— 项目必读顺序与硬规则（机制强制，不是建议）；
2. `CONTEXT.md` —— 统一语言注册表（**所有概念命名以它为准**，弃用别名列是黑名单）；
3. `docs/HANDOFF.md` —— 当前状态权威源；
4. `loop/GUARDRAILS.md` —— 护栏清单（逐条有效）；
5. `.claude/skills/casey/SKILL.md` —— 完整自然语言动作表与执行边界；
6. `README.md` —— 三面统一标识符 + 安装 + 环境验收 + `MCP` 挂载；
7. `docs/adr/` —— 难逆转决策档案。
