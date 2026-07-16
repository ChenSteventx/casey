#!/usr/bin/env node
// Windows 侧真实目标连通性探针。目标只从 site.json 读入内存，输出仅含状态码与耗时。
// 本脚本会连接真实目标，只能在明确进行真机就绪检查时运行；不得用于零 SUT 安装验收。
import http from 'node:http';
import https from 'node:https';
import { readTunnelConfig } from './tunnel-config.mjs';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

let target;
try {
  ({ target } = readTunnelConfig());
} catch {
  fail('目标探针启动失败：站点配置无效', 64);
}

const transport = target.protocol === 'https:' ? https : http;
const t0 = Date.now();
let req;
try {
  req = transport.get(target, (res) => {
    console.log(`目标可达：HTTP ${res.statusCode}（${Date.now() - t0}ms）`);
    res.resume();
    res.on('end', () => process.exit(0));
  });
} catch {
  fail('目标不可达：请求初始化失败');
}

req.setTimeout(8000, () => {
  console.log('目标不可达：8s 超时（网络或服务未应答）');
  req.destroy();
  process.exit(1);
});
req.on('error', () => fail('目标不可达：网络或证书校验失败'));

process.on('uncaughtException', () => fail('目标探针运行失败：详情已抑制'));
process.on('unhandledRejection', () => fail('目标探针运行失败：详情已抑制'));
