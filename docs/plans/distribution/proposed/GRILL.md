# distribution — grill 决策记录（分发与接入：`mcp-config` + 分家接入 + 跨平台上手，light）

> 起草态（零-baton）：本文只落决策，未 `contract init`、未改实现、未 gate、未提交。授权链待 Steven grill 签核。
> 合并易用性审计 C6（摩擦点 F10）+ C7（摩擦点 F11/F12/F14）为一个契约包。事实源：`docs/plans/usability-audit/proposed/AUDIT-PLAN.md`（C6/C7 现状诊断与验收点）、`mcp/casey-server.mjs`、`README.md`、`.claude/skills/casey/SKILL.md`、`lib/paths.mjs`、`loop/GUARDRAILS.md`。
> 与并行子代理产的 `docs/plans/mcp-parity/`（补 `record`/`intake` + 版本对齐）对齐、勿冲突：本契约的 `mcp-config` 依赖 `MCP` 工具集稳定，但不改 `TOOLS`；两契约都碰 `README.md` 与 `cli-mcp-face` 漂移锁，涟漪见 D10。

## 背景

三面统一标识符（`CLAUDE.md`：`CLI` / `skill` / `MCP` server）的分发与接入是易用链条上最后一环短板：

1. `MCP` 挂载要手抄绝对路径（摩擦 F10）。`README.md:65` 与 `mcp/casey-server.mjs:11-13` 都写死 `/mnt/d/ctx/heren/casey/mcp/casey-server.mjs` 并注「路径按 clone 位置替换」。没有一条命令自动从模块位置探测本仓绝对路径、直接吐出正确挂载配置——这是「抄命令 + 手改盘符」反模式，正是战略要消灭的。
2. `skill` 是 claude code 专属（`.claude/skills/casey/`），不迁移到 codex 等非 claude-code agent；仓根无 `AGENTS.md`（摩擦 F11）。codex 走 `AGENTS.md` + `MCP` 上手，当前无成文入口。
3. 文档通篇假设 `WSL` + Windows 隧道（摩擦 F14）。纯 linux / macos 原生用户（`SUT` 直连、无 Windows 隧道）与各 `OS` 字体设置无成文路径。
4. 移交一个同事时，`cases/`/`runs/`/`.auth/`/`site.json` 全不入库，凭据与站点须带外补齐，却无成文移交清单（摩擦 F12 的可文档化部分；建远端/上 npm 属维护者动作、非本契约）。

## D1 车道：light（主体），route:human 只是真机挂载核验尾巴

- 定夺：light。C6 的 `mcp-config` 命令 hermetic 可测（纯启动器输出、不触真机）；C7 是纯文档（`AGENTS.md` + 跨平台上手 runbook + `README.md` 小改）。
- 为何不 full：`mcp-config` 输出只含启动器（`node` + server 脚本绝对路径），无 `--sut`、不读 `site.json`/`.auth`，故无凭据·目标地址回显新面；不碰冻结内核（`verdict.mjs`/`replay.mjs`/断言与 events schema）、不新增多态分支。
- 为何不 direct：新增一个 `bin/mcp-config.mjs` + 一道 `case 'mcp-config':` 分派 + 一道 fail-closed 用法错分支（缺/错 `--agent`）+ 一道新漂移锁金牌，值一道 plan 门；镜像 `mcp-parity`/`cli-mcp-face` 同理由。
- 真机各 agent（claude code / codex）上用 `mcp-config` 产的配置真能挂、`tools/call` 实跑，属 route:human 尾巴（审计 R3），非本契约 hermetic 验收。
- 实现者动 `bin`/`mcp`/`tests/_golden` 前须先 `casey contract init distribution --lane light --reason "..."`；本起草文档只读+写自身，未 `contract init`。

## D2 `mcp-config` 落点：新 `CLI` 子命令 `casey mcp-config`

- 定夺：新增 `bin/mcp-config.mjs`，在 `bin/casey.mjs` 的 `main()` switch 加 `case 'mcp-config':`（薄壳 `runNode` 分派，镜像 `ingest`/`compile`/`record` 现有写法），`help()` 增一行放「分发/接入」一节或紧随 `selftest`。
- 用法：`casey mcp-config --agent <claude|codex>`。属确定性纯打印器，零 `LLM`、零外部依赖、零真机——hermetic。
- 不做成 `mcp/` 内的独立可执行：`mcp-config` 是给「还没挂上 `MCP`」的人看的，天然属 `CLI` 面（薄壳直通仍是 `CLI` 引擎入口的立场，`CLAUDE.md` 三面统一标识符）。

