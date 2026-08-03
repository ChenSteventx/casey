// 未支持作用域键清单的唯一事实源：纯叶模块，零 import。
// 观察归一化、观察阻断、确定性解析、动作准入、进展完整性这五处判据全部从这里取，
// 加键时只改这一份清单——元钉金牌 zero-shot-unsupported-scope-fanout 会当场逼出漏接的消费点。

// 键清单只许加不许减（棘轮由元钉金牌钉住）。
export const UNSUPPORTED_SCOPE_KEYS = Object.freeze(['iframe', 'shadow', 'containerOnly']);

function isRecordLike(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 归一化：产出恰含 UNSUPPORTED_SCOPE_KEYS 的冻结布尔记录。未知键一律剥掉；
// 非记录形状（数组 / null / 标量）按空记录处理——与收敛前 page-observer 的逐字构造逐点等价。
export function normalizeUnsupportedScopes(value) {
  const source = isRecordLike(value) ? value : {};
  const normalized = {};
  for (const key of UNSUPPORTED_SCOPE_KEYS) {
    normalized[key] = source[key] === true;
  }
  return Object.freeze(normalized);
}

// 判据：取收敛前三处实现的并集严格度。数组型非空即真（保确定性解析的现役行为）；
// 记录型任一自有值恰为 true 即真——含未知键，因为合成观察件上的未知键今天就被确定性解析拦住，
// 收敛后必须继续拦住，只认已知键是放松。其余形状返回假，与收敛前三处一致
//（是否改成 fail-closed 属另一契约，已挂账 route:human）。
export function anyUnsupportedScope(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!isRecordLike(value)) return false;
  return Object.values(value).some((flag) => flag === true);
}
