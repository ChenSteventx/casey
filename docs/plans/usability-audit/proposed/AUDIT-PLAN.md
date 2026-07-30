# Casey 用户易用性审计 + 优先级改进规划（proposed）

> 战略 item 3「用户易操作」的规划文档。只做审计与排期，不含实现、不碰 loop 契约 baton、不 `contract init`、不改 `lib`/`bin`/`web`、不提交。
> 事实源：本文所有「现状」结论均落到具体文件/命令/退出码，采集自 2026-07-09 快照（最新提交 `d9a39df`，`intake.mjs` 于 07-09 07:51 刚落）。
> 内核纪律贯穿全篇：用户操作面只收自然语言、绝不要求用户复制命令、绝不把桩当完成、凭据与目标地址不进任何输出、跨平台（win/wsl/linux/macos）适配。

## 一、审计方法与两个视角

- 视角甲「新同事把一段文本用例跑成报告」：从零上下文的人/代理出发，走相0 归一 → 相6 报告，找哪一步卡住、哪一步逼人抄命令、哪一步桩被当完成。
- 视角乙「把 Casey 接入各家 coding agent」：`CLI` + `MCP` + `skill` 三面怎么装上、挂载、分发到 claude code / codex / pi，凭据怎么带外补齐。
- 逐面覆盖：`CLI`（`bin/casey.mjs`）/ `MCP`（`mcp/casey-server.mjs`）/ `skill`（`.claude/skills/casey/SKILL.md`）/ `README.md` / `docs/runbooks/`。

## 二、现状审计（逐面摩擦点，具体到文件/命令/退出码）

### 视角甲：新同事「文本用例 → 报告」

- 摩擦 F1（头等）— 没有对用户可见的「零真机看一份报告」入口。`scripts/sample-report.mjs` 已经能零真机、零凭据、零外部依赖跑出一份可离线打开的自包含 `PASS` 报告（落 `runs/sample-wf-publish/`），但它对用户完全不可见：不是 `CLI` 子命令、`SKILL.md` 动作表没有它、`README.md`「环境验收」第 2 级指的是跑金牌测试 `node tests/_golden/e2e-chain.golden.mjs`（那是测试、不是「给你看报告」）。`casey selftest --tier1` 不产报告。结果：新同事一句自然语言问不出「样例报告长什么样」，除非上真机。

- 摩擦 F2（头等）— `casey run` 逼人抄长命令。`runPipeline`（`bin/casey.mjs:63` 起）要求显式传 `--events --expected --profile`，`--observed`/`--case-meta` 也得手带全路径，缺必填参直接 `exit 64`。`cases/<caseId>/` 有清晰约定布局（`events.json`/`expected.frozen.json`/`profile.json`/`observed-<caseId>.json`/`testcase.json`），`lib/paths.mjs:29` 还有 `casePaths(caseId)` 助手——但 `casey.mjs:25` 把它 import 进来后从没用过（死 import），且它的字段形状（`spec.ts`/`report.html`）跟真实布局对不上。后果：`docs/runbooks/real-zero-error-examples.md:34-45` 只能贴一段 8 行 `RUN_ID=...` 的 bash 复制块——正是战略要消灭的「抄命令」反模式。缺 `--observed`/`--case-meta` 时报告静默降级（「期望版本：未签」、`naturalLanguage` 缺失）却不告警。

- 摩擦 F3（头等）— 前半段（相0-2）把重活甩给代理在 `CLI` 外手搓 JSON，且无脚手架。`casey ingest` 要候选 `TestCase` JSON（受 `tests/_golden/schemas/testcase.schema.json` 冻结形态约束），`casey flow-bridge` 要 mapping JSON（受 16 个 `COMPILE_KNOWN_ATOMS` 允许集约束），`casey draft --patch` 要 LLM 补缝 JSON。这些都得代理自己产、闸全是 fail-closed `exit 65`，回给代理的是一句冷拒绝。`SKILL.md` 只在动作表说「代理自行判断」，没把可用的 prompt 模板（`proposed/llm-patch.draft.md` 一类）指出来。新用例过闸失败率高、无 `casey ingest --from-text` 之类的自然语言直吃入口。

