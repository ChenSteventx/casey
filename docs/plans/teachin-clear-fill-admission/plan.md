# plan — teachin-clear-fill-admission

> 前置：`GRILL.md`（证据链与定案）。lane=full。
> 目标：清空输入框的 fill 事件（空串目标值）在示教链全程可保真、可准入、可回放；
> 缺键与非 string 仍 fail-closed 拒付，准入不放宽只纠偏。

## 1. 生产件改动（两处，各一行判据）

### C1 `lib/record-capture.mjs` — 投影保空串键
`sanitizeRecordEvent` 字符串字段循环里，`value` 对 fill 动作无条件保留：

```js
// 现状（第 89-90 行）
const v = cleanString(raw[k], k === 'value' ? 1000 : 200);
if (v) out[k] = v;
// 改为：fill 的 value 是语义值不是装饰字段，真清空（原始值恰为空串）必须保键；
// 纯空白等「洗成空串」形态继续丢键、交准入拒付（codex r1 High：否则把原拒付
// 形态洗成静默清空，fail-open）。其余字段维持空即丢键。
if (v || (k === 'value' && action === 'fill' && raw[k] === '')) out[k] = v;
```

约束：`ALLOWED_EVENT_KEYS` 键集不增删；`schemaVersion` 不变；敏感字段遮值分支
（`<redacted>` + `valueMasked`）在前、不受影响；非 fill 动作的空 `value` 仍丢键。

### C2 `lib/teachin/raw-capture.mjs` — 准入收敛判据
`checkReplayableFields`（第 126-129 行）：

```js
// 现状
if (event.action === 'fill'
  && (typeof event.value !== 'string' || !event.value)) {
// 改为：缺键/非 string 仍拒（typeof undefined !== 'string'），空串放行。
if (event.action === 'fill' && typeof event.value !== 'string') {
```

拒付码 `FILL_VALUE_UNAVAILABLE` 语义不变（值不可用），只是空串不再落入。

### 明确不动（GRILL 已实证）
`bin/record.mjs` 注入侧、`lib/teachin/raw-action.mjs`、`lib/teachin/raw-playwright-driver.mjs`、
`lib/record-intake.mjs`、`lib/teachin/raw-replay-runner.mjs` 拒付码清单、蒸馏侧、
`verdict.mjs`（裁判进程零沾染）。

## 2. 金牌矩阵（红先行）

新金牌一枚：`tests/_golden/teachin-clear-fill-admission.zero-sut.golden.mjs`（零 SUT、纯进程内），
六组断言，整体修前必须红、修后必须绿，全部按退出码判：

- G1 投影层：`sanitizeRecordEvent` 对 `action:'fill'` 原始 `value:''` 保留 `value:''` 键；
  **纯空白值仍丢键**（D4 收紧钉，防洗空放行）；非 fill 动作空 `value` 仍丢键；敏感字段
  仍遮值；`buildTeachInCapture` 端到端形状同断言（夹具取真语料 seq 11 邻接结构脱敏
  重表达，不搬真值）。
- G2 准入三分岔：`admitRawReplayCapture` 对空串 fill 放行；缺 `value` 键仍
  `FILL_VALUE_UNAVAILABLE` 拒；`value` 非 string 仍拒；**投影后的纯空白 fill 端到端
  仍拒**（build→admit 全链 fail-closed 钉）。
- G3 传导层：空串 fill 经 `projectRawReplayAction` 产出 `{action:'fill', value:''}`
  动作请求、键值不丢。
- G4 回归钉：`value:'<redacted>'` + `valueMasked` 事件仍被 `MASKED_FILL_UNREPLAYABLE`
  整包拒；遮值闸序先于值可用闸（防 C2 收敛误伤凭据卫生面）。
