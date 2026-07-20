import { spawnSync } from 'node:child_process';

export function probe() {
  return spawnSync(process.execPath, [
    'bin/replay.mjs', '--events', 'mismatched-events.json', '--sut', 'http://127.0.0.1:1',
    '--expected', 'mismatched-expected.json', '--profile', 'profile.json', '--out', 'axes.json',
  ], { env: { ...process.env, CASEY_LAUNCH_SENTINEL: 'launch-sentinel' } });
}
