// lib/selftest-tier2-manifest.mjs —— tier-2 人签用例集 manifest 准入【采集层】
//   （GRILL D2 v3 零动态发现；联审 r1 H3 + M3 收口）。
// 准入闭合五条（H3）：
//   ① 单次读字节：算 hash 与解析用【同一份 buffer】，不许「hash 一份、解析另一份」（TOCTOU 缝）；
//   ② 拒草案：`draft:true` 与 `signed:true` 同时在场按未签处理（提签遗漏不许当已签放行）；
//   ③ 成员闭合：caseId 安全单段、不重复、不超上限、必备字段齐、artifact 集精确（多一件少一件都拒）；
//   ④ 路径闭合：所有引用路径须仓内相对路径、无上跳段、落在约定目录下（越界即拒）；
//   ⑤ 执行件绑定：逐例 spawn 前重核字节 hash，并把核过的精确路径显式交给生产 run（不靠约定解析兜底）。
// 消费端严格化（M3）：连通结果与带外回执按 schema/artifactKind/segment/状态逐项校验，形状不符即拒。
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { PROJECT_ROOT } from './paths.mjs';
import { TIER2_DEFAULT_CASE_LIMIT } from './selftest-tier2.mjs';

export const MANIFEST_REL = 'cases/tier2-suite.manifest.json';
const PRD_REL = 'loop/prd-p9-tier2-live-smoke.json';
const SAFE_CASE_ID = /^[A-Za-z0-9_]+$/;
// 执行件精确集：前四件是生产 run 的硬输入（events/expected/profile/testcase），
//   entity-locks 只对带实体锁的用例在场（多余件一律拒——防把无关文件塞进已签集）。
const REQUIRED_ARTIFACT_NAMES = Object.freeze(['events.json', 'expected.frozen.json', 'profile.json', 'testcase.json']);
const OPTIONAL_ARTIFACT_NAMES = Object.freeze([
  'entity-locks.frozen.json',
  'flow.confirmed.json',
  'compile-provenance.json',
  'created-workflow-authority.frozen.json',
]);
const CREATED_WORKFLOW_ARTIFACT_NAMES = Object.freeze([
  'flow.confirmed.json',
  'compile-provenance.json',
  'created-workflow-authority.frozen.json',
]);
const CREATED_WORKFLOW_CASE_IDS = new Set([
  'tc_catalog_wf_crud',
  'tc_wf_publish_states',
  'tc_wf_history_version',
]);
const SHA256_HEX = /^[0-9a-f]{64}$/;
// 结构化结果件「自陈时点 ↔ 落盘时刻」允许的偏差（跨机采集，留时钟容差）。
const WRITE_TIME_SKEW_MS = 5 * 60 * 1000;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// 仓内相对路径闭合：非串/绝对路径/含上跳段/含反斜杠/不在允许前缀下 → 拒。
export function isRepoRelativePath(value, allowedPrefixes) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value) || value.includes('\\')) return false;
  const segs = value.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..')) return false;
  return (allowedPrefixes || []).some((p) => value.startsWith(p));
}

