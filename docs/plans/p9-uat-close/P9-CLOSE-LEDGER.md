# P9 关账账本（2026-07-30 起，活文档）

> P9 完成定义（`docs/plans/bootstrap/plan.md` P9 段）：
> ① `selftest --tier1` 全链 exit 0、四态徽章全覆盖；
> ② tier-2 真机冒烟 + 真机 UAT 清单**全部人签通过**（gate 绿 ≠ 完成，ADR-0009）。
> 关账规则：清单全过**或**逐项明确 waiver；open 项保持 P9 open。

## 关账口径裁定（Steven 2026-07-30）

**不走 waiver 路线。** `tc_wf_publish_states` 必须真绿之后 P9 才关账
——即选「等 publish 全绿再关 P9」，P9 保持 open 直到该例真机全 PASS。
理由：真机 UAT 清单的意义就在于每一例都真过；提前 waiver 会让 P9 的
「需求完成」名不副实。

## 清单现状

| 项 | 状态 | 证据 / 阻塞 |
|---|---|---|
| tier-1 全链绿 + 四态徽章 | ✅ 早期建成 | tier-2 金牌 T6 横切锚点复跑绿 |
| tier-2 机器面（契约 `p9-tier2-live-smoke`） | ✅ 已收口 | 实现完、金牌 111 钉 exit 0、codex 联审三轮闭环；清单扩集到五员并落签 |
| A4 tier-2 真机实跑 | ✅ **已跑并采认** | `runs/_tier2/judge-smoke_20260731T030518296Z_3302ad`：exit 2，17 门全绿、readback 落账完成；流式面空按条款如实记，Steven 判满足 |
| A5 D5 三层口径修订 + 人签 | ✅ **已签已落地** | Steven 2026-07-31 明签「2、签」；三处文本已改，全文见 `D5-ACCEPTANCE-SEMANTICS-REVISION.md` |
| UAT 签认书（冻入 prd checksum） | ✅ **已签已冻** | `P9-UAT-SIGNOFF.md`，sha `637f4708…` 已进 `prd-p9-tier2-live-smoke` 的 `testChecksums`，漂移扫 exit 0 |
| UAT 例 `tc_agent_id_readback_real_uat_v1` | ✅ | PASS 1 / NEEDS_HUMAN 1（身份回读已人裁） |
| UAT 例 `tc_catalog_wf_crud` | ✅ | 07-30 重签后真机全 PASS，B.5 报告齐 |
| UAT 例 `tc_wf_history_version` | ✅ | 07-30 重签后真机全 PASS，B.5 报告齐 |
| UAT 例 `tc_wf_publish_states` | ✅ **已转绿（2026-07-31 凌晨）** | 见下方「07-31 凌晨订正」与「publish 转绿实录」 |

## publish 阻塞项详情

> **⚠ 本节以下的两点诊断已被后续实测推翻一半，先读下方「2026-07-31 凌晨订正」
> 再读本节。** 保留原文是为了留痕诊断是怎么走弯的，不是因为它还成立。

07-30 重表达后真机复跑判 PASS 4 / NEEDS_HUMAN 2，Steven 看录像确认两处
**根本没发生**：

1. **保存步**：`resolution: none, candidateCount: 0` —— 按钮没找到、点击从未
   发生。计划审证据：选择器与可访问名都没写错（真机示教证明它就是编辑器顶栏
   真按钮），根因是**顶栏延迟挂载**而现役定位只等 1200 毫秒、后备选择器不等待；
   同一意图稍后的按钮态采样用相同精确匹配数到「保存」计数 1，坐实「按钮后来
   出现了、点的那一刻还没到」。
2. **关闭步**：`body` + Escape 机械上「唯一」，但浮层没关。原表达假设来自
   假环境夹具（该夹具既实现关闭按钮又实现 Escape 处理），真平台不吃这套。
   真机示教从未录过版本表的关闭控件，**证据不足以冻结替代选择器**。

