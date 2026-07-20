import { execFileSync as invoke } from 'node:child_process';

export function probe(sutUrl) {
  return invoke(process.execPath, [
    'bin/replay.mjs', '--events', 'events.json', '--sut', sutUrl,
    '--expected', 'expected.json', '--profile', 'profile.json', '--out', 'axes.json',
  ]);
}
