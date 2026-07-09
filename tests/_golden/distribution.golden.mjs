#!/usr/bin/env node
// distribution.golden.mjs —— 分发与接入（distribution，light）红金牌。断言清单见
// docs/plans/distribution/proposed/GOLDEN-TESTPLAN.md（A1-A8；A9-A11 是 codex 跨族评审 mustFix 补丁）。
// 实现前红基线：无 mcp-config 命令（落 default 未知命令 exit 64、无合法配置）、无仓根 AGENTS.md、
//   无 docs/runbooks/onboarding.md、cli-mcp-face 的 EXCLUDED 尚无 mcp-config。
// 不 rig：真跑 casey mcp-config CLI 取真产物（复现真接缝）；路径自适应经独立算的 PROJECT_ROOT 验等
//   （路径由结构派生，任何 clone 位置都对）；零凭据经 cred-gate 单一事实源扫。
// mustFix 补丁（A9-A11）：codex 跨族评审确认 serverAbs 未转义直接拼进 TOML/shell 命令，路径含引号/
//   反斜杠/空格会产坏产物。A9/A10 把真实 bin/mcp-config.mjs + lib/paths.mjs 复制到路径本身含引号/单引号/
//   空格的临时目录再真跑（PROJECT_ROOT 由 import.meta.url 派生，天然带那些字符），不造假期望值。反斜杠
//   场景无法这样在 POSIX 上复现——Node ESM 对任何解析路径里的反斜杠一律拒绝加载（已实测钉死：
//   ERR_INVALID_MODULE_SPECIFIER "must not include encoded / or \ characters"）——A11 改直测导出的
//   tomlEscape/shellQuote 纯函数（真函数真输入，非另造一遍实现来自证），覆盖 Windows 挂载路径场景。
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT } from '../../lib/paths.mjs';
import { FORBIDDEN_KEYWORDS } from '../../lib/cred-gate.mjs';
// main() 已加 isDirectRun 门，import 本文件不会触发 process.exit 副作用（护栏对齐见 bin/mcp-config.mjs）。
import { tomlEscape, shellQuote } from '../../bin/mcp-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const MCP_CONFIG_BIN = join(ROOT, 'bin', 'mcp-config.mjs');

