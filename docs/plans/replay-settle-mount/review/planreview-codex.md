# replay-settle-mount plan 阶段异构设计评审（codex）

## 评审元信息

- 契约：`replay-settle-mount`（lane `full`），评审对象 = `plan.md` + `proposed/GRILL.md`（实现前，工作树内尚无 `lib/replay-settle.mjs`/新金牌 `tests/_golden/replay-settle-mount.golden.mjs`/新 prd `loop/prd-replay-settle-mount.json`，`git status --short` 确认评审前后除既有 `docs/plans/replay-settle-mount/`、`node_modules` 外零改动）。
- 评审者：`gpt-5.6-sol`（codex-cli 0.144.1），`reasoning effort=medium`，`sandbox=read-only`，`--skip-git-repo-check`，工作目录 `/mnt/d/ctx/heren/casey-replay-settle-mount`。session id `019f60d8-9ae7-7b92-bf8a-f474743d55db`。
- 效力值口径更正：任务指令原写「codex 开 `fast`」，实测 `-c model_reasoning_effort=fast` 被 API 拒绝（`invalid_enum_value`，该 codex-cli/模型的合法枚举为 `none|minimal|low|medium|high|xhigh`，无 `fast` 档）。已就地改用最接近「强度不减、出得快」意图的 `medium`（居中档，非最低档 `low`/`minimal`），驱动员按现场事实纠偏，未静默按原指令硬跑导致整轮失败；此更正已如实计入下方 audit 记录，供指令方核对是否需另行拍板具体档位。
- 家族：codex（评审家族 ≠实现家族 Claude，符合异构评审铁律）。
- 评审料：`docs/plans/replay-settle-mount/review/planreview-material.md`（根因段 + 关键裁量 + plan.md 全文 + GRILL.md 全文 + 相关既有代码摘录（`bin/replay.mjs`/`lib/compile-atoms.mjs`/`lib/replay-forensics.mjs`/CONTEXT.md 静默点词条，均标注 read-only 背景）+ 评审指令；不含凭据、不含真机地址）；经核对，评审料内嵌的 `plan.md` 全文与工作树当前 `plan.md` 字节级一致（评审对象即当前版本，非过期快照）。
- 用量：`tokens used 110,591`。
- 结论：**非 PASS**（2 HIGH / 4 MED / 1 LOW），建议在 accept/build 前修订 plan 与 GRILL。

---

## 评审原文（verbatim，未改一字）

结论：非 PASS。当前设计有 2 个 HIGH，建议在 accept/build 前修订 plan 与 GRILL。

## HIGH

1. HIGH — D1 / M3 / M4 / M7：静默点没有真正封死硬时间上界

设计只给轮询预算和 `networkidle` 配了超时，但单次 `page.evaluate()` 没有超时；若渲染线程卡死或桩返回永不 resolve 的 Promise，循环预算无法重新检查，只能等全局 120 秒看门狗杀进程，不能按 D1 要求"超预算后照现状采"。此外，`inFlight()` 抛错也未被设计为吞掉，可能直接中断回放。仓内网络取证已有 `Promise.race` 超时先例：`lib/replay-forensics.mjs:7`，但新 helper 设计未采用。`plan.md:11` 只覆盖 `evaluate`"抛错"，U2/U4 也没有"永不返回"与 `inFlight()` 抛错用例。

建议：

- 用绝对 deadline 约束每个 await，包括 floor、evaluate、轮询和 fallback；
- 校验 `floorMs`/`budgetMs` 必须是有限非负数；
- helper 内或接线处设总 catch，确保自身故障仍采现状；
- 加 `evaluate` 永不 resolve、`inFlight()` 抛错、总耗时上界三枚测试。

2. HIGH — D1 / M4 / M5 / M7：I5 与既定流程矛盾，修后大概率无法满足

I5 设置条件预算 100ms，却保留 250ms floor 和随后 2000ms `networkidle` fallback；`mountdelay` 的请求只延迟 800ms。`plan.md:14` `plan.md:31`

