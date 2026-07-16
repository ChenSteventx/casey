---
name: casey
description: 用自然语言安全配置或检查 Casey 账户、把测试用例跑成测试报告，或启动示教录制。当用户说“配置中台账户”“检查账户状态”“跑一下历史版本用例”“把这段用例测一遍”“生成测试报告”“我要手动录制”时使用。用户操作面必须只收自然语言；底层 CLI/MCP 参数由代理内部处理，绝不要求用户复制命令，绝不把桩当成已完成。
---

# casey — 自然语言 → 测试报告

本 skill 的用户操作面只接受自然语言。真正的活由 `bin/casey.mjs`、Windows 原生 `scripts/install.ps1` / `scripts/casey.ps1` 与 `loop-kit/bin/*` 干（在仓根执行），但命令、路径、参数是代理内部实现细节，不作为用户要手动复制的步骤输出。win32 内优先使用 PowerShell 操作面；`WSL2` / Linux / macOS 使用对应 Node.js 运行面，不能混挂两侧 Node.js、Playwright 或 `MCP`。

## 用户怎么说

用户只需要这样说：

- “帮我安全配置 AI 中台账户，不要在对话或日志里显示账户值。”
- “在这台 Windows 上安装并检查 Casey；不要连接任何被测系统。”
- “启动 Windows 回环代理并检查状态；不要把本地端口当成真站已通。”
- “配置医生站和 Hi 小助的本地账户引用，并检查是否就绪。”
- “帮我跑刚刚那个历史版本用例，生成测试报告。”
- “跑一个 0 error 的真实用例给我看报告。”
- “我要手动录制一个新流程，名字叫采购审批冒烟。”
- “在医生站和 Hi 小助里手动录一遍这个流程，然后回放给我看。”
- “把这段用例在中台上测一遍，出 HTML 报告。”
- “打开最近一次报告给我看。”
- “给我看一份样例报告 / Casey 产物长啥样 / 先看看报告长什么样。”

代理职责：

1. 自行判断可用入口：已有签署用例走回放报告；新自然语言用例先走归一/编译/草拟/人签流程；手动操作走示教录制。
2. 自行检查环境：仓根、反向隧道、本地基址、凭据文件是否具备；缺失时用一句自然语言说明缺什么，不输出复杂命令清单。
3. 自行执行底层命令，最后只给用户报告链接、四态计数、是否 0 error、失败原因摘要。
4. 用户明确问“给我命令”时才展示命令；否则不要把 CLI 参数当成使用说明。
5. 严格区分 PowerShell 三层状态：`REAL_SUT NOT_VERIFIED` = 本机安装完成；`LOCAL_PROXY_READY` = 本地代理进程/端口就绪；`REAL_SUT_HTTP_NOT_VERIFIED` = 真实环境前置已检查但尚无 HTTP 证据。三者都不是测试 PASS。

自动化失败后的示教分流（代理编排规则，不进入 `verdict.mjs`）：

| 已确认事实 | 处理 |
|---|---|
| 环境、网络、隧道或登录未就绪 | 停止行为测试并修前置；不得打开录制器掩盖环境失败。 |
| 有取证背书的 `SUT_DEFECT` | 保留缺陷与录屏，不转示教、不重写为 PASS。 |
| 真实网络和安全会话就绪，但编译找不到支持原子或裁定为已确证 `HARNESS_ERROR` | 转人工示教；web 走 `record`，唯一 CEF page 走 `cef-record`。采集完成仍只算语料。 |
| 动作歧义、可能破坏业务数据、非专用账户或出现真实患者数据 | 停下等人确认；不得默认操作。 |

## 内部动作表（不要直接要求用户照抄）

