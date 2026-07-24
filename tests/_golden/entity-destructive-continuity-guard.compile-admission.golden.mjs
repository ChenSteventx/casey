#!/usr/bin/env node
// 冻结黄金标准（C3 · compile 期破坏性目标连续性【浏览器前】结构准入 · hermetic 对抗自证）：
// Steven 2026-07-24 (A) 裁定——compile 真执行破坏/定向原子【之前】加连续性守卫准入，缺身份通道核实即 fail-closed。
// 走真生产码路径：spawn 真 bin/compile.mjs + CASEY_LAUNCH_SENTINEL，零真机 / 零浏览器 / 零 fake-SUT。
//   哨兵机制（compile.mjs :298）：控制流到达 launch 行=写哨兵 + exit 66；浏览器前门先 fire=exit 65 + 哨兵缺席。
//   故「哨兵缺席」是「守卫在浏览器前拦、控制流未越执行点」的强证（非「产物缺席」那种可被先启后退门绕过的弱证）。
// P1 channel-less 破坏 flow（剖面无 workflows 身份通道）→ exit 65 + 哨兵缺席（channel-less 恒拒、浏览器前拦真删）。
// P2 声明良构 workflows 身份通道的同一破坏 flow → exit 66 + 哨兵在场（准入放行、到达 launch 点，不误拒合法声明）。
// P3 non-destructive flow（无破坏原子）→ exit 66 + 哨兵在场（守卫只拦破坏原子，不误破普通编译流）。
// 归因口径（codex round-5 High 过度归因收口，本金牌绝不 over-claim）：本金牌只证【编译期 Critical 的 fail-open
//   半边——channel-less 破坏放行——已 fail-closed 关死】。P2 只证形状良构的 workflows 声明能过【结构】准入到达 launch
//   点，【不】证身份通道真可用、观察 kind 相符、或 ref 被出站请求消费；故【绝不背书「合法真删 proceed」】。ref 消费 /
//   出站 platformId 核验半边（合法真删的目标核对）本质需真机 page.route，route:human 未闭（见 PRD observability 与
//   checksumAmendments）。
// 先红（本文件不 stash 生产码，红先行证据入 accept/red-baselines）：OLD 码无守卫时 P1 会变 exit 66 + 哨兵在场
//   （证 channel-less 破坏流会越 launch 点真启浏览器 → 编译期同名误删 fail-open）。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { requiredFlowEntityBindings, hashIdentityAdmissionBytes, calculateIdentityAdmissionSignature } from '../../lib/entity-semantic-lock-preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const CASE_ID = 'tc_compile_destadmit';
const DUMMY_SUT = 'http://127.0.0.1:9/'; // 从不真连——哨兵在 chromium.launch 之前 exit 66/65
const tmp = mkdtempSync(join(tmpdir(), 'casey-destadmit-'));

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
function run(args, opts = {}) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, ...opts }); }

// ---------- 合成输入 ----------
const TESTCASE = {
  schemaVersion: 1, caseId: CASE_ID, channel: 'web', uniquePrefix: 'atl_',
  preconditions: ['已登录'],
  intents: [
    { intentId: 'intent_create', text: '新增工作流：名称 atl_{{uniqueName}}、分类 测试分类' },
    { intentId: 'intent_canvas', text: '确认新增后进入画布页（断言意图留痕）' },
    { intentId: 'intent_save', text: '保存工作流' },
    { intentId: 'intent_toast', text: '保存后无错误提示弹窗（断言意图留痕）' },
    { intentId: 'intent_cleanup', text: '按名称 atl_{{uniqueName}} 删除清理（唯一名纪律）' },
  ],
};
const SUBJECT = (sourceIntentId) => ({ sourceIntentId, entityBindings: [{ candidateId: 'candidate-wf-main', role: 'subject' }] });
const FLOW_GOOD_STEPS = [
  { atom: 'workflow.create', params: { name: 'atl_{{uniqueName}}', category: '测试分类' }, ...SUBJECT('intent_create') },
  { atom: 'assert.onPage', params: { urlIncludes: '/process/detail' }, ...SUBJECT('intent_canvas') },
  { atom: 'workflow.save', params: {}, ...SUBJECT('intent_save') },
  { atom: 'assert.noErrorToast', params: {}, ...SUBJECT('intent_toast') },
];
const FLOW_WITH_DELETE = { id: CASE_ID, name: '编译冒烟', category: 'normal', steps: [...FLOW_GOOD_STEPS, { atom: 'workflow.deleteByName', params: { name: 'atl_{{uniqueName}}' }, ...SUBJECT('intent_cleanup') }] };
const FLOW_NO_DELETE = { id: CASE_ID, name: '编译冒烟', category: 'normal', steps: FLOW_GOOD_STEPS };

