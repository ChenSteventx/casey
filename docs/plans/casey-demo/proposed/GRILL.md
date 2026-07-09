# casey-demo 决策记录（GRILL，proposed）

> 契约包起草：`casey demo` —— 一句话零真机零凭据产出一份可打开的样例测试报告，给新用户/新同事「先看到 Casey 产物长啥样」的入口。
> 事实源：`scripts/sample-report.mjs`（现成的 hermetic 样例报告驱动，手写案例三件套 → 串 相3 回放 → 相4 裁定 → 报表模型装配 → 相6 报告）、`bin/casey.mjs` 的 main switch 分发范式与 `runPipeline`（`:67-122`）、`bin/report.mjs`/`bin/report-model.mjs`/`lib/report*.mjs`（相6 渲染，demo 复用而非另造）、`tests/fixtures/publish-sut/server.mjs`（夹具 SUT）、`.claude/skills/casey/SKILL.md`、`README.md`「环境验收」节、`tests/_golden/handover-pack.golden.mjs`（help/README 漂移锁 C2 黑名单）。对应审计条目：`docs/plans/usability-audit/proposed/AUDIT-PLAN.md` 摩擦 F1 / 条目 C2。
> 纪律：零 baton（不 `contract init`、不改 `lib`/`bin`/`web`/`mcp`、不 gate、不提交、不写 `tests/` 金牌），本包只起草。用户操作面只收自然语言，凭据与真目标地址不进任何输出，落点用仓内相对路径、不硬编码盘符。

## 现状诊断（落到文件与行号）