| 自然语言意图 | 代理内部动作 |
|---|---|
| “在 Windows 安装/检查 Casey” | win32 内部调用 PowerShell 安装/检验面；只做零 SUT 安装验收。成功也必须回复 `REAL_SUT NOT_VERIFIED`，不得声称真机可用。 |
| “启动/检查/停止 Windows 回环代理” | win32 内部分别调用 PowerShell 的 proxy start/status/stop 动作；只接受 `LOCAL_PROXY_READY` 为本地进程状态。启动前真值只从 gitignored `site.json` 读，绝不把目标放入 argv/回复；真实 HTTP 另行取证。 |
| “配置 AI 中台账户” | 内部启动 `account configure ai-middle` 的隐藏交互；无人可接 TTY 时只允许经安全 stdin 或预置环境导入。绝不要求用户把账户或口令粘贴进聊天，绝不把值放 argv。成功后只回复“已配置且接入登录预备动作”，不回复值或本机路径。 |
| “配置医生站和 Hi 小助账户” | 只配置安全的本地账户引用与人工就绪布尔，不采集或声称登录页面规则；成功后明确自动登录未验证，真实录制仍须人工安全会话。 |
| “检查账户状态” | 内部跑 `account status`；只回复中台账户是否在位/形状有效/已接登录预备动作，以及桌面账户引用是否在位/是否人工就绪。不得回复账户名、口令、引用字面量或绝对路径。 |
| “跑刚刚那个历史版本用例/跑历史版本报告” | 跑 `tc_wf_history_version`，生成报告后用 `verify-zero-error-report` 校验，返回 HTML/MD/JSON 链接。 |
| “跑一个真实 0 error 用例” | 优先选择最近现场复跑已 0 error 的用例；当前已现场验证的是 `tc_wf_history_version`。不要把历史绿但今天复跑红的用例冒充 0 error。 |
| “手动录制/示教录制” | 启动 `casey record`，打开浏览器让用户操作；关闭浏览器后返回 `teach-in-capture.json` 路径，并说明它只是蒸馏语料、不是正式报告。 |
| “把刚才手录且回放成功的流程学成新原子” | 先核验 intake 台账与 capture 同哈希，再要求已签 expected、标准 axes/verdict 全 PASS、录屏和 provenance 绑定收据；只产 pending 候选并停下等用户显式人签，签后仍须再次明确晋升才写学习原子注册表。任一证据缺失都不得写 registry。 |
| “医生站/Hi 小助手动录制” | 先用自然语言确认当前是真实 CEF 窗口、专用测试账户、已登录且无真实患者数据；确认 WSL/Windows 原始 TCP 中继和唯一 target 就绪后，内部启动 `cef-record`，让用户操作并按 F8 收口。返回 capture + 可播放录屏；仍须 intake。 |
| “回放刚才的医生站/Hi 小助录制” | 先对同一 capture 跑 intake；accepted 且哈希未变才内部启动 `cef-replay`。返回机械动作收据、可播放录屏和视觉复核请求，并明确 `formalVerdictEligible=false`、不是正式测试 PASS。 |
| “把这段文本用例跑成报告” | 若已有完整签署产物则直接跑；否则先产候选 TestCase/flow/expected 草稿并要求用户签署，不能代签。 |
| “把一段自由文本用例变成候选骨架 / 我要从头写个用例” | 代理内部跑 `scaffold-case` 把自由文本零 LLM 包成候选骨架（`source.kind:freetext` + `route:human` 占位，开箱过 `parseTestCase`），再按公开归一模板 `docs/templates/free-text-normalization.md` 把 `source.raw` 归一成真实意图步、经 `ingest` 入场；如实说明候选须 LLM 归一 + 人签才算数、不是正式报告，别盲写 JSON。 |
| “看最近报告” | 在 `runs/` 下找最新 `.report.html`，返回链接和四态摘要。 |
| “看样例报告/Casey 产物长啥样” | 只返回 `runs/` 下已有的真实回放报告，并标明运行时间与四态；没有真实报告就如实说明。不得调用旧的 `casey demo`，因为它会启动夹具 SUT。 |

## 内核（不可让渡，违反即停）

- 确定性是默认，`LLM` 是手术刀：`LLM` 只在归一(相0)、编译(相1)、断言草拟(相2)、自愈(相5) 出现；回放(相3)、多态裁定(相4)、报告(相6) 是零 `LLM` 确定性。
- 裁判零 `LLM`：测试结论由 `casey verdict`（确定性 `verdict.mjs`）出。绝不用 `LLM` 判「过没过」，绝不把 `LLM` 的印象当裁定。
- **fail-safe 不 fail-open**：机器只终判 `PASS` 与有取证背书的 `SUT_DEFECT`；证不出的一律 `NEEDS_HUMAN`，写 Inbox 等人裁。绝不默认成「可自愈」或自动记缺陷。
- **完成是退出码，不是声明**：报告里「通过/失败」必须来自真实回放 + `verdict.json`，别拿「文件存在」或桩命令（exit 3）当通过。

