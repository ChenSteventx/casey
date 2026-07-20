import { spawn as invoke } from 'node:child_process';

export function probe(sutUrl) {
  const argv = ['bin/compile.mjs', 'tc_fixture', '--execute'];
  argv.push('--testcase', 'testcase.json');
  argv.push('--sut');
  argv.push(sutUrl);
  argv.push('--out-dir', 'out');
  return invoke(process.execPath, argv);
}
