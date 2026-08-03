// teach-in authoring 对 exact channel profile bytes 的唯一纯解析入口。
// bytes 缺席表示 legacy；一旦在场必须是 JSON record，已支持的 route 形状须闭合。
// 身份观察通道目前尚未接入 authoring runtime 的网络取证，因此显式投影为
// identityChannelDeclared，交 runtime owner 在任何物理 open 前 fail-closed。

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function parseAuthoringChannelProfileBytes(bytes) {
  if (bytes === undefined || bytes === null) {
    return Object.freeze({ ok: true, present: false });
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    return Object.freeze({ ok: false, reason: 'AUTHORING_CHANNEL_PROFILE_INVALID' });
  }

  let profile;
  try {
    profile = JSON.parse(bytes.toString('utf8'));
  } catch {
    return Object.freeze({ ok: false, reason: 'AUTHORING_CHANNEL_PROFILE_INVALID' });
  }
  if (!isRecord(profile)) {
    return Object.freeze({ ok: false, reason: 'AUTHORING_CHANNEL_PROFILE_INVALID' });
  }

  let listRoute = null;
  let agentListRoute = null;
  if (profile.routes !== undefined) {
    if (!isRecord(profile.routes)) {
      return Object.freeze({ ok: false, reason: 'AUTHORING_CHANNEL_PROFILE_INVALID' });
    }
    const route = (value) => value === undefined
      || (typeof value === 'string' && value.startsWith('/'));
    if (!route(profile.routes.workflowList) || !route(profile.routes.agentList)) {
      return Object.freeze({ ok: false, reason: 'AUTHORING_CHANNEL_PROFILE_INVALID' });
    }
    listRoute = profile.routes.workflowList || null;
    agentListRoute = profile.routes.agentList || null;
  }

  let identityChannelDeclared = false;
  for (const key of ['agents', 'workflows']) {
    const section = profile[key];
    if (section === undefined || section === null) continue;
    if (!isRecord(section)) {
      return Object.freeze({ ok: false, reason: 'AUTHORING_CHANNEL_PROFILE_INVALID' });
    }
    if (section.listApi !== undefined && section.listApi !== null) {
      identityChannelDeclared = true;
    }
  }

  return Object.freeze({
    ok: true,
    present: true,
    profile: deepFreeze(profile),
    listRoute,
    agentListRoute,
    identityChannelDeclared,
  });
}
