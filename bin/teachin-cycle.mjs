#!/usr/bin/env node
// 示教复现闭环的薄别名入口。闭环必须在同一进程里从录制交出 live handles，
// 因此本文件不自行执行准入、复现、编译或比较，只把调用原样转交同进程录制入口
// bin/record.mjs（透传参数在前，--login-bootstrap 追加在末位）；它才拥有
// recording Browser/Context。
//
// 技术闭环恒为开发期候选：本入口不产测试结论，也不产正式报告。

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECORD_ENTRY = path.join(PROJECT_ROOT, 'bin', 'record.mjs');
const USAGE = [
  '用法: casey teachin-cycle <caseId> --sut <本地基址> --out-dir <d>',
  '  --testcase <f> --expected <f> --entity-lock <f> --profile <f>',
  '  --sut-build-digest <sha256:...> [--headless --max-ms <ms>]',
  '兼容: 可用 --cycle-plan <f> 作为 mapping/expected 模板；capture 身份仍重绑本次录制。',
].join('\n');

const rest = process.argv.slice(2);
if (rest.includes('--help') || rest.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

// --login-bootstrap 必须追加在透传参数之后：record 的通用解析器把 `--key` 后面
// 紧跟的非 `--` token 当成该旗标的值，前插会把位置参数 caseId 吃掉；尾位无后继
// token，解析为布尔，caseId 保持首位。
const result = spawnSync(process.execPath, [RECORD_ENTRY, ...rest, '--login-bootstrap'], {
  stdio: 'inherit',
  shell: false,
});
process.exit(typeof result.status === 'number' ? result.status : 1);
