// lib/selftest-tier2.mjs —— casey selftest --tier2 真机冒烟自检【纯函数层】
//   （p9-tier2-live-smoke，GRILL D3「壳/纯分层」+ plan §1.1）。
// 零 fs / 零 spawn / 零网络 / 零浏览器 / 零 process.*——判定逻辑与真机采集彻底分离：
//   本层只吃壳层注入的「已解析探针结果 + 单 run 产物投影 + 用例授权标志」，出逐项判定与退出码。
//   金牌用合成夹具即可逐项翻红绿（hermetic 可验），真机 live 跑本身是人签面（ADR-0009）。
//
// 三条不让的内核（GRILL D1/D4）：
//   1. fail-closed 不 fail-open：前置门任一红 → exit 2 且一例不跑；覆盖矩阵空 → exit 2，条件式检查绝不空转成绿；
//   2. 机器面 ≠ 语义面：产物齐全 + 四态合法的业务性非 PASS（SUT_DEFECT/NEEDS_HUMAN）属人签语义面，不判机器红；
//   3. 系统性故障（凭据/登录/隧道类）立即停全集，绝不对着断链环境轰剩余用例。
//
// 凭据纪律（护栏 #7）：本层只接布尔/计数/枚举等结构标志，凭据值与真目标地址结构上进不来；
//   所有文案一律中文与机器码，绝不含目标地址形态。

import {
  checkNode, checkPlaywrightPresent, checkPlaywrightImportable, checkChromium,
} from './doctor.mjs';

// ── 冻结面（金牌 T0 钉死；实现可为超集，逐项须在判定输出里可见）────────────

// 前置门逐项 id：doctor 就绪级四项（复用同名 id，不另起别名）+ GRILL D4 v2 显式清单
//   （凭据形状、登录引导、执行目标、隧道监听、带外账户回执、两段真实连通各判一项）+ 人签用例集 manifest。
export const TIER2_READINESS_IDS = Object.freeze([
  'node', 'playwright-present', 'playwright-import', 'chromium',
  'creds-shape', 'login-bootstrap', 'execution-target', 'tunnel-listening',
  'out-of-band-receipt', 'connectivity-win-target', 'connectivity-wsl-tunnel',
  'suite-manifest',
]);

// 单 run 证据判定逐项 id（plan §1.1）。
export const TIER2_EVIDENCE_IDS = Object.freeze([
  'verdict-quadstate-wellformed',
  'catch-all-intact',
  'network-forensics-attribution',
  'lifecycle-forensics',
  'credential-scan-clean',
  'streaming-hard-assertion-judged',
  'exit-code-legend',
]);

// run receipt 稳定子类枚举：前五项 = plan §1.3 冻结五类；
//   第六项 refused_unauthorized 是逐次授权拒跑的落账类（plan §1.2「缺授权 → 拒跑且 receipt 记录」
//   要求有 receipt，而拒跑的例根本没进管线，套用五类任一都是谎报）——按金牌「实现须为超集」口径追加。
export const TIER2_RECEIPT_CLASSES = Object.freeze([
  'pipeline_complete_with_verdict', 'stage_failed', 'timeout', 'partial_artifacts', 'systemic_abort',
  'refused_unauthorized',
]);

// 凭据扫描时序（GRILL D2 v3）：原始文本字节先扫 → 白名单投影 → 证据落盘前复扫。顺序本身是判据。
export const TIER2_SCAN_STAGES = Object.freeze(['raw_bytes', 'projection', 'pre_write']);

// 裁判通道运行时冒烟逐项 id（GRILL D1 v3 第三面；联审 r1 H1：本面此前只在金牌里跑、
//   现役 tier-2 命令从未行使，等于覆盖矩阵缺一面还能 exit 0）。
export const TIER2_JUDGE_SMOKE_IDS = Object.freeze([
  'judge-fixture-frozen',        // 三轴反例集源自已冻夹具且字节未漂移
  'judge-counterexamples-exact', // 逐条真调现役裁判二进制、四态与理由精确
  'judge-four-states-exact',     // 四态全覆盖且无第五态
  'judge-precedents-hash-bound', // 历史真机先例按产物 hash 绑定（在册文书记同 hash）
  'judge-evidence-persisted',    // 冒烟证据真落到盘上（写失败=没证据，必红；联审 r2 H1 残口）
]);

// 退出码归一图例（casey CLI 单一图例：0 成功 / 1 红 / 2 熔断·互锁·前置门 / 3 未实现 / 64 用参错）。
export const TIER2_EXIT_CODE_LEGEND = Object.freeze([0, 1, 2, 3, 64]);

// 四态（护栏 #14/#15）：机器只终判 PASS 与有取证背书的 SUT_DEFECT，证不出的一律 NEEDS_HUMAN。
export const TIER2_FOUR_STATES = Object.freeze(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);

// P9 final batch 中承担 created-in-run workflow 清理义务的精确三成员。
// 清洁面独立于业务 verdict；SUT_DEFECT/NEEDS_HUMAN 不能替代 cleanupSatisfied。
export const TIER2_CLEANUP_CASE_IDS = Object.freeze([
  'tc_catalog_wf_crud',
  'tc_wf_publish_states',
  'tc_wf_history_version',
]);