- 摩擦 F4 — 全新 `SUT`/用例没有 hermetic 到报告的路。相1 `compile --execute` 必打真机（要隧道 + 凭据），所以任何全新用例的第一份报告一定是 route:human。`skill` 的自然语言承诺「把这段用例在中台上测一遍」对全新用例 hermetic 兑现不了，必须升级到真机；而这条 route:human 边界埋在 `SKILL.md:81` 的「当前进度」小字里，代理容易先应承再发现做不了。

- 摩擦 F5 — `--profile`（通道剖面）每通道要手写（背景 denylist + 错误信封成功字段），无 `casey init-profile` 脚手架，新通道 = 手搓一份 JSON。

- 摩擦 F6 — `skill` 把 `tc_wf_history_version` 硬编码成「那个 0 error 用例」（`SKILL.md:32`），但 `docs/runbooks/real-zero-error-examples.md:9-11` 已如实记录：`tc_catalog_wf_crud`、`tc_wf_publish_states` 两条 2026-07-08 现场复跑从历史绿退成非绿。一旦历史版本这条也漂移，`skill`「跑一个真实 0 error 用例」的承诺会静默失真。没有机制让 `skill` 声称的 0-error 用例跟 runbook 现实对齐。

### 视角乙：接入各家 coding agent + 分发

- 摩擦 F7（接入头等）— `MCP` 面落后于 `CLI` 面，且本该盯住它的漂移锁盯不到。`casey record`（示教录制）与 `casey intake`（示教入账）已是真 `CLI` 命令（`casey.mjs:245`/`247` 分派到真实现 `bin/record.mjs`、`bin/intake.mjs`，`intake` 07-09 刚落），但 `mcp/casey-server.mjs` 的 `TOOLS` 仍是 12 个（`selftest`/`lint`/`gate`/`ingest`/`flow_bridge`/`compile`/`draft`/`sign`/`replay`/`verdict`/`report`/`run`），没有 `casey_record`、`casey_intake`（`heal` 也没暴露）。`tests/_golden/cli-mcp-face.golden.mjs:120` 的 C6 只对这 12 个已声明工具做 `toArgs` 逐一 deepEq，**不**校验「`CLI` 生命周期命令集 ⊆ `MCP` 工具集」，所以新增命令没进 `MCP` 时金牌照绿。`README.md:69` 的「12 个工具…签名与 CLI 真面对齐并有漂移锁金牌盯防」因此成了过时话。后果：只走 `MCP` 的 agent（codex 等）根本做不了示教录制/入账。

- 摩擦 F8 — `skill` 的命令映射表也落后于 `CLI`。`SKILL.md:57-72` 的「底层命令映射（仅供代理内部执行）」整张表没有 `record`、`intake`；`record` 只在上面的自然语言动作表出现一次、`intake` 全篇没有可执行签名。代理照这张权威表干活会漏掉这两条。

- 摩擦 F9 — 版本号漂移：`package.json:3` 是 `0.1.0`，`mcp/casey-server.mjs:22` 的 `SERVER_INFO` 是 `0.2.0`。分发者/agent 两处看到不一致。

- 摩擦 F10（分发）— `MCP` 挂载要手抄绝对路径。`README.md:65` 与 `casey-server.mjs:12` 都写死 `/mnt/d/ctx/heren/casey/mcp/casey-server.mjs` 并注「路径按你的 clone 位置替换」。没有 `casey mcp-config`/print-install 之类命令自动探测本仓绝对路径、直接吐出正确的 `claude mcp add` 行或 codex `config.toml` 段。这是「抄命令 + 手改」步骤，跟易用目标相悖。

