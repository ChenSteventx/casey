import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeRunVerdict } from '../../lib/run-outcome.mjs';

const root = resolve(import.meta.dirname, '../..');
let passed = 0;
function check(ok, label) {
  if (!ok) throw new Error(label);
  passed += 1;
}

check(summarizeRunVerdict({ steps: [{ verdict: 'PASS' }] }).allPass === true, '单 PASS 应成功');
check(summarizeRunVerdict({ steps: [{ verdict: 'PASS' }, { verdict: 'NEEDS_HUMAN' }] }).allPass === false, '混合裁定不得成功');
check(summarizeRunVerdict({ steps: [] }).allPass === false, '空裁定不得成功');
check(summarizeRunVerdict({ steps: [{ verdict: 'ALIEN' }] }).malformed === true, '未知裁定须畸形');

const cli = readFileSync(resolve(root, 'bin/casey.mjs'), 'utf8');
const replay = readFileSync(resolve(root, 'bin/replay.mjs'), 'utf8');
const deletion = readFileSync(resolve(root, 'lib/workflow-delete-domain.mjs'), 'utf8');
check(cli.includes("summarizeRunVerdict") && cli.includes("process.exit(outcome.allPass ? 0 : 1)"), 'run 退出码须绑定 verdict');
check(cli.includes("'--unique-name', opts['unique-name']") && replay.includes("o.uniqueName = argv[++i]"), 'run 令牌须透传 replay');
// 2026-07-22 修陈旧红：ctx 构造已多行化（regress-promptset 起加 promptText/profile/身份扩展位），
// 单行字面在 82484ab 前即失配；检查改钉「显式令牌进实例化上下文」的语义行（仍是源码结构面）。
check(replay.includes('uniqueName, baseUrl: sut,'), '实例化须使用显式令牌');
check(deletion.includes('waitForTargetRecordDomain') && deletion.includes('TARGET_RECORD_TIMEOUT_MS'), '删除前须有界等待目标记录');

console.log(`real-run-trust zero-SUT: PASS ${passed}/8`);