### 因此需要的动作（按序）

1. **Steven 带外真机侦察一次**（清单由计划审校后给出）——不侦察就只能猜
   选择器，违「不猜」纪律；
2. 后继契约（生产件级）：编译原子与回放共用的动作前有界就绪等待、登记
   关闭动作的原子候选、剖面 `loading` 形态迁移核对；
3. 用例重造件 + 重签 + 真机三轮复跑全 PASS；
4. 回填本账本，P9 方可关账。

## 2026-07-30 晚追记：闭环真因修复已在真机验证

契约 `teachin-raw-actionability-closure` 六阶段推进到 loop（gate GREEN 3/3）。
真机重录实证（`runs/teachin-uat/tc_wf_list_smoke_cycle_20260730_1930/` 边车）：

| 项 | 修前（07-30 晨） | 修后（07-30 晚） |
|---|---|---|
| seq 1 点击 | `performOk: false` | **`performOk: true`** |
| seq 2 点击 | 未执行（consumedEvents 0） | **`performOk: true`** |
| 停在哪一层 | `source-raw-execute` | `source-resolved-completion` |

即：驱动误读拓扑返回契约这一真因，在真机活体链路上确认修复。

**新阻断（下一层）**：`resolved-completion.result-shape` 拒付
`SOURCE_SEMANTIC_COMPLETION_INVALID`。该码是外层统一码，`projectAndVerify`
的六类以上内层具名拒付被吞，边车拿不到 → 真因不可判。**不猜**，起窄契约
`cycle-evidence-inner-reason` 把内层码按闭合枚举带出来，再录一次即可定位。

**环境侧同日修复**：Windows 侧反向代理进程（7 月 17 日起连跑近两周）劣化，
浏览器成批发请求时丢连接致前端 JS 代码块拿空响应、单页应用离不开登录页
（登录接口本身一直 200 成功）。Steven 授权后重启，登录探针 7 秒通过、
零失败资源。WSL 侧监听进程健康未动。

## 2026-07-31 凌晨订正：publish 只剩一个阻断点，且是断言口径不是动作

四轮真机（`run_baseline1/2_20260730`、`run_loadfix1/2_20260730`）逐轮核实：

| 事实 | 证据 |
|---|---|
| 12 步动作**全部** `result=ok`，四轮无例外 | 各轮 `run-history.jsonl` 逐行 |
| 唯一非 PASS 是 `atstep_11` 关闭步，四轮一致 | 各轮 `verdict.json`：`NEEDS_HUMAN / SUT_DEFECT_OR_STALE` |
| 保存步 `atstep_8` 四轮**全 PASS** | 同上，`workflow.save` 逐轮 `result=ok` 且步级 PASS |

**订正一：保存步的「顶栏延迟挂载」诊断不成立。** 上节记的
`resolution: none, candidateCount: 0` 是重表达前的旧样本；重表达后四轮
`locatorResolution: unique`、步级全 PASS。剖面加的 `loading` 活配置
（`cases/tc_wf_publish_states/profile.json`，原 `quiet.loadingSelector` 是运行时
从不读取的死配置）已经覆盖这一面。保存步**不再是阻断项**，此前判它「系统性红」
是把一次旧样本当了稳定结论。

**订正二：关闭步动作是对的，错的是断言口径。** 真机探针实测：按 Esc 前
「创建时间」DOM 命中 1、可见命中 1；按 Esc 后 **DOM 命中仍 1、可见命中 0**
——浮层视觉关闭但节点不卸载，而现役 `assert.textHidden` 数的是 DOM 命中。
作者层注册表把该原子定义为 `toBeHidden`（含未挂载），**签字时的契约本来就是
可见性，现行实现才是偏离**。故这不是「证据不足以冻结替代选择器」，不需要
Steven 带外侦察关闭控件——契约 `assert-visibility-semantics` 修采集口径即可。

