# evidence · 工作树夹具复制与实现前基线（2026-08-04）

工作树 `casey-p9-replay-authority-split`（分支同名），基线 `dev` @ `96f6107`，lane=full。
本文件记两件事：从主树复制了什么（fable 2026-08-04 批准，Q8），以及动生产件之前的基线。

## 一、八枚 v3 金牌的实现前基线（全绿）

动任何生产件之前实跑一遍，逐条退出码在此立账。实现期间任一枚偏离本表即算行为漂移，
按停机条件立即停、报主循环。

| 金牌 | 退出码 | 尾行 |
|---|---|---|
| `p9-created-workflow-continuity-v3.created-in-run.zero-sut` | 0 | 8/8 全过 |
| `…stable-absence.zero-sut` | 0 | 8/8 全过 |
| `…tier2-cleanup.zero-sut` | 0 | 6/6 全过 |
| `…role-compile-sign.zero-sut` | 0 | 9/9 全过 |
| `…authority-cli.zero-sut` | 0 | 6/6 |
| `…replay-evidence.zero-sut` | 0 | 4/4 |
| `…tier2-production.zero-sut` | 0 | 5/5 |
| `…legacy-fixed-id-supersession.zero-sut` | 0 | 4/4 |

采集命令（逐枚 `node tests/_golden/<件>.mjs`，取真实退出码，不 grep 失败标记串）。
本表在写完红金牌草案之后**又复跑一遍**，八枚仍全 0，即红金牌的加入零副作用。

## 二、从主树复制的件（绝不软链）

来源 `/mnt/d/ctx/heren/casey`，方式 `cp` / `cp -r`（`cases/` 与 `runs/` 均在 `.gitignore`，
复制不进版本库、不污染 `git status`）。

| 件 | 用途 |
|---|---|
| `cases/tier2-suite.manifest.json` | 已签清单真件；`replayGrantPath` 字段形状的对照基准，实现期供 `readSuiteManifest` 类钉跑通 |
| `cases/tc_agent_id_readback_real_uat_v1/` | 五成员之一（read 型） |
| `cases/tc_chiefcomplaint_smoke/` | 五成员之一（read 型） |
| `cases/tc_catalog_wf_crud/` | 三条变更型之一 |
| `cases/tc_wf_publish_states/` | 三条变更型之一 |
| `cases/tc_wf_history_version/` | 三条变更型之一 |
| `cases/tier2-suite.manifest.v3.draft.json` | v3 清单草案；`replayGrantPath` 落位的同构对照（第二批批准，见下） |
| `runs/_tier2/`（建空目录） | 核销台账与票据的落点；本轮未复制其下历史件 |

两件清单复制后逐字节核过，两侧 sha256 同一：

| 件 | sha256 |
|---|---|
| `cases/tier2-suite.manifest.json` | `89dea66de4965a0ab5a5c1e2eca0b8ad61952b50b920027eb1353191a2a7acfb` |
| `cases/tier2-suite.manifest.v3.draft.json` | `4b447ef56e04826c55080b78cb8c3a93d3e783ee6936d405ad92c58874d177ba` |

**复制方式一律真复制（`cp`），绝不软链**——软链会触 sign 的物理边界核并按设计拒付
（guard-net O1 已实证）。两件均已核 `[ -L ]` 为假，是普通文件。

**如实标注两条：**

1. `cases/tier2-suite.manifest.v3.draft.json` 在第一批批准清单里没有，本轮起初**未复制**，
   只在主树只读查看了顶层字段形状；fable 于本轮后段补批准后**已真复制进树并加入白名单**。
2. 红金牌当前九条钉**全部 hermetic**（合成夹具），不依赖上述复制件。
   复制件的用处在实现期：清单改字段后要拿真件复核 `readSuiteManifest` 与
   `p9-tier2-selftest` 的 T9a 面，并对着 v3 草案核 `replayGrantPath` 的落位是否与
   `winProbeResultPath` / `outOfBandReceiptPath` 同构。

