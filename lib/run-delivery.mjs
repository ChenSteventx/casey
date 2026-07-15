// 正式 Web run 的交付门。只消费已产出的事实，不参与/覆盖 verdict（护栏 #15）。
// 纯函数：bin/casey.mjs 负责文件 I/O，本模块只做摘要、同源校验并给出 fail-closed 状态。

import { createHash } from 'node:crypto';

const VERDICTS = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);
const VISUAL_STATES = new Set(['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE']);

function nonEmpty(v) {
  return typeof v === 'string' && v.length > 0;
}

function validIso(v) {
  return nonEmpty(v) && Number.isFinite(Date.parse(v));
}

export function artifactSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createRunBinding({ caseId, runId, completedAt, files } = {}) {
  if (!nonEmpty(caseId) || !nonEmpty(runId) || !validIso(completedAt)) throw new Error('run binding 缺 caseId/runId/completedAt');
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('run binding files 须对象');
  const hashes = {};
  for (const key of Object.keys(files).sort()) {
    if (!/^[a-z][a-z0-9.-]*$/.test(key)) throw new Error('run binding 文件键非法');
    hashes[key] = artifactSha256(files[key]);
  }
  return { schemaVersion: 1, caseId, runId, completedAt, files: hashes };
}

export function verifyRunBinding(binding, { caseId, runId, files, requiredKeys = [] } = {}) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding) || binding.schemaVersion !== 1) throw new Error('run binding 非法');
  if (binding.caseId !== caseId || binding.runId !== runId || !validIso(binding.completedAt)) throw new Error('run binding 与 caseId/runId 不同源');
  if (!binding.files || typeof binding.files !== 'object' || Array.isArray(binding.files)) throw new Error('run binding.files 非法');
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('待校验 files 非法');
  for (const key of requiredKeys) if (!Object.prototype.hasOwnProperty.call(binding.files, key)) throw new Error(`run binding 缺 ${key}`);
  const boundKeys = Object.keys(binding.files).sort();
  const actualKeys = Object.keys(files).sort();
  if (JSON.stringify(boundKeys) !== JSON.stringify(actualKeys)) throw new Error('run binding 文件集合与当前收口输入不一致');
  for (const key of boundKeys) {
    if (!/^[a-f0-9]{64}$/.test(binding.files[key]) || artifactSha256(files[key]) !== binding.files[key]) {
      throw new Error(`run binding 摘要不匹配：${key}`);
    }
  }
  return binding;
}

export function inspectVideoConvergence({ noVideo = false, videoMeta = null, videoBytes = 0, videoFileNames = [] } = {}) {
  if (noVideo === true) {
    return { ok: false, explicitException: true, reason: 'NO_VIDEO_EXPLICIT_EXCEPTION' };
  }
  if (!videoMeta || typeof videoMeta !== 'object' || Array.isArray(videoMeta)) {
    return { ok: false, explicitException: false, reason: 'VIDEO_META_MISSING_OR_INVALID' };
  }
  if (videoMeta.schemaVersion !== 1 || videoMeta.file !== 'video.webm'
    || typeof videoMeta.startedAt !== 'number' || !Number.isFinite(videoMeta.startedAt)
    || !Array.isArray(videoMeta.steps)) {
    return { ok: false, explicitException: false, reason: 'VIDEO_META_MISSING_OR_INVALID' };
  }
  for (const row of videoMeta.steps) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !nonEmpty(row.stepId)
      || typeof row.videoAt !== 'number' || !Number.isFinite(row.videoAt) || row.videoAt < 0) {
      return { ok: false, explicitException: false, reason: 'VIDEO_META_MISSING_OR_INVALID' };
    }
  }
  if (!Number.isInteger(videoBytes) || videoBytes <= 0) {
    return { ok: false, explicitException: false, reason: 'VIDEO_FILE_MISSING_OR_EMPTY' };
  }
  if (!Array.isArray(videoFileNames) || videoFileNames.length !== 1 || videoFileNames[0] !== 'video.webm') {
    return { ok: false, explicitException: false, reason: 'VIDEO_FILES_NOT_CONVERGED' };
  }
  return { ok: true, explicitException: false, reason: null };
}