const tcFile = join(tmp, 'testcase.json');
writeFileSync(tcFile, JSON.stringify(TESTCASE));
const CHANNEL_LESS = join(tmp, 'profile.channelless.json');
writeFileSync(CHANNEL_LESS, JSON.stringify({ background: ['/api/auths/poll'], successField: 'status', successValue: 200 }));
const WITH_WF_CHANNEL = join(tmp, 'profile.wfchannel.json');
writeFileSync(WITH_WF_CHANNEL, JSON.stringify({
  background: ['/api/auths/poll'], successField: 'status', successValue: 200,
  workflows: {
    listApi: { pathname: '/api/process/list', method: 'POST', recordsPath: 'data.records', totalPath: 'data.total', queryParam: 'name', fields: { id: 'id', code: 'code', name: 'name' } },
    itemContainer: '.wf-list tr', cardFields: { name: '.wf-name', code: '.wf-code' },
  },
}));
function writeFlow(obj, name) { const f = join(tmp, name); writeFileSync(f, JSON.stringify(obj)); return f; }

// ---------- 准入信任锚：临时 loop/prd-<caseId>.json（wx 独占创建，owner 标识校验后清理） ----------
const SCRATCH_ROOT = join(ROOT, `.golden-scratch-destadmit-${randomUUID().slice(0, 8)}`);
const TEMP_PRD = join(ROOT, 'loop', `prd-${CASE_ID}.json`);
const OWNER_TOKEN = randomUUID();
let prdOwned = false;
let authoritySeq = 0;
function ensureTempPrd() {
  if (prdOwned) return;
  writeFileSync(TEMP_PRD, JSON.stringify({
    schemaVersion: 1, caseId: CASE_ID,
    task: `compile-admission golden 临时准入信任锚（owner ${OWNER_TOKEN}；运行末+退出钩子清理；残留=上轮异常退出，wx fail-closed 报错不自动删）`,
    testChecksums: {}, stories: [],
  }, null, 2) + '\n', { flag: 'wx' });
  prdOwned = true;
}
function registerChecksum(artifactKey, text) {
  ensureTempPrd();
  const prd = JSON.parse(readFileSync(TEMP_PRD, 'utf8'));
  prd.testChecksums[artifactKey] = createHash('sha256').update(text).digest('hex');
  writeFileSync(TEMP_PRD, JSON.stringify(prd, null, 2) + '\n');
}
function cleanupAdmissionScaffold() {
  rmSync(SCRATCH_ROOT, { recursive: true, force: true });
  if (!prdOwned) return;
  try {
    const cur = JSON.parse(readFileSync(TEMP_PRD, 'utf8'));
    if (String(cur.task || '').includes(OWNER_TOKEN)) rmSync(TEMP_PRD, { force: true });
  } catch { /* 读不出所有权就不删（fail-closed） */ }
  prdOwned = false;
}
process.on('exit', cleanupAdmissionScaffold);

function mintExecuteAuthority(flowFile) {
  authoritySeq += 1;
  const flowBytes = readFileSync(flowFile);
  const tcBytes = readFileSync(tcFile);
  const doc = JSON.parse(flowBytes.toString('utf8'));
  const bindings = requiredFlowEntityBindings(doc.flow);
  if (!Array.isArray(bindings) || !bindings.length) throw new Error(`铸权失败：flow 闭合绑定集投影为空（${bindings && bindings.reason}）`);
  const artifact = {
    schemaVersion: 1, artifactKind: 'entity-pre-execution-authority', authorizedFor: 'compile-execute',
    caseId: CASE_ID, signed: true, signerId: 'golden-human', signedAt: '2026-07-22T00:00:00.000Z', audience: 'test',
    flowSha256: hashIdentityAdmissionBytes(flowBytes), testcaseSha256: hashIdentityAdmissionBytes(tcBytes),
    bindings: bindings.map((b) => ({ ...b })),
  };
  artifact.signature = calculateIdentityAdmissionSignature(artifact);
  const text = JSON.stringify(artifact, null, 2) + '\n';
  mkdirSync(SCRATCH_ROOT, { recursive: true });
  const rel = `${basename(SCRATCH_ROOT)}/execute-authority-${authoritySeq}.json`;
  writeFileSync(join(ROOT, rel), text);
  registerChecksum(rel, text);
  return rel;
}

