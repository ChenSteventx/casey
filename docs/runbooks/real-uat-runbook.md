# real-uat-runbook —— 交钥匙真机 UAT runbook

> 本页是**真机 UAT 现场操作手册**，不是普通用户操作面。普通用户只说自然语言（见 `.claude/skills/casey/SKILL.md` 与 `docs/runbooks/onboarding.md`）。
> 触真机全程铁律：`--sut` 只喂隧道回环基址（`site.json` 的 `target.devProxyUrl`，形如 `http://127.0.0.1:<port>`）；假被测系统和夹具 `SUT` 只允许读源码作迁移参考，禁止启动、连接或回放。真目标地址只活在 `site.json`，绝不进命令行、日志、报告（护栏 #7）。凭据（`.auth/`、`site.json`）内容绝不回显。
> 裁定纪律：机器只终判 `PASS` 与有取证背书的 `SUT_DEFECT`；证不出的一律 `NEEDS_HUMAN`（护栏 #14，fail-safe 不 fail-open）。任何 `NEEDS_HUMAN` 都是「机器诚实交人」不是失败，按发起方归因后由人裁。
> 联网纪律：行为验收必须同时取得 Windows→真实目标与 `WSL` 回环→真实目标两段成功证据；仅端口在听、离线产物、缓存页面或受限网络环境均不算真实联网。任一段不通即停，不得降级为假被测系统。
> 占位符：`<sut>` = 隧道回环基址；`<caseId>` = 用例标识；`<newCaseId>` = 全新用例标识；`<signer>` = 人签署人标识；`<buildId>` = 被测构建标识。命令里一律用占位符，绝不硬编码真地址。

---

## 相位 0：预检 ban 门（三关，任一不过则停）

真机 UAT 开跑前三关全绿才放行；任一不过，立即停下，本轮只允许静态检查、schema 检查和不接触任何 `SUT` 的纯函数检查；禁止启动、连接或回放假被测系统，也不驱真机。

### 关一：`casey doctor` 绿

```
node bin/casey.mjs doctor
```

期望：exit 0，逐项 `ok`（node ≥ 22.12 / playwright pin 1.60.0 / chromium / 中文字体 / `site.json` + 凭据在位 / 隧道回环在听）。`doctor` 设计上只诊断不回显凭据值与真目标地址；就绪级任一缺 exit 1，字体/凭据/隧道缺只提示不阻塞——真机 UAT 要求就绪级与真机级都过（隧道 + 凭据在位）。
现场已知态（本 session）：doctor 全 ok（exit 0）。

fail-safe：exit 1 或任一就绪项缺 → 停，按 doctor 的 OS 分支建议补齐后重跑；补不齐则本轮只做不接触任何 `SUT` 的静态/纯函数检查。

### 关二：Steven 带外确认 `.auth` 账户 = autotest

`doctor` 不揭示账户身份（凭据面零回显是设计约束），所以「账户是否为 autotest」这关**必须** Steven 带外亲核（`SUT` 账户禁令：真机只许 autotest 账户，ctx 禁用）。runbook 里不读、不回显 `.auth/credentials.json` 与 `site.json` 任何值。

期望：Steven 带外口头/带外通道确认「当前 `.auth` = autotest 专用账户」。
fail-safe：未确认或确认为非 autotest 账户 → 停，绝不驱真机。

### 关三：隧道进程数核（单实例）

反向隧道仅 `WSL` + Windows 组合需要（纯 Linux / macOS 原生 `SUT` 直连、无此关）。核回环端口在听且只有单个隧道进程，避免多实例留僵尸连接占池。

```
node bin/casey.mjs doctor            # 隧道回环项应 ok
pgrep -af wsl-reverse-listen.mjs     # 期望恰好一行（单实例）
```

期望：回环端口（现场为 15519）在听；`wsl-reverse-listen.mjs` 单进程、无多实例。现场已知态（本 session）：回环 15519 在听，单隧道进程（pid 现场核），无多实例。
fail-safe：零进程 → 按 `README.md`「真机链路」先 `WSL` 后 Windows 起隧道（顺序敏感，反了留僵尸）；多进程 → 先收敛到单实例再开跑。

> 三关全绿方进入下面四子项。任一关红：停，本轮只做不接触任何 `SUT` 的静态/纯函数检查。

---

## 子项 ①：`tc_catalog_wf_crud` & `tc_wf_publish_states` 历史绿转非绿追因

