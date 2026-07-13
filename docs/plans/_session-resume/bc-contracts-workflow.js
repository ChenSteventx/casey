export const meta = {
  name: 'bc-contracts',
  description: 'B 域锁硬化 + C gen-prompts 两契约并行落地：fable 规划 → codex 设计审 → fable 裁决 → sonnet ultracode 实现(内嵌 codex test 分析) → codex+pi 双路评审 → fable 汇裁 → 修复 → learn',
  phases: [
    { title: 'Plan', detail: 'fable@xhigh 读现成 plan.md/GRILL.md 对齐（缺则从简报产）', model: 'fable' },
    { title: 'PlanReview', detail: '驱 codex gpt-5.6-sol@max 异族设计评审（Steven 2026-07-13 加）' },
    { title: 'PlanArb', detail: 'fable@xhigh 汇裁 codex 设计 findings、必要时改 plan.md', model: 'fable' },
    { title: 'Build', detail: 'sonnet5 ultracode 红先行实现到 gate 绿；内嵌 codex gpt-5.6-sol@medium test 结果分析（咨询、裁判零 LLM 不破）', model: 'sonnet' },
    { title: 'Review', detail: 'codex gpt-5.6-sol@medium ∥ pi deepseek-v4pro@high 双路评审' },
    { title: 'ReviewArb', detail: 'fable@xhigh 汇裁所有 codex+pi 评审意见（Steven 2026-07-13 加）', model: 'fable' },
    { title: 'Fix', detail: 'sonnet5 红先行修复 fable 汇裁 findings + codex+pi round-2 复核', model: 'sonnet' },
    { title: 'Learn', detail: 'learn.md + 六阶段收口核验', model: 'sonnet' },
  ],
}

const MAIN = '/mnt/d/ctx/heren/casey'

