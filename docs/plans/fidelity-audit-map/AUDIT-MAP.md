# fake-sut 保真审计地图（ADR-0009 甲 · 只读盘点）

> 目的：兑现 ADR-0009 选项甲的**保真审计**义务——每个 `fake-sut` 场景须对真机采样核对、不符则修 fake 复现真接缝。本文是**只读盘点**产物：逐场景摸清「谁加的、声称复现哪条真接缝、现有几分真机背书、与真机不符会漏什么」，形成后续保真契约的**施工底图**。
>
> 方法与边界：全程只读——只读 `tests/fixtures/fake-sut/server.mjs` 与其 `CONTRACT.md`、各契约 `GRILL`/`plan`/`learn`、`cases/*/observed-*.json`（编译期真机采样）、`runs/*`（真机运行证据）、`docs/HANDOFF.md`、ADR-0006/0007/0009、`lib/atoms-registry.snapshot.json`（`regress_autotest` 真机硬化知识快照）。**本盘点不驱真机、不是真机采样**：真机采样核对是下一步（`route:human`，即需真人到场的行程）——平台 `saveOrModifyProcess` 曾于 2026-07-14 持续回 503（两次连撞、机器正确判 `SUT_DEFECT`）、2026-07-15 已恢复返 200（挂账观察是否复发），系统采样行程需 Steven 在场 + 隧道 + `autotest` 账户（SUT 账户禁令）。
>
> 事实源优先级：`server.mjs` 的 `SCENARIOS` 集合为场景清单唯一事实源——实数 **35 个**（含基线 `happy` 与 `churn`，多于 ADR-0009 讨论时的「约 22 个」口径）。

## 三档验证状态定义

- **真机采样背书**：库内有真机证据（`cases/*/observed-*.json` 编译期采样、`runs/*` 真机运行取证、契约 GRILL 里标注的真机实采/亲验条目）佐证该接缝真存在。多数为「部分背书」——核心接缝有据、具体 DOM 形态仍待采，表内注明程度。
- **设计推定未采样**：场景照设计/评审推定建造，注释与 GRILL 无真机采样背书（多数硬化反面场景属此——保真缺口候选）。注意：`registry`（`regress_autotest` 原子注册表快照）背书属**二手真机知识**（姊妹仓对真机硬化的 SOP），不等于 Casey 自己的采样，本盘点计入「设计推定」但在接缝列注明。
- **已补平**：按 ADR-0009 已完成「真机采样→修 fake 复现」闭环的场景。现仅 `mountdelay` 一例，且**须更正**：2026-07-15 真机复验（`run_1784069823273`）证明第一轮补平不忠实——真机是「请求结束、DOM 早期两拍稳定后框架再延迟约 2.7s 提交按钮」，fake 是「应答后立即替换 DOM」，hermetic（封闭自足、零外部依赖）金牌绿而真机仍假阴；二轮 full 契约已在 `HANDOFF` 排队。故标「已补平（部分）」。

## 场景 × 保真盘点主表

