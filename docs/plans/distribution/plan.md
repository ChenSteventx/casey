# distribution — 分发与接入：`mcp-config` + 分家接入 + 跨平台上手（light）

> 起草态（零-baton）：本文只落计划骨架，未 `contract init`、未 gate、未提交。实现者继承时先 `casey contract init distribution --lane light --reason "..."`。
> 合并易用性审计 C6（摩擦 F10）+ C7（摩擦 F11/F12/F14）。决策见 `docs/plans/distribution/proposed/GRILL.md`（D1–D12），红金牌断言清单见 `docs/plans/distribution/proposed/GOLDEN-TESTPLAN.md`。
> 与并行 `docs/plans/mcp-parity/` 咬合：本契约不改 `MCP` `TOOLS`，但新增的 `mcp-config` 命令会被 `mcp-parity` 的「`CLI`⊆`MCP`」派生断言波及——涟漪与落地次序见 §0。

## 背景

分发与接入是易用链条最后一环短板：`MCP` 挂载要手抄绝对路径并手改盘符（`README.md:65`/`mcp/casey-server.mjs:11-13` 写死 `/mnt/d/...`，摩擦 F10）；`skill` 是 claude code 专属、仓根无 `AGENTS.md`，codex 等非 claude-code agent 无成文入口（F11）；文档通篇假设 `WSL`+Windows 隧道，纯 linux/macos 与各 `OS` 字体无成文路径（F14）；同事移交无成文清单（F12 可文档化部分）。本契约给一条自适应挂载配置打印器 + 一份分家接入·跨平台上手文档 + 仓根 `AGENTS.md`。

## 0. 涟漪勘定与重签（先勘后动）

- **跨契约涟漪（关键）**：新增 `case 'mcp-config':` 会被 `mcp-parity` 的「`CLI` 命令集 ⊆ `MCP` 工具集」派生断言（`tests/_golden/cli-mcp-face.golden.mjs`，正则抓 switch 命令）抓到。定夺：把 `mcp-config` 加进那道断言的 `EXCLUDED` 白名单（`{help, breaker, contract, heal}` → 加 `mcp-config`），并重签 `loop/prd-cli-mcp-face.json` 的 `testChecksums`（只加严白名单、不放松既有断言，Test Ratchet 合法）。**落地次序**：`mcp-parity` 与本契约谁后落，谁负责让 `EXCLUDED` 含 `mcp-config` 并重签；不可各自为政（GRILL D10/D11）。
- **`README.md` 涟漪**：`README.md` 由 `handover-pack.golden.mjs`（`loop/prd-handover-pack.json` 冻）**校验**但**不在其 `testChecksums`**，故改 `README.md` 不必重签 handover-pack；但须仍过 C1（八节锚 `三面/安装/环境验收/凭据/真机链路/MCP 挂载/hooks/分发` 全在 + 凭据卫生：回环 `URL`/无内嵌凭据/带外措辞）与 C3（无 `D:\ctx`）。与 `mcp-parity` 改 `README.md` 的段不同，须协调避免并发编辑同段。
- **`mcp/casey-server.mjs` 头注释**：line 11-13 写死 `/mnt/...`，本契约改为指向 `README`/`casey mcp-config`（注释改、服务行为零变）。不动 `TOOLS`/协议/握手。
- **无冻结 schema 涟漪**：不碰 events/testcase/failure-ledger schema、不碰 `verdict.json`。
- **无新造词**：`mcp-config`/`AGENTS.md`/`config.toml`/`.mcp.json` 是工具或格式名，非新术语，不入 `CONTEXT.md`。

## 1. 改动清单

1. `bin/mcp-config.mjs`（新建）
   - 复用 `lib/paths.mjs` 的 `PROJECT_ROOT` 解析仓根 → `path.join(PROJECT_ROOT,'mcp','casey-server.mjs')` 得挂载脚本绝对路径（GRILL D3，绝不硬编码盘符）。
   - `--agent claude` → 打印 `.mcp.json` 片段（`mcpServers.casey = { command:"node", args:[<绝对路径>] }`）+ 一行 `claude mcp add casey -- node <绝对路径>`（GRILL D4）。
   - `--agent codex` → 打印 `~/.codex/config.toml` 的 `[mcp_servers.casey]` 段（`command`/`args`）。
   - 缺/错 `--agent` → `dieUsage` exit 64，列支持项 `claude`/`codex`（fail-closed，不静默默认，GRILL D4）。
   - `command` 用裸 `node`；尾部一行 `WSL` 侧运行须知（G6，GRILL D5）。
   - 结构上不含 `--sut`、不读 `site.json`/`.auth`（GRILL D6）。
