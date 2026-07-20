import { spawnSync as invoke } from 'node:child_process';

const CASEY = 'bin/casey.mjs';

export function probe(sutUrl) {
  const args = ['run', 'tc_fixture'];
  args.push('--sut', sutUrl);
  return invoke(process.execPath, [CASEY, ...args]);
}
