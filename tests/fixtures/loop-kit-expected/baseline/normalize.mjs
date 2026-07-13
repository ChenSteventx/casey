#!/usr/bin/env node
// normalize.mjs —— 观测基线规范化器（自身入 prd 冻结面，plan.md D7 C2）。
// 字段级白名单（round-1 实现审 A5 收严后版本）：只替换两类逐一登记的字段，按结构化路径定位、
// 不对整份结果做 JSON.stringify 后的全局正则扫描——白名单之外一字不动，防止吞掉 stdout/stderr
// 或任意文件内容里本应参与比对的真实业务差异（哪怕它们碰巧长得像时间戳/路径）。
//   ① raw.stdout / raw.stderr —— 隔离树自身绝对根路径字面量 → <TREE_ROOT>（仅这两个顶层字段）；
//   ② raw.tree.contents['loop/.breaker-state.json'] 的 startedAt 字段 —— ISO 8601 时间戳 → <TIMESTAMP>
//     （按文件路径 + 字段名双重限定的字符串替换，不解析/重排该文件其余内容，保持字节形状不变）。
// 反向扰动用例（证明本规范化不吞真实差异，含白名单外时间戳类差异）见
// tests/_golden/loop-kit-extract.golden.mjs C2。
const STARTED_AT_FIELD_RE = /("startedAt":\s*")[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z(")/;
const BREAKER_STATE_PATH = 'loop/.breaker-state.json';

function replaceTreeRoot(value, treeRoot) {
  if (typeof value !== 'string' || !treeRoot) return value;
  return value.split(treeRoot).join('<TREE_ROOT>');
}

export function normalize(raw, { treeRoot } = {}) {
  const out = JSON.parse(JSON.stringify(raw)); // 深拷贝：不改调用方原对象，其余字段原样透传
  out.stdout = replaceTreeRoot(out.stdout, treeRoot);
  out.stderr = replaceTreeRoot(out.stderr, treeRoot);
  const contents = out.tree && out.tree.contents;
  if (contents && Object.prototype.hasOwnProperty.call(contents, BREAKER_STATE_PATH)) {
    const original = contents[BREAKER_STATE_PATH];
    if (typeof original === 'string' && STARTED_AT_FIELD_RE.test(original)) {
      contents[BREAKER_STATE_PATH] = original.replace(STARTED_AT_FIELD_RE, '$1<TIMESTAMP>$2');
    }
  }
  return out;
}