const CONTRACTS = [
  {
    slug: 'drawer-lock-hardening',
    tree: '/mnt/d/ctx/heren/casey-drawer-lock-hardening',
    lane: 'light',
    brief: [
      '契约 drawer-lock-hardening（lane light）：画布三原子域锁跨抽屉边界硬化。',
      '挂账原文（loop/prd-wf-set-node-field.json 的 observability 第二条，codex-sol 异构评审 MED#2，2026-07-10）：doSetNodeField（lib/replay-actions.mjs 约:232）与 compileWorkflowSetNodeField（lib/compile-atoms.mjs 约:671）的域锁用宽 .hr-drawer__content-wrapper，匹配所有抽屉而非当前节点配置抽屉——若另一可见抽屉恰有唯一同 placeholder 字段，域内 count===1 会填错抽屉的字段、精确回读仍成立→假绿。openNode/selectNodeDropdown/setNodeField 三原子同型设计局限。',
      '修法（Steven 2026-07-13 选定本契约，方向已定勿改）：三原子的编译门与回放门一起把域锁收窄到当前节点抽屉专属锚。plan 已定（GRILL D2）：拒 .lf-node-drawer 类锚（真机未采样、仅夹具自造=倒裁），取「可见 .hr-drawer__content-wrapper 且内含当前节点标题精确文本」标题锚，复用 openNode 双证回读锚下沉为三原子共用域锁；缺 nodeName 一律 fail-closed 不回落（D4）；openNode 加预点基线归因守卫（D5）；fake-sut 加 twinfield/twinboth/twintitle 三反面场景，红先行金牌 G1–G7；重签 4 份 prd（含 server.mjs 双冻 p5-replay + replay-nth-visible-hardening）。',
      '不做：workflow.assertNodeFieldValue（挂账明确另契约）；不碰 bin/verdict.mjs（裁判内核）；不驱真机（纯 hermetic，fake-sut + chromium）。',
      'grill 判 user-confirmed 的凭据：Steven 2026-07-13 在主会话点选本契约开工，范围即挂账原文修法，无新分岔。',
    ].join('\n'),
  },
  {
    slug: 'gen-prompts',
    tree: '/mnt/d/ctx/heren/casey-gen-prompts',
    lane: 'full',
    brief: [
      '契约 gen-prompts（lane full）：regress scope C 改形态落地——被测参数的 LLM 合成 authoring，走 Casey 既有「CLI 外 LLM」模式（先例 = ingest-scaffold 的归一脚手架/候选骨架/归一提示模板三件套）。',
      '形态（Steven 2026-07-13 明确确认，方向已定勿改）：合成本身由 coding agent（会话里的 LLM）做，casey CLI 只做两段确定性零 LLM 工作。plan 已定两命令：casey promptset-seed（零 LLM 出合成种子模板：生成指引+候选格式说明，字节稳定、双侧凭据门）+ casey promptset-freeze（校验候选闭合白名单 fail-closed + 幂等冻结追加进 promptset.json：已有 id 绝不覆盖只追加、失败不写盘不留半份、原子写、强制 source:llm 可追溯）。',
      '铁不变量：本工具绝不进回放/裁定进程（authoring 期一次性，回放期零 LLM 不变）；零 API key、零网络、零凭据接线（区别于 regress 原版直调 API——其 --base/--key/deepseek-v3 默认与内网地址一概不搬，任何内网/真目标地址不许出现在代码与文档）；落盘产物照旧过凭据兜底门（cred-gate 深扫，命中拒写）；verdict.mjs 字节不动。',
      '涟漪：lib/promptset.mjs SOURCES 扩 llm（regress-promptset 金牌负向钉改向+保未知 source 钉）、cli-mcp-face 金牌 EXCLUDED 追加两命令（cli-mcp-face.golden.mjs 双冻于 prd-cli-mcp-face + prd-mcp-parity，重签一个不漏）、CONTEXT 登记三新词条。红先行金牌 S1–S4/F1–F4/P1/N1/C1。',
      '参考（read-only，绝不改）：/mnt/d/ctx/heren/regress_autotest/scripts/gen-prompts.mjs 与 _prompts-core.mjs（语义对标：幂等冻结/去重/原子写/失败不写盘）；本树 docs/plans/gen-prompts/SCOPE-OPTIONS.md（选项 C 直调 API 旧形态已作废、被 Steven 改定为 CLI 外 LLM，GRILL 已记）。',
      'grill 判 user-confirmed 的凭据：Steven 2026-07-13 主会话确认「合成在 coding agent 中做」，即 CLI 外 LLM 形态。',
    ].join('\n'),
  },
]

const COMMON = (c) => [
  `你在 Casey 仓的契约 worktree 里干活：${c.tree}（分支 ${c.slug}，lane ${c.lane}）。`,
  `主仓 ${MAIN} 只读参考（合并由主会话负责），所有改动与命令都落在本树。node_modules 已软链好。`,
  '',
  '【必守硬约束】',
  '- 裁判零 LLM：bin/verdict.mjs 绝不掺 LLM、绝不因本契约改动裁定语义；fail-safe 不 fail-open（证不出→NEEDS_HUMAN）。',
  '- loop/prd-*.json 的 passes 字段只有 loop-kit/bin/gate.mjs 有权写；testChecksums 冻结文件对实现者只读，确需改冻结文件须在对应 prd 重签 sha256 并在提交说明里记账。',
  '- .auth/ 与 site.json 是凭据：内容绝不进任何输出/日志/提交/报告。本契约纯 hermetic，绝不驱真机、绝不碰真目标地址。',
  '- 你写的 md/json 与回合输出会被 term-lint 扫：一律简体中文、加粗只给中文（英文一律反引号或裸写）、新概念先登记 CONTEXT.md、弃用别名黑名单不许用。',
  '- git 提交只列显式路径，绝不 add -A 或 add .；不把 loop/prd-selftest.json 的时间戳漂移并进提交。',
  '',
  '【环境坑】',
  '- 契约/gate/读类命令别拼 shell 重定向（2>&1、>、<）——loop-guard 粗粒度误判会拦；直接裸跑命令。',
  '- gate 慢（每 golden 真起 chromium + 假 SUT，全量可达十几分钟）：用后台方式跑再轮询收结果，别前台干等超时。',
  '- 行尾一律 LF；查行尾用 node 数 0x0d 字节，别用 grep。',
  '- 若 hook-loop-guard 拦你（缺上一阶段交付物），先跑 node loop-kit/bin/contract.mjs show 核台账再补推进，别绕。',
  '',
  '【loop 规则（六阶段台账）】',
  '- 台账工具 node loop-kit/bin/contract.mjs（子命令 init/advance/check/show/list）；不确定语法就裸跑它看用法说明（别带重定向）。本树 baton 已 init，grill+plan 已 done（2/6）。',
  '- 六阶段 grill→plan→accept→loop→review→learn 逐段推进；grill 收口带 --user-confirmed（凭据见任务简报）；accept 需 --red-verified（红先行金牌先验红）；loop 开始前跑 node loop-kit/bin/breaker.mjs --reset。',
  '',
  '【任务简报】',
  c.brief,
].join('\n')