## 三、红先行基线

`accept/red-proofs/replay-authority-split.red.txt`：**0/9，exit 1**。
spawn 面全程带 `CASEY_LAUNCH_SENTINEL`（`bin/replay.mjs:450` 于 `chromium.launch` 前短路），
**本轮零浏览器启动、零 SUT 接触**。

红证里最该看的一条：R1/R2 今天的红不是「拒因文案不对」，而是
**哨兵落了盘**——拿一份 `audience:test` 的结构授权边跑回放，票据位塞结构件本身、
或干脆不塞，都能一路跑到 `chromium.launch`。回放面确实没有运行期授权闸，
这就是本契约要堵的洞。

如实标注：R3a（票据喂结构面 reader 必拒）在实现后属**回归守钉**而非新增拦截力——
结构面 reader 今天已能拒异种件（`authorityShape` 的精确键 + 字面量守卫，
`lib/entity-created-workflow-continuity-v3.mjs:364-371`）；它在红证里红，
是因为造不出票据夹具，不是因为守卫缺席。不冒充新增能力。

## 四、本轮未做（等 grok 前提审）

生产件一行未动：`lib/` 与 `bin/` 零改动，八枚 v3 金牌零改动，
`loop/` 下无新 PRD、无 checksum 冻结、未 advance 阶段。
过审后按 `plan.md` §7 的交付顺序从第 2 步起跑。

## 五、行号核对（对当前 HEAD `96f6107` 逐条实测）

送审前把三份文档里引用的定位行号全部对着 HEAD 复核了一遍（工作树对这些件零改动，
即工作树 = HEAD）。核对器带反控：故意对一处塞不存在的串，确认它会报不符，不是白过。

**四处 amendment 点位全部对上：**

| 点位 | 引用 | 核验 |
|---|---|---|
| `…authority-cli…` A6 | `:103-122` | 起于 `test('A6 混入 bindAgent…')`，止于该用例末 |
| `…authority-cli…` A2 | `:73-79` | 起于 `test('A2 prepare/freeze/read/controller…')` |
| `…replay-evidence…` | `:51` | `createCreatedWorkflowReplayContinuityController` 调用行 |
| `…legacy-fixed-id-supersession…` | `:56,65` | 两处 controller 调用行 |
| `…tier2-production…` T5 | `:80-118` | `function manifest(includeV3)` 到 T5 用例末 |

**生产件引用全部对上**：`entity-created-workflow-continuity-v3.mjs` 的 `:11`/`:21-27`/
`:350-353`/`:364-371`/`:716`；`replay.mjs` 的 `:70-73`/`:144`/`:179`/`:450`；
`compile.mjs:168-176`；`entity-authority.mjs` 的 `:2`/`:129-142`；
`selftest-tier2-manifest.mjs` 的 `:28-32`/`:71-74`/`:236-283`/`:285-323`；
`selftest-tier2-collect.mjs` 的 `:33`/`:291-295`/`:378-379`。

**两处引用有偏差，已改正**（原值是估的，实测后修）：

| 引用 | 原写 | 实测 | 已改 |
|---|---|---|---|
| v3 `plan.md` §12 首条 | `:200-201` | `:198-199` | GRILL 两处 |
| `SIGNING-SESSION.md` 十行人签清单 | `:65-77` | `:63-76`（节标题到表末行「序 10」） | GRILL 一处、plan 一处 |

## 六、红证复采（对最终字节）

金牌定稿后又整跑一遍并覆盖落盘，红证头部记了被测字节的 sha256
（`106f22ce87759a2ca07c8b8f90ebcbde9ffa9bf4c131ccb019705a8ec66c520c`）与判据声明。
**结果 0/9、exit 1**，独立复跑退出码同为 1。判红只信退出码，不 grep 失败标记串。

## 七、grok 前提审后的改稿（r2，2026-08-04）

