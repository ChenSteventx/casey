import { spawnSync } from 'node:child_process';

export function probe() {
  return spawnSync(process.execPath, [
    'bin/record.mjs', 'tc_fixture', '--sut', 'http://127.0.0.1:9', '--out-dir', 'out',
    '--no-login', '--from-events', 'events.json',
  ]);
}