- 摩擦 F11（分发/跨平台）— `skill` 只对 claude code 有效（`.claude/skills/casey/`），不迁移到 codex（走 `AGENTS.md` + `MCP`）或 pi。没有分家的接入指引：claude code（skill 自动加载 + mcp add）/ codex（`~/.codex/config.toml` 的 `mcp_servers` + 一份 `AGENTS.md` 指路）/ pi（若支持 `MCP`）。`README.md` 只写了 claude code 的 mcp add，仓根没有 `AGENTS.md`。`docs/HANDOFF.md` 还记着 pi 从本 `WSL` shell 驱不动。

- 摩擦 F12（分发）— 本仓无 git 远端、`package.json` `private:true`、不在 npm 上（`README.md:79`「分发现状」）。分发只有「整目录拷贝 / `git bundle`」，别家仓上的 agent 无法 `npx casey`。`cases/`/`runs/`/`.auth/`/`site.json` 全 gitignored，拷过去的 clone 零可跑用例、无凭据，新站点得全部重造 + 凭据带外补齐。移交一个同事 = 一大坨手工活。

- 摩擦 F13（上手/跨平台）— 没有 `casey doctor`/`casey setup` 一条命令自检就绪度：node ≥ 22.12、`@playwright/test`、chromium、中文字体（`WSL`/linux 用 `fc-list`，macos/win 各不同）、凭据在位、隧道通不通。上手全靠 `README.md` 三级手动验收；`README.md:31` 明说 `selftest --tier1`「不验浏览器/凭据/隧道」。新同事没有一发入魂的「我齐了吗」。

- 摩擦 F14（跨平台）— 文档通篇假设 `WSL` + Windows 隧道（`README.md`、`docs/HANDOFF.md`、两 runbook、`scripts/win-forward-start.cmd`/`wsl-reverse-listen.mjs`）。纯 linux / macos 原生用户（`SUT` 直连、不要 Windows 隧道）没有成文路径；字体检查命令 `fc-list` 只对 linux。按用户跨平台要求（win/wsl/linux/macos），非 `WSL` 的上手路径缺文档。

## 三、接入分发现状小结

- 能带走的只有 `CLI` + `MCP`；`skill` 是 claude code 专属、不迁移。
- 现状缺口按分发链条：安装（无 `npx`/无远端、只能拷目录）→ 就绪自检（无 `doctor`）→ `MCP` 挂载（要手抄绝对路径，`MCP` 还缺 `record`/`intake`）→ 凭据带外（`site.json`/`.auth` 全靠人工带、无演练脚本）→ skill 分发（仅 claude code、无 codex `AGENTS.md`）。
- 每一环都还要人做手工决定或抄命令，与「操作面只收自然语言」的目标有明确差距。

## 四、优先级改进清单（可评审小契约，按性价比排序）

> 每条给：要解决的摩擦 / 动哪面 / 验收点 / 建议车道 / 是否触真机 route:human。车道判据同项目纪律：direct=纯文档或地板改；light=加 plan 门；full=碰冻结内核/凭据·目标地址边界/新命令多分支。
> 「触真机」= 该契约本体能否 hermetic 收口；标 route:human 的仅指其真机验证尾巴。以下 C1–C8 全部机器可独立推（hermetic）。

### A 组：hermetic、机器可独立推（按性价比降序）

1. C1 `casey run <caseId>` 约定解析（解 F2）。
   - 动面：`CLI`（`bin/casey.mjs` 的 `runPipeline` + 复活/修正 `lib/paths.mjs` 的 `casePaths`）。
   - 做什么：只给 `caseId` 时按 `cases/<caseId>/` 约定解析 events/expected.frozen/profile/observed-<caseId>/testcase；显式旗标覆盖约定；缺可选件（observed/case-meta）打**可见告警**说明报告会降级；缺必填件 `exit 64` 并点名缺哪件（不回显敏感路径）。
   - 验收点：金牌——`casey run tc_x`（仅 caseId）解析齐 5 件并跑通；显式旗标优先于约定；缺可选件有告警行；缺必填件 `exit 64`；修正 `casePaths` 字段形状对齐真实布局、去死 import。
   - 车道：light（改 dispatch + lib，有 fail-closed 分支值一道 plan）。触真机：否。

