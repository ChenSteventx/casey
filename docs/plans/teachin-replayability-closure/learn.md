# learn：teachin-replayability-closure 契约复盘（正式稿）

> 状态注记：本稿定稿于 2026-07-28，review 阶段已闭合（六轮评审链终态见
> `review.md` 与 `loop/audit.jsonl` 记账）：grok 双轮 + deepseek 参考 + Claude 四路评
> codex 层 + codex 终审与 delta 复审，终判干净；修单账 R1–R10 十笔；gate GREEN 六 story。
> §2 写到 R6 为止的正文保持原貌，R7–R10 与评审链收口见文末补记两节。

## 1. 契约概况

- 契约：`loop/prd-teachin-replayability-closure.json`（lane=full），计划
  `docs/plans/teachin-replayability-closure/plan.md`。
- 目标：示教技术闭环——手工录制 exact bytes → 同进程准入并真实关闭录制 runtime →
  canonical bootstrap 新开 fresh runtime → raw source 复现 → clean proof →
  resolved existing-atom projection → 现役 flow-bridge/compile → distilled fresh runtime →
  语义 receipt 对 → 确定性等价。LLM 不进 replay/proof/receipt/comparator/verdict；
  fresh 不能自报；首版只收 effect=read、persistentMutation=false。
- 冻结面：31 枚金牌（30 新能力 + 1 邻接）+ 1 个共享 harness + 10 份设计文档 +
  32 份红绿证，全部 sha256 入账。实现期对冻结件的每一次变更都走 checksumAmendments
  修单，共六笔（R1–R6），全部 Steven 2026-07-28 批准、断言零弱化、外科 stash 无实现态
  重钉红。
- 结果：六个 story 全部由 gate 写入 passes:true；输出恒为 developmentOnly:true /
  promotionReady:false，12 条 route:human 维度未动——机制绿只是必要条件（ADR-0009）。

## 2. 六笔修单逐笔要点（R1–R6）

素材源：`loop/prd-teachin-replayability-closure.json` 的 checksumAmendments。

### R1 —— S3 夹具对齐冻结接缝（2 金牌 + 2 红证）

- 矛盾一：selector 投影矛盾。newpage 夹具用 `event.selector === '#popup'` 触发 promote，
  但 S2 冻结接缝把 capture selector 固定投影为 fallbackCss，driver 侧永远没有 selector
  键（raw-actions 的 exactKeys 断言与 raw-runner 自家夹具为证）。
- 矛盾二：结构性空集矛盾。helper 对空 candidateMapping 强制过现役 flow-bridge，与冻结
  compile-gate「steps 必须是非空数组」结构性冲突。
- 定性：金牌夹具笔误，非产码缺陷。修法：夹具改按 fallbackCss 触发 promote；helper 加
  candidateMapping 非空前提。业务断言零弱化；修后 9/9、11/11、9/9 全绿。

### R2 —— harness preconditions 对齐现役状态机（1 harness）

- 矛盾：状态机初态矛盾。冻结 harness 把 authored preconditions 冻成空数组，而现役注册表
  `nav.workflowManagement` 要求已登录、flow-bridge 用 preconditions 种状态机初态——
  空数组使正控 happy path 恒 BRIDGE_REJECTED；计划 §3.4 禁止实现侧补写，实现侧无合法解法。
- 定性：harness 冻结值缺陷。修法：改成 `['已登录']` 一行；stash 重钉红 8 枚等价金牌
  （红因均为 ERR_MODULE_NOT_FOUND、与既有红证逐字一致，红证无须重写）。
- 同轮两项不动冻结件的处置（分类先行范例）：S4 金牌红因含共享 harness 静态 import
  尚未落地的 S5 模块——定性为切片依赖顺序，调序解决（先落 S5 再验 S4）；
  `lib/teachin-distillation/fidelity.mjs` 强制 intentId 等于合成序数、与「intentId 只作
  业务归组」相悖——定性为产码缺陷，修实现。

### R3 —— harness expectedBytes 结构有效化（1 harness）

