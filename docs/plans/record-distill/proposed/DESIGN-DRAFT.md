# record-distill — 设计草案（示教兜底第三契约，纯设计研究）

> 状态：草案，未 grill、未 contract init、未实现。本文只做设计，不碰 `lib`/`bin`/`web`、不动冻结 schema、不写 prd、不提交。
> 上游：`record-capture`（产 `teach-in-capture.json`）→ `record-intake`（安全复核闸 + append-only 入账台账，accept 条目已绑 `captureSha256`）。
> 本契约：`record-distill` —— 把「已入账」录制包的 events 蒸馏成候选流程，重走 `ingest`→`compile`→`draft`→`sign`→`run`，绝不直通回放。

## 0. 一句话结论（两岔口推荐）

- 岔口一（蒸馏产物形态）：**推荐候选 atom flow 形态**——distill 产出一对内部自洽的候选（候选 `mapping` + 轻量候选 `TestCase` 骨架），候选 `TestCase` 走**既有** `source.kind: 'json'` 模态，喂现有 `ingest`/`flow-bridge`/`compile`，**零冻结 schema 涟漪、零重签**。否决给 `source.kind` 加 `'teach-in'`/`'manual'` 枚举、改冻结 schema 的做法。
- 岔口二（蒸馏 LLM 边界）：**推荐蒸馏工具本体零 LLM 确定性投影**（镜像相2 `synthesizeSkeleton`：证得出的高置信 event→已知 atom 查表落候选，证不出一律落 `pending`、不发明），**LLM 手术刀只在 CLI 之外**（agent/skill 层）产候选、其产物必经既有零 LLM 闸（`parseTestCase`/`validateBridge`/`validateDraft`）+ 新增采集忠实闸 + 人签门。这与 `ingest`/`flow-bridge`/`draft` 全仓一致的「每个 `lib`/`bin` 零 LLM、LLM 只在工具外经确定性闸入场」不变量严丝合缝。

两条推荐共同守住的内核：distill 全程在相3 回放/相4 裁定的**上游**，LLM 从不进裁判进程（护栏 #15 天然满足）；证不出一律 `pending`/`route:human`、TOCTOU 失配一律 fail-closed（护栏 #14 fail-safe 不 fail-open）；候选硬标非权威，绝不 signed/replayReady（CONTEXT 示教词条「不开直通回放」）。

---

## 1. 领域定位：distill 在七相 / 五层准入 / 示教线中的位置

Casey 七相：相0 归一 → 相1 编译 → 相2 断言草拟+冻结人签 → 相3 回放 → 相4 裁定 → 相5 自愈 → 相6 报告。示教兜底线是「当 NL→atom 编译够不到某用例时，让人在真机上示范一遍，把示范语料蒸馏回正规链」的兜底路：

```
人示范  ─record→  teach-in-capture.json  ─intake→  入账台账 accept(+captureSha256)
                                                        │
                                              record-distill（本契约）
                                                        │  零 LLM 确定性投影 + CLI 外 LLM 手术刀（经闸）
                                                        ▼
             候选 TestCase 骨架(source.kind:json) + 候选 mapping + pending 清单 + 溯源 manifest
                                                        │
        ─ingest→ ─flow-bridge→ ─compile→ ─draft→ ─sign(人签)→ ─replay→ ─verdict→ ─report
```

五层准入边界（设计 §1）：L0 确定性内核零 LLM；L1 归一、L2 断言草拟是「LLM 提案、确定性闸校验、不合规 fail-closed」；人签门收口语义。**distill 是一次 L1 形态的 authoring 活动**——LLM 提案、确定性闸处置、人签算数。它不是新执行层，只是把「录制语料」翻成「候选授权物」的桥，翻完必走七相原链。

与 ADR-0006 的关系：ADR-0006 已用 atoms/flow 编译路线取代 recorder-as-library，仅保「陌生站点孵化新原子」支线。distill 恰是这条支线的一次落地——但它**不复活 recorder-as-library**：不把人操作反解成硬化原子（ADR-0006 R7/R9 证明原子层从裸点击反解不可靠、画布域无共享稳定锚），而是走「保守确定性投影 + LLM 手术刀提案 + 既有 atom 允许集闸」把语料喂回正规 authoring 面。

