#!/usr/bin/env node
// Windows 侧目标连通性探针（开发环境工具，非产品链路）：从 site.json 读目标、请求 startUrl，
// 只打印 HTTP 状态码与耗时；目标地址绝不出现在命令行/输出（护栏 #7）。
// 用法（Windows）：在仓根运行 node scripts/win-probe-target.mjs
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(HERE, '..', 'site.json'), 'utf8'));
const t0 = Date.now();
const req = http.get(site.target.startUrl, (res) => {
  console.log(`目标可达：HTTP ${res.statusCode}（${Date.now() - t0}ms）`);
  res.resume();
  res.on('end', () => process.exit(0));
});
req.setTimeout(8000, () => { console.log('目标不可达：8s 超时（SYN 无响应或服务未应答）'); req.destroy(); process.exit(1); });
req.on('error', (e) => { console.log(`目标不可达：${e.code || e.message}`); process.exit(1); });
