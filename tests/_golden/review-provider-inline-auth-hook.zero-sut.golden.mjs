#!/usr/bin/env node
// zero-SUT：只验证 UserPromptSubmit hook 的固定上下文、接线与禁凭据探测；不调用任何评审模型或网络。
import {
  closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HOOK_REL = process.env.CASEY_REVIEW_PROVIDER_HOOK || 'bin/review-provider-context-hook.mjs';
const HOOK = join(ROOT, HOOK_REL);
const SETTINGS = join(ROOT, '.claude/settings.json');
const AGENTS = join(ROOT, 'AGENTS.md');
const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseContext(stdout, label) {
  let value;
  try { value = JSON.parse(stdout); }
  catch { throw new Error(`${label} 输出不是唯一合法 JSON（hook=${HOOK}）：${JSON.stringify(stdout)}`); }
  const specific = value?.hookSpecificOutput;
  assert(specific?.hookEventName === 'UserPromptSubmit', `${label} hookEventName 不符`);
  assert(typeof specific.additionalContext === 'string', `${label} additionalContext 缺失`);
  return specific.additionalContext;
}

function runHook(input, label) {
  return new Promise((resolve, reject) => {
    const captureDir = mkdtempSync(join(tmpdir(), 'casey-provider-hook-'));
    const stdoutPath = join(captureDir, 'stdout');
    const stderrPath = join(captureDir, 'stderr');
    const stdoutFd = openSync(stdoutPath, 'w');
    const stderrFd = openSync(stderrPath, 'w');
    let fdsClosed = false;
    const closeFds = () => {
      if (fdsClosed) return;
      fdsClosed = true;
      closeSync(stdoutFd);
      closeSync(stderrFd);
    };
    const cleanup = () => rmSync(captureDir, { recursive: true, force: true });
    const child = spawn(process.execPath, [HOOK], {
      cwd: ROOT,
      stdio: ['pipe', stdoutFd, stderrFd],
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      closeFds();
      cleanup();
      reject(new Error(`${label} 超过 10 秒未退出`));
    }, 10_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      closeFds();
      cleanup();
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      closeFds();
      const stdout = readFileSync(stdoutPath, 'utf8');
      const stderr = readFileSync(stderrPath, 'utf8');
      cleanup();
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function runCleanHook(input, label) {
  const result = await runHook(input, label);
  assert(result.signal === null, `${label} 被信号终止：${result.signal}`);
  assert(result.code === 0, `${label} exit=${result.code}，stderr=${JSON.stringify(result.stderr)}`);
  assert(result.stderr === '', `${label} stderr 非空：${JSON.stringify(result.stderr)}`);
  return {
    ...result,
    context: parseContext(result.stdout, label),
  };
}

const REQUIRED = [
  'Grok 与 pi.dev 均已配置、可使用',
  '认证由各自调用链内联处理',
  '禁止搜索、读取、推断或回显账号、密码、token、API key',
  '禁止用裸 CLI 的 --list-models、No API key 或公开配置缺失判定不可用',
  '直接使用项目既定的已配置调用入口',
  '只有真实任务调用失败才按实际输出记 HARNESS_ERROR',
  'Claude Code 当前无额度：不探测、不调用、不回退',
];

await check('H1 hook 文件存在', () => {
  assert(existsSync(HOOK), `${HOOK_REL} 不存在`);
});

await check('H2 任意合法提示恒定注入同一供应方规则', async () => {
  assert(existsSync(HOOK), 'hook 不存在');
  const prompts = ['你好', '实现一个功能', '请做异构评审'];
  const runs = [];
  for (const [index, prompt] of prompts.entries()) {
    runs.push(await runCleanHook(
      JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt }),
      `prompt-${index + 1}`,
    ));
  }
  const contexts = runs.map((run) => run.context);
  assert(contexts.every((value) => value === contexts[0]), '不同提示得到的供应方上下文漂移');
  for (const phrase of REQUIRED) assert(contexts[0].includes(phrase), `缺核心句：${phrase}`);
  assert(!/sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}/.test(contexts[0]), '上下文疑似含凭据值');
});

await check('H3 零输入依赖：空/坏输入不改变固定输出', async () => {
  assert(existsSync(HOOK), 'hook 不存在');
  const empty = await runCleanHook('', 'empty');
  const bad = await runCleanHook('not-json\n', 'bad-json');
  assert(empty.stdout === bad.stdout, '空/坏输入 stdout 字节不一致');
  assert(empty.context === bad.context, '空/坏输入上下文漂移');
});

await check('H4 hook 源码无认证探测、子进程或网络能力', () => {
  assert(existsSync(HOOK), 'hook 不存在');
  const source = readFileSync(HOOK, 'utf8');
  for (const forbidden of [
    "node:fs",
    "node:child_process", "node:http", "node:https", "node:net", "node:tls", "node:readline",
    'readFileSync(', 'process.env', 'process.stdin', 'homedir(', 'readdirSync(', 'existsSync(',
    'spawnSync(', 'spawn(', 'execSync(', 'exec(', 'fetch(', 'createInterface(', 'import(',
  ]) assert(!source.includes(forbidden), `源码含禁用能力：${forbidden}`);
  for (const forbiddenImport of [
    /(?:from\s*|import\s*\(|require\s*\()["'](?:fs|child_process|http|https|net|tls|readline)["']/,
  ]) assert(!forbiddenImport.test(source), `源码含无 node: 前缀的禁用模块导入：${forbiddenImport}`);
  assert(source.includes('export function renderReviewProviderHookOutput()'), 'hook 缺纯渲染函数');
  assert(source.includes('const payload = renderReviewProviderHookOutput()'), 'CLI 未复用纯渲染函数');
  assert(source.includes('process.stdout.write(payload, done)'), 'hook 未等待 stdout write callback');
});

await check('H5 settings 保留 triage 并追加唯一 provider hook', () => {
  const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
  const commands = (settings?.hooks?.UserPromptSubmit || [])
    .flatMap((entry) => entry?.hooks || [])
    .map((hook) => hook?.command)
    .filter(Boolean);
  const triage = 'node "$CLAUDE_PROJECT_DIR/loop-kit/bin/hook-loop-triage.mjs"';
  const provider = 'node "$CLAUDE_PROJECT_DIR/bin/review-provider-context-hook.mjs"';
  assert(commands.filter((value) => value === triage).length === 1, '原 triage hook 未精确保留一次');
  assert(commands.filter((value) => value === provider).length === 1, 'provider hook 未精确接线一次');
});

await check('H6 AGENTS 为 Codex 固定同义硬规则', () => {
  const source = readFileSync(AGENTS, 'utf8');
  assert(source.includes('评审供应方认证纪律'), 'AGENTS 缺供应方纪律标题');
  for (const phrase of REQUIRED) assert(source.includes(phrase), `AGENTS 缺核心句：${phrase}`);
});

if (failures.length) {
  console.error(`\nreview-provider-inline-auth-hook: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`\nreview-provider-inline-auth-hook: ${passed}/6 GREEN`);