// ── 结构校验（纯：吃已解析文档，出 problems 列；金牌可直接驱动）───────────
export function validateSuiteManifestDoc(doc) {
  const problems = [];
  const m = doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : null;
  if (!m) return { ok: false, problems: ['manifest 顶层不是对象'], members: [], caseLimit: TIER2_DEFAULT_CASE_LIMIT, signedOk: false };

  if (m.artifactKind !== 'tier2-suite-manifest') problems.push('manifest artifactKind 不符（须 tier2-suite-manifest）');
  if (!Number.isInteger(m.schemaVersion) || m.schemaVersion <= 0) problems.push('manifest 缺合法 schemaVersion');
  // ② 草案拒：draft 标记在场即按未签处理，哪怕 signed 也为 true（提签遗漏不放行）
  const draftFlagged = m.draft === true;
  if (draftFlagged) problems.push('manifest 带 draft 标记（草案不算已签，须定稿去标记后重签）');
  const signedOk = m.signed === true && typeof m.signerId === 'string' && m.signerId.trim().length > 0
    && typeof m.signedAt === 'string' && m.signedAt.trim().length > 0 && !draftFlagged;
  if (!signedOk) problems.push('manifest 未人签（signed/signerId/signedAt 三件须齐且非草案）');

  const caseLimit = Number.isInteger(m.caseLimit) && m.caseLimit > 0 ? m.caseLimit : null;
  if (caseLimit === null) problems.push('manifest 未声明合法 caseLimit');

  for (const [key, prefix] of [['winProbeResultPath', 'runs/'], ['outOfBandReceiptPath', 'runs/']]) {
    if (!isRepoRelativePath(m[key], [prefix])) problems.push(`manifest 的 ${key} 非法（须仓内相对路径、无上跳段、落在 ${prefix} 下）`);
  }

  const members = Array.isArray(m.members) ? m.members : null;
  if (!members || !members.length) {
    problems.push('manifest 成员集为空');
    return { ok: false, problems, members: [], caseLimit: caseLimit || TIER2_DEFAULT_CASE_LIMIT, signedOk };
  }
  if (caseLimit !== null && members.length > caseLimit) problems.push(`成员数超声明上限（${members.length} > ${caseLimit}）`);

  const seen = new Set();
  for (const raw of members) {
    const member = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const id = member.caseId;
    if (typeof id !== 'string' || !SAFE_CASE_ID.test(id)) { problems.push(`成员 caseId 不安全或缺失（只允许字母数字下划线单段）`); continue; }
    if (seen.has(id)) { problems.push(`成员重复：${id}`); continue; }
    seen.add(id);
    if (!['read', 'mutation'].includes(member.effect)) problems.push(`成员 ${id} 的 effect 须 ∈ {read,mutation}`);
    if (member.smokeAuthorized !== true) problems.push(`成员 ${id} 缺 smoke 授权标志`);
    if (!Number.isInteger(member.timeoutMs) || member.timeoutMs <= 0) problems.push(`成员 ${id} 未声明合法超时`);
    if (typeof member.cleanupObligation !== 'string' || !member.cleanupObligation.trim()) problems.push(`成员 ${id} 未声明清理义务`);
    if (member.effect === 'mutation' && member.perRunApproval !== true) problems.push(`成员 ${id} 是变更型但未标逐次授权义务`);
    const artifacts = member.artifacts && typeof member.artifacts === 'object' && !Array.isArray(member.artifacts) ? member.artifacts : null;
    if (!artifacts || !Object.keys(artifacts).length) { problems.push(`成员 ${id} 未逐件记 artifact hash`); continue; }
    // ③④ artifact 集精确 + 路径闭合
    const names = [];
    for (const [rel, digest] of Object.entries(artifacts)) {
      if (!isRepoRelativePath(rel, [`cases/${id}/`])) { problems.push(`成员 ${id} 的 artifact 路径越界或非法：${rel.slice(0, 60)}`); continue; }
      if (!SHA256_HEX.test(String(digest))) { problems.push(`成员 ${id} 的 artifact hash 非 sha256 十六进制：${rel}`); continue; }
      const name = rel.slice(`cases/${id}/`.length);
      if (!REQUIRED_ARTIFACT_NAMES.includes(name) && !OPTIONAL_ARTIFACT_NAMES.includes(name)) {
        problems.push(`成员 ${id} 的 artifact 集含约定外文件：${name}`);
        continue;
      }
      names.push(name);
    }
    for (const need of REQUIRED_ARTIFACT_NAMES) {
      if (!names.includes(need)) problems.push(`成员 ${id} 的 artifact 集缺必备执行件：${need}`);
    }
    const v3Count = CREATED_WORKFLOW_ARTIFACT_NAMES.filter((name) => names.includes(name)).length;
    if (v3Count !== 0 && v3Count !== CREATED_WORKFLOW_ARTIFACT_NAMES.length) {
      problems.push(`成员 ${id} 的 created-workflow v3 三件须成组在场`);
    }
    if (CREATED_WORKFLOW_CASE_IDS.has(id) && v3Count !== CREATED_WORKFLOW_ARTIFACT_NAMES.length) {
      problems.push(`成员 ${id} 未接 created-workflow v3 动态 ID/清理生产链`);
    }
  }

  const precedents = Array.isArray(m.historicalPrecedents) ? m.historicalPrecedents : [];
  if (!precedents.length) problems.push('manifest 未记历史真机先例（SUT_DEFECT 面证据引用）');
  for (const p of precedents) {
    const it = p && typeof p === 'object' ? p : {};
    if (!isRepoRelativePath(it.path, ['runs/'])) problems.push(`先例 ${it.id || '未标注'} 的产物路径非法`);
    if (!SHA256_HEX.test(String(it.sha256))) problems.push(`先例 ${it.id || '未标注'} 缺合法 sha256`);
    if (!isRepoRelativePath(it.attestedIn, ['docs/'])) problems.push(`先例 ${it.id || '未标注'} 未指向在册签认文书`);
  }

  return {
    ok: problems.length === 0,
    problems,
    members,
    caseLimit: caseLimit || TIER2_DEFAULT_CASE_LIMIT,
    signedOk,
  };
}

