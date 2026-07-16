#!/usr/bin/env node
// 反向隧道共享配置入口。真目标与站点文件路径只在进程内存中使用；对外错误永远是固定码。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..');
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function fail(code) {
  throw new Error(code);
}

function parseUrl(value, code) {
  if (typeof value !== 'string' || value.length === 0) fail(code);
  try {
    return new URL(value);
  } catch {
    fail(code);
  }
}

/**
 * 读取并校验 site.json 的隧道所需最小投影。
 * 返回值含真目标，仅供代理进程内消费；调用方不得序列化整个返回值。
 */
export function readTunnelConfig({ sitePath, env = process.env } = {}) {
  const source = sitePath || env?.AT_SITE_JSON || join(PROJECT_ROOT, 'site.json');
  let raw;
  try {
    raw = readFileSync(source, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    fail('TUNNEL_SITE_UNREADABLE');
  }

  let site;
  try {
    site = JSON.parse(raw);
  } catch {
    fail('TUNNEL_SITE_INVALID_JSON');
  }

  const shape = site && typeof site === 'object' && !Array.isArray(site)
    && site.target && typeof site.target === 'object' && !Array.isArray(site.target);
  if (!shape) fail('TUNNEL_SITE_INVALID_SHAPE');

  const target = parseUrl(site.target.startUrl, 'TUNNEL_TARGET_INVALID');
  if (target.protocol !== 'http:' && target.protocol !== 'https:') fail('TUNNEL_TARGET_SCHEME');
  if (target.username || target.password) fail('TUNNEL_TARGET_EMBEDDED_CREDENTIALS');
  if (!target.hostname) fail('TUNNEL_TARGET_INVALID');

  const proxy = parseUrl(site.target.devProxyUrl, 'TUNNEL_PROXY_INVALID');
  if (proxy.protocol !== 'http:') fail('TUNNEL_PROXY_SCHEME');
  if (proxy.username || proxy.password) fail('TUNNEL_PROXY_EMBEDDED_CREDENTIALS');
  if (!LOOPBACK_HOSTS.has(proxy.hostname.toLowerCase())) fail('TUNNEL_PROXY_NOT_LOOPBACK');
  if (!proxy.port) fail('TUNNEL_PROXY_PORT_REQUIRED');
  if ((proxy.pathname && proxy.pathname !== '/') || proxy.search || proxy.hash) fail('TUNNEL_PROXY_INVALID_BASE');

  const clientPort = Number(proxy.port);
  if (!Number.isInteger(clientPort) || clientPort < 1024 || clientPort >= 65535) fail('TUNNEL_PROXY_PORT_INVALID');
  const tunnelPort = clientPort + 1;

  return {
    target,
    clientPort,
    tunnelPort,
    hostHeader: target.host,
  };
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(process.argv[1]).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMain()) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--runtime') fail('TUNNEL_USAGE');
    const { clientPort, tunnelPort } = readTunnelConfig();
    process.stdout.write(`${JSON.stringify({ clientPort, tunnelPort })}\n`);
  } catch (error) {
    const code = /^TUNNEL_[A-Z0-9_]+$/.test(String(error?.message || ''))
      ? error.message
      : 'TUNNEL_CONFIG_FAILURE';
    process.stderr.write(`${code}\n`);
    process.exitCode = 64;
  }
}
