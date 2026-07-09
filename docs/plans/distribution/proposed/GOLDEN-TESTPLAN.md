# distribution — 红先行金牌测试计划

> 起草态：本文只给断言清单与形态意图，**不写完整测试代码**（实现者据此写红金牌、验红、再实现）。
> 载体：新建 `tests/_golden/distribution.golden.mjs`（`mcp-config` 命令 + 分家接入文档是一族新面，独立漂移锁文件）；另在既有 `tests/_golden/cli-mcp-face.golden.mjs` 的 `EXCLUDED` 加 `mcp-config`（跨契约涟漪 A8，见 plan §0）。
> 红先行：先把断言写到「`mcp-config` 两家合法 + 路径自适应 + 零凭据零目标地址 + agent 缺错 exit 64 + `AGENTS.md` 指向 `CLAUDE.md` + 跨平台文档形态」，跑一遍确认红，再实现命令 + 文档。

## 现状红基线（实现前跑，应红在这些点）

- `casey mcp-config --agent claude` / `--agent codex`：现无 `mcp-config` 命令，落 help/未知命令（非期望的合法配置 + exit 0）——红。
- 路径自适应断言：无命令可产路径——红。
- `AGENTS.md` 在场断言：仓根无 `AGENTS.md`——红。
- 跨平台文档形态断言：无 `docs/runbooks/onboarding.md`——红。
- `README.md` 挂载段仍写死 `/mnt/d/...`（可作现状对照，转绿后应无写死盘符、改为引 `mcp-config`）。
- A8 跨金牌：`cli-mcp-face` `EXCLUDED` 现无 `mcp-config`——本契约落 `case 'mcp-config':` 后若不补 `EXCLUDED`，`cli-mcp-face` 的「`CLI`⊆`MCP`」派生断言会红（正是 A8 要钉的方向）。

## 断言清单

### A1 `mcp-config --agent claude` 产合法挂载配置

- 走真 `CLI`：`spawnSync(node, [CLI,'mcp-config','--agent','claude'])` → exit 0。
- 输出含可解析的 `.mcp.json` 片段：抽出 `mcpServers.casey` 对象 → `JSON.parse` 通过 → `command==='node'`、`Array.isArray(args)`、`args[args.length-1]` `endsWith` `path.join('mcp','casey-server.mjs')`（`path.sep` 无关可用 `/mcp/casey-server.mjs` 或 `endsWith('casey-server.mjs')` 双保险）。
- 附行断言：输出含一行 `claude mcp add casey -- node ` 前缀 + 同一绝对路径（GRILL D4 两形态都给）。

### A2 `mcp-config --agent codex` 产合法 `config.toml` 段

- `spawnSync(node,[CLI,'mcp-config','--agent','codex'])` → exit 0。
- 输出含 `[mcp_servers.casey]`、`command = "node"`、`args = [` 起头且含同一绝对路径（正则锚或最小 `TOML` 解析；不引第三方 `TOML` 库，正则锚即可）。

### A3 路径自适应=模块位置真实解析（非硬编码盘符，核心）

- 独立计算期望路径：金牌内 `import { PROJECT_ROOT } from '../../lib/paths.mjs'` → `const expect = path.join(PROJECT_ROOT,'mcp','casey-server.mjs')`。
- 断言 A1/A2 抽出的绝对路径 `=== expect`（故在任何 clone 位置、任何 `OS` 都对——路径由结构派生）。
- 源码硬编码扫描：读 `bin/mcp-config.mjs` 源 → 断言不含 `/mnt/d`、不含 `D:\\ctx`（正则 `/D:\\+ctx/i`）、不含任何写死盘符/固定仓根前缀字面量（可锚：不出现 `heren/casey` 之外的硬路径；至少钉 `/mnt/` 与 `[A-Za-z]:\\` 盘符形态不在源里）。
- 语义在断言里写清：路径必须从 `PROJECT_ROOT`（`import.meta.url` 派生）算，任何盘符字面量即红——这是 F10「手抄改路径」的根治点。

### A4 零凭据·零真目标地址

- 对 A1/A2 两家输出全文：
  - 无非回环 `://`：任一 `URL` 的 host 必 ∈ `{127.0.0.1, localhost}`（挂载配置本不该有 `URL`，故更强的断言=输出根本无 `://`）。
  - 无凭据关键词：过 `cred-gate` 的 `FORBIDDEN_KEYWORDS`（`import` `lib/cred-gate.mjs` 单一事实源，与 `output-seal`/`handover-pack` 同源），命中即红。
  - 无 `user:pass@` 内嵌凭据形态。