| 场景 | 出处契约 | 声称复现的真机接缝 | 保真验证状态 | 保真风险（不符会漏什么） |
|---|---|---|---|---|
| `happy` | `p5-replay`（假 SUT 初版八态） | Heren 中台基线通路：列表页「新增工作流」抽屉（名称输入 + 分类下拉 + 确定）→ save POST 成功信封 `status:200` → 跳详情 + toast「新增成功」 | 真机采样背书（部分）：信封字段 `status`/成功值 200 有 4 件 `observed-*.json` 采样（88 条全 `field:"status"`）；SPA（单页应用）路由与新增 SOP 有真机运行佐证。**已知偏差三处**（真机 bring-up 五雷实证）：真机表单标签是 `div` 无程序化关联、抽屉 footer 按钮是 `div` 非 `button` 角色、分类下拉无 `combobox` 角色——fake 用 `<label for>`/`<button>`/`role=combobox` | **高**——基线场景承载全部金牌；三处角色偏差靠实现侧「真机分支」兜住而非修 fake，hermetic 金牌测不到真机分支，该分支回归即假绿盲区 |
| `inject500` | `p5-replay`（八案 `SUT_DEFECT`） | save 接口回 HTTP 5xx、错误信封归本步背书 `SUT_DEFECT` | 真机采样背书（部分）：2026-07-14 真机 `saveOrModifyProcess` 连撞 503，信封提取 `actual:503, ok:false`、机器正判 `SUT_DEFECT`（`runs/tc_wf_publish_states/run_1784055459649`）；fake 用 500 + JSON 体 `{status:500}`，真机 503 响应体形态未逐字核对 | 中——若真机 5xx 回 HTML 错误页/无 JSON 体，信封提取路径与 fake 形态分叉，5xx 背书链未被该形态检验 |
| `envelope200bad` | `p5-replay`（八案第二条背书路） | HTTP 200 软失败信封：`body.status≠200`（如 50001）——Heren 招牌缺陷形态（ADR-0006 / `regress_autotest` 真机硬化知识） | 设计推定未采样（半边有据）：信封字段形态真机背书充分，但**软失败实例本身库内零真机样本**；`50001` 是合成值 | **高**——这是「被测缺陷」主检测路之一：若真机软失败用别的字段/嵌套/文案形态，`SUT_DEFECT` 直接漏成 `PASS`（假绿方向） |
| `background401` | `p5-replay`（八案背景不归因） | 背景轮询（denylist 内、定时器发起）回 401 不得归本步、不翻裁定 | 设计推定未采样：真机 `observed` 无轮询端点、无 401 样本；冻结 seams fixture 里的 poll 401 是**合成设计夹具**（`seams-freeze` 0-INDEX 明言），非真机采样；真机背景请求归因（`initiator:"background"`）本身有采样 | 中——真机登录态过期形态若非「背景 401」（如 302 重定向、本步接口 401），归因判定未被真形态检验，可能误归本步翻 `SUT_DEFECT` 或漏判 |
| `stream` | `p5-replay`（八案流式 `PASS`） | LLM 回复走 SSE 流、`finished` 事件为静默点（非 `networkidle`） | 真机采样背书（部分）：真机流端点已采（`tc_chiefcomplaint_smoke` 的 `replyStreamUrl:/ai-api/tester/agent/stream`，当次 `replyText` 为「会话异常」）；SSE 事件名与信封形态（`delta`/`finished`）未见真机字节样本 | 中——若真机流结束信号非 `finished` 事件（连接关闭/别的标记），静默点判定与回复聚合错位，流式步裁定失真 |
| `pageerror` | `p5-replay`（八案 `route:human`） | 页面 JS 抛错 → `lifecycle.pageerror` 归本步 → `NEEDS_HUMAN` | 真机采样背书（部分）：2026-07-14 真机 503 撞出 axios 抛错，`pageerror` 记录归本步实录在案（`run_1784055459649` forensics：`Request failed with status code 503` 归 `atstep_7`） | 低——浏览器 API 语义，与 SUT 形态弱耦合 |
| `drift` | `p5-replay`（八案 `HARNESS_ERROR`） | 工装漂移：录制脆性 css 失配、同稳定签名（`role=button` name=删除 withinRow）唯一仍在 → 自愈开闸前提 | 设计推定未采样：类名照 `drift-patch.fixture`（合成 seams 夹具）复刻；真机列表行删除按钮的角色/类名未采（真机 UAT 的 `deleteByName` 步 `PASS` 佐证删除可供性成立，但走的解析形态未核） | 中——真机若按钮无 `button` 角色（五雷⑤示对话框按钮即 `div`），稳定签名恒 0、漂移探针永走 `vanished` 分支：方向 fail-safe 不假绿，但自愈链在真机空转 |
| `vanished` | `p5-replay`（`drift` 反面 `INDETERMINATE`） | 目标元素连同稳定签名一起消失 → 证不出漂移 → fail-safe 落 `NEEDS_HUMAN` | 设计推定未采样（同 `drift` 地基） | 低——fail-safe 方向，不符最多多路由人工 |
| `ambiguous` | `p5-replay`（八案多匹配） | 语义定位器多匹配（两个同名「保存」按钮）→ 绝不动手 | 设计推定未采样：双保存钮是合成形态；接缝族有真机近亲实证（分类下拉选项文本撞列表页分类 tab 亲验、节点名同活面板与画布） | 低——fail-safe 方向（`ambiguous` 绝不变更 SUT） |
| `stale_bg401` | `p5-replay`（八案 `SUT_DEFECT_OR_STALE`） | save 干净成功但页面不推进（成功不导航）+ 背景 401 同刻返回的归因时间窗坑 | 设计推定未采样：组合合成形态；「成功但未推进」的二义家族真机有近亲（`tc_wf_publish_states` `intent_1` 计时假阴正属该 reason 家族） | 中——真机时序若使背景 401 与本步窗口重叠更紧，按发起方归因未被真形态压测，误归即翻 `SUT_DEFECT` |
| `versioned` | `plan-debt-sweep` D1 | 入口脚本 `src` 带 `?v=` 发版号（Heren `api-config.js?v=1.1.2` 形态）→ `capturedAgainstBuild` 提取 | 设计推定未采样：`learn.md` 明言真机 `?v=` 提取实证挂账 `route:human`；且 2026-07-02 真机采样里 `api-config.js` **无** `?v=` 查询串（见异常清单） | 低——提取不到落 `null` 不影响裁定；但期望版本化（`signedAgainstBuild`）语义空转 |
| `drawernone` | `wf-open-node`（评审 F3/coverage） | 单击节点无响应「点了不开」→ `openNode` 落 `action_failed` 不假绿 | 设计推定未采样（反面考场）；正面「单击开抽屉」有 registry 真机 SOP 背书（GRILL D1 定案单击、否决双击笔误） | 低——反面走 fail-safe |
| `drawersuperset` | `wf-open-node`（评审 F3） | 开错抽屉：标题含节点名子串非精确（「模型节点副本」）→ 钉精确回读 | 设计推定未采样：真机节点抽屉标题呈现是否含前后缀，GRILL D5 明确挂账 `route:human` | 中——真机标题若真带前后缀，精确回读把合法开抽屉全线误拒（假阴瘫痪该原子）；反向若真机另有子串假绿形态未建模则漏 |
| `ddmulti` | `wf-select-node-dropdown`（D7 反面族） | 下拉浮层内目标选项出现两次 → 多匹配绝不点 | 设计推定未采样：触发器/浮层类名（`.hr-select`/`.hr-select-option`）真机未采、HEREN 同库假设待核（GRILL 明言）；正面 SOP（「请选择」→浮层→点选项→值变）registry 背书 | 低——fail-safe 反面 |
| `ddabsent` | `wf-select-node-dropdown` | 浮层不含目标选项 → 缺席不点 | 设计推定未采样（同上地基） | 低——fail-safe 反面 |
| `ddwrong` | `wf-select-node-dropdown` | 选后触发器值成「选项+副本」（含子串非精确）→ 钉身份回读精确律 | 设计推定未采样：真机选后值呈现是否精确含选项，GRILL 挂账 `route:human` | 中——真机值若带修饰（前后缀/图标文案），精确回读全线假阴；真机若有别的「选错还回读成立」形态则漏假绿 |
| `ddtwin` | `wf-select-node-dropdown` | 抽屉双触发器 + 预挂一层隐藏 stale 浮层含目标（teleport 未清理形态） | 设计推定未采样：真机浮层 teleport 到 `body`、是否残留 stale 层未核；「浮层脱离抽屉、全局文本撞页」有真机近亲亲验（`.hr-select__list:visible` 限定） | 中——真机若确有残留浮层而可见性门形态不同，可能点进死浮层假绿 |
| `ddempty` | `wf-select-node-dropdown` | 抽屉开但域内无下拉/无字段（`count=0`）→ execute 预检缺席半边 | 设计推定未采样（真机是否存在无下拉节点抽屉未采） | 低——fail-safe 缺席方向 |
| `setmulti` | `wf-set-node-field`（D7） | 抽屉内两个同占位符字段 → 多匹配未给 `nth` 绝不填 | 设计推定未采样：字段类名与占位符（`.hr-input`/「请输入接口的URL」）真机同族假设待核（GRILL 明言，registry `:252` 二手背书）；真机同占位符多字段是否实存、有无可区分标签锚，`route:human` 挂账 | 低——fail-safe 反面 |
| `setclash` | `wf-set-node-field` | 抽屉外挂同占位符孪生字段 → 全页 `count=2`、唯域锁内 `count=1` 才动手 | 设计推定未采样（同上地基） | 低——域锁收紧方向 |
| `setsuffix` | `wf-set-node-field` | 字段 `input` 事件追加尾巴 → 回读成填入值超集 → 钉 `inputValue()` 恰等精确律 | 设计推定未采样：真机字段是否有格式化/联动改写行为未采 | 中——真机若有合法格式化（trim/掩码/自动补全），精确回读把合法填值误拒（假阴）；若真机另有「改写后含 want」假绿形态未建模则漏 |
| `ddhidden` | `replay-nth-visible-hardening`（fix#2） | 隐藏触发器占 DOM 序 index 0 → 域锁须限 `:visible` | 设计推定未采样（评审发现的防御性硬化）；可见性过滤必要性有真机近亲亲验（遮罩拦点/`:visible` 限定） | 低——收紧方向 |
| `twinfield` | `drawer-lock-hardening`（GRILL D7，源头 codex-sol 异构冗余评审 MED#2 挂账） | 同页第二个可见同类名抽屉容器（冒牌抽屉）挂唯一同占位符字段/触发器 → 钉跨抽屉误命中 | 设计推定未采样：挂账源头是评审假想接缝非真机观测；GRILL 自认「真机通常单抽屉在场」；真机节点抽屉**容器类名未采样**（三契约共同挂账）。真机确有「测试面板与抽屉并存」近亲形态（`agent.openTestPanel`） | 中——域锁地基（容器类名+标题锚）若与真机结构不符，三原子在真机全线 `ambiguous`/`none` 假阴瘫痪；反向若真机多抽屉形态不同则域锁空防 |
| `twinboth` | `drawer-lock-hardening`（D7 评审修订） | 真/冒牌抽屉各挂同占位符字段+触发器 → 钉「域内唯一才动手」正面半边 | 设计推定未采样（同 `twinfield` 地基） | 中——正面半边不符 = 合法操作被拒（假阴）或域锁误放（假绿）双向 |
| `twintitle` | `drawer-lock-hardening`（D7） | 点了不开 + 画布外预挂冒牌抽屉含节点标题精确文本 → 钉 `openNode` 开错抽屉归因假绿 | 设计推定未采样 | 中——真机若存在含同名文本的别抽屉（列表页/面板），标题锚归因需真形态检验 |
| `twinlate` | `drawer-lock-hardening`（D7 评审修订新增） | 点击同刻动态挂出含标题冒牌抽屉 → 钉「点击后才出现的冒牌」 | 设计推定未采样 | 低——收紧方向，域级 `count=2` 落 `ambiguous` fail-safe |
| `twinghost` | `drawer-lock-hardening`（D7 评审修订新增） | 冒牌抽屉标题文本 `display:none` 隐藏 → 钉「标题文本自身须可见」 | 设计推定未采样 | 低——收紧方向 |
| `twindelay` | `drawer-lock-hardening`（实现评审 r1，codex HIGH#1） | 域计数后、动作前 3000ms 延时前插同标题冒牌 → 钉检查后窗口（`TOCTOU`，检查与使用之间被换梁）漂移 | 设计推定未采样（评审构造的对抗窗口） | 低——防御性收紧；真机页面主动前插同标题抽屉的概率低 |
| `ghostdup` | `drawer-lock-hardening`（实现评审 r1，codex/pi 双路 MED#1） | 合法正面：可见标题前挂 `display:none` 同文案隐藏节点 → 合法抽屉不得被误拒 | 设计推定未采样：「真机形态如抽屉头部隐藏提示文本/占位副本」是推定 | 中——这是**误拒（假阴）保护面**：真机若确有隐藏同文案在前的合法结构而判定形态不符，合法用例全线被排出域 |
| `pinclone` | `drawer-lock-hardening`（实现评审 r2，codex HIGH） | 页面脚本监听并复制 `data-casey-domain-pin` 属性到冒牌抽屉 → 钉 pin 须验物理同一 | 设计推定未采样（对 Casey 自身定位机制的对抗考场，非 Heren 真机行为） | 低——防御性；真机页面不会对抗 pin 机制 |
| `fieldmove` | `drawer-lock-hardening`（实现评审 r3 前置独立审查 HIGH） | 字段 `focus` 时同一物理 `input` 被搬到冒牌抽屉 → 动作窗口须重验物理包含 | 设计推定未采样（对抗考场） | 低——防御性收紧 |
| `triggermove` | `drawer-lock-hardening`（实现评审 r3 前置独立审查 HIGH） | 触发器点击后被搬离域 → 点选项前须重验物理包含 | 设计推定未采样（对抗考场） | 低——防御性收紧 |
| `pinmove` | `drawer-lock-hardening`（实现评审 r4 汇裁 A2 HIGH） | pin 被摘下搬到无标题嵌套同类名子容器 → 钉唯挂点闸（承载者须与被钉节点物理同一） | 设计推定未采样（对抗考场；「嵌套同类名 wrapper」结构真机未核） | 低——防御性；但若真机确有嵌套 wrapper 结构，域计数语义需真形态复核 |
| `mountdelay` | `replay-settle-mount`（M5，ADR-0009 甲第一块） | 详情页「页面加载中」静态占位 + 数据请求驱动 SPA 延迟挂载 + toast 3000ms 自动消隐 | **已补平（部分）**：接缝真机实证充分（`tc_wf_publish_states` 真机 run 铁证、ADR-0009 触发事件）；但 2026-07-15 真机复验（`run_1784069823273`）证伪忠实度——真机是「请求结束 + DOM 早期两拍稳定 + 框架延迟约 2.7s 提交按钮」，fake 是「应答后立即替换 DOM」；二轮 full 契约已排队（`HANDOFF` 当前状态第 4 条） | **高**——现行已知最大保真缺口：hermetic 金牌绿、真机仍假阴（`intent_1` `NEEDS_HUMAN`），静默点条件在按钮挂载前放行 |
| `churn` | `replay-settle-mount`（M5） | DOM 每 100ms 持续追加 + 背景轮询 → 两拍稳定不可达、走时上界兜底 | 设计推定未采样（合成极端形态，走时上界考场；背景轮询族真机有据） | 低——性能上界考场，失败方向超时 fail-safe |