- `scripts/sample-report.mjs` 已能零真机、零凭据跑出一份可离线打开的自包含 `PASS` 报告：手写案例三件套（`events.json`/`expected.json`/`profile.json`，工作流「发布」状态机 happy 场景），启 `tests/fixtures/publish-sut/server.mjs` 夹具 SUT，串既有冻结 bin（`replay.mjs` → `verdict.mjs` → `report-model.mjs` → `report.mjs`），产物落 `runs/sample-wf-publish/`。本包实证跑过：exit 0、2 步全 `PASS`、报告含 `class="badge pass">通过<` 裁定徽章、三产物（html/md/json）全文零 `://` 零 host。
- 但它对用户完全不可见：不是 `CLI` 子命令、`SKILL.md` 动作表没有它、`README.md`「环境验收」只指跑金牌 `node tests/_golden/e2e-chain.golden.mjs`（那是测试、不是「给你看报告」）。`casey selftest --tier1` 不产报告。结果：新同事一句自然语言问不出「样例报告长什么样」，除非上真机。
- 两处待清理的现状瑕疵（本契约顺手收）：
  1. `scripts/sample-report.mjs:85` 的「Windows 打开路径」提示是 `htmlPath.replace('/mnt/d/', 'D:\\')` 字面替换——硬编码 `/mnt/d/`→`D:\`，只对该 WSL 挂载点成立，换机/换盘符/纯 linux/macos 即失真（撞用户跨平台要求）。
  2. `scripts/sample-report.mjs:11` `import { signExpected } from '../tests/_golden/_sign-helper.mjs'`——用生产链引一个测试 helper 给样例断言补签署字段（signedAt/signedAgainstBuild/signerId），是 bin→tests 反向耦合的味道。

## 决策

### D1 demo 产物落点：固定 caseId + 固定 runDir + 清建幂等

- caseId 固定 `tc_wf_publish_sample`（沿用现驱动），不带时间戳（区别于 `casey run` 的 `run_${Date.now()}`）。
- runDir 固定 `runs/sample-wf-publish/`（仓内相对、`runs/` 已 gitignore、跨平台无盘符）。
- 幂等靠「清建」：跑前 `if (existsSync) rmSync` 再重建（现驱动 `:20` 已如此），每次跑落同一处、覆盖上次，产物形态确定。金牌可对固定路径断言，无需扫时间戳目录。

理由：demo 是给人看的固定样例，不是每跑一份新档；固定落点 + 幂等既方便金牌钉死，也让「打开最近样例报告」永远指同一个文件。

### D2 复用相6 而非另造：demo 是编排器、渲染零重写

demo 只做两件事：① 提供一份样例案例数据（`events`/`expected`/`profile` 三件套 + 夹具 SUT，这是 demo 自带的样例语料、不是业务逻辑）；② 串既有冻结 bin 把它跑成报告。相6 的渲染（裁定徽章、期望对实际、缺陷单、自包含 CSS）全在 `lib/report.mjs`，demo 经 `bin/report.mjs` 复用、绝不二次实现一行渲染。

决策：demo 的产物形态与真机 `casey run` 完全同源（同一套 `report-model` 装配 + `lib/report.mjs` 渲染），只是喂的是夹具数据。「样例报告」和「真报告」长一个样，这正是它作为「先看产物长啥样」入口的价值。

### D3 逻辑落 bin 还是 lib：提升为 `bin/demo.mjs`，不进 lib

三个选项：

- 甲（推荐）：把 `scripts/sample-report.mjs` 提升为 `bin/demo.mjs`，`casey demo` 走 `case 'demo': runNode(bin/demo.mjs)`——与 `ingest`/`compile`/`replay`/`verdict`/`report` 六条「薄壳直通各自 bin」范式一致（`casey.mjs:239-253`）。子命令实现落在每个子命令都在的 `bin/`。
- 乙（低涟漪备选）：`scripts/sample-report.mjs` 原地留，`casey demo` 直通到它（`runNode(PROJECT_ROOT/scripts/sample-report.mjs)`）。改动最小、保住历史文档对该脚本的引用，但门面破例直通 `scripts/` 而非 `bin/`。
- 丙（否决）：把编排逻辑提炼进 `lib/`。编排是薄 IO 胶水（起夹具 → spawnSync 串 bin → 打印路径），性质同 `runPipeline`（它也没进 lib），提炼进 lib 无复用收益、徒增面。渲染逻辑本就已在 `lib/report.mjs`，无需再抽。

决策：推荐甲。附带两处顺手清理（不改语义，只去味道）：

- 去 `_sign-helper` 耦合：样例 `expected` 的签署字段（signedAt/signedAgainstBuild/signerId）内联成样例常量直接写进字面量，`bin/demo.mjs` 不再 `import ../tests/_golden/_sign-helper.mjs`（生产 bin 不引测试件）。报告的「期望版本/签署人」投影照旧成立（`report-model` 逐条核 `isSigned`，字段在即投影）。
- 去 `/mnt/d/` 硬编码：打印「可打开路径」时按真实绝对路径给跨平台提示（见 D5），删掉 `:85` 的字面替换。

甲对历史文档引用的涟漪见 plan §三与开放项 1（`docs/HANDOFF.md`、`docs/plans/sign|e2e-chain` 里提到 `scripts/sample-report.mjs` 的历史句会失指）——留实现者/人裁是否顺带刷新，或采乙规避。

### D4 凭据卫生：零真值、零 `://`（实证背书）

- demo 绝不读 `.auth/`、`site.json`，绝不理会 `AT_SITE_JSON`/`AT_CREDS_*` env——它是纯夹具驱动，凭据边界根本不进场（区别于 `casey run` 要 `--sut` 隧道基址）。
- 夹具 SUT 是进程内临时 `http://127.0.0.1:<随机端口>`，只活在回放期内存，实证不进报告：三产物全文 `://` 计数为 0、无 `127.0.0.1`/`localhost`/`http` 明文。
- 报告落盘前照旧过 `bin/report.mjs` 的凭据兜底门（`lib/cred-gate.mjs`，护栏 #7）。demo 不新开任何绕过凭据门的落盘路径。

决策：demo 的凭据卫生是「结构性零」——不接凭据源、夹具地址不进产物——而非「靠脱敏擦干净」。金牌把「零凭据零 `://`」钉成对照断言（GOLDEN A3）。

### D5 `--open` 与路径提示：只打印路径、不自动拉浏览器