// exit 0 尾行常量（GRILL D4）：机器面绿只是机器面，完成判定归人签真机 UAT。
export const TIER2_MACHINE_GREEN_TAIL =
  '机器面绿≠完成：tier-2 只证分支机器面在真机上真实运转，完成判定须人签真机 UAT 清单（ADR-0009）。';

const DEFAULT_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
// 两段连通证据跨机采集（Windows 侧 / WSL 侧各出一份），允许的时钟偏差容差。
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

// ── 小工具（全纯）────────────────────────────────────────────────
function isRed(item) {
  return !!item && item.status !== 'ok' && item.status !== 'route-human';
}
function ok(id, detail) {
  return { id, status: 'ok', detail, hint: '' };
}
function fail(id, detail, hint) {
  return { id, status: 'fail', detail, hint: hint || '' };
}
function obj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function arr(v) {
  return Array.isArray(v) ? v : [];
}
// 时点新鲜度：非法时点 / 未来时点（超时钟容差）/ 超窗一律判不新鲜（fail-closed）。
function freshness(at, now, windowMs) {
  const t = Date.parse(String(at == null ? '' : at));
  const n = Date.parse(String(now == null ? '' : now));
  if (!Number.isFinite(t) || !Number.isFinite(n)) return { ok: false, reason: '时点非法或缺失' };
  const win = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_FRESHNESS_WINDOW_MS;
  const ageMs = n - t;
  if (ageMs < -CLOCK_SKEW_TOLERANCE_MS) return { ok: false, reason: '时点在未来（时钟偏差超容差）' };
  if (ageMs > win) return { ok: false, reason: `已过期（${Math.round(ageMs / 60000)} 分钟前，窗 ${Math.round(win / 60000)} 分钟）` };
  return { ok: true, ageMs };
}

// ── 前置门逐项（doctor 就绪四项直接复用同名纯函数）───────────────────
function credsShapeItem(creds) {
  const c = obj(creds);
  if (c.present !== true) return fail('creds-shape', '凭据不在位（真机 tier-2 必需）', '按 README 凭据节备好凭据文件或经环境变量传入');
  return c.shapeOk === true
    ? ok('creds-shape', '凭据在位且顶层键完整（只查键名，值不取）')
    : fail('creds-shape', '凭据在位但顶层键不完整（结构不符）', '按 README 凭据节补全顶层键');
}
function loginBootstrapItem(login) {
  return obj(login).requestedForEveryCase === true
    ? ok('login-bootstrap', '登录引导逐例强制在场')
    : fail('login-bootstrap', '登录引导未逐例强制（受众锁为 production 的用例必被凭据上下文门拒）',
      '壳层须给每例透传登录引导旗标');
}
function executionTargetItem(target) {
  const t = obj(target);
  // 传输方式名不回显（联审 r1 M1 实测坑）：它取自站点配置，会被共享凭据门的敏感字面量池收进去，
  //   一旦印进输出，整行都会被出口密封抹掉——分类要看跑 doctor，这里只报「解析成没成」。
  return t.resolved === true
    ? ok('execution-target', '执行目标已解析（分类在册，配置值不回显）')
    : fail('execution-target', '执行目标未解析或分类不可准入', '按运行平台配匹配的传输方式，并保持逻辑目标独立');
}
function tunnelListeningItem(tunnel) {
  const t = obj(tunnel);
  if (!Number.isInteger(t.proxyPort) || t.proxyPort <= 0) {
    return fail('tunnel-listening', '无回环端口可探（站点配置未给回环基址）', '先起隧道监听器并配回环基址');
  }
  return t.portListening === true
    ? ok('tunnel-listening', `回环端口 ${t.proxyPort} 在听`)
    : fail('tunnel-listening', `回环端口 ${t.proxyPort} 不在听`, '先起隧道监听器再跑 tier-2');
}
function outOfBandReceiptItem(receipt, now, windowMs) {
  const r = obj(receipt);
  if (r.present !== true) return fail('out-of-band-receipt', '带外账户回执文件不在场', '按 manifest 声明的路径落当日带外账户确认回执（只记标志与时点，凭据值绝不入内）');
  if (r.acknowledged !== true) return fail('out-of-band-receipt', '带外账户回执未标确认', '待带外确认到位再跑 tier-2');
  const f = freshness(r.confirmedAt, now, windowMs);
  return f.ok
    ? ok('out-of-band-receipt', '带外账户回执在场且在窗内')
    : fail('out-of-band-receipt', `带外账户回执时点不合格：${f.reason}`, '重新取当日带外确认回执');
}
function connectivityItem(id, seg, now, windowMs, label) {
  const s = obj(seg);
  if (s.present !== true) return fail(id, `${label}连通证据不在场`, '先采本段结构化连通结果（只记形状与状态码，地址不入证据）');
  if (s.ok !== true) return fail(id, `${label}连通证据判失败`, '先修通本段再跑 tier-2');
  const f = freshness(s.producedAt, now, windowMs);
  return f.ok ? ok(id, `${label}连通证据在场且在窗内`) : fail(id, `${label}连通证据时点不合格：${f.reason}`, '重采本段连通结果');
}
function suiteManifestItem(manifest) {
  const m = obj(manifest);
  if (m.present !== true) return fail('suite-manifest', '人签用例集 manifest 不在场（零动态发现：无 manifest 即无可跑用例）', '按契约形制落人签 manifest 并冻入 prd checksum');
  if (m.checksumOk !== true) return fail('suite-manifest', 'manifest checksum 失配或未冻入契约（件已漂移）', '重新核签并把 checksum 冻入 prd');
  if (m.signed !== true) return fail('suite-manifest', 'manifest 未人签（草案不算数）', '待签认人定稿签署后再跑');
  if (!Number.isInteger(m.memberCount) || m.memberCount <= 0) return fail('suite-manifest', 'manifest 成员集为空', '至少签入一条已授权用例');
  if (!Number.isInteger(m.caseLimit) || m.caseLimit <= 0) return fail('suite-manifest', 'manifest 未声明用例数上限', '补 caseLimit 声明');
  return ok('suite-manifest', `manifest 已人签、checksum 合法（成员 ${m.memberCount}，上限 ${m.caseLimit}）`);
}

