# learn — replay-settle-mount（full，2026-07-14）

契约：`replay-settle-mount`（lane full）。事实源：`docs/plans/replay-settle-mount/plan.md` + `proposed/GRILL.md`（D1 方向 + D2 固定下限 Steven 2026-07-14 拍板）+ `loop/prd-replay-settle-mount.json`（gate 唯一写 `passes`/`testChecksums`）+ `loop/audit.jsonl`（异构评审 plan 审两轮 + 实现审 r1/r2/r3 各双路）。本文只记教训、真发现、分歧观察与挂账，不重开设计。

## 1. 教训（含真机误判 NEEDS_HUMAN 的根因链）

- **根因是采集时机不对称，不是裁定或断言评估出错**：真机 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，而 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在。`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 拿到的就是「采集时刻的事实」，错在采集抢在 SPA（单页应用）编辑器挂载完成之前。教训沉淀：`actual=0` 的负向结论天然有两种成因（元素真不在场 / 采集抢跑），机器读到的「0」本身不区分两者；凡编译期采得到、回放期采不到的负向断言，先怀疑两侧静默点是否对称，别先归因到被测系统缺陷或用例过时。
- **编译回放两侧的静默点对称是硬要求，不是可选优化**：编译侧 `lib/compile-atoms.mjs` 每步动作后走 `quietPoint`（:203-214，DOM 连续两拍稳定、预算 2500ms）+ 个别原子 `networkidle` 有界前置（:725），编译期「发布/保存在场」正是在这个静默点之后被采到并人签的；回放侧代表步（`isLast`）采集前只有 click 的 `waitForResponse` 600ms + 固定 150ms，没有等价静默点。一侧有稳定预算、另一侧没有，就会出现「同一页面编译期看得见、回放期看不见」的计时假阴。教训：编译产出的 spec 与回放采集的观测必须在「采样前置条件」上对齐，否则确定性回放的前提（同一页面同一观测）就破了。
- **第一轮把计时假阴误判成「过时需重签」是二次教训**：`SUT_DEFECT_OR_STALE` 直觉上最省事的处置是「用例过时了、重签断言」，第一轮正是往这个方向走。纠偏靠交叉核 `run-history` 时间线——后步 `atstep_8` 成功点中的正是前步 `intent_1` 数到 0 的同一个「发布」按钮，同一元素后步在、前步「不在」，这只能是计时/工装 bug，绝不是元素真的不该在。教训（已并入 MEMORY「NEEDS_HUMAN 别急判过时」，Steven 2026-07-14 纠）：判 `SUT_DEFECT_OR_STALE` 要重签前，先把同一元素在整跑 `run-history` 各步的在场时间线拉出来交叉核，「后步点中前步数 0 的同一元素」是计时假阴的判定指纹，不是过时。重签是不可逆的证据面改动，方向判错会把真 bug 冻成「已知正常」。
- **固定下限是「条件的起步垫」，绝不能承担「等到按钮出现」的职责**：D2 批准垫一个小固定下限（M1 定 250ms）给 SPA 路由切换首帧一点起步窗，避免条件判据在动作刚落一拍就抢采旧 DOM 的假稳定。但金牌必须两向钉死：即时渲染场景固定下限不显著拖慢（I3 锁 `waited` < 1500ms），延迟挂载场景把垫调 0 仍须条件兜住（I2 锁 `REPLAY_SETTLE_FLOOR_MS=0` 全绿）。r1 实现审 codex 抓到的 A1 正是这条边界的实现走样——条件循环 deadline 建在固定下限之前（`Date.now()-t0<budgetMs`），默认配置下条件观察窗被垫吃掉约 250ms 只剩约 2250ms，`floor=250/budget=100`（I5 场景）时甚至一拍条件都没跑就进兜底，声称验证「条件预算耗尽」实际验证的是「固定下限吃完全部预算」。教训：垫与条件预算必须是可加而非互吃的两段，`loopStart` 要在固定下限完成之后另起，`waitedMs` 才以 `t0` 计——不然「垫是垫、条件是条件」的口头承诺在实现里就悄悄破了。
- **纯 DOM 两拍稳定不够，静态占位是它的反例考场**：真机形态是「页面加载中」静态占位先渲、编辑器后挂——占位期 DOM 静止不变，纯两拍判据会在占位上早退报「稳定」、采集仍抢在挂载前。故复合判据补判据 A（前台在途 API 归零，复用 `lib/replay-forensics.mjs` 的 `inFlightApi`，denylist 背景轮询天然除外）+ 判据 B（DOM 两拍稳定，镜像编译侧）+「稳定对不跨零点」（占位期陈稳定拍不计入稳定对）。夹具 `mountdelay` 场景就是照这个真机接缝复现的——静态占位 → 数据请求驱动挂载，不是顺着判据裁夹具（守 MEMORY「别倒着裁夹具、复现已冻接缝」）。
- **静默点必须封死每一个 `await` 的硬时间上界，不能只靠全局看门狗**：`networkidle` 在带背景轮询的 SUT 上可能永不达成，单拍 `page.evaluate` 遇渲染线程卡死可能永不返回。有界性不是「循环有预算上界」一句话，而是每个可能悬死的 `await` 都要有绝对 deadline——单拍 `evaluate` 套 500ms 竞速（`lib/replay-forensics.mjs` :8 `withTimeout` 先例）、`networkidle` 兜底带 2000ms `timeout` catch、`inFlight()` 抛错吞掉降级为纯判据 B、入参非有限非负数一律回缺省绝不让 NaN 拖死循环。r1 plan 审两轮 codex 都咬这条（HIGH），靠仓内既有 `withTimeout` 先例落地。教训：「有界」要落到每个 `await` 的绝对超时，靠 `REPLAY_WATCHDOG_MS`（120s）全局看门狗收尸不算有界。

## 2. 代码评审真发现（详见 `review/codex-impl-r1.md`…`r3.md` 与 `pi-impl-r*.md`）

- **plan 阶段设计审两轮（codex-sol@max 8 findings → medium 复审）**：2 HIGH 采信重设计（每个 `await` 加绝对 deadline；I5 整案重设计——原缺省 800ms 挂载延迟在 `networkidle` 兜底窗内必完成、证不出「超预算照现状采」，改可配 `mountDelayMs` 用 6000ms 拉开采集时刻与挂载差距）+ 4 MED（兜底条件化把扰动最坏走时从约 4.75s 压回约 2.75s；`quietPointReached` 接线 settle 结果修记账口径；`CONTEXT.md` 静默点词条扩写为跨阶段通用定义；金牌动态 import 逐案捕获避免模块缺失整体遮蔽）+ 1 LOW，全部并入 plan.md 后进 build。
- **实现审 r1（codex 1 MED + 1 LOW，pi PASS，两路分歧）**：A1（MED）条件预算被固定下限吃掉约 250ms——`t0` 记录点早于固定下限睡眠、循环用 `Date.now()-t0<budgetMs`，`floor=250/budget=100` 时 `page.evaluate` 调用次数为 0，I5 名不副实。驱动员最小复现脚本核验 CONFIRMED（实测 `waitedMs≈2575`、循环覆盖窗口约 2250ms）。A2（LOW）多代表步走时累积无金牌覆盖。pi 同轮判 0 finding PASS，未捕捉到 `t0` 记录点早于固定下限睡眠这一时序细节——两路方向分歧，按契约以更严格一路（codex + 驱动员复现确认）为准，不放行。
- **实现审 r2（A1 修死复核，两路收敛于 A2）**：A1 修法核实正确（`loopStart` 在固定下限之后另起、条件窗独享全额 `budgetMs`、`waitedMs` 仍以 `t0` 计）。但 codex（LOW）+ pi（MED）本轮收敛到同一条 A2——走时上界式自相矛盾：循环仅拍首查预算、末拍可再花 `TICK_MS`+`EVAL_RACE_MS`，单步 settle 实现上界约 250+2500+500+120+2000=5.37s，且未计非 settle 开销，「约 25 个 intent 不逼近 120s」的措辞（25×4.75≈118.75s 实已逼近）算术不自洽。
- **实现审 r3（仅改 plan.md:76 一行，双路一致 PASS）**：弃「承诺具体安全 intent 数」改为只陈述线性关系（N × 约 5.4s）+ 显式留 headroom 责任 + 排除非 settle 开销。codex 独立核算 250+2500+500+120+2000=5370ms 与实现控制流一致、pi 未报新问题，A2 收口。

## 3. pi vs codex 差异观察

- **r1 出现方向分歧、且靠直接复现裁定**：同一时序细节（`t0` 记录点早于固定下限睡眠导致条件窗缩水），codex 判 A1 MED、pi 判整体 PASS。这不是覆盖面深浅之别，是 pi 漏读了一处会改变判定的机械事实——驱动员用最小复现脚本实测 `waitedMs≈2575`/循环窗约 2250ms 确认 codex 对。分歧遗漏原因未知，如实记档、不代评审对错下裁断（守 MEMORY「异构评审工具实操」的记账纪律）。
- **r2 两路收敛于同一 A2**：codex（LOW）与 pi（MED）在同一份材料上独立指向同一条走时上界式缺陷，r1 的方向分歧消失——异构冗余评审（Dissimilar Redundancy）在实现被 A1 修正后趋于一致，符合「上一轮说修了不等于这一轮就该信」的收敛节奏。
- **r3 双路一致 PASS 收口**：仅动一行文档的最小修订，两路一致放行。三轮实现审的轨迹（分歧 → 收敛同一缺陷 → 一致 PASS）是异构复核的正常成本，不因轮数而怀疑流程。
- 执行族组合如实记账：实现方=Claude opus 4.8，评审方=codex（gpt-5.6-sol）+ pi（deepseek 模型家族），评审家族≠实现家族的铁律满足；codex 在只读环境 `mkdtemp EROFS` 无法独立复跑金牌属环境限制非 finding，pi `--no-tools` 仅读料文件、前置 smoke 验真模型选中——均按既有先例如实标注，无需额外挂账。

## 4. 挂账

- **`script`/`chunk` 型延迟挂载盲区（route:human，真机复验停站观察）**：判据 A 只收 XHR/Fetch（`inFlightApi`），JS 分包加载不进；而 `networkidle` 兜底对带背景轮询的真机不可达。此形态若真机出现，按 fail-safe 落 `NEEDS_HUMAN`（假阴方向，绝非假绿），届时再议加法（如加载占位词表判，需人签词表）。本轮不做——在途请求判据已覆盖已确证的真机形态（请求驱动 + 应答即提交，I1 已覆盖）。
- **「响应结束 → UI 延迟提交」超过约两拍缓冲的形态（记 observability，落账不改判据）**：判据 A 在 `loadingFinished` 即归零（`lib/replay-forensics.mjs` :56），提交延迟超过「稳定对不跨零点」给的约两拍缓冲（约 240ms）则在占位上放行。失败方向假红（`NEEDS_HUMAN`）绝非假绿；判据侧扩展会假定「应答必改 DOM」、在应答不改 DOM 的页面上烧满预算恶化最坏走时，本轮不做。`innerHTML.length` 等长内容变化的碰撞边界同理——镜像编译侧同判据保持对称，失败方向同上。
- **真机 toast 自动消隐窗 vs 采样延后约 1s（route:human，真机复验停站观察）**：toast 通道断言理论上更接近消隐窗——失败方向是假红非假绿；hermetic 夹具 `mountdelay` 场景 toast 3000ms 自动消隐、I1 以此典型窗钉「延采不丢典型 toast」。真机消隐窗时序上浮是门禁不可证的残余，频发再议（如 toast 移静默点前后双采快照）。
- **多 intent 累积走时上界只陈述线性关系、不承诺安全 intent 数**：单代表步 settle 静态最坏约 5.4s（未含非 settle 开销），N 个持续在途代表步按 intent 数线性累积。整跑规模逼近该线性上界时须上调 `REPLAY_WATCHDOG_MS` 或改多 intent 累积走时预算案。I6 只钉单代表步扰动上界（`waited` < 4000ms），多 intent 累积预算测试留作后续工作项，本契约不做。
- **全量金牌走时上浮数十秒（既有纪律）**：每代表步稳定页约 +0.5s（250 垫 + 两拍约 240），全仓 ratchet 走时上浮——gate 后台跑轮询收，非缺陷。

## 5. 契约收尾人签（不在本次收口范围）

本契约的最终收尾人签（Steven 对本文挂账项的续裁 + 整体契约签收）循人工流程另行进行，不在本轮 review/learn 收口范围内；本文、`loop/audit.jsonl`（plan 审两轮 + 实现审 r1/r2/r3 各双路）、`docs/plans/replay-settle-mount/review/*` 为其提供完整证据链。gate 终验 GREEN（`loop/prd-replay-settle-mount.json` story 2/2 过，含 `replay-settle-mount` 金牌 16/16 + `selftest --tier1`，`testChecksums` 未动、`passes` 仍只 gate 写）。本契约全程 fake-sut + chromium hermetic，绝不驱真机；真机翻正复验（`tc_wf_publish_states` 的 `intent_1` 由 `NEEDS_HUMAN` 翻 PASS）循真机 UAT 必过完成闸另行（ADR-0009）。