- 矛盾：结构无效占位。冻结的 expectedBytes 缺 intents 数组，而 S2 冻结语义 readExpected
  按 fail-safe 要求 intents[] 且逐 intent 有 intentId 与 expected[]；无效字节使 raw event
  observation 恒 RAW_OBSERVATION_INPUT_INVALID，连坐 runtime-cycle-adapter 与五枚等价金牌。
- 定性：harness 冻结占位缺陷——占位夹具也必须结构有效。修法：改成结构有效最小 expected
  文档（caseId 对齐 capture、intentId 对齐 authored intent_1、expected 空数组不虚增断言
  宇宙）；stash 重钉红九枚。
- 同轮不动冻结件处置：mapping 行 intentId 走行驱动业务归组，修产码；
  runtime-cycle-adapter composer 按 Y5 薄装配设计真拆真用压到 300 行以内，非金牌矛盾。

### R4 —— R3 hunk 收行（1 harness，排版修正）

- 矛盾：修单本身撑破行数预算。R3 落笔把单行 expectedBytes 折成四行，harness 598 → 601
  行，触碰 equivalence-production-boundary P1 把 SUPPORT_MODULES 一并计入的 600 行预算门。
- 定性：修单排版事故——改冻结件时排版同样是被断言的字节。修法：按原样收回单行，内容、
  字节语义与断言零变化，harness 恢复 598 行，production-boundary 7/7 转绿。

### R5 —— integrity-authority 对齐 harness entity 纪律（1 金牌）

- 矛盾：mock 纪律与金牌传参二律背反。harness mock（冻结件）规定非 runtime-required
  模式递 entityLockAuthority 即 ENTITY_LOCK_AUTHORITY_INVALID；runtime-cycle-adapter
  金牌 Y2c 在 runtime-required 模式要求真转发；integrity-authority 却在默认非必需模式
  递真 authority 且要求封印成功。模式信号只存在于 mock 配置，产码无合法分辨通道——
  压制转发则 I1/I5/I10 绿而 Y2c 断，恢复转发则反之，双向探针两次实测坐实。
- 定性：两枚冻结金牌对字节相同输入要求相反行为，金牌传参违反 harness 自家纪律。
  修法：删 integrity-authority 两处非必需模式传参，其余断言与 Y2c 真转发纪律零变化；
  修后 10/10 exit 0。

### R6 —— E9 定位随 entity handle 分层刷新（1 金牌 + 1 跨契约处置）

- 矛盾：同 PRD 两枚金牌对同一文件的 import 要求互斥。E9 原文钉 pair sealer 直接
  import `teachin/entity-lock-verifier`；boundaries B16 钉 dual-replay 纯接缝分层、禁止
  该直接依赖并要求经 `lib/dual-replay/entity-lock-handle.mjs`。S6 实现者双向实测：
  改 import 则 boundaries 绿、entity-verification 红；改回则反向。
- 定性：分层判 B16 方向正确——handle 是零依赖纯接缝，铸造侧 import handle、消费侧
  import handle，同一 WeakMap 私有状态端到端仍不可伪造。修法：E9 定位刷新为铸造侧
  链条钉死（两端 import entity-lock-handle），业务断言原样保留，断言零弱化、分层收紧；
  修后 10/10 exit 0。
- 同轮跨契约处置：boundaries B4 与他契约 cli-mcp-face A4/C2 对 teachin-cycle case 的
  要求互斥（加 case 则 A4 红、去 case 则 B4 红，双向实测）。裁决 teachin-cycle 属
  developmentOnly 技术闭环、不进用户 MCP 工具面，加入 CLI_MCP_EXCLUDED（幽灵检查与
  B4 双向咬合）；金牌字节仅 `prd-mcp-parity` 冻结，已在该 PRD 记账并 gate 重挣 2/2。

## 3. 切片时间线（workflow journal 佐证）

素材源：workflow `wf_acd20bc9-2db` journal。16 个切片步全部回账：9 步实现/修复、
7 步独立验证；实现步里 6 步以 blocked:true 诚实挂账收尾，对应催生 R1–R6 六笔修单
（S6 一步同时催生 R6 与跨契约 cli-mcp-face 排除集修单）；每笔修单后都有修复或复验步闭环。