// 前置门聚合（GRILL D4 v2 显式清单，逐项独立判定；任一红即一例不跑）。
export function judgeTier2Readiness(env = {}) {
  const e = obj(env);
  const p = obj(e.probes);
  const now = e.now;
  const win = e.freshnessWindowMs;
  const items = [
    checkNode(p.node),
    checkPlaywrightPresent(p.playwright),
    checkPlaywrightImportable(p.playwright),
    checkChromium(p.chromium),
    credsShapeItem(p.creds),
    loginBootstrapItem(p.loginBootstrap),
    executionTargetItem(p.executionTarget),
    tunnelListeningItem(p.tunnel),
    outOfBandReceiptItem(p.outOfBandReceipt, now, win),
    connectivityItem('connectivity-win-target', obj(p.connectivity).winTarget, now, win, '真实目标段'),
    connectivityItem('connectivity-wsl-tunnel', obj(p.connectivity).wslTunnel, now, win, '回环→隧道段'),
    suiteManifestItem(p.suiteManifest),
  ];
  return { items, ok: items.every((i) => !isRed(i)), redIds: items.filter(isRed).map((i) => i.id) };
}

// ── 凭据扫描时序（GRILL D2 v3：先扫原始字节，再投影，落盘前复扫；命中即零证据落盘）──
export function judgeTier2ScanTimeline({ stages, hits } = {}) {
  const seen = arr(stages).map(String);
  const found = arr(hits);
  const orderOk = seen.length === TIER2_SCAN_STAGES.length
    && TIER2_SCAN_STAGES.every((s, i) => seen[i] === s);
  const problems = [];
  if (!orderOk) problems.push(`扫描阶段须严格有序 ${TIER2_SCAN_STAGES.join(' → ')}，实得 ${seen.join(' → ') || '（空）'}`);
  if (found.length > 0) problems.push(`命中 ${found.length} 条（规则 ${found.map((h) => obj(h).rule || '未标注').join('/')}）`);
  const allOk = problems.length === 0;
  return {
    ok: allOk,
    emitEvidence: allOk, // fail-closed：时序不对或有命中 → 一个字节的证据都不许落盘
    stages: seen,
    hitCount: found.length,
    hitRules: found.map((h) => obj(h).rule || 'unlabeled'),
    problems,
  };
}