**因此上节「需要的动作」四条作废，改为**：①`assert-visibility-semantics`
落地（红金牌九钉已冻、accept 已过、实现在跑）；②publish 真机四轮全 PASS，
首末轮保留 DOM=1/可见=0 辅助探针（唯一能区分「修对了」与「把动作失败洗绿」
的证据）；③回填本账本，P9 方可关账。

## 2026-07-31 凌晨追记：tier-2 A4 的真实阻塞面

A4（`selftest --tier2 --sut <回环>`）**当前跑不出 exit 0，且不是工装问题**：

1. 现役成员集只有一员 `tc_agent_id_readback_real_uat_v1`，其 `preconditions`
   明写真实环境须预置名为 `atl_同名对抗0722` 的智能体一枚，而该件已在
   2026-07-23 见证收尾时按「我建我删」清理归零——**须由人重新预置，否则
   本例必落非 PASS，属真机前置事实不是工装红**（清单原文）；
2. 清单要求的两份带外收据 `runs/_tier2/win-probe-target.result.json` 与
   `runs/_tier2/out-of-band-account-receipt.json` **两份都不存在**
   （目录下只有 `win-probe-challenge.json` 与八份 judge-smoke 产物）；
3. 另四例（chiefcomplaint / catalog_wf_crud / wf_publish_states /
   wf_history_version）全在 `pendingMembers`，卡「C 轨授权」，其中三例还要
   每 run 逐次 `--authorize-mutation`。

即 **A4 是人闸不是机器闸**，我无法代跑。隧道本身健康（回环探针 HTTP 200、
4.4 秒）。

## publish 转绿实录（2026-07-31 凌晨，契约 `assert-visibility-semantics`）

契约六阶段推到 loop 收口，gate GREEN 3/3，金牌十钉（红先行 exit 1、2/9 → 修后
exit 0、10/10）。异构评审 codex sol max 两轮：r1 逮到 1 条 Critical（两次采样
窗口的真假绿），已修并补 V10 钉住，delta 复审在跑。

**真机 A4（跑在含 Critical 修复的最终码上，共五轮）**：

| run | 结论 | `textHidden 创建时间` | 同轮正向断言 |
|---|---|---|---|
| `run_final1_20260731` | 6/6 全 PASS | `ok:true actual:0` | 三条均 `ok:true actual:1` |
| `run_final2_20260731` | **抖动作废** | `ok:true actual:0`（**空过**，见下方订正） | 三条均 `false/0` |
| `run_final3_20260731` | 6/6 全 PASS | `ok:true actual:0` | 三条均 `ok:true actual:1` |
| `run_final4_20260731` | 6/6 全 PASS | `ok:true actual:0` | 三条均 `ok:true actual:1` |
| `run_final5_20260731` | 6/6 全 PASS | `ok:true actual:0` | 三条均 `ok:true actual:1` |

`run_final2` 抖动如实记账、不当噪声抹掉：它在 `atstep_1`/`atstep_2` 就
`locatorError`（`res=none`），**失败点在定位层不在文本采集层**，与本次改动无关。

> **📌 订正（2026-07-31 落签前独立复核，逐行读 `run-history.jsonl` ×
> `verdict.json` × `axes.json`）**：本段原写「其后全是级联」「且系统没有假绿」，
> 两处都写过强，收窄如下——
>
> 1. **级联断在 `atstep_10`，不是一路到底**。`atstep_11`（`workflow.closeDrawer`）
>    动作层是 `ok`（按 Esc 不需定位，`res=null`），并落**步级 PASS**。
> 2. **步级有一处空过**：该轮 `atstep_11`（`intent_5`）的 `textHidden 创建时间`
>    是 `ok:true actual:0`，但同轮 `atstep_10` 的 `textVisible 创建时间` 是
>    `ok:false actual:0`——浮层**从未打开**，「创建时间」本就不可见，负向断言
>    平凡为真。前置从未成立，这一过不携带信息。
> 3. **run 级 `fail-safe` 没有失效**：`atstep_7/8/9/10` 四步落
>    `NEEDS_HUMAN` / `INDETERMINATE`，全轮未判全绿，机器没把这轮报成通过。
>
> 这条订正**加固而非削弱**四轮采认：它是活体反例，证明 `textHidden actual:0`
> 单独一条不足以证明动作发生，必须与同轮 `textVisible actual:1` 配对——
> `run_final1/3/4/5` 四轮都有这个配对，`run_final2` 没有。

