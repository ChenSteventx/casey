# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。
> 最靠前的「最新覆盖层」是权威现状；其余日期快照与「历史层」仅供溯源。

## 2026-08-07 夜：基数门让位契约收口合入（首轮双 APPROVE）+ schema 同车改版人签、十五跑待发（最新覆盖层，权威现状）

现役 dev 顶端 `28e02a2`（本地零 push）。接下节，终裁当日落地：

1. **契约 `terminal-coverage-yield` 六阶段收口合入**（`28e02a2`，Steven 三点裁定：
   收窄版 A / platformId 硬桥接 / M1 schema 同车一次人签）：①让位分支把门内已解析
   身份盖进 open 终端 click 事件 `yieldedToPlatformId`（取证记录非豁免宣告，让位
   判据与 notes 零接触）；②`checkIdentityObservationCardinality` 反向基数四条件
   豁免（count 恰 0 ∧ 义务恰 `['source']` ∧ 字段非空 ∧ 恰一条同 kind/subject/
   platformId 行——缺一照拒、多面零松动、加法门控无字段输入逐字节同码）；
   ③`events.schema.json` 一次改版（M1 兑现）：intentId pattern 放宽
   `^intent_[A-Za-z0-9_]+$` + 新可选取证属性，两份实际冻结该件的归属 PRD 登
   `checksumAmendments` + Steven 当轮点选人签。金牌九钉 14 断言（红基线 8 过/6 红、
   三件整体还原突变闭环）、邻接八命令 + 归属金牌三家全绿、全仓 299 金牌串行扫描
   零回归、gate GREEN 2/2；评审 grok + pi **首轮双 APPROVE 零 C/H/M**（ext4 克隆树
   姿势，grok 自补对抗探测全拒）。
2. **十五跑待发**（本段收笔时未跑）：令牌 `b4r150807m`；预登记预期=**exit 0 产全绿
   成功件**（events/observed/draft），`tc_catalog_wf_crud` 史上首次全链产件；任何红
   即停不连跑。
3. 挂账更新：M1 已兑现销账；新增 plan.md 冻结字节「三份」笔误（随下次触碰清）；
   teach-in 三通道/draft 闸面承前。

### 下一步（接手者从甲起）

- 甲、十五跑取真证（先重启隧道两端；预期 exit 0）→ 达阵则 B 段首例完整产件到手，
  接 sign/replay 链与后两例（`publish_states` / `history_version`）统一处置。
- 乙、挂账清偿与工作树清理（34 棵树，新增本契约树 6/6 可摘）。

## 2026-08-07 晚：意图号重绑契约收口合入 + 记账双门前提修正、M1/schema 挂账、D 盘四挂事故（历史覆盖层，被上节接续）

现役 dev 顶端 `b38c679`（本地零 push）。接下节，本段收一契约、修正一个裁定前提、
记一日四次盘事故：

1. **前提修正（本段最重）**：下节所记「三道冻结门一致表达单流单发行」被代码勘察 +
   纯函数探针证伪三分之二——出处链闸 `CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID`
   的真拒因是**意图号命名空间错配**（生产事件带编译自生 `intent_0..N`，闸按流步
   `sourceIntentId` 匹配终端事件，永不相等；金牌夹具手工对齐两套号致纯函数假绿，
   十三跑是史上第一跑抵闸——「从未走通过」家族第五例）。真语义冲突只剩基数双射一道门
   （open 让位后终端 0 观察 vs 注册表无条件 source 义务）；H1i 与 C3 同名拒在十三跑
   已被让位机制满足。原 A/B/C 岔口按修正前提重摆，Steven 重裁：**先修接线取真证再裁**。
2. **契约 `compile-intent-lineage-rebind` 六阶段收口合入**（`b38c679`）：`compileFlow`
   标准路径在事实产生点把带号步产出事件的 `intentId` 重绑为该步 `sourceIntentId`，
   events/observed/verification 三通道逐 stepId 同号、`lastIntentId` 同步；裸步保持
   自生号与折叠行为；teach-in lineage 块字节零漂移。设计经历一次真域反转：混合态
   初裁「全或无掷错」被 `bindagent-replay` 冻结金牌夹具口径（变异步带号、nav/assert
   裸步、assert 折锚是既定惯例）证伪，Steven 反转为**逐步存在即绑**——全仓双态扫描
   （护栏 #19）是唯一逮住它的手段，邻接组当时全绿。验收金牌五钉 16 断言、三段红证
   （首版/反转 delta/H1 delta）、三轮突变闭环；评审 pi `APPROVE` 零 C/H/M + grok r1
   `CHANGES_REQUIRED`（H1 High：重绑漏 observed/verification 旁路→draft 存在性闸拒
   authored 草稿）→ 并集修 `2e4770b` → grok r2 delta `APPROVE`。
3. **挂账新增（Steven 当轮裁定）**：M1 冻结 `events.schema.json:78` intentId pattern
   `^intent_[0-9]+$` 与 authored 号张力（teach-in 同形多年、生产无 schema 强制层）——
   裁挂账，十四跑真证后与基数门修向统一处置、一次人签；teach-in lineage 块同缺
   observed/verification 重绑（正式产物若过 draft 闸需另开面）；全仓扫描此后单侧
   串行跑（本日实证双侧并行互染 190 项对称假红，侥幸未误判但基线数值作废）。
4. **D 盘一日四挂事故与新姿势**：`/mnt/d` 四次整盘 I/O 挂死（C: 恒活、内核日志零痕迹、
   内存/swap 防线带甲仍死——指向 Windows 侧 D: 卷供给端，与死亡报卡项目独立观测收敛，
   Steven 待查盘/线材）。固化配方：commit 快照 → ext4 浅克隆 + `loop-kit` 兄弟克隆 →
   评审在克隆树自跑验证（同哈希即同字节）；重要产物随手落 `~/casey-recovery-20260807/`。
   跨 session 协作：死亡报卡 session 已备 `~/casey` C 盘逃生副本（gitignored 件不全，
   十四跑仍从主树发起）；共享收件箱分工=各答己方主题、他方信只转不答；Steven 时间
   标签用珀斯（UTC+8）。
5. **十四跑达阵 + 基数门修向终裁**（`b4r140807l`，26.1s，exit 65）：预登记预期逐字
   兑现——出处链闸真机转绿（全程零 PROVENANCE 拒因）、执行链再次全链通过、建十一删
   十一零残留；剩余红恰一道=基数双射门（观察 1 条）。Steven 以单焦点真证终裁：
   **收窄版 A**——基数门学让位，终端 click 零观察时门内重推导让位条件（同流存在同
   platformId 的 create subject 观察才豁免，不信标记），金牌改版 + 一次人签；原 C
   案例拆分裁定正式作废。M1 schema 挂账可同车处置。

### 下一步（接手者从甲起）

- 甲、立契约落地收窄版 A（碰冻结纯函数 `validateObservationTerminalCoverage`
  `entity-observation-registry.mjs:389-392`，full 六阶段 + worktree；豁免判据门内
  重推导、fail-closed 不松；金牌改版 + Steven 人签，M1 schema pattern 挂账同车）；
  修通后十五跑预期 exit 0 全绿产件。
- 乙、后两例（`publish_states` / `history_version`）等 crud 全绿统一处置。
- 丙、挂账承前 + 新增（M1 schema pattern、teach-in 三通道、扫描串行纪律，余同下节）。
- 丁、工作树清理：33 棵树（新增本契约树，6/6 可摘）。

## 2026-08-07 晨：观察让位契约收口 + 十三跑执行链全链首过、停成品段记账双门（历史覆盖层，被上节接续）

现役 dev 顶端 `d5ecbab`（本地零 push）。接下节，本段再收一契约、B4 推进一跑，**执行链
里程碑达成**：

1. **契约 `wf-open-observation-yield` 六阶段收口合入**（`d5ecbab`，Steven 裁甲案）：
   open click 成功后若同 flow 已有同 platformId 观察（create subject）则跳过归档 source
   行、记让位 notes；点击前双证原样。金牌 12/12、全仓 297 双态零回归、grok+pi 双
   APPROVE 零 C/H/M（评审期间遭 drvfs 整体故障+WSL 重启，pi 首轮如实报 HARNESS_ERROR
   存证、复原后对同一快照重跑收口——事故处置成范式）。
2. **十三跑**（`b4r130807k`，25.5s，exit 65）：**执行链全链首过**——create→open（读回
   unique+让位生效）→详情断言→删除（计数门真 1/1：`layout=card, equal=true`，恒等正控
   真机兑现）→流内真删→删后重搜，全程 `blockers: 0`。B4 建十删十，第十删由测试链自己
   完成（流内首删）。exit 65 只来自**成品段记账双门**：
   `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION`（反向基数双射：登记观察原子
   `workflow.open` 的终端 click 须恰被 requiredRoles=[source] 覆盖，让位后 0 观察违反）
   + `CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID`（create 出处链闭合判据）。
3. **架构级岔口（下一步甲，需 Steven 真裁）**：三道冻结门（wiring H1i 单发行方、C3
   同名拒、基数双射 `entity-observation-registry.mjs:389-392`）一致表达「单流单发行」；
   重表达的单流 CRUD（create+open+delete）天然多发行。让位方案流层通、成品层撞账。
   候选修向（均动架构面，勿自主定）：A. 基数/出处门学会「让位」语义（登记原子终端可
   携让位标记豁免——动冻结纯函数+wiring/cardinality 金牌改版+人签）；B. open 在
   created-in-run 流里整体降级为纯验证步（不进观察登记路径——动 registry 语义）；
   C. 案例拆分（create 流与 open/delete 流分案——动重表达口径+B0-B3 重铸）。
4. 残留：十三跑零残留（流内已删，清偿工具确认「目标不在列表」）。耗时账：十跑 1m17.5s、
   十一跑 1m6s、十二跑 22s、十三跑 25.5s。

### 下一步（接手者从甲起）

- 甲、成品段记账岔口：把 A/B/C 三案摆给 Steven 真裁（建议 grill-with-docs 级别对话，
  涉冻结面与统一语言）；裁后立契约。修通后十四跑预期 exit 0 全绿产件。
- 乙、后两例（`publish_states` / `history_version`）等 crud 全绿了统一处置。
- 丙、挂账承前（PRD notes 史迹措辞、新树必红两例、账本接线拆除、金牌残件自清、
  陈旧红 owner、hook-loop-guard 立项、清单重签）。
- 丁、工作树清理：32 棵树（新增三契约树，均 6/6 可摘）。

## 2026-08-07 凌晨：删除搜索修收口合入 + 十二跑计数门通过、停「同名观察多条」设计缝（历史覆盖层，被上节接续）

现役 dev 顶端 `b6880e3`（本地零 push）。接下节，本段再收一契约、B4 推进一跑：

1. **契约 `wf-delete-search-filter` 六阶段收口合入**（`b6880e3`）：十一跑计数门
   「布局=unknown」根因侦察修正了「缺导航」假设——删除原子导航与就绪锚俱在，真根因是
   搜索隔离走 fill+`Enter` 而 seam-1 已证 Enter 不过滤（旧版知识残留）。修法 v3：搜索
   隔离处惰性 `Enter` 保留（三 PRD 冻结的 post-nav S2 包含式钉 fill/press，实现让路零
   冻结字节）+ 放大镜真过滤后置 + 过滤后 15s 有界就绪锚；删后重搜处 Enter 退役。
   金牌 16/16、全仓 296 双态零回归、pi APPROVE 零 C/H/M + grok 1 Medium（冻结 plan
   文案停 v2 与 v3 实现矛盾——双冻结面打架）→ 并集修 → grok delta APPROVE。
2. **十二跑**（`b4r120807j`，22s，exit 65）：**删除搜索修真机达阵**——计数对账门通过
   （放大镜隔离目标 1/1），链路推进到 C3 破坏性目标连续性守卫，停「**同名观察多条**
   （create subject + open source 同 flow 各产一条身份观察）→ 不取 first、不武装 ref」
   fail-closed。这是读回契约与 C3 守卫的设计级相互作用：wiring 金牌 H1i 本就钉死
   「多身份原子同流 → 单信封无法表征 → route:human」，重表达后的 CRUD 单流
   （create+open+delete）恰落此面。运行 11 起即存在、计数门通了才可达。
3. **设计岔口待 Steven 裁（下一步甲）**：
   甲案（推荐）——open 读回观察去重让位：同 flow 已有同 platformId 的 created-in-run
   subject 观察时，open 跳过归档自己的 source 观察行（点击前双证照跑、验证价值保留，
   只少归档一行）；连续性 ref 取 create 观察铸造，issuer 单原子（create）走已钉 H1b/H1h
   通道；冻结面零接触（H1i 纯函数不动，改动在 open 侧新代码）。
   乙案——C3 守卫改「值唯一」（多行同 platformId 视为唯一）：动破坏性守卫语义
   （codex round-3 Critical 面，大概率涉冻结）、爆炸半径大，不推荐。
4. **残留清偿**：十二跑建一删一（`atl_b4r120807j` 3 样本缺席 exit 0），B4 累计建九删九
   零残留。全链耗时账：十跑 1m17.5s、十一跑 1m6s、十二跑 22s。

### 下一步（接手者从甲起）

- 甲、同名观察多条设计缝：先把甲/乙案报 Steven 裁，裁后按既定工法走契约（甲案预期
  与前两契约同构：小改 + 金牌 + 双审）。修通后十三跑预期全链首过。
- 乙、后两例（`publish_states` / `history_version`）等 crud 通了统一处置。
- 丙、挂账追加：PRD notes 史迹措辞（grok 残留注记）；真机金牌依赖未跟踪产物（新树必红
  两例）；其余承前（账本接线拆除、金牌残件自清、陈旧红 owner、hook-loop-guard 立项、
  清单重签）。
- 丁、工作树清理：31 棵树（新增两契约树，均 6/6 可摘）。

## 2026-08-06 晚：十跑定读回门根因 + 契约收口合入 + 十一跑 open 首次真机走通（历史覆盖层，被上节接续）

现役 dev 顶端 `a507f5c`（本地零 push）。接下节，本晚一契约收口、B4 推进两跑：

1. **十跑**（`b4r100806h`，1m17.5s，exit 65）：语义名回填修真机实证生效（0 步非 unique、
   容器 4ms/锚定 3ms），新阻断 `workflow.open` source 读回双证门 `envelope-empty`。诊断定
   根因三层：①事务时机反了（click→详情页→才武装，详情页语境无列表 DOM 无回声查询）；
   ②重查触发缺失（`searchBox` 全仓无声明、未声明分支被账本回声判据排除）；③声明死路径
   fill+Enter 被 seam-1 否证。十跑是该门真机首次执行——「从未走通过」家族第三例。
2. **契约 `wf-open-readback-requery` 六阶段收口合入**（`a507f5c`；grill 真钢一轮、
   Steven 定丙路线）：读回+双证上移到点击前列表页语境——`fetchCreatedWorkflowListScan`
   扫描（镜像 create 真机已通模式）+ 物理双锚 + 冻结判定表 `resolveDualIdentity` 裁定 +
   过门才点（TOCTOU 句柄内点击）。金牌 20/20（红证 11 红实抓）、gate GREEN 2/2、全仓
   295 金牌双态零回归、grok 4.5 high（实工 14m31s）+ pi deepseek-v4-pro high 双路
   `APPROVE` 零 C/H/M。工作流身份账本接线失去消费者（拆除挂账）。
3. **十一跑**（`b4r110806i`，1m6s，exit 65）：**`workflow.open` 首次真机走通**——读回
   双证门 `unique`（匹配三元组到手）、无 open 阻断；链路推进到 `workflow.deleteByName`，
   停在计数对账门「布局=unknown、记录容器=null、删除目标=null」截断 route:human。
   根因语境：open 真通后页面停在 `/process/detail` 详情画布，删除步此前从未在该语境
   执行过——「从未走通过」第四例。岔口待裁：atom 级修（deleteByName 前奏补回列表导航，
   契约+双审）vs flow 级修（重表达补 nav 步，B0-B3 重铸+人签）。
4. **残留清偿**：两跑各建一删一（`atl_b4r100806h`/`atl_b4r110806i` 出站守卫真删、
   3 样本缺席 exit 0），B4 累计建八删八零残留。
5. 过程教训已入库：全仓扫描器 `$(basename) $?` 命令替换重置坑（记忆
   verify-goldens-by-exit-code 更新）；金牌自产残件（`loop/prd-tc_*.json`/`.tmp`）是
   `bindagent-replay` EEXIST 红与主树 `PUBLICATION_TMP_WITHOUT_JOURNAL` 红的同源（自清
   挂账）；`loop/audit.jsonl` 是 gitignored 每树各持，权威账在主树（本契约条目已入）。

### 下一步（接手者从甲起）

- 甲、**delete-after-open 语境修**：先把 atom 级 vs flow 级岔口报 Steven 裁，然后按
  既定工法走契约（预期与本契约同构：诊断已清、语境已明）。修通后十二跑预期全链首过。
- 乙、后两例（`publish_states` / `history_version`）等 crud 通了统一处置。
- 丙、挂账：工作流身份账本接线拆除；金牌自产残件自清；`wf-open-smoke` 陈旧红 owner；
  门面拆分族两陈旧红（`arming.static` 0/7、`searchopen` 10/11）；`pi` 对
  `wf-delete-card-layout` 补审；`hook-loop-guard` 跨树互锁失效立项；清单重签补
  `replayGrantPath`。
- 丁、工作树清理：30 棵树（新增本契约树，已 6/6 可摘）。

## 2026-08-06 收盘：诊断买观测 + 九跑一次定谜底 + 语义名回填根因修（历史覆盖层，被上节接续）

现役 dev 顶端 `8d0e6e3`（本地零 push）。接上一层，本日再收两契约、B4 推进到第九跑：

1. **诊断契约 `wf-open-preface-notes` 合入**（`97c0d83`，grok `APPROVE` + pi
   `CHANGES_REQUIRED` → 并集修 → pi delta `APPROVE`）：`compileWorkflowOpen` 前奏与
   锚定各加一条诊断 notes（三候选结局 + 采样数 + 耗时 + 页面态计数），纯诊断零行为差，
   notes 已证进 exit-65 报告。pi 两条 Medium 均采纳：`page.evaluate` 加 3 秒竞速上界
   （其建议的 `evaluate(fn, { timeout })` API 形在 Playwright 不存在，改照
   `replay-settle` 的 EVAL_RACE 先例）、金牌补「采样异常」拒/挂双面钉。
2. 九跑一次拿到谜底，推翻此前全部环境类假说：诊断 notes 显示
   `container=true 采样=1 耗时=5ms 页面态=text346/卡5/框16`、锚定 `命中=true 4ms`
   ——页面完全正常、真名探针即时命中，而 emit 仍 `absent count=0`。差别只可能在定位串：
   `workflow.open` 的 emit 把**未实例化模板** `atl_{{uniqueName}}` 塞进 `semantic.name`，
   两侧定位（compile `locatorFor`、replay `semanticLocator`）都拿字面串 `getByText`。
   即该原子在带模板目标名下**从未走通过**（2026-07-02 采知识时用的是固定既有名）。
3. **根因契约 `semantic-name-instantiate` 合入**（`8d0e6e3`，grok `APPROVE` 零 C/H/M +
   pi 1 Medium → 并集修 → pi delta `APPROVE`）：新增纯函数 `instantiateEventSemantic`
   （仅真含占位且回填有变化时产浅拷贝，否则返回同一引用——落盘字节与上游对象永不被改），
   两侧定位入口各调一次；pi 的 Medium 促成投影上移到全部动作分支之前，覆盖
   `doOpenNode`/`doDragTo`/`doSetNodeField` 等专用身份门，并补五处覆盖面自钉。
   pi 另发现本修复**一并治愈** `agent.searchOpen` 携模板 `openName` 的同类恒 0 命中。
4. **首版设计被全仓扫描逮回**（护栏 #19 的又一实证，值得记住的方法论）：首版给
   `locatorFor`/`semanticLocator`/`resolveCandidate` 加 `ctx` 参数，邻接金牌全绿，
   但全仓 205 金牌里有两个（`page-topology-auth-continuity-boundaries` B6、
   `regress-agent-tool-actions` B2）用 `indexOf('resolveCandidate(page, ev)')` 这样的
   **字面文本**判接线顺序，当场打红。实现随即让路成零字面变更的纯投影，并把
   「这三处字面不许动」写进金牌 S4 自钉。全仓三批重扫 + 逐个基线双态对比：
   非零项**全部基线同码**，零回归（其中 124 是 `timeout` 命令超时假象，
   `p6-heal-breaker`/`loop-kit-extract` 已用 600 秒单跑复核为 0/1 同基线）。
5. **九跑残留已清、工具已持久化**：`atl_b4r90806g` 出站精确 ID 守卫真删、3 样本稳定
   缺席 exit 0；九跑累计建六删六，被测方零残留。清偿脚本曾随会话重启从 `/tmp`
   scratchpad 蒸发，已重建到 `~/casey-tools/cleanup-workflow.mjs <工作流名>`（常备工具）。

### 下一步（接手者从甲起）

- 甲、**B4 十跑取真证**：跑前先重启隧道两端；预期 `workflow.open` 首次真机走通、
  链路推进到 `assert.onPage` 与删除步。失败即停不连跑；跑完记全链路总耗时
  （三轮 pi Medium 同面账本的兑现点）。
- 乙、后两例（`publish_states` / `history_version`）等 crud 通了统一处置。
- 丙、挂账不变：`wf-open-smoke` 既存陈旧红（owner 待查，连带 open 容器归属闸
  fail-closed 面当前无活金牌）；`pi` 对 `wf-delete-card-layout` 补审；
  `hook-loop-guard` 跨树互锁失效立项；清单重签补 `replayGrantPath`。
- 丁、工作树清理：29 棵树全持活 baton、远超护栏 #18 建议的 5 棵，已 6/6 收口的可摘。

## 2026-08-06 全天：重表达落地 + 五契约收口 + B4 八跑停在「二次加载空壳」谜面（历史覆盖层，被上节接续）

现役 dev 顶端 `7f38606`（本地零 push）。接上午层继续：

1. **重表达已落地（Steven 两次裁定：先探针→重表达）**：探针实证被测方版本化模型
   （卡片点入 `/process/detail` 详情画布：导出/分享/预览/测试/新建版本/历史版本/添加节点，
   全站无「保存/发布」钮；「编辑」菜单=信息抽屉）。`tc_catalog_wf_crud` TestCase v2
   （`intent_save`→`intent_open`）+ flow 重排（create→noErrorToast→nav→open→onPage(detail)
   →noErrorToast→deleteByName）+ B0 代签 confirm（A5 口径、如实披露）+ B1 同步 + B2 重铸
   权威（signer 代签）+ B3 PRD 登记（新哈希 `14b3be7e…`）。旧件归档
   `cases/tc_catalog_wf_crud/archive/*.pre-20260806-reexpress.json`。
2. **又两契约六阶段收口合入**（各双路 APPROVE）：`post-nav-anchor-wait`（open 文本锚 +
   delete 搜索框锚 15s 有界就绪，`d96d833`→恢复提交 `db80a17`）；`wf-open-search-first`
   （open 搜索先行：三候选轮询——容器内命中才跳搜索、裸文本 toast 假阳只授锚预算、
   搜索框命中走 fill+放大镜；条件预算失败路径封顶；r1 双路 APPROVE + 并集修 + r3 delta
   APPROVE + S5 判别钉，`7f38606`）。今日累计**五契约**全绿合入。
3. **一起真事故与两条纪律**：评审方在真工作树用 `git checkout <rev> -- <file>` 做红证
   复现（该命令写暂存区），评审收据提交把回退带进了 `a8700a1`、合并后主树金牌逮住——
   已修复（`db80a17`）并立规：**评审后提交前必核 `git diff --cached`**；红证复现改用
   `git show <rev>:<file> >` 姿势（不碰暂存区）。另 `hook-loop-guard` 在工作树误拦一次
   （读主树 baton，HANDOFF 丁项已知缺陷第四次实证；分步 add/commit 可绕）。
4. **B4 八跑总账**（乙授权内，一例一跑）：跑 1-3 登录冷启/预算骑线（已由 login-nav-budget
   治愈）；跑 4 create 八步全通、停 `workflow.save` 断层（引出重表达）；跑 5-8（重表达后）
   create 全通 + 读回 unique，停 `workflow.open` absent。**八跑残留全清**（五个实体
   b4r4/5/6/7/8 各以出站精确 ID 守卫真删、3 样本稳定缺席 exit 0；r2/r3 未建）。
5. **open absent 谜面现状**（本段 2026-08-06 上午快照，只溯源、勿据其判现状——谜底已由
   当日收盘层的九跑诊断给出：真因是 `semantic.name` 模板未回填，与下述空壳推断无关）：
   三候选轮询后仍 absent 且前奏未走搜索分支
   （atstep_9 是 click 非 fill）→ 时间账指向「nav 后 15s 内容器文本/裸文本/搜索框三者
   皆不可定位」= **create 后第二次整页加载偶发长时间空壳**（与晨间隧道池老化的
   `net::ERR_EMPTY_RESPONSE` 空壳同族）。反证据：只读复现驱动（真 nav+open 对既有名）
   一切正常——nav 完成后列表即时可定位、open 前奏 <900ms 出手（短名命中 3 处判
   ambiguous 是身份门正确行为）。谜面缺的是 B4 现场页面取证。
6. **既有名短名 ambiguous 新知识**（只读复现实证）：2 字符工作流名 text-exact 全页 3 命中
   ——workflow.open 对短名有 ambiguous 面（route:human 正确拦），用例名用 atl_ 长名无碍。

### 下一步（接手者从甲起）

- 甲、**（已完成，见收盘层）open 现场取证小契约**：给 `compileWorkflowOpen` 前奏加诊断
  notes（三候选各自采样计数/耗时/页面 bodyTextLen），notes 已证会进 exit-65 报告——
  九跑一次即得谜底（真因是模板未回填，非空壳）
  （料想坐实二次加载空壳）。若坐实：修向 = nav 后加「页面就绪判据」（如列表 API 响应
  已达 + 卡片容器非空）或隧道池按跑重启纪律机制化。
- 乙、后两例（publish_states / history_version）等 crud 通了统一处置（同断层大概率）。
- 丙、挂账不变：三轮 pi Medium 同面（失败路径预算账，B4 通跑时记总耗时）；
  `wf-open-smoke` 既存陈旧红（owner 待查，连带 open 容器归属闸 fail-closed 面无活金牌）；
  过滤态互扰现场核；`pi` 对 `wf-delete-card-layout` 挂账补审；丁 hook-loop-guard（今日
  又一实证）；上午层其余项。
- 环境：隧道两端本日多次重启（池老化 ~1 小时/高请求量后浏览器复用报空响应、curl 恒好；
  重启即愈）——**跑真机前先重启隧道两端**已成纪律；会话重启后隧道需重建（先 WSL
  `scripts/wsl-reverse-listen.mjs` 后 Windows `win-forward-start.cmd`）。

## 2026-08-06 上午：三修连环收口 + B4 突破到知识断层 + 残留已清（历史覆盖层，被上节接续）

现役 dev 顶端 `9bb2300`（本地零 push）。本日两契约合入 + B4 四跑 + 残留清偿：

1. **又两块骑线预算契约六阶段全绿合入**（双路 grok+pi APPROVE，与 08-04 晚的
   sleep 导入修同族——「页面变重后旧预算压线」缺陷类共三例）：
   `wf-create-entry-anchor-wait`（`158829d`，create 入口点击前 15s 有界就绪锚，
   真机定量 load 后按钮 +3.5s vs 锚定窗 4s）；`login-nav-budget`（`9bb2300`，
   loginBootstrap 默认导航预算 15s→30s 天花板，登录页 load 实测 13.8-14.9s vs 15s）。
   挂账：pi 各留一条非阻断 Medium（失败路径耗时收窄看门狗余量 / 三段被吞等待与预算
   解耦加固候选），见各自 reviews/README。
2. **B4 第四跑重大突破**（45.7s，watchdog 余量充足）：`workflow.create` 八步全
   unique+acted（含下拉菜单项点击）、身份读回 unique——三修全部生效；
   「工作流编码」字段**非必填**实证（未填也建成，昨日 route:human 项就地清偿）。
   失败推进到**知识断层**：`atstep_8 workflow.save/click absent`（建后页面不进编辑器）
   + `workflow.deleteByName 入口可证缺席 → CASE_DEFECT 候选`。这不是工装 bug——
   07-02 流程预期（create→编辑器→保存→发布）与现役页面语义（create→留在列表页）不符。
   按一例一跑失败即停，**岔口待 Steven 裁**：flow 重表达（真机重表达配方）vs 判 CASE_DEFECT。
3. **残留已真删清偿**（`atl_b4r40806b`，exit 0）：列表读回恰 1 → 搜索图标筛到 1 卡 →
   触发 unique + identityReadback ok → 确认环 unique（「确认」）→ 出站守卫恰放行
   1 条精确 `masProcessId` delete、零其他变更 → 3 样本稳定缺席。
4. **环境实证两条**（进 learn 级）：①隧道池老化——池连接跑 ~1 小时后浏览器复用报
   `net::ERR_EMPTY_RESPONSE`（同一 JS chunk 稳定复现、curl 新建连接恒好），重启隧道
   两端换新池即愈；长间隔后跑真机前先重启隧道。②`performWorkflowDeleteTrigger` 返回
   axis 形状（`resolution/candidateCount/identityReadback`），**无 `acted` 字段**——
   拿 emit 语义硬套会误拦（本日实踩）。③`ss -tn` 对回环连接两端各计一行，
   连接数要除 2 再判（差点误判双代理污染）。
5. B4 前三跑失败链（全部零残留、fail-closed 干净）：跑 1/3 登录冷启超时、
   跑 2 入口按钮 absent（引出入口锚契约）——诊断报告归档
   `cases/tc_catalog_wf_crud/archive/compile-report.b4-fail-20260804.json` 与本层记录。

### 下一步（待裁后续行）

- **甲、岔口（Steven 裁）**：tc_catalog_wf_crud 的 flow 语义与现役页面不符——
  ①按真机重表达配方走（扩 flow 绑定→铸权→哨兵→重编译→补缝→确认→签→跑，
  B0-B3 重来、触 G3 人签）；②判 SUT/用例侧 CASE_DEFECT 走缺陷路径；③先只读探针核
  「create 后如何进编辑器 / 保存发布入口现役形态」再定。推荐③先探针再裁。
- 乙、后两例（publish_states / history_version）大概率同断层，等甲裁定后统一处置。
- 丙、挂账：两条 pi Medium 加固候选；`pi` 对 `wf-delete-card-layout` 前提审补审；
  丁（hook-loop-guard 跨树互锁）、清单重签补 `replayGrantPath` 等 08-04 层原有项不变。

## 2026-08-04 晚：B4 根因定位收口——wf-crud-sleep-import 合入（历史覆盖层，被上节接续）

现役 dev 顶端 `8d0b0bc`（merge wf-crud-sleep-import，本地零 push）。

1. **B4 根因已定位并封缝，两个原候选全排除**：不是页面形态变化、不是 seam-1 偏移，
   是 `6f91125` 拆单体 `compile-atoms.mjs` 时丢了 `sleep` 导入——
   `compile-atoms-workflow-crud.mjs:136`（`workflow.create` 的 `sleep(250)`，B4 实证根因）
   与 `compile-atoms-workflow-drawer.mjs:53`（`openNode` 轮询 `sleep(100)`，普查逮到的
   潜伏件）。同缺陷类**第三例**（前两例 `01e965f`、`c66544e`）。定位链：只读探针（全域
   非读拦截）→ 真组件忠实复现同签名 → 绕过密封边界直调原子抓到 `ReferenceError`。
2. **契约 wf-crud-sleep-import（light，工作树）六阶段全绿**：2 行 import 修 + 金牌四钉
   （S4 是整类普查钉：lib 全树裸调 `sleep(` 必有导入/定义）+ 红基线 0/4 实抓 + 突变验证
   闭环 + 邻接五项绿 + gate GREEN 2/2；grok-4.5 high 与 `pi` deepseek-v4-flash high
   双路 `APPROVE` 零 C/H/M（快照 `bbde48c`）；合并后主树六项复跑全 exit 0。
   审计已入 `loop/audit.jsonl`（工作树与主树两账本）。
3. **交接口径更正**（learn.md 在案）：B4 报告 `persistentActionStatus=CONFIRMED /
   recorded-action-succeeded` 是回退推断（首个 persistent 原子事件 acted=true 即判，
   首个是 nav），**不能**读成「最后一次动作成功」；`eventsEmitted` 才是硬结构线索。
   另：07-22 三链全 PASS 在拆分（07-27）之前，拆分后 `workflow.create` 真机首触即炸。
4. **环境事件**：drvfs 整盘 I/O 故障当日第二次发生，Steven 执行 `wsl --shutdown` 恢复；
   重启后真机隧道已按顺序重建（WSL 侧监听器 → Windows 侧代理），15519 端到端 200。
   根因证据抢救件在 `~/casey-b4-rootcause-20260804/`（含 ROOTCAUSE.md，注意其中
   probe-out.json 含 SUT 账户资料残影、不得入仓）。
5. **只读探针新发现（B4 重跑时现场核）**：创建抽屉现役含新字段「工作流编码」、确认钮
   文本「确认」（原子探测序含「确认」兜底，两处均可能无碍——若「工作流编码」必填则
   create 原子缺一个 fill，属编译知识缺口另立契约）；页面**点击前**预挂离屏抽屉 DOM
   （`nameInputCount` 点击前即 1），emit 的定位唯一性面未受影响但值得知道。
6. **下一步即乙**：B4 重跑（`tc_catalog_wf_crud`，新唯一名令牌、一例一跑、失败即停），
   命令面见 `SIGNING-SESSION.md` B4 节；B0–B3 就位不必重来。其后 B5–B9、再下两例。

## 2026-08-04 全天：P9 六批次收口入 dev + A 段签署闭合 + B 段开跑即停（历史覆盖层，被上节接续）

现役 dev 顶端 `c89b3b8`。本日入 dev 六笔（均本地，**零 push**）：

| 提交 | 内容 | 评审 |
|---|---|---|
| `a57366c` | chief `requestLogPath` 漏导入一行修 | grok + `pi` 双路 APPROVE |
| `6f51aaf` | `p9-replay-ref-rebuild`（回放写入侧重建破坏连续性 ref） | 双路 APPROVE，11 例负探针全 exit 65 |
| `c66544e` | `agent-delete-confirm-import` 漏导入一行修 | grok APPROVE（`pi` 上游三败挂账） |
| `57422af` | P9 A 段签署封账 + 形状实采实录 | —— |
| `3010d86` | `wf-delete-card-layout`（卡片布局悬停菜单删除路径） | R4 grok + `pi` 双双 PLAN/IMPLEMENTATION APPROVE |
| `158f2ec` + `c89b3b8` | `p9-replay-authority-split`（批级一次性回放票据）+ C2 四处 v3 金牌 amendment 签回 | r5 双路双 APPROVE；签回前三方哈希对账、签后全仓漂移扫 exit 0 |

A 段**已闭合**（`evidence/signing-a-segment-20260804.md`）：A3 第三次真机重编译 exit 0，
`events.json` 找回，第 5 步首次落 `replyStreamUrl`（脱敏 pathname）与 `replyText`（智能体
规范化输出，与发送正文不同串，非回显）；A5 签署 exit 0——`expected.frozen.json` 重签
（sha256 `a92dc368…`）+ `entity-locks.frozen.json` v2 首签（`f2b58812…`）。代签授权**如实在案**：
Steven 当日原话「同意了，你帮我代签了，这是我的授权」，确认件与 `casey sign` 均由 Claude
代执行、逐条标注非本人敲入；草稿含 1 条 `assert.bubble` 未映射 pending，按签署门既定出口
`--force` 强签留痕（断言集与 0703 亲签集同集、零增减零弱化）。

真机**形状实采**（`evidence/shape-probe-20260804.md`）：delete 请求形状实证
`POST /ai-manager/process/delete`、`bodyKeys ["masProcessId"]`、`idLocations ["body.masProcessId"]`，
全程零变更抵达被测方；同轮逮到卡片布局缺口（删除入口藏悬停「更多操作」菜单），催生
`wf-delete-card-layout` 契约。

B 段今日**开跑并按停止条件停住**——接手者从这里续：

1. 相位 0 三关过：隧道回环 200（WSL 侧 `wsl-reverse-listen.mjs` 单实例 + Windows 侧代理，
   起隧道顺序敏感）、`doctor` 就绪级全 ok。
2. B4 前置检查单三项**已真机核完**（只读探针）：seam-1 坐实——搜索框按 `Enter`
   **不过滤**（可见卡片数 6→6），点 `.hr-input__suffix .search-icon` 才过滤（6→1）；
   `countSelector` 坐实——`.hr-card.hr-card--bordered` 计数为 0、现役卡片是 `.agent-card`
   （旧 `workflow-delete-real-uat` 金牌的选择器已陈旧，删后归零断言有假绿风险）；
   F1 坐实——目标卡 `button.agent-card__more` 物理 1 个、可见 1 个（无隐藏克隆，
   grok 那条 Medium 在现役页面不成立）。
3. `atl_shape0804a` 残留**已真删清偿**，且是新卡片菜单删除路径的首次真机实战：
   触发 unique → 确认环 unique → 删除后 3 样本/3.4 秒稳定缺席，退出码 0。
4. `tc_catalog_wf_crud` 的 B0–B3 已完成（B0 confirm 代签同口径、B1 两件逐字节相同、
   B2 `execute-freeze` exit 0 落 `runs/p9-v3-20260804/`、B3 sha256 `88c53778…` 已登记
   进 `loop/prd-tc_catalog_wf_crud.json`，旧 `events`/`observed` 已存
   `cases/tc_catalog_wf_crud/archive/*.pre-20260804-b4.json`）。
5. B4 编译失败并已停手（不连跑）：`COMPILE_EXIT=1`，
   `COMPILE_ATOM_EXECUTION_FAILED stepOrdinal=1 atom=workflow.create`，
   `eventsEmitted=2`、`blockerCount=0`、`persistentActionStatus=CONFIRMED`
   （指最后一次记录动作本身成功，非「实体已建成」）。只落 `compile-report.json`，
   其余成组产物按设计未落。随后只读扫库：`atl_` 前缀残留 **0 条**（库内 5 条工作流
   全非本轮），即创建未落库、被测方干净、无需清偿。根因**尚未定位**——两个候选：
   ①新增工作流入口（下拉菜单/抽屉）在现役页面形态变了；②seam-1 的搜索不过滤导致
   前序定位链偏移。接手者第一件事就是查它，别急着重跑（每跑一次都可能建真实体）。

### 下一步（按依赖排序，接手者从甲起）

