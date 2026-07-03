#!/usr/bin/env node
// 冻结黄金标准（cred-route-mask · hermetic）：凭据路由名源头打码（Steven 拍板，护栏 #7 门零弱化）。
// 真机误伤实证驱动：发送期路由 /ai-manager/auths/getTempTokenForApi 字面含 token，门 fail-closed 拒写 observed。
// 红先行：maskCredentialRoute 未建 → import 即抛。改本文件 = Test Ratchet 判红。
import { maskCredentialRoute, credentialGate } from '../../lib/cred-gate.mjs';

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-300)}`); }
}

check('U1 命中段替换（真机误伤原型）', () => {
  const m = maskCredentialRoute('/ai-manager/auths/getTempTokenForApi');
  if (m !== '/ai-manager/auths/<redacted:cred-route>') throw new Error(`应打码末段，实际 ${m}`);
});

check('U2 干净路径原样 + 大小写不敏感 + 完整 URL 形态', () => {
  const clean = maskCredentialRoute('/heren/aimanagement/process/list');
  if (clean !== '/heren/aimanagement/process/list') throw new Error(`干净路径应原样，实际 ${clean}`);
  const upper = maskCredentialRoute('/x/RefreshTOKEN/y');
  if (upper !== '/x/<redacted:cred-route>/y') throw new Error(`大小写不敏感应打码，实际 ${upper}`);
  const full = maskCredentialRoute('http://127.0.0.1:1234/auths/getTempTokenForApi?q=1');
  if (full !== 'http://127.0.0.1:1234/auths/<redacted:cred-route>?q=1') throw new Error(`完整 URL 应只打码路径段、query 原样（携凭据仍由门拦），实际 ${full}`);
  const stream = maskCredentialRoute('/api/llm/streamReply?sessionId=atl_sess_1');
  if (stream !== '/api/llm/streamReply?sessionId=atl_sess_1') throw new Error(`无关键词路由零行为差，实际 ${stream}`);
});

check('U3 门配对：打码后过门、原样被拦（门零弱化的机器证明）', () => {
  const raw = JSON.stringify({ requestLog: [{ url: '/ai-manager/auths/getTempTokenForApi', status: 200 }] });
  const rawGate = credentialGate({ 'observed.json': raw });
  if (rawGate.ok !== false) throw new Error('原始路由名应被门拦（门保持全严）');
  const masked = JSON.stringify({ requestLog: [{ url: maskCredentialRoute('/ai-manager/auths/getTempTokenForApi'), status: 200 }] });
  const maskedGate = credentialGate({ 'observed.json': masked });
  if (maskedGate.ok !== true) throw new Error(`打码后应过门，实际 ${JSON.stringify(maskedGate)}`);
});

if (fails.length) {
  for (const f of fails) console.error(`RED  cred-route-mask: ${f}`);
  console.error(`RED  cred-route-mask: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   cred-route-mask: ${pass}/${pass} 全过（命中段替换 + 零行为差 + 门配对）`);
process.exit(0);