// ── 异族评审驱动纪律（护栏 #9 + heterogeneous-review-tooling 记忆）──
const REVIEW_DRIVER_RULES = (c, tag) => [
  '你是异族评审的驱动员（不是评审者本人）：只备料、跑 CLI、捕获裁决、归档，绝不代评审者下判断。',
  '护栏 #9：评审料只喂 spec + diff + 门禁证据，绝不喂凭据、绝不喂无关代码、绝不喂实现者内心推理。料压小（网络抖、大料易断），diff 超长按文件拆要点但绝不省略断言相关改动。',
  'codex 调用式：codex exec --skip-git-repo-check -C ' + c.tree + ' -s read-only -m gpt-5.6-sol -c model_reasoning_effort=<档> - 从评审料文件读入；后台跑、耐心等完；网络中断重试一次。',
  'pi 调用式（v0.80.3 已可从 WSL 驱）：pi -p --no-session --no-tools --thinking high --model <deepseek v4pro 模式串> @评审料路径 "评审指令"；先一句话 smoke 验通并确认真选中 deepseek v4pro 再跑正式；驱不动/模型缺席/超时→缺席不阻塞、记明原因，绝不拖垮主线。',
  'codex 两次都断→你按同一标准做同族评审兜底，但明标 crossFamily=false + FALLBACK_SAME_FAMILY_*（主会话挂账正式跨族复审）。',
  '归档：各评审原文按 ' + tag + ' 存 docs/plans/' + c.slug + '/review/；照 loop/audit.jsonl 既有行形状（先读几行对齐字段）追加评审记录（注明每路模型与家族）。',
].join('\n')

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '计划摘要（300 字内）' },
    touchesFiles: { type: 'array', items: { type: 'string' } },
    goldens: { type: 'array', items: { type: 'string' }, description: '红先行金牌清单：每条一句（钉什么+怎么先红）' },
    resignPrds: { type: 'array', items: { type: 'string' }, description: '预计需重签 checksum 的 prd 清单' },
    risks: { type: 'array', items: { type: 'string' } },
    keyDecisions: { type: 'array', items: { type: 'string' }, description: '关键设计裁量（供设计评审对准打）' },
    stagesDone: { type: 'string', description: 'contract show 的当前台账态' },
  },
  required: ['summary', 'touchesFiles', 'goldens', 'stagesDone'],
}

const FINDING_ITEM = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['HIGH', 'MED', 'LOW'] },
    file: { type: 'string' },
    title: { type: 'string' },
    detail: { type: 'string' },
    source: { type: 'string', enum: ['codex', 'pi', 'both', 'self'] },
  },
  required: ['severity', 'title', 'detail', 'source'],
}

const PLANREVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FINDINGS', 'FALLBACK_SAME_FAMILY_PASS', 'FALLBACK_SAME_FAMILY_FINDINGS'] },
    crossFamily: { type: 'boolean' },
    findings: { type: 'array', items: FINDING_ITEM },
    reviewLog: { type: 'string' },
  },
  required: ['verdict', 'crossFamily', 'findings'],
}

const PLANARB_SCHEMA = {
  type: 'object',
  properties: {
    revised: { type: 'boolean', description: 'plan.md 是否被改动' },
    dispositions: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, action: { type: 'string' } }, required: ['finding', 'action'] } },
    finalDirective: { type: 'string', description: '给实现者的最终 plan 指令（已并入采信的设计 findings）' },
  },
  required: ['revised', 'finalDirective'],
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    gate: { type: 'string', description: 'gate 终态与关键输出摘录' },
    tier1: { type: 'string', description: 'selftest --tier1 终态' },
    commits: { type: 'array', items: { type: 'string' }, description: '提交哈希+一句说明' },
    files: { type: 'array', items: { type: 'string' } },
    resigned: { type: 'array', items: { type: 'string' }, description: '实际重签的 prd 与文件' },
    testAnalysis: { type: 'string', description: 'codex gpt-5.6-sol@medium 对 test/红先行/gate 结果的咨询分析结论（是否红得其所、有无假绿隐患）' },
    issues: { type: 'array', items: { type: 'string' }, description: '遗留问题/挂账' },
  },
  required: ['gate', 'tier1', 'commits', 'files', 'testAnalysis'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    codexFindings: { type: 'array', items: FINDING_ITEM },
    piFindings: { type: 'array', items: FINDING_ITEM },
    crossFamily: { type: 'boolean', description: 'codex 真跨族出结论=true；同族兜底=false' },
    piStatus: { type: 'string', description: 'pi 状态：ran(注明模型) 或缺席原因' },
    reviewLog: { type: 'string' },
  },
  required: ['codexFindings', 'crossFamily', 'piStatus'],
}

const REVIEWARB_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['CLEAN', 'FINDINGS'] },
    adjudicated: { type: 'array', items: FINDING_ITEM, description: '汇裁后的最终 findings（去重、标 source、默认采信跨族）' },
    dispositions: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, action: { type: 'string' } }, required: ['finding', 'action'] } },
    comparison: { type: 'string', description: 'codex/pi 重合 vs 分歧 vs 各自独有 一句话' },
  },
  required: ['verdict', 'adjudicated', 'comparison'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    dispositions: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, action: { type: 'string' } }, required: ['finding', 'action'] } },
    round2: { type: 'string', description: 'codex+pi round-2 复核结论' },
    gate: { type: 'string' },
    tier1: { type: 'string' },
  },
  required: ['dispositions', 'gate', 'tier1'],
}

const LEARN_SCHEMA = {
  type: 'object',
  properties: {
    finalSummary: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    mergeReady: { type: 'boolean' },
    debts: { type: 'array', items: { type: 'string' } },
    treeStatus: { type: 'string' },
  },
  required: ['finalSummary', 'commits', 'mergeReady', 'debts', 'treeStatus'],
}

function planPrompt(c) {
  return [
    COMMON(c),
    '',
    '你是本契约的规划者（fable@xhigh）。只写文档与台账，不改实现。',
    '本契约上一轮已产 docs/plans/' + c.slug + '/proposed/GRILL.md 与 plan.md（baton 已 grill+plan done）。',
    '1. 先读这两份现成产物 + 本树 CLAUDE.md/CONTEXT.md/GUARDRAILS.md/HANDOFF.md 顶部当前状态 + 简报点名的代码与参考文件，核对计划仍与简报一致。',
    '2. 若现成产物齐且仍成立：直接抽取其结构化摘要按 schema 返回，keyDecisions 列出关键设计裁量（供下一段设计评审对准打），不重写文档。',
    '3. 若现成产物缺失或与简报冲突：按简报补/改 GRILL.md + plan.md（含红先行金牌清单、touchesFiles、遍历 loop/prd-*.json testChecksums 找全需重签 prd）、contract advance 补台账（grill --user-confirmed 引简报凭据），再返回摘要。',
    '最终按 schema 返回。',
  ].join('\n')
}

