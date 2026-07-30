#!/usr/bin/env node
// Windows 侧目标连通性探针（开发环境工具，非产品链路）：从 site.json 读目标、请求 startUrl，
// 只打印 HTTP 状态码与耗时；目标地址绝不出现在命令行/输出（护栏 #7）。
// 用法（Windows）：node D:\ctx\heren\casey\scripts\win-probe-target.mjs [--out <结果文件>]
//   带 --out 时另落结构化结果文件（tier-2 前置门「Windows→真实目标段」连通证据，
//   路径由调用方给定；形状只含时间戳、成败、HTTP 状态与耗时——零凭据、零真实地址）。
//   不带 --out 时行为与历来一致：只打 stdout 那一行。
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  if (i < 0) return { given: false, value: null };
  const v = argv[i + 1];
  return { given: true, value: v && !v.startsWith('--') ? resolve(v) : null };
};
const out = valueOf('--out');
const outPath = out.value;
if (out.given && !outPath) {
  console.log('用参错误：--out 缺值（须给结果文件路径）');
  process.exit(64);
}
// 本次尝试挑战字（tier-2 侧发；结果件回填后消费端才认这份结果属于本次探针尝试）。
const challengeArg = valueOf('--challenge');
if (challengeArg.given && !challengeArg.value) {
  console.log('用参错误：--challenge 缺值（须给挑战字文件路径）');
  process.exit(64);
}
let challengeNonce = null;
if (challengeArg.value) {
  try {
    const doc = JSON.parse(readFileSync(challengeArg.value, 'utf8'));
    challengeNonce = typeof doc.nonce === 'string' ? doc.nonce : null;
  } catch { challengeNonce = null; }
  if (!challengeNonce) {
    console.log('用参错误：挑战字文件不可读或无 nonce');
    process.exit(64);
  }
}

// 结构化结果：只写形状字段。地址、请求头、正文一律不进文件。
// 原子写（联审 r1 M3）：先写临时件再 rename——半截件绝不出现在消费路径上；
// 写失败必须非零退出（消费端否则会拿 24 小时窗内的旧成功结果当本次证据）。
function writeResult({ ok, httpStatus, probeMs, failureClass }) {
  if (!outPath) return true;
  const doc = {
    schemaVersion: 1,
    artifactKind: 'tier2-connectivity-probe',
    segment: 'windows-to-target',
    ok,
    httpStatus: httpStatus == null ? null : httpStatus,
    probeMs,
    failureClass: failureClass || null,
    // 回填本次挑战字：消费端据此认定「这份结果属于本次探针尝试」（删旧件删不掉也不怕）。
    challengeNonce,
    producedAt: new Date().toISOString(),
  };
  const tmp = `${outPath}.tmp-${process.pid}`;
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    renameSync(tmp, outPath);
    return true;
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* 尽力 */ }
    // 旧成功件尽力作废（联审 r2 M3）；删不掉也不致命——权威作废靠挑战字绑定（r3 M3）：
    //   旧件带的是上一次的 nonce，消费端一律不认。
    let invalidated = true;
    try { rmSync(outPath, { force: true }); } catch { invalidated = false; }
    // 不回显路径细节（防泄漏）；请求了结果文件却没落成 = 本次探针不算数。
    console.log(invalidated
      ? '结果文件写入失败：本次探针结果不作数，旧结果件已作废（详情已抑制）'
      : '结果文件写入失败：本次探针结果不作数；旧结果件删除亦失败，改由挑战字绑定作废（详情已抑制）');
    return false;
  }
}
// 退出码：0 连通且（如请求）结果文件已落；1 连通性失败；65 连通成功但结果文件未落成。
function finish(connOk, wrote) {
  process.exit(connOk ? (wrote ? 0 : 65) : 1);
}

const site = JSON.parse(readFileSync(join(HERE, '..', 'site.json'), 'utf8'));
const t0 = Date.now();
const req = http.get(site.target.startUrl, (res) => {
  const probeMs = Date.now() - t0;
  console.log(`目标可达：HTTP ${res.statusCode}（${probeMs}ms）`);
  const wrote = writeResult({ ok: true, httpStatus: res.statusCode, probeMs });
  res.resume();
  res.on('end', () => finish(true, wrote));
});
req.setTimeout(8000, () => {
  console.log('目标不可达：8s 超时（SYN 无响应或服务未应答）');
  writeResult({ ok: false, httpStatus: null, probeMs: Date.now() - t0, failureClass: 'timeout' });
  req.destroy();
  finish(false, false);
});
req.on('error', (e) => {
  console.log(`目标不可达：${e.code || e.message}`);
  writeResult({ ok: false, httpStatus: null, probeMs: Date.now() - t0, failureClass: e.code || 'error' });
  finish(false, false);
});
