// 双证判定纯函数（agent-id-readback s2）。语义权威：plan §2 v4 判定表 + interface-spec §2/§8。
// 判定顺序固定：信封完整性先决 → DOM failed → 同名计数（先数同名再查码，封「码过滤假唯一」）
// → 命中 0 → 唯一行联合判据（期望码/DOM 码/信封码/已签三元任一不等即拒）→ 三方全等放行。

import { AGENT_IDENTITY_MODE_LEGACY, AGENT_IDENTITY_MODE_NETWORK_CODE } from './agent-identity-profile.mjs';

function failed(reason) { return { resolution: 'action_failed', reason }; }

export function resolveDualIdentity({ mode = AGENT_IDENTITY_MODE_LEGACY, dom, envelope, expected } = {}) {
  if (![AGENT_IDENTITY_MODE_LEGACY, AGENT_IDENTITY_MODE_NETWORK_CODE].includes(mode)) {
    return failed('identity-mode-unsupported');
  }
  if (!expected || typeof expected.openName !== 'string' || expected.openName.trim() === '') {
    return failed('expected-open-name-missing');
  }
  // 完整性先决：信封状态非 ok 一律 action_failed（total/hasNext/坏行复核由账本层完成）。
  if (!envelope || envelope.status !== 'ok') {
    return failed(`envelope-${envelope && envelope.status ? envelope.status : 'missing'}`);
  }
  if (!dom || typeof dom.status !== 'string') return failed('dom-missing');
  if (dom.status === 'failed') return failed('dom-failed');

  // 完整集合内同名计数——先数同名（含码不中的同名行），再谈码。
  const sameName = envelope.rows.filter((row) => row.name === expected.openName);
  if (sameName.length > 1 || dom.status === 'ambiguous') {
    return { resolution: 'ambiguous', reason: sameName.length > 1 ? 'envelope-same-name-multi' : 'dom-ambiguous', candidateCount: Math.max(sameName.length, 2) };
  }
  if (sameName.length === 0) {
    return { resolution: 'absent', reason: 'envelope-name-zero-hit' };
  }

  const row = sameName[0];
  if (expected.code != null && row.code !== expected.code) return failed('expected-code-mismatch');
  if (dom.status !== 'unique' || dom.name !== expected.openName) return failed('dom-anchor-mismatch');
  // Legacy 仍要求同一物理卡片读出 name+code。网络编号模式的真实卡片不展示 code，
  // DOM 只证精确名称与物理句柄；code/platformId 由完整信封和已签三元组负责。
  if (mode === AGENT_IDENTITY_MODE_LEGACY) {
    if (typeof dom.code !== 'string' || dom.code.trim() === '') return failed('dom-code-missing');
    if (dom.code !== row.code) return failed('dom-code-mismatch');
  }
  if (expected.signedName != null && row.name !== expected.signedName) return failed('signed-name-mismatch');
  if (expected.signedCode != null && row.code !== expected.signedCode) return failed('signed-code-mismatch');
  if (expected.signedPlatformId != null && row.id !== expected.signedPlatformId) return failed('signed-platform-id-mismatch');

  return {
    resolution: 'unique',
    reason: null,
    matched: { name: row.name, code: row.code, platformId: row.id },
  };
}
