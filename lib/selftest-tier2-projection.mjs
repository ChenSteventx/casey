// lib/selftest-tier2-projection.mjs —— tier-2 单 run 产物白名单投影 + receipt 归类【采集层】
//   （plan §1.2/§1.3；联审 r1 H4 + H5 收口）。
// 三条硬纪律：
//   ① 目录排他（H5）：每例一个【新建且必然为空】的 run 目录（毫秒 + 随机后缀，EEXIST 就换），
//      同秒重跑绝不复用旧目录、绝不把上次产物当本次证据；
//   ② 时刻与一致性（H5）：核每件产物的生成时刻晚于本次启动、核完整附件集在场、
//      核子进程退出码与裁定结论自相一致（生产 run 的契约：全 PASS ⇔ exit 0）；
//   ③ 原始字节先扫（H4）：每个原始输入（三轴/裁定/报表模型/已签期望）先按字节过凭据兜底扫描，
//      再解析、再投影——投影会丢掉嵌套敏感值，只扫投影等于自欺。
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PROJECT_ROOT } from './paths.mjs';
import { summarizeRunVerdict } from './run-outcome.mjs';
import { scanRawArtifactFile } from './selftest-tier2-scan.mjs';
// 裁定步身份判据单源在纯层（本层只消费，不另写一份）。
import { judgeVerdictStepIdentity } from './selftest-tier2.mjs';

// 生产 run 的完整附件集（replay/verdict/report-model/report 四段的落盘约定）。
// 录屏两件（video.webm/video.json）是必备（联审 r2 新 M）：真机正式交付「除非用户明确要求无录屏，
//   否则 --no-video 产物不能作为正式交付」（docs/runbooks/real-uat-runbook.md:92 第 3/4 条），
//   而 tier-2 恒不带 --no-video——缺录像即交付不合格，绝不许算管线完成。
const REQUIRED_ATTACHMENTS = Object.freeze([
  'axes.json', 'verdict.json', 'report-model.json', 'run-history.jsonl', 'run-metrics.json',
  'video.webm', 'video.json',
]);
const REPORT_SUFFIXES = Object.freeze(['report.html', 'report.md', 'report.json']);

// ── ① 排他 run 目录 ───────────────────────────────────────────
export function createExclusiveRunDir(caseId, { attempts = 8 } = {}) {
  const parent = join(PROJECT_ROOT, 'runs', caseId);
  mkdirSync(parent, { recursive: true });
  for (let i = 0; i < attempts; i++) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\./g, '');
    const runId = `run_tier2_${stamp}_${randomBytes(3).toString('hex')}`;
    const abs = join(parent, runId);
    try {
      mkdirSync(abs, { recursive: false }); // 已存在即抛（排他创建，绝不复用）
    } catch { continue; }
    if (readdirSync(abs).length !== 0) continue; // 新建目录必须为空，否则换一个
    return { runId, runDirAbs: abs, runDirRel: `runs/${caseId}/${runId}` };
  }
  return null;
}

function statusClassOf(status) {
  return Number.isInteger(status) && status > 0 ? `${Math.floor(status / 100)}xx` : null;
}

export function projectCreatedWorkflowCleanup(axesDoc, modelDoc) {
  const cleanup = axesDoc?.cleanup;
  if (!cleanup || typeof cleanup !== 'object' || Array.isArray(cleanup)) return null;
  return {
    cleanupSatisfied: cleanup.cleanupSatisfied === true,
    sampleCount: Number.isInteger(cleanup.sampleCount) ? cleanup.sampleCount : 0,
    windowMs: Number.isFinite(cleanup.windowMs) ? cleanup.windowMs : 0,
    batchToken: typeof cleanup.batchToken === 'string' ? cleanup.batchToken : null,
    uniqueNameToken: typeof cleanup.uniqueNameToken === 'string' ? cleanup.uniqueNameToken : null,
    derivedEntityName: typeof cleanup.entityName === 'string' ? cleanup.entityName : null,
    reportProjected: Array.isArray(modelDoc?.cleanupEvidence)
      && modelDoc.cleanupEvidence.some((row) => row?.op === 'stableTargetAbsence'),
  };
}