- 不做 auto-launch（不 shell `xdg-open`/`open`/`start`）：跨平台脆（四 OS 各一套、headless/CI 无显示器会挂）、且会让 hermetic 金牌卡在打不开的浏览器上。
- 打印「报告已产出，可直接用浏览器打开」+ 该报告的绝对路径；跨平台提示按真实路径算（如需给 Windows 形态用 `path.win32` 或从实际路径推导，绝不字面替换 `/mnt/d/`）。自然语言操作面上，agent 跑完 demo 只把 html 链接回给用户（`SKILL.md` 标准回法）。
- `--open` 旗标本轮不做（列非目标 D9）；若日后要，另议一个显式旗标 + 按 OS 分支的 opener，默认关。

理由：demo 的承诺是「产出一份可打开的报告并告诉你在哪」，不是「替你打开」。少一个跨平台脆点、金牌可 hermetic 收口。

### D6 依赖诚实定位：零真机零凭据零外部服务，但需 chromium

demo 做的是真回放（`replay.mjs` 起真 chromium 打夹具 SUT），所以它**不是** `selftest --tier1` 那种「零外部依赖」——它需要 `npm install` + `npx playwright install chromium`（与 hermetic 回放同级）。

决策：文档如实把 demo 定位在「环境验收」第 2 级（hermetic 回放就绪，需 chromium）伴随位，**不**冒充成第 1 级零依赖自检。措辞统一为「零真机、零凭据、零外部服务，需本机 chromium」。绝不写成「零依赖一句话出报告」误导新同事在没装浏览器时跑它撞红。

### D7 门面 help 措辞避开 handover-pack C2 黑名单

`casey demo` 零参（无 `--sut`、无文件旗标）。help 新增行不得含 `handover-pack.golden.mjs` C2 的过时/诱导形态黑名单：`run <file>`、`--build <id>]`、`P0 引导 + P1 词表/ADR 已落地`、`--sut <url>`。demo 行天然无这些 token（它压根不收 `--sut`）。建议行：`casey demo    零真机零凭据产一份样例测试报告（落 runs/sample-wf-publish/，需 chromium）`。

### D8 MCP `casey_demo` 归属：本契约不加，归 C3/mcp-parity

给 `mcp/casey-server.mjs` 的 `TOOLS` 加 `casey_demo` 会触到 `cli-mcp-face.golden.mjs`（C6 对已声明工具集逐一 deepEq）——那要 re-sign 一个冻结金牌，跨进 C3（`mcp-parity`）的面与车道。

决策：C2 只动 `CLI`（分发 + help）+ `skill` + `README`，hermetic 收口、零 re-sign 任何冻结金牌。`casey_demo` MCP 工具是否顺手补，留 C3/mcp-parity 一并处理（见开放项 2）。

### D9 非目标

- 不真机、不接任何业务用例（demo 恒喂固定夹具样例，不参数化、不吃外部 caseId/文本用例）。
- 不接 `.auth`/`site.json`/`AT_SITE_JSON`/`AT_CREDS_*`——凭据边界不进场。
- 不 auto-launch 浏览器、本轮不加 `--open` 旗标。
- 不改相6 渲染器（`lib/report.mjs`）、不动 `verdict.mjs`/冻结 schema——demo 是它们的纯下游消费者。
- 不加 MCP `casey_demo` 工具（归 C3，避免 re-sign `cli-mcp-face`）。
- 不触真机——本契约无 route:human 尾巴（这正是 demo 相对其他 C 条目的优点：它 hermetic 完整收口，没有「等真机才算真通」的尾巴）。

## 开放项（待人/grill 定）

1. D3 甲/乙取舍：提升为 `bin/demo.mjs`（合门面范式、但历史文档对 `scripts/sample-report.mjs` 的引用会失指，需顺带刷 `docs/HANDOFF.md`/`docs/plans/sign|e2e-chain` 或接受失指）还是原地留脚本、门面直通它（低涟漪、门面破例直通 `scripts/`）？
2. D8：`casey_demo` MCP 工具是否立刻在 C3/mcp-parity 顺手补（让只走 MCP 的 agent 也能看样例报告），还是先只 CLI+skill+README？
3. D5 跨平台路径提示的具体形态（是否给 win32 形态、怎么从真实路径推导不硬编码盘符）——实现者定稿，金牌只钉「不含 `/mnt/d` 字面硬编码」。
4. 无真机尾巴：本契约 hermetic 完整收口，不排 route:human（对照 run-convention/mcp-parity 亦然）。