- G5 runner 穿透（codex r1 Medium）：`admitRawReplayCapture → runRawReplay` 全链
  （fresh runtime 与动作驱动替身），动作替身收到的第二请求精确为
  `{action:'fill', fallbackCss, value:''}` 且回放 `CLEAN`。
- G6 物理句柄（codex r1 Medium）：`canonicalRawPlaywrightDriver` resolve→perform
  走页面/定位替身，`handle.fill` 实参严格全等 `''`（证明空串穿透到 Playwright 调用面）。

受影响面全量复跑（护栏 #19，退出码判绿，不 grep 标记串）：
`teachin-replayability-*` 全家族（含 support 装具）、`record-capture`（codex r1 Medium 补）、
`record-distill`、`record-intake`、`teachin-observation-*` 家族、`teachin-intake-swap-race`、
`cli-mcp-face`、`observation-identity-contract-closure`、`observation-cli-authority-wiring`、
`page-topology-auth-continuity-{adjacent-regression,pipeline}`（后四者为
`buildTeachInCapture` 消费方检索补全）。改前基线已采样存档
`review/baseline-pre-change.txt`：51 枚中 7 枚既红全在 observation 家族（2 枚 exit 78
主动吊销墓碑 + 5 枚陈旧红，签名=夹具倒在硬化准入/事务门前，与本修接缝无关）；
复跑判据=非既红者全绿、既红者签名不变。预期零 `checksumAmendment`（GRILL D6；
待实测判断，复跑红则如实报账再议 amendment，不预签、不静默改冻结件）。

## 3. prd 与门禁

`loop/prd-teachin-clear-fill-admission.json`：spec 指向本 plan；`testChecksums` 冻结新金牌
（gate 唯一写 `passes`）；检查项 = 新金牌绿 + 受影响面复跑绿 + term-lint。
loop 开始 `breaker --reset`。

## 4. 验收点与完成口径

验收（全部按真实退出码，gate 唯一写 `passes`）：
- A1 新金牌 `teachin-clear-fill-admission.zero-sut.golden.mjs` 红→绿翻转（s1）；
- A2 邻接面复跑矩阵全绿（s2，清单见 §2）；
- A3 全仓既有 prd 无 checksum 漂移（收口漂移扫）。

- hermetic：新金牌红→绿翻转 + 受影响面全绿，全按退出码。
- 离线复核：旧语料包 `tc_chiefcomplaint_smoke_20260729_091925` 修后重过准入**仍拒**
  （seq 11 键已丢，GRILL D5 不追认）——这是预期正确行为，作为负样本证据记录。
- 真机：首链闭环真通须 Steven 到机重录（route:human，非本契约完成条件；
  本契约完成 = gate 绿 + 异构评审闭环 + 人签面处理完）。

## 5. 评审安排

异构铁律：实现（Claude）→ 评审 codex `gpt-5.6-sol` xhigh + grok 联审；真仓暴露版
（只读 worktree + 自跑金牌），不喂实现者推理；输入=spec（GRILL+plan）+ diff + 门禁证据。
首轮只报 Critical/High/Medium；修复后 delta 复审；账落 `loop/audit.jsonl`。

## 6. 风险清单（给评审）

- R1 C1 的 `action` 变量取的是白名单归一后动作（未知动作坍缩成 `click`）——坍缩成
  `click` 的伪 fill 不会误保空键，确认此路径。
- R2（已定案，codex r1 High）：纯空白值不得随清空放行——C1 判据限定原始值恰为空串，
  纯空白继续丢键、准入拒付；金牌 G1/G2 钉住。
- R3 `MASKED_FILL_UNREPLAYABLE` 优先级在 `FILL_VALUE_UNAVAILABLE` 之前（先敏感后可回放），
  C2 不得改变闸序。
- R4 别处若有对「fill 必有非空 value」的隐式假设（如报告渲染、比较器），复跑面须暴露。

## 7. 计划评审记录

