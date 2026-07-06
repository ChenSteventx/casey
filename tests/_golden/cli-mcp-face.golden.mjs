// cli-mcp-face.golden.mjs —— CLI/MCP 双面对齐现状（cli-mcp-face，light）红金牌。实现前 C1/C2/C4/C5 红。
// 现状缝：CLI 的 replay/verdict/report 分发是 notImplemented 桩（底层 bin 早已建成、run 内部直连在用）；
// MCP 工具目录是 P0 时代（casey_run 参数形态对不上真 runPipeline、verdict/report 误标诚实桩、新命令未暴露）。
// C1 CLI 三分发真跑非桩（heal 仍真桩）；C2 MCP 握手 + 工具名集钉死（12）；C3 正路 lint 真跑；
// C4 反路：未知工具 -32602 + 缺参调用如实回传 [exitCode=…] 非「尚未实现」；C5 漂移锁：逐生命周期工具
// 空参调用须落各 bin 真实用法错码（64；report 历史例外 2）——工具映射断线/退化成桩即红。
import { spawnSync, spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// 工具名集（钉死 deepEq——目录漂移即红）与逐工具空参用法错码期望（report 历史例外 exit 2，收敛另案挂账）。
const EXPECT_TOOL_NAMES = [
  'casey_selftest', 'casey_lint', 'casey_gate',
  'casey_ingest', 'casey_flow_bridge', 'casey_compile', 'casey_draft', 'casey_sign',
  'casey_replay', 'casey_verdict', 'casey_report', 'casey_run',
];
const LIFECYCLE_EMPTY_EXIT = {
  casey_ingest: 64, casey_flow_bridge: 64, casey_compile: 64, casey_draft: 64, casey_sign: 64,
  casey_replay: 64, casey_verdict: 64, casey_report: 2, casey_run: 64,
};

// ---------- C1 CLI 三分发真跑非桩 ----------
await checkAsync('C1 CLI：replay/verdict/report 零参走真 bin 用法错非桩 exit 3；heal 仍真桩 exit 3', async () => {
  const expects = [
    ['replay', 64, '--events'],
    ['verdict', 64, '--axes'],
    ['report', 2, '--model'],
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
  // ---------- C2 MCP 握手 + 工具名集钉死 ----------
  await checkAsync('C2 MCP：initialize serverInfo name=casey version=0.2.0；tools/list 工具名集 deepEq 钉死（12 工具）', async () => {
    const init = await mcp.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} });
    if (!init.result || init.result.serverInfo.name !== 'casey') throw new Error(`initialize 应回 serverInfo.name=casey，实际 ${JSON.stringify(init).slice(0, 200)}`);
    if (init.result.serverInfo.version !== '0.2.0') throw new Error(`serverInfo.version 应钉 0.2.0（目录刷新版），实际 ${init.result.serverInfo.version}`); // codex R1-F3
    const list = await mcp.rpc('tools/list', {});
    const names = (list.result.tools || []).map((t) => t.name);
    if (!deepEq(names, EXPECT_TOOL_NAMES)) throw new Error(`工具名集漂移：实际 ${JSON.stringify(names)}`);
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
  await checkAsync('C5 漂移锁：九个生命周期工具空参调用逐一落真 bin 用法错码（映射断线/退化成桩即红）', async () => {
    for (const [tool, code] of Object.entries(LIFECYCLE_EMPTY_EXIT)) {
      const r = await mcp.rpc('tools/call', { name: tool, arguments: {} });
      if (!r.result) throw new Error(`${tool} 应回 result（映射在册），实际 ${JSON.stringify(r).slice(0, 150)}`);
      const text = r.result.content.map((c) => c.text).join('');
      if (!text.includes(`[exitCode=${code}]`)) throw new Error(`${tool} 空参应 [exitCode=${code}]，实际文本尾：${text.slice(-150)}`);
      if (text.includes('[exitCode=3]') || text.includes('尚未实现')) throw new Error(`${tool} 退化成桩`);
    }
  });
  // ---------- C6 argv 映射表（codex R1-F1）：逐工具 toArgs 全量旗标 deepEq——拼写/kebab 转换/布尔旗标漂移即红 ----------
  await checkAsync('C6 argv 映射表：12 工具 toArgs(全量入参) 逐一 deepEq 期望 argv', async () => {
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
} finally {
  mcp.close();
}

console.log(`cli-mcp-face golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); }
process.exit(fails.length ? 1 : 0); // 显式退出：C6 导入 server 模块的 readline 副作用会挂住事件循环
