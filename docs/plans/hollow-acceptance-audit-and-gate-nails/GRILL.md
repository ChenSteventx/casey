# GRILL — hollow-acceptance-audit-and-gate-nails（空心验收审计 + 门禁反例钉）

## 授权凭据（如实标注，不把转达当亲签）

推 grill 阶段用了 `--user-confirmed` 半硬旗标。该旗标的机器语义是「人已确认」，机器验不了是否真被 grill 过，
所以此处逐项交代凭据来源，供后续追溯：

| 事项 | 来源 | 性质 |
| --- | --- | --- |
| 「开」这条工作线 | Steven 2026-07-31 口述 | **本人裁定**（经上游代理转达） |
| 「先咨询顾问」 | Steven 2026-07-31 口述 | **本人裁定**（经上游代理转达） |
| 只做顾问推荐顺序的第一步 | 顾问 `gpt-5.6-sol` max 只读结论第 4 节末段 | 顾问建议 + 上游代理采纳 |
| 本文以下 Q1–Q7 的决策树 | 本代理自裁 | **代裁，Steven 本人未被 grill 过本契约决策树** |
| 入口分流由 `full` 改 `light` | 本代理按三判据自裁 | **代裁**，理由见 Q1 |

结论：**Steven 本人授权的是「开这条线、先问顾问」，不是本文的决策树**。Q1–Q7 全部是代裁，
任一条若与他的意图不符，以他的裁定为准，本契约产物须回炉。凡涉及改 `passes`、动验收、处置具体 prd 的
动作一律不在本契约范围内（见 Q4），故代裁面被刻意压到「只产审计事实 + 只产红钉」。

## 事实底座（本代理自取，不抄顾问转述）

取数口径：`git show b3bee6b^:loop/prd-*.json` 与工作树当前值逐 story 比对，隔离件闭集取
`tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json` 的 `sourceGolden` 去重（27 枚）。

- `b3bee6b^` → `b3bee6b`：影响 **63** 条 story、删 **168** 条指向隔离件的验收命令、**新增 0** 条。与
  `docs/plans/hermetic-golden-zero-sut-lifecycle/implementation-evidence.md` 记载一致。
- `b3bee6b` → `HEAD`：两端都在的 story 里，隔离件引用**净变化为 0**（既没被删更多，也没被塞回）。
  例外说明见下一条。
- 63 条中当前 `passes` 为真的是 **51** 条，为假的是 **12** 条。
- 原子义务账：349 条义务 / 27 枚源件；`retain-isolated` 239、`survive-unit` 99、`superseded` 11、
  无 `retire`。隔离账 239 条中 `uncertain` 233、`partial` 6。
- 27 枚源件里 **21** 枚同时含 `retain-isolated` 与 `survive-unit`（混合体）。
- `gate.mjs` 现状（`loop-kit/bin/gate.mjs`）：`storyGreen` 从 `true` 起步（:90）；story 回写只看
  `storyGreen`、不看全局 `red`（:108）；`evidence` 只有时间戳、不绑验收内容（:109-111）；
  `total`/`green` 按 `prd.stories.length` 统计（:120-121），空 `stories` 时判 `GREEN 0/0`、退出 0。
- 现役数据：`loop/prd-cli-mcp-face.json` 两条 story 验收数组为空（`passes` 均为假）；8 份 prd 的
  `stories` 为空数组。

## 决策树

### Q1 入口分流该走哪条车道

**定 `light`。** 三判据逐条：改不改数据——否（零 `passes` / 零验收 / 零账本 / 零 `lib`·`bin`·`web`
改动）；影响几个文件——新增 4 份文档 + 1 枚金牌，修改 0 份既有文件；跑多久——单会话。

另有一条结构性理由使 `full` 不成立：`full` 的 accept 阶段要求本契约自己的 prd 带非空 `testChecksums`，
loop 阶段要求每条 story 的 `passes` 为真；而本契约唯一的实现交付物是**必须保持红**的反例金牌。
推 `full` 等于要求把红钉洗绿，与任务判据正面冲突。

