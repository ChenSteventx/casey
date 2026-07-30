# P6 heal · GRILL（决策树清空记录，v4，2026-07-28 深夜）

> v1→v2→v3→v4：codex `gpt-5.6-sol` xhigh + grok-4.5 三轮联合计划评审逐轮收敛（原卷在
> scratchpad）。本版分岔 D1–D12。Steven 已选「改 v2 并继续全链」（后续轮按同规则续）。
> 既有钉死项（准入只收确证 `HARNESS_ERROR`、禁 SUT_DEFECT/NEEDS_HUMAN 自愈、非就地、人签、
> 同一冻结 checker 复核、裁判零改、熔断有界、不进 MCP 面）不变，不再复述。

## 分岔裁决（v2 修订版；D1/D4 双家认可维持原案）

D1 **v1 自愈零 LLM**（维持）：双家均未找到「确证 `HARNESS_ERROR` 但必须 LLM」反例——确证
   即探针已确定性拿到唯一重锚目标。真风险在确定性锚的**可执行形状**（见 D9），不在缺 LLM。

D2 **同一步漂移升级阈值**（修订，codex）：N=2 保留，但计数对象是**不同证据元组**
   `{caseId, stepId, verdictSha256, axesSha256, eventsSha256}`；同证据重调→幂等返回既有补丁，
   不计新漂移；台账 append 必须原子（临时文件+rename 或 O_EXCL 锁），防并发双写与丢 stdout 重试误升级。

D3 **人签应用后的复核范围**（v3 补证明件 schema，codex delta：布尔旗标可冒充证明）：
   整案重放只对已证明可复位/幂等的用例成立；变更型不是单步重放安全超集。「已证明」的唯一
   载体是**签署证明件** `cases/<caseId>/reset-proof.json`：`{caseId, resetPlanDigest,
   sutBuildDigest, signerId, signedAt, statement}`，走现役签署验证（无签/字段残缺/caseId
   失配一律视为未证明）；调用方任何布尔/旗标自报均无效。未证明 → 复核 route:human。
   现役唯一词表原子 `workflow.deleteByName` 即变更型，v1 其自动复核 route:human。
   **复核通过标准（codex delta 新 High）**：目标步转 `PASS` **且**对照 heal 前基线
   verdict.json 全案无任何非目标步「绿→非绿」新回归；违反即 reverify FAILED → 按 D5
   journal 对称回滚。
   **签署真实性边界（v4 诚实降格，codex：现役 sign 面 signerId 未认证、内容哈希可重算）**：
   `reset-proof.json` 的防线分两类（v4.2 与 A7 对齐，金牌铸造期矛盾裁决）：**无件**=合法
   未证明 → route:human；**字段残缺/caseId·resetPlanDigest·sutBuildDigest 失配**=可疑输入
   → 拒 `exit 65`（畸形面，fail-closed）。布尔自报无效。签署真实性沿用现役人签信任模型
   （签名密码学威胁面按 ADR-0010 后置）——与 expected.frozen 同级，不虚标防伪强度。

D4 **v1 只治探针词表内原子**（维持，加强）：词表内收作为安全策略双家认可；但热路径可达性
   必须先证（见 D10 S0），证不出则 v1 交付「机械全链 + 热路径挂账」，不虚标可用。

D5 **补丁应用形态**（v4 补回滚对称，双家共同新 High：回滚不得把多文件事务拆回单文件）：
   应用非就地（`--apply` 产候选旁文件、人签绑定候选精确 sha256）。`--promote` 为**日志式
   分步事务**：① 写晋升 journal——**登记全部将被修改目标**（events、每个受影响绑定/发布
   指针文件）的前后 sha256 与逐件预存副本 → ② 重签件就位校验 → ③ events 单 rename 切换 →
   ④ 绑定发布 → ⑤ `HealReceipt` 落盘封 journal。回滚与晋升**对称**：按 journal 逆序恢复
   **全部**登记目标（events + 绑定逐件），逐件恢复后 sha256 断言，回滚本身记入 journal 并以
   `rolled-back` 状态封账；不存在只恢复 events 的半回滚。未封 journal（含回滚中断）→ 一切
   heal 子命令 fail-closed（具名码）；中间态在现役签署绑定校验下也过不了回放前置闸。

D6 **healed→PASS 权威**（新增，双家共同实锤）：只认**真 replay→真 verdict 链**产出的
   verdict.json；合成 verdict 在任何验收/生产路径都不得判 healed→PASS。hermetic 验收走
   replay 链既有假运行时接缝（示教金牌同款 harness 模式），真机 healed→PASS 实例 route:human。
   复核前还须校验冻结 expected/entity locks 的签署权威链（复用现役 sign 验证），防「拿伪造
   冻结件复核」。