- 甲、定位 B4 `workflow.create` 失败根因（不重跑编译、先只读探针）：在真机上核
  新增工作流入口现役形态（`新增工作流` 钮 → 是否有下拉 `menuitem` / `hr-dropdown__item-text`
  → 抽屉字段与确认钮），与 `lib/compile-atoms-workflow-crud.mjs` 的 2026-07-02 实采知识对表；
  同时判 seam-1（`Enter` 不过滤）是否已影响前序步。定位后按缺口大小决定直干还是开契约。
- 乙、续跑 B 段三例 B4→B9（Steven 已全授权、代签口径同 A5）：一例一跑、失败即停不连跑；
  每例 B4 会真建一条并真删一条。crud 的 B0–B3 已就位、可直接从 B4 起。
- 丙、清单重签补 `replayGrantPath`（`p9-tier2-selftest` T9a 计划内红的清偿点，签署会话 C 段）。
- 丁、`hook-loop-guard` 跨树互锁失效（kernel 级，三个执行者独立实证，机理已查明：
  `resolveRoot()` 从 cwd 上溯解析到主树、`git diff --cached` 也跑在主树，
  故工作树里既不会正确拦也不会正确放；首次误拦甚至是拿提交信息正文当 pathspec 判的）。
  立不立项、走哪条车道待 Steven 裁。
- 戊、**挂账补审**：`pi` 对 `wf-delete-card-layout` 前提审那一轮（当日上游三败，Steven 裁
  grok 单路过闸 + `pi` 挂账补审）；其余轮次 `pi` 均已实审覆盖。
- 己、三枚他家历史基线红（不由上述契约改写）：`real-run-trust`（静态钉与现行
  `bin/replay.mjs` 参数解析失配，owner `prd-agent-id-readback`）、
  `hermetic-golden-isolation-pending`、`p3-compile.golden.mjs`（启夹具 SUT，代理禁跑）。

### 契约 / 运维（2026-08-04 收盘）

- 活契约槽：`p9-created-workflow-cleanup-continuity-v3`（`full`，`grill`/`plan`/`accept` done、
  `loop` 待——B 段跑完才算）。本日四个 worktree 契约（`chief-stream-replylog-import`、
  `p9-replay-ref-rebuild`、`agent-delete-confirm-import`、`wf-delete-card-layout`、
  `p9-replay-authority-split`）均六阶段全绿并已合入 dev。
- 主树未提交现场（**用户资产，勿动**）：`docs/plans/chiefcomplaint-sendandwait-admission/SIGN-AND-AFTER.md`、
  `docs/plans/p9-uat-close/resign-runbooks.md`、六个 `loop/prd-*.json`（含本轮 B3 登记的
  `prd-tc_catalog_wf_crud.json`）；未跟踪 `casey-agent-loop-local-first-total.zip`、
  `follow.mjs`、`docs/plans/gate-contract-preflight/REVIEW-PROMPT-for-codex.md`、
  `loop/prd-tc_eui_bindagent_lockchain.json.tmp`。
- 评审供应方现状：`grok-4.5` high 与 `pi.dev` `deepseek-v4-flash` high 双路为常态；
  `codex` 无额度；当日故障如实分列（`grok` 一次 904 秒超时无终局、一次会话限额中断、
  `gpt-5.6-luna` Windows runner `CreateProcessWithLogonW` 267/1312 记 HARNESS_ERROR、
  `pi` 上游 503 三连败）——任何一条都未被冒充成结论。

## 2026-08-04：guard-net 收口合入 + 三轮真机实测 + read-safe 方向已签（历史覆盖层，被上节接续）

1. **guard-net 契约全闭环合入 dev**（merge `4b80013`，分支四提交 `83a8c98`/`d1f83a2`/`24e0508`/
   `e19ccdb` + 收口 `5e72f09`）：边界门目录自动发现 + d3 执行面白名单反转 + `unsupportedScopes`
   单一事实源（纯叶 `lib/zero-shot/unsupported-scopes.mjs`）+ 元钉金牌 12 枚 + `container-out`
   词条登记。评审闭环：前提审（grok）三条采纳 → R1 代码审唯一 Medium（symlink-to-dir 绕过
   「无子目录」钉，可复现）→ R13 修复（dangling 取 fail-safe 一律红）→ 聚焦复核终局 `APPROVE`。
   合并后主树复跑 24 项全 exit 0（含 teachin s2 易漏支、drift-scan、term-lint、tier1）。
   状态口径：门禁基础设施契约 = 机器门禁绿。
2. **三轮真机实测已入账**（全部 autotest 只读零 mutation）：探针（抽屉零 role、名称大面积重名、
   默认候选上限必截断）→ 切片 1 实跑（链条通到确定性解析 `resolved`、卡在 admission 拒
   `ACTION_TARGET_NOT_READ_SAFE`；订正「`redactionSuppressed` 非零常态」旧断言——实测两业务页
   均 0、登录落地页 1）→ 路由普查（21 路由 697 候选，只读白名单命中 **0**；全站零 `a[href]`、
   `role:link` 仅 3 条且全部只差名字标记一关；站点命名习惯「名词=去哪里、动词=做什么」）。
3. **read-safe 白名单演进方向 Steven 已签：乙（人签名单）**——每目标人签一条（默认空、
   fail-closed），正向动词保留为免签快速道；零翻已冻断言（纯加法）。配套裁决：「取消」补负筛表
   先行（纯加严）；签署载体=冻结常量模块+复用 `isSigned` 三件套+Test Ratchet（不碰
   `bin/sign.mjs`）；名单无自动过期（改动走 amendment）；改默认策略以多站证据为前置。
   起草在 scratchpad `draft-read-safe-evolution.md`（含对 R11 威胁模型的逐条回应：正向动词闸
   对蓄意注入者价值为零、买到的是良性页面意外面收敛）。
4. **工装纠正**：工作树缺 `cases/`/`runs/` 冻结件用复制不用软链（软链触 `sign` 物理边界核
   按设计拒付）；`hook-loop-guard` 对工作树 baton 盲（从主树 cwd 解析），工作树互锁实际由
   本树 contract 台账保证——两条均已入 learn 与 PRD notes。
5. **Wave 3（harness）环境**：podman 镜像已钉
   `node@sha256:2356…b8e7`、隔离冒烟全过；真容器门 exit 1，唯一缺口 cgroup cpu 未对 rootless
   委派——**待 Steven 人工终端三条 root 命令 + `wsl --shutdown` 重开**（见
   scratchpad `harness-oci-setup.md`；勿用 `systemctl restart user@1000`）。三条 S0 发现：
   doctor 是浅检查不可当就绪证据、`nr_inodes` 口径差、脏树基线问题。16 问裁决在
   scratchpad `harness-migration-adjudication.md`。
6. **下一步**：read-safe 乙实现（前提审 → acceptance-gate → 实现 → 你签名单首批 1-3 条）→
   切片 1 真机正向链复跑（预期 `resolved→admitted→perform→progressed` 全链）→ typed-progress
   达成「通过」→ 晋升门开工（完成定义含真机 3 轮）。P9 总闸不变：`REAL_SUT_PASSED=false`、
   `HUMAN_SIGNED=false`。

## 2026-08-03：Wave 4→6 首片——typed progress predicate 闭集扩展（历史覆盖层）

1. **起点核对**：会话开始时 `dev@d77dfb5`，摸底期间另一写入方把 Wave 1/2 落到 `dev@a3a9a28`
   （`9272d97` + cherry-pick `d89879d` + 交接层 `a3a9a28`）。Wave 1 四枚冻结金牌在 dev 上实跑
   全 exit 0（9/9、8/8、8/8、6/6），确认已落地、无需重做。Steven 确认写权独占后从 `a3a9a28`
   起独立工作树 `casey-zero-shot-typed-progress-predicate`（分支同名）。
2. **本层做了什么**：把 zero-shot typed progress predicate 闭集从单一 `urlPathname` 扩到
   `roleVisible` / `roleHidden`，使 P9 纵向切片 1「点击工作流管理」的三条**否定式**验收点
   （没自动打开具体工作流、没进测试会话、没进消息页面）第一次可被表达。判定是
   `PageObservation` 已有事实的纯函数投影——零新增采集、零驱动改动、零持久状态，
   不碰正式回放链、不进 `verdict.mjs`、三轴与 report。
3. **真正的价值不在扩枚举，在堵 fail-open**。缺席类断言只有目录完整才证得出来，而现役
   `progress-verifier` 对 after observation 既不查 `truncated` 也不查 `unsupportedScopes`
   （`affordance-authority.mjs` 的 `blockReason` 只在 `revalidateAffordance` 被查、
   `inspectAffordanceAuthority` 不看它）。三轮共堵四种不完整来源：目录截断、未支持作用域、
   **脱敏抑制**（自查探针逮到）、**空目录**（评审逮到）。
4. **三次收敛，每次都是实测推翻推理**：
   - 首版按「肯定/否定」划线，只对缺席类查 after。
   - R1 自查：`semanticOf` 在三个名称来源任一命中敏感规则时整条丢弃候选且不计入 `truncated`；
     可见的详情抽屉只因正文含 32 字符以上不透明标识就整条消失，`roleHidden` 误判成立
     并判 `progressed`——**真实假绿**。修法把「脱敏抑制」与「无可用名称」分开计数
     （无名候选没有名称、永远匹配不上 `role+name` 判据，丢弃无害）。
   - R2 异构评审：`pi` 逮到 driver 层截断（`playwright-page-driver.mjs:71-72` 在候选数达
     `MAX_DISCOVERED` 时直接不收元素，`pageCount` 在幸存集上低估成 1，`roleVisible` 同样假绿），
     证伪首版豁免理由；`grok` 逮到 before 侧脱敏抑制可达（`observationBlocker` 不查
     `redactionSuppressed`），判据由假翻真、因果闸放行未发生的进展。**收敛成一条更简单也更
     正确的规则：按「是否读目录」划线，而不是按「肯定/否定」划线。**
5. **证据**：金牌 `zero-shot-typed-progress-predicate.zero-sut.golden.mjs` 红基线 4/18
   （红因 `EXPECTED_PROGRESS_NOT_ALLOWED` = 实现缺席，非 marker 假红）→ 24/24；十二路变异
   十一路由绿转红，每次还原后 sha256 字节全同；邻接 11 项全 exit 0；`gate` GREEN 5/5。
   评审全轨迹：R1 双路（grok-4.5 high + pi deepseek-v4-flash high）`CHANGES_REQUIRED` →
   R2 修复（`981b4a3`）→ R2 复审（pi 网络挂起换 grok）仅剩一条 Medium（plan 旧文与新规则
   对撞）→ R3 订正（`e752418`）→ R3 聚焦复核终局 `APPROVE`（金牌 diff 仅 1 行标题、账本与
   sha256 实物一致、复核方自跑 24/24 exit 0）。收据齐存 `reviews/`，audit.jsonl 有机读记录。
   五个本地提交 `15721ff` / `446881b` / `981b4a3` / `e6e7ea1` / `e752418`，按 Steven
   「APPROVE 后合入」授权合入**本地 dev**；未 push、未 rebase、主树未提交内容一字未动。
   **状态口径（Steven 2026-08-03 令：一定是实机跑过才算通过）**：本契约 = 机器门禁绿。
   **真机切片 1 已实跑**（autotest 只读零 mutation，证据 `runs/zero-shot-slice1-20260803/`）：
   eligibility→契约冻结→观测（500 不截断）→确定性解析 `resolved` 真机全通，卡在 admission
   拒 `ACTION_TARGET_NOT_READ_SAFE`——只读白名单在三条路由零可动作面（真机导航链接全是
   纯业务名词），`verifyStepProgress` 正向路径真机零覆盖；判据本体真机成立（详情页
   `matched 1/pageCount 1/visible true` 对列表页 0 的真实因果差）。**订正**：先前记
   「`redactionSuppressed` 非零是真机常态」为误（探针代用值口径），实跑真字段两业务页均 0、
   登录落地页 1。通过判定未达，卡点为 `read-safe` 白名单范围，演进路线待 Steven 裁。
6. **开口项（如实挂账，勿当已覆盖）**：
   - 删 `pageCount === 1` 金牌仍不红——收敛后该状态经生产路径不可达（由 P21 钉住），
     属已知**测试不可达面**；
   - 两类可见元素进不了 `role+name` 匹配面：无 role 属性的裸容器（driver 候选过滤直接排除、
     不带完整性标志），以及有 role 但可访问名为空被投影成 `label`/`text` 的元素。
     zero-SUT 夹具无枚举边界，证不出，须真机只读探查由人确认；
   - 工作树跑 `prd-drift-scan` 缺 `cases/` 与 `runs/` 冻结件时（两者 gitignored、只在主树），
     须从主树**复制真文件**补齐；绝不软链——guard-net 契约实测软链会触 `sign` 物理项目边界核的
     按设计拒付（`entity-binding-operability-successor` O1 假红，O3 恰钉此行为）；该门本质是
     **主树**检查。
   - 合并回 `dev` 需 Steven 单独授权；合并后须按护栏 #19 在主树复验受影响面。
7. **下一步**：Wave 4 的观测包（页面内容器作用域，与浏览器拓扑严格分离）、Wave 6 的
   promotion gate、Wave 3 的 `agent-loop-harness` 迁移（触 hooks/gate/package scripts，
   属 kernel 车道，须双设计审 + 人签）均未开工。P9 真机与人签仍全部未闭：
   `REAL_SUT_PASSED=false`、`HUMAN_SIGNED=false`。

## 2026-08-03：Codex 停点交接——Wave 1/2 已提交本地 dev（历史覆盖层）

1. 用户要求在 Wave 2 后停止。本轮从 `dev@d77dfb5` 建 Windows 独立工作树
   `D:\ctx\heren\casey-p9-waves`，完成后把两笔已验证纵向提交落回本地 `dev`：
   - `9272d97 feat(p9): wire created-workflow continuity v3`；
   - `d89879d fix(teachin): require raw locator uniqueness`。
2. Wave 1 的 P9 v3 动态字符串 ID、单次 ref、删除前 exact request guard、至少 3000ms/
   3 完整样本稳定缺席和 axes→零 LLM verdict→report→Tier2 深消费已机器闭合。真实 SUT
   仅由 Windows 原生 Chromium 完成只读列表/DOM/字符串 ID 探测，明确
   `mutationSent:false`；不得写成真实 P9 通过。
3. Wave 2 在 Windows 原生 Chromium、每案 fresh BrowserContext 的 hermetic fixture 上
   红先行 5/3、修后 8/8；提交后绑定 `a981be1` 的真实浏览器金牌与 PRD gate 均 exit 0。
   同一补丁已摘入 `dev@d89879d`；初始双候选、1→2 漂移、节点替换、disabled、遮挡和
   pointer-inert 均零点击拒绝，唯一正控真实点击恰一次。
4. 当前状态：`MACHINE_PASSED=true` 仅指 Wave 1/2 已列机器验收；
   `REAL_SUT_PASSED=false`，`HUMAN_SIGNED=false`，P9 仍 open。签署版 Tier2 manifest、
   exact mutation 授权、三次 fresh compile、三条真实 create→ID→delete→稳定缺席、五成员
   同批 Tier2、录像/报告/残留扫描与最终 UAT signoff 均未完成。
5. Wave 3 的 `agent-loop-harness` 控制面迁移尚未开始；观测包、多模态 proposal、typed
   progress predicate 与 promotion gate 也未开始。下一任先从当前真实 `dev` 新建独立
   worktree，复核本节两笔提交和工作树状态，再按 Wave 3 红先行；不得把旧 `loop-kit`
   与新 harness 同时保留为两个有状态控制器。
6. 原 `dev` 工作树在本轮开始就存在的非 Wave 改动仍保留为未提交状态，未被暂存、覆盖、
   删除或代提交。全程未 push、未 merge、未 rebase，远端仍未变化。

## 2026-08-03：raw Playwright 原始定位器唯一性闭环（最新覆盖层）

1. Windows 独立工作树 `casey-p9-waves` 的 canonical raw 驱动已移除
   `locator(...).first().count()`：等待任意候选与权威 locator 分离；resolve 和动作窗口
   revalidate 均重新对原始集合计数，恰一后才取 handle。active page、owner、connected、
   same node、origin 与 one-shot action authority 仍为合取条件。
2. Windows 原生 Playwright Chromium、每案 fresh BrowserContext 的 hermetic 金牌红先行
   `5/3`，修后 `8/8`。初始双候选出 `ambiguous` 且无 authority；1→2 漂移与 clone
   替换均 `ACTION_FAILED`；disabled、遮挡、pointer-inert 全部页面点击计数 0；唯一正控
   真实点击恰一次。
3. 现役 raw action authority/actionability/clear-fill/runner 邻接金牌、Tier 1、term-lint
   与本契约 gate 均 exit 0。全仓审计未发现另一处“先 first/nth 再 count”后据此铸
   action authority 的同类错误；只读历史/意图观测和“先原始 count、后取唯一候选”
   路径未扩修。
4. 本层只证明真实浏览器的 hermetic 动作路径，不能替代生产 SUT P9；
   `REAL_SUT_PASSED=false`、`HUMAN_SIGNED=false`。冻结测试精确字节的人签仍待取得。
5. 证据索引：`docs/plans/teachin-raw-locator-uniqueness/evidence/`。未 push、未 merge、
   未 rebase；原 `dev` 脏工作树仍未改写。

## 2026-08-03：P9 created-workflow continuity v3 机器实现就绪（最新覆盖层）

1. 在 Windows 独立工作树 `casey-p9-waves`、分支 `codex/p9-waves` 上完成 P9 v3 机器纵向链：结构授权 draft/freeze/read/preflight、当轮完整列表字符串 ID 读回、单次 ref、删除前 method/path/唯一 ID location 守卫、至少 3 样本且至少 3000ms 的同 ID 稳定缺席，以及 replay→三轴→零 LLM 裁定→报告→Tier2 清洁门深消费。
2. 四枚冻结红基线由 5/4、0/8、0/8、0/6 转为 9/9、8/8、8/8、6/6；四枚 successor 分别 6/6、4/4、5/5、4/4。Windows `tier-1`、术语检查和 PRD ratchet dry gate 均 exit 0。C2 三枚邻接与 bindAgent 双锁在 WSL 同一工作树补充交叉执行全绿，未放宽 relation 原子双锁。
3. Windows 原生 Chromium 对真实 SUT 的只读探针 exit 0：真实列表 2xx、完整扫描精确命中 1 条、ID 保持 string、DOM 容器确认 `article.agent-card`；全程 `mutationSent:false`。当前没有 delete-capable 记录，真实删除请求形状仍未确认。
4. 状态口径：只能称 `P9 v3 machine implementation ready`。旧固定 ID ref-rebuild 历史红件、签署版 Tier2 manifest、人签 mutation 授权、三次 fresh compile、三条真实清理、五成员同批 Tier2、录像/报告/残留扫描和最终 UAT signoff 均未闭合；`REAL_SUT_PASSED=false`、`HUMAN_SIGNED=false`。
5. 证据索引：`docs/plans/p9-created-workflow-cleanup-continuity-v3/evidence/wave1-machine-implementation-20260803.md`。未 push、未 merge、未 rebase；原 `dev` 脏工作树未改写。

## 2026-07-31 凌晨：publish 阻断点定性纠偏 + P9 推到只剩人签（最新覆盖层）

> Steven 睡前授权自行判断推进，总目标 P9 完成、顺带起接口交互。本层记的是
> 无人值守这一段。**凡需人签的一律没签**——D5 口径修订在契约里明写「须
> Steven 明签不代签」，我只备文本与证据。

1. **publish 只剩一个阻断点，而且此前的定性是错的**。四轮真机
   （`run_baseline1/2_20260730`、`run_loadfix1/2_20260730`）逐轮核实：12 步动作
   **全部** `result=ok`，唯一非 PASS 是 `atstep_11` 关闭步
   （`NEEDS_HUMAN` / `SUT_DEFECT_OR_STALE`），**保存步四轮全 PASS**。
   - 订正一：此前记的「顶栏延迟挂载致保存步系统性红」不成立——那是重表达前的
     旧样本，重表达后四轮 `locatorResolution: unique` 且步级全 PASS。剖面新增的
     `loading` 活配置（原 `quiet.loadingSelector` 是运行时从不读取的死配置）
     已覆盖该面。
   - 订正二：关闭步动作是对的，错的是断言口径。真机探针实测按 Esc 后
     「创建时间」DOM 命中 1、可见命中 0，而现役 `assert.textHidden` 数 DOM 命中；
     注册表把该原子定义为 `toBeHidden`（含未挂载），**签字时的契约就是可见性**。
     故不需要带外侦察关闭控件。
2. **契约 `assert-visibility-semantics` 六阶段全收口，11 个提交已 push `origin/dev`**。
   金牌十钉（红先行 exit 1、2/9 → 收口 exit 0、10/10），gate GREEN 3/3。
   生产件改 `lib/replay/intent-observation.mjs` 与 `lib/assertion-draft.mjs`。
   - **真机 A4 已兑现**：最终码上跑五轮，`run_final1/3/4/5_20260731` 均 6/6 全
     PASS、`textHidden 创建时间` 逐轮 `ok:true actual:0`；`run_final2` 抖动作废
     并记账（`atstep_1` 即 `locatorError` 级联，失败在定位层不在采集层，且系统落
     `NEEDS_HUMAN` 未假绿）。辅助探针首末轮各一次，均 `Esc 前 DOM 1/可见 1 →
     Esc 后 DOM 1/可见 0`、判 `HIDDEN_NOT_UNMOUNTED`，独立会话复现真机接缝。
     探针 `scripts/visibility-a4-probe.mjs`，证据
     `docs/plans/assert-visibility-semantics/evidence/`。
   - **异构评审 codex sol max 三轮**（全部对着不可变 commit 跑）：r1 一条
     Critical（提示读取拆成两次采样→短命提示谢幕后 `textHidden` 判过，废掉
     「兜底的价值是时间」）；r2 一条 Medium（补的 V10 只钉调用顺序、没钉不变量，
     「两次采样但可见那次读在前」能蒙绿）；r3 一条 Medium（计数只覆盖 `evaluate`
     一条通道，混合通道蒙绿、合法单次 `locator` 读法误判红）。三条全修、各自
     双向变异验证、还原后按 sha256 字节全同。
   - **开口项（如实标注）**：r3 那条修法只做了变异验证、**未再跑第四轮复审**；
     r2 顺带发现同模块两处同族假绿（回复快照 `:9` 分开读数量与末条文本、按钮
     观察 `:188` 分开读命中数与禁用数，都是「同一事实两个视图分开采样」），
     非本契约引入、已挂账另立契约；三笔换签 `PENDING_STEVEN`。
   - 主会话裁决四条（`plan.md` §5）：M1 夹具走 hermetic 不碰被双 prd 冻结的
     `publish-sut`；M2/M3 两枚既有陈旧红挂账；M4 可见与 DOM 计数任一采不到就
     省键、正反两向一律落未知。
3. **实测新逮到的覆盖洞（D5 起草时）——已同日收口，本条留作溯源**：四态**分类**
   证据齐（`p2-verdict` 夹具四态全，我核过），当时四态**徽章渲染**只覆盖 `PASS`
   与 `SUT_DEFECT`——`p7-report` 夹具只有两步，`HARNESS_ERROR` 与 `NEEDS_HUMAN`
   在夹具里只作汇总计数且值为 0，全仓无金牌真渲染断言过这两态。
   **Steven 择甲（补齐），已落 `dev`**：`4f58671`（夹具补 `atstep_2` /
   `atstep_3` 两步，两态真被渲染）+ `4c4bca3`（金牌加钉徽章 CSS 类与四态色值，
   补上一轮漏网的两态）+ `5e99862`（两笔换签落签）。渲染器一行未改
   （`lib/report.mjs:17-19/64-68/102-103` 三处行号 07-31 复核仍准）。
   独立复核（隔离副本变异，判红判绿只信退出码）：基线 exit 0；八次变异全
   exit 1——两态徽章类各串成 `pass` / 两态态名各改坏 / `.badge.human` 涂成通过绿 /
   `badge()` 退化成恒定通过 / 夹具退回两步 / 夹具单删 `NEEDS_HUMAN` 步；还原后
   exit 0。`gate --prd loop/prd-p7-report.json` GREEN 2/2、`selftest --tier1`
   五项全绿。**残留（已挂账未修）**：每态只有一步，「同一态在不同步是否稳定同类」
   测不到，属另一笔换签面。
4. **tier-2 A4 是人闸不是机器闸**（我代不了）：清单唯一成员的前置要求人重新
   预置 `atl_同名对抗0722`（已在 07-23 见证收尾时清理归零）；两份带外收据
   `runs/_tier2/win-probe-target.result.json` 与
   `runs/_tier2/out-of-band-account-receipt.json` **都不存在**；另四例全卡
   C 轨授权。隧道本身健康（回环探针 HTTP 200、4.4 秒）。
5. **两份待签草案已备好**：`docs/plans/p9-uat-close/D5-ACCEPTANCE-SEMANTICS-REVISION.draft.md`
   （三处文本的具体改法逐字写好，含甲乙两案）与
   `docs/plans/p9-uat-close/P9-UAT-SIGNOFF.draft.md`（五行清单，三例已核实的
   逐步裁定与产物清单在案；publish 一行留空待四轮跑完）。
6. **接口交互诊断**：首版计划流产——codex 会话在发出终稿前断线，
   `plan-sol-max-r1.log` 里没有计划正文（那句「现提交计划书」是待办清单渲染），
   八百多万 input token 只吐了三万多 output。接手评审自己核代码产出了一份
   事实基线，已落盘 `docs/plans/api-interaction-diagnosis/REVIEW-opus-r1-fact-baseline.md`。
   **三条主会话裁定**：首刀=把已采到却没呈现的东西呈现出来（零新增采集、
   零 LLM、零真机）；**只做元数据级、绝不开正文面**（Steven 原话「抓包」与既有
   已冻安全面正面冲突——响应正文是刻意不落盘的，`seams-freeze` 与
   `layer3-wiring` 两枚金牌对产物做敏感词深扫命中即红，正文面须单独走安全裁决）；
   `SCOPE.md:39`「照 P6 自愈的合规范式接线」是**误设前提**——`lib/heal/` 里
   根本没有 LLM，真 L3 重锚已整个换成零 LLM 确定性重锚。首刀在独立工作树
   `casey-api-interaction-forensics-surfacing` 起契约，与 P9 零真机冲突。

## 2026-07-30 晚：闭环真因修复真机验证 + tier-2 收口（历史覆盖层）

1. **闭环点击恒败真因已修并在真机验证**（契约 `teachin-raw-actionability-closure`，
   commit `68f39b9`）。根因不是可操作性——是 `page-topology/controller.mjs` 的
   `performClick` 丢弃回调返回值且成功体无 `value` 键，而
   `raw-playwright-driver.mjs` 以 `performed.value === true` 判成败，于是
   click/dblclick 物理落地却恒判失败（`fill`/`press` 走 `evaluateActive` 有
   `value` 故好）。正式面 `replay-action.mjs` 早有闭包捕获先例，raw 面未沿用。
   **此洞长期不可见的原因**：两枚冻结金牌的拓扑替身虚构了真控制器从不返回的
   `value` 键（夹具不保真），且全仓无真控制器×canonical raw 驱动接合金牌。
   修法只动 `performRawCandidate` 一处（闭包捕获、双条件合取 fail-closed）；
   两枚夹具保真化换签 + 补真接合金牌。计划审 codex sol max 五轮 PLAN_APPROVE，
   gate GREEN 3/3。**真机实证**（`…_20260730_1930/` 边车）：seq1/seq2 两击
   `performOk` 由假转真（修前 false、修后 true）。
   代码联审 r1 逮到金牌一个洞（双条件未钉死：把判据变异成只看闭包值仍全绿），
   补钉中。
2. **tier-2 真机冒烟自检从桩到实装**（commit `9b2e9fb`，gate GREEN 3/3，
   金牌 77→111 钉）。codex 三轮联审逮到两个真假绿：工装错被当业务性非 PASS
   放行（exit 0 带绿尾行）、零步裁定产物冒充「合法非全过」。
3. **新阻断（下一层）**：`resolved-completion.result-shape` 拒付
   `SOURCE_SEMANTIC_COMPLETION_INVALID`——外层统一码吞掉了
   `projectAndVerify` 的六类内层具名拒付。窄契约 `cycle-evidence-inner-reason`
   已出计划（六码全集+触发条件+行号，工程量小），审中；落地后 Steven 再录
   一次即可定位。
4. **环境侧**：Windows 反向代理进程（连跑近两周）劣化，浏览器成批发请求时
   丢连接致前端 JS 代码块拿空响应、单页应用离不开登录页（登录接口本身一直
   200 成功）。Steven 授权后重启，登录探针 7 秒通过、零失败资源。
5. **邮件决策闭环 skill**（`.claude/skills/mail-loop/`）：发决策信/读回信执行/
   问进度如实汇报附额度/轮询节奏四流程；额度机读入口实证为 `claude -p "/usage"`
   （不能加 `--bare`）。术语已登记 `CONTEXT.md`。当日实跑一轮：发信→Steven
   回信裁定五条→回执→执行。铁律两条（每封必回、他不在电脑前时需要他做的事
   必须发邮件）是他当场纠的。

## 2026-07-29 晚至 07-30 晨：两契约连闭 + 闭环真因见光（历史覆盖层）

三件大事，全部真机/机器证据在案：

1. **`teachin-nav-expansion-recipe` 六阶段收口**：真机侧栏「组展开+条目」两击导航
   无配方致闭环必转人工——落带槽双击配方 + `matchesAt` 槽校验 + `boundIntents`
   防合并守卫 + 末槽语义绑定。计划四轮+代码三轮评审（codex+grok 联审）、
   金牌 N1-N10（sha fa01af9c）、gate GREEN、换签 Steven 签。真机计划层实证
   `teachin-plan` exit 0；闭环停下一层 `RUN_COMPLETION_INVALID`（当时黑箱）。
   沉淀 `docs/plans/teachin-nav-expansion-recipe/learn.md`。
2. **`teachin-cycle-evidence` 六阶段收口（开发期取证边车）**：`AsyncLocalStorage`
   观测上下文（`als.run` 词法边界+封存收集器）+ 21 员 `refusalPoint` 闭合枚举
   逐生产点 `safeEmit` + 四层凭据闸先闸后盘原子写 + 全量 digest 身份绑定。
   裁定路径零沾染（E5 双跑字节全等钉）。评审十五卷：计划 codex 七轮至
   PLAN_APPROVE、代码八轮至 REVIEW_APPROVE——静态钉六轮被合法语法反例连破
   （注释/字符串/别名正则/对象字面量/求值期启动/转义标识符/as 别名）后止损定
   终态六钉+诚实威胁模型（协作文件回归闸）；修复代理两次证据打滑被 codex 逮住、
   撤回补录真账。主金牌 75 钉（sha 9a138436）+ cycle-plan 静态钉换签
   （sha 31956edc，跨 prd 账 Steven 签）。gate GREEN、audit 落卷、learn 沉淀。
3. **真因见光（07-30 晨，A4 兑现）**：Steven 重录 wf_list 两击，边车落盘
   （`…tc_wf_list_smoke_cycle_20260730_0930/…/cycle-evidence.dc42acca….json`）：
   `raw-runner.event` seq 1 点击 **`candidateCount:1, performOk:false`**——元素
   唯一定位成功、点击执行失败（可操作性失败类）。机器侧 `bin/teachin-raw-replay.mjs`
   稳定复现同因，后继修复契约不需人录。另定案：同晨一次 `NAVIGATION_FAILED`
   是关浏览器窗口结束录制（断连浏览器进闭环）所致，非环境问题——结束录制务必
   点右下角蓝色「完成录制」按钮。
- B-2 三例裁剪到 sign-ready（三条 `!` 签字脚本等 Steven）；tier-2 契约文档+红金牌
  备好等主树槽；工作树全未提交、Steven 已裁分批提交+push（07-30 晨执行中）。

## 2026-07-29 下午：clear-fill 误拒修复六阶段收口（历史覆盖层）

契约 `teachin-clear-fill-admission`（full lane）grill→learn 六阶段全 done（Steven 两次
AskUserQuestion 确认：grill+plan 选项 1、amendment 换签批准）。修上午手录首链被
`FILL_VALUE_UNAVAILABLE` 误拒的工装缺口，根因比交接记录深一层——**两接缝**：
`lib/record-capture.mjs:90` 投影真值判断丢空串 `value` 键（注入侧其实恒落 value）、
`lib/teachin/raw-capture.mjs:127` 准入把空串当值丢失。修法各一行判据：投影仅原始
恰为空串（真清空）保键、准入判据收敛 `typeof !== 'string'`；缺键/非 string/纯空白/
敏感遮值四路仍 fail-closed（纯空白放行与非 string 强转两个 fail-open 变体分别被
codex 计划审 r1 High 与代码审 r1 M1 逮出并修）。

- 评审链：计划 codex sol xhigh 三轮至 PLAN_APPROVE；代码 codex+grok 联审
  （grok APPROVE 真跑金牌+对抗探针；codex 两 Medium 全修，delta 复审中）；
  原卷七份在 `docs/plans/teachin-clear-fill-admission/review/`。
- gate GREEN 3/3：新金牌 15 组（红先行 4 红→15 绿）、邻接 15 枚、s3 全量矩阵
  机制化（52 枚 sweep 四分片 + 全仓 prd 漂移扫 145/742 零漂移 + term-lint）。
  途中实证 gate 单条 acceptance 有 5 分钟看门狗（`commandTimeoutMs` 默认 300000），
  14 分钟全量 sweep 必被掐（两轮同点复现）——分片解决、没放宽看门狗。
- 换签账：金牌 13→15 组 + sweep 分片 + 漂移扫入冻结，`checksumAmendments` 含
  addendum，Steven 已批主体、addendum 随收口补签。原件 `.pre-r1-amendment.archive.gz`。
- **真机复录待 Steven 到机**（Steven 明示 review 完要实机跑）：跑单
  `runs/teachin-uat/RERECORD-RUNSHEET-20260729-clear-fill.md`（与上午差异就两条：
  可放心清空输入框、中文照旧剪贴板）。旧语料包不追认（键在录制落盘时已丢）。
- 环境侦察（opus 子代理，零系统改动，`docs/plans/teachin-clear-fill-admission/env-cjk-ime-report.md`）：
  ①标题栏乱码定性修正——WSLg weston 走 rdprail-shell 不画装饰、标题由 Windows 渲染，
  Linux 装字体无用，建议不追；②页面内中文已好（用户级 Noto CJK 生效）；③Wayland
  原生输入法被合成器 bind 拒（实测），唯一可行路=X11+fcitx5（需 Steven sudo，六问
  Q1-Q6 待裁）；④证伪旧结论「x11 截屏失败」（两形态截图均成功字节一致，旧口径待核）。
- 工装坑沉淀见 `docs/plans/teachin-clear-fill-admission/learn.md`（tmux 保姆误匹配
  常驻状态栏字样、`while read` 批跑被吃 stdin 金牌截断清单等）。
- 【同日下午追记】fcitx5 中文输入法已装好并**真机实测出中文**（Steven sudo 装包 +
  Claude 用户级配置）：关键=WSLg 下必须 `--disable=wayland,waylandim`（weston 拒输入法
  绑定连坐掐整条连接，否则启动即退）；X11 路 + GTK 模块 + D-Bus；浏览器须在 fcitx5
  已运行时启动；幂等起法 `~/start-ime.sh`、env 在 `~/.profile`；复录跑单已更新
  （中文可直打、别用 wayland 兜底旗标）。标题栏豆腐块确认不追（Windows 侧渲染）。
  详账 `env-cjk-ime-report.md` 落地结果附记。
- 本轮全部产物未 commit（并发现场纪律）。observation 家族 5 陈旧红 + 2 吊销墓碑为
  既有挂账，本轮实证其签名未被扰动（`review/baseline-pre-change.txt` + s3 sweep）。

## 2026-07-29 凌晨：真机复跑首链通 + P6 heal 计划收敛（历史覆盖层）

真机（Steven 半夜开闸「记得跑真机」，机器可跑部分全跑）：

1. `tc_agent_id_readback_real_uat_v1` **完整真机回放**——升级 origin 保真代理隧道后的第一条
   全链（登录引导→双定位→录屏→四态→全套产物）。裁定 PASS 1 / NEEDS_HUMAN 1：atstep_3
   点中 `atl_同名对抗0722`（定位唯一）后平台身份回读 `ok:false` → INDETERMINATE 交人；
   疑平台升级动了 ID 回读通道或同名对抗对变化；案卷（PDF+MP4）已发 Steven 待裁。
   产物在 `runs/tc_agent_id_readback_real_uat_v1/run_uat_readback_20260729_000650/`。
2. 迁移账（准入硬化拦旧签署件，全部浏览器启动前 fail-closed、零假绿，非缺陷）：
   catalog/publish/history 三例被 `DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF` 拦
   （各 7 处 deleteByName、v1 旧锁）；chiefcomplaint 被
   `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID` 拦（旧签署无锁文件）。四例重签清单待 Steven
   人在场批（07-22 重表达配方）。
3. 手录首链仍等 Steven 到机（跑单 `runs/teachin-uat/MORNING-RUNSHEET-20260729.md`）。

【2026-07-29 上午手录首链实证：新工装缺口】Steven 人到机器前重跑手录，键盘谜底坐实
（远程桌面所致；本机英文直敲可用、中文走剪贴板 `clip.exe` 注入；WSLg 标题栏中文乱码=
合成器字体栈缺 CJK，纯装饰面、不进取证）。录制成功落 24 事件，但闭环被
`FILL_VALUE_UNAVAILABLE` 拒——根因：**清空输入框**产生的 fill 事件无 `value` 键，
`lib/teachin/raw-capture.mjs:128` 的可回放性闸把它当「值丢失」拒掉，而清空是合法回放动作
（空串是有效目标值）。修法须动 lib/teachin 生产件与相关冻结金牌，另起契约；临时绕行=
录制时别把输入框删空（整段重选覆盖或一次性粘贴）。语料包留在
`runs/teachin-uat/tc_chiefcomplaint_smoke_20260729_091925/`。

【2026-07-29 上午更新】P6 heal 契约六阶段全 done：Steven 批 A4/A5 裁读 → A5 换签
（amendment 入 prd-p6-heal.json、原件存档 .pre-a5-amendment.archive.gz、新件实测绿）→
gate GREEN 6/6（s7 由 gate 翻绿）→ loop/review/learn 三阶段连推。hermetic 收口≠完成：
真机两不变量与 healed→PASS 实例仍 route:human。同晨手录首链已开跑（键盘谜底=远程桌面，
人在场英文直敲可用、中文走剪贴板）。

