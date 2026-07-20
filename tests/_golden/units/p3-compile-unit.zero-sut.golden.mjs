#!/usr/bin/env node
// p3-compile 的纯后继：注册表、登录配置、凭据门与删除计数谓词；不启动/连接 SUT、浏览器或 listener。
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

// sourceObligationId:hg-p3-compile-c1 unitCheckId:p3-compile-unit-c1
// lifecycle-successor: {"sourceObligationId":"hg-p3-compile-c1","unitCheckId":"p3-compile-unit-c1"}
// sourceObligationId:hg-p3-compile-c2 unitCheckId:p3-compile-unit-c2
// lifecycle-successor: {"sourceObligationId":"hg-p3-compile-c2","unitCheckId":"p3-compile-unit-c2"}
// sourceObligationId:hg-p3-compile-c3 unitCheckId:p3-compile-unit-c3
// lifecycle-successor: {"sourceObligationId":"hg-p3-compile-c3","unitCheckId":"p3-compile-unit-c3"}
// sourceObligationId:hg-p3-compile-c3b unitCheckId:p3-compile-unit-c3b
// lifecycle-successor: {"sourceObligationId":"hg-p3-compile-c3b","unitCheckId":"p3-compile-unit-c3b"}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const SNAPSHOT = join(ROOT, 'lib', 'atoms-registry.snapshot.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-p3-compile-unit-'));
const failures = [];
let passed = 0;