D7 **退出码**（v3 定稿，grok N1 + codex delta：不留候选、切开 no-op 歧义）：已对照
   `bin/casey.mjs` 现役图例（0 成功/1 失败红/2 熔断互锁/3 未实现/64 用法/65 阶段惯例畸形）
   **现在冻结（唯一枚举，单一来源）**：`0`=命令成功，stdout 结构化 JSON
   `outcome ∈ {proposal-written, applied-candidate, promoted, reverified,
   reverify-routed-human, reverify-failed-rolled-back}`（六值全集；无 no-op 值；复核失败但
   回滚成功=命令成功、业务失败由 outcome+receipt 承载；绝不暗示测试 PASS）；`2`=熔断跳闸；
   `4`=**准入全拒**——「无一步可自愈」的唯一编码，含干净全 PASS 案
   （reason=`NO_HARNESS_ERROR_STEPS`）、逐步全拒案（逐步具名拒因清单）与
   `HEAL_REANCHOR_NOOP`；`6`=晋升阻断（重签缺失/候选 sha256 失配/未封 journal）；
   `64`=用法；`65`=输入畸形。三条拒因码位补钉（金牌铸造期裁决）：`HEAL_FLAKY_ESCALATED`
   → `4`（该步被升级即无步可愈）；`HEAL_PATCH_UNSIGNED` → `65`（未签补丁喂 --apply=契约
   畸形输入）；reset-proof 残缺/失配 → `65`（同理；无件才是 route:human，见 D3）。
   验收 A1/A3c/A8 钉死期望码与 outcome 字节，实现无二选一空间。

D8 **熔断计量**（v4 再消歧，codex：同一步三轮与 D2 二拒互相锁死）：同一步的复发拦截
   **就是** D2（N=2 升级），先于熔断起效、不再叠加同步骤轮数。loop-kit breaker 改记
   **case 级**：对同一 caseId 的连续完整 heal 周期（跨步骤累计，同证据幂等调用不算）
   3 轮无任何进展（无新 healed→PASS 或 route:human 终局 receipt）→ 跳闸 exit 2 + inbox。
   A5 验收路径改为三个不同步骤各一轮空转（可达）。
   （S7 实现期裁定三则：① loop-kit breaker 是 loop 迭代级全局账（git HEAD 进展判据+身份锁
   独立包），「改记 case 级」按字面须改包=越契约；改道为 heal 内自落 case 级轮账
   `cases/<caseId>/.heal-breaker.json`，只复用 loop-kit 的 inbox 落点与退出码约定，包零改。
   ② 「晋升后不复核」路径不进轮账——但每轮晋升需一份新人签补丁，人签即闸，非无界。
   ③ route:human 为终局清零连击——交人即人在环，反复 route:human 不跳闸是设计而非洞。
   轮账破损 fail-closed 归口 exit 2，非调用方输入不走 65。）

D9 **重锚写读同形**（新增，grok C1）：S2 产出的语义锚必须是回放器**实际消费**的定位形状——
   实现前先读 `lib/replay-actions.mjs` 的定位消费面与既有 `drift-patch.fixture` 的补丁形状，
   补丁字段照抄现役消费形，不发明新形状；`withinRow` 语境必须保留在锚里。

D10 **热路径先证**（新增，grok C2 / codex）：新增 S0——用 replay 链假运行时接缝证明
   「词表原子回放 miss → 探针跑出正向证据 → axes 落 driftProbe → verdict 判 `HARNESS_ERROR`」
   全链在**现役生产接线**上真可达。若 S0 证明不可达：v1 不松「零改 replay lib」（frozen 面
   风险），改为诚实缩范围——机械全链照做、热路径缺口连同证据挂账给后继契约。

D11 **单步处理**（新增，grok M6）：一次 CLI 调用只处理一个步（`--step <stepId>` 显式指定，
   缺省取首个可准入 `HARNESS_ERROR` 步）；多步各自独立走完整周期。

D12 **证据血缘权威**（v4.1 按 codex 实测再收窄：`replay-axes` 只存步 id+动作轴不存定位、
   run-history 只投影 role/name 丢 `fallbackCss`——「仅 fallbackCss 不同」的混件内容互证
   分辨不了）：v1 采纳 codex 二选一的**收窄支**（不改 replay 产物面）：准入附加条件——
   目标步的 events 定位必须**完全可由现役可互证面重构**（纯语义定位：role/accessibleName/
   targetName，与 run-history 投影逐字段吻合）；定位含 `fallbackCss` 等未投影字段 → 拒
   `HEAL_LINEAGE_UNVERIFIABLE`（fail-closed，不猜）。在此收窄面上互证完备：verdict↔axes
   全步集/caseId 精确一致 + axes 目标步动作轴/探针三元组与 events 重算一致 + run-history
   逐字段对账；「仅 fallbackCss 不同」混件因定位含未投影字段直接进拒付面，A/B 攻击路径闭。
   同字节等价件混装不可判别但决策等价、危害有界，如实挂账；「不可伪造回放收据」（含定位
   内容摘要）挂账 replay 面后继契约——落地后本收窄可解除。A6 负控：定位含未投影字段 → 拒；
   纯语义定位 A/B 步集失配 → 拒。