- r1（2026-07-29）：codex `gpt-5.6-sol` xhigh、真仓只读暴露版，判
  `PLAN_CHANGES_REQUIRED`（1 High + 2 Medium，原卷 `review/plan-codex-r1.log`）；
  三条全采纳：D4 收紧（High）、G5/G6 穿透金牌（Medium）、复跑矩阵补
  `record-capture` 与 `buildTeachInCapture` 消费方（Medium）。grok 联审安排在
  实现后代码评审轮（比例适配，plan 轮已满足异构铁律：实现家族 Claude ≠
  评审家族 OpenAI）。
- r2 delta（同日，`review/plan-codex-r2-delta.log`）：①②FIXED；逮出③基线缺
  3 枚既红失败签名（NOT_FIXED）、④GRILL D3 措辞与 D4 定案矛盾（新 Medium）——
  两条属实、已修（签名补档含 observation-cli 的 `CASE_LEASE_PREEXISTING`
  环境性崩溃栈；D3 改写限定原始严格空串）。
- r3 delta（同日，`review/plan-codex-r3-delta.log`）：③④FIXED，
  **`PLAN_APPROVE`**。

## 8. 代码评审记录（实现后联审）

- codex `gpt-5.6-sol` xhigh（`review/code-codex-r1.log`）：`CHANGES_REQUIRED` 两 Medium——
  M1 `--from-events` 非 string `fill.value` 被 `cleanString` 强转洗过准入（违背非 string
  fail-closed 承诺）；M2 s2 gate 绿宣称面大于证明面（51 枚全量复跑未入 gate）。
  两条全采纳：投影层加类型闸（非 string 丢键→准入拒）+ 金牌补四类型反例（13→15 组，
  走 checksumAmendment 换签、原件存档 `.pre-r1-amendment.archive.gz`）；新增 s3 story
  以确定性 sweep runner（`tests/_golden/support/clear-fill-sweep.mjs`：52 枚退出码 +
  7 枚既红签名稳定性二重核对）+ term-lint 入 gate，s1/s2 绿态撤销待 gate 重跑。
- grok-4.5（tmux 多轮真仓，`review/code-grok-r1.log`）：`APPROVE`——真跑金牌 + 自造
  畸形 capture 对抗探针；中段一条自我推翻的探针方法学噪声（`\x00` 被 `JSON.stringify`
  吞导致其探针失效），非实现缺陷。按铁律 grok PASS 不盖 codex FAIL，以 codex 两 Medium
  的修复为准。保姆工装坑一则：监控把状态栏常驻 `always-approve` 字样误当弹窗、向 grok
  输入框空回车约 7 次（实测无实质干扰），v3 改为只认单选标记。
- 改后全量复跑（opus 子代理，`review/postchange-sweep.txt`）：52 枚零回归、7 枚既红
  逐条签名核对不变；该轮跑在 M1 类型闸落地前，M1 后的复证由 s3 sweep 承担。
- codex r2 delta（`review/code-codex-r2-delta.log`）：M1 FIXED；M2 NOT_FIXED——
  A3 漂移扫须入 gate acceptance、手动跑不算门禁绑定。处置：`support/prd-drift-scan.mjs`
  入冻结与 s3；另实证 gate 单条 acceptance 5 分钟看门狗掐 14 分钟全量 sweep（两轮
  gate 同点复现、直跑两次 52/52 全过——非抖动），sweep 改 `--part k/4` 轮转分片入
  gate（不放宽看门狗，最重片 1m32s）。
- codex r3 delta（`review/code-codex-r3-delta.log`）：终判 `APPROVE`，M2 FIXED，
  分片并集完备性（52 唯一、四片各 13、两两不交）codex 自验，零新 findings。
- 终态：gate GREEN 3/3（evidence 戳 03:19/03:23/03:30）；审计账 `loop/audit.jsonl`
  尾笔（rounds=6, verdict=pass）。真机复录待 Steven（ADR-0009 完成闸）。