// 裁定步身份自洽（联审 r3 H5a）：纯层单源判据，采集层归类与本层证据判定共用。
export function judgeVerdictStepIdentity(verdict, axesSteps) {
  const v = verdict && typeof verdict === 'object' ? verdict : {};
  const counts = v.stateCounts && typeof v.stateCounts === 'object' ? v.stateCounts : {};
  const ids = Array.isArray(v.stepIds) ? v.stepIds : null;
  const problems = [];
  const stepCount = Number.isInteger(v.stepCount) ? v.stepCount : null;
  if (stepCount === null) problems.push('裁定缺步数');
  else if (stepCount <= 0) problems.push('裁定零步（零步产物不是「合法非全过」，是没跑）');
  const sum = ['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']
    .reduce((acc, k) => acc + (Number.isInteger(counts[k]) ? counts[k] : 0), 0);
  if (stepCount !== null && sum !== stepCount) problems.push(`四态计数总和(${sum})与裁定步数(${stepCount})不等`);
  if (!ids) problems.push('裁定缺逐步 stepId');
  else {
    if (stepCount !== null && ids.length !== stepCount) problems.push('裁定 stepId 条数与步数不等');
    if (ids.some((id) => typeof id !== 'string' || !id)) problems.push('裁定含空 stepId');
    if (new Set(ids).size !== ids.length) problems.push('裁定 stepId 重复');
    const axesIds = (Array.isArray(axesSteps) ? axesSteps : [])
      .map((s) => (s && typeof s.stepId === 'string' ? s.stepId : null))
      .filter(Boolean);
    const axesSet = new Set(axesIds);
    const verdictSet = new Set(ids.filter((id) => typeof id === 'string' && id));
    const missingInAxes = [...verdictSet].filter((id) => !axesSet.has(id));
    const missingInVerdict = axesIds.filter((id) => !verdictSet.has(id));
    if (missingInAxes.length) problems.push(`裁定步不在三轴步内：${missingInAxes.join('/')}`);
    if (missingInVerdict.length) problems.push(`三轴步未被裁定：${missingInVerdict.join('/')}`);
  }
  return { ok: problems.length === 0, problems };
}
// ── 单 run 证据判定（吃产物投影的白名单字段，非全文）────────────────
function quadStateItem(verdict, axes) {
  const v = obj(verdict);
  const counts = obj(v.stateCounts);
  if (v.schemaOk !== true) return fail('verdict-quadstate-wellformed', '裁定产物 schema 不合法', '查相4 裁定产物结构');
  const missing = TIER2_FOUR_STATES.filter((s) => !Number.isInteger(counts[s]));
  if (missing.length) return fail('verdict-quadstate-wellformed', `四态账缺态计数：${missing.join('/')}`, '四态计数须逐态在场且为整数');
  // 步身份自洽（联审 r3 H5a 残口）：零步裁定、计数和对不上步数、与三轴步不双射，都不是「四态账 well-formed」。
  const identity = judgeVerdictStepIdentity(v, arr(obj(axes).steps));
  if (!identity.ok) {
    return fail('verdict-quadstate-wellformed', `四态账与裁定步不自洽：${identity.problems.join('；')}`,
      '裁定须步数>0、四态计数总和等于步数、且与三轴步一一对应');
  }
  return ok('verdict-quadstate-wellformed', `四态账 well-formed（${v.stepCount} 步：${TIER2_FOUR_STATES.map((s) => `${s} ${counts[s]}`).join(' / ')}）`);
}
function catchAllItem(verdict, reportModel) {
  const v = obj(verdict);
  const unknown = arr(v.unknownStates).map(String);
  if (unknown.length) return fail('catch-all-intact', `出现四态外终态标签：${unknown.join('/')}（catch-all 被旁路）`, '裁判判定树的 catch-all 必须收全部未证明分支');
  const extraKeys = Object.keys(obj(v.stateCounts)).filter((k) => !TIER2_FOUR_STATES.includes(k));
  if (extraKeys.length) return fail('catch-all-intact', `态计数混入未知终态键：${extraKeys.join('/')}`, '终态集只允许四态');
  if (v.catchAllReachable !== true) return fail('catch-all-intact', 'catch-all 分支不可达（fail-safe 不变量被破）', '恢复「证不出的一律 NEEDS_HUMAN」兜底分支');
  const badges = arr(obj(reportModel).badgeStates).map(String);
  const badBadges = badges.filter((b) => !TIER2_FOUR_STATES.includes(b));
  if (badBadges.length) return fail('catch-all-intact', `报表徽章出现四态外标签：${badBadges.join('/')}`, '徽章集只允许四态');
  return ok('catch-all-intact', 'catch-all 语义未被旁路（无第五态、兜底可达）');
}
function networkForensicsItem(axes, network) {
  const a = obj(axes);
  const n = obj(network);
  if (a.schemaOk !== true) return fail('network-forensics-attribution', '三轴产物 schema 不合法', '查相3 回放产物结构');
  if (n.present !== true) return fail('network-forensics-attribution', '网络取证结构缺席', '回放须落网络取证');
  const entries = arr(n.entries);
  if (!entries.length) return fail('network-forensics-attribution', '网络取证在场但零条目', '取证为空不足以背书任何裁定');
  // 归因字段两项都须在场：initiator 非空串（发起方分类），attributedStepId 键在场且为串或 null
  //   （null = 本条不归任何步，正是「背景流量不背书本步」的 fail-safe 表达，不是缺字段）。
  const bad = entries.filter((e) => {
    const it = obj(e);
    if (typeof it.initiator !== 'string' || !it.initiator) return true;
    if (!Object.prototype.hasOwnProperty.call(it, 'attributedStepId')) return true;
    return !(it.attributedStepId === null || (typeof it.attributedStepId === 'string' && it.attributedStepId));
  });
  if (n.attributedByInitiator !== true || bad.length) {
    return fail('network-forensics-attribution', `网络取证未按发起方归因（缺 initiator/attributedStepId 的条目 ${bad.length} 条）`,
      '归因须按发起方，不得退回时间窗猜归属');
  }
  return ok('network-forensics-attribution', `网络取证按发起方归因在场（${entries.length} 条）`);
}
function lifecycleForensicsItem(axes, lifecycle) {
  const a = obj(axes);
  const l = obj(lifecycle);
  if (a.schemaOk !== true) return fail('lifecycle-forensics', '三轴产物 schema 不合法', '查相3 回放产物结构');
  if (l.present !== true) return fail('lifecycle-forensics', '生命周期取证缺席', '回放须落生命周期取证');
  if (typeof l.pageerrorCount !== 'number' || typeof l.crashed !== 'boolean') {
    return fail('lifecycle-forensics', '生命周期取证形状不合法（计数/崩溃标志缺或类型错）', '补齐生命周期取证字段');
  }
  return ok('lifecycle-forensics', `生命周期取证在场（页面错误 ${l.pageerrorCount}，崩溃 ${l.crashed ? '是' : '否'}）`);
}
function credentialScanItem(scan) {
  const t = judgeTier2ScanTimeline(obj(scan));
  return t.ok
    ? ok('credential-scan-clean', '凭据兜底扫描三阶段有序跑满且零命中')
    : fail('credential-scan-clean', `凭据兜底扫描不合格：${t.problems.join('；')}`, '命中即零证据落盘；先查投影白名单与原始字节扫描');
}
function streamingItem(streamingAssertions, axes) {
  const sa = obj(streamingAssertions);
  const expected = arr(sa.expected).map(obj);
  const judged = arr(sa.judged).map(obj);
  const steps = arr(obj(axes).steps).map(obj);
  const hard = expected.filter((e) => e.kind === 'streamReplyReceived' && e.soft === false);
  if (!hard.length) {
    // 本例不含硬流式断言：本项不适用（覆盖矩阵非空由聚合层单独 fail-closed，绝不靠本项空转成绿）。
    return ok('streaming-hard-assertion-judged', '本例无硬流式断言（覆盖矩阵非空另由聚合层判定）');
  }
  const problems = [];
  for (const h of hard) {
    const matches = judged.filter((j) => j.intentId === h.intentId && j.stepId === h.stepId && j.kind === h.kind);
    if (matches.length !== 1) {
      problems.push(`断言 ${h.intentId}/${h.stepId}/${h.kind} 的裁定条目 join 不唯一（${matches.length} 条）`);
      continue;
    }
    if (typeof matches[0].ok !== 'boolean') {
      problems.push(`断言 ${h.intentId}/${h.stepId}/${h.kind} 的裁定结论非布尔（防非布尔静默降级）`);
      continue;
    }
    const step = steps.find((s) => s.stepId === h.stepId && s.intentId === h.intentId);
    const hardKinds = arr(step && step.hardAssertionKinds).map(String);
    const judgedKinds = arr(step && step.judgedAssertionKinds).map(String);
    if (!step || !hardKinds.includes(h.kind) || !judgedKinds.includes(h.kind)) {
      problems.push(`断言 ${h.intentId}/${h.stepId}/${h.kind} 在三轴步账里未记为已裁硬断言`);
    }
  }
  return problems.length
    ? fail('streaming-hard-assertion-judged', `硬流式断言未被真实裁过：${problems.join('；')}`, '流式面只判回完，正文与耗时绝不入裁；裁定条目须按意图/步/种类唯一 join')
    : ok('streaming-hard-assertion-judged', `硬流式断言已被真实裁过（${hard.length} 条）`);
}
function exitCodeLegendItem(reportModel) {
  const rm = obj(reportModel);
  if (rm.schemaOk !== true) return fail('exit-code-legend', '报表模型 schema 不合法', '查报表模型装配产物结构');
  const legend = arr(rm.exitCodeLegend);
  const legal = legend.every((c) => TIER2_EXIT_CODE_LEGEND.includes(c))
    && TIER2_EXIT_CODE_LEGEND.every((c) => legend.includes(c));
  return legal
    ? ok('exit-code-legend', `退出码归一图例合法（${TIER2_EXIT_CODE_LEGEND.join('/')}）`)
    : fail('exit-code-legend', `退出码归一图例非法：实得 ${legend.join('/') || '（空）'}`, `图例须恰为 ${TIER2_EXIT_CODE_LEGEND.join('/')}`);
}

