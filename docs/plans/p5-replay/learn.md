# p5-replay — learn（沉淀）

契约收口：grill/plan/accept/loop/review/learn 全绿。P5 是排期 v3 第 2 层最后一轨、Casey 的核心回放引擎。本文沉淀 loop + 异构评审（codex gpt-5.5 非同族）暴露的教训，事实源：git d790f96/b982171/b0dcaff、loop/audit.jsonl 的 p5-replay 记录、HANDOFF「P5 异构评审」节。

## 交付（live）

- `bin/replay.mjs`：确定性回放编排 + 看门狗 75s 强退（绝不挂死）+ 强制退出；裁判零 LLM（只产三轴事实、不裁定）。
- `lib/replay-actions.mjs`：语义定位器 + 点击身份门（unique/fallback_first/none）；守卫不抛、动作失败翻成轴信号。
- `lib/replay-forensics.mjs`：`watchNetworkForensics` CDP 真发起方归因、背景 denylist 归 null、SSE `finished` 静默点、getResponseBody 超时防挂死。
- `lib/replay-assert.mjs`：断言轴评估（对 kind 不可知）、未实现 kind 一律 ok:false（fail-safe）。
- `lib/drift-probe.mjs`：只读漂移探针 `findEquivalentAffordance`（同签名 count===1，不点不改 spec，拆 P5/P6 循环依赖）。
- 回归锁 `tests/_golden/p5-replay.golden.mjs`（10）+ `tests/_golden/p5-replay-coverage.golden.mjs`（13，补冻 codex 评审 deferred 的 fail-safe 覆盖）。

## 教训

1. **进程内假 SUT 会把它要伺服的浏览器冻死。** accept 前修法发现：进程内假 SUT 被同步 `execFileSync(replay)` 冻住、答不了 replay 浏览器的请求（goto 卡死）。解法：把假 SUT fork 成独立进程（8 态行为一字未改），`server.mjs` checksum 重签入 prd。教训——回放的被测端与回放器必须真进程隔离，别图省事进程内拼。
2. **同族自建的最危险 fail-open：谎报动作成功。** codex 异构评审判 FAIL、10 发现，最严重 H3——唯一元素 click/fill/goto 抛错被吞、却仍报 `actionPerformed=true`。这是同族自评绝对看不见的假绿（裁判会把「没点成」当「点成了」）。修：动作轴改诚实（失败落 `action_failed`→verdict INDETERMINATE；多匹配绝不点击；身份门 count===1 才 unique）。与 model-lane-guard 契约同一教训：异构评审不可省。
3. **取证归因按因果作用域、非时间窗。** 背景轮询 401、归因别步的 pageerror 绝不能翻本步 verdict。修：预导航期 `currentStepId=null`、归因收紧到动作因果作用域、pageerror 按步归因不全局污染、网络背书归一到代表步对齐 verdict。这是「背景噪声不冤本步」的命门。
4. **断言证不出一律 ok:false。** 未实现 kind、取证缺子字段——落 fail-safe，绝不静默当通过（护栏 #14）。
5. **漂移探针只读、与自愈写回严格分离。** 探针只答「同签名唯一元素是否仍在」供 verdict 判 HARNESS_ERROR，绝不改 spec；写回是相 5 自愈的活。这一刀拆掉了 P5/P6 循环依赖。
6. **评审 deferred 的行为也要补冻。** codex 评审里 deferred 的新 fail-safe 行为（action_failed→INDETERMINATE、fallback_first→AMBIGUOUS_ACTION、背景归 null 不背书、归因对齐本步→SUT_DEFECT）补冻进覆盖 golden（13 检查），防回退 fail-open（棘轮只增不减=护栏 #1 允许）。

## 挂账（route:human，护栏 #16 gate 绿≠完成）

- tier-2 真机 UAT 未走：`catalog_wf_crud` 真站全 PASS + 注 HTTP500 出 SUT_DEFECT + 验 CDP initiator 真发起方归因在真 Heren 流量下的可靠度（ADR-0007 推翻条件——不可靠则退「denylist + 活动步窗 + 证不出归 null」，绝不退纯时间窗）。
- 第 3 层集成（真数据端到端）未起：compile-gate 真产物 → P5 真回放 → verdict → P7 报告，首条 web 端到端真报告。
