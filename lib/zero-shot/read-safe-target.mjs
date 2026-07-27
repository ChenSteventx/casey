// Pure, deterministic policy for zero-shot targets that may execute without
// additional human authority. The allow-list is deliberately narrow: a link
// with a non-risky accessible name is the only automatically executable shape.

const CHINESE_SIDE_EFFECT_MARKERS = Object.freeze([
  '退出',
  '注销',
  '删除',
  '移除',
  '发布',
  '保存',
  '提交',
  '确认',
  '撤销',
  '清空',
  '停用',
  '启用',
  '创建',
  '新建',
  '添加',
  '绑定',
  '解绑',
]);

const ENGLISH_SIDE_EFFECT_MARKER =
  /(?:^|[^a-z])(?:logout|log\s+out|sign\s+out|delete|remove|revoke|publish|save|submit|confirm|approve|archive|clear|disable|enable|create|add|unbind|bind)(?:$|[^a-z])/u;

const CHINESE_READ_MARKERS = Object.freeze([
  '继续',
  '打开',
  '查看',
  '详情',
  '帮助',
  '进入',
  '返回',
  '更多',
  '浏览',
  '前往',
]);

const ENGLISH_READ_MARKER =
  /(?:^|[^a-z])(?:continue|open|view|details?|help|enter|back|more|browse|go\s+to|learn\s+more)(?:$|[^a-z])/u;

const CHINESE_ADDITIONAL_RISK_MARKERS = Object.freeze([
  '登出',
  '销户',
  '抹除',
  '批准',
  '归档',
]);

function normalizedName(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
  return normalized || null;
}

export function isReadSafeZeroShotTarget(semantic) {
  if (semantic?.kind !== 'role' || semantic.role !== 'link') return false;
  const name = normalizedName(semantic.name);
  if (!name) return false;
  if (CHINESE_SIDE_EFFECT_MARKERS.some((marker) => name.includes(marker))) return false;
  if (CHINESE_ADDITIONAL_RISK_MARKERS.some((marker) => name.includes(marker))) return false;
  if (ENGLISH_SIDE_EFFECT_MARKER.test(name)) return false;
  return CHINESE_READ_MARKERS.some((marker) => name.includes(marker))
    || ENGLISH_READ_MARKER.test(name);
}
