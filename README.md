# Casey（测易）

LLM 驱动的「文本用例 → 测试报告」自动化测试系统：一段文本用例（excel/json/txt/自由文本）→ LLM
编译成确定性可回放 spec → 确定性回放（录屏 + 抓输出）→ 零 LLM 多态裁定出严格结论 → 自包含测试报告。
内核纪律：**确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM**（详见 `CLAUDE.md` 与 `docs/adr/`）。

## 三面统一标识符 `casey`

| 面 | 入口 | 用法 |
|---|---|---|
| CLI | `bin/casey.mjs` | `node bin/casey.mjs help` 看全命令表 |
| skill | `.claude/skills/casey/` | Claude Code 打开本仓即自动可用 |
| MCP server | `mcp/casey-server.mjs` | 见下「MCP 挂载」 |

七相流水线（相0 归一 → 相1 编译 → 相2 草拟+人签 → 相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告）
全部建成且有金牌背书；`casey heal` 是唯一诚实桩（exit 3，相5 只有 lib 件）。
当前进度权威源：`docs/HANDOFF.md` 顶部「当前状态」。

## 安装

```bash
# 前置：node >= 22.12（见 package.json engines）
npm install                          # @playwright/test 精确 pin 1.60.0
npx playwright install chromium      # 回放/编译执行段硬依赖真浏览器
```

WSL 环境另需中文字体（截图/录屏中文空白的根因）：装用户级 Noto Sans CJK 后 `fc-list :lang=zh` 核实。

## 环境验收（三级，逐级递进）

1. **机制自检**（零外部依赖，npm install 前即可跑）：`node bin/casey.mjs selftest --tier1`
   ——验确定性内核 + 统一语言，**不验浏览器/凭据/隧道**，全绿不代表能回放。
2. **hermetic 回放就绪**（验 npm install + chromium）：`node tests/_golden/e2e-chain.golden.mjs`
   ——十站全链集成金牌（文本→报告，约 35 秒），8/8 过即本机可跑全部 hermetic 面。
   看样例报告：`node bin/casey.mjs demo`——零真机零凭据出一份自包含 `PASS` 报告（含裁定徽章），落
   `runs/sample-wf-publish/`；与上一级 `selftest --tier1` 的区别：demo 需 chromium、不是零依赖，
   不冒充「零依赖一句话出报告」。
3. **真机连通**（需凭据与隧道，见下两节）：`node scripts/win-probe-target.mjs`（Windows 侧）
   只回显状态码不回显目标地址。

## 凭据面（格式说明——真值一律带外交付，绝不入库/提交/回显）

两件均已 gitignored，新环境须自建；本节只写字段形状，不含任何真值：

- `.auth/credentials.json`：`{ "user": "<账号>", "pass": "<口令>" }`。env 覆盖：`AT_CREDS_USER` /
  `AT_CREDS_PASS`（值对）或 `AT_CREDS_FILE`（换文件路径）。
- `site.json`（仓根）：`target.startUrl`（真机入口地址）与 `target.devProxyUrl`（WSL 内隧道基址，
  形如 `http://127.0.0.1:15519`）为必备；`login` / `select` 两段可选覆盖内置选择器（深合并，
  字段见 `lib/login-bootstrap.mjs` 的 `DEFAULT_SITE`）。env 覆盖：`AT_SITE_JSON`（换文件路径）。

目标地址只活在 `site.json`，绝不进命令行/日志/输出（护栏 #7）——CLI 的 `--sut` 参数**只喂隧道
回环基址**（即 `devProxyUrl`，形如 `http://127.0.0.1:15519`）或 hermetic 夹具地址，真目标地址
绝不出现在 shell 历史里。

## 真机链路（反向隧道，仅真机需要）

启动顺序敏感（先 WSL 后 Windows，反了会留僵尸连接占池不补）：

1. WSL 侧：`node scripts/wsl-reverse-listen.mjs`（后台，监听 15519/15520）；
2. Windows 侧：双击 `scripts/win-forward-start.cmd`。

**真机命令一律 WSL 侧跑**（G6 人签硬约束：Windows 侧回放必败——playwright 浏览器装在 Linux 侧，
且 Windows 直连需把真目标地址写进命令行、违护栏 #7）。

## MCP 挂载（WSL 侧）

```bash
claude mcp add casey -- node /mnt/d/ctx/heren/casey/mcp/casey-server.mjs
# 路径按你的 clone 位置替换；必须挂 WSL 侧 node（回放依赖 Linux 侧 playwright）
```

14 个工具（`casey_ingest` … `casey_run`，含示教录制/入账的 `casey_record`/`casey_intake`），签名与 CLI 真面对齐并有漂移锁金牌盯防
（`tests/_golden/cli-mcp-face.golden.mjs`：工具名集 `deepEq` 钉死，另有「CLI 生命周期命令集 ⊆ MCP 工具集」覆盖断言——CLI 长了新命令而 MCP 没跟即红）。

## Claude Code hooks 行为预告

`.claude/settings.json` 随仓生效：写 md/json 会被统一语言检查拦（术语/繁体，`CONTEXT.md` 是唯一
词表）、改 `lib/ bin/` 或复合 Bash 命令会被阶段互锁拦（要求先 `casey contract init`）。**这是 loop
纪律特性不是故障**——纯终端使用 CLI 零影响；要参与开发先读 `CLAUDE.md` 必读顺序与 `loop/GUARDRAILS.md`。

## 分发现状

本仓当前无 git 远端（本地 `master`/`dev`/`test` 三分支）。移交走「建远端 push / `git bundle` /
整目录拷贝」由维护者定夺；注意 `cases/` `runs/` `.auth/` `site.json` 均不入库，真机现场须带外补齐。

## 开发者入口

`CLAUDE.md`（必读顺序）→ `CONTEXT.md`（统一语言）→ `docs/HANDOFF.md`（当前状态权威源）→
`loop/GUARDRAILS.md`（17 条护栏）→ `docs/adr/`（难逆转决策）。新 session 开工：`/starter`。