- S1（capture/fresh/action authority）：三金牌直接绿（filesTouched 为空，能力此前已落）；
  独立验证再跑全 0。
- S2（raw source replay）：6 个生产文件落地，6 金牌绿；复验 9 绿。
- S3（resolved projection/atom roundtrip）：atom-roundtrip 绿；两金牌红——挂账 #1
  （催生 R1）。修单后修复轮 3 金牌绿，复验 12/12。
- S4 首轮（等价八金牌）：5/8 红——挂账 #2：harness 静态 import 未落地的 S5 模块
  （切片依赖顺序）+ preconditions 空数组（催生 R2）+ fidelity intentId 产码缺陷；
  并用 scratchpad 替身 adapter + 镜像 harness 自证本切片产码逻辑成立。
- S5（编排边界）：9/10 绿、runtime-cycle-adapter 红——挂账 #3：expectedBytes 结构无效
  （催生 R3）+ 拒绝用留空导入凑依赖串压行数。
- S5 修复轮：runtime-cycle-adapter 转绿；production-boundary 红——挂账 #4：R3 把
  harness 撑到 601 行（催生 R4）；同轮前瞻记录 integrity-authority 与 Y2c 冲突。
- R4 后复验：9 条验收绿 + 加跑面 21/21 绿。
- S4 收尾轮：7/8 绿——挂账 #5：integrity-authority 与 Y2c 二律背反，双向探针两次实测
  （催生 R5）。
- R5 后复验：31 条命令 30 绿，唯 boundaries 红（S6 未落地件，冻结基线本红）；
  再复验 29/29 绿、prd 冻结件 sha256 零漂移。
- S6 收尾：boundaries 16 条里 14 条转绿，剩 B16/B4 各与一条当前绿的冻结金牌严格互斥，
  双向实测后选「零回归交付态」挂账 #6（催生 R6 与 mcp-parity 排除集修单），把两处
  一行修复留给人签裁决；同时如实申报新增 `record --cycle-plan` CLI 面无金牌钉死。
- 修单裁决落地后 gate 全跑：六 story 全部 passes:true（04:19–04:20 逐条 exit 0）。

### 实现者四次诚实拒绝弱化（原文可溯）

1. S3：要过 P4 只能凭空造 atom mapping 或改现役 compile-gate 放行空 flow，要过 P5/C4
   只能把原始 selector 偷渡给 driver——判定属倒着裁剪，全部如实挂账。
2. S5：Y5 压行与 P3 依赖串同时满足只能靠留空导入凑串——判定属造假，宁可带红挂账。
3. S4 收尾：压制 entityLockAuthority 转发可让 I1/I5/I10 立即转绿，但会精确打断已绿的
   Y2c——恢复转发保住已绿面，把二律背反连同双向探针证据一起挂账。
4. S6：B16/B4 各差一行就能绿，但都要动冻结断言——选零回归交付态，把互斥事实与双向
   实测证据挂账，留给修单权与人签裁决，不私改冻结件。

## 4. 评审轮（首轮双路 CHANGES_REQUIRED）

评审基线 `dev@6f91125`，真仓只读暴露、两路各自亲跑（评审时 31 金牌全 exit 0、
FROZEN_JUDGE_SHA256 与 `bin/verdict.mjs` 实测一致）。grok 主审阻断项：C1 生产 compare
调用缺 4 个闭合入参（comparator 要求 exact 7 键恒拒，orchestrator 金牌 mock 只校 3 键
放行假绿）；C2 canonical 三接缝空心（verifyReset / inspectClaimedReplayRuntime /
runCanonicalPreflight 仓内无生产实现、只有金牌注入替身，23 步闭环在 source.reset 即死）。
另 H1–H3、M1–M5。deepseek 复核路：High 与 grok H1 同穴（admission reason 白名单缺
REPLAY_EVENT_POLICY_INVALID 等的 fail-open 缝），四条 Medium 逐穴重叠互证，独有
witness 无 consumed。合并去重 11 发现（2C/3H/6M），修复轮按 13 条工作项清单执行。