// ── ③ 原始字节先扫 + 白名单投影 ──────────────────────────────
export function projectRunArtifacts({ caseId, runDirRel, runDirAbs, exitCodeLegend, expectedAbs, recorder, startedAtMs }) {
  const rawInputs = [
    ['axes', join(runDirAbs, 'axes.json')],
    ['verdict', join(runDirAbs, 'verdict.json')],
    ['reportModel', join(runDirAbs, 'report-model.json')],
    ['expected', expectedAbs],
  ];
  const docs = {};
  const staleArtifacts = [];
  for (const [key, abs] of rawInputs) {
    if (!abs || !existsSync(abs)) { docs[key] = null; continue; }
    // 生成时刻核验（H5）：run 目录内产物必须是本次启动之后生成的。
    if (key !== 'expected' && Number.isFinite(startedAtMs)) {
      let mtimeMs = 0;
      try { mtimeMs = statSync(abs).mtimeMs; } catch { mtimeMs = 0; }
      if (!(mtimeMs >= startedAtMs)) staleArtifacts.push(key);
    }
    const scanned = scanRawArtifactFile(abs);
    if (recorder) recorder.add(scanned.hits);
    docs[key] = scanned.json;
  }
  if (recorder) recorder.complete('raw_bytes'); // 原始字节阶段到此真跑完

  const axesDoc = docs.axes;
  const verdictDoc = docs.verdict;
  const modelDoc = docs.reportModel;
  const expectedDoc = docs.expected;

  const outcome = summarizeRunVerdict(verdictDoc);
  const verdictSteps = Array.isArray(verdictDoc?.steps) ? verdictDoc.steps : [];
  const unknownStates = [...new Set(verdictSteps
    .map((s) => s && s.verdict)
    .filter((v) => typeof v === 'string' && !Object.keys(outcome.counts).includes(v)))];
  // 裁定步身份（联审 r3 H5a 残口）：零步裁定此前被当「合法非全过」——
  //   步数、四态计数总和、与三轴步的双射，三者必须自洽才谈得上「管线跑完且有裁定」。
  const verdictStepIds = verdictSteps.map((s) => (s && typeof s.stepId === 'string' ? s.stepId : null));

  const rawSteps = Array.isArray(axesDoc?.steps) ? axesDoc.steps : [];
  const steps = rawSteps.map((s) => {
    const posts = Array.isArray(s?.postAssertions) ? s.postAssertions : [];
    return {
      stepId: typeof s?.stepId === 'string' ? s.stepId : null,
      intentId: typeof s?.intentId === 'string' ? s.intentId : null,
      kind: (s?.action && typeof s.action.kind === 'string') ? s.action.kind
        : (s?.atom && typeof s.atom.kind === 'string' ? s.atom.kind : null),
      hardAssertionKinds: posts.filter((a) => a && a.soft === false).map((a) => a.kind),
      judgedAssertionKinds: posts.filter((a) => a && typeof a.ok === 'boolean').map((a) => a.kind),
    };
  });

  // 网络取证：只留发起方 / 归因步 / 状态码类别——地址、正文、请求头一律不投影。
  const netEntries = [];
  let networkPresent = false;
  for (const s of rawSteps) {
    const list = s && s.forensics && Array.isArray(s.forensics.network) ? s.forensics.network : null;
    if (!list) continue;
    networkPresent = true;
    for (const e of list) {
      netEntries.push({
        initiator: typeof e?.initiator === 'string' ? e.initiator : null,
        attributedStepId: e && Object.prototype.hasOwnProperty.call(e, 'attributedStepId')
          ? (typeof e.attributedStepId === 'string' ? e.attributedStepId : null)
          : undefined,
        statusClass: statusClassOf(e?.status),
      });
    }
  }
  // 「按发起方归因」是产物的结构性属性：逐条都带发起方分类与归因步字段才算成立。
  const attributedByInitiator = netEntries.length > 0 && netEntries.every((e) => typeof e.initiator === 'string'
    && e.initiator && Object.prototype.hasOwnProperty.call(e, 'attributedStepId'));

  let lifecyclePresent = false;
  let pageerrorCount = 0;
  let crashed = false;
  for (const s of rawSteps) {
    const lc = s && s.forensics ? s.forensics.lifecycle : null;
    if (!lc || typeof lc !== 'object') continue;
    lifecyclePresent = true;
    if (Array.isArray(lc.pageerror)) pageerrorCount += lc.pageerror.length;
    if (lc.crashed === true) crashed = true;
  }

  // 流式断言：期望侧取已签契约（证明真被要求），裁定侧取三轴步账（证明真被裁过）。
  const expectedStream = [];
  for (const intent of Array.isArray(expectedDoc?.intents) ? expectedDoc.intents : []) {
    for (const a of Array.isArray(intent?.expected) ? intent.expected : []) {
      if (!a || a.kind !== 'streamReplyReceived') continue;
      const step = steps.find((s) => s.intentId === intent.intentId && s.hardAssertionKinds.includes('streamReplyReceived'))
        || steps.find((s) => s.intentId === intent.intentId);
      expectedStream.push({
        intentId: typeof intent.intentId === 'string' ? intent.intentId : null,
        stepId: step ? step.stepId : null,
        kind: 'streamReplyReceived',
        soft: a.soft === true,
      });
    }
  }
  const judgedStream = [];
  for (const s of rawSteps) {
    for (const a of Array.isArray(s?.postAssertions) ? s.postAssertions : []) {
      if (!a || a.kind !== 'streamReplyReceived') continue;
      judgedStream.push({
        intentId: typeof s.intentId === 'string' ? s.intentId : null,
        stepId: typeof s.stepId === 'string' ? s.stepId : null,
        kind: 'streamReplyReceived',
        ok: typeof a.ok === 'boolean' ? a.ok : null,
      });
    }
  }

  const projection = {
    caseId,
    runDir: runDirRel,
    verdict: {
      schemaOk: !!verdictDoc && !outcome.malformed,
      stateCounts: outcome.counts,
      stepCount: verdictSteps.length,
      stepIds: verdictStepIds,
      unknownStates,
      // catch-all 可达性：单 run 侧的可观测代理（产物零四态外标签、四态计数齐全）；
      // 裁判本体的 catch-all 由第三面「裁判通道运行时冒烟」真调二进制作证。
      catchAllReachable: !!verdictDoc && !outcome.malformed && unknownStates.length === 0,
    },
    axes: {
      schemaOk: !!axesDoc && rawSteps.length > 0,
      steps,
      forensics: {
        network: { present: networkPresent, attributedByInitiator, entries: netEntries },
        lifecycle: { present: lifecyclePresent, pageerrorCount, crashed },
      },
    },
    reportModel: {
      schemaOk: !!modelDoc && Number.isInteger(modelDoc.schemaVersion),
      exitCodeLegend,
      badgeStates: modelDoc && modelDoc.verdictSummary && typeof modelDoc.verdictSummary === 'object'
        ? Object.keys(modelDoc.verdictSummary) : [],
    },
    streamingAssertions: { expected: expectedStream, judged: judgedStream },
    createdWorkflowCleanup: projectCreatedWorkflowCleanup(axesDoc, modelDoc),
  };
  // 投影阶段复扫（白名单外嵌套敏感值若混进投影，在此暴露）。
  if (recorder) {
    recorder.scan(JSON.stringify(projection), 'projection');
    recorder.complete('projection');
  }

  // ② 完整附件集 + 报告三件
  const attachments = {};
  for (const name of REQUIRED_ATTACHMENTS) attachments[name] = existsSync(join(runDirAbs, name));
  for (const suffix of REPORT_SUFFIXES) attachments[`${caseId}.${suffix}`] = existsSync(join(runDirAbs, `${caseId}.${suffix}`));
  const attachmentsComplete = Object.values(attachments).every(Boolean);

  // 「裁定合法」= schema 合法 + 无四态外标签 + 步身份自洽（零步/计数对不上/与三轴步不双射一律不合法）。
  const stepIdentity = judgeVerdictStepIdentity(projection.verdict, steps);
  return {
    projection,
    attachments,
    attachmentsComplete,
    staleArtifacts,
    someArtifacts: !!axesDoc || !!verdictDoc || !!modelDoc,
    verdictWellFormed: !!verdictDoc && !outcome.malformed && unknownStates.length === 0 && stepIdentity.ok,
    verdictStepProblems: stepIdentity.problems,
    allPass: outcome.allPass,
    stateCounts: outcome.counts,
  };
}

