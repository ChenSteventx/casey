// M5 读盘访问探针（CJS 预载，--require 用）：只记路径、绝不记内容。
// 用途：证明「金牌的传递依赖会不会去读真凭据件」这件事是可机械观测的。
const fs = require('node:fs');
const records = [];
globalThis.__caseyM5FsProbe = records;
function wrap(host, name) {
  const original = host[name];
  if (typeof original !== 'function') return;
  host[name] = function patched(target, ...rest) {
    try { records.push({ api: name, path: String(target) }); } catch { /* 探针绝不回流 */ }
    return original.call(this, target, ...rest);
  };
}
for (const name of ['readFileSync', 'existsSync', 'openSync', 'readFile', 'open', 'createReadStream']) {
  wrap(fs, name);
}