### 目的
两例历史报告曾 0 error，2026-07-08 现场复跑转非绿（`tc_catalog_wf_crud`：`PASS=2 / NEEDS_HUMAN=2`；`tc_wf_publish_states`：`PASS=2 / SUT_DEFECT=1 / NEEDS_HUMAN=1`，见 `docs/runbooks/real-zero-error-examples.md`）。本轮真机复跑，判断退绿根因是「`SUT`（被测系统）真变了」还是「环境漂移（隧道/账户/时序/数据残留）」。

### 前置
- 相位 0 三关全绿。
- 两例用例件已在 `cases/tc_catalog_wf_crud/` 与 `cases/tc_wf_publish_states/`（events / expected.frozen / profile / observed / testcase 五件齐，已冻）。已冻件是唯一事实源，只复现、绝不倒着裁夹具去迎合某个预定裁定。

### 逐条命令序
`run-convention` 已落（`casey run <caseId> --sut` 按 `cases/<caseId>/` 约定自动解析五件，显式旗标恒赢）。用约定短式复跑：

```
# tc_catalog_wf_crud
node bin/casey.mjs run tc_catalog_wf_crud \
  --sut <sut> \
  --run-dir runs/tc_catalog_wf_crud/run_uat_catalog_$(date +%Y%m%d_%H%M%S) \
  --login-bootstrap
```

```
# tc_wf_publish_states
node bin/casey.mjs run tc_wf_publish_states \
  --sut <sut> \
  --run-dir runs/tc_wf_publish_states/run_uat_publish_$(date +%Y%m%d_%H%M%S) \
  --login-bootstrap
```

零 error 校验（对每个 run-dir 的报告各跑一次）：

```
node scripts/verify-zero-error-report.mjs runs/tc_catalog_wf_crud/<run-dir>/tc_catalog_wf_crud.report.json
node scripts/verify-zero-error-report.mjs runs/tc_wf_publish_states/<run-dir>/tc_wf_publish_states.report.json
```

> 若要显式带件（等效长式、约定解析不可用时的回退），五件旗标为 `--events cases/<caseId>/events.json --expected cases/<caseId>/expected.frozen.json --profile cases/<caseId>/profile.json --observed cases/<caseId>/observed-<caseId>.json --case-meta cases/<caseId>/testcase.json`。

### 报告交付硬门（Steven 2026-07-15）

每一个测试用例必须生成一份独立 HTML 正式报告；聚合 HTML 只作索引，不得代替单用例报告。每份独立 HTML 交付前必须同时核齐：

1. **测试用例（自然语言描述）**：已签 `testcase.json` 的前置条件与 intent 原文；缺失要显式标出，不得临场补写后冒充签署原文。
2. **分解后的原子操作**：同次 run 的 `*.report.json.atomicSteps`，逐条展示顺序、动作/断言、`stepId`/`intentId` 与描述。
3. **录屏**：报告内可播放，并有 `video.webm` 直接附件链接；除非用户明确要求无录屏，否则 `--no-video` 产物不能作为正式交付。
4. **附件**：至少索引 HTML/Markdown/JSON 报告、`verdict.json`、`axes.json`、`run-history.jsonl`、`run-metrics.json`、`video.json`；存在截图、trace、文本输出或缺陷单时也必须一并列出。

四项必须来自同一次真机 run。聚合 HTML 逐例链接独立 HTML，可列四态与视觉摘要，但不得复制单例正文形成第二份事实源。只给报告路径、四态计数或摘要不算单例交付完成；真实目标地址、凭据与 Cookie 仍不得进入正文或附件索引。

### 期望裁定
- 每步 `verdict` 全 `PASS`、四态摘要 `SUT_DEFECT===0 && HARNESS_ERROR===0 && NEEDS_HUMAN===0` = 历史绿复现，退绿是过去某次的暂态。
- 出现 `NEEDS_HUMAN`：机器证不出，交人追因（下一节）。
- 出现有取证背书的 `SUT_DEFECT`：被测系统在该断言点真回归。

### 追因（判 `SUT` 变了 vs 环境漂移）
对每个非 `PASS` 步，看报告里的取证块（截图/录屏/网络信封/观测现状），按发起方归因：
- 判「环境漂移」：定位、时序、隧道抖动、账户态、前置数据残留导致——如唯一性核验因残留同前缀数据变 `ambiguous`（多匹配）、隧道回环瞬断、登录态未就位。这类不改用例，收敛环境后重跑即回绿。
- 判「`SUT` 真变了」：断言点对应的被测页面结构/文案/按钮态/发布状态机确实变更（如确认按钮文本、发布态徽章、删后归零口径变了）。这类是被测系统回归，报告的 `SUT_DEFECT` 或转人后的定性即结论。
- 两例的已知雷点在 `docs/plans/p3-compile/proposed/reexpress-catalog-wf-crud.md`（catalog：抽屉确认按钮文本二义「确认/确定」、删除确认多匹配、菜单遮罩条件分支）与 `docs/plans/wf-publish-states/learn.md`（publish：`buttonState` present/absent 负向断言需同刻通道活性反证，盲区页证不出退 `NEEDS_HUMAN`）——追因先对照这些历史挂账点。

