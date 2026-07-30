# P6 heal · review 台账（2026-07-29 凌晨；loop 未全绿，review 阶段暂不推进，本页先行记实）

> 契约 `p6-heal`（full）。gate 现况 5/6 story `passes:true`（s7 熔断待 A4/A5 冻结金牌矛盾
> 裁决，见任务账与 HANDOFF 晨间队列）。本页记录已发生的全部异构评审与处置；契约 review
> 阶段的机械推进待 s7 落地 gate 全绿后补。

## 计划评审（实现前，五轮收敛）

codex `gpt-5.6-sol` xhigh + grok-4.5 联合：v1 双家 PLAN_CHANGES_REQUIRED（单 rename 伪事务、
exit 3 冲突、布尔 reset 自报、熔断计量矛盾等）→ v2（D1-D11）→ v3 → v4/v4.1（journal 对称
事务、冻结码表、纯语义定位收窄、证据元组计数、reset-proof schema、D12 血缘）→ 双家
PLAN_APPROVE 零新问题。原卷在会话 scratchpad，要点全部落 GRILL.md D1-D12。

## 金牌铸造（acceptance-gate）

opus 铸八件（六金牌+夹具工厂+运行时接缝），夹具零手写 verdict——真生产投影摆证据、真
`bin/verdict.mjs` 落裁定；红基线逐枚留证；冻结 `loop/prd-p6-heal.json`。铸造期逮出计划
七处矛盾，裁决落 GRILL v4.2（D3 无件/残缺分流、三条拒因码位、六处接缝解释）。

## S0 热路径证伪（重大发现）

P5「漂移探针→HARNESS_ERROR」通路在现役生产接线**从未可达**：①词表原子点击步被破坏域锁
截走（`workflow-delete-domain` 零探针引用）；②探针读 `event.targetName` 而生产从未写。
裁判与三轴无辜（对照组实测）。证据 `hotpath-evidence.md`；heal v1 交付语义=机械全链完整、
自然触发口未通、不得宣称词表漂移已可自动自愈；接通挂账 replay 面后继契约。

## 代码评审（实现后，三轮收敛）

- 首轮：grok CHANGES_REQUIRED（F1 Critical 第四路径×within 死键假等价、F3 并发、F2/F4-F6）；
  codex CHANGES_REQUIRED（11 条：seam 无门禁、晋升绑定链、journal↔receipt、D12 漏
  exact/value——纯函数实测可宽匹配删错目标、补丁互覆、码位）。
- 修复轮一（D13）：复核收缩 hermetic 专用（seam 路径门禁 realpath 钉 tests/）、within 降
  前向兼容注记、绑定链闭合、per-case 锁+TOCTOU 双验+journal 双锚扫描、journal↔receipt
  互绑、D12 补 exact/value/嵌套键、码位收口（新增 1=内部错误）、wx 防补丁互覆（stepId 段
  与冻结金牌冲突改道，挂账）。19 行为探针。delta：grok 11 条全 FIXED+APPROVE；codex 大部
  FIXED+3 新 High（复核不在晋升锁内、基线未绑证据元组、事务产物可覆写）。
- 修复轮二（D14）：promote-tx.mjs 锁/独占落盘单一事实源、复核回滚全程同锁、基线双哈希进
  journal 核、全产物 wx。20 探针。codex 终验：锁面 FIXED；基线仍剩「晋升前换基线」窗口、
  碰撞拒因声明与行为不符。
- 修复轮三（D14②补）：晋升前置校验台账行 `evidence.verdictSha256` === 当下基线字节哈希
  （攻击探针用真 verdict.mjs 铸 SUT_DEFECT 基线，实得 exit 65 零改动）；D14③ 措辞修正
  （wx 不可覆写为安全属性、拒因随先到的门）。codex 收尾确认见本页附记。

## S7 熔断增量轮（learn 后补做，Steven 令「继续干」）

S7 按已批准的 D8 语义实做（loop-kit 薄接不成立改道 heal 内 case 级轮账，三则实现期裁定
入 GRILL D8）；A5 修正稿草案 `p6-heal-breaker-v2.draft.mjs` 预铸跑绿（待 Steven 批准换签）。
增量评审：codex 6 findings（无锁丢更新、旧终局重放洗连击+键形错、破损校验不全、跳闸持久化
次序、草案两处假绿）+ grok 同向 CHANGES_REQUIRED → 终修一波全闭（轮账自锁、幂等先于终局+
progressKeys 窗、破损不变量宁跳勿放、先落跳闸态后 inbox、草案补至 11 项含子进程并发负控），
对照组探针（删修复即翻红、无锁版丢更新 5/5 复现）。codex 收尾确认：6/6 FIXED、新
Critical 无、八件冻结 sha256 独立复核一致（终判词句因调用侧输出截尾未捕获，按逐条结论
记为实质通过，如实注明不引原词）。S7 侧至此完备：唯余 A5 换签（Steven 批）即 gate 6/6。

## 证据基线（只认退出码）

p6-heal 金牌 5/6 exit 0（breaker 红因恒为 S7 未接线）；cli-mcp-face 12/12、
`selftest --tier1` 全绿；八件冻结 sha256 与 PRD 一致（历轮评审方独立复核）；生产库
（verdict/replay/drift-probe）零改实证。

## 挂账（逐项具名）

1. S7+A4/A5 冻结金牌互斥：待 Steven 裁决 checksumAmendment（fable 裁读=A5 夹具把「纯提案
   轮」误当完整周期）；2. cli-mcp-face 的 heal 零参断言与 casey.mjs 帮助文本随整相重签；
3. 补丁文件名 stepId 段随金牌解冻重签；4. reset-proof 摘要权威源、5. 不可伪造回放收据
   （含定位内容摘要）、6. 热路径两断裂接通、7. within 行内收窄真消费、8. heal 台账收敛
   case 根、9. drift-patch 双模块命名统一——均挂账 replay/sign 面后继契约；
10. 真机两不变量与 healed→PASS 实例 route:human（排 B 项后）。
