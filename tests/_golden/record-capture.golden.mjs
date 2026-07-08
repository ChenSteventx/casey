#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const node = process.execPath;
const cli = join(ROOT, 'bin', 'casey.mjs');

function run(args, opts = {}) {
  return spawnSync(node, [cli, ...args], { cwd: ROOT, encoding: 'utf8', ...opts });
}
function fail(msg) {
  console.error(`record-capture golden failed: ${msg}`);
  process.exit(1);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const tmp = mkdtempSync(join(tmpdir(), 'casey-record-capture-'));
try {
  const helpText = readFileSync(cli, 'utf8');
  assert(helpText.includes('casey record'), 'help 须暴露 casey record');

  const usage = run(['record']);
  assert(usage.status === 64, 'record 缺参须 exit 64');

  const cleanEvents = join(tmp, 'clean-events.json');
  writeFileSync(cleanEvents, JSON.stringify({
    startUrl: 'http://127.0.0.1:15519/heren/aimanagement/process/list?tab=mine',
    events: [
      { action: 'click', url: 'http://127.0.0.1:15519/heren/aimanagement/process/list?tab=mine', selector: 'button.new', text: '新增工作流', tagName: 'button', x: 10, y: 20 },
      { action: 'fill', url: 'http://127.0.0.1:15519/heren/aimanagement/process/edit', selector: 'input[name="name"]', fieldLabel: '名称', value: 'atl_demo' },
      { action: 'press', path: '/heren/aimanagement/process/edit', key: 'Enter' }
    ]
  }, null, 2), 'utf8');

  const outDir = join(tmp, 'out');
  const ok = run(['record', 'tc_record_capture', '--sut', 'http://127.0.0.1:15519', '--out-dir', outDir, '--no-login', '--from-events', cleanEvents]);
  assert(ok.status === 0, `record --from-events 应 exit 0，stderr=${ok.stderr}`);
  const packPath = join(outDir, 'tc_record_capture', 'record-capture', 'teach-in-capture.json');
  assert(existsSync(packPath), '安全包须写到固定路径');
  const text = readFileSync(packPath, 'utf8');
  assert(!text.includes('://'), '安全包全文不得包含完整 URL');
  const pack = readJson(packPath);
  assert(pack.artifactKind === 'teach-in-capture', 'artifactKind 须标明示教采集包');
  assert(pack.caseId === 'tc_record_capture', 'caseId 须写入包');
  assert(pack.source?.signed === false, '录制包 signed 须 false');
  assert(pack.source?.replayReady === false, '录制包 replayReady 须 false');
  assert(pack.source?.distillRequired === true, '录制包 distillRequired 须 true');
  assert(pack.startPath === '/heren/aimanagement/process/list?tab=mine', 'startPath 须只保留 path+query');
  assert(Array.isArray(pack.events) && pack.events.length === 3, 'events 须保留三条');
  assert(pack.events.every((e) => typeof e.path === 'string' && e.path.startsWith('/')), '每条事件 path 须为相对路径');

  const dirtyEvents = join(tmp, 'dirty-events.json');
  writeFileSync(dirtyEvents, JSON.stringify({
    events: [{ action: 'fill', path: '/login', selector: 'input', value: 'password=abc123' }]
  }, null, 2), 'utf8');
  const dirtyOut = join(tmp, 'dirty-out');
  const bad = run(['record', 'tc_record_dirty', '--sut', 'http://127.0.0.1:15519', '--out-dir', dirtyOut, '--no-login', '--from-events', dirtyEvents]);
  assert(bad.status !== 0, '含凭据关键词的录制包须拒写');
  assert(!existsSync(join(dirtyOut, 'tc_record_dirty', 'record-capture', 'teach-in-capture.json')), '拒写时不得留下半包');

  const outFiles = text + ok.stdout + ok.stderr;
  assert(!ok.stdout.includes(outDir), 'stdout 不得回显用户提供 out-dir 全路径');
  assert(!outFiles.includes('events.json'), 'record-capture 不得宣称产正式 events.json');
  assert(!outFiles.includes('expected.frozen.json'), 'record-capture 不得宣称产 expected.frozen.json');

  // ─────────────────────────────────────────────────────────────────────────
  // 异构评审（Claude 侧，实现方 codex）揪出的真缝棘轮——红先行，逐缝钉死不回潮：
  //   V2 caseId 穿越 / V1 host 泄漏（非 http scheme·协议相对·query 内嵌）/ V3 中文敏感字段遮值 /
  //   V4 --from-events 形态 fail-closed / V5 无值必填旗标 / V6 失败分支不回显路径。
  // ─────────────────────────────────────────────────────────────────────────

  // C-V2a caseId 穿越：../.. 形态拒写 exit 65，且不得在 out-dir 外落包（镜像 draft.mjs:42 / compile.mjs:283 先例）。
  {
    const deepOut = join(tmp, 'trav', 'a', 'b');
    const escaped = join(tmp, 'trav', 'escape', 'record-capture', 'teach-in-capture.json');
    const trav = run(['record', '../../escape', '--sut', 'http://127.0.0.1:15519', '--out-dir', deepOut, '--no-login', '--from-events', cleanEvents]);
    assert(trav.status === 65, `caseId ../.. 穿越须 exit 65，实得 ${trav.status}`);
    assert(!existsSync(escaped), 'caseId 穿越不得在 out-dir 外落包');
  }

  // C-V2b caseId 含非法字符（斜杠）拒写 exit 65。
  {
    const slash = run(['record', 'a/b', '--sut', 'http://127.0.0.1:15519', '--out-dir', join(tmp, 'slashout'), '--no-login', '--from-events', cleanEvents]);
    assert(slash.status === 65, 'caseId 含 / 须 exit 65');
  }

  // C-V6 凭据门拒写的 stderr 不得回显用户 out-dir 绝对路径（output-seal 成功侧占位符同口径的失败侧兑现）。
  assert(!bad.stderr.includes(dirtyOut), '拒写 stderr 不得回显 out-dir 全路径');

  // C-V1 host 泄漏：非 http scheme（ws/blob）、协议相对 //host、query 内嵌 URL 一律不得把真实 host 或 :// 带进包。
  {
    const leakEvents = join(tmp, 'leak-events.json');
    writeFileSync(leakEvents, JSON.stringify({
      startUrl: 'http://127.0.0.1:15519/app',
      events: [
        { action: 'click', path: '//victim-host.example.com/secret', selector: 'a', text: '打开 ws://victim-host.example.com:9000/socket', tagName: 'a' },
        { action: 'click', path: 'blob:http://victim-host.example.com/8f3c-uuid', selector: 'a', text: 'x', tagName: 'a' },
        { action: 'nav', path: '/login?redirect=https://victim-host.example.com/dash' }
      ]
    }, null, 2), 'utf8');
    const leakOut = join(tmp, 'leakout');
    const r = run(['record', 'tc_leak', '--sut', 'http://127.0.0.1:15519', '--out-dir', leakOut, '--no-login', '--from-events', leakEvents]);
    assert(r.status === 0, `leak 用例应 exit 0，stderr=${r.stderr}`);
    const leakText = readFileSync(join(leakOut, 'tc_leak', 'record-capture', 'teach-in-capture.json'), 'utf8');
    assert(!leakText.includes('://'), '包全文不得含 ://（含非 http scheme 与 query 内嵌）');
    assert(!leakText.includes('victim-host'), '包全文不得含真实 host（含协议相对 //host 与 ws://host）');
  }

  // C-V3 中文敏感字段值遮值（isSensitiveField 分支真覆盖——旧 dirty 用例只走凭据门关键词路径，从未触发遮值分支）。
  {
    const secretEvents = join(tmp, 'secret-events.json');
    writeFileSync(secretEvents, JSON.stringify({
      events: [
        { action: 'fill', path: '/reset', selector: 'input.hr-input', fieldLabel: '新密码', type: 'text', value: 'S3cr3tPin937461' },
        { action: 'fill', path: '/reset', selector: 'input.code', fieldLabel: '动态验证码', type: 'text', value: '840193' }
      ]
    }, null, 2), 'utf8');
    const secretOut = join(tmp, 'secretout');
    const r = run(['record', 'tc_maskfield', '--sut', 'http://127.0.0.1:15519', '--out-dir', secretOut, '--no-login', '--from-events', secretEvents]);
    assert(r.status === 0, `secret 用例应 exit 0，stderr=${r.stderr}`);
    const sp = readJson(join(secretOut, 'tc_maskfield', 'record-capture', 'teach-in-capture.json'));
    const spText = JSON.stringify(sp);
    assert(!spText.includes('S3cr3tPin937461'), '中文「新密码」字段值须遮值');
    assert(!spText.includes('840193'), '「动态验证码」OTP 值须遮值');
    assert(sp.events.every((e) => e.value === undefined || e.valueMasked === true), '敏感字段 value 须标 valueMasked');
  }

  // C-V4 --from-events 形态非法 fail-closed exit 65（裸数字 / 无 events 键对象 / 裸字符串），不留半包。
  {
    const shapes = [['num', '42'], ['obj', '{"foo":1}'], ['str', '"hello"']];
    for (const [tag, body] of shapes) {
      const f = join(tmp, `shape-${tag}.json`);
      writeFileSync(f, body, 'utf8');
      const o = join(tmp, `shapeout-${tag}`);
      const r = run(['record', 'tc_shape', '--sut', 'http://127.0.0.1:15519', '--out-dir', o, '--no-login', '--from-events', f]);
      assert(r.status === 65, `--from-events 形态 ${tag} 须 exit 65，实得 ${r.status}`);
      assert(!existsSync(join(o, 'tc_shape', 'record-capture', 'teach-in-capture.json')), '形态非法不得留半包');
    }
  }

  // C-V5 无值必填旗标须 exit 64（--out-dir 作末位裸旗标不得静默写到 cwd/true）。
  {
    const r = run(['record', 'tc_flag', '--sut', 'http://127.0.0.1:15519', '--no-login', '--from-events', cleanEvents, '--out-dir']);
    assert(r.status === 64, `裸 --out-dir 须 exit 64，实得 ${r.status}`);
    assert(!existsSync(join(ROOT, 'true')), '裸 --out-dir 不得写到 cwd/true');
  }

  console.log('record-capture golden: GREEN');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
