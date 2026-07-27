import { relative, resolve, sep } from 'node:path';
import { PROJECT_ROOT } from '../paths.mjs';

export function parseReplayArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--events') options.events = argv[++index];
    else if (argument === '--sut') options.sut = argv[++index];
    else if (argument === '--expected') options.expected = argv[++index];
    else if (argument === '--profile') options.profile = argv[++index];
    else if (argument === '--out') options.out = argv[++index];
    else if (argument === '--entity-locks') options.entityLocks = argv[++index];
    else if (argument === '--login-bootstrap') options.loginBootstrap = true;
    else if (argument === '--run-history') options.runHistory = argv[++index];
    else if (argument === '--run-metrics') options.runMetrics = argv[++index];
    else if (argument === '--run-id') options.runId = argv[++index];
    else if (argument === '--video-dir') options.videoDir = argv[++index];
    else if (argument === '--unique-name') options.uniqueName = argv[++index];
    else if (argument === '--prompt-text') options.promptText = argv[++index];
    else if (argument === '--soft-expect') options.softExpect = argv[++index];
  }
  return options;
}

// File arguments only select a PRD-frozen artifact key. File contents confer no
// replay authority.
export function projectReplayArtifactKey(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const rel = relative(PROJECT_ROOT, resolve(input));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}