### fail-safe 处理
证不出即 `NEEDS_HUMAN`，不臆断、不 fail-open。归因结论（漂移 or `SUT` 变）与取证一并交 Steven；若判 `SUT` 变则用例可能需重表达 + 重签（另起契约，不在真机 UAT 内改断言）。

---

## 子项 ②：示教兜底人录三环真机验证

### 目的
验证「人录 → 入账 → 蒸馏 → 候选真过 `ingest` → 编译 → 草拟 → 人签」这条示教兜底链在真机上真通。`record` 相是**人工操作**：Steven 手动在被测系统走一遍流程，Casey 只做采集（不代操作、不代裁定）。蒸馏 v1 零 LLM 全 pending，候选步全 `route:human`，须 CLI 外 LLM 归一后才能过 `ingest`。

### 前置
- 相位 0 三关全绿。
- 选定一条要示教的流程，定 `<caseId>`。
- `record` 是采集不是回放：产出 `示教录制包`（`teach-in-capture.json`，`signed:false` / `replayReady:false` / `distillRequired:true`），只作蒸馏语料，不签署、不直通回放。

### 逐条命令序

第一环 采集（人工操作 + Casey 采集）：
```
# Steven 手动在被测系统走流程；Casey 采集。人工操作段，非自动。
node bin/casey.mjs record <caseId> \
  --sut <sut> \
  --out-dir cases/<caseId> \
  --login-bootstrap
# 产 cases/<caseId>/teach-in-capture.json（采集包，不签署）
```

第二环 入账（安全复核闸 + append-only 台账）：
```
node bin/casey.mjs intake <caseId> --capture cases/<caseId>/teach-in-capture.json
# 登记入账台账 intake-ledger.jsonl；拒账 fail-closed，绝不转形/签署/回放
```

第三环 蒸馏（已入账包 → 候选流程 + pending + 溯源）：
```
node bin/casey.mjs distill <caseId> \
  --capture cases/<caseId>/teach-in-capture.json \
  --out-dir cases/<caseId>
# TOCTOU 硬门校 captureSha256；v1 零 LLM 全 pending、候选步全 route:human
```

出蒸馏 → CLI 外 LLM 归一（把 pending / `route:human` 步归一成真实自动化步）→ 归一产物经 `ingest` 重新入场：
```
node bin/casey.mjs ingest <caseId> --in <归一后候选.json> --out-dir cases/<caseId>
# 相0 归一闸：parseTestCase 确定性校验，产规范 testcase-<caseId>.json；fail-closed
```

编译（相1；执行段打真机采观测现状 + 落 flow 待人 confirm）：
```
# 闸段（不触真机）：
node bin/casey.mjs compile <caseId> --testcase cases/<caseId>/testcase-<caseId>.json --flow cases/<caseId>/flow-<caseId>.json --out-dir cases/<caseId>
# 执行段（打真机）：
node bin/casey.mjs compile <caseId> --testcase cases/<caseId>/testcase-<caseId>.json --flow cases/<caseId>/flow-<caseId>.json --out-dir cases/<caseId> \
  --execute --sut <sut> --profile cases/<caseId>/profile.json --login-bootstrap
# 产 compile-report.json + observed-<caseId>.json
```

草拟（相2 断言草拟，未签）：
```
node bin/casey.mjs draft <caseId> \
  --observed cases/<caseId>/observed-<caseId>.json \
  --compile-report cases/<caseId>/compile-report.json \
  --out-dir cases/<caseId>
# 产 expected.draft-<caseId>.json（未签）
```

人签（相2 人签门；Steven 亲签，冻结断言）：
```
node bin/casey.mjs sign <caseId> \
  --draft cases/<caseId>/expected.draft-<caseId>.json \
  --prd loop/prd-<caseId>.json \
  --frozen-out cases/<caseId>/expected.frozen.json \
  --signer <signer> --against-build <buildId>
# 未签契约会被回放前置闸拒；签署是人的动作，机器不代签
```