**辅助探针（GRILL A4 硬要求，不是可选项）**：首末轮各一次，独立浏览器会话，
产物 `docs/plans/assert-visibility-semantics/evidence/a4-probe-{first,last}-round.json`：

```
beforeEsc: { dom: 1, visible: 1 }
afterEsc:  { dom: 1, visible: 0 }
verdict:   HIDDEN_NOT_UNMOUNTED
```

两次一致，独立复现了真机接缝——按 Esc 后节点仍在 DOM 但不可见。这条与「同一轮内
`textVisible 创建时间 actual:1` → `textHidden 创建时间 actual:0`」互为佐证：
动作若没发生，可见计数不会归零。**即这不是把动作失败洗绿。**

探针脚本 `scripts/visibility-a4-probe.mjs`（`runs/` 全仓 `gitignore`，故挪到跟踪面），
头注记了踩通的四个坑，其中一条对后续真机工装有普遍价值：**登录预备动作在慢渲染下
会误判成「已登录」**——它只给登录表单 3 秒出现机会，超时即判表单不在场、直接返回
`{loggedIn:true, viaForm:false}`，于是根本没登录却报成功。

## 2026-07-31 人闸进展：两笔裁定到位 + 三笔换签落签

### 已到位的裁定（Steven 2026-07-31 会话内）

| 岔口 | 裁定 |
|---|---|
| UAT 签认书：最终码五轮里一轮抖动作废，四轮够不够签 | **够签**，抖动如实记账即可；`run_final2` 明细保留在签认书第二节，不删不淡化 |
| D5：四态徽章渲染覆盖洞 甲/乙 | **择甲**（补齐 `p7-report` 夹具两步 + 一次换签）；乙案未采纳、文本留档 |

两份草案已按裁定定稿到「答案已落、只等人签」：
`P9-UAT-SIGNOFF.draft.md`（签认人与日期两栏留白）与
`D5-ACCEPTANCE-SEMANTICS-REVISION.draft.md`（三处文本仍一字未动，待明签）。
甲案的夹具补齐与换签由后继契约承担（另派代理在做），prd 名待回填。

### 三笔换签落签（`PENDING_STEVEN` → 如实签字记录）

Steven 2026-07-31 会话内明示「签字」（对应待裁信主题「[待裁]P9 已推到只剩
签字」四项）。三份 prd 的 `checksumAmendments` 相应条目已由 `PENDING_STEVEN`
改为 `signedBy: Steven` + `signedAt` + `signedVia`（`signedVia` 如实写明凭据
是那句会话内明示、签的是本批换签整体而非逐条技术细节、字段由代理代填）：

- `loop/prd-assert-visibility-semantics.json`
- `loop/prd-teachin-raw-actionability-closure.json`
- `loop/prd-teachin-cycle-evidence.json`

### 落签后复跑门禁的结果（判绿只信退出码）

| prd | gate 退出码 | 说明 |
|---|---|---|
| `prd-assert-visibility-semantics` | **0 GREEN** 3/3 | 无异常 |
| `prd-teachin-raw-actionability-closure` | **1 RED** 2/3 | s2 红 |
| `prd-teachin-cycle-evidence` | **1 RED** 2/3 | s1 红 |