export function judgeTier2RunEvidence(projection = {}) {
  const p = obj(projection);
  const axes = obj(p.axes);
  const forensics = obj(axes.forensics);
  const items = [
    quadStateItem(p.verdict, axes),
    catchAllItem(p.verdict, p.reportModel),
    networkForensicsItem(axes, forensics.network),
    lifecycleForensicsItem(axes, forensics.lifecycle),
    credentialScanItem(p.credentialScan),
    streamingItem(p.streamingAssertions, axes),
    exitCodeLegendItem(p.reportModel),
  ];
  return {
    caseId: typeof p.caseId === 'string' ? p.caseId : null,
    items,
    ok: items.every((i) => !isRed(i)),
    redIds: items.filter(isRed).map((i) => i.id),
  };
}

// ── P9 created-in-run workflow 清洁面（独立于业务四态）──────────────
// 一批一个 fresh batchToken；按固定成员顺序派生三枚 per-case uniqueNameToken。
// receipt 必须同时闭合 batch/case/name lineage，且逐例 cleanupSatisfied:true。
export function judgeTier2CleanupObligations(input = {}) {
  const source = obj(input);
  const problems = [];
  const batchId = typeof source.batchId === 'string' && source.batchId ? source.batchId : null;
  const batchToken = typeof source.batchToken === 'string' && source.batchToken ? source.batchToken : null;
  const declared = arr(source.mutationCaseIds).map(String);
  const receipts = arr(source.receipts).map(obj);

  const exactDeclared = declared.length === TIER2_CLEANUP_CASE_IDS.length
    && new Set(declared).size === TIER2_CLEANUP_CASE_IDS.length
    && TIER2_CLEANUP_CASE_IDS.every((caseId) => declared.includes(caseId));
  if (!exactDeclared) problems.push('mutation 用例集必须恰为固定三成员');
  if (!batchId) problems.push('batchId 缺失或非法');
  if (!batchToken) problems.push('batchToken 缺失或非法');
  if (batchToken && arr(source.priorBatchTokens).map(String).includes(batchToken)) {
    problems.push('batchToken 已在历史批次使用');
  }

  const receiptIds = receipts.map((receipt) => receipt.caseId);
  if (receipts.length !== TIER2_CLEANUP_CASE_IDS.length
    || new Set(receiptIds).size !== TIER2_CLEANUP_CASE_IDS.length
    || !TIER2_CLEANUP_CASE_IDS.every((caseId) => receiptIds.includes(caseId))) {
    problems.push('cleanup receipt 必须恰好覆盖固定三成员');
  }

  let satisfiedCount = 0;
  for (const [index, caseId] of TIER2_CLEANUP_CASE_IDS.entries()) {
    const receipt = receipts.find((row) => row.caseId === caseId);
    if (!receipt) continue;
    const expectedToken = batchToken ? `${batchToken}-case-${index + 1}` : null;
    const expectedName = expectedToken ? `atl_${expectedToken}` : null;
    if (receipt.batchId !== batchId || receipt.batchToken !== batchToken) {
      problems.push(`用例 ${caseId} batch lineage 不闭合`);
    }
    if (receipt.uniqueNameToken !== expectedToken || receipt.derivedEntityName !== expectedName) {
      problems.push(`用例 ${caseId} per-case token/name lineage 不闭合`);
    }
    if (receipt.receiptClass !== 'pipeline_complete_with_verdict') {
      problems.push(`用例 ${caseId} receipt 不是管线完成件`);
    }
    if (!['PASS', 'SUT_DEFECT', 'NEEDS_HUMAN'].includes(receipt.verdict)) {
      problems.push(`用例 ${caseId} verdict 不属于可聚合业务态`);
    }
    if (receipt.cleanupSatisfied === true) satisfiedCount += 1;
    else problems.push(`用例 ${caseId} cleanupSatisfied 不为 true`);
  }

  const tokens = receipts.map((receipt) => receipt.uniqueNameToken);
  const names = receipts.map((receipt) => receipt.derivedEntityName);
  if (tokens.some((value) => typeof value !== 'string' || !value)
    || new Set(tokens).size !== TIER2_CLEANUP_CASE_IDS.length) {
    problems.push('三例 per-case uniqueNameToken 缺失或碰撞');
  }
  if (names.some((value) => typeof value !== 'string' || !value)
    || new Set(names).size !== TIER2_CLEANUP_CASE_IDS.length) {
    problems.push('三例派生实体名缺失或碰撞');
  }

  return {
    ok: problems.length === 0,
    cleanupSatisfied: problems.length === 0 && satisfiedCount === TIER2_CLEANUP_CASE_IDS.length,
    satisfiedCount,
    problems,
  };
}

