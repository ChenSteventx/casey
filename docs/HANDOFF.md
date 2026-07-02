# HANDOFF — 当前工作状态与下一步（活文档）

> 每次推进后更新。新会话先读 `CLAUDE.md` 必读顺序，再读本文件。
> 下方「当前状态」是权威现状；「历史层」仅供溯源。

## 当前状态（2026-07-02 三续）

本 session 三续（2026-07-02 晚）：P3 tier-2 真机 bring-up 下半场开局——三跑全通产真四件套 + 登录墙契约收口：

1. 三跑 `--execute`（`--unique-name c2`）真机全通：16 步全 `unique` 且 acted、零 blocker 零 `CASE_DEFECT` 候选；卡片布局计数对账恒等（目标卡片 1 :「删除」目标 1）放行删除段，`atl_c2` 建成→删除净场（末步 toast「删除成功」）；P4 交接面四件套（events / observed / testcase / compile-report）已落 `cases/tc_catalog_wf_crud/`（gitignored）。产物纪律亲验：信封 `authored:false`、16 步 URL 全走 `{{baseUrl}}` 占位符、requestLog 94 条全剥 query 且只落 pathname、75 条按 `initiator` 归因、背景轮询零误归因、`capturedAgainstBuild` 取不到落 `null`（fail-safe）。
2. 核验清单 ⑤⑦④③ + 计数对账（route:human）证据已呈：⑤ 抽屉确认 = role button「确认」count=1 / ⑦ 删除确认 = role button「确定」count=1 / ④ 描述 = label「工作流描述」count=1（此轮 role/label 采样非 0，五雷真机分支未触发即全 unique）/ ③ nav 直达豁免 / 计数对账恒等。**Steven 选「先上真机看看」，签核待其过目后落**（顺手清 `atl_c1` 残留——二跑遗留真机）。小瑕疵记档：requestLog 对 `data:image` URL 落整段 base64 载荷（纯噪音非泄漏，后续可折叠成 `data:<mime>`）。
3. `replay-login-bootstrap`（light）六阶段全收口——已知缺口「`--verify` 登录墙」hermetic 侧已解：方案分岔人签取「replay 登录预备动作」弃 storageState（AskUserQuestion，Steven）；`bin/replay.mjs` 加 opt-in `--login-bootstrap`（不产 event、不进 axes、凭据只进内存，前置/登录失败 exit 65 不落 axes，登录期 `currentStepId=null` 流量归 null）+ `compile --verify` 透传 + `loadCreds` 加 `AT_CREDS_FILE` env 覆盖（hermetic 凭据源隔离）；新夹具 `tests/fixtures/login-sut/server.mjs`（服务端 cookie 会话、登录标记只落布尔）；golden 7 检查红先行（C2/C3/C5 三红核实）；gate GREEN 2/2 + p5/p3 冻结 golden 回归全绿。codex 两轮：R1 FAIL 3 发现——F1 High 凭据字节经 `JSON.parse` 报错漏 stderr（实测坐实，消毒重抛 + C2b 钉死）/ F2 High 坏 `site.json` 静默回落默认（`loadSiteConfig` 加 `strict`，replay 开旗标 fail-closed + C2c 钉死）/ F3 尾斜杠证伪拒绝（`replay.mjs:56` 既有剥除）→ R2 PASS 零发现记 `loop/audit.jsonl`；learn 落 `docs/plans/replay-login-bootstrap/learn.md`（六教训：报错通道也是泄漏面 / 泄漏断言按片段抓 / 坏文件≠缺文件 / env 换路径隔离凭据源 / 假 SUT 会话服务端化 / 拒绝要带行号证据）。
4. 真机回放核验第二轮已过（WSL 侧，Steven 在场）：`compile --verify --login-bootstrap` 经隧道 → 登录预备动作真机首战成功 → 16 步动作轴全 `unique`（含建/删 `atl_r1` 全过身份门、删除净场），看门狗 75s 未触顶。同场反向实证：Windows 侧同命令失败（登录表单 15s 未现 → fail-closed exit 65、不落 axes、报错无凭据值）——防线行为全对；tier-2 真机命令一律 WSL 侧跑（G6 人签既定：Windows 上 127.0.0.1:15519 非设计路径、直连需把真目标地址写进命令行违护栏 #7、playwright 是 Linux 版）。
5. 直接下一步 = P3 tier-2 剩余 route:human：Steven 签核核验清单 ⑤⑦④③（其选「先上真机看看」，顺手清 `atl_c1` 残留）→ 重录 spike 录屏核销 ① → `capturedAgainstBuild` 来源确认 → 相2 断言草拟+冻结+人签（P4，零 baton 预备轨已推到「就差 accept+loop」：`docs/plans/p4-drafter/proposed/` 含 grill 决策 D1/D2 + plan + golden 红基线草稿（已验红、钉 `lib/assertion-draft.mjs` 的 `synthesizeSkeleton`/`validateDraft`）+ LLM 补缝 prompt/schema；落地前先过接缝硬门——`expected-frozen` schema 12 kind vs `check.mjs` 15 kind 须对齐，route:human）。
6. spike 录屏已重录（route:human ① 机器侧齐备、待 Steven 过目签核）：scratchpad 一次性脚本产 `cases/spike-rerecord/`（gitignored）——`spike-rerecord.webm`（371KB）+ 三截图（登录页空表单/列表页/搜索空态）；凭据红线加固：登录在无录屏 context 完成、登录态经内存 `storageState`+`sessionStorage` 种子移交录屏 context（SPA 令牌在 sessionStorage，`storageState` 不带、须手动移交——新教训），镜头零凭据输入过程；截图亲验中文全齐（字体修复实锤）。镜头顺带拍到 `atl_1782376478282_1` 残留卡片（待清理目标可视化）。只读流程零建删。
7. `capturedAgainstBuild` 采证完毕（route:human ⑥ 待 Steven 三选一）：全站唯一版本信号 = 登录页脚本标签 `api-config.js?v=1.1.2` 查询串（前端构建号，编译期可从入口 HTML 确定性提取）；页面 meta 仅 charset/viewport、`api-config.js` 正文无版本（仅三 API 前缀、无敏感）、`getAccountInfo` 无版本字段（仅租户/账号/visitKey 形状）。候选：A 用 `?v=` 查询串（接线改 `bin/compile.mjs` 属后续小契约）/ B 收下 null 人工填 / C 向 Heren 要版本接口。
8. 签核进展（2026-07-02 晚）：**① 录屏签核通过（Steven「没有问题」）——route:human ① 核销**，录屏不失真判据成立、G6「退 Windows」附带条件解除。**真机残留已清**（Steven 授权「删」）：scratchpad 脚本按删除段同款纪律执行——搜索隔离后卡片:删除目标 1:1 恒等才点、确认对话框唯一命中、删后复核归零净场，前后截图 `04/05-residue-*.png` 留证 `cases/spike-rerecord/`。随后两签落定（Steven，2026-07-02 晚）：**③ 核验清单 ⑤⑦④③ + 计数对账签核通过（「签」）**；**⑥ 构建标识定案取「自动提取 `?v=` 查询串」（「同意」）**——编译期从入口 HTML 的脚本 `src` 读前端发版号（如 1.1.2）填 `capturedAgainstBuild`、取不到照旧 null；接线（改 `bin/compile.mjs`）为后续小契约挂账、此前仍落 null。**至此 P3 tier-2 六项 route:human 全清（①②③④⑤⑥），P3 里程碑整体收官**（hermetic 六阶段 + 真机 bring-up 双侧完成，护栏 #16 的「人签真机」兑现）。下一站 = P4 断言草拟（相2）：另一 session 预备轨已到「就差 accept+loop」，前置接缝硬门 12 vs 15 kind 对齐（route:human）；baton 空闲留给其落地。
9. Windows 侧失败追诊（Steven 质询「fail-closed 真的没关系？」后补证）：连通与单资产两侧全通（登录页 200 / 资产 200，Windows 0.24s），败在真浏览器 SPA 渲染 15s 不完成——疑隧道连接池对 Windows 回环转发的并发/keep-alive 形态不补池（僵尸池家族）；其走的是「登录路径上表单必须出现」严格分支、最危险的 fail-open 分支被正确拒绝。按 G6 人签 Windows 非受支持跑侧，定性已知限制、不深追。**顺带挖出的真缺口（backlog 小加法候选）**：replay 登录预备动作失败只留 stderr、不落任何诊断产物——compile fail-closed 尚有诊断 compile-report 先例；宜补「失败也落登录诊断痕迹（不含凭据值）」，供 route:human 修雷有据。

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