## D3 路径自适应：从模块位置解析仓根，绝不硬编码盘符

- 定夺：`bin/mcp-config.mjs` 复用 `lib/paths.mjs` 的 `PROJECT_ROOT`（该常量由 `fileURLToPath(import.meta.url)` 从模块物理位置向上解析，跨平台经 `node:path`），拼 `path.join(PROJECT_ROOT, 'mcp', 'casey-server.mjs')` 得挂载脚本绝对路径。
- 结果：任何 clone 位置自适应——`WSL` 下产 `/mnt/...`、原生 linux 产 `/home/...`、macos 产 `/Users/...`、Windows 原生产 `C:\...`，全由 `node:path` 按 `path.sep` 生成，源码里绝无任何盘符/固定前缀字面量。
- 这是消灭 F10「手抄改路径」的核心机制：路径由结构派生、不靠人对齐。金牌据此可对任何 clone 验等（D-GOLDEN A3）。
- `handover-pack` C3 硬约束顺带满足：输出与源码一律不得含 `D:\ctx` 形态 Windows 盘符字面量。

## D4 吐哪几家格式：claude code 的 `.mcp.json` + codex 的 `config.toml` 段

- 定夺：
  - `--agent claude` → 打印 claude code 项目级 `.mcp.json` 片段（`mcpServers.casey = { command: "node", args: [<server 绝对路径>] }`），并附一行等效 `claude mcp add casey -- node <绝对路径>` 命令（两形态都给：`.mcp.json` 可粘进项目、`claude mcp add` 可直接跑）。
  - `--agent codex` → 打印 `~/.codex/config.toml` 的 `[mcp_servers.casey]` 段（`command = "node"` / `args = [<绝对路径>]`）。
- 缺/错 `--agent`：fail-closed `exit 64`，报文列出支持的 agent 名集（`claude`/`codex`），**绝不**静默默认成某一家而产出可能错配的配置（决策：不设默认目标；宁可让用户点名，避免把 claude 配置错喂给 codex）。
- 为何这两家：claude code 与 codex 是当前实际接入目标（审计视角乙）；pi 从本 `WSL` shell 驱不动（`docs/HANDOFF.md` 有账），故 pi 只在上手文档留位、不在 `mcp-config` 出格式（待 pi 真机核验后另补）。

## D5 `node` 可执行：用裸 `node`（PATH 解析）+ `WSL` 侧运行须知

- 定夺：挂载配置的 `command` 用裸 `node`（依赖 `PATH`、可移植、镜像 `README.md`/`casey-server.mjs` 现状），不用 `process.execPath` 绝对路径（机器绑定、换机即失真，且属无谓的本机路径外泄）。
- 附须知：命令输出尾部带一行「在你将实际跑 casey 的那一侧运行本命令」的提示，复述既有 G6 人签约束——回放依赖 Linux 侧 playwright，`WSL`+Windows 组合务必在 `WSL` 侧挂载/运行，Windows 原生侧挂载必败。这条须知不含任何目标地址/凭据。
- `mcp-config` 只探测「本命令在哪一侧被调用」的现成事实（`PROJECT_ROOT` 已隐含），不做跨侧路径翻译（不把 `/mnt/d` 猜成 `D:\`）——翻译会引脆，honest 地按调用侧产配置 + 给须知即可。

## D6 零凭据·零真目标地址：挂载配置是纯启动器

- 定夺：`mcp-config` 输出只含 `command` + `args`（`node` + server 脚本路径），结构上**不含** `--sut`、不含 `site.json`/`.auth` 任何字段、不含真目标地址。命令实现绝不读 `site.json`/`.auth`（无 import、无 fs 读那两处）。
- 金牌据此验（D-GOLDEN A4）：两家输出均无非回环 `://`、无 `cred-gate` 的 `FORBIDDEN_KEYWORDS`（单一事实源 `lib/cred-gate.mjs`）、无 `user:pass@` 内嵌凭据形态。挂载配置天然干净，这道断言把「日后有人往里塞 `--sut`」挡在红线外。

## D7 `AGENTS.md` 内容边界：薄路由 + 内核纪律重述，指向 `CLAUDE.md` 不重复