---

## 2. intake→distill 接口：TOCTOU 硬门（record-intake F1 交账兑现）

distill 消费录制包**前**必须过下列硬门，任一不过一律 fail-closed exit 65、零候选落盘（半份候选比没有更危险，沿用全仓先例）：

1. 路径布局 + 软链硬化：`--capture` 须为 `<caseId>/record-capture/teach-in-capture.json` 规范布局；capture 文件、`record-capture` 目录、`caseId` 目录、既有台账文件任一是符号链接一律拒（`lstat` 不跟随）。**直接复用 `bin/intake.mjs` 已趟平的守卫纪律**，不另造判据。
2. 读当前 capture 字节，算 `sha256`。
3. 读同目录 `intake-ledger.jsonl`，逐行 parse，筛出该 `caseId` 且 `intakeStatus === 'accepted'` 的条目：
   - 无 accept 条目 → 拒（`NOT_INTAKEN`：录制包从未入账，distill 无权越过 intake 闸）。
   - 取最新一条 accept，比对其 `captureSha256` 与步骤 2 当前哈希：**失配 → 拒（`CAPTURE_SWAPPED`）**。这正是 record-intake F1 交账的换包防线——intake 后有人把干净包换成脏包，distill 按哈希失配即拒。
4. 对**当前**字节重跑 `reviewCapture(doc, { caseId })`（`lib/record-intake.mjs` 现成导出）：不过 → 拒（`REREVIEW_FAILED`）。台账 accept 只证「入账那刻干净」，distill 再验一次证「此刻仍干净、且仍过当前更严的复核闸」（复核闸可能已收紧，纵深防御）。
5. 全过才进相2 的确定性投影。

设计取舍：把「哈希绑定」与「重跑复核」**都**做（belt-and-suspenders）。哈希抓字节篡改，重跑抓「哈希对但语义仍须复核」的边角，且天然吸收复核闸的后续收紧。二者都零 LLM、都可复现、都进金牌。

---

## 3. 岔口一：蒸馏产物形态

### 推荐：候选 atom flow（候选 `mapping` + 轻量候选 `TestCase` 骨架，走既有 `json` 模态）

distill 一次产出一对共享 `intentId` 命名空间、内部自洽的候选：

- 候选 `TestCase` 骨架（`distill-candidate-testcase-<caseId>.json`）：把 events 结构性分组成意图级步，每步生成 `intentId`（`i1`/`i2`/…）+ `intent`（取 event 的字面文本，如「点击 新增工作流」，纯字面、不做语义声明）+ `actionHint`（由 event.action 确定性映射）。`source.kind: 'json'`（既有枚举——蒸馏候选本就是一份机器产的 JSON authoring 文档，标 `json` 字面属实）。**不含 `expected`**（断言归相2）；`uniquePrefix` 落占位 `atl_` 待人确认。
- 候选 `mapping`（`distill-candidate-mapping-<caseId>.json`）：`[{intentId, atom, params}]`，引用同一批 `intentId`，把每个意图组投影成 atom（高置信查表命中才落，其余落 pending，见 §4）。
- 溯源 manifest（`distill-manifest-<caseId>.json`）：记 `captureSha256`（消费的字节哈希）、event→atom 投影明细、`pending[]` 清单、生成时刻。血缘在此出账，**不塞进冻结 `TestCase` schema**。

因为两份候选同源、共享 `intentId`，可直接依次喂 `ingest`（候选 `TestCase`）→ `flow-bridge`（候选 `TestCase` + 候选 `mapping`）→ `compile`→`draft`→`sign`→`run`，**字面兑现 record-intake learn 的「重走 ingest→compile→draft→sign→run」**，且只用既有 schema，零冻结涟漪。

### 理由