async function check(unitCheckId, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${unitCheckId}`);
  } catch (error) {
    failures.push(`${unitCheckId}: ${String(error?.message || error).slice(-500)}`);
  }
}

await check('p3-compile-unit-c1', () => {
  if (!existsSync(SNAPSHOT)) throw new Error('lib/atoms-registry.snapshot.json 缺席');
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  if (!snapshot.snapshotOf?.repo || !snapshot.snapshotOf?.copiedAt) throw new Error('缺 snapshotOf 溯源（repo/copiedAt）');
  const atoms = snapshot.atoms || {};
  if (Object.keys(atoms).length !== 60) throw new Error(`原子须整表 60，实际 ${Object.keys(atoms).length}`);
  for (const id of ['login', 'workflow.deleteByName', 'workflow.create', 'assert.onPage', 'workflow.save', 'assert.noErrorToast']) {
    if (!atoms[id]) throw new Error(`catalog_wf_crud 所用原子 ${id} 不在册`);
  }
  if (atoms['workflow.create'].entityNameParam !== 'name' || atoms['workflow.create'].destructive !== true) {
    throw new Error('workflow.create 须 entityNameParam=name 且 destructive');
  }
  if (atoms['workflow.deleteByName'].entityNameParam !== 'name') throw new Error('workflow.deleteByName 须 entityNameParam=name');
});

await check('p3-compile-unit-c2', async () => {
  const { DEFAULT_SITE, loadSiteConfig, loadCreds } = await import(pathToFileURL(join(ROOT, 'lib', 'login-bootstrap.mjs')).href);
  if (!DEFAULT_SITE || !loadSiteConfig || !loadCreds) throw new Error('须导出 DEFAULT_SITE/loadSiteConfig/loadCreds');
  if (DEFAULT_SITE.login.submit.name !== '登 录') throw new Error('登录按钮可访问名须保留「登 录」空格坑');
  const sitePath = join(tmp, 'site.synth.json');
  writeFileSync(sitePath, JSON.stringify({ login: { user: { name: '账号X' } }, target: { startUrl: 'http://x.invalid/' } }));
  const site = loadSiteConfig(sitePath);
  if (site.login.user.name !== '账号X') throw new Error('site.json 深合并覆盖未生效');
  if (site.login.submit.name !== '登 录') throw new Error('深合并须保留未覆盖键');
  if (site.target?.startUrl !== 'http://x.invalid/') throw new Error('顶层键须透传');
  const saved = { user: process.env.AT_CREDS_USER, pass: process.env.AT_CREDS_PASS };
  try {
    process.env.AT_CREDS_USER = 'u_synth';
    process.env.AT_CREDS_PASS = 'p_synth';
    const creds = loadCreds({ credsFile: join(tmp, 'no-such-creds.json') });
    if (creds.user !== 'u_synth' || creds.pass !== 'p_synth') throw new Error('env 覆盖须优先且不读盘');
    delete process.env.AT_CREDS_USER;
    delete process.env.AT_CREDS_PASS;
    let threw = false;
    try { loadCreds({ credsFile: join(tmp, 'no-such-creds.json') }); } catch { threw = true; }
    if (!threw) throw new Error('无 env 且缺凭据文件须抛错 fail-closed');
  } finally {
    if (saved.user == null) delete process.env.AT_CREDS_USER; else process.env.AT_CREDS_USER = saved.user;
    if (saved.pass == null) delete process.env.AT_CREDS_PASS; else process.env.AT_CREDS_PASS = saved.pass;
  }
});

await check('p3-compile-unit-c3', async () => {
  const { credentialGate, stripUrlQuery } = await import(pathToFileURL(join(ROOT, 'lib', 'cred-gate.mjs')).href);
  if (typeof credentialGate !== 'function' || typeof stripUrlQuery !== 'function') throw new Error('须导出 credentialGate 与 stripUrlQuery');
  if (stripUrlQuery('http://h.invalid/p?tok=abc#f') !== 'http://h.invalid/p') throw new Error('stripUrlQuery 须剥 query 与 hash');
  if (stripUrlQuery('/api/x?a=1&b=2') !== '/api/x') throw new Error('stripUrlQuery 须支持相对路径');
  if (stripUrlQuery('/api/x') !== '/api/x') throw new Error('无 query 须原样');
  if (credentialGate({ j: '{"note":"password=abc123"}' })?.ok !== false) throw new Error('禁字段关键词须 fail-closed { ok:false }');
  for (const keyword of ['token', 'cookie']) {
    if (credentialGate({ j: `{"note":"${keyword}=abc123"}` })?.ok !== false) throw new Error(`禁字段关键词「${keyword}」须 fail-closed`);
  }
  if (credentialGate({ j: '{"note":"干净产物"}' })?.ok !== true) throw new Error('干净产物须放行');
  const report = await import(pathToFileURL(join(ROOT, 'bin', 'report.mjs')).href);
  if (typeof report.credentialGate !== 'function') throw new Error('bin/report.mjs 须保留 credentialGate re-export（p7 冻结 golden 依赖）');
});

await check('p3-compile-unit-c3b', async () => {
  const { summarizeDeleteCountAudit } = await import(pathToFileURL(join(ROOT, 'lib', 'compile-atoms.mjs')).href);
  if (typeof summarizeDeleteCountAudit !== 'function') throw new Error('lib/compile-atoms.mjs 须导出 summarizeDeleteCountAudit');
  const table = summarizeDeleteCountAudit({ tableRows: 1, tableDeleteButtons: 1, targetCards: 0, targetCardDeleteButtons: 0, globalDeleteButtons: 1 });
  if (!table.equal || table.layout !== 'table' || table.recordContainers !== 1 || table.deleteButtons !== 1) throw new Error('表格行布局 1:1 应放行');
  const card = summarizeDeleteCountAudit({ tableRows: 0, tableDeleteButtons: 0, targetCards: 1, targetCardDeleteButtons: 1, globalDeleteButtons: 1 });
  if (!card.equal || card.layout !== 'card' || card.recordContainers !== 1 || card.deleteButtons !== 1) throw new Error('卡片布局 1:1 应放行（真机 atl_c1 形态）');
  const mismatch = summarizeDeleteCountAudit({ tableRows: 0, tableDeleteButtons: 0, targetCards: 1, targetCardDeleteButtons: 2, globalDeleteButtons: 2 });
  if (mismatch.equal || mismatch.layout !== 'card') throw new Error('卡片布局记录与删除目标不恒等时必须 fail-closed');
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`p3-compile unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`p3-compile unit: ${passed}/${passed} passed`);