2. C3 `MCP` 面补齐 + 漂移锁加固（解 F7、F9）。
   - 动面：`MCP`（`mcp/casey-server.mjs` `TOOLS`）+ 金牌（`cli-mcp-face.golden.mjs`）+ `package.json`。
   - 做什么：补 `casey_record`、`casey_intake` 工具（`heal` 按 exit-3 语义决定是否暴露）；`package.json` 版本单一事实源对齐 `SERVER_INFO`；金牌加覆盖断言——每个 `CLI` 生命周期命令都有对应 `MCP` 工具，`CLI` 长了 `MCP` 没跟 = 红。
   - 验收点：金牌断言 `CLI` 生命周期命令集 ⊆ `MCP` 工具集；`record`/`intake` 的 `toArgs` deepEq；版本两处一致。
   - 车道：light（碰 `MCP` + `tests/_golden`，须 `contract init`，本规划不代做）。触真机：否。

3. C2 hermetic 样例报告转正（解 F1）。
   - 动面：`CLI` + `skill` + `README.md`。
   - 做什么：把 `scripts/sample-report.mjs` 提升为 `casey demo`（或 `casey sample`）子命令，并进 `SKILL.md` 动作表「看样例报告」一行 + `README.md`「环境验收」列为可跑项。一句自然语言「给我看一份样例报告」→ 代理跑它 → 回一个可打开的 HTML，零真机零凭据。
   - 验收点：`casey demo` `exit 0` 且落 `runs/sample-*/*.report.html` 全 `PASS`；`SKILL.md` 动作表有该行；`README.md` 列出。
   - 车道：light。触真机：否。

4. C4 `skill` 命令映射补齐 + C8 0-error 用例去脆（解 F8、F6）。
   - 动面：`skill`（`SKILL.md`，纯文档）+ runbook 引用。
   - 做什么：底层命令映射表补 `record`、`intake` 真实签名（并注 `MCP` 侧待 C3）；把「跑一个真实 0 error 用例」从硬编码某用例，改成以 `docs/runbooks/real-zero-error-examples.md` 为单一事实源、且代理声称 0-error 前必先 `verify-zero-error-report` 现验，绝不拿历史绿当数。
   - 验收点：`term-lint` 干净；两命令签名与 `CLI` help 逐字对齐；`SKILL.md` 不再无验证地断言某用例 0-error。
   - 车道：direct（纯文档）。触真机：否。

5. C6 `casey mcp-config` 挂载配置打印器（解 F10、部分 F11）。
   - 动面：`CLI` + `README.md` + 新 `AGENTS.md`。
   - 做什么：命令自动从模块位置解析本仓绝对路径，按 agent 吐正确挂载配置：claude code 的 `claude mcp add casey -- node <abs>`；codex 的 `~/.codex/config.toml` 的 `[mcp_servers.casey]` 段。消灭手抄改路径那步。
   - 验收点：`casey mcp-config --agent claude|codex` 打印的绝对路径由模块位置真实解析、无写死 `/mnt/d`。
   - 车道：light。触真机：否。

