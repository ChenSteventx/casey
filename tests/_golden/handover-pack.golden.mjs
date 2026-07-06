// handover-pack.golden.mjs —— 移交包漂移锁（handover-pack，light）红金牌。实现前红：README 不存在、
// help 三处过时文案在、mcp/SKILL 带 D:\ 硬编码。锁三面：README 八节锚在场且零凭据真值形态；
// casey help 无过时形态有真形态；文档零跨机失真硬编码。README 再滞后/被删/help 回潮即红。
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_KEYWORDS } from '../../lib/cred-gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && e.message).slice(-300)}`); } }

// ---------- C1 README 八节锚 + 凭据卫生 ----------
check('C1 README 在场、八节锚标题齐、零凭据真值形态', () => {
  const p = join(ROOT, 'README.md');
  if (!existsSync(p)) throw new Error('README.md 不存在（移交入口缺席）');
  const text = readFileSync(p, 'utf8');
  const anchors = ['三面', '安装', '环境验收', '凭据', '真机链路', 'MCP 挂载', 'hooks', '分发'];
  for (const a of anchors) if (!text.includes(a)) throw new Error(`README 缺关键节锚「${a}」`);
  // 凭据卫生（codex R1-F4 升级）：① 词表取 cred-gate FORBIDDEN_KEYWORDS 单一事实源，任何「关键词=值」
  // 「关键词: "值"」形态（含 AT_CREDS_PASS=x env 形态）只许占位符（<…>/`）；② 全部 URL 须回环
  // （127.0.0.1/localhost）——真目标地址绝不进移交文档；③ 拒 user:pass@ 内嵌凭据 URL。
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`(?:^|[^\\w])(?:AT_CREDS_[A-Z]+|[\\w-]*${kw.trim()}[\\w-]*)\\s*[=:]\\s*"?([^\\s"'<\`)]+)`, 'ig');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!/^</.test(m[1])) throw new Error(`README 疑似携凭据真值形态：${m[0].trim().slice(0, 60)}`);
    }
  }
  for (const um of text.matchAll(/https?:\/\/([^\s/`)]+)/g)) {
    const host = um[1];
    if (/@/.test(host)) throw new Error(`README URL 含内嵌凭据形态：${um[0].slice(0, 60)}`);
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new Error(`README 含非回环 URL（真目标地址不进移交文档）：${um[0].slice(0, 60)}`);
  }
  if (!/带外|不入库|绝不.*(提交|入库)/.test(text)) throw new Error('README 凭据节须写明真值带外交付/不入库');
  if (!/绝不.*(命令行|shell)|命令行.*绝不/.test(text)) throw new Error('README 须写明真目标地址绝不进命令行（--sut 值纪律，codex R1-F1）');
});

// ---------- C2 casey help 过时形态清零 + 真形态在场 ----------
check('C2 casey help：无过时形态（run <file>/--build <id>]/P0+P1 页脚），真形态锚齐', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'casey.mjs'), 'help'], { encoding: 'utf8', timeout: 30000 });
  const txt = (r.stdout || '') + (r.stderr || '');
  for (const stale of ['run <file>', '--build <id>]', 'P0 引导 + P1 词表/ADR 已落地', '--sut <url>']) {
    if (txt.includes(stale)) throw new Error(`help 仍含过时/诱导形态「${stale}」（--sut 值纪律：真目标地址绝不进命令行，codex R1-F1）`);
  }
  // 关键旗标锚集（codex R1-F3 修正采纳：不复刻全量 synopsis 防双倍维护，锚集盖回归方向）。
  // --resign/--force 属 bin/sign.mjs:84 真用法串（codex R2 对账：包内基线摘写不全的假矛盾，help 为准确面）。
  for (const fresh of ['--against-build', '--signed-at', '--verdict-baseline', '--resign', '--force', '--archive-dir', '--events', '--expected', '--skip-login', '--unique-name', '--sut <本地基址>', '七相']) {
    if (!txt.includes(fresh)) throw new Error(`help 缺真形态锚「${fresh}」`);
  }
});

// ---------- C3 文档零跨机失真硬编码 ----------
check('C3 mcp 头注释与 SKILL.md 零 D:\\ctx 硬编码（换机/换路径即失真）', () => {
  for (const f of [join(ROOT, 'mcp', 'casey-server.mjs'), join(ROOT, '.claude', 'skills', 'casey', 'SKILL.md')]) {
    const text = readFileSync(f, 'utf8');
    if (/D:\\+ctx/i.test(text) || text.includes('D:\\ctx')) throw new Error(`${f} 仍含 D:\\ctx 硬编码`);
  }
});

console.log(`handover-pack golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