## 区分三类错误（用户的核心要求，别混淆）

测试失败时，先分清是哪一类——这是 `verdict.mjs` 的判定树（设计 §4.2），不是凭感觉：

| 裁定 | 含义 | 谁的错 |
|---|---|---|
| `SUT_DEFECT` 被测缺陷 | 动作做对了、断言硬失败、且有取证背书（5xx/pageerror/crash/错误信封） | **被测系统**（真 bug，出缺陷单给研发） |
| `HARNESS_ERROR` 过程错误 | 正向确证的工装定位漂移（locator 不再命中，但同签名唯一元素仍在） | **测试工装**（步骤/录制层，可自愈） |
| `CASE_DEFECT` 用例缺陷（`NEEDS_HUMAN` 子类） | 编译期入口可证缺席或期望自相矛盾 | **测试用例本身**（修用例） |
| `AMBIGUOUS_ACTION`/`INDETERMINATE` 等 | 点没点对存疑 / 纯未知 | **机器不敢判，路由人** |

「测试用例的错误」≈ `CASE_DEFECT`；「测试步骤/工装的错误」≈ `HARNESS_ERROR`；「被测系统的错误」= `SUT_DEFECT`。三者落点不同，绝不能都报成「失败」了事。

## 底层命令映射（仅供代理内部执行）

| 用户意图 | 执行 |
|---|---|
| Windows 原生安装与运维 | win32 内部用 `scripts/install.ps1` 与 `scripts/casey.ps1` 完成 verify / real-SUT doctor / account / MCP / proxy 生命周期；不得把真值拼进 PowerShell 参数。`WSL2` 不调用 Windows 脚本替代 Linux 运行面。 |
| 本地账户安全配置 | `account configure` 默认隐藏 TTY；win32 经 PowerShell 账户动作进入同一 CLI。自动化场景只用 `--from-stdin` 或 `--from-env`。账户值不得出现在底层 argv、stdout、日志或报告；本命令只写 gitignored `.auth/`。 |
| 账户状态 | `account status` 只检查存在性、闭合形状和就绪声明；AI 中台配置写现有 `credentials.json` 并由 `login-bootstrap` 消费，医生站 / Hi 小助自动登录固定为未验证。 |
| 相3-4-6 第一段（回放→裁定→待视觉报告） | `node bin/casey.mjs run <caseId> --sut <url> --events <f> --expected <f> --profile <f> [--run-dir <d> --login-bootstrap --no-video]`（产同 run 录像、裁定、报告和 `run-binding.json` 后固定未正式完成；不得预置视觉结论） |
| 相6 正式交付收口 | 代理观看第一段同次录像、写带 video/verdict 摘要绑定的视觉复核后，内部调用 `finalize-run`；它不接触 SUT、不重放，只验同 run 哈希并重建报告。仅全 PASS + 录像完整 + 视觉 `CONSISTENT` 才可 GREEN。参数不得要求用户复制。 |
| 相0 前段脚手架（自由文本 → 候选骨架） | `node bin/casey.mjs scaffold-case <caseId> --from-text <text-file> --out-dir <d>`（零 LLM 产候选骨架，开箱过 `parseTestCase`；再按公开归一模板 `docs/templates/free-text-normalization.md` 把 `source.raw` 归一成真实意图步 → `ingest` 入场；候选非权威，须归一 + 重走全链 + 人签，门拒 fail-closed） |
| 相0 归一（候选须先由 LLM 在 CLI 外产出） | `node bin/casey.mjs ingest <caseId> --in <candidate.json> --out-dir <d>` |
| 相1 flow 桥（mapping 由 LLM 在 CLI 外产出） | `node bin/casey.mjs flow-bridge <caseId> --testcase <f> --mapping <f> --out-dir <d>` |
| 相1 编译（三段式：闸→人 confirm→执行） | `node bin/casey.mjs compile <caseId> --testcase <f> --flow <f> --out-dir <d>`；执行段加 `--execute --sut <url> --profile <f>`（须 flow 已 confirm，否则 exit 66） |
| 相2 草拟断言 | `node bin/casey.mjs draft <caseId> --observed <f> --compile-report <f> --out-dir <d> [--patch <f>]` |
| 相2 人签冻结断言 | `node bin/casey.mjs sign <caseId> --draft <f> --prd <f> --frozen-out <f> --signer <id> --against-build <id>`（**让用户签**，CC 不代签） |
| 示教录制（相外兜底，产蒸馏语料） | `node bin/casey.mjs record <caseId> --sut <本地基址> --out-dir <d> (--login-bootstrap\|--no-login) [--from-events <f> --headless --max-ms <ms>]`（示教语料，非正式回放输入） |
| 医生站/Hi 小助 CEF 示教录制 | `node bin/casey.mjs cef-record <caseId> --profile <f> --out-dir <d> --safe-session [--max-ms <ms>]`（只连回环 CDP；`--safe-session` 代表代理已取得“专用测试账户、已登录、无真实患者数据”的人工确认；产 capture + screencast，不产 verdict） |
| 示教入账（安全复核 → 入账台账） | `node bin/casey.mjs intake <caseId> --capture <f>`（安全复核录制包 → 登记入账台账，拒账 fail-closed） |
| 候选原子三段式晋升 | 代理内部依次调 `atom-propose` / `atom-sign` / `atom-promote`；propose 强制同哈希 intake、标准真实 PASS 证据、录屏与 provenance；sign 只在用户显式批准后调；promote 是另一次显式决定。不向用户展开这些参数。 |
| 医生站/Hi 小助 CEF 机械回放 | `node bin/casey.mjs cef-replay <caseId> --capture <f> --profile <f> --out-dir <d> --safe-session`（只消费 accepted 且哈希全等的 capture；产动作收据 + screencast + 视觉复核请求；固定不具正式裁定资格） |
| 相3 确定性回放 | `node bin/casey.mjs replay --events <f> --sut <url> --expected <f> --profile <f> --out <axes.json>`（未签契约拒回放） |
| 相4 出多态裁定 | `node bin/casey.mjs verdict --axes <f> --out <f>` |
| 相5 自愈（仅工装漂移） | `node bin/casey.mjs heal <caseId>`（诚实桩 exit 3，相5 只有 lib 件） |
| 相6 出报告 | `node bin/casey.mjs report --model <f> --out <d> [--run-history <f> --run-metrics <f>]` |
| 链路自检 | 仅在逐项确认命令不启动/连接任何 SUT 后，直接运行对应静态、schema 或纯函数检查；不得调用未审计的整包 gate。 |
| 看样例报告 | 从 `runs/` 读取已有真实报告；`casey demo` 已按 real-SUT-only 策略禁用。 |
| loop 纪律 | `node bin/casey.mjs lint\|gate\|breaker\|contract ...` |

