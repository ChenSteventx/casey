// lib/report-model.mjs —— 报表模型装配器（相6 报告的上游一步，零 LLM 纯函数）。
// 把 verdict.json（多态裁定）⋈ StepAxes（axes.json 三轴）⋈ 观测现状 ⋈ 事件动作 join 成符合
// 已冻 report-model.schema.json 的只读报告数据源；渲染器（report.mjs）只读它、不二次推断。
// 不改任何冻结内核；本装配器是下游只读消费者：不重裁定、不推翻 verdict/reason（护栏 #15）。
// report-model.schema 处处 additionalProperties:false —— 富字段必须投影删去、不能直传。
//
// fail-safe / 凭据 硬约束（codex 异构评审 FAIL 逐轮采信去修，钉红 layer3-wiring-coverage.golden）：
// - verdict⋈axes 一致性门（第 4 轮，护栏 #14/#15）：每步用 expectedVerdict（镜像 verdict.mjs decide）复算，
//   与 verdict.json 所载 {verdict,reason} 不一致即 fail-closed 抛——这是**一致性自守不是重裁定**：报告仍原样载 verdict.mjs 的裁定，
//   两冻结输入互斥时拒绝装配、绝不产假绿（PASS 却有失败硬断言）或裁判/axes 打架的产物。真管线 verdict.json 由 verdict.mjs
//   吃 axes.json 产出、二者必然一致，本门只在损坏/篡改/上游 bug 时开火。
// - 缺陷单证据闭合：SUT_DEFECT 步的 backingForensics 与 verdict.mjs forensicsBacksSutError 同源（网络 5xx/信封 ok:false +
//   生命周期 pageerror/crash，均按 attributedStepId 归因本步）；无失败硬断言时仅 ap===false 才合成 actionPerformed；无背书 fail-closed。
// - 凭据红线（护栏 #7，装配器为上游 defense-in-depth；下游 bin/report.mjs credentialGate 按真实 site.json 字面量精确兜底、是权威末道闸）：
//   SUT 观测/取证 全部自由文本（observed.toast/标题/回复、pageerror.message）+ 标量值 + url（剥 query/hash + 路径逐段）走 redactScalar 逐 token 脱敏——
//   命中 邮箱 / 敏感词(token/password/authorization/bearer/cookie/apikey/session…) / 长不透明串 即替 [redacted]，percent-decode 双判防编码绕过。
//   收敛到现实凭据形状（真 bearer/session token 皆长串、OPAQUE_BLOB 覆盖），不追多词短语与本地化 PII——那非本中台会吐的内容、且有下游字面量门兜真凭据。
//   绝不搬 body/headers/cookie/token。人签授权字段 signerId/signedAgainstBuild 属可信授权输入（非 SUT 面）、原样载不脱敏。
// - schema 合法性自守（项目习惯无 ajv）：channel/verdict 枚举、reason 一致性、caseId 同源、steps 非空、generatedAt 真 ISO date-time（含日期范围）、
//   meta.passes 布尔 / title·signer 字符串、stepId 非空字符串（join 键）、id/label 类字段收敛 string|null、字符串数组收敛、
//   network.status 整数、errorEnvelope.field 字符串（否则收敛 null）、events.action 字符串、postAssertion 标量值 + 布尔 ok/soft、
//   verdict⋈axes 唯一 join 且 axes 全消费（双射）—— 任一不合即 fail-closed 抛或收敛为合法 null，不静默产非法产物。

const CHANNELS = new Set(['web', 'cef', 'arbitrary']);
const VERDICTS = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);
const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const NH_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);

function isScalarOrNull(v) {
  return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}
// 类型收敛：非字符串（含 undefined/对象/数字）→ null；字符串数组只留字符串项。用于可选展示字段，错型不致命、收敛为合法 schema 值。
const strOrNull = (v) => (typeof v === 'string' ? v : null);
const strArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

// generatedAt schema format date-time：形状正则 + 真实日期/时刻范围校验（含闰年、月末、时区偏移），
// 只验形状会放过 2026-99-99T99:99:99+99:99 这类不可能时刻（codex 第 3 轮 finding）。
function isValidIsoDateTime(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = +m[6], tz = m[7];
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || se > 60) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d > dim[mo - 1]) return false;
  if (tz !== 'Z' && (+tz.slice(1, 3) > 23 || +tz.slice(4, 6) > 59)) return false;
  return true;
}

