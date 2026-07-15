// 只读漂移探针 findEquivalentAffordance（拆 P5/P6 循环依赖：P5 只读判存、不点不改 spec）。
// 录制 locator 失配(resolution==='none')后，从 atom + targetName 构造规范稳定签名(canonical)，
// 只读查「同稳定签名的唯一元素是否仍在」，输出 driftProbe 供 verdict.mjs 判 HARNESS_ERROR（护栏 #13）。
// 绝不点击、绝不改 spec —— 与自愈写回（相5/P6）严格分离。

// atom → 等价可供性的语义形态（role + accessibleName）。canonical = role=<role>|name=<name>|withinRow=<targetName>。
// 复现 drift-patch.fixture 的 canonical（role=button|name=删除|withinRow=...），不另造。
const ATOM_AFFORDANCE = {
  'workflow.deleteByName': { role: 'button', name: '删除' },
};

export function canonicalSignature(atom, targetName) {
  const a = ATOM_AFFORDANCE[atom];
  if (!a || !targetName) return null;
  return `role=${a.role}|name=${a.name}|withinRow=${targetName}`;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// page: playwright Page。返回 { sameSignatureUniquePresent, candidateCount, matchedSignature }。
export async function findEquivalentAffordance(page, atom, targetName) {
  const a = ATOM_AFFORDANCE[atom];
  const canonical = canonicalSignature(atom, targetName);
  if (!a || !targetName) {
    return { sameSignatureUniquePresent: false, candidateCount: 0, matchedSignature: null };
  }
  // 同稳定签名：targetName 所在行(role=row, accessibleName 含 targetName)内的 role+name 元素。只读 count。
  let count = 0;
  try {
    const row = page.getByRole('row', { name: new RegExp(escapeRe(targetName)) });
    const cand = row.getByRole(a.role, { name: a.name });
    count = await cand.count();
  } catch {
    count = 0;
  }
  return {
    sameSignatureUniquePresent: count === 1,
    candidateCount: count,
    matchedSignature: count === 1 ? canonical : null,
  };
}
