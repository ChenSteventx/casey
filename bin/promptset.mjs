#!/usr/bin/env node
// bin/promptset.mjs —— 数据驱动被测参数编排器（regress-promptset，scope A）。零 LLM。
// 一条冻结 chat flow 跑 N 行被测参数：每行一 caseId 子目录（录屏/裁定/报告），末了聚合一份总目录。
//
//   node bin/promptset.mjs --promptset <f> --flow <events.json> --expected <frozen.json> --profile <f> --sut <base> --entity-locks <f>
//        [--run-dir <d>] [--generated-at <iso>] [--no-builtin | --builtin-dir <d>] [--video]
//
// 逐行：overlayPromptset 定位唯一 {{promptText}} 槽 → replay（--prompt-text 注入本行被测参数 + --soft-expect 本行软期望）
//   → verdict（零 LLM）→ report-model（--promptset-meta 投影 promptset 块）→ report（落本行子目录）；末了 report --aggregate。
// 内核一字不让：裁判零 LLM（直调冻结 verdict.mjs）、软期望绝不进裁定（--soft-expect 强制 soft、护栏 #17）、
//   不碰冻结/人签闸（冻的是母体 flow + 结构硬断言、非 N 份）、护栏 #7 凭据门由 report 落盘口兜。
// 退出码：0 成功；64 缺必填参；1 装配/回放/读写失败（fail-closed，不吞错）；2 熔断/互锁（透传）。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, NODE_EXE, isSafeCaseId } from '../lib/paths.mjs';
import { parsePromptset, loadBuiltinLibs, mergeCases, overlayPromptset } from '../lib/promptset.mjs';

const C = { reset: '\x1b[0m', gray: '\x1b[90m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m' };
const col = (c, s) => `${c}${s}${C.reset}`;
const bin = (s) => path.join(PROJECT_ROOT, 'bin', s);

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts[a.slice(2)] = true;
  }
  return opts;
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(col(C.red, `[promptset] 读/解析 ${label} 失败（不是合法 JSON 或不可读，内容不回显）`)); process.exit(1); }
}

function runNode(scriptAbs, args) {
  const r = spawnSync(NODE_EXE, [scriptAbs, ...args], { cwd: PROJECT_ROOT, stdio: 'pipe', encoding: 'utf8' });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}