### 期望裁定
- 三环各自：`record` 产采集包（`distillRequired:true`）；`intake` 入账通过（拒账即 fail-closed，停）；`distill` 产候选 + pending + 溯源、TOCTOU 门过。
- `ingest` exit 0 产规范 `TestCase` = 归一后候选真过闸。
- `compile --execute` 真机采到观测现状、`draft` 产未签草稿、`sign` 冻结成功 = 三环真通、用例可回放。

### fail-safe 处理
- `intake` 拒账 / `distill` TOCTOU 门（`NOT_INTAKEN` / `CAPTURE_SWAPPED`）触发 → fail-closed，停，核采集包完整性，绝不带病往下。
- `ingest` fail-closed（exit 65）→ 归一产物不合规，回 CLI 外 LLM 重归一，绝不弱化闸。
- `compile --execute` 采不到 / 编译门判 `ambiguous`（多匹配）→ 定位或用例表达问题，证不出交人（`route:human`），不臆造 flow。
- 人签是人的裁量：草稿有疑不签，退回上游。

---

## 子项 ③：`ingest-scaffold` 全新用例端到端真通

### 目的
验证一条**全新用例**从一段自由文本走完整七相直到出报告：自由文本 → `scaffold-case` 产候选骨架 → CLI 外 LLM 归一 → `ingest` → `flow-bridge` → `compile`（相1 打真机）→ `draft` → 人签 → `run`（回放→裁定→报告）。这是 `ingest-scaffold` 契约 plan §6 的 `route:human` 真机尾巴——相1 `compile --execute` 必打真机，故全新用例端到端真通固定 route:human，排最后。

### 前置
- 相位 0 三关全绿。
- 备一段自由文本用例原文（`free-text.txt`），无凭据、可含合法 URL；定 `<newCaseId>`。
- `scaffold-case` 零 LLM 不臆断切分：只产单占位步 + `route:human` 的候选骨架（`source.kind:'freetext'`、泊 `source.raw` 原文），开箱过 `parseTestCase`；真实切分意图是 CLI 外 LLM 的活。

### 逐条命令序
```
# 相0 前段脚手架：自由文本 → 候选骨架
node bin/casey.mjs scaffold-case <newCaseId> \
  --from-text free-text.txt \
  --out-dir cases/<newCaseId>
# 产 cases/<newCaseId>/scaffold-candidate-<newCaseId>.json（非权威、须归一 + 重走全链 + 人签才算数）
```

CLI 外 LLM 归一（把 `source.raw` 切成真实意图步、填 `intentId`/`actionHint`/`inputValue` 模板化、去 `route:human`，保留 `source.kind:'freetext'` / `uniquePrefix:'atl_'`）→ 经 `ingest` 入场：
```
node bin/casey.mjs ingest <newCaseId> --in <归一后候选.json> --out-dir cases/<newCaseId>
# 产 testcase-<newCaseId>.json
```

```
# 相1 flow 草拟桥：TestCase + mapping → compile 的 --flow
node bin/casey.mjs flow-bridge <newCaseId> \
  --testcase cases/<newCaseId>/testcase-<newCaseId>.json \
  --mapping <mapping.json> \
  --out-dir cases/<newCaseId>
```

```
# 相1 编译执行段（打真机采观测现状）
node bin/casey.mjs compile <newCaseId> \
  --testcase cases/<newCaseId>/testcase-<newCaseId>.json \
  --flow cases/<newCaseId>/flow-<newCaseId>.json \
  --out-dir cases/<newCaseId> \
  --execute --sut <sut> --profile cases/<newCaseId>/profile.json --login-bootstrap
```

```
# 相2 草拟 + 人签
node bin/casey.mjs draft <newCaseId> \
  --observed cases/<newCaseId>/observed-<newCaseId>.json \
  --compile-report cases/<newCaseId>/compile-report.json \
  --out-dir cases/<newCaseId>
node bin/casey.mjs sign <newCaseId> \
  --draft cases/<newCaseId>/expected.draft-<newCaseId>.json \
  --prd loop/prd-<newCaseId>.json \
  --frozen-out cases/<newCaseId>/expected.frozen.json \
  --signer <signer> --against-build <buildId>
```

```
# 相3-4-6 端到端：回放 → 裁定 → 报告（约定布局自动解析五件）
node bin/casey.mjs run <newCaseId> \
  --sut <sut> \
  --run-dir runs/<newCaseId>/run_uat_new_$(date +%Y%m%d_%H%M%S) \
  --login-bootstrap
node scripts/verify-zero-error-report.mjs runs/<newCaseId>/<run-dir>/<newCaseId>.report.json
```