// ── 逐次授权筛（壳层 spawn 前与聚合层判定共用同一判据，防两处漂移）──────
// 拒付码用词纪律：这些码会写进 receipt，而 receipt 落盘前要过凭据兜底扫描（`lib/cred-gate.mjs`
//   的禁字段关键词表含 authorization/token/secret/cookie...）——自家字段名与码值一律避开禁词，
//   否则自己的账会被自己的扫描判命中、零证据落盘（本会话探针实测过这个坑）。
export function screenTier2CaseAuthorization(entry = {}) {
  const e = obj(entry);
  if (e.smokeAuthorized !== true) {
    return { ran: false, refusalReason: 'manifest_smoke_authorized_flag_absent' };
  }
  if (e.effect !== 'read' && e.effect !== 'mutation') {
    return { ran: false, refusalReason: 'effect_class_unauthorized' };
  }
  if (e.effect === 'mutation' && e.authorizedMutation !== true) {
    return { ran: false, refusalReason: 'per_run_mutation_authorized_flag_absent' };
  }
  return { ran: true, refusalReason: null };
}

// ── tier-2 专用严格解析器（GRILL D2 v3 + 联审 r1 M1 回显纪律）──────────
// 解析器与脱敏回显搬去 lib/selftest-tier2-args.mjs（同为纯层；本层 600 行硬顶下拆模块），
// 这里原样再导出，纯层消费方（壳层、金牌）的导入面不变。
export {
  parseTier2Args, formatTier2ArgErrors, redactCategory,
  TIER2_ARG_CODES, isLoopbackBaseUrl, TIER2_DEFAULT_CASE_LIMIT,
} from './selftest-tier2-args.mjs';