## 计数小结

- 场景总数：**35**（以 `server.mjs` `SCENARIOS` 为准，含基线 `happy`）。
- 真机采样背书（含部分背书）：**4**——`happy`、`inject500`、`stream`、`pageerror`（均为部分背书，形态细节待采）。
- 已补平（部分）：**1**——`mountdelay`（真机复验证伪忠实度，二轮契约已排队）。
- 设计推定未采样：**30**。

## 优先补平候选（平台恢复后系统采样的优先队列）

排序原则：假绿方向（漏判被测缺陷）优先于假阴方向（误拒合法操作）；单点场景之上，先补**共同地基**——多个场景骑同一条未采样假设时，采一次样即批量核销。

0. `mountdelay` 二轮（已排队，非本清单新增）：补「应答结束 + DOM 早期稳定 + 按钮延迟提交」子形态 + 强化静默点条件——`HANDOFF` 已立项，真机证据齐备，唯一进行中的补平。
1. **`envelope200bad`（高，假绿方向）**：软失败信封库内零真机样本，而它是「被测缺陷」主检测路。采样目标：真机制造/等到一次业务失败，核对失败信封的字段名、取值、嵌套与文案形态。
2. **`happy` 基线偏差三处（高，结构性盲区）**：真机表单标签 `div` 无关联/footer `div` 按钮/下拉无 `combobox` 角色已实证，但修在实现侧「真机分支」而 fake 未跟——hermetic 金牌测不到真机分支。候选修法：fake-sut 增设真机形态半边（或场景开关），让真机分支进 hermetic 可证面。
3. **节点抽屉族共同地基（中，双向）**：真机节点抽屉**容器类名、标题呈现、触发器/浮层/字段类名与占位符**全部未采样（`wf-open-node` D5、`wf-select-node-dropdown`、`wf-set-node-field` 三契约挂账合并行程）——`drawernone`/`drawersuperset`/`dd*` 五连/`set*` 三连/`twin*`/`pin*`/`*move` 共 **24 个场景**骑在这条假设上。一次采样行程核销最大面。
4. **精确回读三律的真机值呈现（中，假阴方向）**：`drawersuperset`（标题前后缀）、`ddwrong`（选后值修饰）、`setsuffix`（字段格式化改写）——三条精确律若与真机呈现不符，合法用例全线假阴。与第 3 条同行程顺带采。
5. **背景 401 与登录态过期形态（中，归因方向）**：`background401`/`stale_bg401` 的轮询端点、401 时序、过期表现（401 或 302）真机未采；冻结 seams 夹具里的 poll 记录是合成的。采样目标：真机放置到登录态过期，录背景请求归因形态。
6. **`ddtwin` stale 浮层残留 + `ghostdup` 隐藏同文案结构（中）**：真机浮层 teleport 清理行为与抽屉头部隐藏文本结构——决定可见性门是防真缝还是空防/误拒。
7. **`drift`/`vanished` 稳定签名可供性（中，自愈链）**：真机列表删除按钮的角色采样——若无 `button` 角色，自愈开闸条件在真机永不成立，整条自愈链空转。

