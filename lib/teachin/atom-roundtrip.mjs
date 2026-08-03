// atom roundtrip 冻结入口：消费一次性 atom-roundtrip grant → 现役 flow-bridge → 注入的现役
// compile 接缝 → exact lineage → 降权 formal candidate。
// 纯核心：零 browser、零 fs、零 network、零 LLM。编译器只经 compileAdapter 注入，
// 本模块不导入、不内置、不复制任何原子编译知识；产物恒为 developmentOnly 候选，绝不冒充正式结论。

import { buildFlow, validateBridge } from '../flow-bridge.mjs';
import { consumeAtomRoundtripGrant } from './resolved-projection.mjs';
import { validateCompileLineage } from '../teachin-distillation/compile-lineage.mjs';
import { materializeDistilledFormalCandidate } from '../teachin-distillation/formal-candidate.mjs';

const ROUNDTRIP_INPUT_KEYS = ['atomRoundtripGrant', 'compileAdapter'];

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function runAtomRoundtrip(options = {}) {
  let atomRoundtripGrant;
  let compileAdapter;
  try {
    if (!options || typeof options !== 'object') {
      return denied('ATOM_ROUNDTRIP_INPUT_INVALID');
    }
    if (Object.keys(options).sort().join(',') !== ROUNDTRIP_INPUT_KEYS.join(',')) {
      return denied('ATOM_ROUNDTRIP_INPUT_INVALID');
    }
    ({ atomRoundtripGrant, compileAdapter } = options);
  } catch {
    return denied('ATOM_ROUNDTRIP_INPUT_INVALID');
  }
  if (typeof compileAdapter !== 'function') {
    return denied('ATOM_ROUNDTRIP_INPUT_INVALID');
  }

  // 输入闭合后才消费 grant：探针式非法输入不得吃掉 genuine 一次性额度。
  const record = consumeAtomRoundtripGrant(atomRoundtripGrant);
  if (!record) return denied('ATOM_ROUNDTRIP_GRANT_INVALID');

  const candidateTestCase = record.candidateTestCase;
  const candidateMapping = record.candidateMapping;
  const lineagePlan = record.lineagePlan;

  let bridge;
  try {
    bridge = validateBridge(
      structuredClone(candidateTestCase),
      structuredClone(candidateMapping),
      { registry: record.registry },
    );
  } catch {
    return denied('BRIDGE_REJECTED');
  }
  if (!bridge || bridge.ok !== true) return denied('BRIDGE_REJECTED');

  let flow;
  try {
    flow = buildFlow(
      structuredClone(candidateTestCase),
      structuredClone(candidateMapping),
    );
  } catch {
    return denied('BRIDGE_REJECTED');
  }
  deepFreeze(flow);

  let compiled;
  try {
    // 恰调用一次：失败首错停止，不 retry，也不回显 adapter 私有异常原文。
    compiled = await compileAdapter({
      candidateTestCase,
      candidateMapping,
      flow,
      lineagePlan,
    });
  } catch {
    return denied('COMPILE_REJECTED');
  }
  if (!isPlainRecord(compiled) || compiled.ok !== true) return denied('COMPILE_REJECTED');
  if (!Array.isArray(compiled.compiledEvents) || !Array.isArray(compiled.compileLineage)) {
    return denied('COMPILE_REJECTED');
  }

  const compiledEvents = structuredClone(compiled.compiledEvents);
  const compileLineage = structuredClone(compiled.compileLineage);

  const lineage = validateCompileLineage({
    lineagePlan,
    compileLineage,
    compiledEvents,
  });
  if (!lineage.ok) return denied(lineage.reason);

  const formal = materializeDistilledFormalCandidate({
    caseId: record.caseId,
    captureSha256: record.captureSha256,
    captureCreatedAt: record.captureCreatedAt,
    captureStartPath: record.captureStartPath,
    projection: record.projection,
    resolved: record.resolved,
    structural: record.structural,
    compiledEvents,
    compileLineage,
    coverage: record.coverage,
  });
  if (!formal.ok) return denied(formal.reason);

  return frozen({
    ok: true,
    developmentOnly: true,
    promotionReady: false,
    candidateTestCase,
    candidateMapping,
    eventsCandidate: deepFreeze(formal.eventsCandidate),
    eventsDocumentCandidate: deepFreeze(formal.eventsDocumentCandidate),
    compileLineage: deepFreeze(compileLineage),
    manifest: formal.manifest,
  });
}