// ── 裁判通道运行时冒烟判定（覆盖矩阵第三面：SUT_DEFECT 面）─────────────
// 吃壳层真调现役 bin/verdict.mjs 的结构化产出 + 先例 hash 核验结果，出逐项判定。
// 不造假缺陷（GRILL D1 v3）：本面证的是「裁判通道健在」（冻结反例集四态精确）+
//   「历史真机 SUT_DEFECT 先例按产物 hash 在册」，不是本次真机必须冒出缺陷。
export function judgeTier2JudgeChannelSmoke(smoke) {
  const s = obj(smoke);
  const cases = arr(s.cases).map(obj);
  const precedents = arr(s.precedents).map(obj);
  const produced = new Set(arr(s.statesProduced).map(String));
  const items = [];

  items.push(s.fixtureChecksumOk === true
    ? ok('judge-fixture-frozen', '三轴反例集源自已冻夹具且字节未漂移')
    : fail('judge-fixture-frozen', '三轴反例集夹具缺席、未在册或字节已漂移', '反例集只许引已冻夹具，不许现造'));

  const badCases = cases.filter((c) => c.ok !== true);
  if (s.ran !== true || !cases.length) {
    items.push(fail('judge-counterexamples-exact', '裁判通道冒烟未真跑（反例集零条目）', '真调现役裁判二进制逐条喂冻结反例集'));
  } else if (badCases.length) {
    items.push(fail('judge-counterexamples-exact',
      `裁判产出与冻结期望不符：${badCases.map((c) => `${c.id}（期望 ${c.expectVerdict}${c.expectReason ? '/' + c.expectReason : ''}，实得 ${c.actualVerdict}${c.actualReason ? '/' + c.actualReason : ''}）`).join('；')}`,
      '裁判判定树已漂移或反例集与判据失配'));
  } else {
    items.push(ok('judge-counterexamples-exact', `冻结反例集逐条精确（${cases.length} 条）`));
  }

  const missingStates = TIER2_FOUR_STATES.filter((st) => !produced.has(st));
  const extraStates = [...produced].filter((st) => !TIER2_FOUR_STATES.includes(st));
  items.push(!missingStates.length && !extraStates.length
    ? ok('judge-four-states-exact', '四态精确全覆盖（无第五态）')
    : fail('judge-four-states-exact', `四态覆盖不精确（缺 ${missingStates.join('/') || '无'}；多 ${extraStates.join('/') || '无'}）`,
      '冒烟须逐态产出且不得冒出四态外标签'));

  // 证据落不了盘就等于没证据（盘满/权限错时绝不许还声称第三面成立）。
  items.push(s.evidencePersisted === true
    ? ok('judge-evidence-persisted', '裁判通道冒烟证据已落盘（可复核）')
    : fail('judge-evidence-persisted', '裁判通道冒烟证据未落盘（写失败或被凭据扫描拦下）',
      '证据写不下去即无证据：先修落盘（磁盘/权限/扫描命中）再跑'));

  const badPrecedents = precedents.filter((p) => p.hashBound !== true
    || (p.artifactPresent === true && p.hashMatch !== true));
  items.push(precedents.length && !badPrecedents.length
    ? ok('judge-precedents-hash-bound', `历史真机先例按产物 hash 绑定（${precedents.length} 条）`)
    : fail('judge-precedents-hash-bound',
      precedents.length ? `先例 hash 未绑定或已漂移：${badPrecedents.map((p) => p.id || '未标注').join('/')}` : '用例集未记历史真机先例',
      '先例须 path + sha256 + 在册签认文书三绑定'));

  return { items, ok: items.every((i) => !isRed(i)), redIds: items.filter(isRed).map((i) => i.id) };
}

// ── 聚合（plan §1.1：前置门红 → 2；证据红 → 1；全绿 → 0 + 尾行常量）─────
function coverageOf(caseResults, judgeSmokeResult) {
  const ran = caseResults.filter((r) => r.ran);
  const forensics = ran.some((r) => {
    const ids = arr(obj(r.evidence).items).filter((i) => !isRed(i)).map((i) => i.id);
    return ids.includes('network-forensics-attribution') && ids.includes('lifecycle-forensics');
  });
  const streaming = ran.some((r) => arr(obj(obj(r.projection).streamingAssertions).expected)
    .map(obj).some((e) => e.kind === 'streamReplyReceived' && e.soft === false));
  // 第三面（SUT_DEFECT）与用例跑不跑无关：它是裁判通道本体的运行时冒烟。
  return { forensics, streaming, sutDefect: obj(judgeSmokeResult).ok === true };
}

