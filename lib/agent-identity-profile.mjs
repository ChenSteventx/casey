import { createHash } from 'node:crypto';

export const AGENT_IDENTITY_MODE_LEGACY = 'dom-name-code-v1';
export const AGENT_IDENTITY_MODE_NETWORK_CODE = 'network-code-dom-name-v1';

const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function profileDigest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

export function calculateLegacyIdentityProfileDigest(channel) {
  return profileDigest(channel);
}

function projectListApi(listApi) {
  if (!object(listApi)
    || !nonEmpty(listApi.pathname) || !listApi.pathname.startsWith('/')
    || !nonEmpty(listApi.method)
    || !nonEmpty(listApi.recordsPath)
    || !nonEmpty(listApi.totalPath)
    || !nonEmpty(listApi.queryParam)
    || !(listApi.hasNextPath == null || nonEmpty(listApi.hasNextPath))
    || !object(listApi.fields)
    || !nonEmpty(listApi.fields.id)
    || !nonEmpty(listApi.fields.code)
    || !nonEmpty(listApi.fields.name)) return null;
  return {
    pathname: listApi.pathname,
    method: listApi.method,
    queryParam: listApi.queryParam,
    recordsPath: listApi.recordsPath,
    totalPath: listApi.totalPath,
    hasNextPath: listApi.hasNextPath ?? null,
    fields: { id: listApi.fields.id, code: listApi.fields.code, name: listApi.fields.name },
  };
}

export function parseAgentIdentityProfile(agents) {
  if (!object(agents)) return { ok: false, reason: 'AGENT_IDENTITY_PROFILE_INVALID' };
  const channel = projectListApi(agents.listApi);
  if (!channel) return { ok: false, reason: 'AGENT_IDENTITY_LIST_API_INVALID' };
  if (!nonEmpty(agents.itemContainer) || !object(agents.cardFields) || !nonEmpty(agents.cardFields.name)) {
    return { ok: false, reason: 'AGENT_IDENTITY_DOM_NAME_INVALID' };
  }

  const mode = agents.identityMode === undefined ? AGENT_IDENTITY_MODE_LEGACY : agents.identityMode;
  if (mode === AGENT_IDENTITY_MODE_LEGACY) {
    if (!nonEmpty(agents.cardFields.code)) return { ok: false, reason: 'AGENT_IDENTITY_DOM_CODE_INVALID' };
    return {
      ok: true,
      mode,
      channel,
      card: {
        itemContainer: agents.itemContainer,
        cardFields: { name: agents.cardFields.name, code: agents.cardFields.code },
      },
      // Legacy identityProfileDigest 原来只覆盖 listApi；保持原材料与字节不变。
      digest: calculateLegacyIdentityProfileDigest(channel),
    };
  }

  if (mode === AGENT_IDENTITY_MODE_NETWORK_CODE) {
    const cardKeys = Object.keys(agents.cardFields);
    if (cardKeys.length !== 1 || cardKeys[0] !== 'name') {
      return { ok: false, reason: 'AGENT_IDENTITY_NETWORK_CODE_CARD_FIELDS_INVALID' };
    }
    const digestMaterial = {
      mode,
      listApi: channel,
      itemContainer: agents.itemContainer,
      nameSelector: agents.cardFields.name,
    };
    return {
      ok: true,
      mode,
      channel,
      card: {
        itemContainer: agents.itemContainer,
        cardFields: { name: agents.cardFields.name },
      },
      digest: profileDigest(digestMaterial),
    };
  }

  return { ok: false, reason: 'AGENT_IDENTITY_MODE_UNSUPPORTED' };
}