### 期望裁定
- `scaffold-case` exit 0 产候选骨架（单占位步、`route:human`、非权威文件名）。
- `ingest` 收下归一产物 exit 0。
- `compile --execute` 真机采观测现状 exit 0。
- 人签冻结成功。
- `run` 出自包含报告；四态摘要每步 `verdict` = 全新用例第一份报告真通即目标达成（不强求 0 error——首份报告可能揭出真 `SUT_DEFECT` 或 `NEEDS_HUMAN`，那也是有效结论）。

### fail-safe 处理
- `scaffold-case` 前置凭据门命中（自由文本混入英文凭据关键词）→ exit 1 零落盘，清洗自由文本重来。
- `ingest` fail-closed → 归一不合规，回 LLM 重归一。
- `compile --execute` 判 `ambiguous` / 采不到 → 定位或表达问题，`route:human`。
- 报告出 `NEEDS_HUMAN` / `SUT_DEFECT` → 按发起方归因交人，不 fail-open。

---

## 子项 ④：各家 agent 真机 MCP 挂载核验

### 目的
验证 `casey mcp-config` 吐出的挂载配置在各家 coding agent 真挂真调可用（`claude` / `codex`）。MCP 面 14 工具与 CLI 真面对齐、有漂移锁金牌盯防；本子项核「配置能挂上 + 工具能真调」。

### 前置
- 相位 0 三关全绿（真调 `casey_run` 等触真机的工具需隧道 + 凭据）。
- 必须挂 `WSL` 侧 node（回放依赖 Linux 侧 playwright，Windows 原生侧挂载必败，G6）。
- pi 留位：当前 pi 从本 `WSL` shell 驱不动（见 `docs/HANDOFF.md`），成文路径待 pi 从可驱动环境真机核验后补，本轮不覆盖 pi。route:human。

### 逐条命令序
产各家配置（自适应本仓绝对路径，免手抄改盘符）：
```
node bin/casey.mjs mcp-config --agent claude   # .mcp.json 片段 + 一行 claude mcp add
node bin/casey.mjs mcp-config --agent codex    # ~/.codex/config.toml 的 [mcp_servers.casey] 段
```

claude code 挂载与核验：
```
# 形态二一行挂载（在 WSL 侧、你将实际跑 casey 的那一侧执行）：
claude mcp add casey -- node '/mnt/d/ctx/heren/casey/mcp/casey-server.mjs'
# 或把 mcp-config 吐的 mcpServers 片段粘进仓根 .mcp.json
```
挂上后在 claude code 里真调工具：先调 `casey_doctor` 等不启动、不连接、不回放任何假 `SUT` 的只读工具确认通道活，再调触真机的 `casey_run` 等（`--sut <sut>`，凭据零回显）。

codex 挂载与核验：
```
# 把 mcp-config 吐的 [mcp_servers.casey] 段追加进 ~/.codex/config.toml，重启 codex 会话
```
codex 会话里真调 `casey_*` 工具，同样先做不接触任何 `SUT` 的只读检查，再驱真机。

### 期望裁定
- `mcp-config` 吐出的绝对路径指向本仓 `mcp/casey-server.mjs`、无盘符硬编码。
- 各家 agent 挂载后工具清单可见（14 工具，`casey_ingest` … `casey_run`，含 `casey_record` / `casey_intake`）。
- 不接触任何 `SUT` 的只读工具真调返回正常；触真机工具真调走通、报告/裁定与 CLI 直跑一致。

### fail-safe 处理
- Windows 原生侧挂载调回放必败（G6）→ 改挂 `WSL` 侧 node，别在 Windows 侧挂。
- 触真机工具真调出 `NEEDS_HUMAN` / `SUT_DEFECT` → 与子项 ①/③ 同款归因，交人。
- pi 驱不动 → 不强试，挂账 route:human 待可驱动环境。

---

## 凭据与取证纪律（全程）

- `.auth/`、`site.json` 内容绝不进任何命令行、日志、输出、报告、shell 历史；`--sut` 只喂回环基址占位。
- 取证按发起方归因：`PASS` 免背书；`SUT_DEFECT` 必须有取证背书（截图/录屏/网络信封）；证不出一律 `NEEDS_HUMAN`（fail-safe 不 fail-open）。
- 自愈（`casey heal`）只对确证 `HARNESS_ERROR` 开闸，不进裁判进程（护栏 #13/#15）；真机 UAT 不为凑绿动自愈。
- 相位 0 任一关红即停，本轮只做不接触任何 `SUT` 的静态/纯函数检查；假被测系统仍禁止运行——这是硬门，不是建议。