1. 冻结纪律（护栏 #5 / ADR-0004）：`testcase.schema.json` 是冻结形态契约，改它要涟漪重签 `ingest` 金牌、并波及 `parse-testcase` 手写字段闸的双源同刻。给 `source.kind` 加枚举只为记「这份候选来自录制」——是可出账的溯源便利，不值动冻结聚合根。
2. 领域高度对位：录制包是 atom 级证据（具体动作），落在相1 flow 高度，不是相0 语义 `TestCase` 的来源模态。`source.kind` 现有四值 `excel`/`json`/`txt`/`freetext` **全是文本用例的书写形态**；把「人真机示范的动作轨迹」塞进「文本书写模态」枚举是范畴错位——示范不是一种「写法」。
3. 「不直通回放」纪律完整满足：候选 `mapping` 经 `flow-bridge.validateBridge` 已有的投影忠实 + 编译知识允许集 + `compile-gate`（结构/破坏性前缀/状态机）三闸；`compile`→`draft`→`sign`→`run` 再套全套冻结 + 人签。re-entry 只跳过相0 的 `TestCase` 语义校验？不——候选 `TestCase` 骨架仍走 `ingest` 的 `parseTestCase`，一步不省。
4. 溯源不丢：`captureSha256` 已在 intake 台账，distill manifest 再记一次消费血缘。provenance 出账即可，不必进冻结聚合根。

### 反方（完整候选 `TestCase` + 新 `source.kind` 枚举）

- 反方论点：给 `source.kind` 加 `'teach-in'` 让「录制来源」成为聚合根一等公民，血缘写死在 `TestCase` 里，单一权威、可审计性强；避免「候选 `TestCase` 标 `json`」这种「名义模态与真实来源不符」的观感。
- 采纳的反制：血缘已由 intake 台账 `captureSha256` + distill manifest 双记，出账充分；「名义模态」争议其实反过来说明问题——`teach-in` 根本不属于「文本书写模态」这一维，硬加会污染枚举语义。且改冻结 schema 的涟漪（重签 ingest 金牌、双源同刻改 `parse-testcase`、可能触 compile/draft 下游）成本远超收益。故**采纳推荐、否决反方**；若未来真需一等公民溯源，另开「TestCase 溯源字段」契约单独评估，不搭在 distill 上。

---

## 4. 岔口二：蒸馏的 LLM 边界

### 推荐：蒸馏工具零 LLM 确定性投影 + LLM 手术刀在 CLI 之外经闸入场

全仓不变量（读 `ingest`/`flow-bridge`/`draft` 三处实现得出）：**每个 Casey `lib`/`bin` 都零 LLM；LLM 永远在 CLI 之外产候选，其产物经一道零 LLM 确定性闸入场。** `ingest` 的 `parseTestCase`、`flow-bridge` 的 `validateBridge`、`draft` 的 `validateDraft` 全是这个形状。distill 照此办：

- distill 工具本体（`lib/record-distill.mjs` + `bin/distill.mjs`）零 LLM，做确定性投影：
  - 意图骨架分组：把 events 结构性切成意图级步（纯结构、恒安全，不做语义判断）。
  - 高置信 atom 查表：只有当 event 携带**已登记的高置信信号**（如 `nav` 事件 path 命中某 atom 的规范路由）才落候选 atom；**其余一律落 `pending`**，镜像 `synthesizeSkeleton` 的 `mapAtom` 返回 `null` → `pending` 纪律。保守到位：宁可多落 pending，绝不从裸点击臆造硬化原子（ADR-0006 R7/R9 已证反解不可靠）。
  - `pending` 诚实桩：每个投影不出可靠 atom 的意图组落 `{intentId, event 摘要, reason:'投影不出可靠 atom（未知/低置信信号）→ route:human'}`，绝不静默丢、绝不发明。
- LLM 手术刀只在 CLI 之外（agent/skill 层）：读 capture events + 原子注册表（`COMPILE_KNOWN_ATOMS` + 各 atom 的 `paramSchema`），把 `pending` 补成候选 atom、把字面 `intent` 提炼成语义 `intent`、（在相2）草拟 `expected`。**每一次补缝都从既有零 LLM 闸重新入场**：候选 `TestCase` 过 `parseTestCase`，候选 `mapping` 过 `validateBridge`，`expected` 草稿过 `validateDraft`。LLM 无权绕任何闸。

### 采集忠实闸（distill 的零 LLM L0 贡献）