// 过闸产 canonical flow-<caseId>.json + confirm + 铸权，返回 { dir, authRel }。
function prepareExecuteDir(flowObj, label) {
  const dir = join(tmp, label);
  mkdirSync(dir, { recursive: true });
  const g = run([CASEY, 'compile', CASE_ID, '--testcase', tcFile, '--flow', writeFlow(flowObj, `${label}.flow.json`), '--out-dir', dir]);
  if (g.status !== 0) throw new Error(`过闸应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
  const flowFile = join(dir, `flow-${CASE_ID}.json`);
  const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
  flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-02T00:00:00.000Z';
  writeFileSync(flowFile, JSON.stringify(flow, null, 2));
  return { dir, authRel: mintExecuteAuthority(flowFile) };
}

// sentinel 注入下真跑 compile --execute，返回 { status, sentinelWritten }。
function execWithSentinel(dir, authRel, profFile, unique) {
  const sentinel = join(dir, 'launch.sentinel');
  rmSync(sentinel, { force: true });
  const e = run(
    [CASEY, 'compile', CASE_ID, '--execute', '--testcase', tcFile, '--sut', DUMMY_SUT, '--out-dir', dir, '--profile', profFile, '--skip-login', '--unique-name', unique, '--entity-authority', authRel],
    { env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel } },
  );
  return { status: e.status, sentinelWritten: existsSync(sentinel), stderr: e.stderr || '', stdout: e.stdout || '' };
}

// ---------- P1：channel-less 破坏 flow → exit 65 + 哨兵缺席（守卫浏览器前拦真删） ----------
check('P1 channel-less 破坏 flow 浏览器前拒（exit 65 + 哨兵缺席）', () => {
  const { dir, authRel } = prepareExecuteDir(FLOW_WITH_DELETE, 'p1-del');
  const r = execWithSentinel(dir, authRel, CHANNEL_LESS, 'p1');
  if (r.status !== 65) throw new Error(`channel-less 破坏 flow 应 exit 65（fail-closed），实际 ${r.status}：${(r.stderr).slice(-300)}`);
  if (r.sentinelWritten) throw new Error('哨兵不得写入：exit 65 时控制流不得越过 launch 行（守卫必须在浏览器前拦）');
  if (!/COMPILE_DESTRUCTIVE_NO_IDENTITY_CHANNEL/.test(r.stderr)) throw new Error(`红因须点名 COMPILE_DESTRUCTIVE_NO_IDENTITY_CHANNEL，实际 stderr：${r.stderr.slice(-300)}`);
  if (!/workflow\.deleteByName/.test(r.stderr)) throw new Error('红因须点名被拒的破坏原子 workflow.deleteByName');
  if (existsSync(join(dir, 'events.json'))) throw new Error('浏览器前拒不得产 events.json');
});

// ---------- P2：声明 workflows 身份通道 → exit 66 + 哨兵在场（不误拒合法声明） ----------
check('P2 声明 workflows 通道的破坏 flow 过准入达 launch 点（exit 66 + 哨兵在场）', () => {
  const { dir, authRel } = prepareExecuteDir(FLOW_WITH_DELETE, 'p2-del');
  const r = execWithSentinel(dir, authRel, WITH_WF_CHANNEL, 'p2');
  if (r.status !== 66) throw new Error(`声明 workflows 通道应过准入达 launch 点 exit 66，实际 ${r.status}：${(r.stderr).slice(-300)}`);
  if (!r.sentinelWritten) throw new Error('哨兵须写入：准入放行后控制流须到达 launch 行（证守卫不 always-refuse、不误拒合法声明）');
});

// ---------- P3：non-destructive flow → exit 66 + 哨兵在场（守卫不误破普通编译流） ----------
check('P3 无破坏原子的 flow 不被守卫误拦（exit 66 + 哨兵在场）', () => {
  const { dir, authRel } = prepareExecuteDir(FLOW_NO_DELETE, 'p3-nodel');
  const r = execWithSentinel(dir, authRel, CHANNEL_LESS, 'p3');
  if (r.status !== 66) throw new Error(`无破坏原子的 flow（即便 channel-less）应过准入达 launch 点 exit 66，实际 ${r.status}：${(r.stderr).slice(-300)}`);
  if (!r.sentinelWritten) throw new Error('哨兵须写入：无破坏原子时守卫不得拦（channel-less 剖面对普通编译流零行为差）');
});

cleanupAdmissionScaffold();

if (fails.length) {
  for (const f of fails) console.error(`RED  compile-admission: ${f}`);
  console.error(`RED  compile-admission: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   compile-admission: ${pass}/${pass} 全过（P1 channel-less 破坏拒 + 哨兵缺席 / P2 声明通道放行达 launch / P3 无破坏原子不误拦）`);
process.exit(0);
