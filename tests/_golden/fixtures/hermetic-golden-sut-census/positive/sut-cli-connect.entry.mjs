import { spawnSync as invoke } from 'node:child_process';

export function probe(sutUrl) {
  const argv = ['bin/replay.mjs', '--events', 'events.json'];
  argv.push('--sut', sutUrl, '--expected', 'expected.json', '--profile', 'profile.json', '--out', 'axes.json');
  return invoke(process.execPath, argv);
}