`flow-bridge` 的投影忠实闸校的是 `mapping` 对 `TestCase`（每 `intentId` 被覆盖、无凭空 `intentId`）。distill 再补一道**采集忠实闸**（`lib/record-distill.mjs` 导出、零 LLM）：校 LLM 补出的候选 `mapping` 对 capture 事件的忠实——

- 每个候选 atom 步须能追溯到 ≥1 支撑 event（无 capture 证据的 atom = 凭空，拒）；
- 每个 event 须被某 atom 覆盖或显式落 `pending`（漏译 = 拒）。

对象类比：`采集忠实闸 : capture events ≈ flow-bridge 投影忠实 : TestCase.steps`。它抓的是「LLM 读着录制却提议了录制里没有的 atom」这类幻觉，是 distill 特有、别处没有的 L0 缝。

### 理由

1. authoring 属 L1/L3 提案层，LLM-as-scalpel 本就获准（设计 §1）——但「获准」不等于「进工具进程」。全仓铁律是 LLM 在工具外、经确定性闸入场；distill 不该破例把 LLM 塞进 `lib`/`bin`。
2. 纯零 LLM 投影单独用产出太低（保守查表对真机硬化原子几乎全落 pending，`nav` path 都未必等于 atom 规范路由），等于让人从头写 mapping，兜底价值近零。承认 LLM 手术刀在工具外存在、并用既有闸约束它，才是名实相符——反正 `flow-bridge` 的 `mapping` 本就是 LLM 在 CLI 外产的。
3. 裁判零 LLM（护栏 #15）天然满足：distill 全在相3/相4 上游，LLM 产物只经「人签后的冻结 spec/expected」这条正规路进下游，`verdict.mjs` 永不见 distill 中间物。
4. fail-safe 不 fail-open（护栏 #14）：证不出 → `pending`/`route:human`，绝不 fail-open 成臆造 atom；TOCTOU/复核失配 → fail-closed。catch-all 默认是「落 pending 交人」，不是「猜一个 atom」。

### 反方

- 反方甲（LLM 进工具本体，产更全 mapping）：更快更全。否决——破全仓零 LLM `lib`/`bin` 不变量、令 distill 不可复现、把 LLM 往裁判血缘推近一步。
- 反方乙（纯零 LLM、连工具外 LLM 手术刀都不设，全靠人补 pending）：最安全。否决——不现实（人/agent 本就会用 LLM 写 mapping，正如 `flow-bridge` mapping 本就 LLM 产），禁它只是把 LLM 藏起来而非移除；更诚实的做法是把 LLM 摆到 CLI 外、用既有闸 + 采集忠实闸夹住它。
- 结论：采纳「工具零 LLM 投影 + CLI 外 LLM 手术刀经闸 + 采集忠实闸」。

---

## 5. 蒸馏 SOP + 例翻闭环（红先行金牌 + pending 诚实桩）

### 蒸馏 SOP（人/agent 操作序列）

1. `casey record <caseId> …` 人真机示范 → `teach-in-capture.json`。
2. `casey intake <caseId> --capture …` → 台账 accept（绑 `captureSha256`）。
3. `casey distill <caseId> --capture … --out-dir <d>`：过 §2 TOCTOU 硬门 → 零 LLM 确定性投影 → 落候选 `TestCase` 骨架 + 候选 `mapping` + `pending` 清单 + manifest（全硬标 candidate、非权威）。
4. agent（CLI 外 LLM 手术刀）读候选 + `pending`，补 atom / 提炼 `intent`，产修订候选文件。
5. `casey distill --verify <caseId> --capture … --mapping <修订 mapping>`（可选子命令）跑采集忠实闸；或直接进下一步由 `flow-bridge` 闸兜。
6. `casey ingest`（候选 `TestCase`）→ `casey flow-bridge`（+ 候选 `mapping`）→ `casey compile`→`casey draft`→**人签**→`casey replay`→`verdict`→`report`。全链任一闸拒即回修，人签是唯一「算数」的收口（护栏 #16）。

### 例翻闭环（红先行金牌怎么设计）

金牌 `tests/_golden/record-distill.golden.mjs`，红先行（实现前 `bin/distill.mjs` 不存在、`casey.mjs` 无 `distill` 分发、help 无 `casey distill` 即红）。happy 路径**复现真接缝、不另造**：先跑真 `record` 产 capture、真 `intake` 落台账 accept，再 `distill`（对齐 memory「别倒着裁夹具、复现已冻接缝」）。锁点：

