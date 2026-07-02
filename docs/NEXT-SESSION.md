# 下个 session 接续提示词（Casey）

> 用法：下次开新 session 只需 `/starter`（等价于说「读 `docs/NEXT-SESSION.md` 接着干」）——把本文件内容当开场提示词读进来、按其【下一步】执行。本文件是给接续 Claude 的执行指令；状态事实以 `docs/HANDOFF.md` 为准，二者冲突时信 HANDOFF。本文件由 `/session-handoff` 自动刷新（整节替换为最新开场提示词，剪掉过期内容）。

## 开场提示词

```
项目：Casey（测易，LLM 驱动「文本用例→测试报告」确定性可回放测试系统）。
工作目录 /mnt/d/ctx/heren/casey，分支 dev（master 稳定 / test 提测）。
你是接手者，零上下文起步——先读文档对齐，再按下一步动手。

【一句话定位 + 血缘】
Casey 是 autotester（人录·机回放·零 LLM）的「翻面」：输入端改 LLM 读懂文本用例，
但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。
复用 autotester 的 loop-kit 作第二消费者（ADR-0001）。三处统一标识符 casey：
CLI bin/casey.mjs、skill .claude/skills/casey、MCP mcp/casey-server.mjs。

【先读，别现编已决的事】（必读顺序）
1. CLAUDE.md + CONTEXT.md（统一语言注册表，命名以它为准；弃用别名黑名单；繁体禁用）
2. docs/HANDOFF.md（最新进度，冲突以它为准；已更到 2026-07-02 tier-2 上半场）
3. loop/GUARDRAILS.md（17 条护栏逐条有效）
4. 追溯「为何这么定」：docs/adr/（架构决策主事实源）、docs/design/（端到端设计）；
   docs/decisions/ 目录不存在，loop 纪律钩子引的坏引用真身是 docs/adr/0001-reuse-loop-kit.md。
   环境坑参考本文件文末（WSL / 隧道启动顺序 / 中文字体 / loop-guard 误判）。

【项目历史 / 决策档案】（ADR 一行一条 + 里程碑时间线）
- ADR-0001 复用 loop-kit 作第二消费者：引擎原样拷入同仓归 loop-kit/，稳定性锚在带 schemaVersion 的数据契约。
- ADR-0002 多态裁定 + fail-safe 默认 + 自愈准入门：二值 gate 与多态 verdict.mjs 分两写者；机器只终判 PASS 与有取证 SUT_DEFECT，证不出一律 NEEDS_HUMAN。
- ADR-0003 编译再回放 + 非就地有界自愈：LLM 只编译期读一次用例、日常回放零 LLM；禁纯坐标步；自愈写旁车补丁、人签后应用。
- ADR-0004 断言冻结 + 人签门 + 期望版本化：断言只从类型词汇表选、易变值模板化；人签是 CASE_DEFECT 与 SUT_DEFECT 分水岭。
- ADR-0005 统一语言强制：四列制术语表唯一白/黑名单源；Stop + PostToolUse 双 hook；造词先登记；中文禁繁体。
- ADR-0006 Casey = autotester 与 regress 分层融合：L0–L4 分层增量去重（P3 第一条骑 regress 现成 flow 重表达）。
- ADR-0007 P5 回放运行时基座 + 取证归因：基座 @playwright/test；取证按 CDP 真发起方归因 + 背景 denylist；证不出归 null 永不背书。
- 里程碑时间线（git log，越往下越新）：第 1 层 5 接缝冻结 → 第 2 层四轨 hermetic 全绿合并 dev → P5 回放内核收口 → term-guard / model-lane-guard 兜底契约 → seams-freeze-v2 四接缝冻结 + 十二轮 codex 复评收口 → layer3-wiring 第 3 层 hermetic 骨架收口 → p3-compile 六阶段全收口（788bb2b..5504d09，编译命令化层 + codex 三轮 PASS + learn 八教训）→ 本 session（2026-07-02 下午）：P3 tier-2 真机 bring-up 上半场（969ffbb）——隧道 Host 重写 + 登录/路由/表单知识对齐真机。本仓无 git 远端。

【DDD / 统一语言】（领域模型）
- 七相流水线（LLM 只在相 0/1/2/5；相 3/4/6 纯零 LLM 确定性）：
  相0 归一 ingest → 相1 编译 compile（唯一一次真机跑，落 events.json + observed 观测现状）→ 相2 冻结+人签 sign
  → 相3 回放 replay（零 LLM，重放 + 录屏 + CDP 取证 → axes.json 三轴）→ 相4 裁定 verdict（零 LLM 判定树出四态）
  → 相5 自愈 self-heal（仅确证 HARNESS_ERROR 写旁车补丁、人签后 apply）→ 相6 报告 report（零 LLM，自包含 HTML/MD/json + 凭据兜底门）。
- 核心领域词汇（各一行白话）：
  · 三轴 StepAxes：每原子步吐动作轴/断言轴/取证轴三组正交事实；裁判·报告共吃的数据契约。
  · 多态裁定四态：PASS / SUT_DEFECT（须取证背书、禁自愈、出缺陷单）/ HARNESS_ERROR（可自愈）/ NEEDS_HUMAN（证不出、带 reason 子类）。
  · 点击身份门：唯一命中或点击后身份回读成立才 actionPerformed=true；多匹配/坐标兜底→ambiguous→NEEDS_HUMAN。
  · 网络取证按发起方归因：按 initiator / attributedStepId 归发起步，非时间窗；背景轮询 401 不翻本步 verdict。
  · 只读漂移探针：无 spec 变更无重跑，只读探「同稳定签名唯一元素是否仍在」供 verdict 判 HARNESS_ERROR。
  · 通道剖面 profile：某 channel 回放所需非凭据配置（背景 denylist + 信封成功字段 + routes.workflowList 列表路由），与 site.json 凭据分离。
  · 通道驱动 channelDriver：端口适配器式能力声明接缝，actionSpace ⊆ 已冻 events.schema 枚举 + profileRef 指针。
  · 登录预备动作：回放/编译开始前把浏览器带到已登录态的开场步；不产 event、凭据只进内存。
  · 错误信封：按响应 body 成功字段判的软失败（Heren 实测 body.status===200）。
  · 静默点：动作后等 UI 稳定的确定性条件（DOM 连续两拍稳定），替代固定睡眠。
  · 观测现状：编译期落盘地面真值（实测 URL/标题/toast/请求日志），存 observed-<caseId>.json。
  · 冻结断言契约：人签后写 loop/prd-<caseId>.json 并 checksum 冻结的断言，实现者只读、改即触棘轮。
  · TestCase 聚合根：excel/json/txt/自由文本归一后唯一内部用例对象。
- 五层 LLM 准入边界：L0 确定性内核（零 LLM：gate 唯一写 passes / verdict 多态裁定 / 熔断器 / 报告渲染 / 凭据兜底门）；L1 归一·L2 断言草拟·L3 编译与自愈执行 = LLM 手术刀（产物必经 L0 复核）；人签门归人。
- 裁判与自愈分进程：verdict.mjs 零 LLM，自愈是其下游消费者，不得反向进裁判进程。

【开发准则（机制强制，不是建议）】
- 阶段互锁：改 lib/bin/web 或提交前必先 contract init 声明入口分流（direct|light|full），hook-loop-guard 按 contract 互锁。
- 入口分流三档：direct=地板全放行；light=加 plan 门；full=全链（碰冻结内核必走）。accept 任何车道都不跳。
- passes 只 gate 写：prd 的 passes 仅 loop-kit/bin/gate.mjs 有权写；testChecksums 冻结文件对实现者只读。
- 双 hook 术语拦截：回合输出与写入 md/json 被 term-lint 扫；加粗只给纯中文、英文走反引号。
- 护栏 17 要点：#1 测试冻结棘轮 / #5 冻结断言只读+自愈非就地 / #7 凭据不外泄 / #9 评审只喂 spec+diff+证据 / #11 阶段互锁 / #13 自愈只对确证 HARNESS_ERROR 开闸 / #14 fail-safe 不 fail-open / #15 裁判零 LLM 分进程 / #16 gate 绿≠完成（需人签真机）/ #17 裁判按断言种类不可知。

【兜底 / fail-safe 机制】（证不出怎么收）
- 四态 catch-all：verdict 判定树落任何「证不出」分支 → NEEDS_HUMAN(INDETERMINATE)，绝不静默 PASS。
- 入参畸形 fail-closed：verdict 缺 --axes/--out → exit 64；坏数据/steps 非数组 → exit 65。
- 点击身份门：多匹配绝不执行变更动作；fallback 多命中→ambiguous→NEEDS_HUMAN。
- 编译执行段同律：任一步非 unique 或存在硬阻断 → 只落诊断 compile-report、不产 events/observed、exit 65。
- 取证按发起方归因：只认 attributedStepId===本步的 5xx/信封/pageerror/crash；stepId==null 不背书。
- 回放看门狗 75s / 编译看门狗 120s 强退；行计数抛错回 null 不回 0；熔断器越阈写 loop/inbox.md 后 exit 2。
- 凭据兜底门：所有落盘口过 lib/cred-gate.mjs，命中敏感词/site.json 字面量拒写非零退出。

【排期】
- P0–P2 完成（P2 仅 learn 待）；P3 hermetic 六阶段全收口，tier-2 真机 bring-up 进行中（本 session 上半场，见下）；
  P4/P6/P7 loop 收口；P5 六阶段收口、tier-2 真机 route:human 未走；P8 未开始；P9 tier-1 绿、tier-2 未走。
- 接缝冻结两层全 done；第 3 层 hermetic wiring done；真数据端到端 = P3 tier-2 之后的直接下一步。
- 单 baton 上限：loop-kit 单活契约；并行只用在零 baton fan-out。碰 lib/bin 落地走 worktree + git-native 合并。

【当前契约 / 状态】
- 活契约槽 = p3-compile（full）六阶段全 done；其 tier-2 真机 bring-up（六项 route:human 在 prd observability）本 session 走到半程，最新提交 969ffbb（真机实采修正一批）入 dev，工作树净。
- tier-2 半程战果（详见 HANDOFF 当前状态）：
  · 反向隧道全通：wsl-reverse-listen 加逐请求 Host 头重写（网关按虚拟主机路由）、环回自测三案钉绿；
    启动顺序敏感（见环境坑）；登录页经隧道 HTTP 200 / 38ms 热路径。
  · WSL 中文字体已装（用户级 Noto Sans CJK）——此前 headless 录屏/截图中文全空白的根因。
  · spike 机器侧四向全过：真机登录 1.7s、前台 XHR 按 initiator 归因到活动步、无活动步 56 条流量零违例归 null、
    信封经隧道解析 14/14；录屏因字体作废、待重录人签（route:human ①）。
  · tc_catalog_wf_crud 三件已备（cases/ 下，gitignored）：testcase.json / profile.json（背景 denylist 4 条
    app-shell + routes.workflowList=/heren/aimanagement/process/list）/ flow 已过闸并人 confirm（Steven）。
  · 首跑 execute 撞出真机五雷已全修：登录入口须带 startUrl 路径段（裸基址假已登录 fail-open）；
    /ai-manager/* 是 API 前缀（503）→ listRoute 剖面化；Heren 表单 div 标签（getByLabel 必 0）→ form__item
    容器锚定；分类无 combobox → 线性化两击（选项限定可见列表、避撞分类 tab）；抽屉/删除对话框是 div 按钮
    （role 采样必 0）→ 主按钮锚定 + 实采文本记 compile-report。hermetic golden 13/13 + 回归锁 + tier1 全绿。
  · site.json 起草的 login 覆盖段与真机不符（命中 0）已删，回落内置默认（真机逐字吻合）。
- 已知缺口（走核验段前必解）：compile --verify 直喂 bin/replay.mjs、无登录预备动作 → 真机必撞登录墙。
- 最新工程纪律（别漏）：模型分层 model-lane-guard 机制强制（I1 verdict 零 LLM 闭包 + I2 config 异构不塌同族
  已上线，三级梯 watcher 待建）；review 用 codex（gpt-5.5 非同族、空 cwd 喂 stdin、判 PASS 记 audit）绝不同族自评；
  term-guard 甲 warn-only、乙待非 Claude 密钥。

【下一步（任选其一，先对齐再动手）】
A 重跑 P3 执行段（首推，知识已适配）：先拉隧道（顺序见环境坑）→
  node bin/casey.mjs compile tc_catalog_wf_crud --execute --testcase cases/tc_catalog_wf_crud/testcase.json
  --sut http://127.0.0.1:15519 --out-dir cases/tc_catalog_wf_crud --profile cases/tc_catalog_wf_crud/profile.json
  --unique-name c1 → 产真 events/observed/compile-report → 核验清单 ⑤⑦④③ + 计数对账（route:human）。
  撞新雷照 fail-closed 诊断报告修（本 session 首跑即此法，两轮收敛）。
B --verify 登录墙方案（A 之后、核验段之前必解）：bin/replay.mjs 加可选登录预备动作（不产 event、不进 axes）
  或 storageState 移交——小设计决策，涉回放器 CLI 面，建议 light 契约。
C 重录 spike 录屏（字体已修）交人签核销 route:human ①。
D 旧项任选：casey run 接 run-history/run-metrics 真产出（light）/ p2-intent-compile learn / term-guard 乙接线。

【环境坑（WSL）】
- 反向隧道（真机访问必用）启动顺序敏感：先 WSL 侧 node scripts/wsl-reverse-listen.mjs（后台），
  后 Windows 侧双击 scripts/win-forward-start.cmd（或 node scripts/win-reverse-agent.mjs）；
  Windows 先起会留僵尸连接占池不补，重启 Windows 代理即愈。WSL 内基址 http://127.0.0.1:15519
  （= site.json target.devProxyUrl）。目标地址只活在 site.json、绝不进命令行/日志/输出；
  Windows 侧连通探针 node scripts/win-probe-target.mjs（只出状态码）。
- WSL 中文字体：已装用户级 ~/.local/share/fonts/NotoSansCJKsc-Regular.otf；若截图/录屏中文空白，
  先 fc-list :lang=zh 查（0 即字体丢了，重装即可，无需 sudo）。
- 9p 崩溃：/mnt/d 全局 EIO 时资源管理器戳一下 D: 唤醒，或 sudo umount /mnt/d; sudo mount -t drvfs D: /mnt/d
  （别 wsl --shutdown）。原子写保护（写 .tmp 再改名）。
- git index.lock 卡挂：先 pgrep -a git 杀挂死进程、再删 .git/index.lock。
- loop-guard 误判（比想象宽）：命令含 prd 路径 → 判 write-prd；node -e 内联 / cp / rm → 判 edit-impl；
  读类命令带重定向/管道 + bin/ 路径 → 判 edit-impl。对策：查文件用 Read 工具或 scratchpad 脚本。
  tests/ 与 scripts/ 路径不被判 edit-impl。
- 授权提交/切 baton：full 契约 pre-loop 拦 commit-impl，先 init 一个 direct 契约授权、提完 re-init 恢复；
  post-loop 的 full 契约提交放行（当前 p3-compile 即此态）。
- 行尾/checksum 整库 LF 一致；查行尾用 node 数 0x0d。路径 D:\→/mnt/d/；playwright 装 Linux 版。

【硬约束（贯穿全程）】
裁判零 LLM；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）；冻结测试只读；凭据不进任何输出/日志/提交/报告；
回合输出禁加粗英文与繁体；新概念先查既有学科术语、造词先登记 CONTEXT.md。
契约 review 用 codex 异构评审、绝不同族自评。可并行的活优先 fan-out 零 baton 子代理；
决策分岔用可点选项呈现、别散文长问。真机 route:human 项需人在场（拉隧道/人签/过目）。
```
