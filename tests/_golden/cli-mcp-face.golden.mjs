// cli-mcp-face.golden.mjs —— CLI/MCP 双面对齐现状（cli-mcp-face，light）红金牌。实现前 C1/C2/C4/C5 红。
// 现状缝：CLI 的 replay/verdict/report 分发是 notImplemented 桩（底层 bin 早已建成、run 内部直连在用）；
// MCP 工具目录是 P0 时代（casey_run 参数形态对不上真 runPipeline、verdict/report 误标诚实桩、新命令未暴露）。
// C1 CLI 三分发真跑非桩（heal 仍真桩）；C2 MCP 握手 + 工具名集钉死（14）+ 版本单源验等（A5：serverInfo.version===package.json.version）；
// A4 覆盖断言：bin/casey.mjs switch 派生命令集 − EXCLUDED 每条须有对应 casey_* 工具（防 CLI 长了 MCP 没跟）；C3 正路 lint 真跑；
// C4 反路：未知工具 -32602 + 缺参调用如实回传 [exitCode=…] 非「尚未实现」；C5 漂移锁：逐生命周期工具
// 空参调用须落各 bin 真实用法错码（64 全仓统一；report 历史例外 2 已由 report-exit64 收敛）——工具映射断线/退化成桩即红；
// A6 重建（B1，docs/plans/flow-bridge-golden-refit/plan.md）：MCP 层 intake happy 全管道，改用临时密钥动态
// 签名先例（租约固定根 + lib 建造函数手造三件套、哈希互锁真算 + 共用 support 件动态签 receipt）——
// 独立正控（直调 bin/intake.mjs 先行 accepted，排除自伤因素）+ 成对证据（同包跑两个独立 MCP server：
// 无 NODE_OPTIONS 挂 loader 精确 DRIVER_NOT_PUBLISHED 且台账零变化；有 loader 挂载经 MCP 透传生效、
// 台账恰新增一条 accepted）+ happy 主断言 + 负向姊妹（缺三件套 isError+exitCode=65）。
import { spawnSync, spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';
import { createEphemeralDriverPublication } from './support/ephemeral-driver-publication.mjs';

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
// env 可选：不传时子进程默认继承 process.env（既有全部调用点行为不变）；A6 成对证据显式传入
// 剔除/挂载 NODE_OPTIONS 的独立 env，验证 --experimental-loader 经 MCP 透传是否真生效。
function mcpClient(env = process.env) {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'], env });
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
// mcp-config 是分发/接入命令（自适应打印 MCP 挂载配置）：要挂上 MCP 才能调工具，而挂载配置正是「挂之前」需要的东西——
// 从 MCP 取它是循环依赖，正确面是 CLI + README/AGENTS.md；同 breaker/contract 属 setup/分发面、不暴露为 MCP 工具（distribution 契约 GRILL D11）。
// promptset-seed/promptset-freeze 是被测参数 authoring 一次性工序（gen-prompts 契约，GRILL D6）：驱动者是仓内
// 有 shell 的 coding agent（当前会话本身），非跑测试操作面，镜像 scaffold-case「CLI 外 LLM」范式的既有取舍；
// 后续易用性契约若真机需求起来可补 casey_* 工具并移出（同 distill 挂账法）。
const CLI_MCP_EXCLUDED = new Set(['help', 'breaker', 'contract', 'heal', 'distill', 'scaffold-case', 'demo', 'doctor', 'mcp-config', 'promptset-seed', 'promptset-freeze']);

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
    // 反向断言（评审加固）：EXCLUDED 里的每个成员必须真在 switch 派生集里——否则 EXCLUDED 里可能混进
    // 一个 switch 根本没接的幽灵命令（bin 在/help 列/EXCLUDED 加，唯独 switch 漏接），此前 A4 只单向遍历
    // 派生集、抓不到这类假绿（gen-prompts 契约 GRILL D6 修订）。
    const derivedSet = new Set(derived);
    const ghosts = [...CLI_MCP_EXCLUDED].filter((cmd) => !derivedSet.has(cmd));
    if (ghosts.length) throw new Error(`CLI_MCP_EXCLUDED 含 switch 未接的幽灵命令：${ghosts.join(', ')}`);
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

  // ---------- A6 重建（B1）：MCP 层 intake happy 全管道，临时密钥动态签名先例 ----------
  // 手造三件套（真哈希互锁，lib 建造函数产，非手写伪造）+ 共用 support 件动态签 receipt；
  // 独立正控先行（同包同 loader 直调 bin/intake.mjs） → 成对证据（同包跑两个独立 MCP server：
  // 无 loader 精确 DRIVER_NOT_PUBLISHED + 台账零变化；有 loader exit 0 + 台账恰新增一条 accepted）。
  {
    const HAPPY_CASE_ID = 'tc_mcp_intake_signed';
    const SCOPE = `sha256:${'a'.repeat(64)}`;
    const EVIDENCE = `sha256:${'b'.repeat(64)}`;
    const lease = acquireCanonicalCaseLease({ caseId: HAPPY_CASE_ID });
    const publication = createEphemeralDriverPublication({});
    try {
      let capturePath = null;
      let ledgerPath = null;
      let baseline = null; // 正控后台账基线：{ sha256, lines }
      try {
        const observations = [{
          kind: 'workflow', name: 'MCP intake 自检工作流', code: 'wf-mcp-intake', platformId: '90071992547409931234',
          scopeFingerprint: SCOPE, parent: null, evidenceKind: 'detail-dual-anchor-readback', eventSeq: 1,
          evidenceSha256: EVIDENCE,
        }];
        const sidecar = identityApi.buildIdentityObservationSidecar({ caseId: HAPPY_CASE_ID, observations });
        const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
        const bound = identityApi.bindCaptureIdentityObservations({
          capture: buildTeachInCapture({
            caseId: HAPPY_CASE_ID, startUrl: '/atl_x/list', createdAt: '2026-07-20T00:00:00.000Z',
            events: [{ action: 'click', path: '/atl_x/list', selector: 'button.new', text: '新增' }],
          }),
          observationRaw: sidecarRaw,
        });
        const sidecarDoc = JSON.parse(sidecarRaw);
        const capture = JSON.parse(JSON.stringify(bound));
        capture.identityObservations.sha256 = `sha256:${createHash('sha256').update(sidecarRaw).digest('hex')}`;
        capture.identityObservations.count = sidecarDoc.observations.length;
        const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
        const manifest = packageApi.buildTeachInPackageManifest({
          caseId: HAPPY_CASE_ID, captureBytes: captureRaw, sidecarBytes: sidecarRaw,
          observationCount: sidecarDoc.observations.length, observationSchemaVersion: sidecarDoc.schemaVersion,
        });
        const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
        const review = packageApi.verifyTeachInPackage({ caseId: HAPPY_CASE_ID, captureBytes: captureRaw, sidecarBytes: sidecarRaw, manifestBytes: manifestRaw });
        if (!review.ok) throw new Error(`三件套自建前提失败（联合闸拒）：${review.reason}`);
        const only = sidecarDoc.observations[0];
        const receiptSansSignature = {
          schemaVersion: 1, artifactKind: 'platform-identity-readback-receipt', source: 'platform-runtime',
          keyId: publication.keyId, algorithm: 'Ed25519', sessionNonce: 'mcp-intake-session-1',
          caseId: sidecarDoc.caseId, captureSha256: review.captureSha256, sidecarSha256: review.sidecarSha256,
          manifestSha256: review.manifestSha256, kind: only.kind, name: only.name, code: only.code,
          platformId: only.platformId, scopeFingerprint: only.scopeFingerprint, eventSeq: only.eventSeq,
          evidenceSha256: only.evidenceSha256,
        };
        const signedReceipt = publication.signReceipt(receiptSansSignature);

        mkdirSync(lease.packageDir, { recursive: true });
        capturePath = join(lease.packageDir, 'teach-in-capture.json');
        ledgerPath = join(lease.packageDir, 'intake-ledger.jsonl');
        writeFileSync(capturePath, captureRaw);
        writeFileSync(join(lease.packageDir, 'identity-observations.json'), sidecarRaw);
        writeFileSync(join(lease.packageDir, 'teach-in-package.json'), manifestRaw);
        writeFileSync(join(lease.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(signedReceipt, null, 2)}\n`);
      } catch (error) {
        fails.push(`A6 三件套自建/签名前置失败：${String((error && error.message) || error)}`);
      }

      if (capturePath) {
        const INTAKE_BIN = join(ROOT, 'bin', 'intake.mjs');

        await checkAsync('A6 独立正控：直接 spawn bin/intake.mjs（同包 + loader，不经 MCP）必须先 accepted——正控不过即本方缺陷，禁降级', async () => {
          const r = spawnSync(process.execPath, ['--experimental-loader', publication.loaderPath, INTAKE_BIN, HAPPY_CASE_ID, '--capture', capturePath], {
            cwd: ROOT, encoding: 'utf8', timeout: 30000, env: { ...process.env },
          });
          if (r.status !== 0) throw new Error(`正控应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
          const raw = readFileSync(ledgerPath, 'utf8');
          const lines = raw.trim().split('\n').filter(Boolean);
          if (lines.length !== 1) throw new Error(`正控后台账应恰一行，实际 ${lines.length}`);
          const entry = JSON.parse(lines[0]);
          if (entry.intakeStatus !== 'accepted') throw new Error(`正控首行应 accepted，实际 ${entry.intakeStatus}`);
          if (entry.ledgerGeneration !== 1) throw new Error(`正控首行 generation 应为 1，实际 ${entry.ledgerGeneration}`);
          baseline = { sha256: createHash('sha256').update(raw).digest('hex'), lines: lines.length };
        });

        await checkAsync('A6 成对证据·无 loader：MCP tools/call casey_intake 精确 DRIVER_NOT_PUBLISHED + [exitCode=65] + 台账字节零变化（对正控后基线）', async () => {
          if (!baseline) throw new Error('正控未产出基线，禁伪造基线继续判定（正控须先修复）');
          const envNoLoader = { ...process.env };
          delete envNoLoader.NODE_OPTIONS;
          const mcpNoLoader = mcpClient(envNoLoader);
          try {
            const r = await mcpNoLoader.rpc('tools/call', { name: 'casey_intake', arguments: { caseId: HAPPY_CASE_ID, capture: capturePath } });
            if (!r.result || !r.result.isError) throw new Error(`无 loader 应 isError true，实际 ${JSON.stringify(r).slice(0, 300)}`);
            const text = r.result.content.map((c) => c.text).join('');
            if (!text.includes('[exitCode=65]')) throw new Error(`无 loader 应含 [exitCode=65]，实际尾部：${text.slice(-200)}`);
            if (!text.includes('DRIVER_NOT_PUBLISHED')) throw new Error(`无 loader 应精确拒因 DRIVER_NOT_PUBLISHED，实际尾部：${text.slice(-300)}`);
          } finally {
            mcpNoLoader.close();
          }
          const raw = readFileSync(ledgerPath, 'utf8');
          const lines = raw.trim().split('\n').filter(Boolean);
          const sha = createHash('sha256').update(raw).digest('hex');
          if (lines.length !== baseline.lines || sha !== baseline.sha256) {
            throw new Error(`无 loader 后台账应字节零变化，实际行数 ${lines.length}（基线 ${baseline.lines}）、sha ${sha.slice(0, 12)}（基线 ${baseline.sha256.slice(0, 12)}）`);
          }
        });

        await checkAsync('A6 MCP intake happy（有 loader）：NODE_OPTIONS 挂 loader 经 MCP 透传生效 → tools/call casey_intake exit 0 + isError:false + 台账恰新增一条 accepted（generation 2）+ 回显无凭据/无裸 ://、无绝对路径', async () => {
          if (!baseline) throw new Error('正控未产出基线，禁伪造基线继续判定（正控须先修复）');
          const envWithLoader = { ...process.env, NODE_OPTIONS: `--experimental-loader=${publication.loaderPath}` };
          const mcpWithLoader = mcpClient(envWithLoader);
          let text = '';
          try {
            const r = await mcpWithLoader.rpc('tools/call', { name: 'casey_intake', arguments: { caseId: HAPPY_CASE_ID, capture: capturePath } });
            if (!r.result || r.result.isError) throw new Error(`有 loader 应成功（isError false），实际 ${JSON.stringify(r).slice(0, 300)}`);
            text = r.result.content.map((c) => c.text).join('');
            if (!text.includes('[exitCode=0]')) throw new Error('有 loader 应含 [exitCode=0] 退出码语义标注');
          } finally {
            mcpWithLoader.close();
          }
          if (text.includes(lease.caseDir)) throw new Error('MCP intake 成功回显不得含用户绝对路径');
          if (/:\/\//.test(text)) throw new Error('回显不得含裸 :// 目标地址');
          const raw = readFileSync(ledgerPath, 'utf8');
          const lines = raw.trim().split('\n').filter(Boolean);
          if (lines.length !== baseline.lines + 1) throw new Error(`有 loader 后台账应恰新增一条，实际行数 ${lines.length}（基线 ${baseline.lines}）`);
          const last = JSON.parse(lines[lines.length - 1]);
          if (last.intakeStatus !== 'accepted') throw new Error(`新增条目应 accepted，实际 ${last.intakeStatus}`);
          if (last.ledgerGeneration !== 2) throw new Error(`新增条目 generation 应为 2，实际 ${last.ledgerGeneration}`);
          if (/:\/\//.test(raw)) throw new Error('台账全文不得含裸 :// 目标地址');
        });
      }
    } finally {
      // 租约清理必须恒执行：publication.cleanup() 的 rmSync 可能抛（EBUSY/权限/DrvFS 瞬态），
      // 不能让它跳过 lease.cleanup()、留 tc_mcp_intake_signed 租约孤儿污染 cases/（codex 评审 round1 Medium）。
      let pubErr = null;
      try { publication.cleanup(); } catch (e) { pubErr = e; }
      const cleaned = lease.cleanup();
      if (!cleaned.ok) fails.push(`A6 租约清理拒绝：${cleaned.reason}`);
      if (pubErr) fails.push(`A6 临时发布清理失败：${String((pubErr && pubErr.message) || pubErr)}`);
    }
  }

  // ---------- A6 负向姊妹：缺三件套 ----------
  await checkAsync('A6 负向姊妹：缺三件套 → MCP casey_intake isError:true + [exitCode=65] + 不回显绝对路径', async () => {
    const negLease = acquireCanonicalCaseLease({ caseId: 'tc_mcp_intake_missing' });
    try {
      const missingCapture = join(negLease.packageDir, 'teach-in-capture.json');
      const r = await mcp.rpc('tools/call', { name: 'casey_intake', arguments: { caseId: 'tc_mcp_intake_missing', capture: missingCapture } });
      if (!r.result || !r.result.isError) throw new Error(`缺三件套应 isError true，实际 ${JSON.stringify(r).slice(0, 300)}`);
      const text = r.result.content.map((c) => c.text).join('');
      if (!text.includes('[exitCode=65]')) throw new Error(`缺三件套应含 [exitCode=65]，实际尾部：${text.slice(-200)}`);
      if (text.includes(negLease.caseDir)) throw new Error('缺三件套失败回显不得含用户绝对路径');
    } finally {
      const cleaned = negLease.cleanup();
      if (!cleaned.ok) throw new Error(`负向姊妹租约 cleanup 拒绝：${cleaned.reason}`);
    }
  });
} finally {
  mcp.close();
}

console.log(`cli-mcp-face golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); }
process.exit(fails.length ? 1 : 0); // 显式退出：C6 导入 server 模块的 readline 副作用会挂住事件循环