P6 heal（Steven 令「出计划然后按规则执行」）——**凌晨可完部分已全部收口**：五轮计划评审
（v1→v4.1 双家 PLAN_APPROVE）→ 八件金牌冻结（红先行）→ opus 三波实现 → 三轮代码修复-复审
（grok APPROVE + codex 逐轮逮新 High 至终验 APPROVE）。本段为 2026-07-28 夜间快照、只溯源：
当夜 gate 5/6（s7 待裁）、契约停 accept-done；07-29 晨已换签并推至六阶段全 done、gate 6/6，
现状以上方最新覆盖层为准。
S0 重大发现：P5 漂移探针热路径生产接线从未可达（证据 `hotpath-evidence.md`），heal v1
定性=机械全链完整、自然触发口未通、不虚标。全史与十项具名挂账见
`docs/plans/p6-heal/review.md`；权威评审账 `loop/audit.jsonl` 尾笔。产物：`lib/heal/` 八模块
+ `bin/heal.mjs`，生产库零改实证。完工邮件累计八封均实发。

## 2026-07-28 晚：真机 UAT 开闸首日 + tunnel-origin-proxy 收口（最新覆盖层）

Steven 当晚确认测试环境稳定，真机 UAT（B 项）开闸；sut-503 收口件裁决为**不单独提交**，等真机验收后与本轮统一整理。当前活契约 `tunnel-origin-proxy`（direct lane，UAT 现场解堵），评审已闭环、账在 `loop/audit.jsonl` 尾笔。

真机现场实证与解堵（按时序）：

1. `teachin-cycle` 薄别名前插 `--login-bootstrap` 吃掉 caseId（exit 64）→ 已修（尾插）+ 新金牌
   `tests/_golden/teachin-cycle-alias-args.static.golden.mjs`（红先行，spawn 真二进制，防回退反例）。
2. 新硬化执行目标策略下示教录制强制 origin 连续性，默认 direct 直连；WSL 直连探针实测不通
   （10 秒超时，2026-07-02 结论仍成立）→ 隧道脚本升级支持代理形态（origin-preserving-proxy），
   `site.json` 加 `target.transport.mode`（endpoint 回落 devProxyUrl，未新增地址字段）。
3. 联合评审（codex gpt-5.6-sol xhigh 真沙箱 + grok-4.5）：codex High=拒付非终态、Medium=分类
   fail-open，均修复；双家 delta 复审 FIXED/APPROVE；现场六探针全过（含终态与畸形拒付）。
4. 首链用例从 `tc_wf_history_version` 改为 `tc_chiefcomplaint_smoke`：自动示教闭环按设计只收
   **只读配方**（entity lock 字节级空集），带实体锁的四用例确定性转人工——不是故障是边界。
   已录的 52 事件 `tc_wf_history_version` 包留在 `runs/teachin-uat/` 作 intake→distill 语料。
5. 手录被键盘拦：远程控制下键盘/剪贴板进不了 WSLg 录制窗口（Win 剪贴板注入、X 工具、免密 sudo
   全不可用）。Steven 裁决**手录明天人在机器前再试**。两手预案已备：`bin/record.mjs` 新增
   `CASEY_RECORD_BROWSER_ARGS` 门控透传（未设零行为差），可换 `--ozone-platform=wayland`
   输入通路或开本机调试口辅助输入。
6. 构建指纹已留证：`runs/teachin-uat/*/sut-build-digest-derivation.md`（入口页整页字节 sha256，
   两次拉取一致；非官方发版标号）。

明早开跑路径：doctor 三关复核（账户关须 Steven 带外再确认当天有效）→ 直接重跑
`record.mjs tc_chiefcomplaint_smoke --login-bootstrap ...`（命令与素材见 runs/teachin-uat/ 与
任务账 #1）→ 键盘不行走透传口两手。评审证据全在 `loop/audit.jsonl` 尾笔与本层。

grok 驱动新坑已入库（memory：`-p` 单轮产物只算包内推理不算执行证据；tmux 保姆的弹窗措辞/静止
阈值/pgrep 误杀三坑）。今晚全部产物仍未 commit；hermetic+回环证据不构成正式 PASS。

深夜批次二（Steven 指示「跑非回放的内容」）：B.5 交付管线打通——新增 `scripts/report-to-pdf.mjs`
（playwright 打印）与 `scripts/video-to-mp4.mjs`（H.264+faststart；ffmpeg 走 FFMPEG_PATH，
本机静态件在 scratchpad ffmpeg-pkg）；2026-07-22 publish 真机 run 样品转制成功并已发 Steven 核
手机可读性。MCP 面裸探针：正式 14 工具精确、`teachin_plan/cycle` developmentOnly 零泄漏；
`mcp-config` 双 agent 输出路径正确。真挂载核验（claude 侧等额度、codex 侧等 Steven 在场）明天续。
新常设规矩：每批次完工发邮件通知 Steven（memory `notify-steven-by-mail-on-completion`，
agently 两阶段，首封已发）。

深夜批次四：① 子项③ 全新用例 `tc_wf_list_smoke`（工作流编排列表可达性冒烟，只读零实体）
hermetic 前半段全过闸：scaffold → CLI 外 LLM 归一 → ingest（2 步）→ flow-bridge 三闸 →
compile 闸段，停 G3 等 Steven confirm；素材在 `cases/tc_wf_list_smoke/`。途中 admission
镜像表正确拦下 `assert.noErrorToast`（不在 read 白名单，未知即 mutation，fail-closed 立功），
规范建模改走 `globalAssertions noPageError/absent`。② WSLg 浏览器后端冒烟：
`--ozone-platform=wayland` 起得来渲染正常、x11 截屏失败——明早键盘不行首选 Wayland。
③ 红金牌 5→3 差额闭案：即 driver-canonical-root 与 transaction-root 两枚（1e6c3c5 守卫化
未重冻、7-28 普查 Steven 批 amendment 补账、现绿），诊断文档已带证据链更新。④ 明早一页纸
跑单：`runs/teachin-uat/MORNING-RUNSHEET-20260729.md`。完工邮件共四封均实发。

深夜批次三：① codex 真挂载——`~/.codex/config.toml` 已追加 `[mcp_servers.casey]` 段（备份在
scratchpad），codex 会话内工具面可见性实证 14/14 与裸探针精确一致；真工具调用被 `codex exec`
非交互模式的 MCP 审批一律自动取消（harness 限制非挂载缺陷，`approval_policy=never` 也不放行），
真调收尾留交互会话。② 挂账第 6 项红金牌诊断落
`docs/plans/teachin-replayability-closure/red-goldens-diagnosis-20260728.md`：observation 家族
8 枚现全绿；successor 家族现红 3 枚（authority-bundle / readiness /
semantic-lock-runtime-discrimination），共同签名＝夹具倒在硬化后的准入门前（陈旧红），修复须
正向重表达夹具 + checksumAmendment + Steven 重签，留后继契约。

## 2026-07-28 teachin-replayability-closure 六阶段收口：评审链闭合（历史覆盖层）

主树 `dev@6f91125` 未提交现场。活契约 `teachin-replayability-closure`（lane=full）
六阶段全部 done（`loop/active-contract.json` 为准）：grill/plan/accept/loop/review/learn。
review 记账在 `loop/audit.jsonl`（kind=implementation-review，verdict=pass）与
`docs/plans/teachin-replayability-closure/review.md`（主记录）+ `review/` 目录七份原卷。

六轮评审链（每层评审家族异于实现家族）：

1. grok-4.5 主审 + deepseek-v4-pro 参考评 Claude 流水线层：双路 `CHANGES_REQUIRED`——
   两条 Critical 实锤「注入替身绿」（compare 生产调用缺 comparator exact 7 键中的 4 键、
   canonical 三接缝 reset/claim/preflight 仓内无生产实现）；
2. Claude 修复轮落真实现（新增 `lib/teachin/runtime-reset.mjs`、`prepared-runtime-seam.mjs`，
   十步探针实证 canonical 链走通）+ 修单 R7（金牌 mock 收紧七键、wiring 加 W6/W7 生产
   静态绑定钉、新增 cycle-plan 金牌）；grok R2 复审 `APPROVE`（13/13 FIXED）；
3. Claude 四路评 Codex 层七核对点：全 PASS 但 6 Medium 5 Low（capture 身份链、录制
   生命周期、formal 接线、fail-closed 面各路带零 SUT 探针）；
4. 闭合修复轮：M1-M5、L2、L3 修复（M3 用交接点归属回收保全冻结断言），M6 走修单 R10
   （inspector 补 caseId/expectedSha256 摘要、预检全量对齐绑定核），L1 挂账；
5. codex gpt-5.6-sol 终审：`CHANGES_REQUIRED` 唯一阻断=M4 完成等待枚举竞态（零活跃页
   或枚举间隙关闭时永久悬挂）；补两处立即重检闭合，探针场景从悬挂翻敲定；
6. codex delta 复审：`APPROVE`。

收口证据（只信退出码）：34 枚契约金牌全 exit 0；cli-mcp-face 12/12、
regress-wf-node-script 10/10、tier1 全绿；全仓 ratchet 143 PRD/732 条零漂移；
gate GREEN 六 story（passes 唯 gate 写）；修单账 R1-R10 十笔连续，每笔 Steven 批准。

挂账清单（不阻断，逐项具名）：comparator 的 promotionEligible 真值悬空旗标（两枚冻结
金牌钉死、无消费者、编排出口恒 promotionReady:false）；plan 产物与 CLEAN 裸词 stdout
缺自述标记；签名门前白烧一枚 fresh；prepared-run 对 preflight 具体 reason 折钝；
runtime-reset baseline 台账进程级卫生；teachin-observation 与 runtime-successor 家族
5 枚既有红（含两枚撤销守卫按设计红）；M3 以 reason 词表达归属回收的唯一性待后继冻结。

边界与冻结：hermetic 六阶段收口≠完成——真机 UAT（AI 中台完整示教双回放链、Windows
native direct、双定位三类真机、三份带录屏正式报告 + Steven 人签）全部 route:human，
等 Steven 确认测试环境稳定（当日 AI 中台升级中）；未 commit 未 push，提交整理按交接
纪律等真机链路与 Steven 验收（sut-503 收口件此前获批顺带提交，与该纪律的先后请 Steven
裁决）；发布 GitHub 同前提。

## 2026-07-28 Codex 在 Claude Code 无额度期间完成静态收口

本轮从 `dev@6f91125` 的 Claude 未提交 diff 接手。Steven 明确要求先 review、再修复，
并因 AI 中台当日下午升级而暂停所有真机。Codex 未运行真实 SUT、浏览器或网络，
未 commit、未 push；`origin` 已配置但发布仍须等真机链路和 Steven 验收。

活契约以 `loop/active-contract.json` 为准：

- `teachin-replayability-closure`，lane=`full`；
- `grill`、`plan`、`accept`、`loop` 已 done；
- `review`、`learn` 未完成，当前是 4/6（本段 2026-07-28 白天快照、只溯源、勿据其判现状：
  同日晚该契约已六阶段收口，见上方对应覆盖层）。

Codex review 后完成的生产收口：

1. 录制生命周期：`bin/record.mjs` 加显式“完成录制”、标签页/Context/Browser/timeout
   兜底；login-bootstrap 人工等待前预装 fresh witness；Context/bridge/page 任一早退都回收 Browser。
2. fresh/reset/authoring：fresh witness 精确绑定 Browser/Context；authoring baseline grant
   绑定 exact runtime 与 canonical baseline digest；fresh/seal/reset 失败路径补 cleanup。
3. 活动页与取证：runtime bootstrap、raw observation、formal prepared run 共用 attribution state
   与 pageErrors；runtime page 改成动态 active page；formal runner 真消费 signed expected、
   global assertions、topology 与 execution target authority。
4. entity authority：ID/名称 handle 传播到 pair/run/completion/prepared seams，formal preflight
   对 case/events exact 绑定。真实 publication root 仍未授权，entity-required 流保持 fail-closed；
   双定位只完成代码接线，未获真机证明。
5. raw/plan/cycle：`teachin-raw-replay` 接真实 anchor close→第二 runtime→fresh→canonical raw；
   新增 known-recipe read-only `teachin-plan`；模糊 intent、expected 错绑、pending、popup、
   mutation、runtime entity 均确定性转人工。
6. CLI/MCP：`teachin-plan` 与 `teachin-cycle` 同属 developmentOnly 内部 agent 工作流，
   显式排除正式 MCP 用户工具面；正式工具仍为 14 个。

最终静态集成另发现一条关键断点并已修：

- 旧公开流程先用第一次 capture 生成计划，再进行第二次人工录制；source-plan 又要求
  capture authority 与 source events exact hash 一致，因此两次录制理论上必然拒绝。
- 修复没有放宽 hash/authority 门。默认路径改为同一次录制落盘后只读一次 exact capture bytes，
  用它同步生成 cycle input；admission、source events、pairId 与 source/authoring/distilled
  三个 namespace 全绑定这份 bytes。
- 新增 `lib/teachin/cycle-input-loader.mjs` 解耦装配；旧 `--cycle-plan` 仅作
  mapping/expected 模板，events 与身份重绑当前 capture，映射不符仍由后续确定性门拒绝。
- R9 checksumAmendment 已记入 `loop/prd-teachin-replayability-closure.json`。

本轮静态/纯内存证据：

- 33/33 枚 `teachin-replayability*` golden exit 0；
- cycle-plan 6/6，review-hardening 9/9；
- Test Ratchet：143 份 PRD、608 个冻结文件、732 条引用、0 issue；
- `cli-mcp-face` 12/12，`regress-wf-node-script` 10/10；
- `casey selftest --tier1` 全绿；
- `git diff --check` 与本轮术语检查通过；
- 新增/重构生产与 golden 文件均严格少于 600 行；`docs/HANDOFF.md` 是既有活文档例外。

工作树不是干净基线：18 个 tracked 修改；`git status --short` 显示 58 个未跟踪路径，
展开约 150 个未跟踪文件。它们混有 Claude、Codex、用户与并行现场，全部保留；
禁止按作者猜 ownership、禁止 `git add -A`、禁止清理或覆盖。

剩余完成闸：

1. 先由 Claude Code 做异构 review，重点核同次 capture 身份链、owner 交接、失败 cleanup、
   expected/obligations、活动页与 entity fail-closed；通过后再落 learn。
2. Steven 明确环境稳定前仍禁止真机。稳定后在 AI 中台实跑
   “人工示教→原始 fresh 回放→atom 蒸馏→distilled fresh 回放→确定性等价”。
3. Windows native direct 验新标签页与登录连续性，禁止把直连用户目标改为 WSL-only loopback。
4. 再验 AI 中台 held-out build、医生站、Hi 小助，以及 ID/名称双定位。
5. 至少三份正式报告转 PDF、录像转 MP4，Steven 人签后才可发布 GitHub。

## 2026-07-27 sut-503-diagnosis 六阶段收口（历史覆盖层）

主树进入本轮时为 `dev@242312a`；未改生产实现、冻结断言或用户既有未提交现场。
活契约 `sut-503-diagnosis`（direct）已六阶段全 done；冻结验收
`verify-package.mjs` 37/37，仓内 `loop-kit` shim 驱质量门禁 GREEN 1/1。

三 subagent 按既定边界完成真机差分定位、缺陷包铸造和对抗性反证；只有真机差分一路接触真实
SUT。结论：

1. 2026-07-23 两个不同实例均出现
   `/ai-manager/agentPlus/queryPlus` 与
   `/ai-manager/agent/setup/getAgentDetail` 双 `503`；run-1 的确定性
   `SUT_DEFECT` 与 Steven 人签历史事实保持有效。run-2 的 `PASS` 只因两请求落在因果归因窗外，
   不表示当次 `503` 消失。
2. 2026-07-24 第三个不同实例的编译观察为双 `200`；2026-07-27 新建且列表唯一的实例首次打开
   同样双 `200`，页面失败提示为 0。截至 2026-07-27 当前环境不可复现。
3. 强假设“标准表单新建骨架智能体首次打开稳定双 `503`”已被当前双 `200` 证伪；最窄事实是
   “7 月 23 日两个实例在当时流程下真实复现”。候选根因收敛到短时服务事故、初始化时序，
   或未隔离的配置/构建差异，客户端无法唯一裁定。
4. 本轮 r1/r2 在确认创建前因诊断探针定位门中止，目标响应与详情打开均为 0，不计 SUT 样本。
   r3 exit 2 来自双 `200` 取证后的后置证据门，不倒写 HTTP 事实，也不产生新四态。
5. 本轮唯一测试件按精确名称从 1 清到 0；第二候选未创建、保持 0。编码面因卡片副标题假设错误
   未独立证明，诚实保留未决，不扩实验。

交付：

- `docs/plans/sut-503-diagnosis/defect-report.md`：可交研发的最小缺陷包；
- `docs/plans/sut-503-diagnosis/evidence/live-differential.md`：本轮真机差分与清理账；
- `docs/plans/sut-503-diagnosis/adversarial-analysis.md`：强假设反证；
- `docs/plans/sut-503-diagnosis/evidence/package-inventory.md`：历史与本轮证据摘要和哈希；
- `docs/plans/sut-503-diagnosis/learn.md`：收口复盘。

下一步不再扩大浏览器矩阵：先由研发按 7 月 23 日失败时点对服务日志、共同下游、创建事务/
详情子表初始化及 7 月 23→24 的部署或配置变化；只有日志指向初始化延迟或单一表单字段时，
再做一项有目标的复验。C1/C4 现状仍由下节覆盖层承接，C1 人签义务未因本诊断变化。

## 2026-07-24 C0/C2/C3 已落 dev；C1 组合候选完成真机负向回放与异构复审（历史覆盖层）

主树 `dev@cea3a9b`。C0/C2/C3 的跨契约 P3 C5 调和已由
`integration-entity-c0c2c3@94f6da9` 完成并合入主树；原 14/15 的唯一红已闭合。
本节以下较早的「C0/C2/C3 尚未落 dev」「C1 生产深消费未接」只作历史溯源。

C1 与 C3 的正确组合树为
`/tmp/casey-c1-c3-integration-v2`、分支 `integration-entity-c1-c3-v2@e55c2df`
（基于 `dev@cea3a9b`；`f20522c` 合 C1 全量，`134db6b` 合深消费候选，
`dfc2ecc` 闭合逐 `boundKind` 身份通道准入与 C3 组合门，`e55c2df` 脱敏真机账户证据）。旧
`/tmp/casey-c1-c3-integration` 不是正确基线，不得续用。

本轮实际完成：

1. C1 深消费候选已接通 `replay → axes → verdict → report-model`，不再是“只有纯函数、生产未接线”。
2. Grok `/code-review` R1 在完整组合工作树发现一条 High：旧编译准入只看“任意身份通道在场”，
   C2 多种类注册后，错误种类的通道可替正确种类洗绿。生产现逐原子读取
   `registry.boundKind` 并要求 `identityChannelsByKind` 中同种类良构通道；缺失、错种类、畸形均在
   浏览器启动前 exit 65。红证、修单与两枚增强金牌已入 `dfc2ecc`。
3. 安全组合影响面 26/26 通过；C1 owner gate 8/8 GREEN；组合调和 gate 1/1 GREEN；
   三份 PRD 的冻结件 sha256 全量对账通过。禁止运行的假 SUT 金牌
   `tests/_golden/p3-compile.golden.mjs` 未运行。
4. Grok TUI 在完整仓内复审 R2，终判 `APPROVE`，会话
   `019f9369-86d1-71b2-ac92-13e003dfe899`。项目 hook 拦了 Grok 内 shell，所以 Grok 只读源码与
   文档；sha256、26/26 与 gate 均是 Codex 独立实跑，未冒充 Grok 亲跑。评审归档见
   `docs/plans/entity-c1-c3-reconcile/review/`。

真实环境与 Playwright 事实（不是夹具）：

- Steven 已带外确认当前 `.auth` 为批准的测试账户；`casey doctor` exit 0，Node、Playwright、Chromium、
  中文字体、`site.json`、凭据形态与单实例回环隧道均就绪。
- Windows 网络栈与 WSL 回环隧道访问真实 SUT 均为 HTTP 200。
- 只读 smoke 用真实 Chromium 完成登录并进入智能体列表，目标控件可见，5190ms，exit 0。
- 完整 `casey run` 真实回放 `tc_agent_id_readback_real_uat_v1`，产出
  `axes.json`、`verdict.json`、三形态报告、`video.webm`、三张同次抽帧与
  `visual-review.json`。本地留存：
  `runs/tc_agent_id_readback_real_uat_v1/run_c1_candidate_live_20260724_r1/`。
- 确定性裁定：导航 PASS；`agent.searchOpen` 为 NEEDS_HUMAN/INDETERMINATE；
  身份轴 `v2/absent/complete`，动作 `action_failed/candidateCount:0`。视觉复核 CONSISTENT。
  这只证明目标缺席时不假 PASS、不误点；不背书 `v2 complete+unique → PASS` 正向完成。

C1 仍未完成、不得合入 `dev`：正式 `agent-id-regression-diff` baseline/schema 晋升、浏览器 C7
改判、新建 `atl_` 实体取得新 platformId 后的正向真实 UAT，以及 ADR-0004/0009 Steven 人签仍为
`route:human`；`oi1` 保持 open。另有既有能力边界：多种类身份通道表仍 fail-closed exit 65，
是待扩能力，不是本轮 fail-open。

C4 独立树 `/tmp/casey-c4-golden-closure` 已提交候选
`work/c4-golden-closure@a8b2581`：两枚候选金牌 4/4、原金牌 7/7，但 Grok 评审仍为
`CHANGES_REQUIRED`，baton 4/6；未改生产、未合主树、不得标完成。

主树未提交现场仍全部属于用户/并行工作：`.gitignore`、三个既有 PRD、zip、`follow.mjs` 与
三组文档目录；本轮未碰。组合树仅剩预存未跟踪 `node_modules`。

下一步：

1. 由 Steven 完成 C1 正式 baseline/schema、C7、新实体新 platformId 正向 Playwright UAT 与
   ADR-0004/0009 人签；随后再做干净异构复审，才可考虑合入 `dev`。
2. C4 按 `CHANGES_REQUIRED` 继续补生产事件环端到端保真证据并复审；仍与 C1 分树并行。
3. C1/C4 都只用 git 原生合并，不复制实现文件；合并后在主树复跑全部受影响面。

## 2026-07-24 entity-lastmile 五契约收口（历史层）

主树 dev@b1d5053（领先 origin/dev，push 待 Steven 令）。活契约槽仍 sut-503-diagnosis
（direct 0/6，未动手，见下节）——本 session 实际工作是「实体身份与双定位」五契约 C0–C4 在各自
worktree 的多轮落地 + 收口，与 503 baton 并行、尚未合并 dev。

诚实现状（先前「五契约全收敛」是过度声称；实测=三个干净收口、两个未过）：

- C0 `entity-identity-spine`（casey-entity-identity-lastmile）@78f9094 —— **已收口**（baton 6/6）。per-kind
  观察准入闭集注册表地基，codex R7 终判 PASS（27 组反例矩阵 + atom 边界 + 六元组唯一锚定成立），
  C1–C4 均 FF 此为基座。learn 三教训入档、audit 权威账记 R7 PASS。
- C2 `entity-workflow-source-readback` @32bf0c8 —— **已收口**（baton 6/6）。workflow source 读回，codex 四轮
  R4 终判 PASS（反向基数双向双射 + 锚定终端 click、关死「锚非终端 ok:true」）。gate 6/6。残留 route:human：
  角色契约调和（注册表要 source、生产准入策略 preflight 要 subject，改人签冻结件
  `entity-admission-policy.frozen.json` 须 Steven 再签；happy path 当前 fail-CLOSED 非 fail-open）。
- C3 `entity-destructive-continuity-guard` @9efc383 —— **已收口**（baton 6/6）。破坏性目标连续性守卫（最深），
  codex 六轮 R6 终判 PASS。编译期破坏 fail-open 两半（channel-less + 跨 kind 误铸 ref）均 fail-closed 关死
  （selectObservationForDestructiveTarget 加 boundKind 硬闸、kind 不符 OBSERVATION_SELECT_NO_MATCHING_KIND；
  p3-compile 重表达 checksumAmendment，非 ADR-0004 签冻件、无需再签）。replay 期缺 ref fail-CLOSED、按 ref
  唯一命中不取 first、abort 因果排除、v1 破坏也拒。gate 8/8。残留 route:human：ref 消费/出站 platformId
  核验半边（需真机 page.route）、真机破坏 UAT。
- C1 `entity-agent-identity-default` @af12837 —— **未收口**（baton 4/6，诚实）。codex round-2 re-review
  终判**不通过**：两 High 已闭（gradeEntityConclusion v2 完整性面 + registry 畸形面 fail-open 均修、
  grade-failclosed 金牌 9/9），但生产 `Critical`（oi1）**仍存续**——`bin/verdict.mjs`/`bin/replay.mjs` 未消费
  `gradeEntityConclusion`（grep 实证空），历史 v1 `agent.searchOpen` 经真 replay→verdict 仍产权威 PASS 的
  活 fail-open。深消费接线须翻 ADR-0004 已签棘轮 `agent-id-regression-diff`→route:human 再签，机器闭不了。
- C4 `entity-rename-negative-guard` @683d3c6 —— **未收口**（baton 4/6，诚实）。本 session 补跑 codex 评审，
  但收尾合成消息被 codex 侧内容过滤器连掐两次（误报 cybersecurity）、**无干净终判**。核心 fail-safe 成立
  （亲验：未知原子回放不产 PASS/不执行破坏，多层 fail-closed——非字符串被 preflight `REPLAY_EVENT_SHAPE_INVALID`
  前置拒、未知 string 被 C4 `UNKNOWN_ATOM` 闸拒、reject 轴→verdict NEEDS_HUMAN），但 codex 逆出两条属实的
  金牌保真缺口：① 非字符串靠未断言的上游 preflight（隐性耦合）② 「触 page 前拒」对生产过度声称（生产事件环
  `pre.path` 良性导航先于守卫、非 fail-open）。收口前置=补两端到端金牌 + 干净 codex 复审（记账见
  `docs/plans/entity-rename-negative-guard/review/codex-verdict.md`）。

本 session 收敛法（值得记）：round-1 五契约自跑 gate 全绿但 codex 暴露真仓评审逐个逆出假绿（fail-open/
死接线/seam-mock 假闭合）；后续逐轮翻真 fail-closed。教训沉 memory golden-pure-fn-false-green。异构评审
铁律 = 每轮改都送 codex 复审、已签面绝不伪造人签（机器再录 baseline + 备再签包 + 挂 route:human）。收口
纪律：codex 终判非 PASS（C1 不通过 / C4 掐断）绝不标 review done——诚实停 4/6，别把「机器可闭部分已闭」
说成契约完成。

本 session 已入 dev（独立于契约）：b1d5053 陈旧绿收口（护栏 #19，两枚 e1f5201 遗留：intent-event-fold
R17 + regress-wf-node-script C7 定位器刷新到 `lib/replay-axes.mjs`）。

运维坑：① 共享 `.git/objects` 有约 339 个 `{uuid}` 畸形垃圾对象（DrvFs/并发 agent 写产物，git 正常操作
忽略、`rev-list --objects --all` 可达链完好）；gc 被陈旧 gc.log 阻断。功能无碍，集成合并前值得清。
② loop-kit `contract.mjs` review 门用 `/pass/i` 子串匹配 audit verdict——`not-pass`/`bypass` 之类含 pass
子串会误过（本 session 实测踩到、已回滚）；改冻结 kit 须起契约、暂记账。

下一步接续顺序：
1. C1 收口：loop 相深消费接线（`replay.mjs` 发射 track/completeness 轴 + `verdict.mjs` 下游接
   gradeEntityConclusion 降级闸）+ 机器再录 `agent-id-regression-diff` proposed baseline + 备再签包 →
   route:human 交 Steven ADR-0004 再签 → 干净 codex 复审。
2. C4 收口：补两端到端金牌（preflight 非字符串封口 + 生产事件环覆盖/「零触碰」措辞订正）→ 干净 codex 复审。
3. 集成合并 dev —— C0/C2/C3 三契约合并【已建好、待调和一处后落地】：集成分支 `integration-entity-c0c2c3`
   @72d6540（从 dev 7065b31 起，依赖序 C0 863439a→C2 456749d→C3 72d6540）。机械合并干净：唯一冲突
   `bin/compile.mjs` import 块已 union 解（registry 三函数 + `admitCompileDestructiveContinuity` 并存）、
   `compile-atoms.mjs` 自动合、C2/C3 两门在 executeMode 都在、四核心文件语法 OK。护栏 #19 复跑受影响
   金牌：14/15 过（软链主树 node_modules 后跑）。【唯一未过·待调和】p3-compile C5：C3 重表达 p3-compile
   为过自身破坏结构准入声明了 workflows.listApi，这同一声明触发 C2 的 workflow.create source 读回双证门，
   hermetic 冒烟无真读回 envelope→C2 正确 fail-closed exit 65，但 C5 期望 exit 0。两契约各自都对，是 C3
   的 p3-compile 冻结金牌相对 C2 强制面陈旧。调和=改 C5 夹具供 source 读回 envelope 保 exit 0（或改判
   exit 65），属 checksumAmendment + 跨契约、宜再评审。Steven 2026-07-24 定：另开聚焦轮调和，dev 未动
   （仍 7065b31）、不落地带病合并。恢复：`git worktree add <路径> integration-entity-c0c2c3` + 软链
   node_modules + 调和 p3-compile C5 + 复跑 + 落 dev（合并前清 `.git` 畸形对象）。C1/C4 待各自收口后再并。
4. 全轮 route:human 残留另开真机轮：C1 深消费棘轮再签、C2 角色契约再签、C3 真机破坏 UAT、各契约真机
   name+ID 双定位 UAT（ADR-0009 完成闸）。

## 2026-07-23 sut-503-diagnosis 起（活契约槽，本 session 未推进——本 session 工作在顶节 entity-lastmile）

活契约 sut-503-diagnosis（direct，六阶段 0/6，`contract init` 未动手）——Steven 令开三 subagent
解决 real-uat 逮到的 503 缺陷。已建空工作目录 `runs/sut-503-diagnosis` 与
`docs/plans/sut-503-diagnosis`；GRILL/plan/取证/上报包/反证均未产出。

缺陷事实（取证已在 real-uat 契约留档）：测试账户经标准「新增智能体」表单建的骨架智能体，详情页
`agentPlus/queryPlus` 与 `agent/setup/getAgentDetail` 确定性 503、两实例均复现；取证件=
`runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/`（report 三形态+
视觉复核 INCONSISTENT，终帧两条「操作失败!」）；账见
`docs/plans/real-uat-attestation/evidence/uat-run.md`「503 缺陷账」节。

三 subagent 分工（新 session 执行）：①真机差分定位（复现+响应体/头脱敏取证+变量隔离矩阵找触发
条件，测试账户自建自删 `atl_` 件）；②上报包铸造（用①取证件铸自包含缺陷报告）；③对抗性反证
（穷举替代解释逐一证伪/证实防误报）。真机纪律铁律：只允许一个 subagent 碰真机——同账户并发
UI 会互踩；②③吃①产物、不并发连真站。真机前置=`casey doctor` 就绪+隧道回环单实例+`.auth`=
测试账户带外核。direct 车道跳 grill/plan 门，但产物仍须落契约计划目录+证据脱敏。

其余挂账：密钥签名威胁面 / SKILL.md 措辞统一（route:human，各 prd observability）；P8 多通道 /
P10 排期线。

## 2026-07-23 陈旧绿收口（护栏 #19，dev 维护提交，独立于 503 baton）

能力评估漂移扫逮到两枚 e1f5201 遗留的陈旧绿——投影抽离（提交 e1f5201「axes 投影抽生产纯函数」把
fold/回读接线从 bin/replay.mjs 整体搬进 lib/replay-axes.mjs）后，两枚金牌的结构定位器仍 grep 旧文件、
抽离后失配、金牌 exit 1；而 owner PRD 的 gate 证据戳早于抽离，passes:true 成陈旧绿（护栏 #19 迁移破邻接面）：

1. `tests/_golden/intent-event-fold.zero-sut.golden.mjs` 的 R17（replay 接线用 fold 输出）——定位从
   bin/replay.mjs 刷新到接线真实所在 lib/replay-axes.mjs（import + fold 赋值 + eventActions 逐 event
   证据保留三项现落此处），并加验生产入口 bin/replay.mjs 确有委托 projectReplayAxes 调用；金牌 17/17。
2. `tests/_golden/regress-wf-node-script.zero-sut.golden.mjs` 的 C7（回放接线取代表事件动作轴）——
   inputReadback 消费点定位改指 lib/replay-axes.mjs，并加验壳内构建（intentInputReadback.set）与交接
   （intentInputReadback 传入 projectReplayAxes）；金牌 10/10。

两处均纯定位刷新 + 收紧、零断言弱化；折叠/回读功能自 e1f5201 起从未断（agent-id-regression-diff R20
一直绿覆盖同一实现）。owner PRD 各记一笔 checksumAmendments，gate 双 GREEN（证据戳更新到抽离之后）。
改动 4 个显式路径：两金牌 + prd-intent-event-fold.json + prd-regress-wf-node-script.json。

顺带：全 zero-sut 漂移扫另发现两个 meta-golden 在干净基线就红（git stash 隔离证实、非本次引入，未擅动）——
hermetic-golden-isolation-pending（某隔离件路由/源摘要漂移）、hermetic-golden-prd-reverse-closure
（prd-stale-red-admission-refit 的 acceptance 引用隔离 live 件 p3-compile）；挂账待 Steven 定。

## 2026-07-23 凌晨（续）real-uat-attestation 六阶段全收口（已被顶部 503 节接续，仍为有效溯源）

Steven 两裁（人签采认+评审 codex）后走完：codex 四轮评审 R1/R2/R3 FAIL→逐轮全采信修复→R4 终判
PASS，契约六阶段全 done、audit 终账（rounds 4、pass）。关键修正与事实：

1. run-2 整链重跑（R1 阻塞：报告缺录屏/附件悬空；冻结件绑已删实例 platformId→审计归档旧件+
   重预置+重签的完整仪式）：回放①②各带录屏/run-history/run-metrics/逐帧视觉复核，附件共置三链
   版式；预置清理脚本 fail-closed 化（严判恰等+三面归零+日志冻结入库）。
2. 503 缺陷账被 codex R2 逮正后改写（此前对 Steven 的「实例相关/run-2 干净」口径是错的）：
   两条 503（agentPlus/queryPlus+getAgentDetail）在 run-1/run-2 两实例**均复现**；run-1 判
   SUT_DEFECT 与 run-2 判 PASS 之差纯为 503 到达时序落归因窗内/外（因果作用域取证按设计工作）。
   run-2 回放①视觉复核如实改判 INCONSISTENT（终帧两条「操作失败!」）。根因教训（引证未亲验+
   未扫全量网络账）入 learn.md+持久记忆。
3. 完整性金牌 V1-V6 实核化（checksum 核值/人签核件/真机产物深核/axes 网络账对刺/视觉复核全部
   交付面锁死）；gate 多轮 GREEN。
4. drafter-patch-intent-guard 亦已六阶段收口（同夜）：bin/draft.mjs --patch 存在性闸——错位
   intentId 不再静默孤儿断言（闸位置词表硬闸后零涟漪 output-seal、遮值报序号）；D10 红先行+遮值
   入冻+D11 正控；codex 两轮 R2 PASS（R1 三 Medium 全采信）；owner prd-draft-cli 两笔
   checksumAmendments；real-uat prd 工装缝挂账核销。受影响面 draft-cli/output-seal/
   caseid-echo-mask/p4-drafter/tier1 全绿。
5. 下一步（已被顶部 503 节接续、只溯源）：503 缺陷诊断已立 sut-503-diagnosis 契约在飞，见顶节；
   密钥签名威胁面/SKILL.md 措辞统一、P8 排期线仍挂账。

## 2026-07-23 凌晨 real-uat-attestation 真机四步见证跑通（已被顶部续节取代，只溯源）

Steven 三令（B 契约/剔除改革/修在案 bug）全部执行：

1. real-uat-attestation（light，4/6）：agent-id-readback 冻结 uatDefinition 四步真机见证完毕，
   GRILL 三分岔 Steven 全 A（我建我删/授权条件直签/即刻跑）。一件两放：①测试智能体
   `atl_同名对抗0722` 全场唯一时——双证 unique+回读 ok+句柄落笔+详情路由达（身份判据全过），
   两条**真实确定性 503**（`agentPlus/queryPlus`+`getAgentDetail`，骨架智能体详情页，跨两放复现）
   如实裁 SUT_DEFECT=真缺陷上报；②预置精确同名第二件（覆写平台自动码破同码拒绝）后回放同一
   冻结件——必 AMBIGUOUS 不点击（NEEDS_HUMAN·AMBIGUOUS_ACTION、URL 停列表页物理证据）。
   报告三形态×2、删两件归零。真机产物本机留存（cases/runs，不入库）；入库=见证账本
   `docs/plans/real-uat-attestation/evidence/uat-run.md`+完整性金牌（V1-V4 GREEN、gate 1/1）
   +tc prd（authority+frozen 双件 checksum）。待 Steven 两裁：UAT 终局人签（含 503 采认）
   +review 家族裁定后收 review/learn。
2. 修单中发现并挂账：drafter `--patch` intentId 不经 observed intents 存在性校验（错位断言静默
   孤儿——首版补缝 intent_open/intent_1 错位实证，重补缝+expected 单独重签修复）。
3. 陈旧红 `real-run-trust.zero-sut` 已修（8/8 PASS，98b8d1b）；loop 改革全线冻结令已入
   文档+持久记忆（d690619）。尖峰结论③「code 通道待真机回读」显式待办由本轮兑现
   （收据 code/platformId 用真机观察读回值）。

## 2026-07-22 深夜 agent-id-readback 评审闭环+合并 dev（已被顶部 07-23 节取代，只溯源）

接晚间交接（下节）继续收口，契约六阶段全 done、已合并 `dev@648e09e`（merge --no-ff，70 文件）。事实链：

1. 三波（sol 五面构造兑现）：`bin/replay.mjs` 浏览器后三轴投影【逐字搬移】成生产共用纯函数
   `lib/replay-axes.mjs`（82484ab..b920b4f 投影段零 hunks）；mock Page/forensics 测试替身
   （`tests/_golden/fixtures/agent-id-readback/mock-page.mjs`）驱【真实】createCompileRun/compileFlow
   与 performAction；棘轮扩面⑦⑧⑨⑩（R18-R21：compile-run-v1/action-axes-v1/axes-projection-v1/
   verdict-report-v1，末者=axes 喂真实 verdict→report-model（--generated-at 固定）→report 三 CLI 链、
   四态各一）。基线于 82484ab 窗口重录（九实现文件检出+身份模块移除），既有六面字节零漂移=窗口保真
   机器证据；退窗现树 21/21 绿=「身份实现不动 v1 字节」机器证据。红证 refit-r3（窗口 6/21 红）。
   plan §6/§8 权威修正+interface-spec §7 三波披露+prd 第五笔 checksumAmendments。gate 第五轮 GREEN 6/6。
   两笔明示排除（sol 认可口径）：report html/md 字节=报告模板演进面（与主树未提交 lib/report.mjs
   模板工作零冲突——其 diff 不触 renderJson）；report 成功 stdout=绝对路径打印面。
