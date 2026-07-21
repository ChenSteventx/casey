# flow-bridge-golden-refit 沉淀（learn，阶段5）

2026-07-21 收口。契约把 2026-07-17/18 三波信任根收紧（dfee72c 桥闸实体绑定 / 05573d1 intake 三件套 / edea1f9 canonical 固定根）落地未复跑受影响冻结金牌（护栏 #19）留下的六条陈旧绿，全部修夹具侧、生产零改地收掉，并连带修全 22 prd 的复 gate 收口。异构评审（codex gpt-5.6-sol high）三轮 R1 FAIL→R3 PASS。

## 教训（可复用，优先看这几条）

### 1. 护栏 #19 的陈旧绿有两副面孔，普查漏一副
普查靠「金牌 acceptance 退出码」逆找陈旧绿，只逮到 story 级红。但 prd 级 gate 还扫 specPath 的术语、还有跨 prd checksum 锁（如 authority-root 的 E1 遍历 5 个 sidecar/intake/distill prd）——这些普查没跑，故 #8/#10 的 specPath 弃用别名 term-RED、以及 B3 的 E1 跨锁漂移，都是复 gate 才现形。**结论：陈旧绿普查若只跑金牌、不跑全 gate，会漏 prd 级 term 与跨锁两类。**

### 2. 被超时杀的后台金牌会留租约孤儿
B3 首跑被 2 分钟超时 SIGTERM 掐在半途，租约 `try/finally` 没执行完，在 `cases/` 固定根留 `tc_authority_root_a2`，二次跑撞 `CASE_LEASE_PREEXISTING`。cases/ gitignored、`git status` 看不见。**结论：后台跑 lease 型金牌给足超时；被杀后按显式路径清孤儿（先核 mtime + gitignored + 未跟踪 = 运行时产物非夹具）再重跑。** 这正是 codex 在 B1 逮到的同一类缺陷（清理次序让 `publication.cleanup()` 抛出时跳过 `lease.cleanup()`）——**清理链里任一步可抛，都要保证租约清理恒执行（包 try/catch、失败上报不吞）。**

### 3. 异构评审逮到自审结构性看不见的三类
codex 三轮逮到自审全漏的真缺陷：① 人签留痕——Steven 经 AskUserQuestion 签了，但文档没回写、还留签前时态，审计上证不出人裁发生；② 校验器过度声称——s4「41 过」把「2 恒红守诚实」冒充成「已复 gate」，而恒红 story 的 acceptance 自身失败、gate 不写 evidence，从 prd 状态本就证不出复跑；③ 清理孤儿窗口（见教训 2）。**结论：这三类（审计留痕缺口 / 检查器过度声称 / 清理次序）自审家族天然看不见，必须异构评审逮。**

### 4. 评审修正也要复审——首修可能反而更糟
round1 三缺陷，我首修：Finding 1 只在文档顶部加签署记录、没改正文 → 反而更自相矛盾（顶部已签、正文仍待签）；Finding 2 加「兄弟 story evidence 新鲜」反证 → 可被 `gate --story` 单跑绕过、且还是冒称已复 gate。codex round2 两条都打回。**结论：评审修正 hunk 本身要过复审，别假设首修到位；「加个检查」可能加的是假证明，「补个记录」可能补出新矛盾。诚实标注（不冒称）常比造反证更对。**

### 5. 评审改到已签冻结字节，必须回到人签
评审修正改了两处 ADR-0004 已签金牌字节（cli-mcp-face 清理加固、s4 校验器诚实标注）。首版我写「如需 Steven 复核」糊弄 → codex 逮出断了 ADR-0004 链。**结论：哪怕是评审修正，改已签冻结字节就得回到人签（AskUserQuestion 补签、落最终 sha + 决策留痕），别用「如需」绕过。**

## 划界与待人签

- 复 gate 逆出 4 处**契约外**既有 testChecksums 漂移（prd-delete-confirm-causal-binding / prd-seams-freeze / driver-canonical-root 与 transaction-root 两金牌 sha 相同疑并发合并），按 git 卫生未碰；Steven 定另开独立契约修（先核非并发在手）。task #17。
- #16（两 specPath 弃用别名 term-RED）Steven 定本契约顺手改，已改「原子候选」、#8/#10 转全绿。

## 收口证据

冻结面人签 `HUMAN-SIGN.md`（含签署记录 + 评审修正补签）；反向锁 mutant 突变红证 `evidence/mutant-proof.md`；异构评审三轮 `review/codex-review-{request,reply}-r{1,2,3}.md` + `loop/audit.jsonl` PASS 记录；s4 校验器 `refit-regate-verify.mjs` 报 39 复gate刷新绿 + 2 恒红守诚实 = 41 对账、0 败；契约 prd gate GREEN 4/4。