评审产物 `reviews/premise-r1-grok-4.5-high.txt`，判定 `PREMISE_FLAWED`。
方法前提全部采信，逮的是安全属性的时序与临界路径。逐条独立复现结论与改稿落点见
`GRILL.md` §七；本节只记可复核的事实。

**两条 Critical 的独立复现（我自己跑的，不是转述评审）：**

- `C1` 核销时序：`lib/selftest-tier2-collect.mjs:371-372` 实读，
  `consumeWinProbeChallenge` 位于前置门通过之后、成员循环（`:387`）开始之前，
  注释原文「前置门过了才作废挑战字」。**先烧后跑**。
  初稿 plan 写的「跑完再写台账」与所引先例相反，属实。
- `C2` 临界路径：初稿把台账只挂在 `lib/selftest-tier2-collect.mjs` 编排层，
  而 `bin/replay.mjs` 全程不读台账——一张已签未过期的票直接跑 `casey run`
  可在 `notAfter` 窗口内无限重放。「一次」当时只是 Tier2 礼仪，不是授权属性。属实。

**红钉由 9 个用例增至 14 个**（表内 R1–R13，R3 拆 a/b）：
新增 `R9` 过期拒、`R10` launch 前占用后第二进程拒、`R11` 采集面拒跑回执、
`R12` 票据与结构件受众一致性、`R13` 台账写失败即不放行。

`R10` 是 `C1` 的可证伪面：第一个进程在 `CASEY_LAUNCH_SENTINEL` 短路点停下时，
台账里必须**已经**有占用记录——若占用发生在跑完之后，这条断言必然读不到，钉不住就是没改对。

**红证 r2**（对最终字节重采）：`accept/red-proofs/replay-authority-split.red.txt`，
**0/14、exit 1、零浏览器启动**。

## 八、R2 双路复核后的再改稿（r3，2026-08-04）

pi 判 `PREMISE_SOUND`，grok 判 `PREMISE_FLAWED`（新 Critical）。按双路纪律退回再改。

**C-new 独立复现**（我自己跑的）：`lib/selftest-tier2-collect.mjs:186` 在成员循环
（`:405` 调用点）内逐个 `spawnSync` 一个 `casey run`，`:378-379` 全批共用一个 `batchToken`
——三条变更型是三个进程。上一稿「每 launch 前占用、命中 nonce 即拒」按字面实现，
成员②③必撞已核销，整批跑不通。**这条是我上一稿改 C1 时自己引入的**，
不是评审误读：把占用点从批前挪到每 launch 前，却没补批内语义。

改定为批会话协议（`plan.md` §3.3/§3.4）：每 nonce 一目录，`wx` 开会话绑 `batchToken`，
逐成员 `wx` 标记，三条核验全过才放行。

**金牌拆二**（实测触 600 阈）：

| 件 | 行数 | sha256 |
|---|---|---|
| `tests/_golden/p9-replay-authority-split.cli-session.zero-sut.golden.mjs` | 285 | 见红证头部 |
| `tests/_golden/p9-replay-authority-split.pure-suite.zero-sut.golden.mjs` | 218 | 见红证头部 |
| `tests/_golden/support/p9-replay-grant-fixtures.mjs` | 131 | 见红证头部 |

单枚旧金牌 `p9-replay-authority-split.zero-sut.golden.mjs` 已删除，内容全部并入上表两枚。

**红证 r3**（两份，对最终字节）：`0/12` 与 `0/8`，均 `exit 1`，零浏览器启动。
新增可证伪面两条值得点名：

- `R16`（同批第二成员必须放行）是 C-new 的**正控**——只钉拒不钉放行，
  会把「整批跑不通」这个坏实现judge成绿；
- `R18` 用**两个并发进程**抢同一成员标记，钉的是 `wx` 的原子独占
  （评审 M-new2 指出 `rename` 不是 check-and-set）。串行双跑钉不出这条。