2. `bin/casey.mjs`
   - switch 加 `case 'mcp-config': { const r = runNode(path.join(PROJECT_ROOT,'bin','mcp-config.mjs'), rest); process.exit(r.code); }`（镜像 `ingest`/`record` 写法）。
   - `help()` 增一行（放「分发/接入」或紧随 `selftest`）：`casey mcp-config --agent <claude|codex>  一句吐出各家 MCP 挂载配置`。不引入过时形态（避 `handover-pack` C2 黑名单，不带 `--sut <url>` 明文）。
3. `mcp/casey-server.mjs`
   - 头注释 line 11-13 的写死 `/mnt/...` 挂载示例改为「见 `README`/`casey mcp-config`」（注释改、行为零变，GRILL D10）。不动 `TOOLS`/协议。
4. `AGENTS.md`（仓根新建）
   - 薄路由 + 内核纪律重述 + 权威源清单，指向 `CLAUDE.md`/`CONTEXT.md`/`HANDOFF.md`/`GUARDRAILS.md`/`SKILL.md`/`README.md`（GRILL D7）。不复刻命令表/七相/护栏全文。零凭据真值、零非回环 `URL`、零盘符字面量。
5. `docs/runbooks/onboarding.md`（新建）
   - 三 agent 路径（claude code / codex / pi 留位）+ 四 `OS` 矩阵（node + 字体 + 隧道适用性）+ 同事移交清单（带外补齐：`.auth/`/`site.json`/`cases/`）（GRILL D8/D9）。凭据只写占位、只说带外/不入库。
6. `README.md`
   - `MCP 挂载`段：写死路径改为「跑 `casey mcp-config --agent <claude|codex>` 一句吐出正确挂载配置」；加指向 `AGENTS.md` 与 `docs/runbooks/onboarding.md` 的指针。保八节锚、不引入非回环 `URL`（GRILL D8/D10）。
7. `tests/_golden/distribution.golden.mjs`（新建，红先行）
   - 断言清单见 GOLDEN-TESTPLAN A1–A8：`mcp-config` 两家产合法配置、路径自适应当前仓根（非硬编码盘符）、零凭据零真目标地址、缺/错 agent exit 64、`AGENTS.md` 在场且指向 `CLAUDE.md`、跨平台文档形态、`mcp-config` ∈ `cli-mcp-face` `EXCLUDED`（防跨金牌红）。
8. `tests/_golden/cli-mcp-face.golden.mjs` + `loop/prd-cli-mcp-face.json`
   - `EXCLUDED` 加 `mcp-config` + 重签 `testChecksums`（§0 涟漪，按落地次序与 `mcp-parity` 对齐）。
9. `loop/prd-distribution.json`
   - 由 `acceptance-gate`/`gate` 生成与冻结（`testChecksums` 冻 `distribution.golden.mjs`）；`passes` 只 `gate.mjs` 写。

## 2. 实现次序（红先行）

1. `contract init distribution --lane light`。
2. 先写金牌 `tests/_golden/distribution.golden.mjs` 到目标断言（`mcp-config` 两家合法 + 路径自适应验等 + 零凭据零目标地址 + agent 缺错 exit 64 + `AGENTS.md` 指向 `CLAUDE.md` + 跨平台文档形态 + `mcp-config`∈`EXCLUDED`）；跑一遍验**红基线**（现状无 `mcp-config` 命令、无 `AGENTS.md`、无 `onboarding.md`、`README` 仍硬编码 `/mnt`，应红在这些点，见 GOLDEN 红基线节）。
3. 实现 `bin/mcp-config.mjs` + `bin/casey.mjs` 分派 + `help` 一行；金牌 A1–A5 转绿。
4. 新建 `AGENTS.md` + `docs/runbooks/onboarding.md`；改 `README.md` 挂载段 + 指针；改 `mcp/casey-server.mjs` 头注释；金牌 A6–A7 转绿。
5. 处理跨契约涟漪：`cli-mcp-face` `EXCLUDED` 加 `mcp-config` + 重签 `prd-cli-mcp-face.json`（按与 `mcp-parity` 的落地次序）；金牌 A8 + `cli-mcp-face` 全绿。
6. 涟漪回归（handover-pack 八节锚/凭据卫生、selftest、term-lint）+ gate。

