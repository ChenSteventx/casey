import { execFile as invoke } from 'node:child_process';

const REPLAY = 'bin/replay.mjs';

export function probe(sutUrl) {
  const argv = ['--events', 'events.json'];
  argv.push('--sut', sutUrl);
  argv.push('--expected', 'expected.json', '--profile', 'profile.json', '--out', 'axes.json');
  return invoke(REPLAY, argv);
}