执行后回给用户的标准格式：

- 报告：`<html 链接>`，必要时附 `<md/json 链接>`。
- 结论：`PASS=n / SUT_DEFECT=n / HARNESS_ERROR=n / NEEDS_HUMAN=n`。
- 0 error：只有 `SUT_DEFECT=0`、`HARNESS_ERROR=0`、`NEEDS_HUMAN=0` 且每步都是 `PASS` 才能说 0 error。
- 失败时只解释一层原因：被测缺陷、工装问题、用例问题或机器不敢判；不要用 LLM 自己裁定过没过。

> 当前进度：七相命令面已建，`heal` 是唯一诚实桩（exit 3，相5 未吃过真场景）。AI 中台历史版本用例已用 current compiler 在真实环境重编译并完成 8/8 PASS、同次录像、视觉一致、独立 HTML 与残留 0；其它业务流仍须逐例提供同等级真机证据。医生站 / Hi 小助 CEF 已完成静态与纯函数验收，但尚无真实 CEF 现场闭环。桩返回 exit 3 时**如实告诉用户该阶段未实现**，绝不假装跑完。

## 报告交付最低内容（硬要求）

每一个测试用例必须生成一份独立 HTML 正式报告；聚合 HTML 只作索引，不承载或替代单用例正文。每份独立 HTML 必须同时包含以下四项；只给四态计数或报告链接不算完整交付：

1. **测试用例（自然语言描述）**：取自已签 `testcase.json` 的前置条件与 intent 文本。字段缺失时必须明确标“缺失/待补”，不得由代理临场编造另一套用例冒充签署原文。
2. **分解后的原子操作**：逐条列出动作与断言，至少包含顺序号、代表 `stepId`/`intentId` 和原子描述；来源以同次 run 的 `*.report.json.atomicSteps` 为准。
3. **录屏**：报告内提供可播放的回放录像，并同时给直接附件链接；默认不得用 `--no-video` 生成正式交付，除非用户明确要求无录屏。
4. **附件**：至少附 HTML/Markdown/JSON 报告、`verdict.json`、`axes.json`、`run-history.jsonl`、`run-metrics.json`、`video.json`；有截图、trace、文本/抓取输出、缺陷单时一并附上。