典型时序是：

- 原有 save 响应完成，再等 150ms；
- floor 250ms；
- 条件预算约 100ms 耗尽；
- 进入最长 2000ms 的 `networkidle`；
- 800ms 的 editorData 请求在 fallback 内完成，页面挂载；
- 最终采到「保存」，断言变成 true，而 I5 要求 `actual:0`。

因此 I5 不能证明"超预算照现状采"，还会阻止新金牌全绿。应改成独立超时场景：floor=0，挂载延迟明确大于"条件预算 + 2000ms fallback + networkidle 静默窗"，或让请求保持在途直到 fallback 超时，然后断言 axes 仍落盘且采到占位现状。

## MED

3. MED — D3 / M5 / M7：A+B 没覆盖"请求结束后、UI 延迟提交"的 SPA 形态

`inFlightApi` 在 CDP `loadingFinished` 时删除：`lib/replay-forensics.mjs:53`。如果响应已经结束，但框架在 300ms 后才提交编辑器，A 已归零，静态占位 DOM 两拍相等，静默点会在编辑器挂载前错误返回 `settled:true`。

现有 `mountdelay` 是"应答后立即替换 DOM"，只证明等待网络请求，未证明等待实际挂载。`GRILL.md:41`

建议增加"响应完成 → 延迟 300–500ms → DOM 替换"的反例。可考虑：若本轮观察到在途请求，则必须看到请求归零后的 DOM 变化，再等待其稳定；仍不读取 expected。

4. MED — D3 / M1 / M7：背景动画/轮询的最坏走时没有集成回归锁

持续改变 DOM 长度会烧满 2500ms；即使轮询 URL 在 Casey denylist 内，Playwright 的 `networkidle` 并不知道该 denylist，仍可能再耗满 2000ms。单代表步最坏约 4.75–4.9 秒，约 25 个代表步就可能撞 120 秒全局看门狗。反之，内容变化但 `innerHTML.length` 不变又可能被误认稳定。

I3 只测静态 `happy`，`waited < 1500ms` 不能回答该风险。`plan.md:29`

应补一个带持续 DOM 扰动和 denylisted 轮询的浏览器用例，钉总耗时上界、正常 exit 和 `settled:false`；并明确这是接受的逐代表步最坏成本还是需要进一步限流。

5. MED — M6：回放历史会把静默点超时错误记成成功

计划只把等待时间计入 `rhQuietWait` 并打 debug 日志，但现有 `quietPointReached` 固定取 `!!navOk`：`replay.mjs:111`。因此新 helper 返回 `settled:false` 时，回放历史和报告仍显示静默点 ✓，与 schema 的"false = 证据可复现性存疑"冲突：`tests/_golden/schemas/run-history.schema.json:126`。

应把代表步的 settle 结果传入 `historyLine`，并加超时后 `quietPointReached:false` 的金牌；或者明确拆分旧字段和新机制，不能仅靠 debug 日志维持事实口径。

6. MED — M9：统一语言定义确实走样

`CONTEXT.md` 把"静默点"限定为"编译期"，且定义包含 `networkidle + 无动画 + DOM 稳定 K ms`：`CONTEXT.md:151`。新机制用于回放期，没有无动画判据，`networkidle` 也只是超时后的 fallback。M9 因"已经登记"而判零新造并不成立。

应把词条改成跨编译/回放通用定义，并说明各阶段允许的确定性判据变体；把 `CONTEXT.md` 加入 `touchesFiles`。当前没有 prd checksum 冻结它，因此不会新增重签项。

7. MED — M2 / M7：toast 已知回归与"回归零行为差"冲突

旧路径可在 click 后约 150ms 采 toast；新路径稳定页也约 0.5 秒，最坏接近 4.75 秒。短暂 toast 可能在采集前消失，使原 PASS 变成 `NEEDS_HUMAN`。GRILL 已挂账，但 hermetic toast 永不消失，所以门禁完全看不到该行为：`GRILL.md:49`。