- 定夺：仓根新建 `AGENTS.md`，是给 codex 等无 `skill` 自动加载机制的 agent 的等效上手入口。内容边界：
  - **一句话说 Casey 是什么** + 指向 `README.md`/`CLAUDE.md`（不复述七相细节）。
  - **接入指路**：`CLI` 面看 `node bin/casey.mjs help`；`MCP` 挂载跑 `casey mcp-config --agent codex`；详细跨平台上手指向 `docs/runbooks/onboarding.md`。
  - **内核纪律重述**（codex 首次上手绝不可违反的不可让渡项，浓缩自 `SKILL.md`）：用户操作面只收自然语言、底层 `CLI` 参数由 agent 内部处理绝不要求用户复制命令、裁判零 `LLM`、fail-safe 不 fail-open、完成是退出码、绝不把桩（`heal` exit 3）当完成、凭据与目标地址不进任何输出。完整自然语言动作表指向 `.claude/skills/casey/SKILL.md`（同一份纪律的权威源）。
  - **权威源清单**：`CLAUDE.md`（必读顺序）→ `CONTEXT.md`（统一语言）→ `docs/HANDOFF.md`（当前状态）→ `loop/GUARDRAILS.md`（护栏）→ `docs/adr/`。
- 不做：不在 `AGENTS.md` 复刻命令映射表、不复刻七相流程、不复刻护栏全文——一律指针，避免双份维护漂移（同 `handover-pack` 防双倍维护立场）。
- 无凭据真值、无非回环 `URL`、无盘符字面量。

## D8 跨平台文档结构：新 `docs/runbooks/onboarding.md` + `README.md` 最小改

- 定夺：详细上手落新 `docs/runbooks/onboarding.md`（镜像既有 runbook 落点，`README.md` 保持精简），覆盖：
  - **三 agent 路径**：claude code（`skill` 自动加载 + `casey mcp-config --agent claude`）/ codex（`AGENTS.md` + `casey mcp-config --agent codex` → `config.toml`）/ pi（若支持 `MCP` 则同 codex 法，当前留位待真机核验）。
  - **四 `OS` 矩阵**：win / wsl / linux / macos 的 node 就位、字体设置（`WSL`/linux 用 `fc-list :lang=zh` + 装 Noto Sans CJK；macos 系统内置 CJK 字体、必要时 Font Book 核实；Windows 系统内置微软雅黑，但回放须走 `WSL` 侧 per G6）、隧道适用性（反向隧道**仅** `WSL`+Windows 组合需要；纯 linux/macos 原生 `SUT` 直连不要 Windows 隧道，`--sut` 仍只喂隧道回环基址或本地代理基址，真目标地址绝不进命令行）。
  - **同事移交清单**：要带外补齐什么——凭据（`.auth/`）、`site.json`、`cases/`（全 gitignored），只说「带外补齐/不入库」，绝不写真值。
- `README.md` 只做最小改：`MCP 挂载`段把写死路径改为「跑 `casey mcp-config --agent <claude|codex>` 一句吐出正确挂载配置」+ 加指向 `AGENTS.md` 与 `docs/runbooks/onboarding.md` 的指针。**保 `handover-pack` 八节锚全在**（`三面`/`安装`/`环境验收`/`凭据`/`真机链路`/`MCP 挂载`/`hooks`/`分发`），不引入非回环 `URL`，不破凭据卫生（D10 涟漪）。

## D9 凭据带外·`site.json` 不入库怎么写清

- 定夺：`AGENTS.md`、`onboarding.md`、`README.md` 涉凭据处一律只写字段形状占位（`<账号>`/`<口令>`，镜像 `README.md` 现有凭据节），只说「真值带外交付、绝不入库/提交/回显」，绝不写任何真值、真目标地址、真隧道端口范围之外的敏感项。
- 移交清单只列「要带外补齐什么」（凭据 / `site.json` / `cases/`），不写「补成什么值」。目标地址只活在 `site.json`（护栏 #7），文档一律不落。

## D10 涟漪勘定与重签（跨契约，先勘后动）