function planReviewPrompt(c, plan) {
  return [
    COMMON(c),
    '',
    '【Plan 阶段异族设计评审（Steven 2026-07-13 加）】',
    REVIEW_DRIVER_RULES(c, 'plan-review 前缀（planreview-codex.md）'),
    '',
    '评审者 = codex gpt-5.6-sol @ max（设计审用最高强度推理）。评审对象 = 本契约 plan（实现前，逮设计缺陷比 build 后返工便宜一个数量级）。',
    '规划摘要：' + plan.summary,
    '关键设计裁量：' + (plan.keyDecisions || []).join('；'),
    '',
    '1. 备设计评审料 docs/plans/' + c.slug + '/review/planreview-material.md：plan.md + GRILL.md 全文要点 + 简报里「已定勿改」的方向。',
    '2. 跑 codex（model_reasoning_effort=max）设计评审。评审指令：审设计层——锚点选择是否会漏/误命中、fail-closed 边界是否留 fail-open 缝、红先行金牌是否真能钉住缺陷（会不会假绿）、重签清单是否漏共享冻结文件、是否引入裁判 LLM 化/凭据外泄/术语违例风险、DDD 统一语言是否走样；按 HIGH/MED/LOW 列 findings（对准 keyDecisions 打），无发现给 PASS。',
    '3. 存 review/planreview-codex.md + audit 追加一条。',
    '最终按 schema 返回（findings 标 source=codex）。',
  ].join('\n')
}

function planArbPrompt(c, plan, planReview) {
  return [
    COMMON(c),
    '',
    '你是 Plan 汇裁者（fable@xhigh，Steven 2026-07-13 定：所有 codex/pi 评审意见汇给 fable 裁决）。',
    '【自评张力护栏】plan 是 fable 家族产物、你也是 fable——为防同族终审偏袒：默认采信跨族（codex）设计 findings，只有拿得出具体反证（代码/文档/夹具实据）才驳，逐条记 dispositions；拿不准的按「采信」处理。',
    '规划摘要：' + plan.summary,
    'codex 设计评审：verdict=' + planReview.verdict + '（crossFamily=' + planReview.crossFamily + '）findings=' + JSON.stringify(planReview.findings),
    '',
    '1. 逐条裁 codex 设计 findings：采信的→改 docs/plans/' + c.slug + '/plan.md（与 GRILL.md 若涉决策同步）把设计缺陷堵死并升级红先行金牌设计；证伪的→记具体反证。',
    '2. 若改了 plan：contract 台账无需回退（仍在 plan done 态），但在 plan.md 顶记一行「设计评审修订（codex-sol@max）」+ 日期占位。',
    '3. 产 finalDirective：给实现者的最终 plan 指令（已并入采信 findings 的净化版要点）。',
    '最终按 schema 返回。',
  ].join('\n')
}