// 契约冻结值查表（单源：从 loop/prd-*.json 的 testChecksums 取，代码里不写死字面量）。
function frozenManifestChecksum() {
  try {
    const prd = JSON.parse(readFileSync(join(PROJECT_ROOT, PRD_REL), 'utf8'));
    const v = (prd.testChecksums || {})[MANIFEST_REL];
    return typeof v === 'string' ? v : null;
  } catch { return null; }
}

// ── 采集：单次读字节 → hash → 同一份字节解析 → 结构校验 → 磁盘件核验 ────
export function readSuiteManifest() {
  const manifestAbs = process.env.AT_TIER2_MANIFEST || join(PROJECT_ROOT, MANIFEST_REL);
  const absent = {
    present: false, signed: false, checksumOk: false, memberCount: 0,
    caseLimit: TIER2_DEFAULT_CASE_LIMIT, members: [], memberIds: [], memberEffects: {},
    json: null, digest: null, problems: ['人签 manifest 不在场（草案不算数）'],
  };
  if (!existsSync(manifestAbs)) return absent;

  let bytes;
  try { bytes = readFileSync(manifestAbs); } catch { return { ...absent, present: true, problems: ['manifest 不可读'] }; }
  const digest = sha256(bytes);                       // ① hash 与解析同一份字节
  let doc = null;
  let parseOk = true;
  try { doc = JSON.parse(bytes.toString('utf8')); } catch { parseOk = false; }
  if (!parseOk) {
    return {
      ...absent, present: true, digest, problems: ['manifest 不是合法 JSON'],
    };
  }

  const structural = validateSuiteManifestDoc(doc);
  const problems = [...structural.problems];

  const frozen = frozenManifestChecksum();
  let checksumOk = false;
  if (typeof frozen !== 'string') problems.push('manifest 未冻入契约 testChecksums（未在册即不放行）');
  else if (frozen !== digest) problems.push('manifest 字节与契约冻结值失配（件已漂移）');
  else checksumOk = true;

  // 磁盘件核验：结构合格的成员逐件核字节 hash（缺件/失配 → 整集 fail-closed）。
  const verifiedMembers = [];
  if (structural.ok) {
    for (const member of structural.members) {
      const files = {};
      let memberOk = true;
      for (const [rel, want] of Object.entries(member.artifacts)) {
        const abs = join(PROJECT_ROOT, rel);
        if (!existsSync(abs)) { problems.push(`成员 ${member.caseId} 的冻结件不在场：${rel}`); memberOk = false; continue; }
        if (sha256(readFileSync(abs)) !== want) { problems.push(`成员 ${member.caseId} 的冻结件 hash 失配：${rel}`); memberOk = false; continue; }
        files[rel.slice(`cases/${member.caseId}/`.length)] = abs;
      }
      if (!memberOk) { checksumOk = false; continue; }
      verifiedMembers.push({ ...member, verifiedFiles: files });
    }
  } else {
    checksumOk = false;
  }

  const acceptable = structural.ok && checksumOk;
  return {
    present: true,
    signed: structural.signedOk,
    checksumOk,
    memberCount: acceptable ? verifiedMembers.length : 0,
    caseLimit: structural.caseLimit,
    members: acceptable ? verifiedMembers : [],
    memberIds: acceptable ? verifiedMembers.map((m) => m.caseId) : [],
    memberEffects: acceptable ? Object.fromEntries(verifiedMembers.map((m) => [m.caseId, m.effect])) : {},
    json: doc,
    digest,
    problems,
  };
}

// ⑤ spawn 前重核执行件：字节 hash 再核一遍（准入到执行之间的 TOCTOU 缝），出核过的精确路径。
export function verifyMemberExecutionFiles(member) {
  const problems = [];
  const paths = {};
  const artifacts = member && member.artifacts && typeof member.artifacts === 'object' ? member.artifacts : {};
  for (const [rel, want] of Object.entries(artifacts)) {
    const abs = join(PROJECT_ROOT, rel);
    if (!existsSync(abs)) { problems.push(`执行件不在场：${rel}`); continue; }
    if (sha256(readFileSync(abs)) !== want) { problems.push(`执行件 hash 失配：${rel}`); continue; }
    paths[rel.slice(`cases/${member.caseId}/`.length)] = abs;
  }
  for (const need of REQUIRED_ARTIFACT_NAMES) {
    if (!paths[need]) problems.push(`执行件缺必备项：${need}`);
  }
  return { ok: problems.length === 0, problems, paths };
}

