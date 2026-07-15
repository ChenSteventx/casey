// CEF 通道剖面：配置只引用环境变量，真实调试回环地址绝不进文件、日志或报告。
const fail = (code) => new Error(code);
const object = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const TOP_KEYS = new Set(['schemaVersion', 'channel', 'discovery', 'timeouts', 'screencast']);
const DISCOVERY_KEYS = new Set(['baseUrlEnv', 'titlePattern', 'pathPattern']);
const TIMEOUT_KEYS = new Set(['discoveryMs', 'connectMs', 'commandMs', 'recordMaxMs', 'actionQuietMs']);
const SCREENCAST_KEYS = new Set(['format', 'quality', 'maxWidth', 'maxHeight', 'everyNthFrame']);
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const isLoopback = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';

function closed(doc, allowed, prefix, problems) {
  if (!object(doc)) { problems.push(`${prefix}.type`); return; }
  for (const key of Object.keys(doc)) if (!allowed.has(key)) problems.push(`${prefix}.unknown_field`);
}
function boundedInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validPattern(value) {
  if (typeof value !== 'string' || value.length > 300) return false;
  try { new RegExp(value); return true; } catch { return false; }
}

export function validateCefProfile(doc) {
  const problems = [];
  closed(doc, TOP_KEYS, 'profile', problems);
  if (!object(doc)) return { ok: false, problems };
  if (doc.schemaVersion !== 1) problems.push('profile.schema_version');
  if (doc.channel !== 'cef') problems.push('profile.channel');
  closed(doc.discovery, DISCOVERY_KEYS, 'discovery', problems);
  if (object(doc.discovery)) {
    if (!ENV_NAME.test(doc.discovery.baseUrlEnv || '')) problems.push('discovery.base_url_env');
    if (!validPattern(doc.discovery.titlePattern)) problems.push('discovery.title_pattern');
    if (!validPattern(doc.discovery.pathPattern)) problems.push('discovery.path_pattern');
  }
  closed(doc.timeouts, TIMEOUT_KEYS, 'timeouts', problems);
  if (object(doc.timeouts)) {
    if (!boundedInt(doc.timeouts.discoveryMs, 100, 30000)) problems.push('timeouts.discovery_ms');
    if (!boundedInt(doc.timeouts.connectMs, 100, 30000)) problems.push('timeouts.connect_ms');
    if (!boundedInt(doc.timeouts.commandMs, 100, 60000)) problems.push('timeouts.command_ms');
    if (!boundedInt(doc.timeouts.recordMaxMs, 1000, 3600000)) problems.push('timeouts.record_max_ms');
    if (!boundedInt(doc.timeouts.actionQuietMs, 0, 10000)) problems.push('timeouts.action_quiet_ms');
  }
  closed(doc.screencast, SCREENCAST_KEYS, 'screencast', problems);
  if (object(doc.screencast)) {
    if (!['jpeg', 'png'].includes(doc.screencast.format)) problems.push('screencast.format');
    if (!boundedInt(doc.screencast.quality, 1, 100)) problems.push('screencast.quality');
    if (!boundedInt(doc.screencast.maxWidth, 320, 3840)) problems.push('screencast.max_width');
    if (!boundedInt(doc.screencast.maxHeight, 240, 2160)) problems.push('screencast.max_height');
    if (!boundedInt(doc.screencast.everyNthFrame, 1, 60)) problems.push('screencast.every_nth_frame');
  }
  return { ok: problems.length === 0, problems };
}

export function resolveCefProfile(doc, env = process.env) {
  const checked = validateCefProfile(doc);
  if (!checked.ok) throw fail('CEF_PROFILE_INVALID');
  const raw = env && env[doc.discovery.baseUrlEnv];
  let base;
  try { base = new URL(raw); } catch { throw fail('CEF_PROFILE_BASE_MISSING'); }
  if (!['http:', 'https:'].includes(base.protocol)
    || !isLoopback(base.hostname)
    || base.username || base.password || base.search || base.hash
    || (base.pathname && base.pathname !== '/')) throw fail('CEF_PROFILE_BASE_NOT_LOOPBACK');
  return Object.freeze({
    channel: 'cef',
    baseUrl: base.href,
    titlePattern: doc.discovery.titlePattern,
    pathPattern: doc.discovery.pathPattern,
    timeouts: Object.freeze({ ...doc.timeouts }),
    screencast: Object.freeze({ ...doc.screencast }),
  });
}
