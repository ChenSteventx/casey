// wf-open-smoke.golden.mjs —— 飞轮第五条只读暖场（wf-open-smoke，direct）红金牌。实现前红：
// 两原子无编译知识（C1/C2 exit 65「暂无编译知识」）、夹具行名不可点。决策 docs/plans/wf-open-smoke/proposed/GRILL.md。
// C1 两原子可编译+集恰 14；C2 compile 全程 events/observed/assertionAtoms 钉死；C3 mini 端到端 verdict 全 PASS；
// C4 只读钉死（动作 ⊆ nav/click、零破坏原子）。真机四停站 route:human（prd observability）。
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-wf-open-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const CASE_ID = 'tc_wf_open_smoke';
const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读打开、零建删）
const TESTCASE = writeJson(join(tmp, 'testcase.json'), {
  schemaVersion: 1, caseId: CASE_ID, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
  intents: [{ intentId: 'intent_nav', text: '进入工作流管理列表' }, { intentId: 'intent_open', text: `点开工作流 ${OPEN_NAME} 详情` }],
});
const FLOW = writeJson(join(tmp, 'flow.json'), {
  id: CASE_ID, name: '工作流详情只读打开', category: 'normal',
  steps: [
    { atom: 'nav.workflowManagement', params: {} },
    { atom: 'workflow.open', params: { openName: OPEN_NAME } },
    { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
    { atom: 'assert.buttonState', params: { name: '保存', state: 'present' } }, // 详情页可供性在场（fake-sut 详情 = 保存钮，无标题文案）
    // 身份闭环（codex R1-F2）：详情页渲染被打开名——值取去前缀子串（textVisible 子串可见语义；
    // atl_ 裸字面量被冻结 lint 禁、真机用例同样须以非前缀段断身份——plan-debt-sweep F3 误伤挂账实证）。
    { atom: 'assert.textVisible', params: { text: '目录CRUD_a' } },
  ],
});
const PROFILE = writeJson(join(tmp, 'profile.json'), { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 });
const outDir = join(tmp, 'compile');
const eventsFile = join(outDir, 'events.json');
const observedFile = join(outDir, `observed-${CASE_ID}.json`);
const reportFile = join(outDir, 'compile-report.json');

// ---------- C1 两原子可编译 + 集恰 14 ----------
await checkAsync('C1 nav.workflowManagement/workflow.open 可编译；COMPILE_KNOWN_ATOMS 恰 14', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  for (const a of ['nav.workflowManagement', 'workflow.open']) if (!ca.isCompilableAtom(a)) throw new Error(`${a} 应可编译（本契约加法）`);
  if (ca.COMPILE_KNOWN_ATOMS.size !== 14) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 14（13+1），实际 ${ca.COMPILE_KNOWN_ATOMS.size}`);
});

// ---------- C2 compile 全程（fake-sut happy） ----------
const sut = await startFakeSut({ scenario: 'happy' });
try {
  await checkAsync('C2 compile 全程：events [nav,click] 钉死、observed 尾步落详情、assertionAtoms 两条挂 intent_1', async () => {
    const g = run([CASEY, 'compile', CASE_ID, '--testcase', TESTCASE, '--flow', FLOW, '--out-dir', outDir]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const flowDoc = readJson(join(outDir, `flow-${CASE_ID}.json`));
    flowDoc.confirmedBy = 'golden-human'; flowDoc.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(outDir, `flow-${CASE_ID}.json`), flowDoc);
    const x = run([CASEY, 'compile', CASE_ID, '--execute', '--testcase', TESTCASE, '--sut', sut.url, '--out-dir', outDir, '--profile', PROFILE, '--skip-login', '--unique-name', 'o1']);
    if (x.status !== 0) throw new Error(`execute 应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-300)}`);
    const ev = readJson(eventsFile);
    const seq = ev.events.map((e) => ({ intentId: e.intentId, action: e.action }));
    if (!deepEq(seq, [{ intentId: 'intent_0', action: 'nav' }, { intentId: 'intent_1', action: 'click' }])) throw new Error(`events 应恰 [nav(intent_0), click(intent_1)]，实际 ${JSON.stringify(seq)}`);
    const obs = readJson(observedFile);
    const last = obs.steps[obs.steps.length - 1];
    if (last.urlPathnameAfter !== '/ai-manager/process/detail') throw new Error(`尾步应落详情路由，实际 ${last.urlPathnameAfter}`);
    const atoms = readJson(reportFile).handoff.assertionAtoms;
    if (!deepEq(atoms, [
      { intentId: 'intent_1', atom: 'assert.onPage', params: { urlIncludes: '/process/detail' } },
      { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '保存', state: 'present' } },
      { intentId: 'intent_1', atom: 'assert.textVisible', params: { text: '目录CRUD_a' } },
    ])) throw new Error(`assertionAtoms 断链：${JSON.stringify(atoms)}`);
  });

  // ---------- C3 mini 端到端：draft(+patch)→sign→run→verdict 全 PASS ----------
  await checkAsync('C3 mini 端到端：draft+patch→sign→casey run→verdict 恰 2 intent 全 PASS + 报告在场', async () => {
    const draftFile = join(outDir, `expected.draft-${CASE_ID}.json`);
    const patch = writeJson(join(tmp, 'patch.json'), [
      { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list' }, // nav 步补硬断言防 INDETERMINATE（e2e-chain 先例）
    ]);
    const d = run([CASEY, 'draft', CASE_ID, '--observed', observedFile, '--compile-report', reportFile, '--out-dir', outDir, '--patch', patch]);
    if (d.status !== 0) throw new Error(`draft 应 exit 0，实际 ${d.status}：${(d.stderr || '').slice(-200)}`);
    if ((readJson(draftFile).pending || []).length) throw new Error('pending 应空（两 assert 原子均已实现 kind）');
    const prdFixture = writeJson(join(tmp, 'prd.json'), { schemaVersion: 2, caseId: CASE_ID, task: 'wf-open-smoke hermetic 夹具', testChecksums: {}, stories: [] });
    const frozen = join(outDir, 'expected.frozen.json');
    const s = run([CASEY, 'sign', CASE_ID, '--draft', draftFile, '--prd', prdFixture, '--frozen-out', frozen, '--signer', 'qa.hermetic', '--against-build', 'hermetic-b0', '--signed-at', '2026-07-07T00:00:00.000Z']);
    if (s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${s.status}：${(s.stderr || '').slice(-200)}`);
    const runDir = join(tmp, 'run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', sut.url, '--events', eventsFile, '--expected', frozen, '--profile', PROFILE, '--run-dir', runDir], 180000);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${((r.stderr || '') + (r.stdout || '')).slice(-300)}`);
    const verdict = readJson(join(runDir, 'verdict.json'));
    if (!deepEq(verdict.steps.map((s2) => s2.intentId).sort(), ['intent_0', 'intent_1'])) throw new Error(`verdict intent 集应恰 [intent_0,intent_1]，实际 ${JSON.stringify(verdict.steps.map((s2) => s2.intentId))}`);
    const bad = verdict.steps.filter((s2) => s2.verdict !== 'PASS');
    if (bad.length) throw new Error(`应全 PASS，败者 ${JSON.stringify(bad.map((s2) => ({ intentId: s2.intentId, verdict: s2.verdict, reason: s2.reason })))}`);
    if (!existsSync(join(runDir, `${CASE_ID}.report.html`))) throw new Error('缺报告 html');
  });

  // ---------- C5 容器归属闸（codex R1-F1）：同名非行控件碰撞 → 编译期 fail-closed 不点 ----------
  await checkAsync('C5 容器闸：openName 撞列表页非行控件（新增工作流钮）→ execute 阻断零 events、点名容器外', async () => {
    const tc2 = writeJson(join(tmp, 'testcase-c5.json'), {
      schemaVersion: 1, caseId: 'tc_wf_open_clash', channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
      intents: [{ intentId: 'intent_nav', text: '进列表' }, { intentId: 'intent_open', text: '点开（碰撞名）' }],
    });
    const flow2 = writeJson(join(tmp, 'flow-c5.json'), {
      id: 'tc_wf_open_clash', name: '容器闸碰撞考场', category: 'normal',
      steps: [
        { atom: 'nav.workflowManagement', params: {} },
        { atom: 'workflow.open', params: { openName: '新增工作流' } }, // 全页 text-exact 唯一命中，但是按钮非行/卡记录
      ],
    });
    const od2 = join(tmp, 'compile-c5');
    const g = run([CASEY, 'compile', 'tc_wf_open_clash', '--testcase', tc2, '--flow', flow2, '--out-dir', od2]);
    if (g.status !== 0) throw new Error(`gate 段应 exit 0，实际 ${g.status}`);
    const fd = readJson(join(od2, 'flow-tc_wf_open_clash.json'));
    fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-07T00:00:00.000Z';
    writeJson(join(od2, 'flow-tc_wf_open_clash.json'), fd);
    const x = run([CASEY, 'compile', 'tc_wf_open_clash', '--execute', '--testcase', tc2, '--sut', sut.url, '--out-dir', od2, '--profile', PROFILE, '--skip-login', '--unique-name', 'o2']);
    if (x.status !== 65) throw new Error(`容器外命中应硬阻断 exit 65（fail-closed 不点），实际 ${x.status}`);
    if (existsSync(join(od2, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od2, 'compile-report.json'));
    if (!JSON.stringify(rep.blockers || []).includes('容器')) throw new Error(`blockers 应点名容器外命中，实际 ${JSON.stringify(rep.blockers)}`);
  });

  // ---------- C4 只读钉死 ----------
  await checkAsync('C4 只读：events 动作 ⊆ {nav,click}、原子集零破坏性原子', async () => {
    const ev = readJson(eventsFile);
    for (const e of ev.events) if (!['nav', 'click'].includes(e.action)) throw new Error(`只读流不得有 ${e.action} 动作`);
    const atoms = new Set(ev.events.map((e) => e.atom));
    for (const a of atoms) if (/create|delete|save|publish/i.test(a)) throw new Error(`只读流不得含破坏性原子 ${a}`);
  });
} finally {
  await sut.close();
}

console.log(`wf-open-smoke golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
