// intent 锚定的 topology 语义投影：只保留 intentId + transition ordinal + kind + canonical route。
// 动态字段（pageId、openerPageId、locator、requestId、timestamp、action index）一律投影掉。
// 纯函数：零 browser、零 fs、零 network、零 LLM。

const ROUTE_PATTERN = /^sha256:[0-9a-f]{64}$/;
const TOPOLOGY_KINDS = ['newpage', 'switch', 'close', 'popup'];

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

export function isComparableRoute(value) {
  return typeof value === 'string' && ROUTE_PATTERN.test(value);
}

export function isTopologyKind(value) {
  return typeof value === 'string' && TOPOLOGY_KINDS.includes(value);
}

// 单行投影：kind 必须是已登记的迁移类别，route 必须是可比较的 canonical digest。
export function projectTopologyRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return denied('TOPOLOGY_EVIDENCE_MISSING');
  }
  if (typeof row.intentId !== 'string' || !row.intentId) {
    return denied('TOPOLOGY_EVIDENCE_MISSING');
  }
  if (!Number.isSafeInteger(row.ordinal) || row.ordinal < 0) {
    return denied('TOPOLOGY_EVIDENCE_MISSING');
  }
  if (!isTopologyKind(row.kind)) return denied('TOPOLOGY_MISMATCH');
  if (!isComparableRoute(row.routeProjectionSha256)) {
    return denied('TOPOLOGY_ROUTE_UNCOMPARABLE');
  }
  return frozen({
    ok: true,
    row: frozen({
      intentId: row.intentId,
      ordinal: row.ordinal,
      kind: row.kind,
      routeProjectionSha256: row.routeProjectionSha256,
    }),
  });
}

// 整段投影：按 intentId + ordinal 锚定并排序；重复锚点固定 TOPOLOGY_MISMATCH。
export function projectTopologyEvidence(rows) {
  if (!Array.isArray(rows)) return denied('TOPOLOGY_EVIDENCE_MISSING');
  const anchors = new Set();
  const projected = [];
  for (const row of rows) {
    const result = projectTopologyRow(row);
    if (result.ok !== true) return result;
    const anchor = `${result.row.intentId}#${result.row.ordinal}`;
    if (anchors.has(anchor)) return denied('TOPOLOGY_MISMATCH');
    anchors.add(anchor);
    projected.push(result.row);
  }
  projected.sort((left, right) => (left.intentId === right.intentId
    ? left.ordinal - right.ordinal
    : (left.intentId < right.intentId ? -1 : 1)));
  return frozen({ ok: true, rows: frozen(projected) });
}
