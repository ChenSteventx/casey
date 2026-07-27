// Shared CLI wiring. Inputs are already-loaded in-memory configuration values.

import { resolveExecutionTarget } from './authority.mjs';
import { projectExecutionTargetRuntime } from './runtime.mjs';

export function isValidLogicalTarget(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return false;
  try {
    const target = new URL(value);
    return ['http:', 'https:'].includes(target.protocol)
      && !target.username
      && !target.password
      && Boolean(target.hostname);
  } catch {
    return false;
  }
}

export function classifyLogicalTargetShape(value) {
  const valid = isValidLogicalTarget(value);
  return Object.freeze({
    hasLogicalTarget: valid,
    shapeOk: valid,
  });
}

export function detectExecutionRuntime({
  platform = process.platform,
  env = process.env,
} = {}) {
  const isWSL = platform === 'linux'
    && Boolean(env?.WSL_DISTRO_NAME || env?.WSL_INTEROP);
  return Object.freeze({ platform, isWSL });
}

function configuredMode(target) {
  const explicit = target?.transportMode ?? target?.transport?.mode;
  if (explicit !== undefined) return explicit;
  return 'direct';
}

export function buildExecutionTargetRequest({
  site,
  cliSut,
  runtime = detectExecutionRuntime(),
  requiresOriginContinuity = true,
} = {}) {
  const target = site?.target && typeof site.target === 'object' ? site.target : {};
  const mode = configuredMode(target);
  const startUrl = typeof target.startUrl === 'string' && target.startUrl
    ? target.startUrl
    : (runtime.isWSL ? cliSut : undefined);
  const configuredEndpoint = target.transportEndpoint
    ?? target.transport?.endpoint
    ?? target.devProxyUrl;
  const endpoint = mode === 'direct'
    ? undefined
    : (configuredEndpoint || cliSut);
  return {
    runtime,
    logicalTarget: { startUrl },
    transport: { mode, ...(endpoint === undefined ? {} : { endpoint }) },
    requiresOriginContinuity,
  };
}

export function resolveCliExecutionTarget(options = {}) {
  const runtime = options.runtime ?? detectExecutionRuntime();
  const target = options.site?.target;
  const hasCanonicalTarget = typeof target?.startUrl === 'string'
    && target.startUrl.trim() !== '';
  if (!runtime.isWSL && !hasCanonicalTarget) {
    return Object.freeze({ ok: false, reason: 'LOGICAL_TARGET_REQUIRED' });
  }
  const request = buildExecutionTargetRequest({ ...options, runtime });
  const resolved = resolveExecutionTarget(request);
  if (!resolved.ok) return resolved;
  const projectedRuntime = projectExecutionTargetRuntime(resolved.authority);
  if (!projectedRuntime) return Object.freeze({
    ok: false,
    reason: 'EXECUTION_TARGET_AUTHORITY_INVALID',
  });
  return Object.freeze({ ...resolved, runtime: projectedRuntime });
}

export function playwrightLaunchOptions(runtime, baseOptions = {}) {
  if (!runtime?.proxyServer) return { ...baseOptions };
  return {
    ...baseOptions,
    proxy: { server: runtime.proxyServer },
  };
}

// Doctor consumes shape only, never target values.
export function classifyExecutionTargetShape({
  platform,
  isWSL,
  hasLogicalTarget,
  hasLoopbackTransport,
  configuredMode: explicitMode,
} = {}) {
  const runtime = platform === 'win32'
    ? 'windows'
    : platform === 'darwin'
      ? 'macos'
      : platform === 'linux' && isWSL
        ? 'wsl'
        : platform === 'linux'
          ? 'linux'
          : 'unsupported';
  const mode = explicitMode
    || 'direct';
  const modeKnown = ['direct', 'legacy-loopback', 'origin-preserving-proxy'].includes(mode);
  const mismatch = mode === 'legacy-loopback' && runtime !== 'wsl';
  return Object.freeze({
    runtimeClass: runtime,
    transportMode: modeKnown ? mode : 'invalid',
    originContinuity: mode === 'legacy-loopback' ? 'degraded' : 'preserved',
    ready: runtime !== 'unsupported' && modeKnown && !mismatch && Boolean(hasLogicalTarget),
  });
}