## 挂账（本盘点的明确边界）

- 本文是**设计推定层的映射**：三档判定基于库内已落文档与运行证据的只读盘点，未做任何真机核对。真机采样核对是下一步（`route:human`）：平台 `saveOrModifyProcess` 503 已于 2026-07-15 恢复（记账观察复发），行程需 Steven 在场 + 隧道 + `autotest` 账户；行程建议按上节优先队列执行，每核一条在本表登记「对真机采样核过、复现了哪条真接缝」的台账（ADR-0009 审计产物要求）。
- 表内「真机采样背书」多为部分背书：接缝存在性有据、字节级形态（响应体/事件名/类名）未逐字核对——升格为全背书须以采样台账为准。
- registry 背书（`regress_autotest` 快照）是二手真机知识，快照日 2026-07-02，本身也有陈旧风险，采样行程中一并复核。

## 盘点中发现的异常（不改任何文件，仅记录）

1. **`mountdelay`「已补平」口径已被真机复验推翻**（`HANDOFF` 2026-07-15 更正）：ADR-0009 写「第一个已知缺口由 `replay-settle-mount` 修复」，但真机复跑 `intent_1` 仍 `NEEDS_HUMAN`——引用 ADR-0009 时须连带此更正，防止「第一块已补平」被当成完成信号（正是护栏 #16 同型坑）。
2. **`versioned` 场景与真机采样存在张力**：场景注释称复刻 `api-config.js?v=1.1.2` 形态，但 2026-07-02 四件真机 `observed-*.json` 里 `api-config.js` 均**无** `?v=` 查询串；`plan-debt-sweep` `learn.md` 已挂账真机实证。若真机确已去掉 `?v=`，`capturedAgainstBuild` 提取在真机恒 `null`。
3. **冻结 seams 夹具易被误读为真机采样**：`tests/_golden/fixtures/seams/observed-reality.fixture.json`（含 poll 401 记录）与 `drift-patch.fixture.json` 是 `seams-freeze` 契约的**合成设计夹具**（0-INDEX 明言供下游并行开发），`CONTRACT.md` 说「复现 observed-reality 的 poll 记录」指向的正是它——不是真机证据。审计台账须区分「复现合成夹具」与「复现真机采样」。
4. **真机 toast 采样全空**：四件真机 `observed-*.json` 的 `toastTexts` 全部为空数组，而合成夹具与 fake-sut 里 toast 有值——旁证真机 toast 消隐窗早于采样点（`mountdelay` 已建模 3000ms 消隐，其余 34 个场景 toast 常驻，此差异面覆盖全部带 toast 断言的通路）。
5. **场景清单口径漂移**：ADR-0009 与任务口径「约 22 个」对实数 35（含 `happy`/`churn`）；后续保真契约排期按 35 计，且 24 个场景共享节点抽屉族同一条未采样地基（见候选第 3 条），工作量结构与「逐场景 × 均摊」估算不同。