2. codex R3 FAIL 但机器五面判闭合（调用矩阵/排除/搬移全接受）；余三笔四波全采信修：H1 命中卡
   ElementHandle 全路径 try/finally dispose（compile/replay 双侧）；M1 `ctx.identityTokens` 消费即
   delete（出账延伸到调用方层）；H6 UAT 三件套落实际字段（prd observability：
   `uatCaseId=tc_agent_id_readback_real_uat_v1`+`successorContract=real-uat-attestation`+冻结
   `uatDefinition` 四步定义含时间戳边界）。gate 第六轮 GREEN 6/6 → codex R4 终判 PASS
   （H1/H6/M1 全 FIXED、plan §6 修正接受）。audit.jsonl 终账（rounds 4、pass）。
3. 合并 `dev@648e09e` 后主树复验：首跑 gate RED（5/6）——唯一红=棘轮 R21，根因是主树【未提交】的
   报告模板层给 renderJson 输出加了 `overview` 字段（开篇自然语言概述进了 JSON 面，不只 HTML/MD；
   我此前「模板 diff 不触 renderJson」判断是只 grep 未实测，错了）。对提交态复验（stash 该文件窗口）
   棘轮 21/21 绿 + gate 复跑 GREEN=合并本身无损，红只来自未提交覆盖层，恰证 R21 棘轮在做它该做的事。
   **承重交接**：三线增量落地（下一步 A）提交 `lib/report.mjs` 模板时，必须同笔对
   `prd-agent-id-readback` 走 checksumAmendments 重签 `verdict-report-v1.json`（+manifest），
   否则棘轮红。受影响面 zero-SUT 金牌批复跑全绿。**陈旧红挂账**：
   `tests/_golden/real-run-trust.zero-sut.golden.mjs` 红（源码字面检查在 82484ab 前已多行化失效；
   主树/分支同红、与本契约无关、无 owner prd 引用）——待独立修单，别顺手修。
4. worktree `../casey-agent-id-readback` 已退役（评审 PASS 合并后 worktree remove+分支删除，
   并行槽回 4/5）。真机义务按冻结 uatDefinition 走后继契约 `real-uat-attestation`（route:human）。
5. loop 改革全线冻结（Steven 2026-07-22 令）：工作流状态引擎/gate 分层一族（loop-p0-4a/4b）
   不读、不续、不列为选项；两树冻结原地、不计入待办；下方历史层中的改革叙述只作溯源。
   唯一解冻条件=Steven 明确要求。
6. 三线增量已提交入 dev（Steven「继续」授权后执行，五笔显式路径提交）：`b30fdf4` stale-red 收口
   （两金牌+两 owner prd+契约六件套）→ `002c821` 真机三链重签（三 tc prd 换签 checksum；冻结件本体在
   gitignore 的 `cases/`/`runs/`，按设计不入库）→ `cd8052d` 五 prd 复验 evidence 时间戳（gate 唯一写者、
   纯 evidence diff 实核）→ `31d5169` 报告模板+棘轮 R21 重签同笔（renderJson 新增 overview；第六笔
   checksumAmendments、基线双跑复验、gate GREEN 6/6，dev 无红窗口）→ 交接文档笔（本文件/NEXT-SESSION/
   REQUIREMENTS-STATUS/codex HANDOFF/entity-ui 尖峰清单+发现）。提交前复跑：p3-compile 14/14、
   report-diagnostics 12/12、tier1、棘轮 21/21 全 exit 0。主树剩余未提交=用户/并行现场
   （.gitignore、prd-cli-authority-wiring-fill/selftest/semantic-unit-discrimination、zip、follow.mjs、
   atom-readiness、regress-strategy、usability-audit），继续不碰。

## 2026-07-22 晚 agent-id-readback 修单会话——codex 两轮评审+两波修复，评审未闭合交接（已被顶部深夜节取代，只溯源）

全程在 worktree `../casey-agent-id-readback`（主树 `dev@82484ab` 零触碰），分支内快照提交 `b920b4f`
（57 文件，未合并）。事实链与残余：

1. codex 异构评审 R1 终判 `FAIL`（1 Critical+6 High+3 Medium，逐条对照代码坐实；`review/codex-review-r1.log`）。
   最重 C1：编译产物停在 v1、`platformId` 从未进签署/回放闭环——sign 的 v2 对账链对真实产物是死代码，
   此前 gate 6/6 绿是五金牌各自绿掩盖「链没接通」（教训入 learn.md #1：多段协议验收必含一条不许手造
   中间件的端到端链）。
2. 修单一波（十项全采信+修前红对抗钉）：请求级事务补有界 settle/先 seal 后 consume/查询回声；采集器
   同源+queryParam+2xx+successField（导出纯函数钉验）；双证门 dom.code 必备；物理卡片双锚+句柄内点击；
   编译 v2 草稿真接线+观察基数强校验；sign 义务集合从 events 字面量独立推导；回放账本只随 v2 权威激活、
   缺已签三元组立拒、信封先决优先于 DOM 分类。修金牌合法路径=零弱化+外科 stash 无实现态重钉红
   （refit-*.red.txt 五份）+prd `checksumAmendments`（四笔）。新夹具场景 iddom-skew/idpaged-dupdom/
   idtwins-sync（后者=C7 考场确定性化：回放 press→click 零等待使旧 DOM-only 门在 fetch 渲染页有固有
   竞态，gate 两轮 none 红实证——同步渲卡+信封两行同名，M3 失守必 ambiguous 一击红）。
3. R2 终判 `FAIL` 但大幅收敛：7 `FIXED`、3 `PARTIAL`（H1/H6/M1）、零新增独立问题；H6「修单侧缩窄」被拒
   （plan 是权威，改义务须正式修 plan）。二波修复已落：H1=evaluateHandle 原子快照取 ElementHandle、
   同物理节点重验+子句柄点击；M1=WeakSet+消费即出账（钉 O8c）；H6 部分=面③④落地（sign v1 三流+完整
   产物集+逐文件 sha 面——双跑探针实证跨运行字节确定、「不确定」假设实测收回，候选输出与 82484ab 基线
   逐字节相等成为「v1 路径逐字不变」的机器证据；compile/replay 无参三流面；过校验真路径负控 R15-R17）。
   gate 第四轮 GREEN 6/6。
4. 残余（Steven 拍板交接下一 session）：sol max 咨询判 `CHANGES REQUIRED`（`review/sol-consult-plan6.log`）——
   「动作轴/axes/report 字节面零 SUT 不可达」不成立，给出五面构造（mock 替身驱真实 `createCompileRun`/
   `compileFlow`/`performAction`+axes 投影抽生产纯函数+固定 `generatedAt` 报告装配）；实现后修 plan §6
   再发 codex R3。构造清单与评审状态快照：worktree `docs/plans/agent-id-readback/review/fix-dispositions-r1.md`
   末两节；R3 复审料草稿 `r3-packet-draft.md`；两波修复 hunks 已存档。audit.jsonl 已入账（in-progress、
   rounds 2）。评审 `PASS` 前不合并。
5. 教训沉淀 learn.md 十条（评审待闭合状态明标）：中心病灶「协议写全、接线接半」；判定序是安全属性；
   义务集合绝不由被验件自报驱动；poison spy 要真实加载证据；「不可达/不确定」先实测再落账（两次被
   异构评审逼收回）；竞态考场确定性化不靠重试。

> 本节已被顶部深夜节取代（评审已闭环、已合并）。下方「2026-07-22（续 82484ab 之后）当日四线推进」
> 为同日早前快照，只溯源、勿据其判现状。

## 2026-07-22（续 `82484ab` 之后）当日四线推进——三线主树未提交、一线 worktree 未合并

`82484ab`（entity-ui-wiring）合入后，本会话续推四线（均 Claude 实现→`codex`/`gpt-5.6-sol` 异构评审）：

1. `stale-red-admission-refit`（light，六阶段全 done，主树活契约）：收口两陈旧红金牌 `p3-compile`（4/14→14/14）、`report-diagnostics`（11/12→12/12）。红因是实体语义锁准入面拦夹具旧式调用（`git stash` 实证红先于当日改动、非回归），夹具侧铸测试受众准入件、生产 `lib`/`bin` 零改、走 `checksumAmendments` 修单重钉两 owner prd。`gpt-5.6-sol` max 咨询定形（E1 改只读白名单信封 / C8 收紧四证防准入拒绝冒充多匹配 / 临时 prd `wx`+`finally`）+ `codex` high 评审 4 Medium 全采信修复。**主树未提交**。
2. 报告固定模板（改 `lib/report.mjs`，未提交）：开篇自然语言概述（确定性投影四态裁定+步数、非全过 fail-safe 措辞不冒充通过）+ 回放对照同屏（录屏左 sticky·测试用例/原子操作右，窄屏退单列）。报告族金牌 + tier1 续绿。
3. 真机三链重表达全 `PASS`（`cases/` 刷新未提交）：旧冻结件被准入面拦属设计——完整重表达（扩 flow 实体绑定→铸预执行权威件→哨兵探针→真机重编译→草拟补缝对齐已签基线→人签→全新令牌回放）后 CRUD 4/4、发布 4/4、历史 8/8 `PASS` 零 error，删后归零双证有清理证据，三份独立 HTML 报告交付。配方存 `runs/real-uat-20260722/`。
4. `agent-id-readback`（full，worktree `../casey-agent-id-readback`，契约至 loop done、gate 6/6 GREEN，**未合并**）：智能体平台 ID 网络信封读回 + DOM/信封双证门。`gpt-5.6-sol` max 四轮设计共识（R1 三 P0=解析竞态/假唯一/剖面当安全开关，R4 可进 accept）；请求级身份观察事务（`arm`/归属请求时刻冻结/`settle` 终态/`seal`+`consume`）、完整性先决（`total===records.length`）、完整集合内同名>1 才 `AMBIGUOUS`、点击前对已签 `platformId` 比对（双定位闭合到点击那一刻）、观察↔确认哈希闭环（`sign` v2 `--entity-observations` 五元 join）。真机活数据双证实证绿（`docs/plans/agent-id-readback/evidence/realmachine-live-verify.md`），三层真机剖面字段名经实测纠正（`data.list`/`data.pageInfo.totalItems`）。待 `codex` 异构 review + learn + 合并 dev（见「下一步 A」）。需求进度已更 `docs/REQUIREMENTS-STATUS.md`（§3 实体身份）与 `docs/codex/HANDOFF.md`。

> 本节为 2026-07-22 早段快照（最新现状见顶部「2026-07-22 晚」节；本节第 4 条的「待 codex 异构
> review + learn + 合并」已被晚间会话推进两轮评审、现停 R2 FAIL 待 H6 五面构造）。下方各
> 「当前状态（2026-07-XX）」节为更早历史快照，只溯源、勿据其判现状。

## 2026-07-22 entity-ui-wiring 收口合入 dev（worktree 契约，merge `82484ab`）

语义锁 UI 接线第一波（Steven 需求「名称+ID 联合定位/双边锁定」的 hermetic 轨）落地：
`agent.searchOpen` 收紧（共享门 `lib/agent-search-gate.mjs`：`exact:true` 精确锚+容器归属闸，
编译门=回放门同刻；同名双条目 AMBIGUOUS 硬阻断；registry 补 `code` 编码收敛参数）+
`workflow.bindAgent` 关系原子全线接通（编译知识 25→26、registry 词条、回放专用门；抽屉钉扎
域锁+触发器/选项物理句柄+全时点三闸重判+物理句柄内可见恰一精确回读；双 receipt 锁链端到端
+单边缺失必红）。gate GREEN 4/4（主树复验同绿）+ tier1 绿；codex（gpt-5.6-sol high）四轮异构
评审 R1 FAIL(2H+3M)→R4 PASS 全闭环（audit.jsonl 有账，修复全带修前红对抗钉）；涟漪 9 prd
重签复 gate 零账变差（flow-bridge s2 陈旧绿被 gate 如实翻红=隔离义务账按设计恒非绿；
p5-replay 1/2→2/2、replay-settle-mount 0/2→1/2 翻好）；例翻三金牌 25→26；CONTEXT 补登
「容器归属闸」「关系原子」。接线红基线（真机轨，2026-07-18「单元导出+真机双轨」已裁）由
s4 守恒金牌钉死零触碰。worktree 已退役（并行槽 4/5）。

真机挂账（route:human）：`docs/plans/entity-ui-wiring/realmachine-spike-checklist.md`——
智能体平台 ID 三通道观察（列表行属性/URL/详情接口）+ 同名对抗 + bindAgent 真机配方四停站
复核 + searchOpen 容器类名采样；采齐后另立契约接 ID 读回。教训见
`docs/plans/entity-ui-wiring/learn.md`（execute 权威链金牌法/身份门全协议一步到位/冻结中修
金牌的合法路径等七条）。

另：同日早前本会话完成 casey×agent-loop-harness 交接包 TASK-000 本地重审计（15 条 claim
裁定、双仓二元绑定、产唯一 zip 已交 Steven；只审计零实现，详见包内 evidence）。

## 2026-07-21 starter 后刷新：task #17 已完成核账，停在 grill 人签裁决

本次只刷新交接文档、不改实现。实时事实：主树 `dev@1207776`；前序
`flow-bridge-golden-refit` 已 full 六阶段全 done，现役主树活契约是 `checksum-drift-closure`
（full，六阶段均 `done:false`），baton 占用中。starter 已完成 task #17 的只读核账并写出
`docs/plans/checksum-drift-closure/GRILL.md`；该目录是本契约进行中产物，不属于用户或并行现场。
除本契约产物与本次写入的 `docs/HANDOFF.md`、`docs/NEXT-SESSION.md` 外，现场另有非本次交接改动：
`.gitignore`、三份 PRD
（`prd-cli-authority-wiring-fill` / `prd-selftest` / `prd-semantic-unit-discrimination`）为修改态，另有
`casey-agent-loop-local-first-total.zip`、`docs/atom-readiness-assessment-20260715.md`、`docs/codex/`、
`docs/plans/regress-strategy/SCOPE-OPTIONS.md`、`docs/plans/usability-audit/`、`follow.mjs` 未跟踪；全部视为
用户或并行现场，不碰、不顺手提交。

核账已把 4 处 `testChecksums` 漂移分为两类：`prd-delete-confirm-causal-binding` 与
`prd-seams-freeze` 是真实漏签；`driver-canonical-root` 与 `transaction-root` 两金牌是同一提交写入的
有意安全撤销墓碑，不是并发污染。当前停点是请 Steven 裁决 `GRILL.md` 的 D1/D2/D3；签认前不
`advance grill`，不写 plan/prd，不改 checksum、`passes`、冻结金牌或 `loop-kit`。不得重复
`contract init`，也不得把「发现漂移」直接当成自动重签授权。

残留 worktree 分三类：`loop-p0-4a-state-engine` 为真实暂停 WIP（3/6，落后 dev 165 个提交），
`loop-p0-4b-gate-layering` 为真实暂停 WIP（2/6，落后 dev 163 个提交），两者都必须先重对当前基线，
不得沿用旧红基线直接续实现；`mountdelay-fidelity` 已 6/6 done 且并入 dev，只是完成后的残留树，
不是待续契约。下方所有更早日期段落均为历史快照；与本节冲突时只作溯源。

## 2026-07-20 活动增量：阶段二生命周期重裁 + mountdelay-fidelity 全收口并入 dev

阶段二 `hermetic-golden-zero-sut-lifecycle` 六阶段全 done（dev `95bb6bb`，ADR-0004 人签已落）：
全量清点 27 个会启动 fake-SUT/浏览器的金牌，按逐 check 义务拆出 zero-SUT 存活单元，其余浏览器
义务进入隔离账（239 obligations / 27 live executables，`agentExecution=forbidden`、route:human）。闭合机器
包含依赖扫描、source-obligations、subsumption matrix、retirement/isolation receipts、PRD 反向闭包与突变
电池；55/55 checksum 人签 GREEN。Pi DeepSeek V4 Pro 与 Grok 复审均 ACCEPT；Grok R1 的扫描器
High/Medium 已补正负控修复。旧 fake-SUT 金牌没有被重新运行或伪称已迁真机。

`mountdelay-fidelity` 六阶段全 done，merge `6f244fb` 入 dev：原计划依赖共享 fake-SUT 的部分按
生命周期契约删除，不改/不跑共享 fixture。`lib/replay-settle.mjs` 新增严格 `profile.loading`
selectors/text、DOM/占位同刻快照、所有模式至少三拍静止窗；配置态还须连续两拍证实占位消失，
probe unknown 保持 `settled:false`。`bin/replay.mjs` 在浏览器前校验 profile 并只把 profile（不把
expected）传给静默点。新 zero-SUT 验收 4/4、Grok R1 回归锁 2/2、既有存活单元 9/9、gate 4/4
GREEN；生命周期闭合保持 GREEN。

**异构评审链诚实收口**：Pi R1/R2 均 ACCEPT；Grok direct R1 两条有效 Medium 先造 0/2 红锁再修；
Grok R2 要求 placeholderGone 连续三拍的争议，经 Claude Code Opus 无工具时间线裁决为不成立——
`stableSamples>=3` 已保证配置态不弱于无配置，DOM 长度变化时自然重置为三拍 gone，长度不变时两拍
gone 是原授权语义。完整收据见 `docs/plans/mountdelay-fidelity/review/summary.md`。

本链剩余项全部是 route:human，不是 agent 可自行翻绿的实现尾巴：① 阶段一
`admission-trust-root-separation` 的人签/真机 execute UAT；② 阶段二隔离浏览器义务的真实 UAT 存证、
可信签名与迁移机制（已明确延期给后续 `real-uat-attestation` 类契约）；③ mountdelay 真机多次回放、
`profile.loading` selector/text 与时序标定；④ mountdelay 本次新增冻结验收的 ADR-0004 人签确认。
单次真机绿不得宣称 flaky 已消除。

主树既有未提交现场（`.gitignore`、三份无关 PRD、`docs/codex/` 等）均为用户/并行工作，合并时未触碰。

## 2026-07-20 活动增量：阶段一（生产/测试信任根分离 kernel 契约）六阶段 done + codex 六轮异构评审 PASS，待 route:human 人签

契约 `admission-trust-root-separation`（kernel/full）六阶段全 done（grill/plan/accept/loop/review/learn），dev 到 `dd09ae7`。给冻结身份准入件加签名进自哈希的必填 `audience` 字段（准入受众 test|production）+ 铸权后启动浏览器前的纯函数凭据上下文门（严格匹配受众与凭据上下文：真凭据 run↔production、无凭据 run↔test，不符 fail-closed 不启动浏览器），机制阻断「测试锁被误指向真 SUT 授权真实改动」。设计=ADR-0010 + `docs/plans/admission-trust-root-separation/`（GRILL/plan/learn）。明确不覆盖（ADR-0010 划界，后续契约）：密钥签名/signerId 认证、不可变发布 manifest 根、receipt 读路复验、撤销、锁绑 SUT/环境 scope——本契约诚实划界为「防误用/泄漏」有界威胁。

codex gpt-5.6-sol high 六轮异构评审 PASS（`docs/plans/admission-trust-root-separation/review/`，入 audit）——kernel 强制层异构评审真挣钱的极强实证。逐轮逼出我 Claude 家族自审看漏的洞 + 我三次自造的假绿/弱证：① 生产门零削弱不成立(锁不绑 --sut) ② SKILL.md:107 冲突 ③ 我用错 grep 标记误报绿+提假绿(已沉淀记忆「判金牌只信退出码」) ④ sign 写路径未迁移 ⑤ compile 假凭据判据 ⑥ W2 没真测门 ⑦ C5b 错误原因假绿 ⑧「无产物≠没启动」⑨ W1b 不证 compile 哨兵。全消解，Medium-4 六轮闭合（浏览器启动哨兵机械化 + 双正控 W1b replay/W3b compile）。

待 route:human（kernel 纪律，交 Steven）：① 冻结夹具/金牌改动的 ADR-0004 人签（3 preflight 夹具重签 audience:test + sidecar golden/schema + 3 敌意夹具 + 新增验收金牌与夹具）；② compile --execute 真机 execute 授权路径端到端 UAT 抽验（audience-mismatch 分支，W3 已覆盖其 hermetic 可执行回归证据）。

与阶段二关系：本契约独立加固、非阶段二前置（Q1 决策）——阶段二 hermetic 金牌生命周期重裁主力走 zero-SUT、不碰准入门；见 `docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md`。下一步：阶段二（金牌生命周期重裁）或 mountdelay-fidelity 续（视基础债方向落地）。主树活契约槽收口后归还 alh-open-entry。

## 2026-07-19 晚活动增量：基础债规模远超预估 + codex 讨论推翻锁绿路径 → 转两阶段方向（信任根分离 → 金牌生命周期重裁）

权威后续方向 = `docs/plans/replay-admission-hermetic-migration/DIRECTION-AFTER-CODEX.md`。本会话把基础债从「5 金牌」推进到坐实真实规模并**转向**：

1. 规模真相：enforcement `9ee2731`→`dfee72c`（2026-07-17）落地未迁移测试套件，把整个 hermetic 浏览器回放金牌套件（约 24 金牌 / 40 prd）打成陈旧绿，非最初发现的 5 个。债务全貌钉死在 `DEBT-REGISTER.md`（18 复签即真绿集 + 12 翻红集 + 7 额外红金牌 sweep 范围）。
2. codex gpt-5.6-sol high 异构讨论真挣钱（Steven 指示做，`review/codex-sol-strategy-20260719.md`，入 audit）：逮到 Claude 家族自审看漏的四承重问题——① 路 a「生产门零削弱」不成立（测试锁绑 events 不绑 `--sut`、生产 reader 不分测试/生产 signer = 利用既有 trust-root 缺口）；② `SKILL.md:107` 冲突；③ p5 墓碑不该借删两案翻绿；④ mint 工具语义授权不可信。
3. Steven 2026-07-19 两裁决（AskUserQuestion）：Q1 = SKILL.md:107 fake-SUT 只读规则也约束 dev gate/golden（hermetic 金牌不该被 agent 跑、须按生命周期重裁，非重跑锁绿）；Q2 = 先修生产/测试信任根分离再迁移（codex 荐）。→ 原执行路径（重跑 fake-sut + 注入测试锁锁绿）**作废**。
4. 正确方向两阶段（各另立契约、均须 Steven 参与，见 DIRECTION-AFTER-CODEX.md）：阶段一 生产/测试信任根分离（kernel 车道：生产 reader 只读不可变发布 manifest、artifact 带不可伪造 audience 分根签、拒测试 signer、绑环境/SUT scope、验 receipt、反向验收测试锁必被生产 reader 拒）；阶段二 hermetic 金牌套件逐个生命周期重裁（(a) 转 zero-SUT 确定性喂冻结 axes/纯裁判=主力出路 / (b) 真机 UAT-only 墓碑 fake-sut / (c) 教义作废墓碑+命名后继，如 p5 drift/vanished：原 story superseded-not-pass + successor PRD + 自愈 liveness 另立）。
5. 本契约收口姿态：`replay-admission-hermetic-migration` 转调查/决策契约（prd stories 空、方向记 observability）。已做：波0 五核心 prd honest 翻红（保留权威——按 Q1 不得再跑 gate 启动 fake-sut，passes:false 不可撤了重生）；波1 settle 锁绿已 `git revert`（含 mint 工具，codex 判语义授权不可信）；复签 sweep 工具 `tests/_golden/support/resign-changed-goldens.mjs` 保留（生命周期工作仍用）。约 35 个非核心 prd 仍陈旧绿（未翻红）待阶段二清偿（DEBT-REGISTER C 组）。dev HEAD 5df2c17。
6. mountdelay-fidelity 仍挂起（worktree 存、grill+plan done）：原被基础债阻塞，现基础债转为两阶段大工程、mountdelay 继续排后待方向落地。
7. 主树未提交现场：`.gitignore` + 一批 prd（M，gate evidence 时间戳漂移）+ 用户未跟踪件（docs/codex/、follow.mjs 等）——别碰别提交。主树活契约槽已归还 alh-open-entry（外部仓 agent-loop-harness 接入，Steven 上下文，与本线无关；本会话曾临时占槽跑 replay-admission-hermetic-migration，收口后已恢复原槽）。replay-admission-hermetic-migration 契约转调查/决策姿态、不走 loop/review/learn 正常流，其完整状态在 `docs/plans/replay-admission-hermetic-migration/`（DIRECTION-AFTER-CODEX/DEBT-REGISTER/prd）与本节，不依赖契约槽。阶段一另立新 slug。

以下为本会话早段快照（其「路 a 锁绿」执行序已被本节转向推翻），只溯源、勿据其判现状：

## 2026-07-19 活动增量：发现基础债——一批浏览器回放金牌 runtime-RED + prd 陈旧绿（semantic-lock 准入门 enforcement 落地未复跑），mountdelay 挂起排后

基础阻塞（亲核坐实）：2026-07-17 提交 `9ee2731`「feat: enforce semantic lock admission gates」→`dfee72c` 落地 semantic-lock 准入门 enforcement——含 mutation atom 的 events 现要求签名冻结锁（`--entity-locks` + 注册 prd checksum，`lib/entity-semantic-lock-preflight.mjs:checkReplayEntityAdmission`，`bin/replay.mjs:238-247`）。合成 caseId 的 hermetic 浏览器回放金牌满足不了 → 一批金牌全 runtime-RED（`FROZEN_ENTITY_LOCKS`）：`p5-replay`/`wf-publish-states`/`replay-settle-mount`/`drawer-lock-hardening`/`replay-nth-visible-hardening`。enforcement 落地时未复跑这些金牌，其 prd 全带陈旧 `passes:true`；`tier1` GREEN 掩盖（不跑浏览器回放金牌）。亲核：`replay-settle-mount.golden.mjs` 主树 9 过/7 红（7 红全 FROZEN_ENTITY_LOCKS），prd evidence 停在 gate@2026-07-14。本会话第三次逮同模式（enforcement/迁移落地未复跑受影响金牌→陈旧绿；前两次 record-intake、supersession）。

Steven 2026-07-19 可点选项决策：先修基础债（另立契约）+ mountdelay 排后。方案已侦察定清并落盘 `docs/plans/replay-admission-hermetic-migration/PROPOSAL.md`（供直接接手）：采路 (a) 测试签名锁注入 + 金牌迁移，不触准入门 kernel——准入读路无 Ed25519/无收据验证/无真 SUT 依赖，只认 结构+内容自哈希+prd checksum，故 hermetic 测试锁可确定性铸造 + 经生产接口合法注册、不削弱生产门（否决路 b hermetic seam：触 kernel、fail-open 缝、违护栏 #14）。分层：简单案（p5-replay/replay-settle-mount/wf-publish-states 静态 events 直接铸锁）+ 摩擦案（drawer-lock/nth-visible compile-driven 非确定性 + 双门，须冻编译产物或拆轨）+ 独立门（p5 drift/vanished 的 deleteByName 死在另一道 binding 门）。陈旧绿先翻红记账再修绿（不手改/不随迁移补绿）。full 车道、非 kernel、不必 worktree。

mountdelay-fidelity 契约挂起（worktree `casey-mountdelay-fidelity`，grill+plan done）：核心设计已亲定并落 `docs/plans/mountdelay-fidelity/plan.md`（settle 加占位门+静止窗兜底、fake-sut 补延迟提交子形态、hermetic/真机边界）。因基础阻塞（原设计驱 `bin/replay.mjs` 红先行的红会是准入门失败而非预期 buttonState 假阴）挂起，基础修好后可直接续实现。

次要发现（纠正 plan/侦察冻结清单不准，实现代理核实）：`lib/replay-settle.mjs` 冻在 0 个 prd（非 1，强化它不用重签）；`server.mjs` 冻 4 个（drawer-lock/p5-replay/replay-nth/replay-settle-mount，非 5——`prd-resolution` 只冻 `resolution.golden.mjs`）；`CONTRACT.md` 冻 3 个（+drawer-lock，非 2）；mountdelay plan B 兜底 `STILL_TICKS=4`（≈480ms）会让 `replay-settle-mount.golden` U3（floorMs 0→waitedMs<300）转红，兜底静止窗须改 opt-driven（裸调用保持 2 拍）。

## 2026-07-18 夜活动增量：obs-cases-isolation 契约收口并入 dev，三金牌主树 DrvFs 稳定绿 + W2 环境敏感挂账连带清偿

`obs-cases-isolation`（full，merge 于 dev）：修三 observation 金牌主树 WSL DrvFs 必红。诊断三层纠偏（初判「扫真实 cases 数据」→「同名残留撞守卫」→ 最终只 supersession 一个真故障，cli-authority/unsafe 被残留连累）；方案两次修正（Steven 批的 rename→copy+自回收被侦察探针推翻——copy 铸新 inode 破坏 T2 身份语义、自回收触双冻结安全 primitive 高风险且不必要）。最终修：supersession `spawnSync` timeout 30s→180s（确定性 ETIMEDOUT 根因，SAFE_V2 9p 跑约47s）+ SAFE_V2 T2 rename/mkdir/rmdir 包有界 retry（新增 `retry-transient-fs.mjs` 吸收 9p 偶发 sharing-violation EACCES，retry 内每次重验身份）。codex 异构评审三轮闭环——逮 High（原属 prd 重签延后）+ Medium（T2 retry 的 check-then-act TOCTOU 窗口，逐个破坏性分支 L302/L304/L286 收干净）→ 全 RESOLVED PASS。不触 kernel lib/bin、不触安全 primitive `canonical-case-lease.mjs`、不改 caseId/active-suite 11/6 契约。原属两 prd（safe-case-lease-v2、observation-runtime-trust-root）同步重签。

主树复验：三金牌全绿（cli-authority 8/8、unsafe 3/3、supersession 从必红 ETIMEDOUT 转 3/3）、零残留；ratchet 4 存量债零新增、tier1 GREEN。**连带清偿**：W2 `prd-cli-authority-wiring-fill` 之前诊断为环境敏感挂账的主树 gate 3/4，obs 修复后主树 gate 复验 GREEN 4/4（其 observability 第 4 条环境敏感诊断条目为历史记录，问题已由本契约根治）。

## 2026-07-18 傍晚活动增量：两契约 codex 评审闭环并入 dev（单元轨 + W2 接线，各真挣钱一 finding）

session limit 恢复后续完两契约，均 codex 异构评审闭环并合并 dev：

1. 单元轨 `semantic-unit-discrimination` 已并 dev（merge `56ff17f` + cert 重签 `dade165`）：判别纯函数剥壳导出面 `compareCandidateFacts`，单元金牌 38/38 hermetic 证判别基元。codex 三轮：逮 High-1 硬门旁路（导出 `allowAction`）→ 剥离重修 → 复审 High-1/Med-1/Med-2 全 RESOLVED PASS。合并点原子重签 cert-closure 冻的 lib sha `4b370340→b7b5a47e`（消解 codex High-2 账实不符）。
2. W2 接线 `cli-authority-wiring-fill` 已并 dev（merge 于 `dade165` 之后）：intake 补三件套接线 + 两旧金牌对齐 trust-root + record-intake 陈旧绿翻真。codex 两轮：逮 intake TOCTOU High（一致性检查在 append 后、换包时脏包已 committed = 失败留脏账）→ 一致性前置进 authority 原子事务修复（落账前 no-follow 重验、不一致落账前拒、committed ledger 零新增）→ 复审 RESOLVED PASS。并发换包红先行金牌 3/3。
3. 合并后主树复验诊断（承重，防误判）：W2 gate 主树显 3/4 RED，已决定性诊断为非 W2 回归——s3 的三个 observation 金牌（cli-authority-wiring/unsafe-golden-revocation/active-suite-supersession）环境敏感，扫主树 12 个用户真机 `cases/` 目录时红；换回 W2 前 lib（dade165）跑主树同样全红，红纯是 `cases/` 真实数据、与 authority-root 改动无关。契约树 hermetic 干净 `cases/` 下 gate GREEN 4/4 是有效零回归证明。三金牌 `cases/` 隔离改造挂账另立契约。
4. 两 WIP 抢救提交已转正：`ffb4433`/`cf9cbc2`（session limit 中断时从 stash 恢复的现场）经主会话验证后各以 `fbca49c`/`3049b52` 转正、随契约合并入 dev。
5. 异构评审本 session 实证四次真挣钱：cert pi PASS + 单元轨 codex 逮 allowAction 旁路 + W2 codex 逮 TOCTOU + 合并后主树诊断纠偏——坐实「评审家族≠实现家族」+「hermetic 绿≠主树绿，合并后必主树复验」。audit.jsonl 五笔评审入账（两 changes_required→修复→pass 的完整轨迹）。
6. **下一步**：① 前瞻红基线 `runtime-discrimination-successor`（0/26）真机轨填绿仍待真机运行时权威（route:human）；② 三 observation 金牌 `cases/` 隔离改造；③ mountdelay 保真契约（7/15 头号）；④ 两 WIP 特性（跨平台安装/账户配置）验收后合并；⑤ worktree 卫生（两契约树可清）。

## 2026-07-18 下午活动增量：判别双轨 + W2 接线两契约进行中（session limit 中断，两 WIP 现场已抢救提交，待续接）

三条线全部未合并 dev（dev 停 `f9de8b8`），两个契约现场因 session limit（Perth 3pm 重置）中断、已抢救提交为明确「不可合并」WIP：

1. `semantic-unit-discrimination`（light，worktree `casey-semantic-unit-discrimination`）：兑现 Steven「单元导出+真机双轨」裁决的 hermetic 轨——给 `lib/entity-semantic-lock-v2.mjs` 判别纯函数加只读导出面做单元级攻击金牌。codex 异构评审逮到 High-1（导出 `compareCandidate` 返回 `allowAction:true` = 硬门旁路），Steven 裁「剥离 allowAction 重修」→ 重修 `e481d85`（导出面换剥壳 `compareCandidateFacts`，只出 `status/reason/candidateCount`）→ codex 聚焦复审判 High-1 已消解（RESOLVED），但 Med-1（反滥用静态扫描可被 `.join` 拼接绕）/Med-2（`bindingMode`·`provenance.kind` 未证被 canonical hash 覆盖，可能藏真 fail-open 洞）判 PARTIAL。Med 收尾代理挂在验零回归前，金牌现场抢救提交 `ffb4433`（WIP，未验证）。lib 当前 sha `b7b5a47e`（初版 `4b370340`→`40fd8eb0`→`b7b5a47e`）。
   - **续接**：确认 Med-2 取证结论（若 `canonicalReceipt` 真没覆盖 `bindingMode`/`provenance.kind` 则是真 fail-open 洞、停手上报改内核另立契约；否则补隔离断言）→ 邻接十金牌零回归 → gate → 纪律②重签 prd 金牌 checksum → codex 复审两 PARTIAL 消解。
2. `cli-authority-wiring-fill`（full，worktree `casey-cli-authority-wiring-fill`）：W2 接线，对齐现役 trust-root 模型（Steven 裁）——`bin/intake.mjs` 补三件套接线 + 两旧金牌对齐重写 + `record-intake` 陈旧绿翻真（`05573d1`，已核账三 gate GREEN）。codex 异构评审逮到 High（intake TOCTOU：`append` 后才比对、换包时报 exit65 但脏包已 committed = 失败留脏账，违 fail-safe「失败必须干净」）。修复代理触权威内核 `lib/teachin-observation-authority-root.mjs`（append 原子性）+ `bin/intake.mjs`（一致性前置）+ 并发换包红先行金牌，挂在 `git stash pop` timeout、现场从 stash 恢复后抢救提交 `cf9cbc2`（WIP，未验证，自报零回归但未跑完 gate）。
   - **续接**：验并发换包金牌 exit0（不一致→denied+accepted ledger 零新增）+ 邻接零回归（observation 全套+tier1）+ gate → 报权威内核 lib 新 sha（跨契约共享冻结）→ codex 复审。
3. 合并点统一动作（两契约各自 codex 复审 PASS 后）：顺序合并回 dev，**原子重签跨契约共享冻结**——`lib/entity-semantic-lock-v2.mjs`（cert-closure prd 冻旧 `4b370340`，须重签到最终 sha，codex High-2 NOT-RESOLVED 即此，合并点消解）+ `lib/teachin-observation-authority-root.mjs`（被哪些 prd 冻结待 grep 清单）；各带 3-way + 全仓 ratchet + tier1。
4. 异构评审本 session 实证三次真挣钱：cert 收口 pi PASS + 单元轨 codex 逮 allowAction 旁路 + W2 codex 逮 TOCTOU——后两个都是 Claude 家族自实现+自审未抓、跨 codex 一眼看穿，坐实「评审家族≠实现家族」铁律。audit.jsonl 三笔已入账（含两 changes_required 诚实留痕）。

## 2026-07-18 凌晨活动增量：codex 语义锁线核账 + Claude 接管认证漂移收口（已收口并入 dev，merge `bf39d7e`）