## 5. 可复用教训

### 最有分量的四条（置顶）

1. 零 SUT 金牌的注入替身测不出 canonical 空心装配——生产绑定静态断言是必须工序。
   本契约 31 金牌全绿、gate GREEN，而评审 C2 证明三个 canonical 接缝在仓内根本没有
   生产实现：金牌全部经注入替身喂依赖，生产装配用空 deps，一步就死；C1 同理，金牌
   mock 只校 3 键，生产调用点缺 4 入参恒拒。这是「纯函数金牌假绿要端到端断言」教训的
   接缝版：注入 seam 越多，金牌宇宙与生产宇宙的缝越宽。工序化对策——每条 canonical
   接缝必须二选一配套：生产绑定静态断言（canonical 装配图上该函数是可调用真实现、
   生产调用点入参 exact 键钉死），或 spawn 真实入口的端到端金牌；「deps 空壳装配」
   应列入 production-boundary 类静态门的禁令清单。异构评审给真仓访问并亲跑探针，
   是本缝被逮住的直接原因。
2. 金牌夹具与共享 harness 也是被冻结的「代码」，冻结前欠一次对冻结邻接面的一致性
   演练。R1–R5 没有一笔是业务断言错，全部是夹具/harness 与已冻结生产语义的矛盾
   （selector 投影、空集结构、状态机初态、结构无效占位、mock 纪律）；R6 则是同一
   PRD 内两枚金牌互斥。这些都能在冻结时用邻接面真实语义（或替身模块）干跑暴露。
   建议：acceptance 冻结工序加「夹具对冻结接缝干跑」与「金牌间对同一文件断言的
   互斥扫描」两步。
3. 修单权与实现权分离，是「先冻结后实现」流水线没走样的关键。实现者只有诚实挂账权
   （blocked + 实测证据 + 不弱化）；修单固定三要素——主会话独立实测坐实、外科 stash
   无实现态重钉红、Steven 批准入 checksumAmendments。四次诚实拒绝弱化证明该分权在
   「一改就绿」的诱惑下扛得住；反之任何让实现者自己改冻结件的捷径都会把六笔矛盾
   变成六次静默弱化。
4. 共享 harness 的 import 闭包决定切片可验证顺序，依赖必须在 acceptance 表里显式声明。
   S4 五枚金牌因 harness 静态 import S5 模块在 ready 门就红，靠实现者半程挂账才触发
   调序。建议：PRD story 加显式依赖声明（dependsOn 或 notes 写明验收顺序），并把
   「金牌与共享 harness 的 import 闭包只指向本切片或已声明前置切片」列为冻结检查项。

### 其余教训

5. 挂账分类先行：金牌矛盾（须修单）、产码缺陷（修实现、不动冻结件）、调度问题
   （调序解决）是三类不同处置。R2/R3 各自「同轮记录两项不动冻结件的处置」是范例——
   不是每个冲突都值一笔修单，先分类再动账。
6. 修单本身也在预算门治下（R4）：改冻结件时排版就是被断言的字节，落笔前先核该文件
   被哪些静态门计数（行数、checksum、文本锚）。
7. 占位夹具必须结构有效（R3）：fail-safe 校验会把无效占位当真拒绝；占位要构造成
   「结构有效但不虚增断言宇宙」的最小文档。
8. 对拍不出的冲突用双向探针（R5/R6）：两枚金牌互相打架时，分别改两个方向各实测一次、
   拿到「改哪边断哪边」的对称证据再定修法，避免误伤已绿面；R6 进一步说明互斥可能
   跨契约（B4 对 cli-mcp-face），修单要在持有该冻结字节的 PRD 记账并重挣 gate。
9. 被挂账切片可用替身自证（S4 首轮）：依赖未落地时，在 scratchpad 用替身模块 + 镜像
   harness 跑同样断言，先证明本切片产码逻辑成立，把红因干净归给依赖缺席。
