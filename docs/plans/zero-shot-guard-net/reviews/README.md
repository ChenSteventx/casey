# 评审收据 · zero-shot-guard-net

## R0（前提审，实现前）

| 项 | 值 |
|---|---|
| 被审对象 | 契约草案全文（`scratchpad/draft-guard-net.md`，只读起草、仓库零字节写入）+ fable 已定的十条裁决 |
| 评审性质 | **计划前提审**，不是代码审——评审时代码尚未写。攻击面是计划的前提、划线标准、豁免理由与遗漏影响面 |
| 代码基线 | `e6e7ea1`（评审期间作者零改动；评审方变异全部在 `/tmp` 副本） |
| 作者家族 | Claude（Opus 5） |
| 评审家族 | 非 Claude —— 满足异构冗余（`CONTEXT.md` Dissimilar Redundancy、护栏 #9） |
| 评审方 | `grok-4.5`，reasoning-effort high，tmux 真 TTY 多轮 agent 循环，`--cwd` 指真工作树（只读） |
| 评审输入 | `premise-review-input.md`（裁决清单 + 六项必须自验的重点 + 真仓只读访问；不含作者推理叙述） |
| 产物 | `premise-grok-4.5-high.txt` |
| 结论 | `VERDICT: PLAN_CHANGES_REQUIRED`，**无 Critical**，一条 High + 两条 Medium（即全部需改集合） |

> `codex` 本轮无额度（Steven 2026-08-03 告知），按 `docs/runbooks/review-model-budget.md` 改由 grok 顶上；
> grok 非实现家族，异构门成立。

## R0 的三条 finding 与 fable 裁决采纳记录

| 编号 | 级别 | 内容 | 评审方证据 | fable 裁决 | 落地位置 |
|---|---|---|---|---|---|
| H1 | High | 未知键对照钉的注入路径未钉死，存在实现期做歪的承重歧义。今天未知键在两条路径上行为不同（实测）：经 `observePage`/`scopesOf` 时 `{probeScope:true}` 被白名单丢掉、scopes 全假、resolver 放行；合成观察件直喂 resolver 则拦。正确实现后 `normalizeUnsupportedScopes` 同样剥掉未知键，若对照钉走 normalize 链，钉会**错红**——它测的是 observation 形状而非判据语义 | 两条注入路径各自实跑 | **采纳**：对照钉写死为直接调用 `anyUnsupportedScope({probeScope:true})` 与 `anyUnsupportedScope(['x'])`，禁止经 `normalize`/`observePage` 链；四点拒付钉只遍历 `UNSUPPORTED_SCOPE_KEYS` 内的键 | `GRILL.md` G5、`plan.md` §4.2、元钉 N11 |
| M1 | Medium | 草案 G4/R4「字节等价」表述不成立（但「可改夹具」这个结论仍成立）。旧 `copyUnsupported` 恒吐三键，通用透传输出键集变窄：`{iframe:true}` 旧吐三键、新吐一键；`{}`/`[]` 旧吐三键全假、新吐空记录 | 逐输入对照表；并在只改夹具的状态下实跑 5 枚直接依赖夹具的金牌，全部 `EXIT=0`（`page-observer` 8/8、`resolver` 16/16、`action-progress` 12/12、`authority-runner` 11/11、`typed-progress` 24/24） | **采纳**：废除「字节等价」表述，改为「经 `scopesOf` 归一后行为等价」；原 R4「唯一未实测的承重推断」降级为已实测事实，其余邻接仍按护栏 #19 全量复跑 | `GRILL.md` G4、`plan.md` §4.4 |
| M2 | Medium | §2.4 A「17 条」与文件清单 16 路径的计数口径宜写清（`setup-runtime-barrier` 在 s5 与 s6 各挂一次），避免实现期按 17 个文件去找 | 逐行数 `prd-zero-shot-observe-admit-step.json` 的 `stories[].acceptance` | **采纳**：写成「17 条 acceptance / 16 个唯一命令路径（barrier 双挂）」 | `plan.md` §7 A |

## R0 明确判「无发现」的面（评审方自验，非作者自述）

