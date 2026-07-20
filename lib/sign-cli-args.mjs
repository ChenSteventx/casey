// sign CLI 闭合参数面（纯函数）：未知/废弃/重复旗标与多余位置参数不得被静默忽略。

const SIGN_VALUE_FLAGS = new Set([
  'draft', 'prd', 'frozen-out', 'signer', 'against-build', 'signed-at', 'verdict-baseline', 'archive-dir',
  'events', 'entity-bindings-draft', 'entity-confirmations', 'entity-locks-out', 'audience',
]);
const SIGN_BOOLEAN_FLAGS = new Set(['resign', 'force']);

export function parseSignArgs(argv) {
  const out = { pos: [], invalidFlags: [], duplicateFlags: [] };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (typeof token !== 'string') { out.invalidFlags.push('<non-string>'); continue; }
    if (!token.startsWith('--')) { out.pos.push(token); continue; }
    const key = token.slice(2);
    if (!SIGN_VALUE_FLAGS.has(key) && !SIGN_BOOLEAN_FLAGS.has(key)) { out.invalidFlags.push(key); continue; }
    if (seen.has(key)) out.duplicateFlags.push(key);
    seen.add(key);
    if (SIGN_BOOLEAN_FLAGS.has(key)) out[key] = true;
    else if (index + 1 < argv.length && typeof argv[index + 1] === 'string' && !argv[index + 1].startsWith('--')) out[key] = argv[++index];
    else out[key] = true;
  }
  return out;
}