**两处红都不是签字改出来的**（签字字段不参与金牌执行），而是**此前的陈旧绿被
这次复跑照出来**——两者同一个根因：`tests/_golden/teachin-cycle-evidence.zero-sut.golden.mjs`
自 07-30 起处于后继契约 `cycle-evidence-inner-reason` 的**红先行**态（归因枚举
须 22 员、现役实现 21 员，故 E10 系列整组红）。

- `prd-teachin-cycle-evidence` 的 s1 直接消费该金牌 → 红，属**红先行的预期态**，
  待 `cycle-evidence-inner-reason` 实现落地后自然转绿；
- `prd-teachin-raw-actionability-closure` 的 s2 邻接面清单里也列了该金牌 → 连带红。

两份 prd 的 `passes` 已由 gate 按实翻 `false`（`true → false`，gate 是唯一有权
写 `passes` 的）。这正是护栏 #19「强制层落地必复跑受影响金牌」要防的陈旧绿，
两份 prd 从 07-29／07-30 起就一直扛着假绿到今天。**这两处红与 P9 关账口径的
关系需 Steven 定**：它们不在真机 UAT 清单五行里，但确实是仓内两份 prd 的现役
非绿态。

## 待决

- 后继契约与 tier-2 谁先占契约槽（tier-2 收口在即，预计先收 tier-2 再开）；
- 三轮复跑是否必须换新实例（计划建议如此，防把一次绿当时序问题消失）；
- **tier-2 A4 的三项人闸**（重新预置智能体、两份带外收据、C 轨授权）由谁
  在什么时候做——不解这三项，P9 的 tier-2 面永远停在待办。**该项 2026-07-31
  仍未裁定**，是签认书第四节唯一未填的一栏；
- 上节两处红先行陈旧绿（`teachin-cycle-evidence` 与连带的
  `teachin-raw-actionability-closure`）是否阻挡 P9 关账。


## 2026-07-31：P9 关账

**P9 已关账。** 清单五行全过，不走 waiver——与 Steven 2026-07-30 定的关账口径一致。

Steven 2026-07-31 会话内三问三答落定最后三关：

| 问 | 答 |
|---|---|
| UAT 签认书 | 「1、签」 |
| D5 三处文本修订 | 「2、签」 |
| A4 的 exit 2 算不算满足 | 「3、满足」 |

三关之前另有四项裁定同日落定：抖动那轮够签、徽章覆盖洞择甲、tier-2 三项人闸
由他本人处置（后经实况核查全部解除）、清单扩集换签落签。

### 关账时的四项已知开口（都不阻塞 P9，但要记着）

1. **流式面无合格件**：`tc_chiefcomplaint_smoke` 缺 `entity-locks.frozen.json`、
   死在语义锁准入门跑不了。A4 按条款走 exit 2 分支采认，但覆盖面确实是空的。
2. **八份 prd 的同笔债**：上条与本轮照出的七份（`prd-kinds-harden` /
   `prd-replay-settle-mount` / `prd-p5-replay` / `prd-chief-bringup` /
   `prd-chiefcomplaint-smoke` / `prd-login-traffic-drop` / `prd-wf-history-version`）
   是同一根因——2026-07-24 前后语义锁准入门落地后这批用例从未重新表达。另立契约清偿。
3. **三例变更型无清理链**：`tc_catalog_wf_crud` / `tc_wf_publish_states` /
   `tc_wf_history_version` 的回放链没有删除原子，每轮在真实环境留不可逆残留。
   Steven 2026-07-31 裁定「先给三例补清理链再跑」，故它们虽已入清单但**不得实跑**。
4. **徽章颜色语义仍无判别力**：`p7-report` 只钉中文态名、未钉徽章 CSS 类，
   `HARNESS_ERROR` 与 `NEEDS_HUMAN` 的颜色可被改成通过绿而门禁不红。另立契约清偿。

### 两笔待签换签（P9 之外）

