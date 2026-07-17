// TEST-ONLY publication module. Production registry must stay empty until a real signed release resource exists.
import { readFileSync } from 'node:fs';
const KEY_ID = 'casey-driver-ed25519-v1';
const PUBLIC_KEY = readFileSync(new URL('../teachin-observation-safe-case-lease-v2/trusted-driver-public-key.pem', import.meta.url), 'utf8');
export function trustedDriverPublicKeyFor(keyId) { return keyId === KEY_ID ? PUBLIC_KEY : null; }
export function driverRegistryReadiness() {
  return Object.freeze({ ready: true, reason: null, route: 'test-only', publication: 'isolated-test-loader' });
}