- C1 门面 + 用法错：help 暴露 `casey distill`；缺 `caseId`/`--capture` → exit 64；`caseId` 穿越/斜杠 → exit 65。
- C2 TOCTOU 硬门：
  - C2a 无 accept 台账条目 → exit 65 `NOT_INTAKEN`、零候选落盘。
  - C2b intake 后改 capture 字节（哈希失配）→ exit 65 `CAPTURE_SWAPPED`、零候选落盘。
  - C2c capture / 目录 / 台账软链 → exit 65（复用 intake 布局+软链硬化）。
  - C2d 当前字节重跑 `reviewCapture` 不过 → exit 65 `REREVIEW_FAILED`。
- C3 确定性投影 + pending 诚实桩：干净已入账 capture → exit 0；候选 `TestCase` 骨架 `intentId` 齐、`source.kind:'json'`、无 `expected`；高置信 event 落候选 atom；**未知/低置信 event 落 `pending`**（列出、带 `route:human` reason），绝不发明。同输入字节稳定可复现（进 golden 真值）。
- C4 采集忠实闸：喂一个「含无 capture 证据的臆造 atom」的 `mapping` → 拒；喂一个「漏覆盖某 event 又未落 pending」的 `mapping` → 拒。
- C5 不直通回放（降权硬不变量）：distill **绝不**产 `events.json`/`expected.frozen.json`/`loop/prd-*.json`/任何 `signed:true`/`replayReady:true` 产物；候选文件硬标 candidate、非权威（镜像 record-capture C4 + intake C2）。
- C6 输出卫生：候选/manifest/台账全文过 `credentialGate`、无裸 `://`；成功不回显用户 `--out-dir` 绝对路径（output-seal 纪律）；错误只回 errno 类别码、不回显路径与脏内容。
- C7 `node bin/casey.mjs selftest --tier1` 无回归。

「例翻」纪律：pending 诚实桩是可翻的例——红先行钉「未知 event 必落 pending、不静默、不臆造」，实现只让高置信信号落候选、其余保持 pending。任何「让 pending 变少的臆造」都触金牌红。

---

## 6. GRILL 决策清单（提议 D1..D13，待 Steven grill 签核）

- D1 范围：`casey distill` 只把已入账录制包蒸馏成**候选流程 + pending 清单 + 溯源 manifest**，重走七相原链；不签署、不裁定、不回放、不产正式回放产物、不代替人签、不绕相2。
- D2 车道：full（新增用户可见 CLI、碰 `bin/`、涉凭据复核/输出卫生/TOCTOU 校验/落盘；镜像 record-capture、record-intake 同理由）。
- D3 CLI 形态 + 触发：`node bin/casey.mjs distill <caseId> --capture <teach-in-capture.json> --out-dir <d>`；触发**显式**，不做 intake 后自动接线（示教不开直通，distill 是一道可见、故意的闸）；缺参 exit 64，`caseId` 路径安全（镜像 draft/sign/record/intake）。候选落 `<out-dir>/<caseId>/distill/`，**不写进 `record-capture/`**（不扰 intake 台账「目录仅两件」不变量）。
- D4 intake→distill TOCTOU 硬门：§2 五步（布局+软链硬化 / 字节 sha256 / 台账 accept 绑定校验 / 换包失配拒 / 当前字节重跑 `reviewCapture`）。任一不过 exit 65 零落盘。
- D5 蒸馏产物形态（岔口一）：候选 `mapping` + 轻量候选 `TestCase` 骨架，走既有 `source.kind:'json'`，零冻结 schema 涟漪；否决新 `source.kind` 枚举。
- D6 蒸馏 LLM 边界（岔口二）：工具本体零 LLM 确定性投影；LLM 手术刀只在 CLI 外、经 `parseTestCase`/`validateBridge`/`validateDraft` + 采集忠实闸 + 人签入场。
- D7 pending 诚实桩：投影不出可靠 atom 的意图组一律落 `pending`（带 `route:human` reason），不静默丢、不臆造（镜像 `synthesizeSkeleton`）。
- D8 采集忠实闸：distill 零 LLM L0 新闸，校候选 `mapping` 对 capture events 忠实（无证据 atom 拒、漏覆盖 event 拒）。
- D9 候选降权硬不变量：候选文件硬标 candidate/非权威；绝不 `signed`/`replayReady`；绝不产 `events.json`/`expected.frozen.json`/`prd`。
- D10 溯源出账：manifest 记 `captureSha256` + event→atom 投影 + pending；血缘出账、不进冻结 `TestCase` schema。
- D11 术语登记（造词先登记 CONTEXT）：见 §7。
- D12 非目标：不改 `replay`/`verdict`/`report`/`ingest` 冻结内核；不碰 `testcase.schema.json`/`failure-ledger-entry.schema.json`；不接 MCP/skill（属后续易用性契约，需同时补真实可跑用例）；不自动接线 intake→distill；不复活 recorder-as-library（不从裸点击反解硬化原子）。
- D13 异构评审：Claude 实现 → codex 异构评审（评审家族 ≠ 实现家族，memory 铁律）；codex 标 review done 但 audit 写「非正式待补」不算数，Claude 补跑。

