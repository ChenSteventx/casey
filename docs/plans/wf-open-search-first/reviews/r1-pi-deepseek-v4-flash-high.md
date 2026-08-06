# 代码评审 · wf-open-search-first（f417c3e，异审方 Claude）

## 复核范围与证据链（全部实跑，非仅读码）

**变更面**：`git diff 909c101..f417c3e` 恰 5 文件（1 改 + 4 新增），白名单外零改动 ✓。

**验证矩阵**（真工作树只读执行 + /tmp 拷贝变异）：

| 项 | 结果 |
|---|---|
| 新金牌 `wf-open-search-first` | 4/4 exit 0（15.3s） |
| 冻结 `post-nav-anchor-wait`（风险 2 要求实跑） | 5/5 exit 0（33.3s）——S1 真轮询 ≥2 采样、S3 耗尽 <20s 与新前奏共存 |
| 邻接 `wf-crud-sleep-import` / `wf-create-entry-anchor-wait` / `term-lint` / `selftest --tier1` | 4/4、3/3、0 提示、GREEN |
| 真实 compileFlow 消费者 `entity-workflow-source-readback.wiring` | 18/18 exit 0（H2 容器闸/中止语义未被前奏扰动） |
| `wf-delete-card-layout` | 25/25 |
| 红基线（/tmp 拷贝 `git show 909c101` 还原） | 2/4 exit 1，S1「应恰发 3 事件：1（click）」/ S3「须有搜索先行」与 red-proof 逐字节同 |
| 复原闭环 | sha256 `a74a3a41…` 与工作树逐字节同 → 4/4 exit 0 |
| PRD testChecksums 三条 | 自算 sha256 与 PRD 全等（含路径修正：red-proof 实位 `docs/plans/wf-open-search-first/accept/red-proofs/`） |
| 变异 A（条件预算改无条件 15s） | S2 红（30061ms > 20s）——封顶钉有判别力 |
| 变异 B（删除目标先见跳过、恒搜索） | S4 红（发 fill）——直点钉有判别力 |

## 风险逐条结论

1. **双目标轮询语义**：目标先见 → 跳过搜索 → 就绪锚重轮询（新 15s 预算）→ emit 点击身份门在动作时刻再核 count===1，竞态窗（轮询后消失）全程 fail-closed 保留；双在场时目标优先判（列表已新鲜直点正确）。✓
2. **条件预算**：三路径账目已核算——见目标 `t_seen+≤15s`；真搜索（真机搜索框恒在场、首轮即 break）≈0+2s+≤15s≈17s；双缺席 ~15s（S2/frozen S3 双钉钉死）。最坏链 vs 看门狗 120s：open 原子病理态 ~31s（搜索框迟到 15s 且搜索不返回），B4 观测全链 45.7s，余量充足但收窄（见 M2）。
3. **事件面**：放大镜 click 与 create 分类壳 `{fieldLabel, fallbackCss}` 先例真同构（compile `locatorFor` 与 replay `semanticLocator` 同一 getByLabel→CSS 回退语义）；fill value 模板原样入 events 与 deleteByName/create 先例一致，编译期（compile-atoms-run.mjs:235）与回放期（replay-actions.mjs:249）均实例化。✓
4. **金牌判别力**：S1/S3 红基线真实、S2/S4 突变判别力实锤（上表）；状态化替身 searchIssued 由图标点击 emit 翻真，忠实于查询驱动渲染、无倒裁。✓
5. **红证真实性**：/tmp 回退实跑逐字节复现 + 三条 sha256 自算核对全过。✓
6. **deleteByName 互扰**：见 M1。

## Findings

- **[Medium] lib/compile-atoms-workflow-nav.mjs:90-93（配合 lib/compile-atoms-workflow-crud.mjs:291-311）——open 搜索先行后列表进入按名过滤态，与后续 deleteByName 的互扰无 hermetic 覆盖、真机验证被上游阻塞。** open 的图标点击搜索会令列表 DOM 只含目标卡（seam-1 已核 Enter 不过滤、仅图标过滤）；deleteByName 自带 nav（detail→list 是真实路由变更，按 B4 机理应重挂载列表组件）但搜索框过滤态是否随组件缓存/keep-alive 泄漏属 SUT 行为，零 SUT 金牌无法证。泄漏时 delete 的 recordDomains 扫描/计数口径对账会失配 → 硬阻断 route:human，绝不静默误删（fail-closed ✓）；同名链（B4 一建一删同名）泄漏亦无害。但 PRD observability 将核验挂 B4 七跑，而 B4 现卡在「flow 重表达 vs CASE_DEFECT」岔口等 Steven 裁，此 deferral 可能无限期。建议：挂账 B4 七跑现场核（现状已挂），或在 deleteByName 编译侧补一道可证的重置观察（如 nav 后核搜索框值是否被清空，证不出则照走既有 fail-closed）。

- **[Medium] lib/compile-atoms-workflow-nav.mjs:89-93、101——「失败路径总额不累加」的承诺只对双缺席支路成立，搜索已发但目标仍缺席的支路可叠加到 ~30s 且无钉覆盖；openSearched 不经 emit 结果判定。** S2 钉与 frozen S3 钉只钉双缺席（搜索框永不挂载 → 前奏 15s + 锚 0 预算）；搜索框在场但搜索后目标仍缺席的支路 = 前奏（真机首轮 break，≈0s；病理态搜索框迟到则 15s）+ 锚 15s。且 `openSearched = true` 在两次 emit 后无条件置位——即使 fill/图标 click 未 acted（absent/ambiguous）也照样授予锚 15s 新预算，与「已见目标或真发起搜索才给新预算」的表述不符。最坏链对 120s 看门狗仍有余量（观测 45.7s、病理叠加 ~75-90s），PRD 亦已挂账「+15s 同面账本」，故非 High。建议：两处低成本收紧——`openSearched = (r1.resolution==='unique' && r2.resolution==='unique')`（图标未真实动作不授新预算）；或在金牌加一钉：搜索框在场+目标恒缺席 → 总额 <20s（把真机最常见缺席路径也纳入封顶）。

**Low 备注（不计入结论）**：① probe 对 `count≥1` 即判「列表已新鲜」——隐藏/陈旧副本命中会跳过搜索，但容器归属闸与 emit 身份门仍 fail-closed（count=1 容器外→硬阻断、count>1→ambiguous 拒点），无假绿；② 图标 click 的 `fieldLabel:'搜索'` 若真机 getByLabel 命中非图标元素将优先于 CSS 回退——与 create 分类壳先例同型既有模式，失败后果 fail-closed；③ S3 结构钉与注释措辞耦合（词汇碰撞纪律第二例，deliberate）。

**历史红金牌边界澄清**：`wf-open-smoke.golden.mjs` 现红（原子集 18→26 漂移 + 身份绑定门），已在基线 909c101 实跑证同红——非本变更回归；`arming.static` 是设计恒红的红先行金牌。均不在现役绿集。

## 结论

两 Medium 均为 PRD/plan 已明示的已知挂账（预算累加同面账本、B4 七跑现场核），失败模式全 fail-closed，四项金牌判别力实锤，红证与 checksum 全真，冻结金牌共存实证，事件面与既有 schema 真同构。无 Critical/High。

IMPLEMENTATION_VERDICT: APPROVE
