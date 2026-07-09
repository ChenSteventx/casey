#!/usr/bin/env node
// record-intake.golden.mjs —— 示教入账闸漂移锁（record-intake，full）红金牌。
// 实现前红：bin/intake.mjs 不存在、casey.mjs 无 intake 分发、help 无 casey intake。
// 锁：安全复核 8 条 fail-closed 拒账 + append-only 入账台账（accept/reject 类别码、零脏内容）+
//     accept 不产副本 + 台账全文无凭据/无 ://。happy 路径复现真 record 接缝（不另造）。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const node = process.execPath;
const cli = join(ROOT, 'bin', 'casey.mjs');

function run(args, opts = {}) {
  return spawnSync(node, [cli, ...args], { cwd: ROOT, encoding: 'utf8', ...opts });
}
function fail(msg) {
  console.error(`record-intake golden failed: ${msg}`);
  process.exit(1);
}
function assert(cond, msg) { if (!cond) fail(msg); }

// 有效示教录制包模板（手造对抗输入基线；happy 路径另用真 record 接缝产）。
function validDoc(caseId = 'tc_x') {
  return {
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId,
    createdAt: '2026-01-01T00:00:00.000Z',
    startPath: '/heren/aimanagement/process/list',
    source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
    events: [
      { seq: 1, action: 'click', path: '/heren/aimanagement/process/list', selector: 'button.new', text: '新增工作流' },
      { seq: 2, action: 'fill', path: '/heren/aimanagement/process/edit', selector: 'input[name="name"]', fieldLabel: '名称', value: 'atl_demo' },
    ],
  };
}
function writeCapture(dir, caseId, doc) {
  const p = join(dir, caseId, 'record-capture', 'teach-in-capture.json');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  return p;
}
function ledgerPathFor(capturePath) {
  return join(dirname(capturePath), 'intake-ledger.jsonl');
}
function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return [];
  return readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