function buildPrompt(c, plan, planArb) {
  return [
    COMMON(c),
    '',
    '你是本契约的实现者（accept+loop 两阶段，sonnet5 走 ultracode 层级）。',
    '执行层级（Steven 定）：你是执行者，把可并行的活——各金牌撰写、互不耦合模块实现、影响面复验、prd 重签核对——用 Agent 工具派「子执行」并行铺开（model 传 sonnet，提示词注明按 xhigh 高强度推理），并明确告诉每个子执行：不得再派任何子代理（叶子封深）。你自己守耦合核心：接缝一致性、红先行次序、gate 收口、git 提交。发现上一次中断的半成品（文件已在/台账已推进）核对后续接、别重敲。',
    'plan 汇裁最终指令（已并入采信的设计评审 findings）：' + planArb.finalDirective,
    '规划摘要：' + plan.summary,
    '预计触碰：' + plan.touchesFiles.join('，'),
    '金牌清单：' + plan.goldens.join('；'),
    '',
    '顺序（红先行是铁律）：',
    '1. 先写金牌（照 tests/_golden/ 既有形状），逐条验红：改前必红（暴露现缺陷）或新场景必红，保留红证摘录。',
    '2. accept：起 loop/prd-' + c.slug + '.json（checks 引金牌、testChecksums 冻结断言文件 sha256、observability 记挂账），contract advance accept 带 --red-verified。',
    '3. loop：node loop-kit/bin/breaker.mjs --reset；实现；node loop-kit/bin/gate.mjs --prd loop/prd-' + c.slug + '.json 后台跑到 GREEN（passes 只许 gate 写、你绝不手写）。',
    '4. 【loop 内 test 结果分析，Steven 2026-07-13 加】驱 codex gpt-5.6-sol @ medium 分析本契约的 test 与结果：红先行的红是否「对的原因」（真暴露缺陷而非测试写错）、gate 输出有无假绿隐患、金牌断言强度够不够。',
    '   硬护栏：这是 L2 测试质量咨询、绝不进裁判——gate.mjs 仍是 passes 唯一写者、verdict.mjs 一字不动，codex 分析只作诊断参考记进 testAnalysis，绝不据它翻 gate 结论。codex 指出测试写错→你改测试重验红；codex 指出假绿→补钉金牌。',
    '5. 影响面复验：受影响既有金牌逐个跑绿 + node bin/casey.mjs selftest --tier1 绿；plan 列重签 prd 逐个重签实际 sha256 并复跑其 gate。',
    '6. git 提交（本树分支、显式路径、提交说明记红先行与重签账）；contract advance loop。',
    '最终按 schema 返回（testAnalysis 必填 codex 分析结论）。',
  ].join('\n')
}

function reviewPrompt(c, acc) {
  return [
    COMMON(c),
    '',
    '【实现完，代码层双路异族评审】',
    REVIEW_DRIVER_RULES(c, 'r1（codex-r1.md / pi-r1.md）'),
    '',
    'gate：' + acc.build.gate + '｜tier1：' + acc.build.tier1 + '｜提交：' + acc.build.commits.join('；'),
    '',
    '1. 备评审料 docs/plans/' + c.slug + '/review/material-r1.md：GRILL/plan 要点 + git -C ' + c.tree + ' diff dev...HEAD 全量 diff + gate/tier1 摘录。',
    '2. 双路并行（同料同指令、都后台跑一起等）：a) codex gpt-5.6-sol @ medium；b) pi deepseek v4pro @ high。',
    '   评审指令：按 HIGH/MED/LOW 列 findings（文件+行+问题+建议），重点打 fail-open/假绿/域锁与边界/冻结纪律违例/幂等与半份写盘/裁判 LLM 化/凭据外泄/术语违例；无发现给 PASS。',
    '3. codexFindings 标 source=codex、piFindings 标 source=pi 分别返回（不在本段合并——合并交下一段 fable 汇裁）。存 codex-r1.md / pi-r1.md。',
    '最终按 schema 返回。',
  ].join('\n')
}