1. **三路核账**：codex 自报（7/16 17:03 止）全部属实；其后 codex 又推进约 60 提交至 `observation-contract-closure @ e0ffe16`（语义锁 v2/旁车/wiring 合流，未并 dev）。Claude 攻击式异构评审 PASS（已接线路径无 Critical/High/Medium），档案 `docs/plans/closed-loop-evolution/review-claude-20260717.md`。5 个 P0 防御代码闭合，但认证账漂移：两个 prd `passes:true` 与实跑 gate RED 不符、判别攻击金牌全线红。
2. **现场处置**：Steven 拍板停 codex、Claude 接管；两处 `/tmp` 未提交特性抢救提交（`902216e` 跨平台安装 / `02f4361` 账户配置）。九个 `/tmp` worktree 重启会丢目录（提交已安全），待 `git worktree prune` 收口。
3. W1 契约 `semantic-lock-cert-closure`（light）已到 review 门前：worktree `/mnt/d/ctx/heren/casey-semantic-lock-cert-closure`，提交 `9803f73`。分面重证（可达面三金牌全绿：v2 2/2、capability 2/2、runtime-authority 9/9）+ 前瞻红基线 `runtime-discrimination-successor`（0/26 诚实红，收纳被 `819015f` 不可执行姿态挡住的全部运行时判别攻击）+ 三僵死金牌墓碑吊销（收据 `supersession-revocation.json`）+ 五 prd 纪律②重签。gate/ratchet（7 问题全存量零新增）/tier1 全背书；lib 零触碰有 checksum 机制证明。契约 grill/plan/accept/loop 四阶段 done。
4. **已完成收口（2026-07-18 凌晨续）**：契约六阶段全 done——异构评审改走 pi（Steven 指定：codex 无额度、Grok 包已备未用）：`pi.dev deepseek-v4-pro thinking high --no-tools` 冒烟验通后一次 PASS（七检查域实审，7/16 两次超时挂账清偿），入账 `loop/audit.jsonl`（主树+契约树双份）。merge `bf39d7e` 并入 dev（ort 零冲突；排除两 WIP 特性分支）；主树复验：ratchet 4 存量债零新增（report-model 与 workflow-delete 两处遗产期漂移 + 两安全墓碑永久信号）、tier1 GREEN、cert gate 主树重打 GREEN 2/2。评审包与 pi verdict 存 `D:\ctx\heren\review-packets\`。
5. **待办（顺序，2026-07-18 凌晨续更）**：① 判别分岔**已裁**（Steven 可点选项）：「单元导出+真机双轨」——判别纯函数只读导出做单元级攻击金牌（契约 `semantic-unit-discrimination` 已开工），接线路径 0/26 保持红等真机权威，「可验证接缝」否决；② W2 接线契约 `cli-authority-wiring-fill` 已开工（填 intake-joint + cli-authority-wiring 两冻结红基线）；③ mountdelay 保真契约排回（7/15 头号，零后续，worktree `casey-replay-settle-fidelity` 留作占位）；④ worktree 卫生已做：`/tmp` 十树与空壳树、cert 树全清，仅剩四棵有主持久树；⑤ 两 WIP 特性（跨平台安装 `902216e` / 账户配置 `02f4361`）待验收后另走合并。
5. **存量债新观测**：ratchet 7 问题含 `report-model.schema.json` 与 `workflow-delete-causal-binding.static` 两处更早漂移（疑遗产整合期引入，非本轮文件）+ 三个真机产物缺件 + 两个安全墓碑永久信号；`intake-joint` 金牌是真实 intake 接线缺口（非孤儿，保持红）。

## 2026-07-16 活动增量：可信闭环自进化纳入正式计划

Steven 已要求把“形成可以放心使用的闭环自进化”纳入计划。现役入口为 `docs/plans/closed-loop-evolution/plan.md`：在既有 `record → intake → distill` 底座上，补齐身份观察、名称+编号语义锁、候选原子忠实闸、联网真实 SUT 复验、逐用例 HTML/录屏/附件、人签晋升、版本化撤销以及 P6 有界自愈接合。当前不得宣称闭环已完成：语义锁 v1 仍有假 SAME 风险，成功回放到正式 registry 的晋升链和可运行 `casey heal` 尚未落地。

当前执行序：① 语义锁 v2 修掉假一致 P0；② 接入录制后身份对比与回放前复核；③ 候选原子 schema/忠实闸；④ 真实 SUT 回放证据闭环；⑤ 人签晋升与撤销。Claude Code 额度采用风险触发：`fable high` 只做一次安全边界计划审和一次合并前核心 diff 终审；机械接线不重复送审，除非产生新的 HIGH/P0 或关键 diff 改变。

> 以下为 2026-07-21 快照，只溯源、勿据其判现状（`checksum-drift-closure` 据 `docs/codex/HANDOFF.md` 已由 codex 侧收口；最新现状见顶部 2026-07-22 节）。

## 2026-07-21 状态快照（历史层：checksum-drift-closure 已 init）

前序 `flow-bridge-golden-refit`（full，六阶段全 done）收掉 2026-07-17/18 三波信任根收紧（dfee72c 桥闸实体绑定 / 05573d1 intake 三件套 / edea1f9 canonical 固定根）落地未复跑受影响冻结金牌（护栏 #19）留下的六条陈旧绿，全部修夹具侧、生产零改：

1. A 家族（桥闸）：flow-bridge/ingest 金牌补显式 entityBindings + 负向精确拒因 + C17 反向锁；内核 mutant 突变红证（一次性隔离树 baseline 17/0 → mutant 16/1 唯 C17 翻红、主树字节前后 sha 双录一致，`evidence/mutant-proof.md`）。
2. B 家族（intake-固定根）：cli-mcp-face 重建 MCP intake happy（未降级、台账 generation 2）/ record-distill 改形 + 三列账迁移（C2d→`CAPTURE_URL_LEAK`、C2f/C2h→`CRED_GATE_HIT`，保留 11/迁移 3/丢失 4 挂账 `record-three-piece-producer`）/ authority-root bootstrap-worker 两段式 + 三金牌共用 ephemeral 动态签名 support 件。
3. C 家族：bootstrap + integrate-regress + p2-intent-compile 三 plan.md 术语正名（改「原子候选」）。
4. ADR-0004 人签（Steven 三项 + 评审补签两处字节）+ 重签 6 owner + 4 新条目（worker/support）；全 22 prd 复 gate；s4 校验器 `refit-regate-verify.mjs`：39 复gate刷新绿（正面证明）+ 2 恒红守诚实（未违规翻绿）= 41 对账、0 败。人签留痕 `HUMAN-SIGN.md`。
5. 异构评审 codex gpt-5.6-sol high 三轮 R1 FAIL（人签留痕 / s4 恒红过度声称 / A6 清理孤儿窗口三缺陷）→二次修（撤兄弟反证改诚实标注 + 全文时态归一 + Steven 补签评审后两处字节）→ R3 三缺陷全闭合 PASS（`review/codex-review-{request,reply}-r{1,2,3}.md`）。
6. task #17 已由 `checksum-drift-closure` 接棒：只读核账确认 2 处真实漏签 + 2 处有意安全撤销，不是四处并发污染；`GRILL.md` 已给 D1/D2/D3 分岔与推荐方案，当前等待 Steven 签认，尚未 advance grill。前序教训见 `docs/plans/flow-bridge-golden-refit/learn.md`。

以下为 2026-07-15 凌晨快照，只溯源、勿据其判现状：

## 2026-07-15 状态快照（历史层：B/C 双契约收口）

1. B `drawer-lock-hardening`（light）已合并 dev（merge `a65ccca` + 复验 `c5789a2`）：画布三原子域锁跨抽屉硬化，codex∥pi 六轮双路复核逐轮逼真缝到双 PASS——r1 域锁 TOCTOU 漂移窗(2 HIGH)/r2 pin 语义/r3 句柄未闭合(fable 汇裁亲读代码坐实 codex、纠 pi 漏报)/r4 空白归一 MED/r5 纯空白 label fail-open/r6 双 PASS。抗漂移绑定(物理句柄快照+pin 挂点第三闸)+run 态失效+任一可见判定。红先行金牌 G18-G20，全量 39/0。家族差异实证：pi 三轮漏报 vs codex 三轮逮到。
2. `replay-settle-mount`（full）已合并 dev（merge `e7b3f79`）：回放侧代表步采断言前补有界静默点，修 buttonState SPA 挂载计时假阴（`tc_wf_publish_states` intent_1 真机误判 NEEDS_HUMAN 的根因——编译侧有 quietPoint、回放侧代表步无等价静默点）。小固定下限 250ms（Steven 批准，仅起步垫）+ 复合条件（在途 API 归零 ∧ DOM 两拍稳定）预算 2500ms 对齐编译期 + networkidle 兜底 + 超预算 fail-safe。codex fast 设计审逮真 HIGH（静默点无硬时间上界/I5 金牌矛盾）、实现审逮真 MED（小固定下限吃掉条件预算——你批的垫引入的 bug，fable 独立复现坐实、pi 漏报），r2/r3 修死到双 PASS。fake-sut 加 mountdelay 忠实复现真机接缝。ADR-0009 甲方案第一块保真缺口。
3. 合并收尾：两契约共改 `fake-sut/server.mjs`——冲突人裁取并集（B 的 twin*/pin* 11 场景 + 静默点 mountdelay/churn，零重叠纯加法）；4 个冻结 server.mjs/CONTRACT.md 的 prd（drawer/p5-replay/replay-nth/replay-settle-mount）按并集实际字节重签。4 gate 全 GREEN（顺序跑避争用 flake）+ ratchet 72 PRD/195 冻结/0 问题 + tier1 GREEN。
4. 真机计时修复确认——【更正：修复不足，真机仍假阴，需再一轮】：平台 `saveOrModifyProcess` 一度持续 503（两次连撞、机器正确判 SUT_DEFECT）后于 2026-07-15 恢复（返 200）；save 恢复后干净重跑 `tc_wf_publish_states`（run_1784069823273）——`intent_1` 仍判 NEEDS_HUMAN、发布/保存 actual 0，而同用例 `intent_2` 成功点中「发布」（PASS）、按钮在 intent_1 断言后约 2.7s 才挂出。即 replay-settle-mount 的静默点修复没兜住真机计时假阴：静默点接线在、跑了（quiet=true、全程等 8430ms），但条件（在途 API 归零 ∧ DOM 两拍稳定）在发布/保存挂载前就满足放行。根因 = codex 设计审曾提、被挂账的 MED「请求结束但 UI 延迟提交的 SPA 形态未覆盖」：真平台 editorData 请求结束、DOM 在早期状态两拍稳定后才由框架延迟挂载按钮；fake-sut 的 mountdelay 场景是「应答后立即替换 DOM」，未忠实复现此真子接缝——hermetic 金牌绿、真机仍红，保真缺口未真正补平。之前「翻正」是 hermetic-only 的过早结论，特此更正。ADR-0009「真机 UAT 升必过闸」被反向坐实（hermetic 绿不算完成，真机 UAT 逮住残留假阴）。下一步（新 full 契约）：① fake-sut mountdelay 补「应答结束 + DOM 早期稳定 + 按钮延迟提交」子形态忠实复现真机；② 强化静默点条件覆盖「请求结束但 UI 延迟提交」——注意不得读 expected（I4 禁倒着裁），须用域通用信号（加载占位消失 / 更长静止窗 / 变更静默）。挂账：平台 saveOrModifyProcess 一度 503（已恢复，值记账观察是否复发）。
5. flake 发现（挂账）：drawer-lock-hardening 金牌有条计时敏感检查在 chromium/CPU 争用下偶发翻红（本 session 主题的又一实例）——无争用直跑 39/0，值将来硬化（放宽为 settled 判据主）。
6. 保真审计程序（ADR-0009 甲）：mountdelay 是第一块补平的保真缺口；剩余 fake-sut 场景（~22 个）逐条对真机采样审计 + 每条回放用例真机 UAT 升必过完成闸——待平台恢复后系统推进。
7. **未清理债**：B worktree 物理目录删除撞 DrvFs 权限（work 已在 dev、cosmetic 债）；`replay-settle-mount` worktree 待清；隧道 stdio 桥脚本（`scripts/stdio-supply.mjs`/`win-stdio-agent.mjs` + `win-reverse-agent.mjs` 的 CASEY_TUNNEL_HOST 改动）未提交（dev 工具、wslrelay/NAT 挂时的兜底通道，值单独提交）。

以下为 2026-07-14 凌晨快照（提取契约收口），只溯源、勿据其判现状：

## 2026-07-14 状态快照（历史层：提取契约全收口）

1. `loop-kit-extract` 六阶段全 done 并入 dev：实现审走 codex sol@medium ∥ pi deepseek-v4pro@high 双路共八轮到双 PASS（round-1 逮 7 条含 3 HIGH：ROOT 认领槽须进程级 `globalThis` 共享、`boot.mjs` 补入 `testChecksums` 冻结面、D5 故障域金牌补行为级——全部红先行修死；末三轮教训：评审记录自身准确性也要被复核）。主会话独立复验（gate 5/5 + tier1 + ratchet + 核心 `bin`/`lib` 零触碰 diff 实证）后合并 `b3a0f64`、主树复验提交 `976a414`（gate 经 `shim`→包 5/5 GREEN、全仓 ratchet 69 PRD/190 冻结文件/0 问题）。提取树与分支已按惯例清理。包仓 `/mnt/d/ctx/heren/loop-kit`@`ea5ed85`。
2. 待 Steven 终签三项（learn.md 与 prd observability 有账，不阻塞后续）：route:human #5 跨仓棘轮形态确认 / #6 每调用 `kit-lock` 校验性能预算（实测全清单 sha256 约 130-145ms、端到端约 480-510ms，建议预算 150-200ms、禁 mtime 缓存）/ #7 进程唯一 ROOT 对 `node:vm` 场景的范围表述。
3. B/C 已在新引擎下恢复执行（Steven 2026-07-14 指令：loop 完成即直通 B/C 不再请示）：两树先并 dev 对账（B `f4bae4f` / C `95b44d8`，零冲突，新引擎跨树自锚实证 OK）；编排 v2 `docs/plans/_session-resume/bc-contracts-workflow-v2.js`（对原版打异构硬门补丁：plan 设计审必须真 codex、同族兜底判 blocked——原 `endsWith('PASS')` 放行洞已封）在跑，run `wf_dfd25052-144`，八段到 learn，合并收尾归主会话。
4. **异构评审硬规则**（Steven 2026-07-13 定，已入记忆与 v2 脚本）：plan/设计评审无兜底、必须异构本尊出结论，不通即 blocked；代码实现审仍允许「全断时诚实末位同族兜底 + 挂账」。
5. **下一步**：B/C 各自 mergeReady 后顺序合并（3-way 人裁冲突 + 既有 sign 流程重签共享冻结 + 全仓 ratchet 总核 + tier1）→ 改革续 P0-4a/P0-4b（`kernel` 车道契约）。A 真机 UAT 照旧 route:human 挂账。autotester 侧迁移 = 另一有界工作流未启动。

以下为 2026-07-13 深夜快照（提取契约实现期，其「下一步」已被上节完成），只溯源、勿据其判现状：

## 2026-07-13 深夜状态快照（历史层：`loop-kit-extract` 收口）

P0-3（`docs/plans/loop-dual-profile-reform/PROPOSAL.md` §14 排期）在本次 session 于契约 worktree `casey-loop-kit-extract`（分支 `loop-kit-extract`，lane full，kernel 级加严）落地收口：

1. **包仓落成**：`loop-kit` 通用内核提取为独立包 `/mnt/d/ctx/heren/loop-kit`（兄弟目录，`fresh git init` 不携历史，首提交 `0f34cc0`，出处记 `casey@f9f9019`）——十脚本迁入（8 份字节一致件 + `contract.mjs` 以 Casey 版为准含 `worktree` baton 全套 + `ratchet.mjs` Casey 独有件，除 ROOT 锚定行外逐字节照搬），新增 `lib/root.mjs`（提取后唯一新逻辑：`resolveRoot()` 单点解析 + 原子认领，env 有效必须校验/无效不回退/上溯找根标记/`realpath` 规范化/认领后不可变）。
2. Casey 侧单提交切换：`loop-kit/bin/*.mjs` 十文件原地换薄转发层（`shim`，由单一模板 `tests/fixtures/loop-kit-expected/shim-template.mjs` 展开生成、逐字比对钉死）+ 新增共享引导助手 `loop-kit/lib/boot.mjs`（包定位 `LOOP_KIT_PKG`/兄弟约定 → `kit-lock.json` 包身份锁全清单 sha256 校验（两定位方式均不豁免）→ env 注入 → CLI `spawnSync` 转发或库模式动态 import + re-export → D5 全故障域降级：cli 类 64/guard 类 2/lint 类 0）。
3. **红先行铁律走完**：`tests/_golden/loop-kit-extract.golden.mjs`（C0–C7，55 检查）落地前逐条验红——C0 包不存在、C2 全量引擎无视 `LOOP_KIT_PKG`（转发未生效）、C3 异地布局/跨树部分场景、C4 全部故障族（无降级协议）、C5 现文件非 `shim`；C1（API 面）与 C6（三存量金牌非回归）依设计全程照绿。`contract advance accept --red-verified` 之后才动 `loop-kit/bin` 字节；建成后 55/55 转绿。
4. **切换前观测基线**：隔离测试树逐案录制 26 个命令/hook 用例（`gate --dry`/`contract` 全子命令/`breaker`/`term-lint`/`ratchet`/四 hook 正常路径），原始与规范化输出并存（`tests/fixtures/loop-kit-expected/baseline/`），规范化器（时间戳 + 隔离树绝对路径两条白名单规则）自身入冻结面；C2 每次复跑与此基线整树比对（exit code + stdout/stderr 全文 + 声明写集之外零变化）、含反向扰动自检证明规范化不吞真实差异。
5. **三存量金牌零重签**：`worktree-baton`/`term-guard`/`ratchet-reverse-index` 三金牌与其 prd 字节等于切换前 git blob 锚（已逐一核验相等）；经 `shim` 复跑，结果与切换前实测锚一致——`worktree-baton` 因自身含一条与「本 worktree 活动 contract slug 恰为 worktree-baton」耦合的既有断言（G6，与本契约无关、字节冻结不可改），本树（活动 slug 是 `loop-kit-extract`）复跑现状是 exit 1，非本契约引入的回归，详见 prd observability 与 `tests/fixtures/loop-kit-expected/baseline/c6-rerun-anchor.json`。
6. **全量复验**：`loop/prd-loop-kit-extract.json` gate GREEN（5/5 story）；`node bin/casey.mjs selftest --tier1` GREEN；`node loop-kit/bin/ratchet.mjs verify` 除两条与本契约无关的既有缺口外零问题（`cases/tc_wf_history_version`、`cases/tc_wf_publish_states` 的 `expected.frozen.json` 属未入库真机运行产物缺失，早于本契约 commit `24865f4`）。
7. **文档同步**：`CONTEXT.md` 登记三术语（`shim`/`kit-lock`/观测基线）+ `loop-kit` 词条白话解释更新（已提取、分发形态、route:human #4 取甲不采用 npm 本地路径依赖）；`CLAUDE.md` 新增 Bootstrap 段（包是消费树兄弟目录、任何机器同构；`hook-loop-guard` 缺包/锁失配 fail-closed 会连带拦住修复用的工具调用，恢复须在 hook 触发范围之外人工完成）。
8. **下一步**：`contract advance loop` → 异构冗余实现审（codex 评 Claude 实现，仅喂 spec+diff+门禁证据，护栏 #9）→ Steven 人签收尾 → `advance learn`。之后排期续 P0-4a（状态引擎）/ P0-4b（gate 分层），均为触强制层的 `kernel` 车道契约。非本契约范围：autotester 侧迁移与其 `contract.mjs` 对齐（另一有界工作流）、npm 本地路径依赖出口（route:human #4 已裁定不采用，如后续确需另立契约）、R2-L1 每调用锁校验性能预算收口（route:human #6 待 Steven 续裁，codex 实测指示值已挂账）。

以下为 2026-07-13 晚（loop 双 profile 改革批准）快照，只溯源、勿据其判现状：

## 2026-07-13 晚状态快照（历史层：loop 双 profile 改革）

1. **批准落盘**：Steven 显式批准 `docs/plans/loop-dual-profile-reform/PROPOSAL.md` 反转旧决策 ①（B/C 先行）与 ③（本期不建 `state.json`）——B/C 延后、采纳 16 节点 `Durable Workflow State`、该提案为唯一活动改革设计源（批准记录在其 §0，溯源按 §4.2 标 user-asserted）。`loop-ddd-overhaul/DESIGN.md` 与 `loop-orchestration-reform/NEXT-SESSION-PROPOSAL.md` 已标 `SUPERSEDED` 只作历史。中文决策摘要 = `DECISION-SUMMARY.zh.md`；`CONTEXT.md` 登记七新术语（`Execution Profile` / `Durable Workflow State` / `Ownership Lease` / `kernel` 车道 / `Review Receipt` / `Readiness View` / `Fitness Function`），term-lint 0 提示。
2. **评审链闭环**：Fable 只读仓地架构审 `PASS WITH REQUIRED CHANGES`（HIGH-1 治理取代记账 + MED-1..5 全并入提案文本）→ 聚焦复核四收窄 ACCEPT → codex 事实更正（`countChange` 候选已于 `dbc0d0d` 落地、被当前代码证伪；P0-9 自托管候选改为 intake 时按实时代码/git 历史选定）终态 `ACCEPT WITH FACTUAL CORRECTION`。完整处置账在 `FABLE-REVIEW-DISPOSITION.md`。教训已入工作记忆：backlog 行承重引用前必核当前代码。
3. 本 session 已落 dev：文档收口 `7a2ce6d`；`ratchet-reverse-index` 只读反向索引验证器合并 `164636e` + 主树复验 `e81ce7f`（gate GREEN 2/2、全仓核验 68 PRD/103 冻结文件/0 问题；该契约六阶段全 done、pi+deepseek 异构冗余评审 round-2 PASS；已按惯例移树删支）。
4. P0-2 已执行（两子代理并行、各驻一树）：B `drawer-lock-hardening` 冻结提交 `178408b`（fake-sut WIP +33/-3 零字节改动入分支 + plan 产物 + checkpoint 台账，显式非 merge-ready）；C `gen-prompts` 冻结提交 `33c382a`（plan 产物含早间编排中断遗留的 `planreview-material.md` + checkpoint 台账）。两树 baton 保持 2/6、基点仍 `1e3c8cc`（落后 dev 属预期，恢复时按 P1-3 实算分叉）。
5. 早间 B/C 编排已停（Steven 改序）：Workflow run `wf_25ac75de-8f2` 已停止；B/C 恢复走 PROPOSAL P1（经新 loop），不再直接续跑 `bc-contracts-workflow.js`。
6. 下一步（按 PROPOSAL §14）：P0-3 loop-kit 提取 vs 显式分叉决策（Steven 拍板、落新 ADR；注意 `gate.mjs` 等 8 份脚本仍与 autotester 字节一致，动它们前必须先定所有权）→ P0-4a 状态引擎 / P0-4b gate 分层（每项单独验收的 `kernel` 车道契约、旧 loop 互锁下执行、隔离 worktree 顺序合并）→ … → P0-12 有界切换。多 subagent/`Workflow` 编排为默认工作法（Steven 2026-07-13 重申）。A 真机 UAT 继续挂 route:human。主树活契约槽 = `loop-reform-p0-docs`（direct，纯文档收口用）。

以下为 2026-07-13 早间快照，只溯源、勿据其判现状（其「先收 B/C」执行序已被上节批准反转）：

## 2026-07-13 状态快照（历史层：B/C 在制）

上一 session（2026-07-13 上午）因 `wsl --shutdown` 根治隧道中继强制重启，A+B+C+D 四线（Steven 拍板全做）中断点如下（执行指令见 `docs/plans/_session-resume/RESUME-2026-07-13.md`，本笔已入 git）：

1. D 归档清理**已完成**：三棵已合并契约旧 worktree 移除 + 十个已核实合并分支删除；保留 `run-convention-claude` 存档分支 + 三 `archive/codex-wip-*` tags。
2. B `drawer-lock-hardening`（light）与 C `gen-prompts`（full）两棵 worktree **在制**：baton 各 2/6（grill+plan done、产物落盘），`dev..分支` 零提交（Build 被关机丢失，需重起编排续跑）；B 树有未提交红先行夹具半成品（`M tests/fixtures/fake-sut/server.mjs`，续接勿重敲）。编排脚本 `docs/plans/_session-resume/bc-contracts-workflow.js`（8 段，Plan 段读盘幂等，跨 session 重 launch 非 resume）。
3. A 真机 UAT 卡相位0 关三（wslrelay 隧道数据面），重启后按 `docs/runbooks/real-uat-runbook.md` 重拉标准隧道；route:human，需 Steven 在场。
4. loop 编排改革两份文档评审毕、Steven 批准（2026-07-13）：`docs/plans/loop-ddd-overhaul/DESIGN.md` = 唯一设计源；`docs/plans/loop-orchestration-reform/NEXT-SESSION-PROPOSAL.md` = 评审后执行摘要（内含 Claude 方案审查 HIGH×4/MED×6/LOW×4 与批准记录七决策）。要点：B/C 先行；护栏 #18 不推翻（无共享 registry/自动 merge queue）；扩展现有 contract 台账、不建 `state.json`；强制层（gate/contract/hook/term-lint/签名写路径）改动按 kernel 治理；默认 2 限界上下文；round-2 只 HIGH/MED 强制；backlog drop 须 Steven 确认。
5. 本 session 执行序：Phase1 文档收口（本笔）→ Phase2 重起 bc-contracts 编排收 B/C → Phase3 主树落**只读** ratchet 反向索引验证器（light 契约，不写 testChecksums/passes/签名，批量重签写面=未来单独 kernel 契约）→ Phase4 顺序合并收尾（人裁冲突 + 既有流程重签 + 验证器全仓总核 + tier1 + 刷新交接文档）→ Phase5 改革按 DESIGN.md Phase 1 范围正式立项（16 节点迁移不并入、另行提案）。
6. 未提交现场保持不动：`M .gitignore`（Steven 的）+ `M loop/prd-selftest.json`（gate 时间戳漂移、不并提交）+ `docs/codex/`（并行 codex 会话产物）+ `docs/plans/regress-strategy/`、`docs/plans/usability-audit/` 草稿。

以下为 2026-07-10 快照，只溯源、勿据其判现状：

## 2026-07-10 状态快照（历史层：三契约与漂移收口）

本 session 承接上个 session 起好的三棵 codex worktree 在制品，走「Claude 补齐/评审 + 多 subagent 编排 + codex 异构评审 + 协调合并 + 全量复验」，三契约 + 一漂移收口契约齐落 `dev`（`68f1fe0`→`ff73011`）。dev 全量复验绿：全仓 115 条 ratchet 全 MATCH + `selftest --tier1` 裁判零 LLM GREEN。落地清单：

1. `wf-set-node-field`（light，画布第五原子 `workflow.setNodeField`，merge `6f021a4`）：节点抽屉按 placeholder 填值（域锁 `.hr-drawer__content-wrapper` 内 `getByPlaceholder` + nth + 填后 `inputValue` 精确回读身份门）+ 专用回放门 `doSetNodeField` + fake-sut 字段夹具，`COMPILE_KNOWN_ATOMS` 17→18。codex-sol@xhigh 异构冗余评审揪出 HIGH（显式非法 nth 静默降级 index0 fail-open——我 subagent 补齐时照抄了旧写法）+ 3 MED 硬化，红先行修毕。原 codex 半成品 impl 因误判被弃、由 Claude subagent 从冻结 spec 全新实现（详见历史层教训）。
2. `replay-nth-visible-hardening`（light，merge `cb084aa`）：`selectNodeDropdown` 同域三修（非法 nth 硬阻断 fail-closed / 触发器域锁补 `:visible` / fake-sut 注释订正）+ 编译门 `waitFor` 时序修（codex 自查 F2、恢复两门同刻）。codex 实现→Claude 3 视角异构冗余评审（fail-safe / golden 真伪 / 时序对称）2 CLEAN + 1 弃用词订正。
3. `resign-drift-closure`（light，`791cef1`）：收口八契约遗留两处「共享冻结文件只签一处」的 ratchet 漂移——① `p2-verdict` 陈旧夹具 `verdict-cases.json` line42 `fallback_first`→`ambiguous`（resolution 收敛漏改该 sha256 冻结夹具，致 `ambiguous_action` 落 INDETERMINATE 非 AMBIGUOUS_ACTION）+ 重签 `prd-p2-intent-compile`；② 重签 `prd-mcp-parity` 的 `cli-mcp-face.golden` checksum（casey-doctor/distribution 改金牌加 EXCLUDED 漏签它）。红先行 `p2-verdict.golden` RED→GREEN(8/8)，`gpt-5.6-terra`@max 异构评审零 findings（网络提断未盖形式化章）+ Claude 亲核 + Steven 人签（触裁判内核冻结面 ADR-0004）。
4. `regress-promptset`（full，merge `0333f83`）：regress scope A 数据驱动被测参数 overlay（N 行 prompt 灌进一条冻结 chat flow 参数槽展开成 N caseId）+ 内置注入向量库 `prompts/_lib`（boundary/security）+ 多用例聚合报告。铁不变量：裁判零 LLM/冻结核零改——content-match（软期望）只作报告 soft 黄标、绝不进裁判进程、绝不判红；`verdict.mjs` 字节未改。codex 实现→Claude 3 视角评审（裁判纯度 CLEAN + 正确性 MED `report.mjs` 聚合非确定性 + spec-golden），round-2 修毕。
5. 合并收尾三笔：B+D 合并后重签 `prd-replay-nth-visible-hardening` 的 server.mjs checksum（`2481309`）；C 合并收尾重签 `prd-seams-freeze` 的 report-model.schema.json checksum（C 兼容加 promptset 报告块 40+/0-，seams-freeze 金牌不变量全过，`89b29e3`）；B 的 codex-sol MED#2（域锁跨抽屉边界）补挂账进 observability（`ff73011`）。

本 session 关键教训（已并入准则）：合并收尾必跑全仓 ratchet 总核（遍历每 prd testChecksums 对实际文件 sha256）——逮出 3 处「共享冻结文件只在一个 prd 重签、漏签另一个」的复发债（D-prd server.mjs / prd-mcp-parity / prd-seams-freeze），单靠各 prd 的 gate 逮不到跨契约漂移。异构冗余评审真挣钱：codex-sol 逮出 Claude 实现的真 HIGH。**过程踩坑并诚实纠正**：曾把「codex 昨晚做完没提交」误判成「停摆」而误起 Workflow 重实现，wf-set-node-field 的 codex 原 impl 因此被弃（spec 蓝图未丢、由 Claude subagent 全新实现顶上，功能等价）；崩溃两次（内存泄漏）都从 git + 磁盘恢复零丢活。

活契约槽（主树）= `resign-drift-closure`（六阶段全 done、baton 空闲，下一契约直接 `contract init`）。未提交现场：`M .gitignore`（Steven 的）+ `M loop/prd-selftest.json`（无关 gate 时间戳）+ `?? docs/codex/`（并行 codex 会话的 handoff 功能产物、别碰）+ 两草稿目录。codex 升级到 0.144.1（走 GitHub release 手动装，chatgpt.com 在 WSL 抖动），异构评审可用 `gpt-5.6-sol/terra/luna`@xhigh/max。

**下一步**（详见 `docs/NEXT-SESSION.md` 下一步节）：A 真机 UAT（route:human，最高优先，需 Steven 在场 + 隧道 + `.auth` 测试账户带外确认）/ B 画布三原子域锁硬化契约（MED#2 挂账）/ C regress gen-prompts（scope C LLM 合成，刻意延后）/ D 归档分支清理。

---
以下为 2026-07-09 晚快照，只溯源、勿据其判现状：

## 2026-07-09 晚状态快照（历史层：易用性与分发并行落地）

本 session 走大规模并行（`worktree` fan-out 起草 + subagent 各驻树实现 + `Workflow` 编排逐契约收口评审 + 协调合并），把排队的候选契约与两个新契约一趟落地、全部合并回 `dev`（`b4f5c27`→`44df070`）。dev 现干净：只剩 Steven 的 `M .gitignore`（别动别提交）+ `?? docs/plans/usability-audit/`（母审计草稿、非契约）。八契约 + codex 的 `run-convention` 齐落，逐一 gate 复验绿（各契约 prd + `cli-mcp-face` 全 GREEN、`selftest --tier1` 裁判零 LLM、全部判内核/画布金牌 exit 0）。落地清单：

1. `run-convention`（light，`b4f5c27`，codex 实现）：`casey run <caseId> --sut` 缩八旗标为 `caseId` + `cases/<caseId>/` 约定布局解析（显式旗标恒赢）+ caseId 穿越守卫 + `AT_CASES_DIR` 锚仓根防 cwd 漂移。**两处各做了一份**（并行 codex 会话 + 本会话）——DeepSeek 三轮评审的 codex 版多修了 `AT_CASES_DIR` cwd 漂移（本会话版有同款隐患），Steven 拍板取 codex 版落 dev；Claude 那份（含 HIGH 穿越修 + 红先行金牌 A9）存档在分支 `run-convention-claude`、没丢。
2. `mcp-parity`（light）：`MCP` 面补 `casey_record`/`casey_intake` 两工具（14 工具）+ 版本单源（`serverInfo.version===package.json.version`）+ 新增 `CLI⊆MCP` 覆盖断言（switch 派生命令集 − `CLI_MCP_EXCLUDED` 须各有 `casey_*` 工具）。keystone——doctor/distribution/集成修都往 `EXCLUDED` 加各自 CLI-only 命令。
3. `ingest-scaffold`（full）：`casey scaffold-case <caseId> --from-text` 相0 前段脚手架——自由文本零 LLM 包成 schema 合规候选骨架（`source.kind:'freetext'` + 单条 `route:human` 占位步、不臆断切分），开箱过 `parseTestCase`，供 CLI 外 LLM 归一后经 `ingest` 重新入场。CONTEXT 登记三术语（归一脚手架/候选骨架/归一提示模板）。
4. `casey-demo`（light）：`casey demo` 零真机零凭据（需 chromium）出一份自包含 `PASS` 样例报告——`scripts/sample-report.mjs` 提升为 `bin/demo.mjs` + 门面 + skill/README 自然语言入口。
5. `casey-doctor`（full）：`casey doctor` 跨平台就绪自检——纯函数层（零 fs/spawn/os）+ 采集壳分离，逐项查 node/playwright/字体/凭据·site.json/隧道，OS 分支修复建议，零凭据值零目标地址（哨兵夹具实证）。
6. `distribution`（light）：`casey mcp-config --agent <claude|codex>` 自适应挂载配置打印（`PROJECT_ROOT` 派生、无盘符硬编码、serverAbs TOML/shell 转义）+ 仓根 `AGENTS.md` 分家接入 + `docs/runbooks/onboarding.md` 跨平台上手。
7. `wf-select-node-dropdown`（light）：画布第四原子 `workflow.selectNodeDropdown`——节点抽屉「请选择」下拉 `click`+`nth` 承载（零冻结 `events.schema` 改，`COMPILE_KNOWN_ATOMS` 16→17）+ `doSelectNodeDropdown` 域锁回放门 + 点击身份门（缺 option 多选项浮层绝不点首项、返 `ambiguous`）。
8. `resolution`（full，触裁判内核）：多匹配 `resolution` 词表统一——裁判识别端 `verdict.mjs` + `report-model.mjs` 一手同步收敛到 CONTEXT 登记词 `ambiguous`（多匹配 → `AMBIGUOUS_ACTION`）+ 三门 emitters（compile `multi`/replay `fallback_first`）收敛 + 删识别端幽灵 `coord_fallback`（run-history 诊断可表征锁保留）。fail-safe 不破（A2/A3/A4 golden 钉死多匹配≠PASS/SUT_DEFECT）+ 裁判零 LLM 不破（`verdict-purity-guard`），Claude 亲核 + codex 评审双 CLEAN。

**异构评审真挣了钱**（gate 全绿的契约里逐个揪出真 bug、红先行修死）：run-convention 路径穿越（HIGH）+ `AT_CASES_DIR` cwd 漂移、`wf-select-node-dropdown` fail-safe 假绿（HIGH，缺 option 误点首项返 unique）、distribution 路径转义、ingest-scaffold output-seal 路径回显、casey-demo 注释违 GRILL D6。另有批一合并集成缝：`scaffold-case`/`demo` 需进 `cli-mcp-face` `EXCLUDED`（各契约单树皆绿、合到一起 `CLI⊆MCP` 断言才逮到）；终版 `EXCLUDED` 九项，三次冲突逐个 3-way 解 + 重签 `prd-cli-mcp-face`。

活契约槽（主树）= `run-convention`（六阶段全 done、baton 空闲，下一契约直接 `contract init`）。八个已合并契约分支保留为存档（`git branch -d` 可清、work 已在 dev 史）。本仓无 git 远端。

本 session 新锁工程纪律：① 长链条走确定性编排（ultracode/`Workflow`；`CLAUDE.md` 新增「开发工作法」节、Steven 定）——多契约并行落地 + 逐个异构评审 + 分波合并这类别手派一堆 `Agent` 自己盯。② 协调合并手法：跨契约共改冻结金牌（如 `cli-mcp-face` `EXCLUDED`）走顺序合并 + 3-way 解冲突 + 合并后重签 + 全量复验，绝不各合各的撞多次。③ 栈式起树：依赖契约（doctor 栈 mcp-parity、distribution 栈 doctor、resolution 栈 D）栈在栈父 `worktree` 分支上起，避免并行改同批文件冲突。

以下为 2026-07-09 早段快照（示教兜底人录收尾 record-intake+distill + worktree-baton），只溯源、勿据其判现状：

本 session 三笔提交入 dev（`46ae7a3`→`ef94da4`），活契约槽 `worktree-baton` 六阶段全 done、baton 空闲，下一契约直接 `contract init`（或起 worktree 并行，见下）。工作树仍剩 Steven 的 `M .gitignore`（别动别提交）+ 七个未跟踪 `docs/plans/` 草稿目录（run-convention / mcp-parity / casey-demo / casey-doctor / distribution / ingest-scaffold / usability-audit——排队的候选契约、未入 git）。收口清单（按提交序）：

1. `record-intake`（full，`46ae7a3`）：示教兜底第二契约——`casey intake` 入账安全复核闸 + append-only 入账台账（`intake-ledger.jsonl`）。跨族异构冗余评审 codex R1-R9 九轮逐类真发现全采信、红先行修死：TOCTOU 换包假背书 / 中文敏感字段绕英文凭据门 / URL 判据漏 IPv6·非白名单 scheme / `normConverge` %HH+反斜杠归一到不动点普适前置每道检查 / schema 三层闭合白名单 + `hasDuplicateKeys` 重复键 tokenizer / symlink 四段守卫 / 凭据门 raw+canon+decoded 三扫。R10 formal PASS 撞 codex 后端 outage 挂账，同族 fresh-eyes 兜底 backstop 补跑（非跨族、信任非对称，audit 两条）。
2. `record-distill`（full，`4bce3a5`）：示教兜底第三契约——`casey distill` 把已入账 capture 零 LLM 全 pending 投影成候选流程（候选 `source.kind:'json'` 降权、绝不 signed/replayReady/直通回放）+ intake→distill `captureSha256` TOCTOU 硬门（`verifyIntaken`：NOT_INTAKEN/CAPTURE_SWAPPED + 当前字节重跑 reviewCapture）+ 采集忠实闸 `validateCaptureFidelity`。跨族 codex R1-R3 PASS（--verify 绕 TOCTOU / 写盘半份·路径泄漏 / 忠实闸抛 三发现 + 同族补 F4 超深编码凭据不收敛 `!converged` fail-closed，红先行修死）+ 同族 backstop corroboration。示教兜底人录三环 record-capture→intake→distill 全建。
3. `worktree-baton`（full，`ef94da4`）：解 roadmap v3 §二「单活契约 baton 真天花板」——实证每 git worktree 各有独立 baton（`active-contract.json` 与熔断态 gitignored、每树一份、互不共享），N 路并行 = N 棵 worktree、零机制改动。只加 `contract list`（跨树 read-only baton 总览）+ `contract worktree`（起树脚手架：slug 校验 + slug 全局唯一硬拒 + 落点仓库内部守卫 + git worktree add + 立 baton + 部分失败回滚）+ 六纯函数；`hook-loop-guard.mjs`/`breaker.mjs`/现有 init·advance·check·show 逐字节零改。否决共享池（背离 worktree + 设计红队 1 High+4 Med）。跨族 codex R1-R5 PASS（F1 路径 containment 深洞逐轮深挖五轮：词法守卫→软链父目录别名→`..name` 谓词假阴→深祖先投影→canonical 单点 guard==git==baton；R5 实测 point-4 无污染判 false-positive）+ 同族 backstop PASS。文档：CONTEXT 三术语 + GUARDRAILS #18 + `WORKTREE-PARALLEL.md` 手册 + roadmap v3 §三刷新（「解锁前提」bullet）。

并行开发已解锁（本 session 关键基建）：碰 `lib`/`bin` 的多契约真并行落地现走 worktree——`node loop-kit/bin/contract.mjs worktree <slug> --lane full --reason "…"` 起一棵、`contract list` 跨树总览、各树自绿后 git-native 合并回 `dev`（绝不 `cp` 进 `lib`/`bin`）。取代旧「单活契约 baton 天花板」（下方 337 单 baton 教训已过时，见其更新与护栏 #18）。

以下为 2026-07-08 下午—晚快照（示教兜底人录首环 + 用户易操作文档 + P7 报告五增量收口），只溯源：

本 session 八笔提交入 dev（`bb0ee3c`→`d9a39df`），活契约槽 `report-workflow-structure` 六阶段全 done、baton 空闲、下一契约直接 `contract init`。工作树仅剩 Steven 的 `M .gitignore`（别动别提交）。收口清单（按提交序）：

1. `record-capture`（full，`bb0ee3c`）：示教兜底人录第一契约（战略 item 1）——`casey record` CLI + `lib/record-capture.mjs` 产安全示教录制包（`signed:false`/`replayReady:false`/`distillRequired:true` 硬不变量、全文过凭据门 + host 安全 URL 投影、脏事件拒写不留半包）。codex 自评标 done、但 audit 写「非正式异构待补」即不算数，Claude 补跑正式异构冗余评审：三视角 fan-out 子代理揪 3 High（host 泄漏 ws/blob/协议相对/query 内嵌绕过 scrubUrlLike、caseId 路径穿越无守卫破 draft.mjs:42 先例、中文敏感字段 密码/验证码 明文）+ 3 Med（形态 fail-closed / 裸旗标 / stderr 路径回显），红先行全修毕。
2. 用户易操作线文档（`62ad838`，战略 item 3）：SKILL.md 自然语言操作面 + 两 runbook（报告输出要求 / 真实 0 error 用例现状）+ `verify-zero-error-report.mjs`；`report-spec.md` §3 codex 加的报告新需求经异构核为文实不符（report-model/renderReport 未落地）→ 记进「目标态、尚未实现」对账表（errata）。
3. P7 报告五增量（各六阶段全契约、红先行金牌、缺字段零行为差不动共享 fixture、codex 跨族异构冗余评审 PASS）：`report-nl-atomic`（`0719919`，naturalLanguage + atomicSteps）+ 对账表收缩（`ed3e6ea`）/ `report-video-block`（`8f7bcf5`，回放录像块）/ `report-cleanup-evidence`（`6267dff`，清理证据块 surface countChange 删前后命中数）/ `report-workflow-structure`（`1ad0702` + 跨族复审补强 `d9a39df`，工作流画布结构块，#11 诚实收缩为三类：节点/连线/节点配置覆盖判 + 空/半成警示）。report-model 报告块从 0 到 5；report-spec §3 六项报告块落五，余 #12 变量默认自定义属编译/草拟期规则、非报告渲染（对账表标明）。report-workflow-structure 因 codex 撞额度先走末位同族兜底评审、额度回来后补正式跨族异构冗余复审（audit 两条：末位条 + 取代它的正式条），挂账清。

以下为本日早前快照（wf-open-node 画布第三原子收口 + 隧道 agent 修复 + 战略重排，只溯源、勿据其判现状；其「下一步 item 1 人录 / item 3 用户易操作」均已由本 session 收口）：

意外关机三连后从会话转录（`ade30962`）恢复现场，补跑评审、收口画布第三原子。两笔提交入 dev，baton 空闲、下一契约直接 `contract init`：

1. `wf-open-node`（light，`657556a`）：画布第三原子 `workflow.openNode` 建成（`COMPILE_KNOWN_ATOMS` 15→16）——单击节点中心开配置抽屉（GRILL D1 单击定案、Steven 拍板否决 HANDOFF「双击」笔误）+ `doOpenNode` 专用回放门（`.lf-canvas-overlay` 域锁 + 域内唯一才点 + 缺席守卫 + 抽屉可见含【精确】标题双证回读）+ `compileWorkflowOpenNode` 编译门同刻 + fake-sut 抽屉夹具。例翻四金牌集 15→16 + 五 prd 重签。评审补跑（关机丢了原评审）：codex 正式异构 FAIL 3 发现 + Claude 五视角 + DDD 视角（Opus 4.8 重跑）。修两真缝——F1（High 抽屉回读子串 `hasText` 假绿：「模型节点副本」含子串被判开对 → 改精确 `filter({ has: getByText(label, exact) })` 两侧同刻，堵「点了没开/开错抽屉」两向假绿）+ F3（Med 缺反面覆盖 → fake-sut 加场景 `drawersuperset`/`drawernone`（弃 URL query——replay nav 走 `pathOf` 剥 query）+ 金牌 C3e（开错抽屉 F1 红证）/C3f（点了不开）+ C3a blocker 收紧）；证伪 F2（编译门=回放门，两 helper 都 `getByText(exact).first()` 同门）+ DDD「未登记新概念」（双证/域锁是点击身份门实例化）。红先行 C3e 改前红改后金牌 9/0；回归八金牌 + tier1 全绿；gate 两 prd GREEN。

2. 隧道 agent 修复（`3d7513c`，dev 工具非产品链路）：反向隧道 Windows 代理连接风暴修复——失败 socket `error`+`close` 双触发把连接池计数 `live` 减成负数 → `fill` 无限开连接耗尽端口打瘫整机网络（含 Clash）。修：一次性 `settled` 守卫 + 失败重连逐步退避（500ms 起、封顶 10s）。沙盒红绿：旧 2.5s 16376 次尝试 `live=-8184` → 新 8s 40 次 `live` 恒正常。隧道现关着、收口不需它。

3. 战略重排（Steven 2026-07-08）：真机 bring-up / 拉隧道那类 route:human 真机趟（含 openNode 真机保真度复核），优先级**低于** item 1 兜底（人录）+ item 3 用户易操作——先做 1 和 3、真机趟往后压攒一趟合并跑。

4. 挂账另立 full 契约（触裁判内核，DDD 视角揪出）：resolution 词表统一——CONTEXT 登记 `resolution` 枚举 + 裁判 `verdict.mjs`/`report-model.mjs` 认已登记的 `ambiguous`（多匹配 → AMBIGUOUS_ACTION）+ 删幽灵 `coord_fallback`（无门吐）+ 统一多匹配字面量口径（compile `multi` / replay `fallback_first` / openNode `ambiguous`）+ 补金牌钉 C3d `reason===AMBIGUOUS_ACTION`。fail-safe 现不破（多匹配仍 NEEDS_HUMAN、仅子类退化 INDETERMINATE）。根因：doOpenNode 是第一个说出 CONTEXT 已登记词 `ambiguous` 的门、反被裁判丢弃。

下一步（按 Steven 优先级）：① item 1 兜底人录（record-capture/intake/distill，参考 autotester；最小应急脚本随关机清、需重建）；② item 3 用户易操作（cli/mcp/skill 说清输入/结果位置 + 如何入 git + 如何接入各家 coding agent：claude code/codex/pi）；③ resolution 词表 full 契约；④ 真机 bring-up 趟（route:human，压后）。

以下为 2026-07-07 下午—晚快照（真机合并行程首航 + 画布两原子 + 两 C 线契约 + 并发 connectNodes 补收口），只溯源：

本 session 五笔提交入 dev，baton 空闲、下一契约直接 `contract init`：

0. `wf-connect-nodes`（full，`efaa41a`）：并发 session（codex 实现）补收口——`workflow.connectNodes` 画布连线原子（`COMPILE_KNOWN_ATOMS` 14→15，复用 `dragTo` 不扩枚举 + `doConnectNodes` 专用回放门按 `ev.atom` 分发 + `.lf-edge` +1 身份回读）+ `addNode` `expectedNodeDelta` 精化（真并行网关开始 +2）+ fake-sut 连线夹具。codex 已把实现/金牌写对、真机验过，但六阶段治理未走：无契约、四棘轮 prd 未重签（golden 改了 checksum 漂移、gate 必红）、无端到端连线金牌。Claude 侧补：契约台账 + 端到端金牌（8 检查填覆盖缺口）+ 四漂移 prd 重签 + 修 codex 两健壮性缝（F1 `nodeBoxByLabel`/`workflowNodeBox` 两处 `waitFor` 未守卫→节点缺席崩整轮回放/无诊断 exit 1；F2 目标缺席无 blocker→加三分支预检替 `ox`/`oy` `:0` 兜底）。评审归属反转：codex 主实现→Claude 侧对抗评审（异构原则实现方≠评审方避同族自评），四主线交叉核验 PASS。画布维度现两原子（addNode + connectNodes），R9 余量 openNode/setNodeField 等续建。


1. 真机合并行程首航（`24865f4`，route:human）：`tc_wf_publish_states` 4/4 PASS + `tc_wf_history_version` 8/8 PASS 真机四停站全绿（flow confirm → `compile --execute` 真机 → `casey draft` 人签 → `casey run` 报告过目）；`sign` 真 prd 首航——扁平每用例 prd `loop/prd-tc_<caseId>.json` 两份建成（sign 写 `expectedFrozenPath` + checksum，与金牌契约 prd 分离）；回放诊断栏目 + 录屏 + 中文字体三项过目 OK。`tc_wf_open_smoke` 三件已备（占位符 `<OPEN_NAME_TBD>` 待平台有稳定记录），本次跳过。
2. `wf-add-node`（full，`dbc0d0d`）：画布维度首原子 `workflow.addNode` 建成（`COMPILE_KNOWN_ATOMS` 13→14）+ `dragTo` 动作类入双冻结。真机二号探针定案乙案（面板项单击/双击死刑、`mouse` 三段式拖落 `.lf-node` 实证；`window.lf` 缺席 → `connectNodes` 拓扑取证挂账 SUT）；回放 `dragTo` 专用同刻门（源锁 `.node-item` 域 = 编译门、落点 `ox`/`oy` 必填不缺省）+ profile `countSelector` 计数通道；fake-sut 画布通路纯加法（双守卫拖落，预研 9/9）；例翻 `agent.openToolPicker`（flow-bridge C5/C14/C15 + wf-open-smoke C1）+ 六 prd 十四键重签；设计条款 :135 修订 + CONTEXT 词条同步。codex 两轮 R2 PASS（R1 四发现两 High：落点缺省假绿 / 编译门≠回放门，全采信）。真机四停站挂 prd observability（21 面板项文本漂移 / `lf-node` 族类名 / 拖拽时序 / `window.lf` 图对象口）。
3. `report-exit64`（light，`407b511`）：`report` 用法错历史码 `exit 2→64` 收敛（cli-mcp-face 挂账兑现、消熔断器语义撞车）——单行本体 + cli-mcp-face 金牌四钉位翻 64 + prd 重签 + SKILL.md 真面文字漂移同轮捕获。codex 一轮 R1 PASS。
4. `output-seal`（full，`cc7a3c2`）：全仓输出通道系统封缝（prd-caseid-echo-mask observability 挂账兑现）——审计全筛约 200 处、封 A1-A13/B1-B8/C 类 23 口 + `report.mjs` 穿越面字符集闸 + inbox/candidates 落盘过凭据门 + 3 追加缝（`replay` 裸 `JSON.parse` 收进消毒助手 / `term-guard` 候选门放写前 / 凭据门产物名键改固定标签）；核心手法「定位字段一律改结构性数组下标」（`SAFE_ID` 挡不住字母数字种子——codex 连三条同型实证）；碰裁判内核 `verdict.mjs` 一行输入消毒零动裁定逻辑。27 哨兵金牌每轮 stash 旧面红证；codex 三轮 R1(3)→R2(2)→R3 PASS。顺修 report-exit64 遗漏尾巴（p7-credgate-coverage 也钉 report exit 2→64）+ prd-p7-report 重签。
5. 真机账户禁令（Steven 明令）：真机只许使用带外确认的测试账户，此前账户停用——任何真机动作（登录探针 / `compile --execute` / `casey run --login-bootstrap` / 示教录制）前须 Steven 带外确认 `.auth/credentials.json` 已切到批准账户；未确认只做 hermetic。凭据内容照例不进任何输出/提交/报告。
6. 真机观测现状（只读探针核实）：平台侧栏菜单重组——工作流管理/智能体管理/`AI服务管理` 收进「智能应用」大菜单组（侧栏全景另见 组织权限/知识库管理/能力资产/HiClaw/运营监控/模型中心/平台配置/医疗业务管理）。影响面零杀伤：两条列表路由 `/heren/aimanagement/process/list`、`/agent/list` 直达未变、锚点全活（新增工作流钮/智能体搜索框/「互联网问诊-主诉」均在场），已建原子全走路由导航一击即中（chief-bringup G1 弃菜单点击的决策被反向验证）；唯 `nav.agentManagement` 无路由点击兜底（`.hr-menu :text-is("智能体管理")` 现嵌「智能应用」组内、折叠态或需先展开父级）本就标脆、真机优先配 `routes`，状态不变。「AI服务管理」可作未来维度候选。

以下为本日早前时段快照（2026-07-07 凌晨，Steven 三问审计 + 点单四契约收口——移交包 / 断言提硬 / 欠账清洗 / 飞轮第五条），只溯源：

上节「四契约六提交」后，Steven 三问（① 移交同事就绪度 ② 计划遗失复核 ③ 飞轮还不够）→ 四路扫描审计答卷 → 点单四契约按其序全收口入 dev。

1. `btn-enable-ops`（full，`c33d519`）：`buttonState` 补 `enabled`/`disabled` 双 op（wf-publish-states 明令挂账兑现，`bin/check.mjs` 法定 op 集 2→4、drafter mapAtom 同步吃四态）——判据 Steven 人签「标准判据 + profile 类名补判」：disabled 属性 ∨ `aria-disabled="true"` ∨ `profile.buttons.disabledClass` 命中；`buttonDisabledHits` 双通道采集镜像 buttonHits、`disabledClass` 存 `.trim()`（`classList.contains(' padded ')` 静默 false 假 enabled 实证）；评估器 `Number.isInteger + >=0` 双闸封 NaN fail-open（`hits<=0` 对 NaN 为 false 曾直判 enabled 真——codex R1-F1 红跑实锤）、`hits===0` 一律 ok:false（按钮不在场证不出 enabled/disabled）。publish-sut 加 disabledBtn 三形态对抗场景；wf-publish-states 金牌 U2/U3/D1 生命周期翻转 + prd 重签。codex 两轮 R2 PASS。真机 disabled 类名采样填 `profile.buttons.disabledClass` 挂 route:human。
2. `handover-pack`（light，`62d8acb`）：移交包——`README.md` 建成（八节：定位/环境要求/安装/CLI+MCP+skill 三面用法/七相流水线/凭据纪律「真值一律带外交付，绝不入库/提交/回显」/目录地图/排障，全 URL 仅回环）+ `.claude/skills/casey/SKILL.md` 清 `D:\` 硬编码 + MCP server WSL 挂载注释；漂移锁金牌 C1–C3（README 命令行↔真 help 逐字对齐）。codex 四轮 R4 PASS（R2 残项根因 = 评审包用「…」省略 sign 用法——评审包不许省略的元教训）。真机侧移交两项（MCP 真机挂载核验 / 凭据带外交付演练）route:human 挂账。
3. `plan-debt-sweep`（full，`44fb1df`）：计划遗失复核的欠账兑现——① `capturedAgainstBuild` 自动提取接线 `bin/compile.mjs`（07-02 签核 ⑥ 兑现：入口 HTML 脚本 `src` 抓 `[?&]v=` 前端发版号，取不到 fail-safe null）；② `bin/sign.mjs` 冻结期字面量 lint（断言字符串值含 `atl_` 裸前缀（非 `{{uniqueName}}` 模板）或 9+ 位时间戳 → exit 65，堵一次性值冻进断言）；③ `CONTEXT.md` 三行陈旧修正（verdict.json 最小五字段+report-model 指针 / trace 未建挂账 / recorder-as-library 已被 ADR-0006 取代）；④ design + report-spec 各加「已知偏离」errata 表（文实不符显式记账不静默）。codex 一轮 R1 PASS（5 Low 全挂账向）。
4. `wf-open-smoke`（direct，`7027d53`）：飞轮第五条只读零缝暖场——`nav.workflowManagement` + `workflow.open` 两纯加法编译原子（`COMPILE_KNOWN_ATOMS` 11→13）；容器归属闸（codex R1-F1 High：text-exact 全页唯一仍可能是同名非行控件——命中须在表格行/卡片双布局记录容器内，容器外硬阻断 fail-closed 不点；碰撞反例红跑实锤 exit 0 真点了按钮→修后 65）；身份闭环（夹具行名通路渲染被打开名 + `textVisible` 去前缀子串断身份——`atl_` 裸字面量被上条 lint 禁，其误伤面第一个实证）；flow-bridge 金牌三钉点例翻 `workflow.addNode` + prd-flow-bridge / prd-p5-replay 重签。codex 两轮 R2 PASS。机制缝递减序 3→1→0→1：零缝不是常态、暖场也暴露真闸。
5. 三问答卷（四路扫描审计，锚点见各契约）：① 移交——README 落地前对人类同事接近零入口，现八节自包含 + 三面漂移锁盯防再滞后；剩真机侧两项 route:human。② 计划对账——P0–P9 机制面全建（heal 唯一诚实桩），遗失项已由 plan-debt-sweep 兑现或显式 errata 记账；`casey run` 编排器起于相3、相0–2 前段接线属真机 bring-up 后契约。③ 飞轮——4→5 条（catalog_wf_crud / chiefcomplaint_smoke / wf_publish_states / wf_history_version / wf_open_smoke），覆盖 dom_crud / chat / 发布状态 / 弹窗 / 列表打开五路径；R9 坐标画布维度 23 条仍 blocked（画布原子无编译知识，现被两处金牌当天然反例用）；真机停站现三条 hermetic 半程，可一次行程合并。（画布 blocked 已由本 session `wf-add-node` 破首原子——见顶部当前状态。）

以下为本日早前时段快照（2026-07-06 晚：相0 建成 + hermetic 全链贯通 + 三面对齐——七相全建、首尾成链、三面同真），只溯源：

本 session 四契约六提交入 dev（Steven「把剩下的相都跑完」+「先继续做」+「先清目录，然后接着干」+ 三承重决策签核：D3 `source.kind` 必填 / D6 存 raw / D7 只当校验器）：相0 归一（最后一个未建相）建成 → 姊妹 CLI 回显缝收口 → hermetic「文本→报告」全链首次贯通为集成金牌 → CLI/MCP/skill 三面对齐现状。baton 空闲，下一契约直接 `contract init`：

1. `ingest`（相0 归一，full，`b7c8f61`）：`tests/_golden/schemas/testcase.schema.json` 冻结形态契约（draft-07、additionalProperties:false 处处、必填 schemaVersion/caseId/source.kind/steps/uniquePrefix；`uniquePrefix` `^\S+$` 封「纯空白过 compile 长度闸」缝、`preconditions` 数组形态是唯一守点——下游对非数组静默吞）+ `lib/parse-testcase.mjs`（手写闸与 schema 同刻——金牌 C4 从 schema 文件读必填集/enum 现场构造坏输入锁双源；语义闸 intentId 全局唯一 + caseId 一致；手写 JSON 数据投影器：不调 toJSON、own enumerable data、数组稠密 own、`Object.create(null)` 防 `__proto__` setter——校验对象=落盘对象按构造同一）+ `bin/ingest.mjs`（薄 CLI 镜像 flow-bridge：凭据门前置扫输入原文 exit 1 早于解析/回显/mkdir；输出通道三封——成功日志只回显定名产物、读失败只回显 errno、落盘异常捕获 65）+ `bin/casey.mjs` 接线（桩换 runNode + help 真实旗标 + 顺手补 flow-bridge help 行）。金牌 C1–C22（16 起红先行 14 败/2 过，评审期 +C17..C22 逐轮钉红）。codex 七轮 R7 PASS（12 发现 = 10 采信 + 2 修正采纳；R6 High：`JSON.parse` 建 `__proto__` own 键 + 投影赋值触发原型 setter——必填从原型链满足、落盘成空壳，经 CLI 候选文件端到端可达、红跑 exit 0 实锤）。产物 `testcase-<caseId>.json` 直喂相1，round-trip 金牌证相0→相1→compile gate 三段贯通。learn 六教训落 `docs/plans/ingest/learn.md`。
2. 挂账：① 姊妹 CLI 同族缝**已收口**——`caseid-echo-mask`（direct，`d3a5c11`）六处拒绝分支原值回显封缝（compile:267 / draft:40 / flow-bridge:31 / sign:87,90,91，哨兵三断言金牌红先行 0/6→6/6，codex 一轮 R1 PASS，五涟漪金牌零行为差）；余留全仓输出通道系统审计另立契约（prd-caseid-echo-mask observability）；② caseId 形态接缝张力——testcase `^[A-Za-z0-9_-]+$` 宽于 events `^tc_[a-z0-9_]+$`（记 prd-ingest observability，route:human）；③ `casey run` 编排器仍起于相3，相0–2 前段接线属后续契约（真机 compile bring-up 后才有意义）。
3. `e2e-chain`（light，`365c185`）：hermetic「文本→报告」全链首次贯通——十站集成金牌 `tests/_golden/e2e-chain.golden.mjs`（C1–C8）：候选文本(mock 归一)→ingest→flow-bridge(mock mapping 含 assert.* 原子)→compile gate→confirm 门(手编，p3 金牌先例)→execute(fake-sut + --skip-login + AT_SITE_JSON 合成隔离 + 凭据 env 毒化陷阱)→draft(+patch 补 nav 硬断言防 INDETERMINATE)→sign(CLI 真签面 + 最小 prd 夹具)→casey run→verdict 3 intent 全 PASS→报告三件。bring-up 首跑零集成缝（各相接缝纪律迟到红利）。codex 四轮 R4 PASS（15 发现全打金牌断言强度：11 采信——源头期望集 deepEq 钉死/参数双侧闭环/prd 回写 sha256 实算/cwd:tmp；2 修正采纳——真回放铁证钉 axes 取证轴（保存 POST 按步归因+信封 ok+轮询 null 归因+identityReadback）不改冻结夹具；2 证伪留案指认既有守点）。零 lib/bin 改动。链金牌 ~35s 不入 tier1、gate acceptance 位。
4. `cli-mcp-face`（light，`0d0d779`）：CLI/MCP/skill 三面对齐现状——① `bin/casey.mjs` 的 replay/verdict/report 分发桩换 `runNode` 直通（底层 bin 早已建成、run 编排内部直连在用；镜像五先例；heal 保持真桩）+ help 真实旗标；② `mcp/casey-server.mjs` 工具目录 6→12（新增相0–2 六工具、修 `casey_run` 为真 runPipeline 签名、verdict/report 去「诚实桩」误标）0.1.0→0.2.0、协议/传输零动、`TOOLS` 导出供金牌直测；③ `.claude/skills/casey/SKILL.md` 命令映射表逐行真实旗标 + 进度段改现状（立场段零动）。漂移锁金牌 `cli-mcp-face` C1–C7（工具名集/版本 deepEq、argv 映射表 12 工具全量旗标钉死含 camelCase→kebab 与布尔负形态、MCP 层 ingest happy 全管道真产物、九生命周期工具空参落真用法错码——`report` 用法错历史码 exit 2 如实标注、收敛另案挂账）。codex 两轮 R2 PASS（R1-F1 High 映射未真验→TOOLS 导出 argv 表 deepEq；R1-F2 修正采纳分层锁）。红先行 1过/4败；六涟漪金牌含 e2e-chain 全链复跑零行为差。
5. 端到端诚实交底更新：hermetic 机制面七相全建且首尾成链（集成金牌锁定）、CLI/MCP/skill 三面同真（漂移锁金牌盯防再滞后）；「文本用例→报告」真机端到端仍需一次真机 compile bring-up（ADR-0003）+ 相2 人签在场，全属 route:human（记 prd-e2e-chain observability）；相5 自愈不在链上（happy 链不触发，维持未吃过真场景交底）；`heal` 是 CLI 唯一诚实桩。

以下为本日早前时段快照（三相补齐：相2 sign + 相1 flow-bridge + 相3 video-login-carry），只溯源（其「相0 归一是唯一剩口/下一 session 地基」已由上条收口）：

本 session 续三契约三提交入 dev（Steven「三块全建」+ 规范嵌套 TestCase + sign 未签闸硬接 replay 前置闸），把「文本用例→报告」流水线前半段的两处 stub/缺口补成真机制。端到端唯一剩口 = 相0 归一 ingest（下一 session 地基）。baton 空闲，下一契约直接 `contract init`：

1. `sign`（相2 人签门，full，`2497309`）：`bin/sign.mjs` 草稿→冻结签署 CLI 建成（此前为 stub）——两段式 fail-closed 落盘（全 `.tmp` 后 rename，precheck 路径碰撞/原型键/目录副作用）、caseId 路径安全、冻结产物须 `.json` 非 events-/spec- 形态、prd.caseId 绑定、pending 非空默认拒（`--force` 写 sidecar）、expectedVerdict 仅 `--verdict-baseline` 且守 fail-safe 不变量、cred-gate 覆盖冻结+sidecar+prd+归档。`assertSignedContract` 未签前置闸硬接 `bin/replay.mjs`（Steven 两次确认硬接、含知悉约九件 golden 涟漪）+ caseId 绑定闸。codex 七轮 R7 PASS（落盘原子性边角：`.tmp` 派生碰撞 / 归档副作用 / 归档目录在 frozen.tmp 下）。金牌 `p2-sign` 23 检查。九涟漪 golden 经 `signExpected` 重签盖 signedAt/signedAgainstBuild/signerId + 各 prd testChecksums 重签。
2. `flow-bridge`（相1 LLM flow 草拟桥，full，`ef13787`）：补 compile「LLM 一次编译」链条唯一没落地的机制口——规范嵌套 TestCase + CLI 外 LLM mapping → compile 吃的 flow。`lib/flow-bridge.mjs`（buildFlow + validateBridge 三闸：投影忠实 / 编译知识允许集 / 复用 compile-gate.validateDraft）+ `bin/flow-bridge.mjs`（薄 CLI，cred-gate 输入前置早于校验回显与 mkdir、任一闸 exit 65 零落盘）+ `lib/compile-atoms.mjs` 加法（编译分派表 `Object.create(null)` 单一事实源、允许集由其键派生、`Object.hasOwn` own-key 判定）+ `bin/casey.mjs` 接线。codex 三轮 R3 PASS（R1 五含允许集非单一事实源 / route:human 通道太弱；R2 三含分派表原型链键绕过）。金牌 `flow-bridge` 16 检查。route:human 跳过须带 reason 留痕、不得又被 mapping 覆盖。
3. `video-login-carry`（相3 回放，full，`bb6f594`）：修回放舞步登录态 carry——loginBootstrap 后从 page1 采 sessionStorage 快照、page2 首 goto 前经 `addInitScript` 注入（带 origin 守卫、entries 数组防 `__proto__` 污染）；`login-sut` 夹具加 `/app-session` tab 级会话模式（随机三键、`close()` 等 `'close'` 事件保 capture flush 确定性）。codex 四轮 R4 PASS（R3-F1 capture 输出扫描竞态）。
4. `replay-video`（full，`f291c70`，上一 session 末收口、本次刷入 HANDOFF）：回放视频录制补上——`newContext({ recordVideo })` + 落 runDir + 报告接线 + 凭据卫生（视频不含登录期镜头）。兑现下方 07-03 快照第 5 条视频挂账——报告 `attachments.video` 槽不再永空。codex 五轮 R5 PASS。
5. 端到端可用性诚实交底（用户三问「cli/skill 能否直接输入用例产报告」）：hermetic 引擎（相3 回放→相4 裁定→相6 报告）跑通，`scripts/sample-report.mjs` 手写 spec 端到端产样例报告为证（`runs/sample-wf-publish/tc_wf_publish_sample.report.html`）；但「文本用例→spec」前半仍需一次真机 compile bring-up（ADR-0003，LLM 编译期真机跑产地面真值 + 补缺失原子飞轮），且相0 归一 ingest 尚未建（下一 session 地基：`lib/parse-testcase.mjs` + `tests/_golden/schemas/testcase.schema.json` + `bin/ingest.mjs`）。第三面是 MCP server、非 webui。

以下为 2026-07-03 时段快照（飞轮三/四 + 报告诊断），只溯源（其第 5 条视频挂账已由上「replay-video」收口）：

本 session 续三契约三提交全收口（Steven 点单「b再c再a」+ 选型/路线拍板），飞轮铺到三维度、机制缝递减假设终点验证，baton 空闲：

1. `wf-publish-states`（full，飞轮第三条 dom_crud 余量）：发布状态机×按钮态。`buttonState` 提硬（`IMPLEMENTED_KINDS` 10→11，present/absent 双 op）+ 词表收窄（`enabled`/`disabled` 挂账 `publish_blocked` 带实现回归）+ schema `assertionOp` +present 重签；`buttonHits` 双通道采集（role 必采 + `profile.buttons.extraSelector` 补采）+ `buttonSeen` 活性反证（absent 判真须通道活着，盲区证不出）；`workflow.publish` 编译知识；publish-sut 四场景对抗夹具。codex 两轮 R2 PASS（R1 两 High：absent role 盲区假绿 + 补采无可见性过滤）。涟漪四重钉（kinds-harden/chiefcomplaint/p4-drafter 未实现范例换 `switchState` + 精确计数移交前沿）。选型摸底纠错档：`echo_default_on` 实为画布维度（坐标拖拽 + `switchState`），`FLYWHEEL`/`CONTEXT` 已纠。`158ead2`。
2. `report-diagnostics`（light，P7 报告消费侧）：报告加「回放诊断」栏目——`renderReport(model, diagnostics)` 可选第二参（单参字节级零差异，`DIAG_CSS` 条件注入）+ `bin/report.mjs` 旁件旗标（缺席零行为差、坏件六形态 fail-closed）+ `casey run` 相6 接线；`run-metrics` 全局指标行（标注仅诊断不进裁定）+ `run-history` 按 `intentId` 嵌步卡 + 未归属小节。诊断标量 `://` 零容忍脱敏（路 B 绕过装配器脱敏，呈现层补防线）。codex 三轮 R3 PASS（R1 四发现 + R2 一发现：CSS 零行为差、旁件值走私绝对 URL、坏件语义枚举）。replyText 摘录挂账经侦察核销（`observed.replyText` + 断言 `actual` 两通道早已在渲染）+ U5 回归锁。`report-model` 与全部冻结 schema 零动。`7ca5fc6`。
3. `wf-history-version`（direct，飞轮第四条）：历史版本弹窗，零机制缝——机制缝递减 3→1→0 终点验证。两纯加法编译原子（`workflow.clickEditorButton` click / `workflow.closeDrawer` press Escape）+ publish-sut 夹具扩历史版本弹窗，断言全为已实现 kind（`textVisible`/`buttonState`/`textHidden`）。codex 三轮 R3 PASS（R1 三 High + R2 一残项：direct 不豁免评审深度——关闭效果没断、event shape 没全锁、断言 intent 挂靠没验）。共享夹具耦合当场捕获修复（历史版本钮走 `mk()` 保 divButtons role 全盲，wf-publish-states I3 涟漪重签）。`7ec2ff2`。
4. A 会话异常闭环机器可备部分就绪：`runs/tc_chiefcomplaint_smoke/run_1783054730282/defect-handoff.md` 已写（两笔缺陷单——① 智能体回复「会话异常」② 登录凭据走 GET query，各带现象/裁定依据/建议，零凭据值零目标地址）。剩余全 route:human：Steven 转交平台 → 修复后拉隧道复跑见绿。
5. 新挂账（本 session 用户三问揪出）：回放报告无视频根因 = `bin/replay.mjs` 的 `newContext()` 未启 `recordVideo`（报告 `attachments.video` 槽永空，非隧道问题）——补录视频是 P7/replay 加法契约候选。`cases/`/`runs/` 全 gitignored（凭据卫生），报告只在真机 `casey run` 后本地产；新两条 tc（`tc_wf_publish_states`/`tc_wf_history_version`）从未真机跑、无报告，四停站待 route:human。

以下为本日早前时段快照（七契约六提交，飞轮第二条真机贯通 + Casey 首个真机 `SUT_DEFECT`），只溯源：

1. `run-history`（light）六阶段收口：`casey run` 接回放历史/回放指标真产出——`bin/replay.mjs` 三 opt-in 旗标（`--run-history`/`--run-metrics`/`--run-id`，缺省行为一字不变），纯观察者逐 event 收集（零新增等待防污染取证归因窗）、与 axes 同刻过凭据门写出；编排器传 `runId`=目录名。codex 两轮 R2 PASS（R1 四发现：三采信含零事件空行真缺陷钉红修绿、一证伪留案）。`f3b0aa6`。
2. `chiefcomplaint-smoke`（full，飞轮第二条）hermetic 半程收口：`IMPLEMENTED_KINDS` 7→10（`replyContains`/`replyMatches`/`textHidden`）+ 流谓词普化（`profile.chat.streamUrlPattern` 命中或 legacy `/streamReply/` 兼容）；动态流等待两轮收紧（本步发起 且 命中对话流 URL 域才等——背景长流/本步附带非对话流都不拖步，40922ms 修前红实证）；keydown 触发垫（`fill`+Space+Backspace 三 event，冻结枚举内绕开 pressSequentially 缺位）；reply 双侧采集带陈迹基线（旧气泡绝不当新回复）；五原子编译知识（`nav.agentManagement`/`agent.searchOpen`/`agent.openTestPanel`/`chat.sendAndWait`/`chat.closeTestPanel`）；`chat-sut` 五场景对抗夹具（happy/error/stale/bgstream/leaky）。codex 三轮 R3 PASS + 审后微调 R4；`kinds-harden` golden 精确计数重钉（涟漪补冻：精确计数移交最新前沿 golden 持有）。`ab8587d` + `dcd48e3`。
3. `compile-caseid-shape`（direct）六阶段收口：caseId 穿越拒门（镜像 `draft.mjs` 先例，`x/../../evil` 真穿越 exit 0 双红实证）+ `urlPathname` matches 空正则封死（`chiefcomplaint` 评审挂账并批）。缺席推定记档、Steven 回场已追认。`69ab478`。
4. `chief-bringup`（direct，真机 bring-up 四修）：五只读探针定点四处假设差——`nav.agentManagement` 路由导航优先（`profile.routes.agentList` 接线；点击被 `hr-submenu`/spacer 拦 + 父 `li` 多匹配实证）；失败步不堆等（30s 级后置等待堆积曾撞死 120s 看门狗、连诊断不落）；消息框语义 `exact:false`（真名「请输入消息...」带省略号）；`agent.openTestPanel` networkidle 有界前置 + 点空重点采集自愈（间歇吞点实证；重点不产 event，回放期风险 fail-safe 兜）。真机编译零非 unique 步跑通。二手结论过时实证：真机 `fill` 即 enable（regress 的 keydown 判据已过时，垫无害保留）。`0ddd7b7`。
5. `cred-route-mask`（direct，Steven 拍板「源头打码」）：`maskCredentialRoute` 路径段打码（observed+axes 投影），凭据门零弱化（门配对机器证明：原样必拦/打码必过）；codex R1 High 挖出 axes 历史债（从无凭据门、query 可携凭据裸落盘）→ 落盘前补门拒写 exit 1 + leaky 场景退桩红。真机误伤原型 = 发送期应用自取临时凭据路由 `getTempTokenForApi`（路由名字面含 `token`）。`60e89d4`。
6. `login-traffic-drop`（direct，真泄露向量修复）：真机停站④两连门拦揪出 `GET doLogin` 凭据走 query → `loginMark` 切断登录期流量（CONTEXT「登录预备动作…不进 axes」字面兑现——此前只做到归因 null、记录本体经孤儿并入落盘）；axes 投影剥 host 只留 `pathname+search`（目标地址绝不进输出）；codex 三轮再挖三缝全采信（`blob:` pathname 内嵌 origin 穿透/代理型自嵌 `://`/`//host/x` 协议相对引用——非白名单形态一律 `<redacted:non-http-url>`）。`f0bd596`。
7. 真机四停站全走完（Steven 在场）：flow confirm（八步）→ `compile --execute` 零非 unique 步落四件套（10 events / 10 observed / 0 候选，打码痕迹在、零原始路由名）→ `casey draft` 骨架 + LLM 补缝 + `validateDraft` 闸 → Steven 人签 6 条全硬（`signedAgainstBuild=1.1.2`）→ `casey run` 端到端落七件 `runs/tc_chiefcomplaint_smoke/run_1783054730282`——`intent_3` `SUT_DEFECT`（有取证背书）：所签 `textHidden(会话异常)` 命中（被测智能体真回复「会话异常」四字，彩排两次+编译一次三次一致）+ `noErrorEnvelope` 坏信封同步翻红、流未见 finished，三路证据同源；其余四 intent 全 PASS、动作 10/10、`locatorHitRate`=1。回放历史/回放指标首次真机产出（`runId` 落章）。
8. 凭据卫生收口：历史落盘泄露（catalog 时代 axes 无门期，`doLogin` 带值 query 4 处）就地打码洗盘、终扫 49 件产物零凭据值（git 历史清白，`cases`/`runs` 从未入库）；`testcase` source 措辞消噪（`regress` 仓名后缀撞 `creds.user` 常见词，纯巧合零披露）。
9. 新挂账：平台侧缺陷上报两笔待 Steven 转交——① `doLogin` GET 凭据进 URL/服务端日志（安全面）；② 「互联网问诊-主诉」智能体回复「会话异常」（`run_1783054730282` 报告即证据）。回放期面板吞点观察（回放单击无采集自愈，fail-safe 兜底不假绿；真机回放若频发另起契约议回放器通用机制，动内核须 full）。

以下为昨日快照（2026-07-02 四续；其末条「直接下一步」已被顶部接管并全数完成），只溯源：

本 session 四续（2026-07-02 夜）：P3 收官后即启 P4——`p4-drafter`（full）六阶段全收口（Steven「开！」授权）：

1. G-seam 接缝对齐（GRILL 缺席推定取 A、可否决、列 prd observability 交人复核）：`expected-frozen.schema.json` 双 enum 加法对齐 `check.mjs` 权威表——`assertionKind` 12→15（补 `textHidden`/`buttonState`/`switchState`）+ **落地时新发现同接缝第二漏收** `assertionOp` 8→15（已收 kind 的法定 op `filled`/`finished`/`contains` 竟表达不了 = 潜在假拒）；`prd-seams-freeze` checksum 重签、其 gate 复验 GREEN 1/1。
2. `lib/assertion-draft.mjs`（新，纯函数零 LLM）：`synthesizeSkeleton`（D1 查表映射、观测/`urlIncludes` 双分支同剥实体 ID、未知原子落 `pending[]` 不发明）+ `validateDraft`（LLM 补缝准入闸：kind/op spawn `check.mjs --validate-only` 复核零副本表、易变字面量纪律盖全部字符串值不分 op、D2 soft 语义两向钉死、闸自身 total 全域返回不抛）+ `lib/replay-assert.mjs` 加性导出 `IMPLEMENTED_KINDS`（已实现集唯一供源）。LLM 补缝 prompt/schema 沿用 `proposed/llm-patch.draft.md`（CLI 外跑，同 P3 flow 范式）。
3. golden `tests/_golden/p4-drafter.golden.mjs` 13→20 检查（底稿承另一 session 预备轨、红先行）；gate GREEN 2/2 + seams/p5 回归锁 + tier1 全绿。codex 四轮 R1..R4：3→2→2→0 逐轮全采信钉红修绿（R3 有 High——闸未钉 D2 soft 语义，LLM 草稿可绕硬裁定/造假红），R4 PASS 零发现记 `loop/audit.jsonl`；learn 六教训落 `docs/plans/p4-drafter/learn.md`（接缝对齐查全伴生 enum / 缺席推定三要件 / 闸 total·纪律盖全通道·语义不变量在准入 / 覆盖独立性 / 收敛看 PASS 不看发现数 / 唯一事实源纪律）。
4. 相2 端到端首航已完成、真机 4/4 PASS（2026-07-02 夜，Steven 全程在场）：`tc_catalog_wf_crud` 真产物 → `synthesizeSkeleton` 骨架 + LLM 补缝（本 session Claude 依 `llm-patch.draft.md` 纪律出 3 条：列表路由硬断言 + 保存/删除 toast 两条 soft）→ `validateDraft` 闸 `ok:true` → Steven 人签冻结（7 条断言逐条盖 `signedAt`/`signedAgainstBuild=1.1.2`/`signerId=Steven`，`assertSignedContract` 核过，落 `cases/tc_catalog_wf_crud/expected.frozen.json`）→ 真机回放（`--login-bootstrap` 过登录墙、建删 `atl_r1`）→ 零 LLM `verdict` 出终判。首跑 3/4 步 `NEEDS_HUMAN(SUT_DEFECT_OR_STALE)`——首航当场挖出评估器夹具债：`noErrorEnvelope` 硬编码 `/saveOrModifyProcessData/`（p5 假 SUT 捷径，真机无该请求步必假败；fail-safe 方向全对无假绿）。
5. `noerrenv-absence`（light）六阶段全收口（Steven 批冻结翻转）：`noErrorEnvelope` 改缺席语义镜像 `noPageError`（本步归因无坏信封即过、零记录即过；坏信封归因本步必败方向不变）；p5 coverage golden 一条翻三向（红先行两红、双 prd 同步重签、双 gate GREEN）；codex 一轮 PASS 零发现记 audit；learn 四教训落 `docs/plans/noerrenv-absence/learn.md`（首航就是验收器 / fail-safe 即可诊断性 / 冻结翻转全流程可追溯 / `streamReplyReceived` 同味 URL 模式观察挂账）。修后首航重跑真机 4/4 PASS——「文本用例 → 人签断言 → 真机回放 → 零 LLM 终判」全链首次贯通。
6. 相6 真机报告已兑现（`run-login-passthrough` direct 契约）：`casey run` 相3 stage 透传 `--login-bootstrap`（4 行机械接线，同 `compile --verify` 先例）；C6 检查补进 replay-login-bootstrap golden（红先行）至 8 检查、checksum 补冻、gate GREEN、tier1 绿。真机全链跑通：`runs/tc_catalog_wf_crud/run_1783000971249/` 落 axes/verdict/report-model + `tc_catalog_wf_crud.report.{html,md,json}`——裁定概览「通过 4 · 缺陷 0 · 过程错误 0 · 待人裁决 0」，soft 断言如实标「不进裁定树」。「文本用例 → 人签断言 → 真机回放 → 零 LLM 裁定 → 自包含报告」完整愿景首次真机兑现。
7. 报告保真度打磨挂账（首份真报告体检，不阻断）：① 「期望版本：（未签）」——`report-model` 未接 `--expected`（layer3 评审 F8 延期项，现有真消费者，宜接线读签署字段）；② 期望值显示 `[redacted]`（脱敏口径偏宽，路径值非凭据）、实际值全 `null`（axes 未回填 actual，报告「期望对实际」栏目名存实亡）——下一小契约一并处理。
8. `report-fidelity`（light）六阶段全收口——首份真机报告三缺陷全修：① `bin/report-model.mjs` 加 `--expected` 签署投影（全签且联合均一才投影、`--case-meta` 显式优先、签署元组原子性——两字段全缺才整组投影/单缺仅显式半与 expected 元组吻合才补/不符一概不补），`casey run` 恒透传；② `redactScalar` 纯路径形态 token 转 `redactUrlPath` 逐段脱敏（修 `OPAQUE_BLOB` 32+ 长串对纯路径的整段误伤，凭据方向零放松、layer3 金丝雀全保）；③ `evaluateAssertions` 加性回填标量 `actual`（五口径 + 未实现恒 null，`ok` 判定一字不变）。golden 14 检查红先行；codex 三轮 R1 混签部分投影（High）/ R2 跨源拼合元组（High——case-meta 版本 + expected 签署人拼出两源都未背书的组合）逐轮采信钉红修绿 → R3 PASS 记 audit；learn 四教训落 `docs/plans/report-fidelity/learn.md`（防泄漏启发式配反向锁 / 收窄复用既有原语 / 元组语义三问 / actual 口径纪律）。真机重跑亲验：期望版本 `1.1.2`·路径成对可读·取证类计数在场，仍 4/4 PASS（`run_1783002166358`）。
9. G-seam 推定已获追认（Steven「追认」2026-07-02 深夜）：schema 双 enum 对齐转正式人签，`prd-p4-drafter` observability 该项核销、GRILL 已改记。
10. `draft-cli`（light）六阶段全收口：`casey draft` 上线（骨架+`--patch` 补缝合并+闸+落草稿，违规整份拒）；codex 两轮 R2 PASS（R1 四发现：三采信——caseId 缺席同拒/限形状防穿越/裸 `--patch` 拒；一修正采纳——凭据门退出码取 compile 先例 1，修 GRILL 措辞钉约定获 R2 认可）；learn 四教训（薄 CLI 是不可信输入第一道闸 / 一致性闸缺席分支 / 文件名标识符验形状 / 修正采纳第三种处置）。挂账：`compile.mjs` 有同型 caseId 拼文件名缝（顺手同修候选）。
11. `kinds-harden`（light）六阶段全收口——`textVisible`/`noErrorToast` 提硬（`IMPLEMENTED_KINDS` 5→7）：replay 代表步静默点现场采（toast 快照选择器逐字复刻 compile 观测采集 + `getByText`/toast 双通道命中计数），缺采集一律证不出；`noErrorToast` 词表判（`失败|错误|异常`，Steven 人签 G1；`actual` 携实采全文可纠错；结构类名收紧挂账 route:human）。三份冻结 golden「未实现范例」随 D2 生命周期翻转（范例换 `buttonState`/soft 翻硬，GRILL G2 清单红先行、各 prd 补冻、四 gate GREEN）；codex 一轮 PASS 零发现；learn 四教训（范例钉点会过期 / 新 kind 成本在采集 / 采集器同构纪律 / 词表判+全量证据回填）。`casey draft` 真用例重产草稿 7 条全硬（soft 0）——D2「补实现→重签提硬」首次真兑现。
12. 重签提硬完成（Steven「签」，2026-07-03）：7 条全硬断言重签冻结（新 `signedAt`，`expected.frozen.json` 覆盖首航版）→ 真机 `casey run` 重跑 4/4 PASS 零 soft（`run_1783008079114`）——报告「期望对实际」全对：`noErrorToast` 实际值携活采「保存成功」toast（词表判 + 全文可核）、`textVisible` 命中计数在场。D2 生命周期「未实现冻 soft → 补实现 → 重签提硬 → 全硬裁定」端到端走完，`kinds-harden` 的 route:human 主项核销（错误 toast 结构类名采样仍挂）。
13. 直接下一步：① `casey run` 接 `run-history`/`run-metrics` 真产出（旧挂账，编排器天然生产者）；② 第二条用例移植（`chiefcomplaint_smoke`，飞轮第二条）；③ `compile.mjs` caseId 形状同修（direct 小契约候选）；④ 未实现余 8 kind 按需加法（护栏 #17）。

以下为本日早前时段快照（P3 收官），只溯源：

本 session 三续（2026-07-02 晚）：P3 tier-2 真机 bring-up 下半场开局——三跑全通产真四件套 + 登录墙契约收口：

1. 三跑 `--execute`（`--unique-name c2`）真机全通：16 步全 `unique` 且 acted、零 blocker 零 `CASE_DEFECT` 候选；卡片布局计数对账恒等（目标卡片 1 :「删除」目标 1）放行删除段，`atl_c2` 建成→删除净场（末步 toast「删除成功」）；P4 交接面四件套（events / observed / testcase / compile-report）已落 `cases/tc_catalog_wf_crud/`（gitignored）。产物纪律亲验：信封 `authored:false`、16 步 URL 全走 `{{baseUrl}}` 占位符、requestLog 94 条全剥 query 且只落 pathname、75 条按 `initiator` 归因、背景轮询零误归因、`capturedAgainstBuild` 取不到落 `null`（fail-safe）。
2. 核验清单 ⑤⑦④③ + 计数对账（route:human）证据已呈：⑤ 抽屉确认 = role button「确认」count=1 / ⑦ 删除确认 = role button「确定」count=1 / ④ 描述 = label「工作流描述」count=1（此轮 role/label 采样非 0，五雷真机分支未触发即全 unique）/ ③ nav 直达豁免 / 计数对账恒等。Steven 选「先上真机看看」，签核待其过目后落（顺手清 `atl_c1` 残留——二跑遗留真机）。小瑕疵记档：requestLog 对 `data:image` URL 落整段 base64 载荷（纯噪音非泄漏，后续可折叠成 `data:<mime>`）。
3. `replay-login-bootstrap`（light）六阶段全收口——已知缺口「`--verify` 登录墙」hermetic 侧已解：方案分岔人签取「replay 登录预备动作」弃 storageState（AskUserQuestion，Steven）；`bin/replay.mjs` 加 opt-in `--login-bootstrap`（不产 event、不进 axes、凭据只进内存，前置/登录失败 exit 65 不落 axes，登录期 `currentStepId=null` 流量归 null）+ `compile --verify` 透传 + `loadCreds` 加 `AT_CREDS_FILE` env 覆盖（hermetic 凭据源隔离）；新夹具 `tests/fixtures/login-sut/server.mjs`（服务端 cookie 会话、登录标记只落布尔）；golden 7 检查红先行（C2/C3/C5 三红核实）；gate GREEN 2/2 + p5/p3 冻结 golden 回归全绿。codex 两轮：R1 FAIL 3 发现——F1 High 凭据字节经 `JSON.parse` 报错漏 stderr（实测坐实，消毒重抛 + C2b 钉死）/ F2 High 坏 `site.json` 静默回落默认（`loadSiteConfig` 加 `strict`，replay 开旗标 fail-closed + C2c 钉死）/ F3 尾斜杠证伪拒绝（`replay.mjs:56` 既有剥除）→ R2 PASS 零发现记 `loop/audit.jsonl`；learn 落 `docs/plans/replay-login-bootstrap/learn.md`（六教训：报错通道也是泄漏面 / 泄漏断言按片段抓 / 坏文件≠缺文件 / env 换路径隔离凭据源 / 假 SUT 会话服务端化 / 拒绝要带行号证据）。
4. 真机回放核验第二轮已过（WSL 侧，Steven 在场）：`compile --verify --login-bootstrap` 经隧道 → 登录预备动作真机首战成功 → 16 步动作轴全 `unique`（含建/删 `atl_r1` 全过身份门、删除净场），看门狗 75s 未触顶。同场反向实证：Windows 侧同命令失败（登录表单 15s 未现 → fail-closed exit 65、不落 axes、报错无凭据值）——防线行为全对；tier-2 真机命令一律 WSL 侧跑（G6 人签既定：Windows 上 127.0.0.1:15519 非设计路径、直连需把真目标地址写进命令行违护栏 #7、playwright 是 Linux 版）。
5. 直接下一步 = P3 tier-2 剩余 route:human：Steven 签核核验清单 ⑤⑦④③（其选「先上真机看看」，顺手清 `atl_c1` 残留）→ 重录 spike 录屏核销 ① → `capturedAgainstBuild` 来源确认 → 相2 断言草拟+冻结+人签（P4，零 baton 预备轨已推到「就差 accept+loop」：`docs/plans/p4-drafter/proposed/` 含 grill 决策 D1/D2 + plan + golden 红基线草稿（已验红、钉 `lib/assertion-draft.mjs` 的 `synthesizeSkeleton`/`validateDraft`）+ LLM 补缝 prompt/schema；落地前先过接缝硬门——`expected-frozen` schema 12 kind vs `check.mjs` 15 kind 须对齐，route:human）。
6. spike 录屏已重录（route:human ① 机器侧齐备、待 Steven 过目签核）：scratchpad 一次性脚本产 `cases/spike-rerecord/`（gitignored）——`spike-rerecord.webm`（371KB）+ 三截图（登录页空表单/列表页/搜索空态）；凭据红线加固：登录在无录屏 context 完成、登录态经内存 `storageState`+`sessionStorage` 种子移交录屏 context（SPA 令牌在 sessionStorage，`storageState` 不带、须手动移交——新教训），镜头零凭据输入过程；截图亲验中文全齐（字体修复实锤）。镜头顺带拍到 `atl_1782376478282_1` 残留卡片（待清理目标可视化）。只读流程零建删。
7. `capturedAgainstBuild` 采证完毕（route:human ⑥ 待 Steven 三选一）：全站唯一版本信号 = 登录页脚本标签 `api-config.js?v=1.1.2` 查询串（前端构建号，编译期可从入口 HTML 确定性提取）；页面 meta 仅 charset/viewport、`api-config.js` 正文无版本（仅三 API 前缀、无敏感）、`getAccountInfo` 无版本字段（仅租户/账号/visitKey 形状）。候选：A 用 `?v=` 查询串（接线改 `bin/compile.mjs` 属后续小契约）/ B 收下 null 人工填 / C 向 Heren 要版本接口。
8. 签核进展（2026-07-02 晚）：① 录屏签核通过（Steven「没有问题」）——route:human ① 核销，录屏不失真判据成立、G6「退 Windows」附带条件解除。**真机残留已清**（Steven 授权「删」）：scratchpad 脚本按删除段同款纪律执行——搜索隔离后卡片:删除目标 1:1 恒等才点、确认对话框唯一命中、删后复核归零净场，前后截图 `04/05-residue-*.png` 留证 `cases/spike-rerecord/`。随后两签落定（Steven，2026-07-02 晚）：**③ 核验清单 ⑤⑦④③ + 计数对账签核通过（「签」）**；⑥ 构建标识定案取「自动提取 `?v=` 查询串」（「同意」）——编译期从入口 HTML 的脚本 `src` 读前端发版号（如 1.1.2）填 `capturedAgainstBuild`、取不到照旧 null；接线（改 `bin/compile.mjs`）为后续小契约挂账、此前仍落 null。至此 P3 tier-2 六项 route:human 全清（①②③④⑤⑥），P3 里程碑整体收官（hermetic 六阶段 + 真机 bring-up 双侧完成，护栏 #16 的「人签真机」兑现）。下一站 = P4 断言草拟（相2）：另一 session 预备轨已到「就差 accept+loop」，前置接缝硬门 12 vs 15 kind 对齐（route:human）；baton 空闲留给其落地。
9. Windows 侧失败追诊（Steven 质询「fail-closed 真的没关系？」后补证）：连通与单资产两侧全通（登录页 200 / 资产 200，Windows 0.24s），败在真浏览器 SPA 渲染 15s 不完成——疑隧道连接池对 Windows 回环转发的并发/keep-alive 形态不补池（僵尸池家族）；其走的是「登录路径上表单必须出现」严格分支、最危险的 fail-open 分支被正确拒绝。按 G6 人签 Windows 非受支持跑侧，定性已知限制、不深追。顺带挖出的真缺口（backlog 小加法候选）：replay 登录预备动作失败只留 stderr、不落任何诊断产物——compile fail-closed 尚有诊断 compile-report 先例；宜补「失败也落登录诊断痕迹（不含凭据值）」，供 route:human 修雷有据。

以下为本日早前 session 快照（tier-2 上半场；其「直接下一步/已知缺口」已被顶部条目接管，只溯源）：

本 session 再续（2026-07-02 傍晚）：P3 tier-2 真机 bring-up 上半场（969ffbb + 第六雷收口一笔入 dev）——六项 route:human 走到半程：

1. 反向隧道全通：`scripts/wsl-reverse-listen.mjs` 加逐请求 Host 头重写（网关按虚拟主机路由，原 Host 落默认静态块致 API 405）+ keep-alive 状态机整请求单次写出（配合 Windows 代理首包捕获）；环回隔离自测三案（GET / POST 带 body / keep-alive 第二请求）钉绿；僵尸池根因定位——Windows 代理先于 WSL 监听器启动则池不补，重启即愈（启动顺序：先 WSL 后 Windows）；登录页经隧道 HTTP 200 / 38ms 热路径；新增 Windows 侧连通探针 `scripts/win-probe-target.mjs`（只出状态码、目标地址不回显，护栏 #7）。
2. spike（route:human ①）机器侧四向全过：真机登录 1.7s（顺验 login-bootstrap SPA 判据修正）、前台 XHR（queryProcess）按 `initiator` 归因到活动步、无活动步期 56 条流量零违例归 null、错误信封经隧道解析 14/14。录屏曾整片无中文——根因 WSL 零中文字体（headless 无字形可画，DOM/定位/断言不受影响），已装用户级 Noto Sans CJK 修复、登录页截图亲验中文齐；旧录屏作废、待重录人签。
3. `tc_catalog_wf_crud` 三件备齐（`cases/` 下 gitignored）：手写规范 TestCase（意图留痕四 intent）/ 通道剖面 profile.json（背景 denylist 4 条 app-shell 实采 + 信封 successField status/200 + `routes.workflowList`）/ flow 草稿过 compile-gate 闸并人 confirm（Steven，2026-07-02T16:09:22+08:00）。
4. 首跑 `--execute` 撞出真机五雷、fail-closed 诊断报告逐轮收敛后全修（969ffbb）：① 登录入口须 = `--sut` 基址 + site.json startUrl 路径段（裸基址根路径无登录表单，SPA 判据被误读为已登录 fail-open、后续全步 absent）；② `/ai-manager/process/list` 真机是 API 前缀（503）→ 列表路由按通道剖面正名做成 `profile.routes.workflowList` 可选覆盖（缺省 `ROUTE_LIST`、hermetic 行为不变，形状校验 fail-closed）；③ Heren 表单标签是 div 无程序化关联（getByLabel 必 0）→ form__item 容器锚定 fallbackCss（count=1 亲验），描述实名「工作流描述」；④ 分类下拉无 combobox 角色 → 线性化两击（回放 doSelect 只认 combobox；选项限定 `.hr-select__list:visible`——全局同名文本会撞列表页分类 tab 被抽屉遮罩拦点，亲验）；⑤ 抽屉 footer 与删除对话框是 div 按钮（role=button 采样必 0）→ 主按钮锚定 + 实采文本记 compile-report（route:human ⑤⑦ 证据位）。真机分支全部只在角色采样 0 命中时启用；hermetic golden 13/13 + p5/p7 回归锁 + tier1 全绿。
5. site.json 起草的 login 覆盖段真机命中 0（错草稿）已删，回落内置默认（真机逐字吻合）。
6. 二跑 `--execute`（2026-07-02 16:52）撞第六雷、修复已落并补冻：12 步全 `unique` 且 acted（五雷修复全兑现），但删除段计数对账不恒等（表格行=0、删除目标=1）fail-closed 截断——真机列表是卡片布局非表格（`.hr-table-row` 必 0）。修复：对账兼容表格/卡片双布局（`summarizeDeleteCountAudit`/`auditDeleteCount`，卡片按 `.hr-card--bordered` 含目标名计数，证不出仍截断）+ `observed` 的 `requestLog` 只落 pathname 不携 origin（护栏 #7 收紧）；golden 增 C3b 卡片对账 + C4b pathname 断言至 14 检查、checksum 补冻入 prd（护栏 #1 加法，先例同 p5 补冻 b0dcaff）、gate GREEN 2/2 复验、tier1 无回归。**注意真机残留**：二跑 create 段已成、删除被截断 → `atl_c1` 实体残留真机，三跑前先人工清掉或换 `--unique-name c2`。
7. 已知缺口（走核验段前必解）：`compile --verify` 直喂 `bin/replay.mjs`、无登录预备动作 → 真机必撞登录墙；方案（replay 可选登录预备动作 or storageState 移交）待定，涉回放器 CLI 面，建议 light 契约。
8. 直接下一步 = 三跑 `--execute`（卡片对账已修；先清 `atl_c1` 残留或换 `--unique-name c2`）→ 核验清单 ⑤⑦④③ + 计数对账 → 解 `--verify` 登录墙 → 回放核验第二轮 → P4 交接面四件套 → 重录 spike 录屏交人签核销 route:human ①。

以下为本日早前 session 快照（p3-compile 六阶段收口；其第 4 条「直接下一步」已被顶部傍晚条目接管半程，只溯源）：

本 session 续（2026-07-02 下午）：`p3-compile`（full）六阶段全收口（788bb2b/76d6ef5/5f721e2 三笔入 dev + 收口一笔）——P3 相1 编译命令化层落地：

1. grill：G1–G7 全数人签（G6 分岔三人签改选 C——events url 走 `{{baseUrl}}` 占位符 + `instantiate` 回填；其余照草稿倾向），机械决策与 7 项 route:human 挂账合并记 `docs/plans/p3-compile/proposed/GRILL.md`；「登录预备动作」登记 CONTEXT.md。
2. loop：`casey compile` 三段式 CLI（`compile-gate` 三闸+落 flow 人 confirm 门 / 以 `--testcase` 为不可变锚重验三闸+执行 / `--verify` 回放核验逐 event 扫）+ `lib/compile-atoms.mjs` 原子编译知识（拆 intent、分支线性化、入口可证缺席→`CASE_DEFECT` 候选不落步、断言原子折 intent 留痕、计数口径对账）+ `lib/login-bootstrap.mjs`（拷快照 autotester 登录件）+ `lib/cred-gate.mjs`（凭据门共享化+`token`/`cookie` 补强+非凭据键形状校验）+ `lib/atoms-registry.snapshot.json`（整表 60 原子带 `snapshotOf`）+ replay `{{baseUrl}}` 接线与 axes 加性 `eventActions`。hermetic golden 13 检查全绿（红先行）、gate GREEN 2/2、p5/p7/layer3/tier1 回归全绿。
3. review：codex 三轮 R1..R3 至 PASS（R1 六发现/R2 四发现逐轮采信去修各钉红 golden；R1-F5 修正采纳留案——「取消非凭据键跳过」违通道剖面接缝定义被否、改形状校验收紧；记 `loop/audit.jsonl`）。learn 落 `docs/plans/p3-compile/learn.md`。
4. 直接下一步 = P3 tier-2 真机 bring-up（六项 route:human 在 `prd-p3-compile.json` observability）：拉反向隧道 → spike（CDP 归因/录屏）→ 手写规范 TestCase + flow 草稿人 confirm → 真机编译 `tc_catalog_wf_crud` → 核验清单 ⑤⑦④③ + 计数对账 → 回放核验第二轮 → P4 交接面四件套落 `cases/`。需要人在场（Windows 侧拉隧道 + confirm 人签 + 真机建/删实体过目）。

以下为本日早前 session 快照（seams-freeze-v2 收口 + P3 备料，只溯源）：

本 session（2026-07-02）收口一批（827cebc/7c52114/a06c29c 三笔入 dev + 交接文档一笔随后提交，工作树随之干净）：

1. `seams-freeze-v2`（full）六阶段全收口——codex 异构评审十二轮 R1..R12 至 PASS（`loop/audit.jsonl` 有案）：R1 续钉 hard invariant 升 schema 层机制化（827cebc）；R5–R11 本 session 逐轮采信去修 26 条发现、红方向注入亲验 31 场景（7c52114）——指纹真算、SUT_DEFECT 证据背书链（至少一个证据指针→取证指针真信号非装饰→混合证据同锁→空串空壳封口，镜像 `verdict.mjs` 背书语义）、golden 校验器 fail-closed 全量兑现（与数据无关全量预扫 + 关键字值元校验 + `$ref` 悬空/null 子 schema/空组合数组全拒）、三凭据扫描器各带自测金丝雀（key 子串/value kv 提取/字段名字符串）、join 四重（driverId 双向/actionSpace 包含/channel 一致/call 全等）、run-metrics 聚合复算、locatorResolution×action 类别绑定。R9-F1 修正采纳留案：拒「SUT_DEFECT 必须失败断言」（违 ADR-0002，可仅由 5xx/pageerror/crash 背书），改钉证据指针。learn 落 `docs/plans/seams-freeze-v2/learn.md`。
2. `layer3-wiring`（light）六阶段全收口（上一 session 尾、b4985d9）——codex 七轮 R7 判 PASS 记 audit，装配器 fail-safe 硬化：verdict⋈axes 一致性门、join 双射、schema 自守、现实形状凭据脱敏；learn 落 `docs/plans/layer3-wiring/learn.md`。
3. P3 真机 bring-up 前置全解除（a06c29c）——备料三草稿（`docs/plans/p3-compile/proposed/`：`catalog_wf_crud` 重表达清单 7 步→4 intent/15 event、观测现状采集计划、grill 决策草稿 G1–G7，零 baton 子代理产出、全留人签、route:human 7 项）；凭据现场就位（`.auth/` 自 autotester 拷入 + site.json 起草，均 gitignored、内容不进任何输出）；WSL 直连站点不通（Windows 防火墙拦正向入站，亲验 Windows 通/WSL 不通）→ 反向隧道落地（`scripts/wsl-reverse-listen.mjs` + `scripts/win-reverse-agent.mjs` + 重拉 `scripts/win-forward-start.cmd`），登录页经隧道亲验 HTTP 200、site.json 记 `devProxyUrl`；UAT 不能真造 500（用户确认）→ `SUT_DEFECT` 场景改回放侧代理拦截注入（进 P3 grill 决策）。

以下为上一 session（2026-07-01 续）快照——其中 `layer3-wiring` 的 review 修复回合与残留项均已收口（见顶部 1/2），只溯源、勿据其判现状：

`layer3-wiring` 的 review 修复回合进行中（review 阶段未推进、活契约仍 review+learn 待）。codex 异构评审（`gpt-5.5`、只读、空 cwd 喂 stdin，护栏 #9）两轮都判 `FAIL`：

- 第 1 轮 9 发现（5 高 + 3 中 + 1 低），逐条核实全成立、采信去修：F1 缺陷单空证据 / F2 生命周期背书漏投 / F3 URL query 与信封值凭据泄漏 / F4 join 缺失静默假通过 / F5 无 schema 自守 / F6 未知 verdict 静默忽略 / F7 `!!` 掩盖输入损坏 / F8 未接 `--expected` / F9 缺参 exit 3 非 64。
- 已落工作树（**未提交**）：`lib/report-model.mjs` 装配器硬化（缺陷单背书与 `verdict.mjs` 同源含生命周期 pageerror/crash、找不到背书 fail-closed 抛、`url` 剥 query/hash、verdict/channel 枚举 + reason 一致性 + caseId + steps 非空 + 布尔 `ok`/`soft` 自守、verdict⋈axes 唯一 join）+ `bin/report-model.mjs`（F8 文档化取舍）+ `bin/casey.mjs`（F9 exit 64）+ 新 `tests/_golden/layer3-wiring-coverage.golden.mjs`（20 检查，红→绿严格核：先对未修装配器跑 17 红）+ `loop/prd-layer3-wiring.json`（加 testChecksum、加 story `s2-assembler-failsafe-coverage`）。`gate --prd prd-layer3-wiring` GREEN 2/2、原冻结 golden 2/2 仍绿、`selftest --tier1` 无回归。
- 第 2 轮复审：F2 / F4(主) / F6 / F7 / F9 **已闭合**；**残留待下轮收**：
  - F3 未闭合——`safeScalar` 只 redact 对象/数组，标量字符串 `errorEnvelope.actual`/`expected` 仍可原样搬 `token=…&email=…`（护栏 #7）；须对标量值也脱敏/摘要。
  - F5 未闭合——残余非法产物路径：`meta.passes` 非布尔 / `meta.title` 非字符串 / `generatedAt` 未验 date-time / `events.action` 为对象→`action.kind` 对象 / `network.status` 非整数 / `errorEnvelope.field` 缺失或非字符串。
  - 新语义洞——`buildDefectTicket` 无失败硬断言时无条件合成 `actionPerformed` 断言，未校验上游确有 `ap===false`；若 `SUT_DEFECT` 仅由 5xx/pageerror/crash 背书且动作实已执行，会造无证据的失败断言（违「只读消费者」精神）。须先验动作轴再决定是否合成。
  - F4 提醒——装配器拒 `stepId:null` 而 report schema 允许 null；实操 replay 恒 `atstep_i` 非 null、暂无误伤，收残留时一并确认是否放宽。
  - F8 codex 认可作 P3 范围延期（非代码闭合）。

（上段「下轮首要」已完成：codex 续评至 R7 判 PASS、随 b4985d9 收口，见顶部本 session 2。）

上一 session（2 提交 `f41e527`→`a7ab5e9` 全入 dev）：

1. `seams-freeze-v2`（full）四接缝冻结已完成——借鉴接缝 v2 增冻（`run-history`/`action-vocabulary`/`failure-ledger`/`channelDriver`）：grill 收口（承重决策 1.1/2.2/3.3 人签 + 7 机械决策，合并记录 `docs/plans/seams-freeze-v2/proposed/GRILL.md`）→ plan → accept → loop，gate GREEN，9 文件 checksum 冻入 `prd-seams-freeze-v2`，`CONTEXT.md` 登记 6 术语（动作词汇表/通道驱动/回放历史/失败记录台账/失败指纹/人裁决回填），tier-1 无回归。承重决策 2.2 人签把 `channelDriver` 从后置接缝拉进本轮、范围扩到四接缝。（本条快照的「review + learn 待」已于 2026-07-02 十二轮收口，见顶部本 session 1。）
2. `layer3-wiring`（light）第 3 层集成 hermetic 骨架已建成——补上 `verdict→report` 唯一断链：新建 `lib/report-model.mjs` 报表模型装配器（verdict ⋈ 三轴 ⋈ 观测现状 ⋈ 冻结契约 → report-model，符合已冻 schema、缺陷单仅 SUT_DEFECT）+ 薄 CLI `bin/report-model.mjs` + `casey run` 编排器（串 相3→相4→装配→相6，`runs/<caseId>/<runId>/` 布局 + 退出码归一 fail-closed）；hermetic 端到端 golden 假 SUT × 2 场景（happy→PASS / inject500→SUT_DEFECT）2/2 绿、红→绿严格核实（stash impl 退桩红），gate GREEN、tier-1 无回归。确定性尾段（相3-6）现对合成数据端到端跑通。（本条快照的「review+learn 待」已收口六阶段全 done，见顶部本 session 2。）真数据端到端 = P3 之后的直接下一步。

以下为前两 session（2026-07-01 跨两 session）开发流程兜底 + 收口一批（6 提交 `9a9ff03`→`9c5e4cf` 全入 dev）：

1. 模型分层升级——`loop/config.json` 改 Opus 4.8 ultracode 主环 + Sonnet 5 max subagent 轻车道 + 三级兜底梯（详见「锁定的决策」2026-07-01 条）。
2. `term-guard` 契约（统一语言强制兜底，6 阶段全绿）：甲 `bin/term-guard.mjs`（零 LLM 拦 R3 比喻格式 / R6 加粗未登记英文与弃用别名，引用豁免只认反引号）+ 乙 `bin/term-judge.mjs`（语义评分员，待非 Claude 密钥）；codex 九轮异构评审 pass；Stop 钩子 warn-only 接线（不改 loop-kit）。
3. `model-lane-guard` 契约（模型分层强制兜底，6 阶段收口）：I1 `bin/verdict-purity-guard.mjs`（静态扫 `verdict.mjs` 依赖闭包无 LLM/网络客户端，接入 `casey selftest --tier1`，护栏 #15）+ I2 `bin/config-lane-guard.mjs` + `.claude/settings.json` 独立 PostToolUse 钩子（断言 config 异构不塌同族，护栏 #9）；codex 四轮异构评审 6→5→2→0 收敛，逐轮钉红 golden 硬化（全局 fetch/注释插入/目录 index/minified import/未映射族 fail-closed/路径穿越+软链）。**两条不变量从文档策略变成机制强制，守卫已上线。**
4. `hermetic-gap-freeze`（direct）：两份缺口 coverage golden 补冻——P7 credentialGate（护栏 #7 落盘前拒写）入 `prd-p7-report`、P6 nextStatus superseded 状态边入 `prd-p6-selfheal`，gate 各 2/2。
5. `p5-replay` learn 收口——P5 回放核心契约 6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；tier-2 真机 route:human 仍未走。
6. `seams-freeze-v2`（full）grill 当时进行中——现已四接缝冻结完成、见本节顶「本 session」1（本条为前 session 快照、只溯源勿据其判现状）。

以下 P5 与排期为 2026-06-30 快照（★注意：其中 P5 的 review/learn 已在最近一 session 收口、6 阶段全 done，见「当前状态」与「契约 / 运维」；本段只溯源、勿据其中「待跑」字样判现状）：

排期 v2（接缝优先并行）落地 → 第1层接缝冻结完成 → 第2层全部落地：P5 回放内核（★最后一轨）loop 绿——真 chromium 回放假 SUT（被测系统）→ 三轴 → 喂已冻 `verdict.mjs` → 四态全中（golden 10/10）。`casey selftest --tier1` 无回归。P5 review（异构评审）+ learn 后续已收口（本句为 2026-06-30 快照，收口详见「当前状态」）；tier-2 真机 route:human 未走（gate 绿 != 完成，护栏 #16）。排期 v3 见 `docs/plans/roadmap-parallel.md` 文末（2026-06-30 重排）。

里程碑进度：

- P2 裁判内核（`p2-intent-compile`）：loop 绿 + review 收口（真异构 codex 评审 7 修复 + 三镜头核验，见下「异构评审」「真异构评审」节）。learn 未走。
- 排期 v2：`docs/plans/roadmap-parallel.md` —— 接缝优先、运行时依赖 != 开发顺序、P3 不在关键路径、冻接缝后 P4/P5/P6/P7 全可并行（机理同 P2 对合成 fixture 跑 hermetic）。
- 第1层接缝冻结（契约 `seams-freeze`，gate 1/1）：5 条接缝 schema + 合成 fixture（events / observed-reality / report-model / drift-patch / expected-frozen）+ `prd.schema` v2（向后兼容 v1），落 `tests/_golden/schemas/` + `tests/_golden/fixtures/seams/`，golden `tests/_golden/seams-freeze.golden.mjs`。3 决定：冻结 expected[] 走旁车 `expected.frozen.json`（护栏 #5）、`expectedVerdict` 命名、`assertionOp` 封闭 enum。
- 第2层（并行 worktree 建 → 合并 dev → 各 gate 亲验绿）：
  - track-F（`p2-failsafe-coverage`）：C1-C4 + B1-B6/A1 回归锁 golden 3 个（`tests/_golden/p2-*-coverage.golden.mjs`），把真异构评审延后项锁死。
  - P7（`p7-report`）：`lib/report.mjs` + `bin/report.mjs` 报告渲染器（report-model → HTML/Markdown/json，多态徽章 + 缺陷单仅 SUT_DEFECT + 期望对实际 + 凭据兜底门）。
  - P4（`p4-freeze`）：`lib/expected-compile.mjs`（expected.frozen → check 命令）+ `lib/sign-gate.mjs`（人签字段校验）确定性骨架。
  - P6（`p6-selfheal`）：`lib/heal-gate.mjs`（准入门只对 HARNESS_ERROR）+ `lib/drift-patch.mjs`（非就地补丁、签名 before===after 等值、人签后才 apply）。
- P5（`p5-replay`，full lane）：loop 绿（2026-06-30）。Phase 0+1（环境 + 假 SUT + 红 golden）+ Phase 2 实现全落：`bin/replay.mjs` 回放器 + `lib/{replay-actions,replay-forensics,replay-assert,drift-probe,instantiate}.mjs`——真 chromium 回放假 SUT，按 intentId 聚合事件依序回放、过点击身份门出动作轴、CDP 真发起方归因出取证轴（背景 401 归 null 不背书，非时间窗）、按 expected 评估出断言轴，三轴写 axes.json 喂已冻 `verdict.mjs`；只读漂移探针 `findEquivalentAffordance` 从 atom+targetName 构造 canonical 查 count===1（不点不改 spec）。golden `p5-replay.golden.mjs` 10/10 全绿（四态映射 `verdict-cases` 八案 + drift/vanished 复刻 `drift-patch` canonical）。accept 前修法发现并修掉一个冻结夹具缺陷：进程内假 SUT 被同步 `execFileSync(replay)` 冻住事件循环、答不了 replay 浏览器（goto 卡死、之前误判 21 分钟「挂死」），改 `server.mjs` 把假 SUT fork 出独立进程（8 态行为一字未改）→ server.mjs checksum 重签入 prd、accept 重签、gate GREEN。runner 是 `verdict.mjs` 上游产出者、绝不在回放进程内裁定（护栏 #15）。（本条为 2026-06-30 快照；review 异构评审 + learn 后续已收口，见「P5 回放异构评审收口」与「当前状态」。）

## 实现产物（live）

| Story | 文件 | 要点 |
|---|---|---|
| S1 裁判内核 | `bin/verdict.mjs` | §4.2 判定树、零 LLM、按断言种类不可知、断言续跑、取证按本步归因、入参 fail-closed |
| | `lib/forensics.mjs` | `checkErrorEnvelope` 信封成功字段参数化；缺配置 fail-closed |
| | `bin/check.mjs` | 断言词表/op 硬闸，`--validate-only`；断言 kind 枚举唯一活在此处 |
| S2 编译门 | `lib/compile-gate.mjs` | 移植 regress `_flow-authoring` 双闸 + 前缀从 `uniquePrefix` 注入；空/缺 prefix 拒绝放行 |
| S3 对账 | design §2.1 / bootstrap plan | 加 `noErrorToast`、信封参数化、`countChange equals 0` 例外；P3 recorder 降级「陌生站点孵化」 |
| S1 回放器 (P5) | `bin/replay.mjs` | 回放假 SUT 产三轴 axes、编排 + 看门狗（绝不挂死）+ 强制退出；裁判零 LLM（只产事实不裁定，护栏 #15）|
| | `lib/replay-actions.mjs` | 语义定位器 + 点击身份门（unique/fallback_first/none）；守卫不抛、动作失败翻译成轴信号交 verdict |
| | `lib/replay-forensics.mjs` | `watchNetworkForensics`：CDP 真发起方归因、背景 denylist 归 null、错误信封复用 `forensics.checkErrorEnvelope`、SSE `finished` 静默点；getResponseBody 套超时防挂死 |
| | `lib/replay-assert.mjs` | 断言轴评估（typed kind 算 ok，verdict 对 kind 不可知，护栏 #17）；未实现 kind 一律 ok:false（fail-safe）|
| | `lib/drift-probe.mjs` | 只读漂移探针 `findEquivalentAffordance`（同稳定签名 count===1，不点不改 spec，拆 P5/P6 循环依赖）|
| | `lib/instantiate.mjs` | 占位符回填（冻占位符不冻一次性值，护栏 #6）|

配套设计落档：
- `docs/design/report-spec.md` —— 最终报告规格（拆分布局 + HTML/Markdown/json + 多态裁定，反向约束 `verdict.json` 字段）。
- `docs/plans/p2-intent-compile/flywheel-schedule.md` —— 飞轮排期表（五维全加法、第二条移植 `chiefcomplaint_smoke`、23 条 R9 坐标 flow 标 route:human）。
- 交互 demo（演示壳、合成数据，HTML + Markdown 双视图）：`M:\home\liufei\casey-report-demo.html`。

## 异构评审（Claude 侧，2026-06-29）

5 镜头对抗评审 + 逐条核验：26 发现 / 18 确认。3 条 major + 一串防御性 minor，全是 fail-safe 反向不变量缺口（当时 latent，P5 回放未建故未触发）。已**不动冻结测试**修掉，gate 仍 GREEN：

- 生命周期取证（crash / pageerror）改为按本步归因（原来全局信号会翻任意步的 verdict）。
- 缺失 action 轴不再误判成 actionPerformed=true（防畸形步假 PASS）。
- 无硬断言不静默 PASS、缺 stepId 不假命中、`verdict.mjs` 入参 fail-closed。
- 编译门空/缺 prefix 拒绝放行（原来 `startsWith('')` 恒真把破坏性硬闸静默清零）。
- 信封缺配置返回 ok:false、不默认放行。

延后项（不静默丢，留后续 acceptance-gate / design 对账）：
- 冻结 golden 边界覆盖缺口：`atom` 卷回未断言、空 prefix 无 case、CASE_DEFECT 分支无 case —— 改 golden 触 ratchet，须走契约更新补冻。
- design §6 把「带期望对实际」的 `verdict.json` 与 `verdict.mjs` 最小输出混名、`passes` 归属错挂；§4.2/§9.1 取证记录缺 `attributedStepId` —— 留 design 对账（`report-spec` §7 已记）。

## 真异构评审（codex 侧，2026-06-29）

补上「非同族」这一环（护栏 #9：只喂 spec+diff+门禁证据，不喂实现者叙事）。codex 实际模型 gpt-5.5、xhigh 推理、只读。Windows 只读沙箱起不了进程（CreateProcessWithLogonW 267、七次重试全败、首轮交白卷），改把评审包 inline 进 stdin、明令不跑 shell 绕过；评审包在 `scratchpad/codex-review/`。11 条发现，分诊后 7 条落 impl（fail-safe hardening，不动冻结 golden、gate 仍 GREEN）：

- B4/B5（最关键）：破坏性前缀硬闸原裹在 `checkStateMachine` 里、只在 `registry.states` 存在时跑 —— 无 states 注册表会整条绕过，空/缺实体名旧版静默放行。抽成独立 `checkDestructivePrefix`，不依赖 states、空名 fail-closed。
- B1：`soft` 仅 `=== true` 才不进裁定树（非布尔 truthy 不再静默降级失败硬断言）。
- B2：`HARNESS_ERROR` 须 `resolution==='none'` 正向 miss 证据 + 漂移探针，缺则落 fail-safe（护栏 #13，防真缺陷被误当可自愈）。
- B3：`verdict` 入参 `steps` 非数组/空 → exit 65（不再静默写空 verdict）。
- B6：信封缺 `successValue`、body 缺字段、空白字段名 → 一律 `ok:false`（堵 `undefined===undefined` 假判）。
- A1：`successField` 命中凭据字段名 denylist → 不读不回传值（护栏 #7 落到代码）。

经验证：13 探针全过（含反向不误伤：真漂移仍 `HARNESS_ERROR`、合法前缀仍放行、正常信封仍 `ok:true`）；三镜头对抗核验（回归 / 新 fail-open / 护栏，run `wf_317cbbc4-fb6`）全 sound、0 真问题。评审取证留 `loop/audit.jsonl`（review/pass 记录）。

延后项进展（新增独立回归锁 golden、不动冻结测试，详见下方「P5 回放异构评审收口」）：
- **已补冻**（`tests/_golden/p5-replay-coverage.golden.mjs`，commit b0dcaff，gate GREEN 2/2）：
  - C1 全闭：合成 StepAxes 喂已冻 `verdict.mjs`——「硬断言失败 + 500 归因别步/背景归 null → 非 SUT_DEFECT（落 SUT_DEFECT_OR_STALE）」对「归因对齐本步 → SUT_DEFECT」的辨别 case 已钉。
  - C2 的 pageerror 半边：pageerror 归因本步 → SUT_DEFECT、归因别步 → 不背书本步（非全局布尔）已钉。
- **仍待钉**（下轮 acceptance-gate，多属 verdict/forensics 配置层、非 P5 回放）：
  - C2 余项：crash 背书分支、缺 stepId 不背书。
  - C3：空 / 缺 prefix + 空实体名破坏性硬闸，无 case。
  - C4：信封坏配置（缺 successValue / 空白字段名）+ 敏感字段 denylist，无 case。
  - B1（非布尔 soft）、B2（缺 miss 证据不自愈）、B3（steps 非数组/空 fail-closed）三条分支。

## P5 回放异构评审收口（codex 侧，2026-06-30）

P5 回放内核 loop 绿后接异构评审（与上节 P2/verdict 评审不同轮）。codex（gpt-5.5 真非同族、xhigh、只读、空 cwd 喂 stdin，护栏 #9）判 FAIL、10 发现（5 High + 4 Medium + 1 Low），逐条核实全成立、全修（commit b982171，改 lib/bin 不动冻结 golden；仅 `server.mjs` 的 L10 改动重签 checksum）。最严重 H3：唯一元素 click/fill/goto 抛错被吞却仍谎报 `actionPerformed=true`（同族自建漏掉的 fail-open）。要点修复：动作轴改诚实（失败落 `action_failed`→verdict INDETERMINATE；多匹配绝不点击；统一身份门 count===1 才 unique）、取证归因收紧到动作因果作用域（预导航期 `currentStepId=null`，非时间窗）、pageerror 按步归因不全局污染、网络背书归一到代表步对齐 verdict、断言证不出一律 ok:false、drain 先等在途前台 API。golden p5-replay 10/10 复绿 + selftest tier1 无回归 + gate GREEN。

收口补冻（commit b0dcaff）：上述 fail-safe 不变量的失败方向 p5-replay.golden 不覆盖，新增 `tests/_golden/p5-replay-coverage.golden.mjs`（13 检查）作回归锁、并入 prd-p5-replay（testChecksums + story `s2-failsafe-coverage`，ratchet 只增不减=护栏 #1 允许）。锁两层：断言轴证不出/未实现 kind→ok:false（含正反两向防恒-false 假绿）+ 合成 StepAxes 喂已冻 verdict.mjs 验四态归因。gate GREEN 2/2、passes 由 gate 写。P5 流水线截至本节（2026-06-30）grill→plan→accept→loop→review done；learn 于最近一 session 收口、6 阶段全 done（见「当前状态」）。

## 锁定的决策（2026-06-29）

### 示教可回放闭包新增纪律（2026-07-28，已锁）

- 同一次录制的 exact capture bytes 是 cycle 唯一身份根：admission、source events、pairId 与
  source/authoring/distilled namespace 必须绑定同一份最终字节，绝不以放宽 hash 门兼容跨录制计划。
- 默认路径是“录制落盘→同进程生成 cycle input→交 live owner”；旧 `cycle-plan` 只可作
  mapping/expected 模板，不再拥有 capture 身份真值。
- deterministic first：已知 read-only recipe 直接执行；模糊意图、未知 atom、pending、popup、
  mutation、runtime entity 统一转 grill/人工 mapping/示教，不允许 LLM 绕过已有 deterministic 门。
- 手动示教的完成标准是原始 fresh 回放成功、蒸馏/分解 atom 后第二 fresh 回放成功、确定性语义等价；
  任一缺失都不能沉淀为新能力。
- `CLEAN`、`REPRODUCED`、`EQUIVALENT` 恒为 developmentOnly 技术证据，不得冒充正式 `PASS`；
  正式完成仍需相2人签、真实 replay/verdict/report、真机 UAT 与 Steven 验收。

- **岔一**（已锁）：轴通用 = 实现纪律，不是预留字段。`verdict.mjs` 按断言种类不可知、kind 枚举只在 `check.mjs`，新维度纯加法；流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。已落护栏第十七条。
- **质量接口**（已锁）：「内容好不好」走独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。
- **岔二**（已采纳）：压裁判保守分支最便宜的办法是先在 catalog 上多注合成故障（漂移→HARNESS_ERROR、元素消失→AFFORDANCE_ABSENT、真数据多匹配→ambiguous），再移植第二条 `chiefcomplaint_smoke`。
- **岔三**（已采纳）：第一条走 `full`；之后辐条默认轻车道（跳 grill、保留 plan+accept+loop），碰冻结内核才升 `full`；`accept` 任何车道都不跳。
- 全文：`docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。

### 本 session 新增纪律（2026-07-07 下午—晚，已锁）

- **真机人签契约走扁平每用例契约文件**（已锁）：真机人签走 `loop/prd-tc_<caseId>.json`（schemaVersion 2、`caseId` + 空 `stories`），sign 写 `expectedFrozenPath` + `testChecksums[expected.frozen.json]`——与金牌契约 prd（冻 golden）是两类 prd、勿混。sign 对已存在 frozen 拒覆写、须显式 `--resign`。
- **输出通道封缝：定位字段一律结构性下标**（已锁，output-seal codex 连三条同型实证）：报错为「可诊断」保留的定位串（intentId / verdict-baseline 键名 / where）本身是文件侧输入，`SAFE_ID` 挡不住字母数字种子——遮值之外，定位一律换数组下标（`intents[i].expected[j]` / `verdict-baseline entries[i]`）。校验前的字段（kind/op/verdict 在闭合词表校验之前）是任意文件值须遮、校验后已是枚举值可留。凭据门只扫落盘产物，stderr/CLI 回显在扫描面外——die/console 的用户可控插值是主泄漏面。
- **异构评审归属可反转**（已锁，wf-connect-nodes 首例）：异构铁律是「实现方≠评审方」不是「永远用 codex」。
  当实现方本身是 codex（并发 session 写的），送 codex 就是同族自评——反转由 Claude 侧评。[[review-uses-codex]]
  的「用 codex」是「Claude 实现→codex 评」常态投影,遇实现方反转以「绝不同族自评」为准绳。价值实锤:起草
  Claude 子代理揪出 codex 的 F1/F2 健壮性缝（同族评审大概率漏——自己写的代码对自己立的规矩视而不见）。
- **并发会话共享工作树治理**（已锁）:另一 `session` 做 lib/bin 改动而不走契约 + 不重签,是可预见治理缺口
  (test 级绿 ≠ gate 级绿:golden 改了 checksum 漂移、gate 必红,护栏 #16)。收口方须:① checksum 漂移全扫
  (不只跑 test)② 补契约台账 ③ 补覆盖缺口 ④ 异构评审(可能反转)。摸清并发是否停手用双照 checksum。
- **示教兜底三决策**（`teach-in`，Steven 已定，第一契约已落）：手动录制退化机制正式命名「示教」（工业机器人示教再现血缘，autotester 内核即示教）；录制物是语料不是签署（录不算签，蒸馏产物必经 L0 复核 + 相2 人签门）；不开「录制物直通回放」通道（只当蒸馏语料，回放仍走正道七相）。命名已登记 CONTEXT.md；三环已全落——`record-capture`（`bb0ee3c`）+ `record-intake`（`46ae7a3`）+ `record-distill`（`4bce3a5`，均 2026-07-09 收口，见「当前状态」）。

### 本 session 新增纪律（2026-07-08 下午—晚，已锁）

- **异构冗余评审工具实操 + 全断兜底**（已锁，`heterogeneous-review-tooling` 记忆）：跨族异构冗余评审首选 codex——`codex exec --skip-git-repo-check -C $(mktemp -d) - < 评审料.md`（空 cwd 喂 stdin、评审料含 spec+diff+证据不含实现者推理）。deepseek 兜底需 `~/.loop-kit/config.json` 的 `deepseekKey`（本机常无）；pi（pi.dev coding agent、Windows npm 全局）从本 WSL shell 驱动不了（cli.js 载入即挂、`--version` 都不出、无 TTY），别浪费时间试非交互驱动。跨族全断时（codex 撞额度 / deepseek 未配 / pi 驱不动）走 config 末位同族兜底（Claude 子代理 ×2 fresh 对抗镜头），但 audit 必须明标「同族末位、非跨族」+ 信任非对称 + 跨族正式复审挂账，绝不冒充跨族、绝不静默标 done；codex 额度到点重置、挂账的跨族复审工具可达后补（report-workflow-structure 即此路径）。
- **缺字段零行为差是加法碰冻结渲染核的护身符**（已锁）：报告块加法用 `'field' in model` / 非空数组判定——缺字段旧模型/共享 fixture 字节不变，既有 report 涟漪金牌（定向断言、非全量 deepEq）自动免疫，不必动共享 `report-model.fixture.json`、涟漪只剩一处 schema checksum（碰本契约 + prd-seams-freeze 双 prd 重签）。本 session 五报告增量全靠此不动共享 fixture。
- spec 超前于码的诚实生命周期（已锁，report-spec errata）：spec 加了码没落地的需求 → 先进「目标态、尚未实现」对账表（诚实记账、不静默声称）→ 增量实现（各自六阶段契约）→ 实现后从对账表 un-errata（文档双向诚实、别反向撒谎说未实现）。
- **金牌反复栽在「含子串 ≠ 形态正确」**（累积教训，codex 连轮揪、末位同族亦揪）：位置类不变量用 index 比对（相对顺序）、枚举类两向验（在场 + 缺席）、逐元素形态、诚实文案冻结（不称「完整」须披露收缩），都强于 `includes(子串)`——断言要能抓住「反着实现也绿」的回归。

### 本 session 新增纪律（2026-07-09，已锁）

- 并行开发经 worktree、不建共享池（已锁，worktree-baton）：碰 `lib`/`bin` 的多契约真并行落地走 git worktree 隔离——每树各一独立 baton（`active-contract.json` 与熔断态 gitignored、每树一份不共享），实证零机制改动即 N 路并行。`contract worktree <slug>` 起树 + `contract list` 跨树总览；slug 全局唯一（防同名骑另一 baton 的 gate-绿覆盖冻结断言）；各树自绿后 git-native 合并回 `dev`、绝不 `cp` 进 `lib`/`bin`；建议并发 ≤5 树；每树 loop 前自己 `breaker --reset`。**否决共享池**（`loop/active/` + `LOOP_CONTRACT_FILE` 选槽 + `breaker --state`）：那是「多 session 挤同一 checkout」的解、背离 worktree，设计红队判 1 High（`breaker --state` 路径注入覆盖冻结 PRD）+ 4 Med。roadmap v3 §三「解锁真多轨落地的前提（暂不投 `LOOP_CONTRACT_FILE` 参数化 + `breaker --state`）」已被 worktree 原生隔离绕过解决（§二「真天花板：单活契约 baton」随之破）——下方 337 单 baton 教训已被此取代。落护栏 #18，见记忆 [[worktree-baton-parallel-dev]]。
- codex 逐轮深挖路径安全边角（累积教训，worktree-baton F1 五轮）：`--path`/落点 containment 这类路径洞，词法 `relative` 判定远不够——软链父目录别名指回仓内、`..name` 仓内名被 `startsWith('..')` 误判外部、缺失中间目录、lexical-`..` 跨软链，逐个是坑。收口靠三件：真实路径投影（`realpath` 上溯真实祖先再拼不存在后缀）+ 正确 containment 谓词（只 `rel==='..'` 或 `../` 前缀算外部）+ guard 检查路径 == 实际执行路径 canonical 单点（消除 guard≠git 分歧）。安全类边角每轮采信、别急着判 false-positive（point-4 是实测证伪无污染才放行、不是嘴上说）。

### 现役机制边界纠偏（2026-07-21，按源码锁定）

- `contract.mjs` 当前只接受 `direct|light|full`；`kernel` 已登记且已批准为改革目标车道，但 CLI 尚未接线，
  现阶段所谓 kernel 契约实际是 `lane=full` 加严人工治理。不得输出一个当前会被拒绝的 `--lane kernel`。
- 现役阶段互锁真判据：`direct` 全放行；`light` 写 prd / 改实现 / 提交实现需连续完成到 plan，推送需到 loop；
  `full` 写 prd 需到 plan、改实现需到 accept、提交实现需到 loop、推送需到 review。旧「light 跳 grill、accept
  任何车道都不跳」是目标口径，不是当前代码事实。
- 护栏现为 19 条。第 13/14/15/17 条文档标签仍写 prose 待强制，但裁判与回放已有主要机械守点；反向地，
  breaker 的「每步进展哈希」仍未建，现役零进展只看 git HEAD。交接须同时写标签与代码边界，不能把任一侧
  单独冒充完整事实。
- 回放看门狗现为 120 秒；超时尽力清录像、关浏览器并非零退出。fake-SUT 对 agent 只读，任何行为验收只驱
  真机；旧 ADR-0009「保留 hermetic 浏览器地基」不得被解释为授权 agent 重跑已隔离浏览器金牌。

### 模型分层升级 + 三级兜底（2026-07-01，已锁）

> **范围**：仅**开发流程**的模型分层道（谁来跑 loop：`toil`/`implementation`/`review`），不涉及 Casey 产品功能——编译/回放/裁定/报告 的运行时 LLM 接缝（相1 编译、相5 自愈、将来 `LLM-judge`）均不在本决策内；`verdict.mjs` 恒零 LLM。即配置顶层「两类 lane 正交」里的「模型分层道」那一类。

- **分层**：`loop/config.json` 模型分层道改——主环 Opus 4.8 跑 ultracode（xhigh + 动态工作流编排）当编排器，承 full 车道与冻结内核；轻车道的活派 Sonnet 5 独立 subagent（max effort）。切 subagent 而非主环换模型：prompt 缓存不被打断、上下文隔离（claude-api 缓存文档明写的正确写法）。`review` 未动，`sonnet` 仍同族末位 fallback。`toil` 缓：夜跑暂无需求，2026-07-01 撤回原 `codex:gpt-5.5`，待有 nightly runner 再议。
- 三级兜底阶梯（运行时 fail-safe 升级）：开发任务上 Sonnet 5 max 一直卡（`circuitBreaker` 判 `zeroCommitRounds`/`sameErrorRounds` 跳闸）→ 升 Opus 4.8 xhigh（原 plan）重试 → 再卡 → `NEEDS_HUMAN` 写 `loop/inbox.md`（护栏 #14 fail-safe 不 fail-open，能力升满仍证不出就路由人、绝不静默过）。机制锚已在 `circuitBreaker` + `breaker.mjs`；`toil` 不入此梯（机械小修，跳闸照旧写 inbox）。
- **静态强制兜底（两条不变量，机器守；模型能自由换的前提）**：
  - I1 裁判零 LLM（护栏 #15，承重）：`bin/verdict.mjs` 传递依赖闭包零 LLM/网络客户端——「上游随便换模型都不出静默假 PASS」的根兜底。
  - I2 异构评审不塌同族（护栏 #9 / ADR 异构冗余）：`review.model` 家族 ≠ `implementation.model` 家族，`sonnet`/`opus` 只能在 review `fallback`、绝不当主 `model`。
  - I3「Sonnet 5 只作 subagent 不换主环」是编排期运行时属性、静态不可查，不假装可强制；其兜底即 I1（verdict 零 LLM + 冻结 golden + gate 三重网）。
- 已建（`model-lane-guard` 契约收口，2026-07-01）：I1 verdict 零依赖断言已入 `casey selftest --tier1`（`bin/verdict-purity-guard.mjs` 静态扫依赖闭包）；I2 config 不变量 PostToolUse 钩子已接（`bin/config-lane-guard{,-hook}.mjs` + `.claude/settings.json` 独立条）。仍待建：三级兜底 watcher 读 `loop/.breaker-state.json` 自动再派——另起辐条、不在 model-lane-guard 契约内（别 ad-hoc 破护栏 #11、别改 loop-kit engine ADR-0001）。config 的 `_doc` 是当前策略事实源。

## 下一步

### A（当前推荐）· Claude Code 异构 review → learn

先 review 当前未提交的 `teachin-replayability-closure` 完整 diff，重点核：

1. 同次 capture exact identity 是否在 admission、events、pair 与三个 runtime namespace 全链一致；
2. legacy plan 是否只作模板且不会把旧 capture 重新引入；
3. recording owner 交接、entry 早退与三 runtime cleanup 是否恰关闭一次；
4. signed expected/obligations、动态 active page、共享 attribution state/pageErrors 是否在生产路径真接；
5. entity publication 未授权时是否继续 fail-closed；
6. `CLEAN/EQUIVALENT` 是否始终只作 developmentOnly 证据。

评审只喂 plan、diff 与静态证据，不运行真机。发现问题后复跑完整 33 枚 teach-in golden、
`cli-mcp-face`、`regress-wf-node-script`、`selftest --tier1`、全仓 ratchet 与 diff check。
异构 review 有干净 `PASS` 记账后，才能推进 `learn`；不得直接把 4/6 改成 6/6。

### B · 环境稳定后的真机 UAT

Steven 明确 AI 中台升级完成前暂停。恢复后按顺序：

1. AI 中台走通“人工示教→原始 fresh-browser 回放→atom 蒸馏/分解→
   distilled fresh-browser 回放→确定性语义等价”；
2. Windows native direct 验新标签页、登录连续性与执行目标，不得误替为 WSL-only loopback；
3. current build 与 held-out build 各跑，再扩医生站和 Hi 小助；
4. ID/名称双定位跑正向、同名歧义、ID 错绑；
5. 至少三份正式报告转 PDF，录像转 MP4，交 Steven 人签。

### C · 验收后发布

只有 B 全部满足且 Steven 明确验收后，才按 ownership 选择显式路径提交并发布 GitHub。
当前共享工作树禁止批量 stage；先区分 Claude/Codex/用户/并行现场，绝不 `git add -A`。

### D · 发布后的 zero-shot 扩展

先 grill 模糊描述并改写成原子工作流；前置条件也独立编排、录制与证明；
确定项直接 deterministic 执行，仅模糊/未知点交 LLM。自动编排失败走示教兜底：
人工录制→原始成功回放→蒸馏/分解 atom→蒸馏后成功回放，两次成功才沉淀能力。

## 契约 / 运维

- 主树活契约以实时 `loop/active-contract.json` 为准：当前是
  `teachin-replayability-closure`（full，4/6），`review` 与 `learn` 未完成。
- 主树 `dev@6f91125`；本轮代码与验收件全部仍在未提交工作树。18 个 tracked 修改、
  58 个未跟踪路径（展开约 150 文件），混有多方现场；提交只走显式 ownership 清单、绝不 `-A`。
- `origin` 已配置为 Casey GitHub 远端，但本轮未 push；真机 UAT 与 Steven 人签前禁止发布。
- 本契约静态证据：33 枚 teach-in golden 全绿、143 份 PRD ratchet 0 issue、
  CLI/MCP 12/12、工作流脚本回归 10/10、tier-1 全绿。它们不替代异构 review、learn 或真机完成闸。
- 下方“契约一览”是按各条日期保留的历史台账，不能覆盖本节与文件顶部最新覆盖层。
- 现役 contract CLI 只有 `direct|light|full`；需要 kernel 级纪律时用 full + 加严人工治理。恢复旧契约前
  必核其基线与冻结件，不能机械 re-init 后沿用旧证据。
- 契约一览：
  - `agent-id-readback`（full，2026-07-22，worktree `../casey-agent-id-readback`，loop done / gate 6/6 GREEN，未合并）：
    智能体平台 ID 网络信封读回 + DOM/信封双证门（`agent.searchOpen` 搜索步网络信封提三元组、DOM 无 ID 属性故走信封）。
    `gpt-5.6-sol` max 四轮设计共识（R1 三 P0=解析竞态/假唯一/剖面当安全开关，R4 可进 accept）；请求级身份观察事务、
    完整性先决、完整集合内同名>1 才 `AMBIGUOUS`、点击前对已签 `platformId` 比对、`sign` v2 `--entity-observations`
    五元 join 哈希闭环。真机活数据双证实证绿；三层真机剖面字段名实测纠正（`data.list`/`data.pageInfo.totalItems`）。
    生产改 7 文件（`replay-forensics`/`compile-atoms`/`replay-actions`/`sign`/`entity-semantic-lock-preflight`/`sign-cli-args`/
    `mcp/casey-server`）+ 3 新 lib/金牌。待 `codex` 异构 review + learn + 合并（见「下一步 A」）。
  - `stale-red-admission-refit`（light，2026-07-22，六阶段全 done、主树活契约、未提交）：护栏 #19 陈旧红收口——
    `p3-compile` 4/14→14/14、`report-diagnostics` 11/12→12/12，红因实体准入面拦夹具旧调用（`git stash` 实证非回归），
    夹具侧铸测试受众准入件生产零改，`gpt-5.6-sol` max 咨询 + `codex` high 4 Medium 全采信修复，两 owner prd
    `checksumAmendments` 重钉、gate 复跑 exit 0。learn 落 `docs/plans/stale-red-admission-refit/learn.md`。
  - `checksum-drift-closure`（full，2026-07-21，grill 未 advance）：task #17 只读核账已完成，确认
    `prd-seams-freeze` 与 `prd-delete-confirm-causal-binding` 为真实漏签，两个 observation 旧金牌为有意
    安全撤销墓碑；当前等待 Steven 裁决 D1/D2/D3，签认前不写 plan/prd、checksum、`passes` 或冻结件。
  - `flow-bridge-golden-refit`（full，2026-07-21，六阶段全 done、codex gpt-5.6-sol high 三轮 R1 FAIL→R3 PASS 记 audit、learn 落 `docs/plans/flow-bridge-golden-refit/learn.md`）：护栏 #19 六陈旧绿修夹具侧/生产零改——A 家族 flow-bridge/ingest 补 entityBindings + C17 反向锁 + 内核 mutant 突变红证 / B 家族 cli-mcp-face·record-distill·authority-root 改形 + ephemeral 动态签名 support 件 / C 家族三 plan.md 术语正名。ADR-0004 人签（三项 + 评审补签两处字节）+ 重签 6 owner + 4 新条目、全 22 prd 复 gate（s4：39 复gate刷新绿 + 2 恒红守诚实 = 41 对账）。其契约外 4 处既有 testChecksums 漂移已由现役 `checksum-drift-closure` 接棒并完成只读分型。
  - 2026-07-09 三契约（均六阶段全 done、跨族异构冗余评审 + 同族 backstop 记 audit；活契约槽 worktree-baton 六阶段全 done）：`record-intake`（full，`46ae7a3`——示教兜底第二契约 `casey intake` 入账闸 + append-only 台账；codex R1-R9 九轮逐类全采信红先行修死 + R10 formal PASS 撞 codex outage 挂账、同族 fresh-eyes backstop 补，audit 两条）/ `record-distill`（full，`4bce3a5`——示教兜底第三契约 `casey distill` 零 LLM 全 pending 投影候选 + intake→distill `captureSha256` TOCTOU 硬门 + 采集忠实闸；codex R1-R3 PASS + 同族 backstop，audit 两条）/ `worktree-baton`（full，`ef94da4`——解单活契约 baton 天花板：`contract list` 跨树总览 + `contract worktree` 起树脚手架 + 护栏 #18 + CONTEXT 三术语 + `WORKTREE-PARALLEL.md` 手册；codex R1-R5 PASS（F1 路径 containment 五轮深挖收口）+ 同族 backstop，audit 两条；`loop-kit` 仅 `contract.mjs` +109/-3、hook/breaker 逐字节零改）。示教兜底人录三环 record-capture→intake→distill 全建；并行开发经 worktree 解锁。
  - 2026-07-08 下午—晚八契约（均收口入 dev、异构冗余评审记 audit、learn 各落 `docs/plans/<slug>/learn.md`；活契约槽 report-workflow-structure 六阶段全 done）：`record-capture`（full，`bb0ee3c`——示教兜底人录；codex 自评标 done 但 audit「非正式异构待补」不算数，Claude 补正式异构冗余评审 3 High+3 Med 红先行修毕）/ 用户易操作线文档（`62ad838`，纯 docs+scripts 非 lib/bin 契约）/ `report-nl-atomic`（full，codex 一轮，`0719919`——naturalLanguage+atomicSteps）+ 对账表收缩（`ed3e6ea`）/ `report-video-block`（full，codex 一轮，`8f7bcf5`）/ `report-cleanup-evidence`（full，codex 一轮，`6267dff`）/ `report-workflow-structure`（full，`1ad0702`+跨族复审补强 `d9a39df`——codex 撞额度先末位同族兜底、回来后补正式跨族异构冗余复审，audit 两条、正式条取代末位条）。P7 报告消费侧 report-model 报告块 0→5（report-spec §3 六项落五，余 #12 属编译/草拟期）；五增量每轮改 report-model.schema.json 涟漪 prd-seams-freeze schema checksum 均重签。
  - 2026-07-07 下午—晚五契约（均收口入 dev、异构评审 PASS 记 audit、learn 各落 `docs/plans/<slug>/learn.md`；活契约槽 wf-connect-nodes 六阶段全 done）：真机合并行程首航（route:human，`24865f4`——`sign` 真 prd 首航，扁平每用例 prd `prd-tc_wf_publish_states` / `prd-tc_wf_history_version` 两份，真机四停站 4/4 + 8/8 PASS）/ `wf-add-node`（full，codex 两轮 R2，`dbc0d0d`——画布首原子 `workflow.addNode` + `dragTo` 动作类入双冻结、六 prd 十四键重签）/ `report-exit64`（light，codex 一轮 R1，`407b511`）/ `output-seal`（full，codex 三轮 R3，`cc7a3c2`——全仓输出通道封缝 23 口 + 顺修 report-exit64 尾巴 + prd-p7-report 重签）/ `wf-connect-nodes`（full，Claude 侧对抗评审 PASS，`efaa41a`——并发 codex 实现补收口：`workflow.connectNodes` 集 14→15 + 端到端金牌填覆盖缺口 + 修 codex F1/F2 健壮性缝 + 四漂移棘轮 prd 重签；评审归属反转 codex 实现→Claude 评）。
  - 2026-07-06 晚—07-07 凌晨八契约（均六阶段全 done、codex PASS 记 audit、learn 各落 `docs/plans/<slug>/learn.md`）：`ingest`（相0 归一，full，七轮 R7，`b7c8f61`）/ `caseid-echo-mask`（direct，一轮 R1，`d3a5c11`）/ `e2e-chain`（light，四轮 R4，`365c185`）/ `cli-mcp-face`（light，两轮 R2，`0d0d779`）/ `btn-enable-ops`（full，两轮 R2，`c33d519`）/ `handover-pack`（light，四轮 R4，`62d8acb`）/ `plan-debt-sweep`（full，一轮 R1，`44fb1df`）/ `wf-open-smoke`（direct，两轮 R2，`7027d53`）。前四条 = 相0 建成 + 姊妹 CLI 回显缝收口 + hermetic 全链集成金牌 + 三面对齐；后四条 = Steven 三问点单（断言提硬 / 移交包 / 欠账清洗 / 飞轮第五条）。另 `aeaa6b3` 补跑 prd-wf-publish-states s2 悬空涟漪锁 gate 复验。
  - 2026-07-06 白天四契约（均六阶段全 done、codex PASS 记 audit、learn 各落 `docs/plans/<slug>/learn.md`）：`sign`（相2 人签门，full，七轮 R7，`2497309`）/ `flow-bridge`（相1 flow 桥，full，三轮 R3，`ef13787`）/ `video-login-carry`（相3 回放舞步登录态 carry，full，四轮 R4，`bb6f594`）/ `replay-video`（回放视频录制，full，五轮 R5，`f291c70`，上一 session 末收口、本次刷入 HANDOFF）。前两条补齐「文本用例→spec」前半的 sign stub + flow 桥缺口，其时端到端唯余相0 归一 ingest（已于当晚 `b7c8f61` 收口）。样例报告驱动 `scripts/sample-report.mjs` 证 hermetic 引擎端到端可跑（相3→相4→相6）。
  - 2026-07-03 全日七契约（均六阶段全 done、codex PASS 记 audit，learn 各落 `docs/plans/<slug>/learn.md`）：`run-history`（light，两轮）/ `chiefcomplaint-smoke`（full，三轮 + 审后微调 R4 微轮）/ `compile-caseid-shape`（direct，一轮，缺席推定已追认）/ `chief-bringup`（direct，两轮）/ `cred-route-mask`（direct，两轮）/ `login-traffic-drop`（direct，三轮）。真机件 `cases/tc_chiefcomplaint_smoke/`（gitignored）四件套 + `expected.frozen.json`（6 条全硬）+ `runs/.../run_1783054730282` 七件齐备。
  - `p3-compile`（full）：六阶段全 done（codex 三轮 R3 PASS 记 audit、learn 落 `docs/plans/p3-compile/learn.md`）。真机 bring-up 六项 route:human 已全清（2026-07-02/03，P3 收官，见「当前状态」）。
  - 前日六契约（2026-07-02 夜至 07-03 晨，均六阶段全 done、codex PASS 记 audit）：`replay-login-bootstrap`（light，两轮）/ `p4-drafter`（full，四轮，含 G-seam 双 enum 对齐 Steven 追认）/ `noerrenv-absence`（light，一轮）/ `run-login-passthrough`（direct）/ `report-fidelity`（light，三轮）/ `draft-cli`（light，两轮）/ `kinds-harden`（light，一轮）。learn 各落 `docs/plans/<slug>/learn.md`。
  - `layer3-wiring`（light）：六阶段全 done（codex 七轮 R7 PASS 记 audit、learn 落 `docs/plans/layer3-wiring/learn.md`；gate GREEN 2/2、覆盖 golden 51 检查）。
  - `seams-freeze-v2`（full）：六阶段全 done（codex 十二轮 R12 PASS 记 audit、learn 落 `docs/plans/seams-freeze-v2/learn.md`；gate GREEN、golden 13 组、`CONTEXT.md` 登记 6 术语）。四接缝 lib/bin 真产出随真机集成 route:human（prd observability 列）。
  - `term-guard`：6 阶段 done（gate GREEN 2/2、codex 九轮异构评审 pass、Stop 钩子 warn-only；乙真接线待密钥见「下一步」5）。
  - `model-lane-guard`：6 阶段 done（gate GREEN 2/2、codex 四轮异构评审 6→5→2→0 收敛 pass；I1+I2 守卫上线）。
  - `hermetic-gap-freeze`（direct）：done（两份缺口 coverage golden 补冻入 prd-p7-report / prd-p6-selfheal，gate 各 2/2）。
  - `p5-replay`（full）：6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；其 prd 的 tier-2 route:human 标注未正式核销，但回放内核已随 P3/P4 真机多轮实跑全绿（回放核验两轮 + `casey run` 三轮，2026-07-02/03）。
  - `p2-intent-compile`：仅 learn 待。其余（seams-freeze / p2-failsafe-coverage / p7-report / p4-freeze / p6-selfheal）loop done、产物落 dev。
- 单活契约 baton 教训（重要）：loop-kit 是单活契约（hook 读主树共享 `active-contract.json`）。本会话并行起多契约（worktree 隔离）撞了这个单 baton 槽——worktree 子代理 commit 受主树 baton 互锁：P6 子代理曾临时翻主 baton（已还原）、P4 子代理被拦只暂存未提交。landing 办法：已 committed 的分支用 `git merge`（不被 commit 互锁拦）；未提交的（P4）把文件拷进 dev、把主 baton 临时切到其真实 loop-done 契约提交、再还原。已解决（2026-07-09 `worktree-baton`，`ef94da4`）：真并行不走 `LOOP_CONTRACT_FILE` 参数化 / `breaker --state` 那条（背离 worktree、设计红队 1 High+4 Med 否决），而是每 worktree 天然一独立 baton（`active-contract.json` 与熔断态 gitignored、每树一份）——`contract worktree` 起树 + `contract list` 跨树总览 + git-native 合并回 `dev`（护栏 #18）。本条教训现仅溯源，并行落地照 #18 走。
- push：`origin` 已配置为 Casey GitHub 远端；本轮未 push，仍须真机 UAT 与 Steven 验收后再发布。
- 删不动的残留：`docs/plans/seams-freeze/proposed/`（评审副本，破坏性删除被权限层拦，待人 `! Remove-Item -Recurse -Force` 清）。
- 旧 `p2-testcase` 契约已被取代作废。term-lint 全程过；Windows git 需 `git config windows.appendAtomically false`（已设，否则 merge 报 index.lock 写错）。

## 历史层（溯源用，非现状）

- `P0/P1`（live，不变）：loop-kit 引擎（与 autotester 字节一致，ADR-0001）、护栏（12 迁移 + 13–17 新增）、`CONTEXT.md` 两限界上下文、ADR 0001–0006、`casey selftest --tier1`。
- **2026-06-26**：P2 重定义走完 grill→plan→accept，6 路深读 `regress_autotest`、ADR-0006 的 14 风险落代码核验、冻结 5 红 golden + 2 fixture + prd，停在 loop 前。详见 `docs/plans/p2-intent-compile/grill.md`。
- **2026-06-29**：开 loop 前的岔一/二/三 + 质量接口讨论 → 落档（FLYWHEEL/design/report-spec/flywheel-schedule）→ 实现 loop（S1/S2/S3 绿）→ 提交 `594ecf4` → Claude 侧异构评审 → 收口。
- **2026-06-29 晚续**：codex 真异构评审收口（7 修复，`7923088`）→ omc 列禁言禁用 → 排期 v2（接缝优先并行，`roadmap-parallel.md`）→ 第1层 5 接缝冻结（`4d184f6`）→ 第2层并行 worktree：track-F/P7（`b00b7c7`/`0832ed3`，合并 `e06e309`/`9d92892`）+ P6（`8734307`，合并 `1a37eba`）+ P4（`5a8b08d`）→ P5 grill+plan（ADR-0007）。第2层四轨全在 dev 亲验绿。单活契约 baton 撞并行的教训见「契约/运维」。