const tmp = mkdtempSync(join(tmpdir(), 'casey-record-intake-'));
try {
  // ── C1 门面 + 用法错 ─────────────────────────────────────────
  const helpSrc = readFileSync(cli, 'utf8');
  assert(helpSrc.includes('casey intake'), 'help 须暴露 casey intake');

  assert(run(['intake']).status === 64, 'intake 缺 caseId 须 exit 64');
  assert(run(['intake', 'tc_x']).status === 64, 'intake 缺 --capture 须 exit 64');

  // caseId 形状违规（穿越 / 斜杠）= 预读 fail-closed 守卫 exit 65（镜像 record-capture 先例）。
  {
    const cap = writeCapture(join(tmp, 'shapeok'), 'tc_shape', validDoc('tc_shape'));
    assert(run(['intake', '../../escape', '--capture', cap]).status === 65, 'caseId ../.. 穿越须 exit 65');
    assert(run(['intake', 'a/b', '--capture', cap]).status === 65, 'caseId 含 / 须 exit 65');
  }

  // ── C2 happy：复现真 record 接缝产 capture，再 intake ───────────
  {
    const capOut = join(tmp, 'capout');
    const cleanEvents = join(tmp, 'clean-events.json');
    writeFileSync(cleanEvents, JSON.stringify({
      startUrl: 'http://127.0.0.1:15519/heren/aimanagement/process/list?tab=mine',
      events: [
        { action: 'click', url: 'http://127.0.0.1:15519/heren/aimanagement/process/list', selector: 'button.new', text: '新增工作流', tagName: 'button' },
        { action: 'fill', url: 'http://127.0.0.1:15519/heren/aimanagement/process/edit', selector: 'input[name="name"]', fieldLabel: '名称', value: 'atl_demo' },
        { action: 'press', path: '/heren/aimanagement/process/edit', key: 'Enter' },
      ],
    }, null, 2), 'utf8');
    const rec = run(['record', 'tc_intake_ok', '--sut', 'http://127.0.0.1:15519', '--out-dir', capOut, '--no-login', '--from-events', cleanEvents]);
    assert(rec.status === 0, `前置 record 应 exit 0，stderr=${rec.stderr}`);
    const capturePath = join(capOut, 'tc_intake_ok', 'record-capture', 'teach-in-capture.json');
    assert(existsSync(capturePath), '前置 record 须产 capture');

    const ok = run(['intake', 'tc_intake_ok', '--capture', capturePath]);
    assert(ok.status === 0, `干净 capture intake 应 exit 0，stderr=${ok.stderr}`);
    // 成功不回显用户 out-dir 绝对路径（output-seal 纪律）。
    assert(!ok.stdout.includes(capOut), 'accept 回显不得含 out-dir 绝对路径');

    const lp = ledgerPathFor(capturePath);
    const entries = readLedger(lp);
    assert(entries.length === 1, '一次 intake 须落一条台账');
    const e = entries[0];
    assert(e.event === 'intake' && e.intakeStatus === 'accepted', '台账须标 accepted');
    assert(e.caseId === 'tc_intake_ok', '台账 caseId 须正确');
    assert(e.eventCount === 3, `台账 eventCount 须与包一致（3），实得 ${e.eventCount}`);
    assert(e.reason === null || e.reason === undefined, 'accept 台账 reason 须空');

    // accept 不产任何副本：record-capture 目录只应有 capture + 台账两件。
    const files = readdirSync(join(capOut, 'tc_intake_ok', 'record-capture')).sort();
    assert(files.length === 2, `accept 不得产副本，实得 ${JSON.stringify(files)}`);
    assert(files.includes('teach-in-capture.json') && files.includes('intake-ledger.jsonl'), '目录须仅含 capture + 台账');
    assert(!files.includes('events.json') && !files.includes('expected.frozen.json'), 'intake 不得产正式回放产物');

    // append-only：再 intake 一次 → 两行，第一行字节不变。
    const firstLine = readFileSync(lp, 'utf8').split('\n')[0];
    run(['intake', 'tc_intake_ok', '--capture', capturePath]);
    const after = readFileSync(lp, 'utf8').split('\n').filter((l) => l.trim());
    assert(after.length === 2, '再入账须追加第二行（append-only）');
    assert(after[0] === firstLine, 'append-only：首行字节不得变');
    // 台账全文无凭据、无 ://。
    assert(!readFileSync(lp, 'utf8').includes('://'), '台账全文不得含 ://');
  }

  // ── C3 八条 fail-closed 拒账：exit 65 + 台账 reject + reason 类别码 + 无 accepted ──
  function rejectCase(tag, caseId, doc, expectReason) {
    const dir = join(tmp, `rej-${tag}`);
    const cap = writeCapture(dir, caseId, doc);
    const r = run(['intake', caseId, '--capture', cap]);
    assert(r.status === 65, `${tag} 须 exit 65，实得 ${r.status}（stderr=${r.stderr}）`);
    const entries = readLedger(ledgerPathFor(cap));
    assert(entries.length === 1, `${tag} 须落一条拒账台账`);
    assert(entries[0].intakeStatus === 'rejected', `${tag} 台账须标 rejected`);
    assert(entries[0].reason === expectReason, `${tag} reason 须 ${expectReason}，实得 ${entries[0].reason}`);
    assert(!entries.some((e) => e.intakeStatus === 'accepted'), `${tag} 不得有 accepted 事实`);
    return { cap, entries };
  }

  rejectCase('artifactkind', 'tc_ak', { ...validDoc('tc_ak'), artifactKind: 'events' }, 'ARTIFACT_KIND');
  rejectCase('signed', 'tc_sg', { ...validDoc('tc_sg'), source: { kind: 'manual', signed: true, replayReady: false, distillRequired: true } }, 'SIGNED_FLAG');
  rejectCase('replayready', 'tc_rr', { ...validDoc('tc_rr'), source: { kind: 'manual', signed: false, replayReady: true, distillRequired: true } }, 'SIGNED_FLAG');
  rejectCase('nodistill', 'tc_nd', { ...validDoc('tc_nd'), source: { kind: 'manual', signed: false, replayReady: false, distillRequired: false } }, 'SIGNED_FLAG');
  rejectCase('schemaver', 'tc_sv', { ...validDoc('tc_sv'), schemaVersion: 2 }, 'SCHEMA_VERSION');
  rejectCase('caseidmismatch', 'tc_mm', { ...validDoc('tc_other'), caseId: 'tc_other' }, 'CASEID_MISMATCH');
  rejectCase('emptyevents', 'tc_ee', { ...validDoc('tc_ee'), events: [] }, 'EMPTY_EVENTS');
  rejectCase('badaction', 'tc_ba', { ...validDoc('tc_ba'), events: [{ seq: 1, action: 'evil', path: '/x' }] }, 'DIRTY_EVENT');
  rejectCase('missingpath', 'tc_mp', { ...validDoc('tc_mp'), events: [{ seq: 1, action: 'click', selector: 'b' }] }, 'DIRTY_EVENT');
  rejectCase('embeddedscheme', 'tc_es', { ...validDoc('tc_es'), events: [{ seq: 1, action: 'click', path: '/x', text: '打开 ws://victim-host.example.com/s' }] }, 'DIRTY_EVENT');

  // C3g 凭据命中：台账条目内绝不含凭据值。
  {
    const doc = { ...validDoc('tc_cred'), events: [{ seq: 1, action: 'fill', path: '/login', selector: 'input', value: 'password=S3cr3t937' }] };
    const { cap, entries } = rejectCase('cred', 'tc_cred', doc, 'CRED_GATE_HIT');
    assert(!readFileSync(ledgerPathFor(cap), 'utf8').includes('S3cr3t937'), '拒账台账条目内绝不含凭据值');
  }

  // C3h URL 泄漏（顶层字段内嵌真 host）。
  rejectCase('urlleak', 'tc_ul', { ...validDoc('tc_ul'), startPath: 'https://victim-host.example.com/dash' }, 'URL_LEAK');

  // C4 parse 失败：坏 JSON → exit 65 + reject PARSE_ERROR。
  {
    const dir = join(tmp, 'rej-parse');
    const p = join(dir, 'tc_pe', 'record-capture', 'teach-in-capture.json');
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, '{ not json', 'utf8');
    const r = run(['intake', 'tc_pe', '--capture', p]);
    assert(r.status === 65, `坏 JSON 须 exit 65，实得 ${r.status}`);
    const entries = readLedger(ledgerPathFor(p));
    assert(entries.length === 1 && entries[0].reason === 'PARSE_ERROR', 'parse 失败须落 PARSE_ERROR 拒账');
  }

  // ── C5 异构评审加固（codex 跨族评审揪出，红先行钉死不回潮）────────────
  // F1 accept 台账绑 capture 字节 sha256（防 TOCTOU：intake 后换脏包，distill 按哈希失配即拒）。
  {
    const cap = writeCapture(join(tmp, 'sha'), 'tc_sha', validDoc('tc_sha'));
    const r = run(['intake', 'tc_sha', '--capture', cap]);
    assert(r.status === 0, `F1 clean 应 exit 0，stderr=${r.stderr}`);
    const e = readLedger(ledgerPathFor(cap))[0];
    const want = createHash('sha256').update(readFileSync(cap, 'utf8')).digest('hex');
    assert(e.captureSha256 === want, 'F1 accept 台账须记 capture 字节 sha256（供 distill 校验防换包）');
  }
  // F2 中文敏感字段未遮值须拒账（复用 record-capture SENSITIVE_FIELD_RE 单一事实源）。
  rejectCase('sensitivezh', 'tc_szh', { ...validDoc('tc_szh'), events: [{ seq: 1, action: 'fill', path: '/reset', fieldLabel: '新密码', value: 'S3cr3tPin937' }] }, 'SENSITIVE_FIELD');
  // F3 协议相对 IPv6 host 须判 URL 泄漏（旧正则 //[A-Za-z0-9.-]+ 漏 [）。
  rejectCase('ipv6', 'tc_ipv6', { ...validDoc('tc_ipv6'), startPath: '//[2001:db8::1]/admin' }, 'URL_LEAK');
  // F3b 百分号编码 :// 走私须判 URL 泄漏（hasEmbeddedScheme 覆盖 %3a%2f%2f）。
  rejectCase('pctenc', 'tc_pct', { ...validDoc('tc_pct'), startPath: '/go?u=https%3a%2f%2fvictim-host.example.com' }, 'URL_LEAK');
  // F4 caseId 类型戏法（包内 caseId 为数组）须拒 CASEID_MISMATCH（严格类型+相等，非 String() 宽松比较）。
  rejectCase('caseidtype', 'tc_ct', { ...validDoc('tc_ct'), caseId: ['tc_ct'] }, 'CASEID_MISMATCH');
  // F5 --capture 非规范布局（不在 <caseId>/record-capture/teach-in-capture.json）须 exit 65 预读拒、不越界写台账。
  {
    const stray = join(tmp, 'stray', 'teach-in-capture.json');
    mkdirSync(dirname(stray), { recursive: true });
    writeFileSync(stray, JSON.stringify(validDoc('tc_stray')) + '\n', 'utf8');
    const r = run(['intake', 'tc_stray', '--capture', stray]);
    assert(r.status === 65, `F5 非规范布局须 exit 65，实得 ${r.status}`);
    assert(!existsSync(join(tmp, 'stray', 'intake-ledger.jsonl')), 'F5 非规范布局不得越界写台账');
  }
  // F6 caseId 含凭据关键词子串（合法 shape 但含 'token'）须 exit 65 清晰前置拒，不 late 自触台账门 exit 1。
  {
    const cap = writeCapture(join(tmp, 'kwid'), 'tc_token_x', validDoc('tc_token_x'));
    const r = run(['intake', 'tc_token_x', '--capture', cap]);
    assert(r.status === 65, `F6 caseId 含凭据关键词须 exit 65，实得 ${r.status}`);
  }

  // ── C6 异构评审 R2 深加固（codex R2 揪残留，红先行）──────────────────
  // R2-F2a valueMasked:true 是包内自声明、不可信——敏感字段明文 value 仍须拒（只认 <redacted>/缺席）。
  rejectCase('maskedlie', 'tc_ml', { ...validDoc('tc_ml'), events: [{ seq: 1, action: 'fill', path: '/reset', fieldLabel: '新密码', value: 'Abc93742', valueMasked: true }] }, 'SENSITIVE_FIELD');
  // R2-F2b 非 string 敏感 value（数字）仍须拒。
  rejectCase('numval', 'tc_nv', { ...validDoc('tc_nv'), events: [{ seq: 1, action: 'fill', path: '/x', fieldLabel: '密码', value: 123456 }] }, 'SENSITIVE_FIELD');
  // R2-F2c 未知事件键（裸中文敏感键走私）须拒——事件键须 ⊆ record 输出白名单。
  rejectCase('unknownkey', 'tc_uk', { ...validDoc('tc_uk'), events: [{ seq: 1, action: 'click', path: '/x', '密码': 'Abc93742' }] }, 'DIRTY_EVENT');
  // R2-F3 混合百分号编码 :// 走私须判 URL 泄漏（一轮定向还原后即 https://）。
  rejectCase('mixedpct', 'tc_mx', { ...validDoc('tc_mx'), startPath: '/go?u=https:%2f%2fvictim-host.example.com/admin' }, 'URL_LEAK');
  // R2-F5 capture 文件是符号链接须 exit 65（拒跟随：防软链到别处内容 / 把台账写软链目标）。
  {
    const realCap = join(tmp, 'realcap', 'teach-in-capture.json');
    mkdirSync(dirname(realCap), { recursive: true });
    writeFileSync(realCap, JSON.stringify(validDoc('tc_link')) + '\n', 'utf8');
    const linkDir = join(tmp, 'tc_link', 'record-capture');
    mkdirSync(linkDir, { recursive: true });
    const linkCap = join(linkDir, 'teach-in-capture.json');
    symlinkSync(realCap, linkCap);
    const r = run(['intake', 'tc_link', '--capture', linkCap]);
    assert(r.status === 65, `R2-F5 symlink capture 须 exit 65，实得 ${r.status}`);
  }

  // ── C7 异构评审 R3 深加固（codex R3 揪残留，红先行）────────────────────
  // R3-#1 event value 为 object（嵌套敏感键走私）须拒——字段类型硬校验（string 字段须 string）。
  rejectCase('objval', 'tc_ov', { ...validDoc('tc_ov'), events: [{ seq: 1, action: 'fill', path: '/profile', selector: 'input[name=name]', value: { '密码': 'Abc93742' } }] }, 'DIRTY_EVENT');
  // R3-#2a startPath 裸 host（无 scheme 无 //）须判 URL 泄漏——path 字段须 path-only。
  rejectCase('barehost', 'tc_bh', { ...validDoc('tc_bh'), startPath: 'victim-host.example.com/admin' }, 'URL_LEAK');
  // R3-#2b event.path 非 path-only（blob: scheme、无 / 起始）须拒 DIRTY_EVENT。
  rejectCase('schemepath', 'tc_sp', { ...validDoc('tc_sp'), events: [{ seq: 1, action: 'click', path: 'blob:null/abc' }] }, 'DIRTY_EVENT');
  // R2-F3 深：双重百分号编码 :// 须判 URL 泄漏（normForUrl 迭代到不动点）。
  rejectCase('doublepct', 'tc_dp', { ...validDoc('tc_dp'), startPath: '/go?u=https%253a%252f%252fvictim-host.example.com' }, 'URL_LEAK');
  // R3-#3a caseId 目录本身是符号链接须 exit 65（lstat 祖父段）。
  {
    const realCaseDir = join(tmp, 'realcase-dl');
    mkdirSync(join(realCaseDir, 'record-capture'), { recursive: true });
    writeFileSync(join(realCaseDir, 'record-capture', 'teach-in-capture.json'), JSON.stringify(validDoc('tc_dirlink')) + '\n', 'utf8');
    symlinkSync(realCaseDir, join(tmp, 'tc_dirlink'));
    const r = run(['intake', 'tc_dirlink', '--capture', join(tmp, 'tc_dirlink', 'record-capture', 'teach-in-capture.json')]);
    assert(r.status === 65, `R3-#3a caseId 目录软链须 exit 65，实得 ${r.status}`);
  }
  // R3-#3b 既有 intake-ledger.jsonl 是符号链接须 exit 65（拒 append 跟随到软链目标）。
  {
    const cd = join(tmp, 'tc_ledlink', 'record-capture');
    mkdirSync(cd, { recursive: true });
    writeFileSync(join(cd, 'teach-in-capture.json'), JSON.stringify(validDoc('tc_ledlink')) + '\n', 'utf8');
    const ext = join(tmp, 'ext-ledger.jsonl');
    writeFileSync(ext, '', 'utf8');
    symlinkSync(ext, join(cd, 'intake-ledger.jsonl'));
    const r = run(['intake', 'tc_ledlink', '--capture', join(cd, 'teach-in-capture.json')]);
    assert(r.status === 65, `R3-#3b 台账软链须 exit 65，实得 ${r.status}`);
  }

  // ── C8 异构评审 R4 深加固（codex R4 揪残留 + 新 fail-open，红先行）──────
  // R3-#2 深：normForUrl 后成 ///host 的三斜杠旁路——isPathOnly 须基于规范化后判单斜杠。
  rejectCase('normslash', 'tc_ns', { ...validDoc('tc_ns'), startPath: '/%2f%2fvictim-host.example.com/admin' }, 'URL_LEAK');
  // R2-F3 超深：25 层百分号编码 :// 不收敛须 fail-closed URL_LEAK（cap 内未到不动点即判泄漏）。
  {
    const enc = (s) => s.replace(/%/g, '%25').replace(/:/g, '%3a').replace(/\//g, '%2f');
    let deep = '://'; for (let i = 0; i < 25; i++) deep = enc(deep);
    rejectCase('deepenc', 'tc_de', { ...validDoc('tc_de'), startPath: '/go?u=https' + deep + 'victim.example' }, 'URL_LEAK');
  }
  // R4-NEW 顶层未知键携中文敏感内容须拒——v1 顶层键闭合。
  rejectCase('topkey', 'tc_tk', { ...validDoc('tc_tk'), '密码': 'Abc93742' }, 'UNKNOWN_FIELD');
  // R4-NEW source 未知键携中文敏感内容须拒——source 键闭合。
  rejectCase('srckey', 'tc_sk', { ...validDoc('tc_sk'), source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true, '验证码': '123456' } }, 'UNKNOWN_FIELD');

  // ── C9 异构评审 R5 深加固（codex R5：backslash/非//scheme/标量元数据走私，红先行）────
  // R5 backslash URL：/\host WHATWG 归一成 //host——path 字段拒裸反斜杠 + normConverge \→/。
  rejectCase('backslash', 'tc_bs', { ...validDoc('tc_bs'), startPath: '/\\victim-host.example.com/admin' }, 'URL_LEAK');
  // R5 非 // scheme 内嵌 query：blob:/javascript:/file: 以 / 起始、无 :// 无 //host，仍须拒。
  rejectCase('blobq', 'tc_bq', { ...validDoc('tc_bq'), startPath: '/go?next=blob:null/abc' }, 'URL_LEAK');
  rejectCase('jsq', 'tc_jq', { ...validDoc('tc_jq'), startPath: '/go?next=javascript:alert(1)' }, 'URL_LEAK');
  // R5 标量元数据走私：createdAt 非 ISO / source.kind 非枚举携中文敏感内容须拒。
  rejectCase('createdat', 'tc_ca', { ...validDoc('tc_ca'), createdAt: '密码=Abc93742' }, 'UNKNOWN_FIELD');
  rejectCase('srckind', 'tc_ki', { ...validDoc('tc_ki'), source: { kind: 'manual 验证码=123456', signed: false, replayReady: false, distillRequired: true } }, 'SIGNED_FLAG');

  // ── C10 异构评审 R6 深加固（codex R6：\u 转义绕 raw 门 / 编码·遗漏 scheme，红先行）──
  // R6-#1 JSON \u 转义让 raw 凭据门漏英文凭据——parse 后须再过 canonical 凭据门（手写 raw，rejectCase 的 JSON.stringify 造不出此绕过）。
  {
    const dir = join(tmp, 'tc_uesc', 'record-capture');
    mkdirSync(dir, { recursive: true });
    const rawDoc = '{"schemaVersion":1,"artifactKind":"teach-in-capture","caseId":"tc_uesc","createdAt":"2026-01-01T00:00:00.000Z","startPath":"/x","source":{"kind":"manual","signed":false,"replayReady":false,"distillRequired":true},"events":[{"seq":1,"action":"click","path":"/x","text":"\\u0070assword=Abc93742"}]}';
    const cap = join(dir, 'teach-in-capture.json');
    writeFileSync(cap, rawDoc + '\n', 'utf8');
    const r = run(['intake', 'tc_uesc', '--capture', cap]);
    assert(r.status === 65, `R6-#1 \\u 转义英文凭据须 exit 65，实得 ${r.status}`);
    const e = readLedger(ledgerPathFor(cap))[0];
    assert(e && e.reason === 'CRED_GATE_HIT', `R6-#1 须 CRED_GATE_HIT，实得 ${e && e.reason}`);
  }
  // R6-#2a 百分号编码的 scheme 字母（java%73cript:）须判泄漏（general %HH 还原后 javascript:）。
  rejectCase('encscheme', 'tc_ec', { ...validDoc('tc_ec'), startPath: '/go?next=java%73cript:alert(1)' }, 'URL_LEAK');
  // R6-#2b 遗漏黑名单的 scheme（smb:）——path 字段改 allowlist 式：任何 scheme 皆非 path-only。
  rejectCase('smbscheme', 'tc_sm', { ...validDoc('tc_sm'), startPath: '/go?next=smb:fileserver.internal/share' }, 'URL_LEAK');

  // ── C11 异构评审 R7 深加固（codex R7：%编码凭据 / wrapper scheme，红先行）────────
  // R7-#1 百分号编码的英文凭据（pa%73sword）绕 raw + canonical 门——parse 后须对 normConverge 解码后再扫凭据门。
  rejectCase('pctcred', 'tc_pc', { ...validDoc('tc_pc'), events: [{ seq: 1, action: 'click', path: '/x', text: 'pa%73sword=Abc93742' }] }, 'CRED_GATE_HIT');
  // R7-#2 wrapper 包裹的 scheme（(smb:...) / [ssh:...]）——PATH_SCHEME 分隔符集须含括号引号类。
  rejectCase('wrapsmb', 'tc_ws', { ...validDoc('tc_ws'), startPath: '/go?next=(smb:fileserver.internal/share)' }, 'URL_LEAK');
  rejectCase('wrapssh', 'tc_wh', { ...validDoc('tc_wh'), events: [{ seq: 1, action: 'click', path: '/go?next=[ssh:host.internal/x]' }] }, 'DIRTY_EVENT');

  // ── C12 异构评审 R8 深加固（codex R8：JSON 重复键藏脏 / wrapper scheme 系统化，红先行）──
  // R8-#1 JSON 重复键把脏内容藏在被 parse 丢弃的键里（parse 取最后一个）——须拒 DUPLICATE_KEY。
  {
    const dir = join(tmp, 'tc_dup', 'record-capture');
    mkdirSync(dir, { recursive: true });
    const rawDup = '{"schemaVersion":1,"artifactKind":"teach-in-capture","caseId":"tc_dup","createdAt":"2026-01-01T00:00:00.000Z","startPath":"/x","source":{"kind":"manual","signed":false,"replayReady":false,"distillRequired":true},"events":[{"seq":1,"action":"click","path":"https://victim-host.example.com/x","path":"/safe"}]}';
    const cap = join(dir, 'teach-in-capture.json');
    writeFileSync(cap, rawDup + '\n', 'utf8');
    const r = run(['intake', 'tc_dup', '--capture', cap]);
    assert(r.status === 65, `R8-#1 重复键须 exit 65，实得 ${r.status}`);
    const e = readLedger(ledgerPathFor(cap))[0];
    assert(e && e.reason === 'DUPLICATE_KEY', `R8-#1 须 DUPLICATE_KEY，实得 ${e && e.reason}`);
  }
  // R8-#1b 重复键藏在编码键名里（path vs path）也须拒。
  {
    const dir = join(tmp, 'tc_dup2', 'record-capture');
    mkdirSync(dir, { recursive: true });
    const rawDup = '{"schemaVersion":1,"artifactKind":"teach-in-capture","caseId":"tc_dup2","createdAt":"2026-01-01T00:00:00.000Z","startPath":"/x","source":{"kind":"manual","signed":false,"replayReady":false,"distillRequired":true},"events":[{"seq":1,"action":"click","\\u0070ath":"https://victim-host.example.com/x","path":"/safe"}]}';
    const cap = join(dir, 'teach-in-capture.json');
    writeFileSync(cap, rawDup + '\n', 'utf8');
    const r = run(['intake', 'tc_dup2', '--capture', cap]);
    assert(r.status === 65, `R8-#1b 编码重复键须 exit 65，实得 ${r.status}`);
  }
  // R8-#2 未枚举 wrapper（!smb:）——PATH_SCHEME 改保守边界：任何非 scheme 字符后的 scheme-shaped token 皆拒。
  rejectCase('bangsmb', 'tc_bsm', { ...validDoc('tc_bsm'), startPath: '/go?next=!smb:fileserver.internal/share' }, 'URL_LEAK');

  // ── C13 异构评审 R9（codex R9：非白名单 scheme 在事件自由文本，红先行）──────
  // R9 事件 text 里的非白名单 scheme URL（!smb:host/path）须拒——自由文本 scheme-URL 检测（record scrubUrlLike
  // 采集期本就剥净，intake 拒之属一致纵深防御）。
  rejectCase('smbtext', 'tc_st', { ...validDoc('tc_st'), events: [{ seq: 1, action: 'click', path: '/x', text: '!smb:fileserver.internal/share' }] }, 'DIRTY_EVENT');
  // R10 裸 host（smb:fileserver.internal，无 /@[ payload）：FREE_TEXT_SCHEME 的 /@[ 守卫会漏，靠已知 scheme 黑名单兜。
  rejectCase('smbbare', 'tc_sb', { ...validDoc('tc_sb'), events: [{ seq: 1, action: 'click', path: '/x', text: 'smb:fileserver.internal' }] }, 'DIRTY_EVENT');
  // R9 正例：合法冒号文本（Price:100，无 URL 结构）不得误伤——须 accept exit 0。
  {
    const cap = writeCapture(join(tmp, 'colonok'), 'tc_colon', { ...validDoc('tc_colon'), events: [{ seq: 1, action: 'click', path: '/x', text: 'Price:100' }] });
    const r = run(['intake', 'tc_colon', '--capture', cap]);
    assert(r.status === 0, `R9 合法冒号文本 Price:100 不得误伤，实得 ${r.status}（stderr=${r.stderr}）`);
  }

  console.log('record-intake golden: GREEN');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