至少应增加自动消隐 toast 金牌，并由设计明确接受哪种结果；否则验收项"回归零行为差"不可成立。

## LOW

8. LOW — M7：单文件红先行可能被缺失模块遮蔽

U1-U4 以"模块不存在"为修前红，但 I1/I2/W1 又要求拿到具体旧行为红证据。若新金牌顶层静态 import 不存在的 `lib/replay-settle.mjs`，Node 会在运行任何检查前退出，无法证明 `actual=0` 或 `NEEDS_HUMAN`。

应明确使用动态 import 并逐检查捕获，或拆分单元与集成金牌；accept 证据需分别保存 I1/I2/W1 的真实旧输出。

## 核对无发现项

- 归因时序：M2 插入点正确。nav 和非 nav 分支都在 `isLast` 前关闭 `currentStepId`：`replay.mjs:431` `replay.mjs:463`。未发现修改 `attributedStepId` 或把静默等待纳入动作因果作用域的设计风险。
- 冻结反向索引：按当前计划实际要改的共享夹具，确实只有 `prd-p5-replay` 和 `prd-replay-nth-visible-hardening` 命中，M8 清单无遗漏。
- 裁判与凭据：未发现引入 LLM 裁判、修改 `verdict.mjs`、修改断言评估或泄漏 `site.json`/真机地址的设计路径。全程 fake-sut hermetic 的边界正确。

---

## 驱动员归档附注（非评审内容，程序性记录）

- 评审全程 `sandbox=read-only`、`--skip-git-repo-check`；评审前后 `git status --short` 对比一致（仅既有 `docs/plans/replay-settle-mount/`、`node_modules` 未跟踪项，评审未产生任何工作树写入）。
- 效力值纠偏：指令写 `fast`，codex API 无此枚举（合法值 `none|minimal|low|medium|high|xhigh`），首次按字面跑得到 `400 invalid_enum_value` 直接失败（零输出、零副作用）；改用 `medium` 重跑成功。本条据实记录，供指令方核对 `medium` 是否即其「fast」本意，或需另指定档位（如 `low`）。
- 与本目录同期存在的另一份历史草稿（同一 `planreview-material.md` 评审料、效力值口径为「max」的更早一轮 codex 输出，`loop/audit.jsonl` 中对应更早一条 `ts:2026-07-14T10:15:17.595Z` 记录）与本轮结论方向一致（均为「需修改/非 PASS」，聚焦 D1/D3/M1/M4/M5/M7/M9 一组重叠疑点：预算硬上界不严格、I5 与既定流程时序矛盾、判据 A+B 覆盖不全、术语走样），但具体条目不完全相同（本轮新增 M6 `quietPointReached` 字段口径不一致、M2/M7 toast 已知回归两条本轮独有发现；旧轮 M7 单金牌遮蔽问题在本轮降级为 LOW）。本条为驱动员归档事实陈述，不代评审者调和两轮差异或下判断——两轮均如实计入 `loop/audit.jsonl`，多轮证据留给下一步修订者综合处理。
- 本条为驱动员归档，不代评审者补充或调和判断；HIGH1/HIGH2 指出的「静默点无硬时间上界（单次 `evaluate` 无超时）、I5 时序设计上不可能触发预期的超预算分支」等，留给下一阶段落地 plan.md/GRILL.md 时按评审原文逐条处理，本归档不做二次验证或裁决。
- `contract advance review` 阶段锁读取 `loop/audit.jsonl` 中 `slug` 精确匹配 + `kind` 含 `review` + `verdict`/`result` 含 `pass`（大小写不敏感）判定放行；本轮 codex 结论为「非 PASS」，`loop/audit.jsonl` 对应行如实记 `verdict: needs_revision`，不放行 review 阶段推进（如实记账，非误标 fail-open）。
