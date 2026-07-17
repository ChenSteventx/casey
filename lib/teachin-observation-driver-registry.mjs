// 可信录制 driver 的固定 Ed25519 公钥注册表。
// 信任根只能由代码评审修改；不读环境变量、receipt 同目录文件或调用者参数。
const TRUSTED_DRIVER_KEYS = Object.freeze({
  'casey-driver-ed25519-v1': '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAHf73+IddzwQvrQ3uQokBYK7Xxw/tzpTSet8Sd3BNnAA=\n-----END PUBLIC KEY-----\n',
});

export function trustedDriverPublicKeyFor(keyId) {
  if (typeof keyId !== 'string') return null;
  return Object.hasOwn(TRUSTED_DRIVER_KEYS, keyId) ? TRUSTED_DRIVER_KEYS[keyId] : null;
}
