#!/usr/bin/env node
// Windows ACL acceptance helper. Inputs are environment-only so account canaries never enter argv.
import { writeAiMiddleAccount } from '../../lib/account-config.mjs';

if (process.platform !== 'win32') process.exit(2);
try {
  writeAiMiddleAccount({
    authDir: process.env.CASEY_TEST_AUTH_DIR,
    user: process.env.AT_CREDS_USER,
    pass: process.env.AT_CREDS_PASS,
  });
  process.exit(0);
} catch {
  process.exit(1);
}