不选 `kernel` 车道：该车道管的是「触强制层的**改动**」。本契约只描述 `gate.mjs` 的缺口、不改它；
真正改门禁是第三步，那一步须自带 `kernel` 车道，本契约不替它预支评审。

（利益冲突披露：改判后另一条契约的提交门槛由 `loop` 降为 `plan`。该后果不是改判依据；
判据只有上面三条 + 结构性冲突。降为 `light` 也不解除互锁，本契约仍须真推 grill 与 plan。）

### Q2 分类判据用机械的还是语义的

**定机械优先，语义分歧显式挂账。** 分类只吃三个可机读输入：当前验收数组、`b3bee6b^` 验收数组、
隔离件闭集。理由：顾问的 `flow-bridge-insufficient` 六条用的是「story 描述明确承诺浏览器端到端」这一
语义判据，人读可靠但不可复算，将来加判据时无法据以自动豁免或拦截。机械判据可复算，语义判读进 `note`。

代价：机械判据下 `flow-bridge-insufficient` 是 9 条不是 6 条，与顾问结论不符。分歧如实记，见 Q3。

### Q3 与顾问结论不一致时以谁为准

**以本代理自取的为准，分歧点在清单 `note` 与 md 正文各记一次。** 任务书明写「凡与顾问结论不一致的，
以你核到的为准并在 `note` 里点出分歧」。实测只有一处实质分歧（3 条 story 的类目归属），
其余 8 项交叉核对与顾问逐数吻合，吻合项也如实记为「已独立复算」而非「照抄」。

### Q4 清单要不要顺手处置

**不。零处置。** 不动任何 story 的 `acceptance`、不手改任何 `passes`、不给任何 prd 挂新验收命令、
不把 27 枚隔离件以任何形式写回任何验收面、不把 `hermetic-golden-surviving-units` 的聚合命令挂给任何
story。处置的方向会随本清单的结论调整，先冻结事实再谈处置。

### Q5 合法 tier1 回归 story 收不收进清单

**收，作白名单。** 13 条在 `b3bee6b` 前后验收逐字节相同、`removedByIsolation` 为空，义务本就是
「新增门面不得破坏确定性内核」，拿 `tier1` 当验收是对的。将来加「只剩 tier1 不得翻绿」判据时，
没有这份白名单必然误伤这 13 条，所以它们必须与病例同处一份冻结件。

### Q6 空 `stories` 那条钉怎么钉才不冤枉登记账

**钉机制、不钉数据。** 反例只断言一件事：`gate.mjs` 在 `stories` 为空数组时会打印 `GREEN` 并退出 0。
断言对象是合成的临时契约，不是现役那 8 份。现役 8 份（`prd-replay-admission-hermetic-migration` 与
7 份 `prd-tc_*`）是用例级校验和登记账、不是可执行质量契约，本契约**不判它们违规**，只把
「两类 prd 如何机械区分」作为待裁问题显式提出（钉子内挂账注释 + 清单 md 专节）。

### Q7 反例金牌怎么写才不是假绿

**每钉都 spawn 真 `gate.mjs` 二进制，不测纯函数。** 依据是既有教训：抽验证器时只测纯函数等于假绿，
因为生产路径可能根本没接线。做法是用 `LOOP_KIT_ROOT` 指向临时目录里的合成最小根
（只含 `loop/config.json` + 合成契约 + 两个平凡退出码脚本），零真机、零 SUT、零浏览器、
零凭据、不碰真仓任何文件。判红只信退出码与 `gate.mjs` 自己的输出。

## 停手边界

- 不改 `gate.mjs`、`contract.mjs`、`prd.schema.json`（改门禁是第三步，须走 `kernel` 车道）。
- 不改任何 `loop/prd-*.json`。
- 不碰 `lib/` 下 `SIDE_EFFECT_POLICY` 相关件（另一条线在改）。
- 不提交、不推送。
- 不处置 27 枚隔离件、不回填隔离账两处摘要漂移。