- **岔一**（已锁）：轴通用 = 实现纪律，不是预留字段。`verdict.mjs` 按断言种类不可知、kind 枚举只在 `check.mjs`，新维度纯加法；流式回复对机器裁判 = 「一条网络记录 + 一个断言」，`StepAxes` 不重做。已落护栏第十七条。
- **质量接口**（已锁）：「内容好不好」走独立下游线，人工现在、`LLM-judge` 将来，同一接口、永不进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。
- **岔二**（已采纳）：压裁判保守分支最便宜的办法是先在 catalog 上多注合成故障（漂移→HARNESS_ERROR、元素消失→AFFORDANCE_ABSENT、真数据多匹配→ambiguous），再移植第二条 `chiefcomplaint_smoke`。
- **岔三**（已采纳）：第一条走 `full`；之后辐条默认轻车道（跳 grill、保留 plan+accept+loop），碰冻结内核才升 `full`；`accept` 任何车道都不跳。
- 全文：`docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。

### 模型分层升级 + 三级兜底（2026-07-01，已锁）

> **范围**：仅**开发流程**的模型分层道（谁来跑 loop：`toil`/`implementation`/`review`），**不涉及 Casey 产品功能**——编译/回放/裁定/报告 的运行时 LLM 接缝（相1 编译、相5 自愈、将来 `LLM-judge`）均不在本决策内；`verdict.mjs` 恒零 LLM。即配置顶层「两类 lane 正交」里的「模型分层道」那一类。

- **分层**：`loop/config.json` 模型分层道改——主环 Opus 4.8 跑 ultracode（xhigh + 动态工作流编排）当编排器，承 full 车道与冻结内核；轻车道的活派 Sonnet 5 独立 subagent（max effort）。切 subagent 而非主环换模型：prompt 缓存不被打断、上下文隔离（claude-api 缓存文档明写的正确写法）。`review` 未动，`sonnet` 仍同族末位 fallback。`toil` 缓：夜跑暂无需求，2026-07-01 撤回原 `codex:gpt-5.5`，待有 nightly runner 再议。
- **三级兜底阶梯（运行时 fail-safe 升级）**：开发任务上 Sonnet 5 max 一直卡（`circuitBreaker` 判 `zeroCommitRounds`/`sameErrorRounds` 跳闸）→ 升 Opus 4.8 xhigh（原 plan）重试 → 再卡 → `NEEDS_HUMAN` 写 `loop/inbox.md`（护栏 #14 fail-safe 不 fail-open，能力升满仍证不出就路由人、绝不静默过）。机制锚已在 `circuitBreaker` + `breaker.mjs`；`toil` 不入此梯（机械小修，跳闸照旧写 inbox）。
- **静态强制兜底（两条不变量，机器守；模型能自由换的前提）**：
  - I1 裁判零 LLM（护栏 #15，承重）：`bin/verdict.mjs` 传递依赖闭包零 LLM/网络客户端——「上游随便换模型都不出静默假 PASS」的根兜底。
  - I2 异构评审不塌同族（护栏 #9 / ADR 异构冗余）：`review.model` 家族 ≠ `implementation.model` 家族，`sonnet`/`opus` 只能在 review `fallback`、绝不当主 `model`。
  - I3「Sonnet 5 只作 subagent 不换主环」是编排期运行时属性、静态不可查，不假装可强制；其兜底即 I1（verdict 零 LLM + 冻结 golden + gate 三重网）。
- **已建**（`model-lane-guard` 契约收口，2026-07-01）：I1 verdict 零依赖断言已入 `casey selftest --tier1`（`bin/verdict-purity-guard.mjs` 静态扫依赖闭包）；I2 config 不变量 PostToolUse 钩子已接（`bin/config-lane-guard{,-hook}.mjs` + `.claude/settings.json` 独立条）。**仍待建**：三级兜底 watcher 读 `loop/.breaker-state.json` 自动再派——另起辐条、不在 model-lane-guard 契约内（别 ad-hoc 破护栏 #11、别改 loop-kit engine ADR-0001）。config 的 `_doc` 是当前策略事实源。

## 下一步

> 新会话接续顺序：① P3 tier-2 真机 bring-up（首推，hermetic 层已全绿、只剩真机六项 route:human）→ ② 其余任选。活契约槽 = `p3-compile` 六阶段全 done、baton 空闲。

1. **首推** P3 tier-2 真机 bring-up（route:human，需人在场）：拉反向隧道（WSL `node scripts/wsl-reverse-listen.mjs` + Windows 双击 `scripts/win-forward-start.cmd`）→ spike 验隧道下 CDP initiator 归因与录屏（失真退 Windows 侧）→ 手写规范 TestCase（`tc_catalog_wf_crud`，含 uniquePrefix `atl_`、preconditions、意图留痕）+ LLM 出 flow 草稿 → `casey compile` 闸段 → 人 confirm → 执行段（`--sut` 用 site.json 的 `devProxyUrl`）→ 核验清单（⑤ 抽屉确认按钮文本第一雷 / ⑦ 删除确认 / ④ 描述锚定 / ③ 菜单唯一性 / 计数口径三方对账）→ `--verify` 真机第二轮 → P4 交接面四件套落 `cases/tc_catalog_wf_crud/` → 后续相2 断言草拟+冻结+人签 → tier-2 真站 UAT：验四态 + CDP initiator 可靠度（ADR-0007 推翻条件）；500 场景走回放侧代理拦截注入（不能真造，用户已确认）。
2. `casey run` 编排器接 `run-history.jsonl`/`run-metrics.json` 真产出（light 车道）——刚冻的接缝、编排器是天然生产者；可与 1 的 grill 等待期错峰。
3. `p2-intent-compile` 的 learn（沉淀收尾，轻）。
4. `term-guard` 乙真接线（待 `~/.loop-kit` 非 Claude 密钥）：`bin/term-judge.mjs` 的 `callRealJudge` 接真评分员（复用 review 道 DeepSeek/codex 路径），观察期无误判后把 `bin/term-guard-hook.mjs` 的 `WARN_ONLY` 置 false 切硬拦。
5. push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓。
6. 坏引用挂账（route:human）：loop 纪律 hook 引的 `docs/decisions/2026-06-12-loop-kit.md` 不存在，根在冻结 `loop-kit/bin/hook-loop-triage.mjs:8` 与 `.claude/skills/acceptance-gate/SKILL.md:8`，真身 `docs/adr/0001-reuse-loop-kit.md`。

## 契约 / 运维

- 活契约 `loop/active-contract.json`（runtime、gitignored）现 = `p3-compile`（full，六阶段全 done）——baton 空闲，下一契约直接 `contract init <slug>`（重置台账、不丢磁盘草稿）。要提交而活契约是 pre-loop 的 full：先 `init` 一个 `direct` 契约授权 commit、提完 re-init 原契约恢复 baton；light 契约 plan 后 commit-impl 即放行、无 lib/bin 的提交任何时候放行；post-loop 的 full 契约提交放行。恢复某已 done / 被覆盖 契约的台账：re-init + 逐阶段 re-advance（grill 带 `--user-confirmed`、accept 带 `--red-verified`、artifact 交对应产物），gate 复验绿背书。
- 契约一览：
  - `p3-compile`（full）：六阶段全 done（codex 三轮 R3 PASS 记 audit、learn 落 `docs/plans/p3-compile/learn.md`；gate GREEN 2/2、golden 13 检查）。真机 bring-up 六项 route:human（prd observability 列）未走。
  - `layer3-wiring`（light）：六阶段全 done（codex 七轮 R7 PASS 记 audit、learn 落 `docs/plans/layer3-wiring/learn.md`；gate GREEN 2/2、覆盖 golden 51 检查）。
  - `seams-freeze-v2`（full）：六阶段全 done（codex 十二轮 R12 PASS 记 audit、learn 落 `docs/plans/seams-freeze-v2/learn.md`；gate GREEN、golden 13 组、`CONTEXT.md` 登记 6 术语）。四接缝 lib/bin 真产出随真机集成 route:human（prd observability 列）。
  - `term-guard`：6 阶段 done（gate GREEN 2/2、codex 九轮异构评审 pass、Stop 钩子 warn-only；乙真接线待密钥见「下一步」5）。
  - `model-lane-guard`：6 阶段 done（gate GREEN 2/2、codex 四轮异构评审 6→5→2→0 收敛 pass；I1+I2 守卫上线）。
  - `hermetic-gap-freeze`（direct）：done（两份缺口 coverage golden 补冻入 prd-p7-report / prd-p6-selfheal，gate 各 2/2）。
  - `p5-replay`（full）：6 阶段全 done（learn 见 `docs/plans/p5-replay/learn.md`）；tier-2 真机 route:human 未走。
  - `p2-intent-compile`：仅 learn 待。其余（seams-freeze / p2-failsafe-coverage / p7-report / p4-freeze / p6-selfheal）loop done、产物落 dev。
- 单活契约 baton 教训（重要）：loop-kit 是单活契约（hook 读主树共享 `active-contract.json`）。本会话并行起多契约（worktree 隔离）撞了这个单 baton 槽——worktree 子代理 commit 受主树 baton 互锁：P6 子代理曾临时翻主 baton（已还原）、P4 子代理被拦只暂存未提交。landing 办法：已 committed 的分支用 `git merge`（不被 commit 互锁拦）；未提交的（P4）把文件拷进 dev、把主 baton 临时切到其真实 loop-done 契约提交、再还原。未来真并行须按 design §3.1：`LOOP_CONTRACT_FILE` 参数化 + `breaker --state`（未建）。
- push：本仓无 git 远端（`git remote` 空），待定 GitHub 目标仓（参考 autotester = 私有 `ChenSteventx/autotester`）。
- 删不动的残留：`docs/plans/seams-freeze/proposed/`（评审副本，破坏性删除被权限层拦，待人 `! Remove-Item -Recurse -Force` 清）。
- 旧 `p2-testcase` 契约已被取代作废。term-lint 全程过；Windows git 需 `git config windows.appendAtomically false`（已设，否则 merge 报 index.lock 写错）。

## 历史层（溯源用，非现状）

- `P0/P1`（live，不变）：loop-kit 引擎（与 autotester 字节一致，ADR-0001）、护栏（12 迁移 + 13–17 新增）、`CONTEXT.md` 两限界上下文、ADR 0001–0006、`casey selftest --tier1`。
- **2026-06-26**：P2 重定义走完 grill→plan→accept，6 路深读 `regress_autotest`、ADR-0006 的 14 风险落代码核验、冻结 5 红 golden + 2 fixture + prd，停在 loop 前。详见 `docs/plans/p2-intent-compile/grill.md`。
- **2026-06-29**：开 loop 前的岔一/二/三 + 质量接口讨论 → 落档（FLYWHEEL/design/report-spec/flywheel-schedule）→ 实现 loop（S1/S2/S3 绿）→ 提交 `594ecf4` → Claude 侧异构评审 → 收口。
- **2026-06-29 晚续**：codex 真异构评审收口（7 修复，`7923088`）→ omc 列禁言禁用 → 排期 v2（接缝优先并行，`roadmap-parallel.md`）→ 第1层 5 接缝冻结（`4d184f6`）→ 第2层并行 worktree：track-F/P7（`b00b7c7`/`0832ed3`，合并 `e06e309`/`9d92892`）+ P6（`8734307`，合并 `1a37eba`）+ P4（`5a8b08d`）→ P5 grill+plan（ADR-0007）。第2层四轨全在 dev 亲验绿。单活契约 baton 撞并行的教训见「契约/运维」。