D13 **复核 v1 收缩为 hermetic 专用**（代码评审轮定案，grok F1 Critical + codex 1/2/3 合流）：
   ① 复核不得多读生产回放不读的键——`within` 降级为候选文件里的**前向兼容注记**（作为人签
   绑定的字节差存在，生产与复核都不消费；replay 面后继契约落地行内收窄后才生效）；
   ② `--reverify` 仅在 `CASEY_HEAL_RUNTIME_SEAM` 在场且受路径门禁（seam 模块解析后的绝对
   路径必须落在本仓 `tests/` 目录下，越界拒载）时可用；生产调用（无 seam）一律 `exit 64`
   + 具名说明「v1 复核仅 hermetic，真机复核 route:human」——与 S0 热路径证伪、D3 变更型
   route:human 完全自洽，不存在「复核绿冒充真机等价」的窗口（门禁形与冻结金牌兼容：金牌
   seam 即在 tests/ 下）；
   ③ 复核编排收缩为「hermetic 弱回放模拟」定性，不再宣称与正式回放同姿势装配（第四路径
   风险由定性收缩闭合，正式同装配复核挂账 replay 面后继契约）。
   D7 增补：`1`=未预期内部错误（与全仓图例「1=失败/红」一致），catch-all 不再漏未定义码；
   `--ts` 须为可表示日期，越界落 `64`。
   D5 增补（codex 5/6/7/8）：晋升前置加**绑定链闭合**——候选恰一差异必须正是已签补丁指定
   步的定位字段、补丁必须对应台账既有证据元组；per-case 独占晋升锁（O_EXCL）；锁内重验
   当前 events 与 journal 登记前哈希一致；未封 journal 扫描锚定 case 根（由 events 路径
   派生，不随调用方 `--out-dir` 漂移）；journal 与 receipt 互绑（journal 封账含 receipt
   内容哈希，receipt 含 journal 哈希，复核回滚权威先验互绑）。
   D12 增补（codex 9 + grok F4）：互证面纳入 `semantic.exact` 与删除域消费的 `value`；
   `semantic` 内任何嵌套未投影键同样拒 `HEAL_LINEAGE_UNVERIFIABLE`。
   D3 增补（codex 4，诚实划界）：`reset-proof` 的 `resetPlanDigest`/`sutBuildDigest` 在 v1
   为「记录而不验真」（无权威比对源），属人签信任边界的一部分，挂账后继契约接权威源。
   补丁文件名（codex 10，修复期折中已裁）：stepId 段与冻结金牌逐字断言冲突（金牌只读），
   实际闭合=`wx` 独占写（碰撞具名拒）+ 幂等命中验哈希绑定；stepId 段随金牌解冻重签挂账。
   D14 **事务面三补**（代码 delta 轮 codex 新 High）：① 复核/回滚与晋升共用同一把 per-case
   独占锁，晋升-复核-回滚不可交错；② 基线绑定——提案台账行与 baseline verdict 的 sha256
   冻进 journal/receipt 核，复核前重验基线字节未被替换（防「预换基线隐藏新回归」）；
   ③ 全部事务产物（journal/预存副本/receipt）独占预留落盘（`wx`），审计链不可覆写；
   同 ts 重复晋升按先到的门拒（通常在候选范围前置校验即拒，产物预留碰撞拒因为兜底层），
   安全属性=任何路径不可覆写既有事务产物（终验措辞修正：拒因随场景，不承诺单一拒因）。
   ②补（codex 终验残洞）：晋升时必须校验台账行 `evidence.verdictSha256` === 当下基线
   verdict 字节哈希——基线必须正是提案证据元组里的那份 verdict，晋升前换基线同样拒
   （`HEAL_BASELINE_VERDICT_UNBOUND`），闭合「晋升前预换基线藏回归」窗口。

## 观测性申报（route:human）

- 真机两不变量（不抹真 bug / 不悄改 spec）；真机 healed→PASS 实例；变更型用例复核（D3）；
  真实漂移样本稀缺——v1 验收全 hermetic 合成。