// 期望挂载脚本绝对路径：独立算（与被测同 PROJECT_ROOT 源但各自计算）——路径由结构派生。
const EXPECT_SERVER = join(PROJECT_ROOT, 'mcp', 'casey-server.mjs');

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-400)}`); } }
function runCli(args, extraEnv) {
  return spawnSync(process.execPath, [CASEY, ...args], {
    encoding: 'utf8', timeout: 30000,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
}

// 从输出里抽出含 "mcpServers" 键的 JSON 块 → 返回 mcpServers.casey 对象（括号配平抽取，不靠行号）。
function extractMcpServersCasey(text) {
  const idx = text.indexOf('"mcpServers"');
  if (idx < 0) throw new Error('输出无 mcpServers 键');
  const start = text.lastIndexOf('{', idx);
  if (start < 0) throw new Error('mcpServers 前无 { 起始');
  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('mcpServers JSON 块未配平');
  const obj = JSON.parse(text.slice(start, end + 1));
  if (!obj.mcpServers || !obj.mcpServers.casey) throw new Error('JSON 块无 mcpServers.casey');
  return obj.mcpServers.casey;
}

// 凭据卫生（A4 值形态口径，与 handover-pack C1 同源正则）：拒「关键词=值/关键词:"值"」真值形态，
// 占位符 <…> 放行；拒非回环 URL；拒 user:pass@ 内嵌凭据；拒 D:\ctx 与写死盘符。文档面用此（允许提及
// `.auth/credentials.json`/`site.json` 文件名，只拦真值泄漏）。
function scanCredValueForm(tag, text, out) {
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`(?:^|[^\\w])(?:AT_CREDS_[A-Z]+|[\\w-]*${kw.trim()}[\\w-]*)\\s*[=:]\\s*"?([^\\s"'<\`)]+)`, 'ig');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!/^</.test(m[1])) out.push(`${tag} 疑似携凭据真值形态：${m[0].trim().slice(0, 60)}`);
    }
  }
  for (const um of text.matchAll(/https?:\/\/([^\s/`)]+)/g)) {
    const host = um[1];
    if (/@/.test(host)) out.push(`${tag} URL 含内嵌凭据形态：${um[0].slice(0, 60)}`);
    else if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) out.push(`${tag} 含非回环 URL（真目标地址不进分发文档）：${um[0].slice(0, 60)}`);
  }
  if (/D:\\+ctx/i.test(text)) out.push(`${tag} 含 D:\\ctx 硬编码`);
}

// 零凭据·零目标地址（A4 挂载配置输出口径，最强：纯启动器根本不该有任何凭据词/裸 ://）。
function scanLauncherClean(tag, text, out) {
  const low = text.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (low.includes(kw)) out.push(`${tag} 挂载配置含禁字段关键词「${kw}」（应为纯启动器）`);
  }
  if (/:\/\//.test(text)) out.push(`${tag} 挂载配置含裸 ://（目标地址不进启动器配置）`);
  if (/[\w.-]+:[^\s@/]+@/.test(text)) out.push(`${tag} 挂载配置含 user:pass@ 内嵌凭据形态`);
}

// ---------- mustFix 补丁（A9-A11）专用助手：真 shell/真 TOML 解码验可逆，不靠子串比较 ----------

// 抽 claude 一行命令「  claude mcp add casey -- node <quoted>」的 <quoted> 尾段（到行尾）。
function extractClaudeOneLinerTail(text) {
  const m = text.match(/^ {2}claude mcp add casey -- node (.+)$/m);
  if (!m) throw new Error('未找到 claude 一行等效命令');
  return m[1];
}

// 让真 /bin/sh 解析 quoted 文本并回显——证明产物在真 shell 里能被安全、准确地解析回原串
//   （不是字符串比较，是真让 shell 做词法分析）。
function shellRoundTrip(quoted) {
  const r = spawnSync('/bin/sh', ['-c', `printf '%s' ${quoted}`], { encoding: 'utf8', timeout: 10000 });
  if (r.status !== 0) throw new Error(`shell 解析失败（exit ${r.status}）：${(r.stderr || '').slice(-200)}`);
  return r.stdout;
}

// 抽 codex 输出里单行 `args = ["..."]` 的字符串体（严格锚：body 只能是 (非"非\ | \任意字符)*，
//   贪不过第一个未转义的 "——未转义的引号/反斜杠会让这条正则直接不匹配，天然拦坏 TOML）。
function extractCodexArgsBody(text) {
  const m = text.match(/^args\s*=\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]\s*$/m);
  if (!m) throw new Error('未找到合法的 args = ["..."] 行（可能含未转义的 "/\\，TOML 字符串体非法）');
  return m[1];
}

// TOML basic string 转义解码（规范子集：只认 \\ 与 \"，其余转义序列判非法）——独立实现，不复用被测
//   实现，证「解码得回原串」而非「字符串包含子串」这类弱断言。
function tomlBasicStringDecode(escaped) {
  let out = '';
  for (let i = 0; i < escaped.length; i++) {
    const c = escaped[i];
    if (c === '\\') {
      const n = escaped[++i];
      if (n === '\\') out += '\\';
      else if (n === '"') out += '"';
      else throw new Error(`TOML 转义非法：\\${n}`);
    } else if (c === '"') {
      throw new Error('basic string 体内出现未转义的 "');
    } else {
      out += c;
    }
  }
  return out;
}

// 把真实 bin/mcp-config.mjs + lib/paths.mjs 复制到一个「路径本身含特殊字符」的临时目录再真跑——
//   PROJECT_ROOT 由 import.meta.url 派生，serverAbs 天然带那些字符，复现真接缝而非造假期望值。
function runMcpConfigFromWeirdDir(weirdSegment, agent) {
  const base = mkdtempSync(join(tmpdir(), 'casey-mcpcfg-weird-'));
  const projRoot = join(base, weirdSegment);
  try {
    mkdirSync(join(projRoot, 'bin'), { recursive: true });
    mkdirSync(join(projRoot, 'lib'), { recursive: true });
    writeFileSync(join(projRoot, 'bin', 'mcp-config.mjs'), readFileSync(MCP_CONFIG_BIN, 'utf8'), 'utf8');
    writeFileSync(join(projRoot, 'lib', 'paths.mjs'), readFileSync(join(ROOT, 'lib', 'paths.mjs'), 'utf8'), 'utf8');
    const r = spawnSync(process.execPath, [join(projRoot, 'bin', 'mcp-config.mjs'), '--agent', agent], { encoding: 'utf8', timeout: 30000 });
    return { r, expectAbs: join(projRoot, 'mcp', 'casey-server.mjs') };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

// ---------- A1 mcp-config --agent claude 产合法 .mcp.json 挂载配置 ----------
check('A1 mcp-config --agent claude：exit 0 + 合法 .mcp.json 片段（mcpServers.casey.command=node、args 末项=server 绝对路径）+ claude mcp add 行', () => {
  const r = runCli(['mcp-config', '--agent', 'claude']);
  if (r.status !== 0) throw new Error(`应 exit 0，实得 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const text = (r.stdout || '') + (r.stderr || '');
  const casey = extractMcpServersCasey(text);
  if (casey.command !== 'node') throw new Error(`mcpServers.casey.command 应 'node'，实得 ${JSON.stringify(casey.command)}`);
  if (!Array.isArray(casey.args)) throw new Error('mcpServers.casey.args 应为数组');
  const last = casey.args[casey.args.length - 1];
  if (!(last.endsWith(join('mcp', 'casey-server.mjs')) || last.endsWith('casey-server.mjs'))) throw new Error(`args 末项应 endsWith mcp/casey-server.mjs，实得 ${last}`);
  if (last !== EXPECT_SERVER) throw new Error(`args 末项应=独立算的 PROJECT_ROOT/mcp/casey-server.mjs（${EXPECT_SERVER}），实得 ${last}`);
  // 两形态都给：附一行 claude mcp add casey -- node <同一绝对路径>（shell-quote 过，经真 shell 解析回原路径）。
  const oneLinerTail = extractClaudeOneLinerTail(text);
  const roundTripped = shellRoundTrip(oneLinerTail);
  if (roundTripped !== EXPECT_SERVER) throw new Error(`一行命令经真 shell 解析后应=${EXPECT_SERVER}，实得 ${roundTripped}（原始尾段：${oneLinerTail}）`);
});

// ---------- A2 mcp-config --agent codex 产合法 config.toml 段 ----------
check('A2 mcp-config --agent codex：exit 0 + 合法 [mcp_servers.casey] 段（command = "node"、args = [ 含同一绝对路径）', () => {
  const r = runCli(['mcp-config', '--agent', 'codex']);
  if (r.status !== 0) throw new Error(`应 exit 0，实得 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const text = (r.stdout || '') + (r.stderr || '');
  if (!text.includes('[mcp_servers.casey]')) throw new Error('应含 [mcp_servers.casey] 段头');
  if (!/command\s*=\s*"node"/.test(text)) throw new Error('应含 command = "node"');
  if (!/args\s*=\s*\[/.test(text)) throw new Error('应含 args = [ 起头');
  if (!text.includes(EXPECT_SERVER)) throw new Error(`应含 server 绝对路径 ${EXPECT_SERVER}`);
});

// ---------- A3 路径自适应=模块位置真实解析（非硬编码盘符，核心 F10 根治点）----------
check('A3 路径自适应：两家产出路径===独立算 PROJECT_ROOT/mcp/casey-server.mjs；bin/mcp-config.mjs 源零盘符/固定仓根字面量', () => {
  const rc = runCli(['mcp-config', '--agent', 'claude']);
  const tc = runCli(['mcp-config', '--agent', 'codex']);
  const caseyObj = extractMcpServersCasey((rc.stdout || '') + (rc.stderr || ''));
  const claudePath = caseyObj.args[caseyObj.args.length - 1];
  if (claudePath !== EXPECT_SERVER) throw new Error(`claude 路径应=${EXPECT_SERVER}，实得 ${claudePath}`);
  if (!((tc.stdout || '') + (tc.stderr || '')).includes(EXPECT_SERVER)) throw new Error(`codex 路径应=${EXPECT_SERVER}`);
  // 源码硬编码扫描：无 /mnt/、无 D:\ctx、无 [A-Za-z]:\ 盘符字面量、无写死仓根前缀。
  const src = readFileSync(MCP_CONFIG_BIN, 'utf8');
  if (src.includes('/mnt/')) throw new Error('bin/mcp-config.mjs 源含 /mnt/ 硬编码（路径须从 PROJECT_ROOT 派生）');
  if (/D:\\+ctx/i.test(src) || src.includes('D:\\ctx')) throw new Error('bin/mcp-config.mjs 源含 D:\\ctx 硬编码');
  if (/[A-Za-z]:\\/.test(src)) throw new Error('bin/mcp-config.mjs 源含盘符字面量（[A-Za-z]:\\ 形态）');
  // 路径须经 PROJECT_ROOT 派生（结构证据：源引用 PROJECT_ROOT）。
  if (!/PROJECT_ROOT/.test(src)) throw new Error('bin/mcp-config.mjs 源应从 PROJECT_ROOT 派生挂载脚本路径');
});

// ---------- A4 零凭据·零真目标地址（两家输出 + 不读 site.json/.auth 种子法）----------
check('A4 零凭据零目标地址：两家输出纯启动器（无禁字段词/无裸 :///无 user:pass@）；埋种子 site.json/creds 后跑，输出不含种子（证不读凭据）', () => {
  const rc = runCli(['mcp-config', '--agent', 'claude']);
  const tc = runCli(['mcp-config', '--agent', 'codex']);
  scanLauncherClean('claude', (rc.stdout || '') + (rc.stderr || ''), fails);
  scanLauncherClean('codex', (tc.stdout || '') + (tc.stderr || ''), fails);
  // 种子法：埋唯一种子于临时 site.json/creds，AT_SITE_JSON/AT_CREDS_FILE 指过去 → 输出不含种子（命令根本不读那两处）。
  const tmp = mkdtempSync(join(tmpdir(), 'casey-mcpcfg-seed-'));
  try {
    const SEED = 'ZZSEED_TARGET_a1b2c3';
    const site = join(tmp, 'site.json');
    writeFileSync(site, JSON.stringify({ target: { startUrl: `https://${SEED}.invalid/x`, devProxyUrl: 'http://127.0.0.1:15519' } }), 'utf8');
    const creds = join(tmp, 'creds.json');
    writeFileSync(creds, JSON.stringify({ user: SEED, pass: `${SEED}_p` }), 'utf8');
    for (const agent of ['claude', 'codex']) {
      const r = runCli(['mcp-config', '--agent', agent], { AT_SITE_JSON: site, AT_CREDS_FILE: creds });
      const text = (r.stdout || '') + (r.stderr || '');
      if (text.includes(SEED)) fails.push(`A4 mcp-config --agent ${agent} 泄漏 site.json/creds 种子（不该读凭据/站点）`);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// ---------- A5 缺/错 --agent fail-closed exit 64 ----------
check('A5 缺/错 --agent → exit 64 + 报文列支持项 claude/codex，不静默产配置', () => {
  const miss = runCli(['mcp-config']);
  if (miss.status !== 64) throw new Error(`缺 --agent 应 exit 64，实得 ${miss.status}`);
  const missTxt = (miss.stdout || '') + (miss.stderr || '');
  if (!/claude/.test(missTxt) || !/codex/.test(missTxt)) throw new Error('缺 --agent 报文应列支持项 claude/codex');
  if (/"mcpServers"|\[mcp_servers\.casey\]/.test(missTxt)) throw new Error('缺 --agent 不得产任何配置块');
  const bad = runCli(['mcp-config', '--agent', 'pi']);
  if (bad.status !== 64) throw new Error(`未支持 --agent pi 应 exit 64，实得 ${bad.status}`);
  const badTxt = (bad.stdout || '') + (bad.stderr || '');
  if (!/claude/.test(badTxt) || !/codex/.test(badTxt)) throw new Error('错 --agent 报文应列可选项 claude/codex');
  if (/"mcpServers"|\[mcp_servers\.casey\]/.test(badTxt)) throw new Error('错 --agent 不得静默默认产配置块');
});

// ---------- A6 AGENTS.md 在场且指向 CLAUDE.md + 内核纪律锚 ----------
check('A6 AGENTS.md：在场、指向 CLAUDE.md、含内核纪律锚（自然语言/裁判零/fail-safe/退出码/桩/casey mcp-config/SKILL.md）、凭据卫生干净', () => {
  const p = join(ROOT, 'AGENTS.md');
  if (!existsSync(p)) throw new Error('仓根 AGENTS.md 不存在（codex 等分家 agent 无成文入口）');
  const text = readFileSync(p, 'utf8');
  if (!text.includes('CLAUDE.md')) throw new Error('AGENTS.md 应指向 CLAUDE.md（权威源）');
  for (const anchor of ['自然语言', '裁判零', 'fail-safe', '退出码', '桩', 'casey mcp-config', 'SKILL.md']) {
    if (!text.includes(anchor)) throw new Error(`AGENTS.md 缺内核纪律/接入锚「${anchor}」`);
  }
  scanCredValueForm('A6 AGENTS.md', text, fails);
});

// ---------- A7 跨平台文档形态（onboarding.md：四 OS + 三 agent + 隧道仅 WSL + 字体 + 移交清单）----------
check('A7 docs/runbooks/onboarding.md：四 OS + 三 agent + 隧道仅 WSL + 字体(fc-list/macos/win) + 移交清单(.auth/site.json/cases + 带外/不入库) + 凭据卫生', () => {
  const p = join(ROOT, 'docs', 'runbooks', 'onboarding.md');
  if (!existsSync(p)) throw new Error('docs/runbooks/onboarding.md 不存在');
  const text = readFileSync(p, 'utf8');
  const low = text.toLowerCase();
  for (const os of ['win', 'wsl', 'linux', 'macos']) {
    if (!low.includes(os)) throw new Error(`onboarding.md 缺 OS 锚「${os}」`);
  }
  for (const agent of ['claude code', 'codex', 'pi']) {
    if (!low.includes(agent)) throw new Error(`onboarding.md 缺 agent 锚「${agent}」`);
  }
  if (!/隧道/.test(text)) throw new Error('onboarding.md 应述反向隧道');
  // 「仅 WSL」允许 WSL 被 markdown 代码点/加粗包裹（英文术语走代码体，term-lint 要求）。
  if (!/仅[\s`*]*(WSL|wsl)|(WSL|wsl)`?[^。\n]{0,12}(才|仅)/.test(text)) throw new Error('onboarding.md 应明示隧道仅 WSL+Windows 组合需要');
  if (!/fc-list/.test(text)) throw new Error('onboarding.md 字体节应含 fc-list（WSL/linux）');
  if (!/PingFang|苹方/.test(text)) throw new Error('onboarding.md 字体节应含 macos 字体（PingFang/苹方）');
  if (!/微软雅黑/.test(text)) throw new Error('onboarding.md 字体节应含 Windows 字体（微软雅黑）');
  for (const item of ['.auth', 'site.json', 'cases']) {
    if (!text.includes(item)) throw new Error(`onboarding.md 移交清单缺「${item}」`);
  }
  if (!/带外/.test(text) || !/不入库/.test(text)) throw new Error('onboarding.md 移交清单应写明带外补齐/不入库');
  scanCredValueForm('A7 onboarding.md', text, fails);
});

// ---------- A8 跨金牌一致：mcp-config ∈ cli-mcp-face EXCLUDED（防跨金牌红，核心涟漪钉）----------
check('A8 cli-mcp-face 的 CLI_MCP_EXCLUDED 含 mcp-config（新命令不进 MCP 面须留痕，否则「CLI⊆MCP」派生断言红）', () => {
  const src = readFileSync(join(ROOT, 'tests', '_golden', 'cli-mcp-face.golden.mjs'), 'utf8');
  const m = src.match(/CLI_MCP_EXCLUDED\s*=\s*new Set\(\[([^\]]*)\]\)/);
  if (!m) throw new Error('cli-mcp-face 未找到 CLI_MCP_EXCLUDED 声明');
  if (!/['"]mcp-config['"]/.test(m[1])) throw new Error('cli-mcp-face CLI_MCP_EXCLUDED 未含 mcp-config（落地次序须与 mcp-parity 对齐、重签 prd-cli-mcp-face）');
});

// ---------- A9 TOML 转义：路径含引号/空格（mustFix，codex 跨族评审）----------
check('A9 TOML 转义：路径含 " 与空格时（真复制到该路径运行），codex 输出仍是合法 TOML 字符串——解码回原路径', () => {
  const weirdSegment = 'weird "quo" and space clone';
  const { r, expectAbs } = runMcpConfigFromWeirdDir(weirdSegment, 'codex');
  if (r.status !== 0) throw new Error(`weird-dir codex 应 exit 0，实得 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const text = (r.stdout || '') + (r.stderr || '');
  const body = extractCodexArgsBody(text);
  const decoded = tomlBasicStringDecode(body);
  if (decoded !== expectAbs) throw new Error(`TOML 解码后应=${expectAbs}，实得 ${decoded}（原始转义体：${body}）`);
});

// ---------- A10 shell 转义：路径含单引号/双引号/空格（mustFix，codex 跨族评审）----------
check('A10 shell 转义：路径含 \'/" 与空格时（真复制到该路径运行），claude 一行命令经真 shell 解析仍还原原路径', () => {
  const weirdSegment = "it's \"also quoted\" and space clone";
  const { r, expectAbs } = runMcpConfigFromWeirdDir(weirdSegment, 'claude');
  if (r.status !== 0) throw new Error(`weird-dir claude 应 exit 0，实得 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const text = (r.stdout || '') + (r.stderr || '');
  const tail = extractClaudeOneLinerTail(text);
  const roundTripped = shellRoundTrip(tail);
  if (roundTripped !== expectAbs) throw new Error(`shell 解析后应=${expectAbs}，实得 ${roundTripped}（原始尾段：${tail}）`);
});

// ---------- A11 反斜杠路径（Windows 挂载场景）：直测导出的转义纯函数（mustFix，codex 跨族评审）----------
check('A11 反斜杠+引号+空格路径：tomlEscape/shellQuote 可逆（POSIX 上 Node ESM 拒绝从反斜杠路径加载模块，无法真落盘复现，故直测导出的纯函数，覆盖 WSL/Windows 挂载路径场景）', () => {
  const winLike = 'C:\\Users\\a "weird" name\\casey clone\\mcp\\casey-server.mjs';
  const tomlBody = tomlEscape(winLike);
  const tomlDecoded = tomlBasicStringDecode(tomlBody);
  if (tomlDecoded !== winLike) throw new Error(`tomlEscape 应可逆，实得解码 ${tomlDecoded}（转义体：${tomlBody}）`);
  const shellBody = shellQuote(winLike);
  const shellDecoded = shellRoundTrip(shellBody);
  if (shellDecoded !== winLike) throw new Error(`shellQuote 应可逆（真 shell 解析），实得 ${shellDecoded}（quoted：${shellBody}）`);
});

console.log(`distribution golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
process.exit(0);