四项内容必须与同一次真机 run 对齐。聚合 HTML 必须逐例链接到独立 HTML，可列 caseId、四态摘要和视觉复核摘要，但不得复制单例正文形成第二份事实源；凭据、Cookie 和真实目标地址仍绝不进入任一正文或附件索引。

## 报告里有什么（设计 §6）

操作说明 + 标注（`LLM` 接口/生命周期取证/网络取证）+ 回放录屏(mp4) + 文本/抓取输出（含 `LLM` 的回答原文 + 截图）+ 每步裁定徽章 + 缺陷单（仅 `SUT_DEFECT`）+ trace + 截图。机读产物 `verdict.json` 是 golden 唯一校验对象。

## 执行边界（重要）

- **假被测系统只读，所有行为验收只驱真机**（强制执行）：假被测系统（`fake-sut`）和夹具 `SUT` 只允许读取源码作为迁移参考，任何代理不得启动、连接或回放它们，也不得用 `casey demo` 顶替真机运行。`golden` / `gate` / `selftest --tier1` 仅在可证明不启动、不连接、不回放任何假 `SUT` 时才允许执行；静态检查、schema 检查和不接触 `SUT` 的纯函数检查可执行。所有浏览器/通道行为测试、回放、复跑与验收一律联网驱真实目标，`--sut` 只喂当前运行面的回环基址（`site.json` 的 `devProxyUrl`，形如 `http://127.0.0.1:15519`）；无网络、仅 `LOCAL_PROXY_READY`、代理池未连真站或网络受限时一律不得开始行为验收。前置 = 相位0 三关（真实环境严格 doctor 就绪 / 维护者带外确认专用测试账户 / 回环代理单实例；全流程见 `docs/runbooks/real-uat-runbook.md`）。Windows 原生由 PowerShell 操作面管理同机代理；`WSL2` 保持先 WSL listener、后 Windows agent。除 doctor 外还必须取得网络侧→真站与 Casey 运行面回环→真站两段真实 HTTP 成功证据。没有同次真实回放、确定性 `verdict.json`、录屏、视觉复核和独立单用例 HTML，不得声称行为验收完成；Windows 原生在拿到该证据前固定保持 `route:human`。
- 医生站/Hi 小助 CEF 入口用独立原始 TCP 中继，不复用 15519 HTTP Host 改写通道；先 Windows 真机确认进程开启远程调试且筛选后恰一 page。机械回放收据只证明动作派发/身份回读，固定 `formalVerdictEligible=false`；LLM 视觉只能写 `CONSISTENT/INCONSISTENT/INDETERMINATE` 建议，绝不进入 `verdict.mjs` 或翻机器结论。
- 账户输入只走本机安全通道：绝不让用户在普通聊天、命令行参数、工单或报告中提供账户值。交互配置必须隐藏输入；非交互只从 stdin 或环境读。医生站 / Hi 小助真实登录页未采样前只认人工安全会话，不生成或猜测自动登录动作。
- **凭据让用户设**：`.auth/`、`site.json` 是凭据，CC 不把账号密码写进命令行/文件/报告。
- **学习不自动晋升**：手录或桌面/CEF 非正式 receipt 只是 provenance，不是 PASS。只有 intake 同哈希 + 已签 expected + 标准 axes/verdict 全 PASS + 录屏 + 同 run 绑定才能产 pending 候选；旧产物无共同 runId 时必须路由人见证整组哈希。LLM/视觉只能提议，人签与晋升两次显式决定，绝不自动污染 registry。
- **冻结断言只读**：人签后改断言 = Test Ratchet 判红，别去改。
- 改实现先 `contract`：动 `lib`/`bin` 前先 `node loop-kit/bin/contract.mjs init <slug> --lane <...> --reason "..."`，否则 hook 拦截。
- **真机变更有副作用**：编辑型用例（新建/发布/删除）回放=真实改环境数据，实体必带 Reserved Prefix `atl_`。