export function validateVisualReviewBinding(input, { caseId, runId, videoSha256, verdictSha256, completedAt } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('visual review 须为对象');
  }
  if (!nonEmpty(caseId) || !nonEmpty(runId)) throw new Error('交付门缺 caseId/runId');
  if (input.caseId !== caseId) throw new Error('visual review caseId 与本次 run 不同源');
  if (input.runId !== runId) throw new Error('visual review runId 与本次 run 不同源');
  if (input.verdictImpact !== 'none') throw new Error('visual review verdictImpact 必须显式固定为 none');
  if (!VISUAL_STATES.has(input.status)) throw new Error('visual review status 非法');
  if (!/^[a-f0-9]{64}$/.test(videoSha256 || '') || input.videoSha256 !== videoSha256) throw new Error('visual review 未绑定本次录像摘要');
  if (!/^[a-f0-9]{64}$/.test(verdictSha256 || '') || input.verdictSha256 !== verdictSha256) throw new Error('visual review 未绑定本次 verdict 摘要');
  if (!validIso(completedAt) || !validIso(input.reviewedAt) || Date.parse(input.reviewedAt) <= Date.parse(completedAt)) {
    throw new Error('visual review 必须发生在本次 run 产证完成之后');
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) throw new Error('visual review 须至少引用一份同 run 视觉证据');
  for (const evidence of input.evidence) {
    if (!evidence || typeof evidence.file !== 'string' || !/\.(?:png|jpe?g|webp|webm|mp4)$/i.test(evidence.file)) {
      throw new Error('visual review evidence 必须引用图片或录像');
    }
  }
  return input;
}

export function assessFormalDelivery({ caseId, runId, noVideo = false, videoConvergence, verdict, visualReview = null, binding = null } = {}) {
  if (!nonEmpty(caseId) || !nonEmpty(runId)) throw new Error('正式交付评估缺 caseId/runId');
  if (!verdict || typeof verdict !== 'object' || !Array.isArray(verdict.steps) || verdict.steps.length === 0) {
    throw new Error('正式交付评估缺有效 verdict.steps');
  }
  if (verdict.caseId !== caseId) throw new Error('verdict.caseId 与本次 run 不同源');

  const reasons = [];
  if (noVideo === true) reasons.push('NO_VIDEO_EXPLICIT_EXCEPTION');
  else if (!videoConvergence || videoConvergence.ok !== true) reasons.push(videoConvergence?.reason || 'VIDEO_NOT_CONVERGED');

  let allPass = true;
  for (const step of verdict.steps) {
    if (!step || !VERDICTS.has(step.verdict)) throw new Error('正式交付评估遇到非法 verdict');
    if (step.verdict !== 'PASS') allPass = false;
  }
  if (!allPass) reasons.push('VERDICT_NOT_ALL_PASS');

  if (visualReview == null) reasons.push('VISUAL_REVIEW_MISSING');
  else {
    if (!binding || !binding.files) throw new Error('正式交付视觉复核缺 run binding');
    validateVisualReviewBinding(visualReview, {
      caseId, runId, completedAt: binding.completedAt,
      videoSha256: binding.files['video.webm'], verdictSha256: binding.files['verdict.json'],
    });
    if (visualReview.status !== 'CONSISTENT') reasons.push(`VISUAL_REVIEW_${visualReview.status}`);
  }

  return {
    formalDeliveryComplete: reasons.length === 0,
    status: reasons.length === 0 ? 'FORMAL_DELIVERY_COMPLETE' : (noVideo === true ? 'NON_FORMAL_RUN' : 'FORMAL_DELIVERY_INCOMPLETE'),
    reasons,
    exitCode: reasons.length === 0 ? 0 : 1,
  };
}