export function runTier2(env = {}) {
  const e = obj(env);
  const readinessResult = judgeTier2Readiness(e);
  const readiness = readinessResult.items;
  const cleanupRequired = Object.prototype.hasOwnProperty.call(e, 'cleanupObligations');
  const cleanup = cleanupRequired
    ? judgeTier2CleanupObligations(e.cleanupObligations)
    : { ok: true, cleanupSatisfied: true, satisfiedCount: 0, problems: [], required: false };
  // 第三面恒判（缺席即红）：判定不依赖用例跑没跑，故前置门红/空集时也如实出这一面。
  const judgeSmoke = judgeTier2JudgeChannelSmoke(e.judgeSmoke);
  const emptyResult = (reasons) => ({
    exitCode: 2,
    readiness,
    caseResults: [],
    coverage: { forensics: false, streaming: false, sutDefect: judgeSmoke.ok },
    judgeSmoke,
    cleanup,
    evidenceEmitted: false,
    aborted: false,
    stoppedAtCaseId: null,
    tailLine: null,
    reasons,
  });
  // fail-closed：前置门任一红 → 一例不跑（run 子进程从未启动的机器可读形态 = caseResults 为空）。
  if (!readinessResult.ok) return emptyResult([`前置门红：${readinessResult.redIds.join('/')}`]);

  const cases = arr(e.cases).map(obj);
  if (!cases.length) return emptyResult(['用例集为空（覆盖矩阵空，绝不空转成绿）']);

  const caseResults = [];
  const reasons = [];
  let aborted = false;
  let stoppedAtCaseId = null;
  let refusedCount = 0;
  let machineRedCount = 0;
  let scanViolation = false;

  for (const entry of cases) {
    const caseId = typeof entry.caseId === 'string' ? entry.caseId : null;
    const auth = screenTier2CaseAuthorization(entry);
    if (!auth.ran) {
      refusedCount += 1;
      reasons.push(`用例 ${caseId} 拒跑：${auth.refusalReason}`);
      caseResults.push({
        caseId,
        ran: false,
        machineRed: false,
        receiptClass: 'refused_unauthorized',
        receipt: {
          ...obj(entry.receipt),
          caseId,
          class: 'refused_unauthorized',
          ran: false,
          refusalReason: auth.refusalReason,
        },
        evidence: null,
        projection: null,
      });
      continue;
    }

    const projection = obj(entry.projection);
    const receipt = obj(entry.receipt);
    const receiptClass = typeof receipt.class === 'string' ? receipt.class : null;
    const evidence = judgeTier2RunEvidence(projection);
    const scan = judgeTier2ScanTimeline(obj(projection.credentialScan));
    if (!scan.emitEvidence) scanViolation = true;

    let machineRed;
    if (receiptClass === 'pipeline_complete_with_verdict') {
      // 机器面 ≠ 语义面：产物齐 + 四态合法的业务性非 PASS（SUT_DEFECT/NEEDS_HUMAN）属人签语义面。
      // 但 HARNESS_ERROR 不是业务性非 PASS——它是确证的工装错（护栏 #13 自愈入口），
      // 机器面必须判红（联审 r1 H2：此前一视同仁，HARNESS_ERROR=1 仍 exit 0 带绿尾行 = 假绿）。
      const harnessErrors = Number(obj(obj(projection.verdict).stateCounts).HARNESS_ERROR) || 0;
      machineRed = !evidence.ok || harnessErrors > 0;
      if (!evidence.ok) reasons.push(`用例 ${caseId} 证据判定红：${evidence.redIds.join('/')}`);
      if (harnessErrors > 0) reasons.push(`用例 ${caseId} 工装面红：裁定含 HARNESS_ERROR ${harnessErrors} 步（确证工装错，非业务性非 PASS）`);
    } else if (receiptClass === 'systemic_abort') {
      machineRed = true;
      aborted = true;
      stoppedAtCaseId = caseId;
      reasons.push(`用例 ${caseId} 触发系统性故障（凭据/登录/隧道类）→ 停全集`);
    } else if (receiptClass === 'stage_failed' || receiptClass === 'timeout' || receiptClass === 'partial_artifacts') {
      machineRed = true;
      reasons.push(`用例 ${caseId} 工装面红（${receiptClass}）`);
    } else {
      machineRed = true; // 未知 receipt 子类 fail-closed
      reasons.push(`用例 ${caseId} receipt 子类不在枚举内（${receiptClass || '缺失'}）`);
    }
    // receipt 必须真落到盘上（联审 r2 H5 残口）：壳层回读核过才算数，
    //   写失败/被扫描拦下都=这一例没有机器可读账，绝不许算绿。
    const receiptPersisted = entry.receiptPersisted === true;
    if (!receiptPersisted) {
      machineRed = true;
      reasons.push(`用例 ${caseId} 的 run receipt 未落盘（写失败或扫描命中）→ 无账即红`);
    }
    if (machineRed) machineRedCount += 1;
    if (!scan.emitEvidence) reasons.push(`用例 ${caseId} 凭据扫描不合格 → 零证据落盘`);

    caseResults.push({
      caseId, ran: true, machineRed, receiptClass, receipt, evidence, projection,
      evidenceEmitted: scan.emitEvidence, receiptPersisted,
    });
    if (aborted) break; // 停全集：绝不对着断链环境轰剩余用例
  }

  const coverage = coverageOf(caseResults, judgeSmoke);
  const evidenceEmitted = !scanViolation;
  let exitCode;
  if (aborted) exitCode = 2;
  else if (refusedCount > 0) exitCode = 2;
  else if (!coverage.forensics || !coverage.streaming || !coverage.sutDefect) {
    exitCode = 2;
    if (!coverage.forensics) reasons.push('覆盖矩阵：取证面为空（fail-closed）');
    if (!coverage.streaming) reasons.push('覆盖矩阵：流式面为空（无合格硬流式断言用例，fail-closed）');
    if (!coverage.sutDefect) reasons.push(`覆盖矩阵：SUT_DEFECT 面未成立（裁判通道冒烟红：${judgeSmoke.redIds.join('/')}）`);
  } else if (machineRedCount > 0 || scanViolation || !cleanup.ok) {
    exitCode = 1;
    if (!cleanup.ok) reasons.push(`环境清洁面红：${cleanup.problems.join('；')}`);
  }
  else exitCode = 0;

  return {
    exitCode,
    readiness,
    caseResults,
    coverage,
    judgeSmoke,
    cleanup,
    evidenceEmitted,
    aborted,
    stoppedAtCaseId,
    tailLine: exitCode === 0 ? TIER2_MACHINE_GREEN_TAIL : null,
    reasons,
  };
}