10. 陈旧绿是结构性风险不是一次性事故：同日既修了 C7 护栏 #19 同款复发（event-runner
    抽离使结构 grep 失配，第二笔 amendment），又在全仓漂移普查里逮出两起历史未同步
    （1e6c3c5 守卫化改写未重冻两 observation 账、b920b4f 共享夹具他契约重冻本账未同步）。
    结构定位型断言随重构必然失配，抽离类提交要连带跑「哪些金牌 grep 这个文件」的反查；
    共享夹具重冻要连带跑「哪些 PRD 还冻着同一字节」的跨账同步。
11. 双路异构评审的重叠与独有都有价值：grok 与 deepseek 五处发现逐穴重叠（互证置信），
    各自另有独有发现（grok 的 C1/C2/H2/H3/M5，deepseek 的 witness 复用）——单路评审
    两边都会漏。评审给真仓只读并允许亲跑探针，比只喂包多逮出「生产装配空心」这类
    静态读代码难断言的缝。
12. 新增 CLI 面必须当轮配金牌：S6 顺手新增的 `record --cycle-plan` 因设计文档未规定
    cycleInput 来源而临场发明，无金牌钉死，评审当轮升格为 H3。任何「顺手加的面」都要
    么当轮补金牌、要么明确挂账为待复核，不许静默进仓。

## 补记一：R7–R10 修单（评审驱动的冻结面强化与对齐）

- R7（grok R1 驱动）：orchestrator 金牌 compare mock 收紧至 comparator exact 7 键 + 四绑定单例校验；
  orchestrator-wiring 新增 W6（canonical 三接缝 seam 装配非空心静态钉）与 W7（compare 生产调用点键集字面闭合）；
  新增 cycle-plan 静态金牌（C5 红先行钉住须带值旗标名单真缺口）。变异探针证「测得出」：拔一键双门红、裸转发 W6 红。
- R8/R9（codex 层）：review-hardening 金牌与同次 capture 身份链收口——两次录制必然 hash 不等的旧公开流程
  改为同次落盘只读一次 exact bytes、admission/events/pairId/三 namespace 全绑该 capture；legacy plan 降为模板。
  Claude 四路评审对 R9 金牌重写做弱化比对：唯一移除的断言钉的正是缺陷行为，判净收紧。
- R10（Claude 四路 M6 驱动，承 grok R2 残差）：raw 观察 inspector 补 caseId 与 expectedSha256 纯摘要，
  预检全量对齐消费后绑定核，错绑不再烧一次性 authority；键名禁令唯一例外如实标注。

## 补记二：评审链收口教训（叠加在正文十二条之上）

1. 零 SUT 金牌的注入替身测不出 canonical 空心装配——grok R1 的两条 Critical（compare 七键残缺、
   三接缝仓内无生产实现）全部发生在「金牌全绿、gate 全绿」之后。生产绑定静态断言（W6/W7）与
   canonical 探针（P1–P10）必须是冻结工序的一部分，不是评审的施舍。
2. 评审链每层换家族才有牙：Claude 实现由 grok/deepseek 评、codex 实现由 Claude 评、Claude 修复由
   codex 终审——六轮里每一轮都逮到上一轮家族看不见的东西（最后一例：codex 在四路评审全过的 M4
   修复里逮出枚举竞态残缝，纯内存探针可稳定复现悬挂）。
3. 修单权与实现权分离在两个家族身上都成立：codex 面对必然失败的身份链没有放宽 hash 门，
   Claude 面对钉死的金牌三次挂账不弱化；十笔修单每笔都有独立实测、红先行/重钉证据与 Steven 批准。
4. 完成语义要绑事实不绑对象：M4 两轮修复的共同教训——绑初始页对象错，绑「活跃页集合为空」这一
   事实才对，且每次挂钩后与安装完成后都要立即重检一次，竞态窗口才真正闭合。
5. 挂账也是交付物：L1 悬空旗标、reason 折钝、白烧 fresh 等七项不阻断残差全部具名进 review.md
   与交接文档，比「顺手修掉但没人知道为什么」更可审计。