// ── receipt 归类（五类 + 一致性判据；plan §1.3）─────────────────
export function classifyTier2Receipt({ projected, timedOut, systemicCode, childExitCode, exitCodeLegend }) {
  const problems = [];
  if (timedOut) return { receiptClass: 'timeout', problems: ['超出用例声明超时'] };
  if (systemicCode) return { receiptClass: 'systemic_abort', problems: [`系统性前置闸拒付：${systemicCode}`] };

  const exitInLegend = Number.isInteger(childExitCode) && (exitCodeLegend || []).includes(childExitCode);
  if (!exitInLegend) problems.push(`子进程退出码不在归一图例内（${childExitCode}）`);
  if (projected.staleArtifacts.length) problems.push(`产物早于本次启动（疑复用旧件）：${projected.staleArtifacts.join('/')}`);
  // 生产 run 契约只有两种「管线跑完」形态（联审 r2 H5 残口：此前只封 0/1，
  //   2/3/64 配齐全产物照样被当管线完成）：0 ⇔ 全 PASS；1 ⇔ 合法的非全 PASS。其余退出码一律不是管线完成。
  if (childExitCode === 0 && projected.allPass !== true) problems.push('子进程 exit 0 但裁定非全 PASS（自相矛盾）');
  else if (childExitCode === 1 && projected.allPass === true) problems.push('子进程 exit 1 但裁定全 PASS（自相矛盾）');
  else if (childExitCode !== 0 && childExitCode !== 1) {
    problems.push(`子进程退出码 ${childExitCode} 不属管线完成态（只认 0⇔全 PASS、1⇔合法非全 PASS）`);
  }
  if (!projected.verdictWellFormed) {
    problems.push(`裁定产物不合法：${(projected.verdictStepProblems || []).join('；') || 'schema 不合法或含四态外标签'}`);
  }
  if (!projected.attachmentsComplete) {
    const missing = Object.entries(projected.attachments).filter(([, v]) => !v).map(([k]) => k);
    problems.push(`附件集不完整：缺 ${missing.join('/')}`);
  }

  if (!problems.length) return { receiptClass: 'pipeline_complete_with_verdict', problems };
  if (projected.someArtifacts) return { receiptClass: 'partial_artifacts', problems };
  return { receiptClass: 'stage_failed', problems };
}
