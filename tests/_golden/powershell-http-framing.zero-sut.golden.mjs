#!/usr/bin/env node
// PowerShell 反向代理 HTTP/1.1 framing 纯本地验收：直接执行监听器中的纯改写器，不开 socket、不接任何 SUT。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = readFileSync(resolve(ROOT, 'scripts/wsl-reverse-listen.mjs'), 'utf8');
const functionStart = source.indexOf('function makeRewriter');
const functionEnd = source.indexOf('\n}\n\nconst clientServer', functionStart) + 2;
assert.ok(functionStart >= 0 && functionEnd > functionStart, 'makeRewriter source not found');
// 只执行仓内固定函数体；注入其纯常量，不执行监听器顶层启动代码。
const makeRewriter = new Function(
  'Buffer',
  'HOST_HEADER',
  'HEAD_MAX',
  'MAX_BODY_BYTES',
  `${source.slice(functionStart, functionEnd)}; return makeRewriter;`,
)(Buffer, 'framing-target.invalid', 65536, 64 * 1024 * 1024);

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

function run(parts) {
  const writes = [];
  const rewrite = makeRewriter((chunk) => writes.push(Buffer.from(chunk)));
  let accepted = true;
  for (const part of parts) {
    accepted = rewrite(Buffer.from(part, 'latin1'));
    if (!accepted) break;
  }
  return { accepted, writes, output: Buffer.concat(writes).toString('latin1') };
}

const request = (headers, body = '') => `POST /submit HTTP/1.1\r\nHost: 127.0.0.1\r\n${headers}\r\n${body}`;

check('标准 chunked 与空 body 正确闭合', () => {
  const normal = run([request('Transfer-Encoding: chunked\r\n', '4\r\nWiki\r\n0\r\n\r\n')]);
  assert.equal(normal.accepted, true);
  assert.match(normal.output, /Transfer-Encoding: chunked\r\n/);
  assert.match(normal.output, /4\r\nWiki\r\n0\r\n\r\n$/);

  const empty = run([request('Transfer-Encoding: chunked\r\n', '0\r\n\r\n')]);
  assert.equal(empty.accepted, true);
  assert.match(empty.output, /0\r\n\r\n$/);
});

check('chunk extension 与合法 trailer 可跨块解析', () => {
  const raw = request(
    'Transfer-Encoding: chunked\r\nTrailer: X-Checksum\r\n',
    '4;part=yes\r\nWiki\r\n0;done="yes"\r\nX-Checksum: ok\r\n\r\n',
  );
  const result = run([...Buffer.from(raw, 'latin1')].map((byte) => Buffer.from([byte])));
  assert.equal(result.accepted, true);
  assert.match(result.output, /4;part=yes\r\nWiki\r\n/);
  assert.match(result.output, /0;done="yes"\r\nX-Checksum: ok\r\n\r\n$/);
});

check('chunk data 内终止字节串不会提前分帧', () => {
  const sentinelData = '\r\n0\r\n\r\n'; // 7 bytes，合法 chunk data，不是 zero chunk。
  const result = run([request(
    'Transfer-Encoding: chunked\r\n',
    `7\r\n${sentinelData}\r\n3\r\nabc\r\n0\r\n\r\n`,
  )]);
  assert.equal(result.accepted, true);
  assert.equal((result.output.match(/Host: framing-target\.invalid/g) || []).length, 1);
  assert.match(result.output, /7\r\n\r\n0\r\n\r\n\r\n3\r\nabc\r\n0\r\n\r\n$/);
});

check('TE 与 CL 冲突及不支持或歧义 TE 一律拒绝', () => {
  const badHeaders = [
    'Transfer-Encoding: chunked\r\nContent-Length: 4\r\n',
    'Transfer-Encoding: gzip\r\nContent-Length: 4\r\n',
    'Transfer-Encoding: chunked, gzip\r\n',
    'Transfer-Encoding: xchunked\r\n',
    'Transfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\n',
    'Transfer-Encoding:\r\n chunked\r\nContent-Length: 4\r\n',
  ];
  for (const headers of badHeaders) {
    const result = run([request(headers, 'ABCD')]);
    assert.equal(result.accepted, false, headers);
    assert.equal(result.writes.length, 0, headers);
  }
});

check('重复相同 CL 规范化为一条且按精确字节边界转发', () => {
  const first = request('Content-Length: 4\r\nContent-Length: 4\r\n', 'ABCD');
  const second = 'GET /next HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n';
  const joined = first + second;
  const result = run([joined.slice(0, 19), joined.slice(19, 67), joined.slice(67)]);
  assert.equal(result.accepted, true);
  assert.equal((result.output.match(/Content-Length: 4/g) || []).length, 1);
  assert.equal((result.output.match(/Host: framing-target\.invalid/g) || []).length, 2);
  assert.match(result.output, /\r\n\r\nABCDGET \/next HTTP\/1\.1\r\n/);
});

check('超限 header 及非法、冲突与超限 CL 在写出前拒绝', () => {
  const badValues = [
    'Content-Length: 4x\r\n',
    'Content-Length: +4\r\n',
    'Content-Length: 4\r\nContent-Length: 5\r\n',
    'Content-Length: 67108865\r\n',
  ];
  for (const headers of badValues) {
    const result = run([request(headers, 'ABCDE')]);
    assert.equal(result.accepted, false, headers);
    assert.equal(result.writes.length, 0, headers);
  }
  const oversizedHead = run([`GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Fill: ${'a'.repeat(65536)}\r\n\r\n`]);
  assert.equal(oversizedHead.accepted, false);
  assert.equal(oversizedHead.writes.length, 0);
});

check('chunk 累计 body 上限与 framing trailer 禁区 fail-closed', () => {
  const tooLarge = run([request('Transfer-Encoding: chunked\r\n', '4000001\r\n')]);
  assert.equal(tooLarge.accepted, false);
  const forbiddenTrailer = run([request(
    'Transfer-Encoding: chunked\r\n',
    '1\r\na\r\n0\r\nContent-Length: 1\r\n\r\n',
  )]);
  assert.equal(forbiddenTrailer.accepted, false);
});

console.log(`SUMMARY ${passed}/7 PASS`);
if (process.exitCode) process.exit(process.exitCode);