范围/车道/CLI 形态/非目标已在上，grill 时重点压：pending 桩的「诚实边界」（什么算高置信信号）、采集忠实闸的判据强度、候选 `TestCase` 标 `json` 的观感是否可接受、TOCTOU 双门（哈希 + 重跑）是否冗余。

---

## 7. plan 骨架（术语登记 / 纯函数层 / CLI 层 / 验收金牌 / route:human）

### 7.1 涟漪勘定（先勘后动，本契约零冻结 schema 涟漪）

- 不碰 `testcase.schema.json`（候选走既有 `json` 模态）、不碰 `failure-ledger-entry.schema.json`、不碰任何相3/4/6 冻结件。
- 复用 `lib/record-intake.mjs` 现成导出（`reviewCapture` / `intakeLedgerPath`），不改其行为、不动 `record-intake.golden`。
- 复用 `lib/record-capture.mjs` 的 `ALLOWED_ACTIONS` / `isSensitiveField`（单一事实源）、`lib/cred-gate.mjs` 的 `credentialGate`。
- 只新增一个金牌 `record-distill.golden.mjs`；无须重签任何既有 prd 的 checksum。
- 结论：零冻结涟漪、零重签。

### 7.2 术语登记（CONTEXT.md，造词先登记；本契约先提议、实现契约再落）

- 示教蒸馏 / Teach-in Distillation：把已入账示教录制包的 events 投影成候选流程（候选 `mapping` + 候选 `TestCase` 骨架 + `pending` 清单 + 溯源 manifest），重走 `ingest`→`compile`→`draft`→`sign`→`run`、绝不直通回放；蒸馏工具零 LLM，LLM 手术刀只在 CLI 外经确定性闸 + 人签入场。
- 蒸馏候选 / Distillation Candidate：distill 产的非权威候选物；硬标 candidate，绝不 `signed`/`replayReady`，须重走全链 + 人签才算数。
- 采集忠实闸 / Capture-Fidelity Gate：distill 的零 LLM L0 闸，校候选 `mapping` 对 capture events 忠实（每 atom 有 event 证据、每 event 被覆盖或落 pending）；对位 `flow-bridge` 投影忠实（对象是 capture events 而非 `TestCase.steps`）。

登记须与 CONTEXT 既有 示教 / 示教录制包 / 示教入账 / 示教入账台账 一族对齐；英文术语走代码体/纯文本、加粗只给中文（ADR-0004）；首现附中文白话解释；中文标准简体。

### 7.3 纯函数层 `lib/record-distill.mjs`（零 I/O、零 LLM、可测）

