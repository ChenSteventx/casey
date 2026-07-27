// Logical browser target and transport policy.
// Pure layer: no process, filesystem, network, or browser dependencies.

const RUNTIME_CLASS = Object.freeze({
  win32: 'windows',
  linux: 'linux',
  darwin: 'macos',
});

const TRANSPORT_MODES = new Set([
  'direct',
  'legacy-loopback',
  'origin-preserving-proxy',
]);

export const FRAGMENT_POLICY = 'preserve-for-browser-exclude-from-network-identity';

function reject(reason) {
  return Object.freeze({ ok: false, reason });
}

function parseHttpUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password || !parsed.hostname) return null;
    return parsed;
  } catch {
    return null;
  }
}

function runtimeClassOf(runtime) {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) return null;
  if (typeof runtime.isWSL !== 'boolean') return null;
  const nativeClass = RUNTIME_CLASS[runtime.platform];
  if (!nativeClass) return null;
  if (runtime.isWSL) return runtime.platform === 'linux' ? 'wsl' : null;
  return nativeClass;
}

function endpointBase(parsed) {
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${path}`;
}

function isLoopback(parsed) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);
}

function rebaseUrl(endpoint, logical) {
  return `${endpointBase(endpoint)}${logical.pathname}${logical.search}${logical.hash}`;
}

export function evaluateExecutionTargetPolicy(input = {}) {
  const runtimeClass = runtimeClassOf(input.runtime);
  if (!runtimeClass) return reject('RUNTIME_UNSUPPORTED');

  const startUrl = input.logicalTarget?.startUrl;
  const logical = parseHttpUrl(startUrl);
  if (!logical) return reject('LOGICAL_TARGET_INVALID');

  const mode = input.transport?.mode;
  if (!TRANSPORT_MODES.has(mode)) return reject('TRANSPORT_MODE_INVALID');
  if (typeof input.requiresOriginContinuity !== 'boolean') {
    return reject('ORIGIN_CONTINUITY_UNAVAILABLE');
  }

  const endpointValue = input.transport?.endpoint;
  if (mode === 'direct' && endpointValue !== undefined) {
    return reject('TARGET_TRANSPORT_MODE_MISMATCH');
  }

  let endpoint = null;
  if (mode !== 'direct') {
    endpoint = parseHttpUrl(endpointValue);
    if (!endpoint) return reject('TRANSPORT_ENDPOINT_REQUIRED');
  }

  if (mode === 'legacy-loopback' && runtimeClass !== 'wsl') {
    return reject('TARGET_TRANSPORT_MODE_MISMATCH');
  }
  if (mode === 'legacy-loopback' && !isLoopback(endpoint)) {
    return reject('TARGET_TRANSPORT_MODE_MISMATCH');
  }
  if (mode === 'legacy-loopback' && input.requiresOriginContinuity) {
    return reject('ORIGIN_CONTINUITY_UNAVAILABLE');
  }

  const originContinuity = mode === 'legacy-loopback' ? 'degraded' : 'preserved';
  const browserVisibleStartUrl = mode === 'legacy-loopback'
    ? rebaseUrl(endpoint, logical)
    : startUrl;
  const browserVisibleBaseUrl = mode === 'legacy-loopback'
    ? endpointBase(endpoint)
    : logical.origin;

  return Object.freeze({
    ok: true,
    runtimeClass,
    transportMode: mode,
    originContinuity,
    fragmentPolicy: FRAGMENT_POLICY,
    browserVisibleStartUrl,
    browserVisibleBaseUrl,
    networkOrigin: mode === 'legacy-loopback' ? endpoint.origin : logical.origin,
    logicalOrigin: logical.origin,
    proxyServer: mode === 'origin-preserving-proxy' ? endpointValue : null,
  });
}
