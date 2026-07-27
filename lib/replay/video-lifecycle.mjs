import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export function createReplayVideoLifecycle() {
  let sweepDir = null;

  function setSweepDir(nextDir) {
    sweepDir = nextDir || null;
  }

  function sweep() {
    if (!sweepDir) return;
    try {
      for (const file of readdirSync(sweepDir)) {
        if (file.endsWith('.webm')) rmSync(join(sweepDir, file));
      }
    } catch {
      // Cleanup is best-effort; callers retain the authoritative failure.
    }
  }

  async function discard(context) {
    sweep();
    try {
      await Promise.race([
        context.close(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch {
      // Cleanup is best-effort; callers retain the authoritative failure.
    }
    sweep();
  }

  return Object.freeze({ setSweepDir, sweep, discard });
}