`loop/prd-p7-report.json` 与 `loop/prd-seams-freeze.json` 各一笔
（徽章夹具补两态），均 `PENDING_STEVEN`。注意：`testChecksums` 已同步更新，
**机制面是绿的，欠账只剩一个不被强制的字符串**——没有任何机器会拦它。

## 2026-08-03：重启后最终主树重验证

本节不改写 2026-07-31 已签关账口径；它记录后继红先行修复落主树后，按 Steven
要求重新取得的机器与真机证据。

### 修复、评审与机器门禁

- `cycle-evidence-inner-reason` 已按 Git 原生方式从隔离 worktree 集成到 dev，
  主树提交为 `5e4af27`；实现新增 `raw-axes.projection-denied`，业务拒付返回与
  外层控制流不变。
- Grok 4.5 与 pi.dev `deepseek-v4-flash` 均开放完整 worktree/仓库只读能力后终判
  `PASS`；无 Critical、High、Medium。完整结论见
  `docs/plans/cycle-evidence-inner-reason/review.md`。
- 主金牌 `teachin-cycle-evidence`：89/89，exit 0；其 owner gate：3/3 GREEN。
- `selftest --tier1` 连续两次 exit 0；P9 机制金牌：111/111，exit 0；P9 owner
  gate：3/3 GREEN，s2 由 gate 从 false 翻回 true。
- 曾被同一红先行金牌连带拉红的 `teachin-raw-actionability-closure` 也已复跑为
  3/3 GREEN，s2 由 gate 从 false 翻回 true。漂移扫描与术语检查均 exit 0。

### Tier2 真实目标只读复跑

- `doctor` exit 0；回环到真实目标 HTTP 200；Windows fresh-challenge 探针
  HTTP 200；带外账户回执在窗内。
- 预置只读核验为 `ALREADY_PRESENT_EXACTLY_ONE`，没有创建或清理实体。
- 本轮运行目录：
  `runs/tc_agent_id_readback_real_uat_v1/run_tier2_20260803T020936042Z_8f3d85/`。
  receipt 为 `pipeline_complete_with_verdict`、`ran=true`、`timedOut=false`、
  `classificationProblems=[]`，十项正式附件齐全；状态计数为 1 PASS、
  1 NEEDS_HUMAN、0 SUT_DEFECT、0 HARNESS_ERROR。
- Tier2 总 exit 2 的唯一开口仍是已签口径中的流式面空；17 项 readiness 全绿，
  取证面非空、裁判通道 SUT_DEFECT 面成立。裁判通道证据为
  `runs/_tier2/judge-smoke_20260803T020935613Z_f64167/tier2-judge-smoke.json`。
- `video.webm` 非空（142930 bytes）；首、中、末关键帧人工复核可见启动、智能体
  列表与精确搜索后恰一目标卡片，未见空白页或异常跳转。

### A4 两击真机复录

全新目录：
`runs/teachin-uat/tc_wf_list_smoke_cycle_20260803T021410Z/`。人工只做
「智能应用 → 工作流管理 → 完成录制」，capture 记 2 条点击事件；record exit 1
仍是计划内的闭环拒付，不冒充通过。

新边车
`cycle-evidence.d1f294fe719abce056fbaa42ff07471757b958b834a5f939ccf36f0930c3a9ea.json`
按顺序给出：

1. 两条 `raw-runner.event` 均为 `resolution=unique`、`candidateCount=1`、
   `performOk=true`；
2. 新内层 `raw-axes.projection-denied` 为闭合六码中的
   `RAW_AXES_PROJECTION_FAILED`，不是 `OTHER_REASON`；
3. 随后既有外层与编排边界均为 `SOURCE_SEMANTIC_COMPLETION_INVALID`。

因此 A4 的目标已经满足：真机首次把内层真实拒付原因稳定带出，同时证明外层统一码
与控制流未被本次取证改造改写。P9 在最终主树上的重验证完成。