function reviewArbPrompt(c, acc) {
  return [
    COMMON(c),
    '',
    '你是代码评审汇裁者（fable@xhigh，Steven 2026-07-13 定：所有 codex+pi 评审意见汇给 fable 裁决）。',
    '【自评张力护栏】被评对象是 sonnet（Claude 家族）实现——为防同族终审偏袒：默认采信跨族（codex/pi）findings，只有拿得出具体反证才驳、逐条记 dispositions；两路命中同一处标 source=both，某路独有且可信的保留并标其 source。你不是最后一道闸——修完仍由 codex+pi round-2 跨族复核。',
    'codex findings（crossFamily=' + acc.review.crossFamily + '）：' + JSON.stringify(acc.review.codexFindings),
    'pi findings（' + acc.review.piStatus + '）：' + JSON.stringify(acc.review.piFindings || []),
    '',
    '1. 去重合并两路 findings：同一缺陷两路都报→合成一条 source=both；仅一路→保留标其 source。',
    '2. 逐条初裁：采信/证伪（证伪须具体反证）；产 adjudicated（最终待修 findings）+ dispositions + comparison（重合/分歧/各自独有）。',
    '3. 对比小结存 docs/plans/' + c.slug + '/review/arb-r1.md。verdict：adjudicated 非空=FINDINGS，空=CLEAN。',
    '最终按 schema 返回。',
  ].join('\n')
}

function fixPrompt(c, acc) {
  return [
    COMMON(c),
    '',
    '你是修复者（sonnet5）。fable 汇裁后的最终 findings：',
    JSON.stringify(acc.reviewArb.adjudicated, null, 2),
    '汇裁对比：' + acc.reviewArb.comparison,
    '',
    '逐条处置：',
    '1. 真问题红先行修死：先写/改金牌把问题钉红（红证摘录），再修绿；升级 prd checks 与 testChecksums。',
    '2. 判证伪的给可复核证据（代码行 + 行为实证）写进 docs/plans/' + c.slug + '/review/dispositions-r1.md，不许一句话带过。',
    '3. 修完复跑 gate + tier1 到绿，重签受影响 prd，git 提交（显式路径）。',
    '4. round-2 跨族复核（双路：codex gpt-5.6-sol@medium + pi deepseek v4pro@high，料=修复 diff + 逐条处置表，存 codex-r2.md/pi-r2.md，audit 各追加一条）；仍有真 findings 继续修，循环到双路 PASS 或全部处置有账。HIGH 不许挂账不修。',
    '最终按 schema 返回。',
  ].join('\n')
}

function learnPrompt(c, acc) {
  const fixNote = acc.fix ? ('修复轮：' + JSON.stringify(acc.fix.dispositions)) : '汇裁 CLEAN 零修复。'
  return [
    COMMON(c),
    '',
    '你是收尾者（review+learn 台账收口）。',
    'gate：' + (acc.fix ? acc.fix.gate : acc.build.gate) + '｜汇裁：' + acc.reviewArb.verdict + '｜' + fixNote,
    '',
    '1. 写 docs/plans/' + c.slug + '/learn.md：教训/真发现（含 plan 设计评审逮到的、代码评审逮到的、pi vs codex 差异观察）/挂账（route:human 或另契约逐条列明，含同族兜底待补正式跨族复审——若有）。',
    '2. contract advance review（artifact 指 loop/audit.jsonl）与 learn（artifact 指 learn.md），contract show 核六阶段全 done。',
    '3. 核本树 git status --short 干净（node_modules 软链除外）、所有改动已提交；未提交收尾文档补提交（显式路径）。',
    '4. 绝不合并回 dev——合并由主会话做。',
    '最终按 schema 返回（mergeReady = gate 绿 + tier1 绿 + 评审收口 + 树干净）。',
  ].join('\n')
}

log('两契约进 8 段 pipeline：drawer-lock-hardening（light）+ gen-prompts（full）')

