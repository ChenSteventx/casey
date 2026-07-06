// plan-debt-sweep.golden.mjs —— 计划欠账小清洗四件（plan-debt-sweep，full）红金牌。
// 实现前红：C1 versioned 场景不存在且 compile 恒 null；C2 sign 无冻结期字面量 lint；C3 CONTEXT 词条仍失配；
// C4 设计文档无勘误表。四件欠账源自 2026-07-07 审计（capturedAgainstBuild 是 Steven 2026-07-02 决议⑥的接线兑现）。
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-debt-sweep-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
function run(args, env) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, env: env ? { ...process.env, ...env } : process.env }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };

// ── C1 提取双向：compile --execute 全程（gate→confirm→execute），复刻 p3 金牌流程 ──
const SITE_FILE = writeJson(join(tmp, 'site.synthetic.json'), {});
const ENV = { AT_SITE_JSON: SITE_FILE };
const TESTCASE = writeJson(join(tmp, 'testcase.json'), {
  schemaVersion: 1, caseId: 'tc_debt_sweep', channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
  intents: [{ intentId: 'intent_create', text: '新增工作流' }, { intentId: 'intent_save', text: '保存' }],
});
const FLOW = writeJson(join(tmp, 'flow.json'), {
  id: 'tc_debt_sweep', name: '欠账清洗冒烟', category: 'normal',
  steps: [
    { atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' } },
    { atom: 'workflow.save', params: {} },
  ],
});
const PROFILE = writeJson(join(tmp, 'profile.json'), { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 });
async function compileAgainst(scenario, outDir) {
  const sut = await startFakeSut({ scenario });
  try {
    const g = run([CASEY, 'compile', 'tc_debt_sweep', '--testcase', TESTCASE, '--flow', FLOW, '--out-dir', outDir], ENV);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const flowDoc = readJson(join(outDir, 'flow-tc_debt_sweep.json'));
    flowDoc.confirmedBy = 'golden-human'; flowDoc.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(outDir, 'flow-tc_debt_sweep.json'), flowDoc);
    const x = run([CASEY, 'compile', 'tc_debt_sweep', '--execute', '--testcase', TESTCASE, '--sut', sut.url, '--out-dir', outDir, '--profile', PROFILE, '--skip-login', '--unique-name', 'd1'], ENV);
    if (x.status !== 0) throw new Error(`execute 应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-300)}`);
    return readJson(join(outDir, 'observed-tc_debt_sweep.json'));
  } finally { await sut.close(); }
}
await checkAsync('C1 capturedAgainstBuild 双向：versioned 提取 9.9.9-test / happy 照旧 null（fail-safe 不变）', async () => {
  const obs1 = await compileAgainst('versioned', join(tmp, 'c1v'));
  if (obs1.capturedAgainstBuild !== '9.9.9-test') throw new Error(`versioned 应提取 9.9.9-test，实际 ${JSON.stringify(obs1.capturedAgainstBuild)}`);
  const obs2 = await compileAgainst('happy', join(tmp, 'c1h'));
  if (obs2.capturedAgainstBuild !== null) throw new Error(`happy 无 ?v= 应照旧 null，实际 ${JSON.stringify(obs2.capturedAgainstBuild)}`);
});

// ── C2 冻结期易变字面量 lint（sign 门）──
await checkAsync('C2 sign 冻结期 lint：裸 atl_ 字面量 65 零落盘 / 9+ 位数字 65 / 模板形态照签', async () => {
  const mkDraft = (value, name) => writeJson(join(tmp, name), {
    caseId: 'tc_debt_sweep',
    intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value, soft: false }] }],
    globalAssertions: [], pending: [],
  });
  const mkPrd = (name) => writeJson(join(tmp, name), { schemaVersion: 2, caseId: 'tc_debt_sweep', task: '欠账清洗夹具', testChecksums: {}, stories: [] });
  const signArgs = (draft, prd, out) => [SIGN, 'tc_debt_sweep', '--draft', draft, '--prd', prd, '--frozen-out', out, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-07T00:00:00.000Z'];
  const f1 = join(tmp, 'frozen-bad1.json');
  const r1 = run(signArgs(mkDraft('创建成功 atl_wf_a', 'd-bad1.json'), mkPrd('p-bad1.json'), f1));
  if (r1.status !== 65) throw new Error(`裸 atl_ 字面量应 sign exit 65（冻结期 lint），实际 ${r1.status}`);
  if (existsSync(f1)) throw new Error('lint 拒应零落盘');
  const r2 = run(signArgs(mkDraft('单号 1234567890 已生成', 'd-bad2.json'), mkPrd('p-bad2.json'), join(tmp, 'frozen-bad2.json')));
  if (r2.status !== 65) throw new Error(`9+ 位数字长串应 sign exit 65，实际 ${r2.status}`);
  const r3 = run(signArgs(mkDraft('新增 atl_{{uniqueName}} 成功', 'd-ok.json'), mkPrd('p-ok.json'), join(tmp, 'frozen-ok.json')));
  if (r3.status !== 0) throw new Error(`模板形态应照签 exit 0，实际 ${r3.status}：${(r3.stderr || '').slice(-200)}`);
});

// ── C3 CONTEXT 词条对齐 ──
await checkAsync('C3 CONTEXT 词条：registry 全绿；verdict.json 零 passes 有 report-model 指针；trace 未建；recorder 已取代', async () => {
  const r = run([CASEY, 'lint', '--registry']);
  if (r.status !== 0) throw new Error(`term-lint --registry 应 exit 0，实际 ${r.status}`);
  const text = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8');
  const row = (name) => text.split('\n').find((l) => l.includes(`\`${name}\``) && l.startsWith('|'));
  const vj = row('verdict.json');
  if (!vj) throw new Error('CONTEXT 缺 verdict.json 词条');
  if (vj.includes('passes')) throw new Error('verdict.json 词条不得再声称含 passes（冻结实现是最小五字段）');
  if (!vj.includes('report-model')) throw new Error('verdict.json 词条应指明富信息在 report-model');
  const tr = row('trace');
  if (!tr || !tr.includes('未建')) throw new Error('trace 词条应注明未建挂账');
  const rc = text.split('\n').find((l) => l.includes('recorder-as-library') && l.startsWith('|'));
  if (!rc || !rc.includes('取代')) throw new Error('recorder-as-library 词条应标已被取代（ADR-0006）');
});

// ── C4 设计文档勘误表 ──
await checkAsync('C4 两设计文档头部含「已知偏离」对账节', async () => {
  for (const f of ['docs/design/txt2testreport-design.md', 'docs/design/report-spec.md']) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    if (!text.includes('已知偏离')) throw new Error(`${f} 缺「已知偏离」对账节`);
  }
});

console.log(`plan-debt-sweep golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