## 3. 验收（红金牌，断言清单见 GOLDEN-TESTPLAN）

- `casey mcp-config --agent claude` exit 0 产合法 `.mcp.json`（`JSON.parse` 通过、`mcpServers.casey.command==='node'`、`args` 末项 `endsWith` `mcp/casey-server.mjs`）；`--agent codex` exit 0 产合法 `[mcp_servers.casey]` 段。
- 配置内路径自适应当前仓根：输出绝对路径 === 独立算的 `path.join(PROJECT_ROOT,'mcp','casey-server.mjs')`（任何 clone 都对）；`bin/mcp-config.mjs` 源码 grep 无 `/mnt/d`、无 `D:\ctx`、无盘符字面量硬编码。
- 零凭据零真目标地址：两家输出无非回环 `://`、无 `cred-gate` `FORBIDDEN_KEYWORDS`（单一事实源）、无 `user:pass@`；命令不读 `site.json`/`.auth`。
- 缺/错 `--agent` fail-closed exit 64（列支持项，不静默产错配置）。
- `AGENTS.md` 在场且指向 `CLAUDE.md`：文件存在、含 `CLAUDE.md`、含内核纪律锚（裁判零 `LLM`/fail-safe/完成是退出码/自然语言操作面/绝不把桩当完成）、无凭据真值、无非回环 `URL`。
- 跨平台文档形态：`onboarding.md`（+ `README` 指针）列全四 `OS`（win/wsl/linux/macos）+ 三 agent（claude code/codex/pi）+ 隧道仅 `WSL` 明示 + 移交清单含带外/不入库；`term-lint` 干净。
- 跨金牌一致：`mcp-config` ∈ `cli-mcp-face` `EXCLUDED`（防新命令未同步 `EXCLUDED` 致 `cli-mcp-face` 金牌红）。
- 涟漪回归：改 `README.md` → `handover-pack.golden.mjs` 全绿（八节锚 + 凭据卫生 + 无 `D:\ctx`）；`selftest --tier1` 无回归；`AGENTS.md`/`onboarding.md`/`README.md` 写入过 `term-lint`；碰 `cli-mcp-face.golden.mjs` 后重签 gate 复跑仍绿。
- 门禁：`node loop-kit/bin/gate.mjs --prd loop/prd-distribution.json` 全 acceptance exit 0。

## 4. route:human 尾巴（非阻断，非本契约 hermetic 验收）

- 真机各 agent 挂载核验（审计 R3）：在 claude code 与 codex 上，用 `casey mcp-config` 产的配置真挂上 `MCP` server，`tools/call` 实跑一条命令，确认能挂能用、无凭据/目标地址泄漏。`mcp-config` 命令本体与红路径 hermetic 可测，但「真挂真调」需各 agent 环境在场。
- pi 上手：待 pi 从可驱动环境真机核验后，`onboarding.md` 的 pi 留位转成成文路径、必要时 `mcp-config` 补 pi 格式（`docs/HANDOFF.md` 记 pi 从本 `WSL` 驱不动）。

## 5. 非目标（本契约不做）

- 不装/不托管/不启动 `MCP` server（`mcp-config` 只打印配置）。
- 不碰业务：不动七相、不动 `run` 编排与 `lib`、不改 `MCP` `TOOLS`/协议（属 `mcp-parity`）。
- 不建 git 远端、不上 npm、不做 `npx casey`（分发链**安装**环节属维护者/另案）。
- 不做 `casey doctor` 就绪自检（C5 另案，full）。
- 不把 `skill` 迁成 codex 自动加载（codex 无此机制，走 `AGENTS.md` + `MCP`）。
- 不暴露 `casey_mcp_config` `MCP` 工具（GRILL D11）。