const results = await pipeline(
  CONTRACTS,
  (c) => agent(planPrompt(c), { label: 'plan:' + c.slug, phase: 'Plan', model: 'fable', effort: 'xhigh', schema: PLAN_SCHEMA, agentType: 'general-purpose' })
    .then((plan) => (plan ? { c, plan } : null)),
  (acc) => {
    if (!acc) return null
    const { c, plan } = acc
    log(c.slug + '：plan 就绪，进 codex 设计评审')
    return agent(planReviewPrompt(c, plan), { label: 'planReview:' + c.slug, phase: 'PlanReview', model: 'sonnet', schema: PLANREVIEW_SCHEMA, agentType: 'general-purpose' })
      .then((planReview) => (planReview ? { ...acc, planReview } : null))
  },
  (acc) => {
    if (!acc) return null
    const { c, plan, planReview } = acc
    const clean = planReview.verdict.endsWith('PASS') && (!planReview.findings || planReview.findings.length === 0)
    if (clean) {
      log(c.slug + '：设计评审 PASS，plan 直用')
      return { ...acc, planArb: { revised: false, finalDirective: plan.summary, dispositions: [] } }
    }
    log(c.slug + '：设计评审有 findings（' + planReview.findings.length + '），fable 汇裁')
    return agent(planArbPrompt(c, plan, planReview), { label: 'planArb:' + c.slug, phase: 'PlanArb', model: 'fable', effort: 'xhigh', schema: PLANARB_SCHEMA, agentType: 'general-purpose' })
      .then((planArb) => (planArb ? { ...acc, planArb } : null))
  },
  (acc) => {
    if (!acc) return null
    const { c, plan, planArb } = acc
    log(c.slug + '：进 ultracode 实现')
    return agent(buildPrompt(c, plan, planArb), { label: 'build:' + c.slug, phase: 'Build', model: 'sonnet', effort: 'max', schema: BUILD_SCHEMA, agentType: 'general-purpose' })
      .then((build) => (build ? { ...acc, build } : null))
  },
  (acc) => {
    if (!acc) return null
    const { c } = acc
    log(c.slug + '：实现完，codex+pi 双路评审')
    return agent(reviewPrompt(c, acc), { label: 'review:' + c.slug, phase: 'Review', model: 'sonnet', schema: REVIEW_SCHEMA, agentType: 'general-purpose' })
      .then((review) => (review ? { ...acc, review } : null))
  },
  (acc) => {
    if (!acc) return null
    const { c } = acc
    log(c.slug + '：fable 汇裁双路评审')
    return agent(reviewArbPrompt(c, acc), { label: 'reviewArb:' + c.slug, phase: 'ReviewArb', model: 'fable', effort: 'xhigh', schema: REVIEWARB_SCHEMA, agentType: 'general-purpose' })
      .then((reviewArb) => (reviewArb ? { ...acc, reviewArb } : null))
  },
  (acc) => {
    if (!acc) return null
    const { c, reviewArb } = acc
    if (reviewArb.verdict === 'CLEAN') {
      log(c.slug + '：汇裁 CLEAN，跳过修复')
      return { ...acc, fix: null }
    }
    log(c.slug + '：汇裁 FINDINGS（' + reviewArb.adjudicated.length + '），进修复')
    return agent(fixPrompt(c, acc), { label: 'fix:' + c.slug, phase: 'Fix', model: 'sonnet', effort: 'max', schema: FIX_SCHEMA, agentType: 'general-purpose' })
      .then((fix) => (fix ? { ...acc, fix } : null))
  },
  (acc) => {
    if (!acc) return null
    const { c } = acc
    log(c.slug + '：进收尾')
    return agent(learnPrompt(c, acc), { label: 'learn:' + c.slug, phase: 'Learn', model: 'sonnet', effort: 'medium', schema: LEARN_SCHEMA, agentType: 'general-purpose' })
      .then((learn) => (learn ? { ...acc, learn } : null))
  }
)

const out = CONTRACTS.map((c, i) => ({ slug: c.slug, tree: c.tree, result: results[i] }))
const ready = out.filter((o) => o.result && o.result.learn && o.result.learn.mergeReady).map((o) => o.slug)
log('完成：' + ready.length + '/' + CONTRACTS.length + ' 契约 mergeReady（' + (ready.join('、') || '无') + '）')
return out
