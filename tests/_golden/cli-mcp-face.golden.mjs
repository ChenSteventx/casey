// cli-mcp-face.golden.mjs —— CLI/MCP 双面对齐现状（cli-mcp-face，light）红金牌。实现前 C1/C2/C4/C5 红。
// 现状缝：CLI 的 replay/verdict/report 分发是 notImplemented 桩（底层 bin 早已建成、run 内部直连在用）；
// MCP 工具目录是 P0 时代（casey_run 参数形态对不上真 runPipeline、verdict/report 误标诚实桩、新命令未暴露）。
// C1 CLI 三分发真跑非桩（heal 仍真桩）；C2 MCP 握手 + 工具名集钉死（14）+ 版本单源验等（A5：serverInfo.version===package.json.version）；
// A4 覆盖断言：bin/casey.mjs switch 派生命令集 − EXCLUDED 每条须有对应 casey_* 工具（防 CLI 长了 MCP 没跟）；C3 正路 lint 真跑；
// C4 反路：未知工具 -32602 + 缺参调用如实回传 [exitCode=…] 非「尚未实现」；C5 漂移锁：逐生命周期工具
// 空参调用须落各 bin 真实用法错码（64 全仓统一；report 历史例外 2 已由 report-exit64 收敛）——工具映射断线/退化成桩即红；
// A6 MCP 层 intake happy 全管道（真 record --from-events 接缝产 capture → 经协议 casey_intake → 台账 accepted）。
import { spawnSync, spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SERVER = join(ROOT, 'mcp', 'casey-server.mjs');

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function runCli(args) { return spawnSync(process.execPath, [CASEY, ...args], { encoding: 'utf8', timeout: 60000 }); }

// 最小 MCP 客户端（newline-delimited JSON-RPC over stdio；诊断走 stderr 不干扰协议流）。
function mcpClient() {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); p(msg); }
    }
  });
  let nextId = 1;
  const rpc = (method, params, timeoutMs = 60000) => new Promise((res, rej) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`RPC ${method} 超时`)); }, timeoutMs);
    pending.set(id, (m) => { clearTimeout(timer); res(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  return { rpc, close: () => { try { child.stdin.end(); child.kill(); } catch { /* 尽力 */ } } };
}

// 工具名集（钉死 deepEq——目录漂移即红）与逐工具空参用法错码期望（十一工具全 64，report-exit64 契约收敛后无例外）。
const EXPECT_TOOL_NAMES = [
  'casey_selftest', 'casey_lint', 'casey_gate',
  'casey_ingest', 'casey_flow_bridge', 'casey_compile', 'casey_draft', 'casey_sign',
  'casey_record', 'casey_intake',
  'casey_replay', 'casey_verdict', 'casey_report', 'casey_run',
];
const LIFECYCLE_EMPTY_EXIT = {
  casey_ingest: 64, casey_flow_bridge: 64, casey_compile: 64, casey_draft: 64, casey_sign: 64,
  casey_record: 64, casey_intake: 64,
  casey_replay: 64, casey_verdict: 64, casey_report: 64, casey_run: 64,
};
// CLI 生命周期命令集 ⊆ MCP 工具集覆盖断言（A4）的显式排除集：fail-closed——新命令默认必被 MCP 覆盖，
// 故意不进 MCP 的须在此留痕（GRILL D5，需人过目的小白名单）。help 非生命周期；breaker/contract 属 loop 开发
// 纪律面（同 MCP 只暴露 lint/gate 不暴露 breaker/contract 的既有取舍）；heal 诚实桩（相5 无 bin，P6 落地后移出）；
// distill 的 MCP 面由后续易用性契约补（record-distill plan 明列「不接 MCP，需同时补真实可跑用例」），补时移出。
// scaffold-case（相0 前段脚手架，ingest-scaffold plan 明列不接 MCP）；demo（样例报告入口，casey-demo GRILL D8 不加 casey_demo）——均 CLI-only，批一协调合并时集成补入。
// doctor 是自检类命令（跨平台就绪自检），同 selftest/breaker/contract 属自检/开发纪律面、不进 MCP 工具目录（casey-doctor 契约 GRILL D9）。
const CLI_MCP_EXCLUDED = new Set(['help', 'breaker', 'contract', 'heal', 'distill', 'scaffold-case', 'demo', 'doctor']);

// ---------- C1 CLI 三分发真跑非桩 ----------
await checkAsync('C1 CLI：replay/verdict/report 零参走真 bin 用法错非桩 exit 3；heal 仍真桩 exit 3', async () => {
  const expects = [
    ['replay', 64, '--events'],
    ['verdict', 64, '--axes'],
    ['report', 64, '--model'],
  ];
  for (const [cmd, code, flag] of expects) {
    const r = runCli([cmd]);
    if (r.status === 3) throw new Error(`casey ${cmd} 仍是 notImplemented 桩（exit 3）`);
    if (r.status !== code) throw new Error(`casey ${cmd} 零参应 exit ${code}（真 bin 用法错），实际 ${r.status}`);
    const txt = (r.stderr || '') + (r.stdout || '');
    if (!txt.includes(flag)) throw new Error(`casey ${cmd} 用法串应含 ${flag} 真实旗标`);
  }
  const rHeal = runCli(['heal']);
  if (rHeal.status !== 3) throw new Error(`casey heal 应保持真桩 exit 3（相5 无 bin），实际 ${rHeal.status}`);
});

const mcp = mcpClient();
try {
  // ---------- C2 MCP 握手 + 工具名集钉死 + 版本单源验等（A5）----------
  await checkAsync('C2 MCP：initialize serverInfo.name=casey + 版本单源验等（serverInfo.version===package.json.version）；tools/list 工具名集 deepEq 钉死（14 工具）', async () => {
    const init = await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    if (!init.result || init.result.serverInfo.name !== 'casey') throw new Error(`initialize 应回 serverInfo.name=casey，实际 ${JSON.stringify(init).slice(0, 200)}`);
    // A5 版本单源：结构性验等 serverInfo.version === package.json.version（不硬编码字面量，日后 bump 自动流过）。
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    if (!pkg.version || typeof pkg.version !== 'string') throw new Error(`package.json.version 应为非空字符串（防两处同 undefined 假绿），实际 ${JSON.stringify(pkg.version)}`);
    if (init.result.serverInfo.version !== pkg.version) throw new Error(`版本单源漂移：serverInfo.version=${init.result.serverInfo.version} ≠ package.json.version=${pkg.version}`);
    const list = await mcp.rpc('tools/list', {});
    const names = (list.result.tools || []).map((t) => t.name);
    if (!deepEq(names, EXPECT_TOOL_NAMES)) throw new Error(`工具名集漂移：实际 ${JSON.stringify(names)}`);
  });

  // ---------- A4 覆盖断言：CLI 生命周期命令集 ⊆ MCP 工具集（防 CLI 长了 MCP 没跟——F7 静默滞后根因锁）----------
  await checkAsync('A4 覆盖断言：bin/casey.mjs switch 派生命令集 − EXCLUDED 每条须有对应 casey_* 工具（缺即红）', async () => {
    const src = readFileSync(CASEY, 'utf8');
    const derived = [...src.matchAll(/case '([a-z][a-z-]*)':/g)].map((m) => m[1]);
    if (derived.length < 10) throw new Error(`派生命令集异常（仅 ${derived.length} 条），正则或源文件形态漂移`);
    const list = await mcp.rpc('tools/list', {});
    const names = new Set((list.result.tools || []).map((t) => t.name));
    const missing = [];
    for (const cmd of derived) {
      if (CLI_MCP_EXCLUDED.has(cmd)) continue;
      const tool = `casey_${cmd.replace(/-/g, '_')}`;
      if (!names.has(tool)) missing.push(`${cmd}→${tool}`);
    }
    if (missing.length) throw new Error(`CLI 命令未被 MCP 覆盖（且未列 EXCLUDED——新命令须进 MCP 或显式排除）：${missing.join(', ')}`);
  });

  // ---------- C3 正路：lint 真跑 ----------
  await checkAsync('C3 MCP 正路：tools/call casey_lint(registry) → 真跑 exit 0、isError false', async () => {
    const r = await mcp.rpc('tools/call', { name: 'casey_lint', arguments: { target: 'registry' } });
    if (!r.result) throw new Error(`应回 result，实际 ${JSON.stringify(r).slice(0, 200)}`);
    if (r.result.isError) throw new Error(`lint registry 应 isError false：${JSON.stringify(r.result.content).slice(0, 200)}`);
    const text = r.result.content.map((c) => c.text).join('');
    if (!text.includes('[exitCode=0]')) throw new Error('应含 [exitCode=0] 退出码语义标注');
  });

  // ---------- C4 反路：未知工具 + 缺参如实回传 ----------
  await checkAsync('C4 MCP 反路：未知工具 -32602；casey_verdict 缺参 → isError + [exitCode=64] 非「尚未实现」', async () => {
    const bad = await mcp.rpc('tools/call', { name: 'casey_nonsense', arguments: {} });
    if (!bad.error || bad.error.code !== -32602) throw new Error(`未知工具应 -32602，实际 ${JSON.stringify(bad).slice(0, 200)}`);
    const v = await mcp.rpc('tools/call', { name: 'casey_verdict', arguments: {} });
    if (!v.result || !v.result.isError) throw new Error(`verdict 缺参应 isError true，实际 ${JSON.stringify(v).slice(0, 300)}`);
    const text = v.result.content.map((c) => c.text).join('');
    if (!text.includes('[exitCode=64]')) throw new Error(`verdict 缺参应回传 [exitCode=64]，实际文本尾：${text.slice(-200)}`);
    if (text.includes('尚未实现')) throw new Error('verdict 不得再标「尚未实现」（底层 bin 已建成）');
  });

  // ---------- C5 漂移锁：逐生命周期工具空参 → 各 bin 真实用法错码 ----------
  await checkAsync('C5 漂移锁：十一个生命周期工具空参调用逐一落真 bin 用法错码（映射断线/退化成桩即红）', async () => {
    for (const [tool, code] of Object.entries(LIFECYCLE_EMPTY_EXIT)) {
      const r = await mcp.rpc('tools/call', { name: tool, arguments: {} });
      if (!r.result) throw new Error(`${tool} 应回 result（映射在册），实际 ${JSON.stringify(r).slice(0, 150)}`);
      const text = r.result.content.map((c) => c.text).join('');
      if (!text.includes(`[exitCode=${code}]`)) throw new Error(`${tool} 空参应 [exitCode=${code}]，实际文本尾：${text.slice(-150)}`);
      if (text.includes('[exitCode=3]') || text.includes('尚未实现')) throw new Error(`${tool} 退化成桩`);
    }
  });
  // ---------- C6 argv 映射表（codex R1-F1）：逐工具 toArgs 全量旗标 deepEq——拼写/kebab 转换/布尔旗标漂移即红 ----------
  await checkAsync('C6 argv 映射表：14 工具 toArgs(全量入参) 逐一 deepEq 期望 argv', async () => {
    const { TOOLS } = await import(`file://${SERVER.replace(/\\/g, '/')}`); // 导入有 rl 副作用，末尾显式 exit 兜
    const CASES = [
      ['casey_selftest', {}, ['selftest', '--tier1']],
      ['casey_lint', { target: 'x.md' }, ['lint', '--file', 'x.md']],
      ['casey_lint', {}, ['lint', '--registry']],
      ['casey_gate', { prd: 'p.json' }, ['gate', '--prd', 'p.json']],
      ['casey_ingest', { caseId: 'tc', in: 'c.json', outDir: 'd' }, ['ingest', 'tc', '--in', 'c.json', '--out-dir', 'd']],
      ['casey_flow_bridge', { caseId: 'tc', testcase: 't', mapping: 'm', outDir: 'd' }, ['flow-bridge', 'tc', '--testcase', 't', '--mapping', 'm', '--out-dir', 'd']],
      ['casey_compile', { caseId: 'tc', execute: true, testcase: 't', flow: 'f', outDir: 'd', sut: 'u', profile: 'p', skipLogin: true, loginBootstrap: false, uniqueName: 'e1' },
        ['compile', 'tc', '--execute', '--testcase', 't', '--flow', 'f', '--out-dir', 'd', '--sut', 'u', '--profile', 'p', '--skip-login', '--unique-name', 'e1']],
      ['casey_draft', { caseId: 'tc', observed: 'o', compileReport: 'r', outDir: 'd', patch: 'p' }, ['draft', 'tc', '--observed', 'o', '--compile-report', 'r', '--out-dir', 'd', '--patch', 'p']],
      ['casey_sign', { caseId: 'tc', draft: 'dr', prd: 'pr', frozenOut: 'fo', signer: 's', againstBuild: 'b', signedAt: 'at', verdictBaseline: 'vb', resign: true, force: true, archiveDir: 'ad' },
        ['sign', 'tc', '--draft', 'dr', '--prd', 'pr', '--frozen-out', 'fo', '--signer', 's', '--against-build', 'b', '--signed-at', 'at', '--verdict-baseline', 'vb', '--resign', '--force', '--archive-dir', 'ad']],
      ['casey_record', { caseId: 'tc', sut: 'u', outDir: 'd', loginBootstrap: true, noLogin: false, fromEvents: 'e', headless: true, maxMs: '5000' },
        ['record', 'tc', '--sut', 'u', '--out-dir', 'd', '--login-bootstrap', '--from-events', 'e', '--headless', '--max-ms', '5000']],
      ['casey_intake', { caseId: 'tc', capture: 'c.json' }, ['intake', 'tc', '--capture', 'c.json']],
      ['casey_replay', { events: 'e', sut: 'u', expected: 'x', profile: 'p', out: 'o', loginBootstrap: true, runHistory: 'h', runMetrics: 'm', runId: 'id', videoDir: 'v' },
        ['replay', '--events', 'e', '--sut', 'u', '--expected', 'x', '--profile', 'p', '--out', 'o', '--login-bootstrap', '--run-history', 'h', '--run-metrics', 'm', '--run-id', 'id', '--video-dir', 'v']],
      ['casey_verdict', { axes: 'a', out: 'o' }, ['verdict', '--axes', 'a', '--out', 'o']],
      ['casey_report', { model: 'm', out: 'd', runHistory: 'h', runMetrics: 'x' }, ['report', '--model', 'm', '--out', 'd', '--run-history', 'h', '--run-metrics', 'x']],
      ['casey_run', { caseId: 'tc', sut: 'u', events: 'e', expected: 'x', profile: 'p', observed: 'o', generatedAt: 'g', caseMeta: 'c', runDir: 'd', loginBootstrap: true, noVideo: true },
        ['run', 'tc', '--sut', 'u', '--events', 'e', '--expected', 'x', '--profile', 'p', '--observed', 'o', '--generated-at', 'g', '--case-meta', 'c', '--run-dir', 'd', '--login-bootstrap', '--no-video']],
    ];
    const byName = new Map(TOOLS.map((t) => [t.name, t]));
    for (const [name, input, expect] of CASES) {
      const tool = byName.get(name);
      if (!tool) throw new Error(`工具 ${name} 不在目录`);
      const got = tool.toArgs(input);
      if (!deepEq(got, expect)) throw new Error(`${name} argv 映射漂移：期望 ${JSON.stringify(expect)}，实际 ${JSON.stringify(got)}`);
    }
  });

  // ---------- C7 MCP 层代表性 happy（codex R1-F2 修正采纳）：ingest 经协议全管道真产产物 ----------
  await checkAsync('C7 MCP 正路全管道：tools/call casey_ingest（真候选）→ exit 0 + testcase 产物落地', async () => {
    const { mkdtempSync, writeFileSync, existsSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'casey-mcp-face-'));
    const cand = join(tmp, 'candidate.json');
    writeFileSync(cand, JSON.stringify({
      schemaVersion: 1, caseId: 'tc_mcp_face', source: { kind: 'json' },
      steps: [{ intentId: 'intent_a' }], uniquePrefix: 'atl_',
    }));
    const r = await mcp.rpc('tools/call', { name: 'casey_ingest', arguments: { caseId: 'tc_mcp_face', in: cand, outDir: tmp } });
    if (!r.result || r.result.isError) throw new Error(`MCP ingest happy 应成功，实际 ${JSON.stringify(r).slice(0, 300)}`);
    const text = r.result.content.map((c) => c.text).join('');
    if (!text.includes('[exitCode=0]')) throw new Error('应含 [exitCode=0]');
    if (!existsSync(join(tmp, 'testcase-tc_mcp_face.json'))) throw new Error('MCP 全管道应真落 testcase 产物');
  });

  // ---------- A6 MCP 层 intake happy 全管道（复现真 record --from-events 接缝产 capture → 经协议 intake → 真台账）----------
  // 复现冻结接缝、不 rig：干净 capture 由真 casey record --from-events 产（hermetic，无浏览器），不手写伪造 doc 倒着裁到 accept。
  await checkAsync('A6 MCP intake happy：真 record 接缝产干净 capture → tools/call casey_intake → exit 0 + 台账 accepted、无凭据/无裸 ://、回显无绝对路径', async () => {
    const { mkdtempSync, writeFileSync, existsSync, readFileSync: rf } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'casey-mcp-intake-'));
    const events = join(tmp, 'clean-events.json');
    // 全字段无裸 ://、action ∈ {click,dblclick,fill,press,nav}——过 reviewCapture 复核闸。
    writeFileSync(events, JSON.stringify([{ action: 'click', path: '/atl_x/list', selector: 'button.new', text: '新增' }]));
    // 真 record --from-events 接缝（非浏览器路径，hermetic）产规范布局 capture（intake 前置守卫认这条路径）。
    const rec = runCli(['record', 'tc_mcp_intake', '--from-events', events, '--sut', 'http://127.0.0.1:9', '--no-login', '--out-dir', tmp]);
    if (rec.status !== 0) throw new Error(`record --from-events 接缝应 exit 0，实际 ${rec.status}：${(rec.stderr || '').slice(-200)}`);
    const capture = join(tmp, 'tc_mcp_intake', 'record-capture', 'teach-in-capture.json');
    if (!existsSync(capture)) throw new Error('record 接缝应产 teach-in-capture.json 规范布局');
    // 经协议调用 casey_intake。
    const r = await mcp.rpc('tools/call', { name: 'casey_intake', arguments: { caseId: 'tc_mcp_intake', capture } });
    if (!r.result || r.result.isError) throw new Error(`MCP intake happy 应成功（result 且 isError false），实际 ${JSON.stringify(r).slice(0, 300)}`);
    const text = r.result.content.map((c) => c.text).join('');
    if (!text.includes('[exitCode=0]')) throw new Error('应含 [exitCode=0] 退出码语义标注');
    // 真台账落地 + accepted 条目校验（复现真接缝字段，不 rig）。
    const ledger = join(tmp, 'tc_mcp_intake', 'record-capture', 'intake-ledger.jsonl');
    if (!existsSync(ledger)) throw new Error('MCP 全管道应真落 intake-ledger.jsonl');
    const ledgerRaw = rf(ledger, 'utf8');
    const last = JSON.parse(ledgerRaw.trim().split('\n').filter(Boolean).pop());
    if (last.intakeStatus !== 'accepted') throw new Error(`末行应 intakeStatus=accepted，实际 ${last.intakeStatus}`);
    if (last.eventCount !== 1) throw new Error(`eventCount 应与夹具事件数 1 一致，实际 ${last.eventCount}`);
    if (last.reason !== null) throw new Error(`accepted 条目 reason 应 null，实际 ${JSON.stringify(last.reason)}`);
    // 台账全文过凭据门口径：无裸 ://（无目标地址泄漏）。
    if (/:\/\//.test(ledgerRaw)) throw new Error('台账不得含裸 :// 目标地址');
    // 成功回显不含用户绝对路径（output-seal 纪律——只报定名产物 <case-dir>/…）。
    if (text.includes(tmp)) throw new Error('MCP intake 成功回显不得含用户绝对路径');
  });
} finally {
  mcp.close();
}

console.log(`cli-mcp-face golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); }
process.exit(fails.length ? 1 : 0); // 显式退出：C6 导入 server 模块的 readline 副作用会挂住事件循环