- **跨契约涟漪（关键，与 `mcp-parity` 咬合）**：本契约新增 `case 'mcp-config':`，会被 `mcp-parity` D5 的「`CLI` 命令集 ⊆ `MCP` 工具集」派生断言（正则 `/case '([a-z][a-z-]*)':/g` 抓 switch 命令）抓到 → 若不处理，`cli-mcp-face` 金牌会要求 `casey_mcp_config` ∈ `MCP` 工具集而红。定夺：把 `mcp-config` 加进那道断言的 `EXCLUDED` 白名单（现 `{help, breaker, contract, heal}` → 加 `mcp-config`），语义同 `breaker`/`contract`：分发/setup 命令、非测试消费者该驱动的能力、不暴露为 `MCP` 工具（D11）。编辑 `tests/_golden/cli-mcp-face.golden.mjs` 的 `EXCLUDED` 后须重签 `loop/prd-cli-mcp-face.json` 的 `testChecksums`——这是**加严白名单留痕**（新命令故意不进 `MCP` 也得过目），属 Test Ratchet 合法。
  - **落地次序依赖**：若 `mcp-parity`（含那道派生断言）先落，本契约落 `mcp-config` 时必须同笔更新 `EXCLUDED` + 重签，否则 `cli-mcp-face` 金牌红；若本契约先落，则 `mcp-parity` 起草时 `EXCLUDED` 应已含 `mcp-config`。实现者按落地顺序对齐，二者不可各自为政。
- **`README.md` 涟漪**：`README.md` 内容由 `loop/prd-handover-pack.json` 冻的 `tests/_golden/handover-pack.golden.mjs`**校验**（`README.md` 本身不在 `testChecksums`，故改 `README.md` 不必重签 handover-pack）。但改后须仍过 handover-pack C1（八节锚全在 + 凭据卫生：回环 `URL`/无内嵌凭据/带外交付措辞）与 C3（无 `D:\ctx`）。与 `mcp-parity` 对 `README.md` 的「12→14 工具口径」改动落在不同段（`mcp-parity` 改工具数句、本契约改挂载写法 + 加指针），须协调不互踩、避免并发编辑同段冲突。
- **无冻结 schema 涟漪**：不碰 events/testcase/failure-ledger 等冻结 schema、不碰 `verdict.json`。
- **`mcp/casey-server.mjs` 头注释**：line 11-13 写死 `/mnt/...` 路径，本契约改为指向 `README`/`casey mcp-config`。属注释改（服务行为零变），仍算碰 `mcp/`——在 light 车道 `contract` 内允许；不动 `TOOLS`/协议/握手（那是 `mcp-parity` 的地盘）。
- **无新造词**：`mcp-config`/`AGENTS.md`/`config.toml`/`.mcp.json`/`codex`/`claude code` 是工具或格式名（代码体书写、非加粗英文术语），非新领域概念，不入 `CONTEXT.md`；「挂载配置打印器」「分家接入」「上手文档」是描述性中文短语、非注册术语。

## D11 `mcp-config` 不暴露为 `MCP` 工具

- 定夺：`mcp-config` 保持不进 `MCP` 面。两个理由：
  - **bootstrap 循环依赖**：要挂上 `MCP` server 才能调 `MCP` 工具；而挂载配置正是「挂之前」需要的东西——从 `MCP` 里取它是循环。正确面是 `CLI` + `README`/`AGENTS.md`。
  - **属 setup/分发命令**：与 `breaker`/`contract` 同类（开发/接入台账、非测试消费者能力），镜像 `MCP` 面只暴露 `lint`/`gate` 而不暴露 `breaker`/`contract` 的既有取舍。
- 故它进 D10 的 `EXCLUDED` 白名单而非 `MCP` `TOOLS`。日后若判定 codex 挂载后仍需经 `MCP` 拿配置，另契约再议——默认不暴露。

## D12 非目标（本契约不做）

- 不装、不托管、不启动 `MCP` server（`mcp-config` 只**打印**配置，挂载动作归用户/agent）。
- 不碰业务：不动七相、不动 `run` 编排、不动 `lib` 裁判/回放、不新增/改 `MCP` `TOOLS`（那是 `mcp-parity`）。
- 不建 git 远端、不上 npm、不做 `npx casey`（分发链的**安装**环节属维护者动作/另案，`README.md`「分发现状」已有账；本契约只解**挂载 + 接入文档**）。
- 不做 `casey doctor` 就绪度自检（属 C5 另案，full 车道）。
- 不把 `skill` 迁成 codex 的自动加载（codex 无此机制，走 `AGENTS.md` + `MCP`）。
- 不碰凭据·目标地址边界（护栏 #7）——`mcp-config` 结构上不接触，文档只写占位。