6. C5 `casey doctor` 就绪度自检（解 F13、部分 F14）。
   - 动面：`CLI` + `README.md`。
   - 做什么：一条命令查 node 版本、`@playwright/test` + chromium、中文字体（按 OS：linux/`WSL` 用 `fc-list`，macos/win 各走各法）、凭据在位（只查在不在、不读内容）、隧道可达（只回状态码、不回显目标地址）；按 OS 给补救提示。
   - 验收点：hermetic 环境能跑，报 node/playwright/字体状态且不回显凭据/目标地址；机制就绪 `exit 0`、缺项非零并列清单。
   - 车道：full（新命令、跨平台分支、碰凭据/目标地址回显边界，绝不泄漏）。触真机：隧道绿路径要真隧道才验（route:human 尾巴），命令本体与红路径 hermetic 可测。

7. C7 分家接入 + 跨平台上手文档 + `AGENTS.md`（解 F11、F12、F14）。
   - 动面：`README.md`/runbook + 仓根 `AGENTS.md`。
   - 做什么：一节覆盖 claude code（skill + mcp）/ codex（`AGENTS.md` + `config.toml` `mcp_servers`）/ 非 `WSL`（linux、macos 直连 `SUT`）路径 + 各 OS 字体设置；外加同事移交清单（要带外补齐什么：凭据、`site.json`、`cases/`）。加仓根 `AGENTS.md` 把 codex 类 agent 指向 `CLI` + `MCP`。
   - 验收点：文档列全四 OS 路径 + 三 agent；`term-lint` 干净；无目标地址/凭据值。
   - 车道：light（文档）。触真机：否（各 agent 真机挂载核验是 route:human 尾巴）。

8. C9 前半段脚手架（解 F3、F5）。
   - 动面：`CLI`（`ingest`/`compile` 前段、LLM 边界）+ `skill`。
   - 做什么：`casey ingest --from-text` 或把候选/mapping/补缝的 prompt 模板在 `skill` 里指明；`casey init-profile` 脚手架吐一份最小通道剖面骨架。
   - 验收点：脚手架 + 各闸 hermetic 可测；模板产出能过 `testcase.schema.json` 与 16-atom 允许集。
   - 车道：full（碰相0-2 前段与 LLM 边界）。触真机：脚手架与闸 hermetic 可测，但全新用例端到端只有真机才算真通（route:human 尾巴）——故排最后。

### B 组：需真机 / 需 Steven 在场（route:human，按 Steven 2026-07-08 重排，优先级低于 A 组）

- R1 全新用例真机 compile bring-up（F4 本质）：任何新用例第一份报告固定 route:human，要拉反向隧道 + `autotest` 账户 + Steven 在场。
- R2 重新确立当前 0-error 用例集（F6 真机侧）：真机复跑 `tc_catalog_wf_crud`/`tc_wf_publish_states` 看 `SUT` 是否恢复，需隧道 + Steven + `autotest`。
- R3 各 agent 真机挂载核验（F11 尾巴）：codex/pi 上 `MCP` 真能挂能用，route:human。
- R4 示教录制/入账真机走一次（`record`/`intake`，已在 `docs/HANDOFF.md` 下一步单里）：拉隧道 + `autotest` + 包内卫生目检。

## 五、纪律守则（本规划自我约束，交给实现者继承）

- 用户操作面只收自然语言：C1/C2 的落点都是「一句话 → 代理内部跑 → 只回结果」，绝不把多旗标命令当使用说明抛给用户。
- 绝不把桩当完成：`heal` 是唯一诚实桩（`exit 3`），C3 若暴露 `casey_heal` 须透传 exit-3 语义，报告/结论一律来自真回放 + `verdict.json`。
- 凭据与目标地址不进任何输出：C5 隧道检查只回状态码、C6 只吐绝对路径不吐 `site.json` 内容、C7 移交清单只说「带外补齐」不写真值。
- 跨平台适配：C5/C7 按 win/wsl/linux/macos 分支给字体与隧道路径，不默认 `WSL`。
- 阶段互锁：以上任何一条动 `lib`/`bin`/`mcp`/`tests/_golden` 前，实现者须先 `casey contract init <slug> --lane <...>`；本规划文档只读+写自身，未 `contract init`、未 gate、未提交。