// 退出码归一：各阶段自有码（replay 0/1/64/65、verdict 0/64/65、report 0/1/2/64/65）→ 统一图例；任一非零 fail-closed。
const normCode = (code) => (code === 2 ? 2 : code === 64 ? 64 : 1);

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const need = ['promptset', 'flow', 'expected', 'profile', 'sut', 'entity-locks'];
  const missing = need.filter((k) => !opts[k] || opts[k] === true);
  if (missing.length) {
    console.error(col(C.red, `[promptset] 缺必填参 → 用参错误(64)：${missing.map((m) => '--' + m).join(' ')}`));
    console.error('用法: node bin/promptset.mjs --promptset <f> --flow <events.json> --expected <frozen.json> --profile <f> --sut <本地基址> --entity-locks <entity-locks.frozen.json>');
    console.error('           [--run-dir <d>] [--generated-at <iso>] [--no-builtin | --builtin-dir <d>] [--video]');
    process.exit(64);
  }

  // 1) 解析 promptset + 并入随发注入向量库（默认并入；--no-builtin 关；--builtin-dir 覆盖默认 prompts/_lib）。
  let cases;
  try {
    cases = parsePromptset(readJson(opts.promptset, 'promptset'));
    if (!opts['no-builtin']) {
      const libDir = (typeof opts['builtin-dir'] === 'string' && opts['builtin-dir']) ? path.resolve(opts['builtin-dir']) : path.join(PROJECT_ROOT, 'prompts', '_lib');
      cases = mergeCases(cases, loadBuiltinLibs(libDir));
    }
  } catch (e) { console.error(col(C.red, `[promptset] promptset/注入向量库 校验失败（fail-closed）：${e.message}`)); process.exit(1); }

  // 2) 读冻结 flow + overlay 定位唯一提示槽 + 逐行展开（绝不改 flow，跨行只变 ctx.promptText）。
  const events = readJson(opts.flow, 'flow');
  const caseId = events.caseId;
  if (!isSafeCaseId(caseId)) { console.error(col(C.red, '[promptset] flow.caseId 不安全（须单段目录名）')); process.exit(1); }
  let overlay;
  try { overlay = overlayPromptset({ events, cases }); }
  catch (e) { console.error(col(C.red, `[promptset] overlay 失败（fail-closed）：${e.message}`)); process.exit(1); }

  const runDir = opts['run-dir'] ? path.resolve(opts['run-dir']) : path.join(PROJECT_ROOT, 'runs', caseId, `promptset_${Date.now()}`);
  fs.mkdirSync(runDir, { recursive: true });
  const gen = opts['generated-at'] || new Date().toISOString();

  const stage = (label, scriptAbs, args) => {
    const r = runNode(scriptAbs, args);
    if (r.code !== 0) {
      console.error(col(C.red, `[promptset] 阶段「${label}」非零退出（${r.code}）→ fail-closed`));
      if (r.stderr) console.error(col(C.gray, r.stderr.slice(-500)));
      process.exit(normCode(r.code));
    }
  };

  console.log(col(C.gray, `[promptset] ${overlay.rows.length} 行被测参数（槽 ${overlay.slot.stepId}/${overlay.slot.intentId}）→ ${runDir}`));
  for (const row of overlay.rows) {
    const rowDir = path.join(runDir, row.promptId);
    fs.mkdirSync(rowDir, { recursive: true });
    const softFile = path.join(rowDir, 'soft-expect.json');
    const metaFile = path.join(rowDir, 'promptset-meta.json');
    fs.writeFileSync(softFile, JSON.stringify(row.softExpect, null, 2));
    fs.writeFileSync(metaFile, JSON.stringify(row.promptsetMeta, null, 2));
    const axesOut = path.join(rowDir, 'axes.json');
    const verdictOut = path.join(rowDir, 'verdict.json');
    const modelOut = path.join(rowDir, 'report-model.json');

    stage(`相3 replay(${row.promptId})`, bin('replay.mjs'), [
      '--events', path.resolve(opts.flow), '--sut', String(opts.sut), '--expected', path.resolve(opts.expected),
      '--profile', path.resolve(opts.profile), '--out', axesOut, '--prompt-text', row.promptText, '--soft-expect', softFile,
      '--entity-locks', path.resolve(opts['entity-locks']),
      ...(opts.video ? ['--video-dir', rowDir] : []),
    ]);
    stage(`相4 verdict(${row.promptId})`, bin('verdict.mjs'), ['--axes', axesOut, '--out', verdictOut]);
    const rmArgs = ['--verdict', verdictOut, '--axes', axesOut, '--events', path.resolve(opts.flow), '--expected', path.resolve(opts.expected),
      '--promptset-meta', metaFile, '--out', modelOut, '--generated-at', gen];
    stage(`报表装配(${row.promptId})`, bin('report-model.mjs'), rmArgs);
    stage(`相6 report(${row.promptId})`, bin('report.mjs'), ['--model', modelOut, '--out', rowDir]);
    console.log(col(C.gray, `  ✓ ${row.promptId}（${row.category}）→ ${rowDir}/${caseId}.report.{html,md,json}`));
  }

  // 3) 聚合总目录：扫 runDir/*/<caseId>.report.json → index.report.{html,md,json}。
  stage('聚合总目录', bin('report.mjs'), ['--aggregate', runDir, '--out', runDir, '--generated-at', gen]);

  console.log(col(C.green, `\n[promptset] 端到端 GREEN → ${runDir}`));
  console.log(col(C.gray, `  ${overlay.rows.length} 行逐行报告 + index.report.{html,md,json}（总目录：按 category 分段 + 置顶横幅 + content-expect 黄标）`));
  process.exit(0);
}

main();
