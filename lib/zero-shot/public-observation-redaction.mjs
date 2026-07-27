// Pure redaction for facts that may leave the browser boundary in PageObservation.
// It deliberately uses shape-only rules and never reads credentials, site config, or environment state.

export const SENSITIVE_PATH_SEGMENT = '<redacted:sensitive>';

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/iu;
const SENSITIVE_WORD = /(bearer|token|session|password|passwd|passcode|\bpwd\b|credential|authorization|cookie|api[-_ ]?key|secret|密码|口令|凭据|令牌|会话)/iu;
const OPAQUE_IDENTIFIER = /[A-Za-z0-9+/=_-]{32,}/u;

function decodedVariants(value) {
  const variants = [value];
  let current = value;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      variants.push(decoded);
      current = decoded;
    } catch {
      break;
    }
  }
  return variants;
}

export function isSensitivePublicText(value) {
  if (typeof value !== 'string' || !value) return false;
  return decodedVariants(value).some((candidate) => EMAIL.test(candidate)
    || SENSITIVE_WORD.test(candidate)
    || OPAQUE_IDENTIFIER.test(candidate));
}

export function normalizePublicText(value, maxLength = 256) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export function sanitizePublicTitle(value) {
  const normalized = normalizePublicText(value);
  return normalized && !isSensitivePublicText(normalized) ? normalized : '';
}

export function sanitizePublicSemanticName(value) {
  const normalized = normalizePublicText(value);
  return normalized && !isSensitivePublicText(normalized) ? normalized : null;
}

export function sanitizePublicPathname(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  const sanitized = value.split('/')
    .map((segment) => (segment && isSensitivePublicText(segment)
      ? SENSITIVE_PATH_SEGMENT
      : segment))
    .join('/');
  return sanitized || '/';
}