- `verifyIntaken(doc, { caseId, ledgerEntries, captureSha256 })` → `{ ok, reason }`：TOCTOU 语义核（无 accept / 哈希失配 / 重跑复核不过 → fail-closed）；I/O（读文件、算哈希、软链 lstat）留 CLI 层，纯函数只吃已读入的字节哈希与台账条目。
- `projectCapture(doc)` → `{ candidateTestCase, candidateMapping, pending }`：零 LLM 确定性投影（意图骨架分组 + 高置信 atom 查表 + pending 诚实桩），字节稳定可复现。
- `validateCaptureFidelity(mapping, doc)` → `{ ok, problems }`：采集忠实闸（无证据 atom / 漏覆盖 event 逐条报，闸自身绝不抛，fail-closed 全域返回 `{ok,problems}`，镜像 `validateDraft`）。
- `buildDistillManifest({ caseId, captureSha256, projection, pending })` → manifest 对象。

### 7.4 CLI 层 `bin/distill.mjs`（薄壳、fail-closed 前置）

- 布局/软链硬化 + 前置凭据门 + 读字节算 sha256 + 读台账（复用 intake 守卫纪律）。
- 过 `verifyIntaken` → 不过 exit 65（reason 类别码，零脏内容回显）。
- `projectCapture` → 落三候选文件（`distill/` 下），全过 `credentialGate` + output-seal。
- 可选 `--verify --mapping <f>`：跑 `validateCaptureFidelity`，不过 exit 65。
- 退出码沿先例：0 成功 / 64 用法错 / 65 门拒或闸拒 / 1 凭据门或读写错。
- `bin/casey.mjs` switch 加 `case 'distill'`（镜像 record/intake/ingest 先例）+ help 生命周期分步段加一行，避开 handover-pack C2 过时黑名单形态（不带 `--sut`）。

### 7.5 验收金牌（红先行）+ route:human

- 金牌 §5（C1..C7），红先行验红再实现再 gate。
- route:human（非阻断真机趟合并项）：真机走一遍 record→intake→distill→ingest→flow-bridge→compile→draft→人签→replay 全链，确认候选真过闸、pending 真交人、无凭据泄漏、无 `://`、无签署假象。属真机 UAT，非本契约 hermetic 验收。

---

## 8. 护栏对账

- 裁判零 LLM（#15）：distill 全在相3/4 上游，LLM 从不进 `verdict.mjs` 进程；产物只经人签冻结 spec/expected 正规路入下游。守。
- fail-safe 不 fail-open（#14）：证不出 → pending/route:human；TOCTOU/重跑复核失配 → fail-closed exit 65；catch-all 默认落 pending 交人，绝不臆造 atom、绝不自动签。守。
- 冻结测试只读 / Test Ratchet（#1/#5）：不改任何冻结 schema、不重签任何 checksum、不动既有金牌；只加 `record-distill.golden`。守。
- 凭据不进输出（#7）：候选/manifest/台账全过 `credentialGate`；重跑 `reviewCapture` 复扫 URL/凭据/敏感字段；output-seal 不回显 `--out-dir` 绝对路径、错误只回 errno/类别码。守。
- 阶段互锁（#11）：实现契约走 contract init → plan → 冻结红金牌 → gate → 人签；本设计文档不触发任何实现动作。守。
- 统一语言（#4/#12）：新词先登记 CONTEXT，英文不加粗、走代码体，简体，首现附白话。守。
- 异构评审（#9/#10、memory）：Claude 实现 → codex 异构评审；codex 「非正式待补」不算数、Claude 补跑。守。

---

## 9. 交下一步的账（待 grill / 实现契约敲定）

- 「高置信信号」的确切判据（哪些 event 特征允许落候选 atom、`nav` path 与 atom 规范路由的对齐怎么判）——本草案定「保守、宁 pending 勿臆造」，具体判据待 grill 收敛，落实现契约的 GRILL。
- 采集忠实闸「证据支撑」的粒度（atom↔event 多对多如何对账）——待实现契约细化。
- `--verify` 子命令是否并入本契约，还是靠 `flow-bridge` 闸兜底、本契约只产候选——建议本契约含轻量 `validateCaptureFidelity` 纯函数 + 金牌 C4，`--verify` 子命令可留后续增量。
- 候选 `TestCase` 骨架的 `intent` 提炼深度（distill 只落字面文本 vs 允许 CLL 外 LLM 提炼语义）——本草案定 distill 工具只落字面、语义提炼归 CLI 外 LLM 经 `parseTestCase` 入场。

— 完（草案，待 grill）—