- 命令不读凭据/站点：种子法——在临时 `site.json`/`.auth/credentials.json` 埋唯一种子串（`AT_SITE_JSON`/`AT_CREDS_FILE` 指过去）后跑 `mcp-config`，断言输出不含种子（证明命令根本不读那两处，GRILL D6）。

### A5 缺/错 `--agent` fail-closed exit 64

- `mcp-config`（无 `--agent`）→ exit 64、报文列支持项（含 `claude`、`codex`）、不产任何配置块。
- `mcp-config --agent pi`（未支持）→ exit 64、报文点名不支持并列可选项；**不**静默默认成 claude/codex 产可能错配的配置。
- hermetic：纯用法错、启动即退，不触真机。

### A6 `AGENTS.md` 在场且指向 `CLAUDE.md`

- 仓根 `AGENTS.md` 存在（`existsSync`）。
- 内容锚：含 `CLAUDE.md`（指向权威源）；含内核纪律锚集——`自然语言`（用户操作面）、`裁判零`（裁判零 `LLM`）、`fail-safe`、`退出码`（完成是退出码）、`桩`（绝不把桩当完成）、`casey mcp-config`（接入指路）、`SKILL.md`（完整动作表指针）。任一缺即红。
- 凭据卫生（复用 A4 口径）：无 `FORBIDDEN_KEYWORDS` 值形态、无非回环 `URL`、无 `user:pass@`、无 `D:\\ctx`/写死盘符。

### A7 跨平台文档形态

- `docs/runbooks/onboarding.md` 存在。
- 四 `OS` 全在：文本含 `win`/`wsl`/`linux`/`macos`（大小写不敏感锚，或中文「视窗/苹果」按实际写法——以实现落的措辞为准，锚四者皆在）。
- 三 agent 全在：含 `claude code`、`codex`、`pi`。
- 隧道仅 `WSL` 明示：含「隧道」+「仅 `WSL`」或等义句（纯 linux/macos 不要 Windows 隧道的成文说明）。
- 字体设置：含 `fc-list`（`WSL`/linux）+ macos/Windows 字体各一句。
- 移交清单：含 `.auth`、`site.json`、`cases`（要带外补齐的三件）+ 「带外」/「不入库」措辞。
- 凭据卫生（A4 口径）+ `term-lint` 干净（写入即由 hook 扫；金牌另可跑 `casey lint --file` 兜一道）。

### A8 跨金牌一致：`mcp-config` ∈ `cli-mcp-face` `EXCLUDED`（防跨金牌红，核心涟漪钉）

- 读 `tests/_golden/cli-mcp-face.golden.mjs` 源 → 断言其 `EXCLUDED` 集含 `mcp-config`（正则或取导出）。
- 语义：本契约新增 `case 'mcp-config':` 落进 `cli-mcp-face` 的「`CLI`⊆`MCP`」派生集；`mcp-config` 不暴露为 `MCP` 工具（GRILL D11），故必须在 `EXCLUDED` 白名单留痕，否则那道金牌红。这道断言把「加了命令没同步 `EXCLUDED`」在本族金牌里先拦下，与 `cli-mcp-face` 自身的派生断言互为双保险。
- 落地次序提醒（断言注释写明）：`EXCLUDED` 的更新与重签 `prd-cli-mcp-face.json` 须与 `mcp-parity` 落地次序对齐（plan §0）。

## 涟漪回归（金牌外，gate acceptance 覆盖）

- 改 `README.md` → `node tests/_golden/handover-pack.golden.mjs` 全绿（八节锚全在 + 凭据卫生 + 无 `D:\ctx`）。
- 碰 `bin/casey.mjs`（加 `case`）/ `mcp/casey-server.mjs`（改注释）→ `node tests/_golden/cli-mcp-face.golden.mjs` 全绿（`EXCLUDED` 已含 `mcp-config`、`TOOLS` 未动）。
- `node bin/casey.mjs selftest --tier1` 无回归。
- `AGENTS.md`/`docs/runbooks/onboarding.md`/`README.md` 写入过 `term-lint`（PostToolUse hook 扫）。
- 重签后 `node loop-kit/bin/gate.mjs --prd loop/prd-cli-mcp-face.json` 复跑仍绿（`testChecksums` 对齐新 sha）。

## 不做（本金牌不覆盖，留 route:human）

- 真机各 agent 挂载核验（claude code/codex 上用 `mcp-config` 产的配置真挂 `MCP` server + `tools/call` 实跑）——需各 agent 环境在场，route:human 尾巴（审计 R3）。
- pi 上手成文路径（待 pi 从可驱动环境真机核验，`docs/HANDOFF.md` 记 pi 从本 `WSL` 驱不动）——route:human。
- 分发链**安装**环节（git 远端/npm/`npx casey`）——属维护者/另案，非本契约。