| 重点 | 结论 | 怎么验的 |
|---|---|---|
| P1 / P2 / P4 探针主张 | 无发现，主张成立 | `/tmp` 副本独立复现：P1 流氓模块 + 未改金牌 `5/5 passed` `EXIT=0`（五网全不响）；P2 补丁后 `0 passed, 5 failed`（d1 未登记 / d2 704 行 / d3 playwright+fs / d4 playwright / d5 环）；P3 删流氓后 `5/5` `EXIT=0`；P4 第四键下 after 判 `progressed`、admission 拒因漂成 `RESOLUTION_AUTHORITY_INVALID`，对照组 `containerOnly` 四点全 `UNSUPPORTED_SCOPE` |
| 并集严格度（草案 R3） | 计划口径对；实现坑另开 H1 | 镜像现役三处判据做形状矩阵：未知键在 resolver 拦、在 `scopesOf` 后 observer 不拦、在 admission 枚举不拦；非空数组同理。确认「只遍历 `UNSUPPORTED_SCOPE_KEYS`」会把合成观察件上未知键从拦变放（确属放松），G3 并集写法可避免；畸形形状保持返回假与现役一致 |
| 夹具通用透传回归面 | 零红；表述另开 M1 | 只改 `copyUnsupported` 后跑 5 枚直接依赖夹具的金牌全绿；不 import 夹具的邻接金牌与该改动正交 |
| 影响面 / 是否有第四个 PRD | 无发现，无第四个 PRD | 对 `loop/prd-*.json` 全集扫 `testChecksums` + `stories[].acceptance`：boundary 金牌 checksum 仅命中 `observe-admit-step`；其 acceptance 另命中 typed-progress s4 与 teachin-cycle-evidence s2；`adapter-double` checksum 仅命中 `observe-admit-step`。teachin s2 确为 17 条且含 boundary 金牌（草案 R5「易漏支」判断正确）。`CONTEXT.md` 真文件无 checksum 锁 |
| `CONTEXT.md` 文案 + `term-lint` | 无发现 | 提案整行按 `|` 切分为 4 列、第四列仍为 `—`；`parseRegistry` 对提案注册表 `registryErrors=0`、`resolution` 行 `scanText` `errors=0`；无新增繁体、无加粗英文术语；若 `container-out` 进第四列则 `agent-search-gate.mjs`、`prd-entity-ui-wiring.json`、`entity-ui-wiring.searchopen.golden.mjs` 三处均 ERROR（与草案一致） |
| 红证据成色 | 无发现，姿态合格 | 认可分工：范围 1 对现状零行为差、常驻金牌造不出「洞在」的红，变异 transcript（P1 绿 / P2 五红）证明的是「网缺席」而非「接口未出现」；范围 2 的 N1/N10 是标准 ATDD 接口红，真 fail-open 由 P4 与 `unsupported-scope-fanout.red.txt` 承担。评审方给出的标准与草案一致：洞 = 可构造合法输入使现役门放行、修补后应收紧；接口缺席红只能证「还没写」，必须另附洞的变异/行为 transcript |

## R1（代码级异构评审，实现后）

| 项 | 值 |
|---|---|
| 被审快照 | `e6e7ea1..24e0508`（三个提交，评审期间作者零改动） |
| 作者家族 | Claude（Opus 5） |
| 评审家族 | 非 Claude —— 满足异构冗余（护栏 #9） |
| 评审方 | `grok-4.5`，reasoning-effort high |
| 风险清单 | 八项：并集严格度与 H1 落点 / d3 反转 / 夹具透传 / R12 checksum 字节核 / `CONTEXT.md` 词条 / 元钉三路变异 / 提交卫生 / 边界门发现与断言 |
| 结论 | `CHANGES_REQUIRED`，七项无发现且全部取证通过，**一条 Medium finding** |

### R1 的 finding 与处置

| 编号 | 级别 | 内容 | 作者独立复现 | 处置 |
|---|---|---|---|---|
| F1 | Medium | 「无子目录」钉被指向目录的符号链接绕过。`zeroShotDirectoryLikeEntries` 的前身只用 `Dirent.isDirectory()`；对 symlink-to-dir 它恒为假、`isSymbolicLink()` 才为真，于是链接既不进本钉、`discoverZeroShotCore` 的平铺发现也扫不进链接目录里的模块 | 已在工作树复现：`ln -sfn <仓外目录> lib/zero-shot/smuggle-dir` 后金牌 `5/5 passed` `EXIT=0`；`Dirent` 判据实测 `isDirectory()=false, isSymbolicLink()=true` | R13 修：符号链接解引用一次（`statSync`），指向目录即红；解引用失败按 fail-closed 一律红。补第四份 red-proof `subdirectory-symlink-bypass.red.txt` |

评审方另核过的对照组（作者已复核一致）：真子目录红 d1；文件符号链接 `.mjs` 红 d1 与 d3；
dangling symlink 红多网。本轮选定的 dangling 目录链接口径是**一律红**，理由写在
`plan.md` §3 与 red-proof 尾注：`statSync` 抛错时门证不出「它不是目录」，
按护栏 #14 证不出就红、不默认放行。

### 未闭项（如实挂账）

R1 判 `CHANGES_REQUIRED`，本轮已按 F1 修完并补齐证据，但**修复后的复审尚未进行**——
按「评审修正要复审」纪律，合并前须由非实现家族对 R13 这一处修复 hunk 再看一轮。
本收据不替代它。