// ── 消费端严格校验（M3）：连通结果 / 带外回执 ─────────────────────
function readJsonStrict(absPath) {
  try { return JSON.parse(readFileSync(absPath, 'utf8')); } catch { return null; }
}

// 本次探针尝试的挑战字（联审 r3 M3 残口）：删旧件是尽力而为、删不掉就删不掉，
//   所以「这份结果属不属于本次尝试」不能靠删除保证，只能靠一次性 nonce 绑定。
// 协议：tier-2 发挑战 → Windows 侧探针带 --challenge 跑并把 nonce 写进结果 → 消费端核对 → 用过即轮换。
export const CHALLENGE_KIND = 'tier2-connectivity-challenge';
function challengePath(manifest) {
  const declared = manifest && manifest.json && typeof manifest.json.winProbeChallengePath === 'string'
    ? manifest.json.winProbeChallengePath : null;
  if (declared) return isRepoRelativePath(declared, ['runs/']) ? declared : null;
  const rel = manifest && manifest.json && typeof manifest.json.winProbeResultPath === 'string'
    ? manifest.json.winProbeResultPath : null;
  if (!isRepoRelativePath(rel, ['runs/'])) return null;
  return `${rel.split('/').slice(0, -1).join('/')}/win-probe-challenge.json`;
}
export function ensureWinProbeChallenge(manifest) {
  const rel = challengePath(manifest);
  if (!rel) return { ok: false, nonce: null, path: null, problems: ['挑战字路径无法从 manifest 推出'] };
  const abs = join(PROJECT_ROOT, rel);
  const existing = existsSync(abs) ? readJsonStrict(abs) : null;
  if (existing && existing.artifactKind === CHALLENGE_KIND && typeof existing.nonce === 'string'
    && /^[0-9a-f]{32}$/.test(existing.nonce) && existing.consumedAt == null) {
    return { ok: true, nonce: existing.nonce, path: rel, issuedAt: existing.issuedAt, problems: [] };
  }
  const doc = {
    schemaVersion: 1, artifactKind: CHALLENGE_KIND,
    nonce: randomBytes(16).toString('hex'),
    issuedAt: new Date().toISOString(),
    consumedAt: null,
    note: 'Windows 侧探针须带 --challenge 指向本文件；结果件回填 challengeNonce 才算本次尝试。',
  };
  try {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  } catch {
    return { ok: false, nonce: null, path: rel, problems: ['挑战字落盘失败（无法绑定本次探针尝试）'] };
  }
  return { ok: true, nonce: doc.nonce, path: rel, issuedAt: doc.issuedAt, problems: [] };
}
// 用过即作废：同一份连通结果不得被第二次 tier-2 run 复用。
export function consumeWinProbeChallenge(manifest) {
  const rel = challengePath(manifest);
  if (!rel) return false;
  const abs = join(PROJECT_ROOT, rel);
  const doc = existsSync(abs) ? readJsonStrict(abs) : null;
  if (!doc) return false;
  try {
    writeFileSync(abs, `${JSON.stringify({ ...doc, consumedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
    return true;
  } catch { return false; }
}

export function readWinProbeResult(manifest, challenge = null) {
  const rel = manifest && manifest.json && typeof manifest.json.winProbeResultPath === 'string' ? manifest.json.winProbeResultPath : null;
  const miss = { present: false, ok: false, producedAt: null, problems: ['连通结果路径未在 manifest 声明或非法'] };
  if (!isRepoRelativePath(rel, ['runs/'])) return miss;
  const abs = join(PROJECT_ROOT, rel);
  if (!existsSync(abs)) return { present: false, ok: false, producedAt: null, problems: ['连通结果文件不在场'] };
  const doc = readJsonStrict(abs);
  const problems = [];
  if (!doc || typeof doc !== 'object') problems.push('连通结果不是合法 JSON 对象');
  else {
    if (doc.schemaVersion !== 1) problems.push('连通结果 schemaVersion 不符');
    if (doc.artifactKind !== 'tier2-connectivity-probe') problems.push('连通结果 artifactKind 不符');
    if (doc.segment !== 'windows-to-target') problems.push('连通结果 segment 不符（须真实目标段）');
    if (doc.ok !== true) problems.push('连通结果自陈不成功');
    if (!Number.isInteger(doc.httpStatus) || doc.httpStatus < 100 || doc.httpStatus > 599) problems.push('连通结果缺合法 HTTP 状态');
    if (typeof doc.producedAt !== 'string' || !doc.producedAt) problems.push('连通结果缺生成时点');
    else {
      // 自陈时点须与落盘时刻自洽（联审 r2 M3 残口）：文件被复制/挪回来会让 mtime 远晚于 producedAt，
      //   旧成功件冒充新证据在此现形（跨机时钟按 5 分钟容差）。
      const claimed = Date.parse(doc.producedAt);
      let mtimeMs = NaN;
      try { mtimeMs = statSync(abs).mtimeMs; } catch { mtimeMs = NaN; }
      if (!Number.isFinite(claimed) || !Number.isFinite(mtimeMs)) problems.push('连通结果时点不可解析');
      else if (Math.abs(mtimeMs - claimed) > WRITE_TIME_SKEW_MS) problems.push('连通结果自陈时点与落盘时刻不自洽（疑旧件复用）');
    }
    // 本次尝试绑定（联审 r3 M3 残口）：删旧件删不掉也没关系——nonce 对不上就不是本次探针的结果。
    if (challenge) {
      if (challenge.ok !== true) problems.push('本次探针挑战字未发出（无法绑定本次尝试）');
      else if (typeof doc.challengeNonce !== 'string' || !doc.challengeNonce) problems.push('连通结果未回填本次挑战字（旧件或未带 --challenge 跑）');
      else if (doc.challengeNonce !== challenge.nonce) problems.push('连通结果的挑战字与本次尝试不符（旧成功件复用）');
    }
  }
  return {
    present: true,
    ok: problems.length === 0,
    producedAt: doc && typeof doc.producedAt === 'string' ? doc.producedAt : null,
    problems,
  };
}

export function readOutOfBandReceipt(manifest) {
  const rel = manifest && manifest.json && typeof manifest.json.outOfBandReceiptPath === 'string' ? manifest.json.outOfBandReceiptPath : null;
  if (!isRepoRelativePath(rel, ['runs/'])) return { present: false, acknowledged: false, confirmedAt: null, problems: ['带外回执路径未在 manifest 声明或非法'] };
  const abs = join(PROJECT_ROOT, rel);
  if (!existsSync(abs)) return { present: false, acknowledged: false, confirmedAt: null, problems: ['带外回执文件不在场'] };
  const doc = readJsonStrict(abs);
  const problems = [];
  if (!doc || typeof doc !== 'object') problems.push('带外回执不是合法 JSON 对象');
  else {
    if (doc.schemaVersion !== 1) problems.push('带外回执 schemaVersion 不符');
    if (doc.artifactKind !== 'tier2-out-of-band-receipt') problems.push('带外回执 artifactKind 不符');
    if (doc.acknowledged !== true) problems.push('带外回执未标确认');
    if (typeof doc.confirmedAt !== 'string' || !doc.confirmedAt) problems.push('带外回执缺确认时点');
  }
  // 白名单投影：只出标志与时点，其余字段一律不读出模块。
  return {
    present: true,
    acknowledged: problems.length === 0,
    confirmedAt: doc && typeof doc.confirmedAt === 'string' ? doc.confirmedAt : null,
    problems,
  };
}

// 先例 hash 绑定核验（第三面证据的一半；另一半是裁判二进制冒烟）。
export function verifyHistoricalPrecedents(manifest) {
  const list = manifest && manifest.json && Array.isArray(manifest.json.historicalPrecedents) ? manifest.json.historicalPrecedents : [];
  return list.map((raw) => {
    const p = raw && typeof raw === 'object' ? raw : {};
    const id = typeof p.id === 'string' ? p.id : '未标注';
    const digest = typeof p.sha256 === 'string' ? p.sha256 : '';
    const pathOk = isRepoRelativePath(p.path, ['runs/']);
    const attestOk = isRepoRelativePath(p.attestedIn, ['docs/']) && existsSync(join(PROJECT_ROOT, p.attestedIn));
    let attestRecordsHash = false;
    if (attestOk && SHA256_HEX.test(digest)) {
      try { attestRecordsHash = readFileSync(join(PROJECT_ROOT, p.attestedIn), 'utf8').includes(digest.slice(0, 8)); } catch { attestRecordsHash = false; }
    }
    const abs = pathOk ? join(PROJECT_ROOT, p.path) : null;
    const artifactPresent = !!abs && existsSync(abs);
    let hashMatch = null;
    let producedAt = null;
    if (artifactPresent) {
      try {
        hashMatch = sha256(readFileSync(abs)) === digest;
        producedAt = new Date(statSync(abs).mtimeMs).toISOString();
      } catch { hashMatch = false; }
    }
    return {
      id,
      hashBound: pathOk && SHA256_HEX.test(digest) && attestOk && attestRecordsHash,
      artifactPresent,
      hashMatch,
      attestedIn: typeof p.attestedIn === 'string' ? p.attestedIn : null,
      producedAt,
    };
  });
}