// 点击身份门 ap 复算 —— 镜像 bin/verdict.mjs deriveActionPerformed（源真理在裁判进程，此处只读复算，
// 供一致性门 + 缺陷单诚实性自守）。任一分支改动须与 verdict.mjs 同步、由覆盖 golden 钉。
function deriveActionPerformed(action) {
  if (action && action.kind === 'none') return true;
  if (!action || typeof action !== 'object') return false;
  if (action.resolution === 'unique') return true;
  if (action.identityReadback && action.identityReadback.ok === true) return true;
  if (action.resolution === 'fallback_first' || action.resolution === 'coord_fallback') return 'ambiguous';
  return false;
}

// 取证背书 —— 镜像 bin/verdict.mjs forensicsBacksSutError（按 attributedStepId 归因本步，非时间窗）。
function forensicsBacksSutError(forensics, stepId) {
  if (!forensics || stepId == null) return false;
  const lc = forensics.lifecycle || {};
  if (lc.crashed === true && lc.crashedAtStepId === stepId) return true;
  if (Array.isArray(lc.pageerror) && lc.pageerror.some((e) => e && e.attributedStepId === stepId)) return true;
  const net = Array.isArray(forensics.network) ? forensics.network : [];
  return net.some((n) => n && n.attributedStepId != null && n.attributedStepId === stepId
    && (Number(n.status) >= 500 || (n.errorEnvelope && n.errorEnvelope.ok === false)));
}
function driftHolds(action) {
  return !!(action && action.resolution === 'none' && action.driftProbe && action.driftProbe.sameSignatureUniquePresent === true);
}
// 镜像 bin/verdict.mjs decide() §4.2 判定树 —— 仅供一致性自守（比对 verdict.json 所载 {verdict,reason}），绝不重裁定、不改报告裁定。
function expectedVerdict(step) {
  const ap = deriveActionPerformed(step.action);
  const hard = (step.postAssertions || []).filter((a) => a && a.soft !== true);
  const backed = forensicsBacksSutError(step.forensics, step.stepId);
  if (ap === 'ambiguous') return { verdict: 'NEEDS_HUMAN', reason: 'AMBIGUOUS_ACTION' };
  if (ap === true) {
    if (hard.length === 0) return { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' };
    if (hard.every((a) => a.ok === true)) return { verdict: 'PASS', reason: null };
    if (backed) return { verdict: 'SUT_DEFECT', reason: null };
    return { verdict: 'NEEDS_HUMAN', reason: 'SUT_DEFECT_OR_STALE' };
  }
  if (backed) return { verdict: 'SUT_DEFECT', reason: null };
  if (driftHolds(step.action)) return { verdict: 'HARNESS_ERROR', reason: null };
  if (step.phase === 'compile' && step.action && step.action.affordanceAbsent === true) return { verdict: 'NEEDS_HUMAN', reason: 'CASE_DEFECT' };
  return { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' };
}

// 冻结契约字段缺/错即产物损坏 → fail-closed（不 !! 静默改写观测语义，护栏 #14）。
function reqBool(v, name) {
  if (typeof v !== 'boolean') throw new Error(`assembleReportModel: ${name} 须 boolean（冻结契约字段，缺/错即产物损坏，fail-closed）`);
  return v;
}

// 护栏 #7：标量字符串本身也可能夹带 token=…&email=… 片段（信封/断言 actual = body 某字段值）——
// 按敏感关键字 / 邮箱 / 长不透明串（JWT/密钥）脱敏，超长截断防大 body 片段搬运。数字/布尔/null 不可能夹带凭据，原样放行。
// 现实凭据形状（收敛到 Casey 实际会遇到的：URL/文本里的 token 串、邮箱、长不透明串）。原文与 percent-decode 双判（防 a%40b.com 编码绕过）。
// 刻意不追多词短语(api key/session id)与本地化 PII(SSN/手机号/身份证)——业务中台不会把这些吐进 toast/URL/报错；真凭据(site.json 字面量)由下游
// bin/report.mjs credentialGate 按字面量精确兜底（权威末道闸），本层只作上游 defense-in-depth。
const SENSITIVE_SCALAR = /(password|passwd|\bpwd\b|token|secret|authorization|bearer|cookie|credential|api[_-]?key|apikey|session|access[_-]?token|refresh[_-]?token|signature|\bsig\b)/i;
const EMAILISH = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const OPAQUE_BLOB = /[A-Za-z0-9+/=_-]{32,}/;
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
// tokHit：token 原文或 percent-decode 后命中 邮箱/敏感词/长不透明串。真 bearer/session token 均为长串，OPAQUE_BLOB 覆盖。
const tokHit = (s) => { const d = safeDecode(s); return EMAILISH.test(s) || EMAILISH.test(d) || SENSITIVE_SCALAR.test(s) || SENSITIVE_SCALAR.test(d) || OPAQUE_BLOB.test(s) || OPAQUE_BLOB.test(d); };
// 纯路径形态 token：以 / 开头、仅路径安全字符，不含 kv/查询/编码/邮箱记号（= ? & @ : %）。
// 32+ 字符纯路径（如 /heren/aimanagement/process/list）会撞 OPAQUE_BLOB 整段误伤（首份真机报告实证，
// report-fidelity G2）——改走 redactUrlPath 逐段脱敏：非敏感段保可读、敏感段（长串/敏感词/邮箱）仍逐段拦。
const PURE_PATH_TOKEN = /^\/[A-Za-z0-9_\-./]*$/;
// 逐 token 脱敏（单 token 命中即替 [redacted]），保留周边正文可读；再截超长防大 body 搬运。
function redactScalar(v) {
  if (typeof v !== 'string') return v;
  const red = v.replace(/\S+/g, (t) => (PURE_PATH_TOKEN.test(t) ? redactUrlPath(t) : (tokHit(t) ? '[redacted]' : t)));
  return red.length > 512 ? red.slice(0, 509) + '…' : red;
}
// url 路径逐段脱敏（含 percent-decode 双判）。注：sanitizeUrl 用 parsed.origin，URL 规范排除 user:pass@ userinfo，host label 不含凭据、无需脱。
function redactUrlPath(pathname) {
  return pathname.split('/').map((seg) => (seg && tokHit(seg) ? '[redacted]' : seg)).join('/');
}
// 护栏 #7：url 只保留 origin+pathname，剥 query/hash（token/email/PII 常藏 query），路径段再脱敏。相对/非法 url 手工截 ?# 后缀。
function sanitizeUrl(u) {
  if (u == null) return '';
  const s = String(u);
  try {
    const parsed = new URL(s);
    return parsed.origin + redactUrlPath(parsed.pathname);
  } catch {
    return redactUrlPath(s.split('#')[0].split('?')[0]);
  }
}

// 护栏 #7：信封/断言 expected/actual 只允许标量且标量再脱敏，对象/数组一律 redaction（防 body 片段外泄）。
function safeScalar(v) {
  if (v === undefined) return null;
  if (!isScalarOrNull(v)) return '[redacted:non-scalar]';
  return redactScalar(v);
}

// errorEnvelope schema 硬约束：field:string（required）+ ok:boolean。
// field 非字符串 —— frozen checkErrorEnvelope 在 successField 缺失/敏感时 fail-closed 回 field:null（合法产物，非损坏，
//   且真回放路径被 hasOwnProperty 先门掉、不背书）—— 不产违反 schema 的非法信封，收敛 null（背书信号另由 buildDefectTicket
//   从原始 axes 直读、绝不丢）。ok 非布尔 = 产物损坏 → reqBool fail-closed 抛（护栏 #14）。
function projectEnvelope(ee) {
  if (!ee) return null;
  if (typeof ee.field !== 'string' || ee.field === '') return null;
  return { field: ee.field, expected: safeScalar(ee.expected), actual: safeScalar(ee.actual), ok: reqBool(ee.ok, 'errorEnvelope.ok') };
}

// StepAxes.forensics.network 单条 → report-model networkForensic（删 ts/streamFinished/streamStatus + url 脱敏 + 类型收敛）
function projectNet(n) {
  return {
    url: sanitizeUrl(n.url),
    status: Number.isInteger(n.status) ? n.status : null, // schema integer|null；浮点/非数收敛 null，绝不产非法整数
    initiator: strOrNull(n.initiator),
    attributedStepId: strOrNull(n.attributedStepId),
    errorEnvelope: projectEnvelope(n.errorEnvelope),
  };
}

function projectLifecycle(lc) {
  const l = lc || {};
  return {
    pageerror: (Array.isArray(l.pageerror) ? l.pageerror : []).map((p) => {
      const o = { attributedStepId: strOrNull(p && p.attributedStepId) };
      if (p && typeof p.message === 'string') o.message = redactScalar(p.message); // schema message 可选 string；SUT 抛错文可夹带 Authorization/token → 脱敏
      return o;
    }),
    crashed: l.crashed === true,
    crashedAtStepId: strOrNull(l.crashedAtStepId),
  };
}

// postAssertions 与冻结 StepAxes.postAssertions 同形，显式挑字段防上游多带；值须标量（再脱敏）、ok/soft 须布尔（护栏 #14/#17/#7）。
function projectPost(a) {
  if (!a || typeof a.kind !== 'string' || typeof a.op !== 'string') throw new Error('assembleReportModel: postAssertion 缺 kind/op（非法断言）');
  if (!isScalarOrNull(a.value) || !isScalarOrNull(a.actual)) throw new Error('assembleReportModel: postAssertion value/actual 须标量或 null（schema 约束）');
  return {
    kind: a.kind,
    op: a.op,
    value: a.value !== undefined ? redactScalar(a.value) : null,
    actual: a.actual !== undefined ? redactScalar(a.actual) : null,
    ok: reqBool(a.ok, 'postAssertion.ok'),
    soft: reqBool(a.soft, 'postAssertion.soft'),
  };
}

// observed 全部来自 SUT 观测（toast/标题/回复/落地路径），是 护栏 #7 凭据外泄的主战面——每条自由文本逐 token 脱敏、路径逐段脱敏。
function projectObserved(o) {
  return {
    urlPathnameAfter: typeof o.urlPathnameAfter === 'string' ? redactUrlPath(o.urlPathnameAfter) : null, // pathname，逐段脱敏
    cleanTitles: strArray(o.cleanTitles).map(redactScalar),
    toastTexts: strArray(o.toastTexts).map(redactScalar),
    replyText: typeof o.replyText === 'string' ? redactScalar(o.replyText) : null, // LLM 回复正文：逐 token 脱敏（剔嵌入凭据/PII，保正文）
    replyStreamUrl: typeof o.replyStreamUrl === 'string' ? sanitizeUrl(o.replyStreamUrl) : null,
  };
}

// 缺陷单：失败硬断言 + 归因本步的背书取证。仅 SUT_DEFECT 步调用（且一致性门已保证该步 decide()===SUT_DEFECT）。
// backingForensics 与 verdict.mjs forensicsBacksSutError 同源；失败断言 value/actual 脱敏（护栏 #7）。
function buildDefectTicket(ax, videoAt = null) {
  const stepId = ax && ax.stepId != null ? ax.stepId : null;
  const post = (ax && ax.postAssertions) || [];
  const failedAssertions = post
    .filter((a) => a && a.ok === false && a.soft !== true)
    .map((a) => ({ kind: a.kind, op: a.op, value: a.value !== undefined ? redactScalar(a.value) : null, actual: a.actual !== undefined ? redactScalar(a.actual) : null }));
  // 语义洞（codex 评审）：无失败硬断言时，只有「动作确未达成(ap===false)」才诚实合成 actionPerformed 失败断言。
  // 一致性门已挡住 ap≠false 却判 SUT_DEFECT 的态；此处 ap-check 为纵深防御（belt-and-suspenders）：ap≠false 即拒合成、fail-closed（护栏 #14）。
  if (failedAssertions.length === 0) {
    const ap = deriveActionPerformed(ax && ax.action);
    if (ap !== false) {
      throw new Error(`assembleReportModel: SUT_DEFECT 步(${stepId})无失败硬断言但动作轴 ap=${ap}（非 false）——verdict 与 axes 不一致，拒绝合成无证据 actionPerformed 断言，fail-closed（护栏 #14）`);
    }
    failedAssertions.push({ kind: 'actionPerformed', op: 'is', value: true, actual: false });
  }
  const net = (ax && ax.forensics && ax.forensics.network) || [];
  const backingForensics = net
    .filter((n) => n && n.attributedStepId != null && stepId != null && n.attributedStepId === stepId
      && (Number(n.status) >= 500 || (n.errorEnvelope && n.errorEnvelope.ok === false)))
    .map((n) => ({ url: sanitizeUrl(n.url), status: Number.isInteger(n.status) ? n.status : null, attributedStepId: n.attributedStepId }));
  // 生命周期背书（与 verdict 同源）：crash / pageerror 归因本步 → 合成 backing 条（url schema 必填，lifecycle: 前缀标识）。
  const lc = (ax && ax.forensics && ax.forensics.lifecycle) || {};
  if (lc.crashed === true && lc.crashedAtStepId != null && lc.crashedAtStepId === stepId) {
    backingForensics.push({ url: 'lifecycle:crash', status: null, attributedStepId: stepId });
  }
  for (const pe of Array.isArray(lc.pageerror) ? lc.pageerror : []) {
    if (pe && pe.attributedStepId != null && pe.attributedStepId === stepId) {
      backingForensics.push({ url: 'lifecycle:pageerror', status: null, attributedStepId: stepId });
    }
  }
  // fail-closed：SUT_DEFECT 步 verdict 判它时 backed===true；装配器找不到背书 = verdict 与 axes 不一致 → 抛，绝不产违反 schema 的空缺陷单。
  if (backingForensics.length === 0) {
    throw new Error(`assembleReportModel: SUT_DEFECT 步(${stepId})无背书取证——verdict 与 axes 不一致，fail-closed（护栏 #14）`);
  }
  // videoAt（replay-video D2）：败步在 case 级录屏中的起始时间点，供缺陷单跳转；无录屏恒 null。
  return { failedAssertions, backingForensics, videoAt, traceRef: null };
}

/**
 * 装配 report-model（符合 report-model.schema.json）。
 * @param {object} p
 * @param {string} p.caseId
 * @param {string} [p.channel] web|cef|arbitrary（默认 web）
 * @param {object} p.verdict  verdict.json = { caseId, steps:[{stepId,intentId,atom,verdict,reason}] }
 * @param {object} p.axes     axes.json    = { caseId, steps:[StepAxes] }
 * @param {object|null} [p.observed]  观测现状（可选增补，按 stepId/intentId 切片投影）
 * @param {object|null} [p.events]     events.json（可选增补，供动作轴投影 action.kind 动作动词）
 * @param {object} [p.meta]    { generatedAt, title?, signedAgainstBuild?, signerId?, passes?, intentTextByIntent? }
 * @param {object|null} [p.videoMeta]  视频元数据旁件（replay-video D2）：{ file, steps:[{stepId,videoAt}] }——
 *   逐步填 attachments{video,videoAt}（schema 预留位）与败步 defectTicket.videoAt；null 时零行为差（不产 attachments 键）。
 */
export function assembleReportModel({ caseId, channel, verdict, axes, observed = null, events = null, meta = {}, videoMeta = null }) {
  if (!verdict || !Array.isArray(verdict.steps)) throw new Error('assembleReportModel: verdict.steps 缺失/非数组');
  if (!axes || !Array.isArray(axes.steps)) throw new Error('assembleReportModel: axes.steps 缺失/非数组');
  if (!meta.generatedAt || typeof meta.generatedAt !== 'string' || !isValidIsoDateTime(meta.generatedAt)) throw new Error('assembleReportModel: meta.generatedAt 须真实 ISO 8601 date-time（schema format date-time）');
  if (verdict.steps.length === 0) throw new Error('assembleReportModel: verdict.steps 为空——report-model.steps minItems:1，fail-closed');
  // meta 旁参 schema 自守：passes(boolean|null) / title(string) / signedAgainstBuild·signerId(string|null)——错型即产物损坏，fail-closed。
  if (meta.passes != null && typeof meta.passes !== 'boolean') throw new Error('assembleReportModel: meta.passes 须 boolean 或省略（schema boolean|null）');
  if (meta.title != null && typeof meta.title !== 'string') throw new Error('assembleReportModel: meta.title 须 string（schema）');
  if (meta.signedAgainstBuild != null && typeof meta.signedAgainstBuild !== 'string') throw new Error('assembleReportModel: meta.signedAgainstBuild 须 string 或 null（schema）');
  if (meta.signerId != null && typeof meta.signerId !== 'string') throw new Error('assembleReportModel: meta.signerId 须 string 或 null（schema）');

  // 视频元数据自守（replay-video D2；CLI 壳已校验，此为纵深防御）：file 纯文件名白名单
  // （[A-Za-z0-9._-] 且非全点，codex R3-N5 与呈现层同口径收窄）、steps 行 {stepId:string, videoAt:非负有限数}
  // ——不合即 fail-closed 抛，绝不产带非法附件路径的产物（护栏 #7/#14）。
  const videoAtByStep = new Map();
  if (videoMeta != null) {
    if (typeof videoMeta !== 'object' || Array.isArray(videoMeta) || typeof videoMeta.file !== 'string'
      || !/^(?!\.+$)[A-Za-z0-9._-]+$/.test(videoMeta.file)
      || !Array.isArray(videoMeta.steps)) throw new Error('assembleReportModel: videoMeta 形状非法（fail-closed）');
    for (const r of videoMeta.steps) {
      if (!r || typeof r.stepId !== 'string' || !r.stepId || typeof r.videoAt !== 'number' || !Number.isFinite(r.videoAt) || r.videoAt < 0) {
        throw new Error('assembleReportModel: videoMeta.steps 行非法（fail-closed）');
      }
      videoAtByStep.set(r.stepId, r.videoAt);
    }
  }

  const ch = channel || 'web';
  if (!CHANNELS.has(ch)) throw new Error(`assembleReportModel: 非法 channel「${ch}」（须 web|cef|arbitrary）`);

  const cid = caseId || verdict.caseId || axes.caseId;
  if (typeof cid !== 'string' || cid.length === 0) throw new Error('assembleReportModel: caseId 缺失/非字符串（schema required string）');
  // caseId 同源校验（codex 第 4/5 轮）：凡「已提供」（非 null）的 caseId 来源都必须是非空字符串且 === cid——
  // 否则（畸形/空串/不同源）会把不同 case 的 verdict/axes/observed/events 拼成跨 case 报告，fail-closed（护栏 #14）。
  for (const [src, val] of [['caseId 入参', caseId], ['verdict.caseId', verdict.caseId], ['axes.caseId', axes.caseId], ['observed.caseId', observed && observed.caseId], ['events.caseId', events && events.caseId]]) {
    if (val != null && (typeof val !== 'string' || val.length === 0 || val !== cid)) throw new Error(`assembleReportModel: caseId 同源校验失败——${src}(${JSON.stringify(val)}) 须为非空字符串且 === ${cid}，fail-closed（护栏 #14）`);
  }

  // F4 join 一致性：axes 按 stepId 唯一建索引；重复/非字符串 stepId = 产物损坏 → fail-closed。
  // 注：report schema 的 reportStep.stepId 容忍 null（下游展示字段），但 join 键必须非空字符串——装配器在此刻意严于 schema，
  // 拒 null/非字符串 stepId（无法唯一 join，且 schema 要 string）。真回放恒 atstep_i 字符串，此严格化无误伤。
  const axByStep = new Map();
  for (const s of axes.steps) {
    if (typeof s.stepId !== 'string' || s.stepId === '') throw new Error('assembleReportModel: axes 步 stepId 须非空字符串（join 键），fail-closed');
    if (axByStep.has(s.stepId)) throw new Error(`assembleReportModel: axes stepId 重复(${s.stepId})，fail-closed`);
    axByStep.set(s.stepId, s);
  }
  // observed/events 是可选增补，缺失不致命（保持 null 投影）。
  const obsByStep = new Map();
  const obsByIntent = new Map();
  for (const os of (observed && observed.steps) || []) {
    if (os.stepId != null) obsByStep.set(os.stepId, os);
    if (os.intentId != null) obsByIntent.set(os.intentId, os);
  }
  // action.kind schema 要求 string；events.action 非字符串（对象/数字）→ 不索引 → 无 action 投影，绝不产非法 action.kind。
  const verbByStep = new Map();
  for (const ev of (events && events.events) || []) {
    if (ev.stepId != null && typeof ev.action === 'string' && ev.action.length > 0) verbByStep.set(ev.stepId, ev.action);
  }
  const intentTextByIntent = meta.intentTextByIntent || {};

  const summary = { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 };
  const seenStep = new Set();
  const steps = verdict.steps.map((vs) => {
    // F5/F6 schema 合法性：verdict 枚举 + reason 一致性（终判 reason=null；NEEDS_HUMAN 须合法子类）。
    if (!VERDICTS.has(vs.verdict)) throw new Error(`assembleReportModel: 未知 verdict「${vs.verdict}」，fail-closed`);
    if (TERMINAL.has(vs.verdict)) {
      if (vs.reason != null) throw new Error(`assembleReportModel: 终判 ${vs.verdict} 的 reason 须 null（实为 ${vs.reason}）`);
    } else if (!NH_REASONS.has(vs.reason)) {
      throw new Error(`assembleReportModel: NEEDS_HUMAN 须带合法 reason 子类（实为 ${vs.reason}）`);
    }
    // F4 join：verdict 步须唯一映射到 axes 步（stepId 非空字符串）。
    if (typeof vs.stepId !== 'string' || vs.stepId === '') throw new Error('assembleReportModel: verdict 步 stepId 须非空字符串，fail-closed');
    if (seenStep.has(vs.stepId)) throw new Error(`assembleReportModel: verdict stepId 重复(${vs.stepId})，fail-closed`);
    seenStep.add(vs.stepId);
    const ax = axByStep.get(vs.stepId);
    if (!ax) throw new Error(`assembleReportModel: verdict 步(${vs.stepId})无对应 axes 步——产物不一致，fail-closed（护栏 #14）`);

    // 一致性门（护栏 #14/#15）：verdict.json 所载裁定须与 axes 复算一致，否则拒装配（防假绿 / 裁判与 axes 打架）。只比对不重写。
    const exp = expectedVerdict(ax);
    const vReason = vs.reason != null ? vs.reason : null;
    const eReason = exp.reason != null ? exp.reason : null;
    if (vs.verdict !== exp.verdict || vReason !== eReason) {
      throw new Error(`assembleReportModel: verdict 步(${vs.stepId}) 所载 {${vs.verdict}/${vReason}} 与 axes 复算 {${exp.verdict}/${eReason}} 不一致——verdict⋈axes 损坏，fail-closed（护栏 #14/#15：只读消费不重裁定，不一致即拒装配）`);
    }

    const obs = obsByStep.get(vs.stepId) || (vs.intentId != null && obsByIntent.get(vs.intentId)) || null;
    const verb = verbByStep.get(vs.stepId) || null;
    summary[vs.verdict] += 1;

    const step = {
      stepId: vs.stepId,
      intentId: strOrNull(vs.intentId),
      atom: strOrNull(vs.atom != null ? vs.atom : (ax.atom != null ? ax.atom : null)),
      verdict: vs.verdict,
      reason: vReason,
      postAssertions: (ax.postAssertions || []).map(projectPost),
    };
    const intentText = intentTextByIntent[vs.intentId];
    if (intentText != null) step.intentText = redactScalar(strOrNull(intentText));
    if (verb != null) step.action = { kind: verb, describe: null, resolution: strOrNull(ax.action && ax.action.resolution) };
    step.forensics = { lifecycle: projectLifecycle(ax.forensics && ax.forensics.lifecycle), network: ((ax.forensics && ax.forensics.network) || []).map(projectNet) };
    if (obs) step.observed = projectObserved(obs);
    // 录屏附件（replay-video D2/M2，schema 预留位）：videoAt 取本 intent 首事件偏移（卷回语义——本步镜头
    // 从首事件起），回退代表步自身；对不上的步不产 attachments 键（缺席容忍）。仅诊断附件，绝不进裁定（M7）。
    let vAt = null;
    if (videoMeta) {
      const firstEvt = Array.isArray(ax.eventActions) && ax.eventActions[0] && typeof ax.eventActions[0].stepId === 'string' ? ax.eventActions[0].stepId : null;
      vAt = firstEvt != null && videoAtByStep.has(firstEvt) ? videoAtByStep.get(firstEvt)
        : (videoAtByStep.has(vs.stepId) ? videoAtByStep.get(vs.stepId) : null);
      if (vAt != null) step.attachments = { video: videoMeta.file, videoAt: vAt };
    }
    step.defectTicket = vs.verdict === 'SUT_DEFECT' ? buildDefectTicket(ax, vAt) : null;
    return step;
  });

  // join 完整性（codex 第 4 轮 High）：verdict 须消费全部 axes 步——axes 多出未裁定步（如失败步）被漏掉 = 漏报/假绿，fail-closed。
  // verdict 步已逐个 join 到唯一 axes 步（seenStep ⊆ axByStep 键）；size 相等即双射（全消费）。
  if (seenStep.size !== axByStep.size) throw new Error(`assembleReportModel: axes 步(${axByStep.size}) 未被 verdict(${seenStep.size}) 全量消费——漏报/产物不一致，fail-closed（护栏 #14）`);

  // naturalLanguage（report-nl-atomic，GRILL D1）：meta 显式原文优先 → 步骤意图原文按序去重零 LLM 合成 → null。
  if (meta.naturalLanguage != null && typeof meta.naturalLanguage !== 'string') throw new Error('assembleReportModel: meta.naturalLanguage 须 string 或省略（schema string|null）');
  let naturalLanguage;
  if (meta.naturalLanguage != null) {
    naturalLanguage = redactScalar(meta.naturalLanguage);
  } else {
    const seenText = new Set();
    const parts = [];
    for (const s of steps) {
      if (s.intentText && !seenText.has(s.intentText)) { seenText.add(s.intentText); parts.push(s.intentText); }
    }
    naturalLanguage = parts.length ? parts.join('\n') : null;
  }

  // atomicSteps（report-nl-atomic，GRILL D2）：逐步展开——有 action 一条 + 每 postAssertion 一条，全局稳定 seq；
  // describe 经 redactScalar（护栏 #7；postAssertions 值已在 projectPost 脱敏，此处再护一层）。每条挂 stepId/intentId 供回指。
  const atomicSteps = [];
  let atomicSeq = 0;
  for (const s of steps) {
    // 有 action（被观测到的动作）产一条——绝不吞条目；动词缺失落安全占位（GRILL D6，评审 F1/F3）。
    if (s.action) {
      atomicSteps.push({ seq: ++atomicSeq, kind: 'action', stepId: s.stepId, intentId: s.intentId, describe: s.action.kind ? redactScalar(String(s.action.kind)) : '(动作)' });
    }
    for (const a of s.postAssertions || []) {
      const kindPart = a.kind != null ? String(a.kind) : '(断言)';
      const valPart = a.value != null ? ` ${a.value}` : '';
      atomicSteps.push({ seq: ++atomicSeq, kind: 'assertion', stepId: s.stepId, intentId: s.intentId, describe: redactScalar(`${kindPart} ${a.op || ''}${valPart}`.trim()) });
    }
  }

  // 清理证据（report-cleanup-evidence）：surface 各步 countChange 断言的删除前后命中数（report-spec #9）；值取已 projectPost 脱敏的。
  const cleanupEvidence = [];
  for (const s of steps) {
    for (const a of s.postAssertions || []) {
      if (a.kind === 'countChange') cleanupEvidence.push({ stepId: s.stepId, intentId: s.intentId, op: a.op, value: a.value, actual: a.actual });
    }
  }

  const model = {
    schemaVersion: 1,
    caseId: cid,
    channel: ch,
    generatedAt: meta.generatedAt,
    naturalLanguage,
    atomicSteps,
    // 顶层回放录像引用（report-video-block）：videoMeta 已过白名单文件名自守；无录像 null，报告显式标「无录像」。
    replayVideo: videoMeta != null ? { file: videoMeta.file } : null,
    cleanupEvidence,
    verdictSummary: summary,
    steps,
    // signedAgainstBuild / signerId 是人签门授权的版本/身份元数据（来自 prd，非 SUT 观测）——不属 护栏 #7 的 SUT→报告 凭据外泄面，
    // 且构建标识常含长 git sha、签署者身份是报告审计核心，脱敏会毁掉 期望版本化 + 人签审计，故此二字段按可信授权输入原样载（仅类型自守）。
    signedAgainstBuild: meta.signedAgainstBuild != null ? meta.signedAgainstBuild : null,
    signerId: meta.signerId != null ? meta.signerId : null,
    passes: meta.passes != null ? meta.passes : null,
  };
  if (meta.title != null) model.title = redactScalar(meta.title);
  return model;
}
