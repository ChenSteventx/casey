#!/usr/bin/env node
// bin/doctor.mjs —— casey doctor 跨平台就绪自检【采集壳】（casey-doctor，GRILL D7）。
// 唯一碰真环境处（探针已导出化到 lib/doctor-probes.mjs，行为零变化——p9-tier2 GRILL D4：
//   tier-2 复用同一套结构化采集，不照抄私有函数）：探 platform+isWSL、读 process.version 与
//   package.json.engines、hasPlaywright() + 真 import('@playwright/test') +
//   chromium.executablePath()→existsSync、OS 分支字体探测、existsSync 凭据/site.json；
//   目标值只在内存验 URL 形状，绝不输出；devProxyUrl 仅取回环端口。
//   把结果装成 env 喂纯层 lib/doctor.mjs → 渲染逐项行 + process.exit(runDoctor(env).exitCode)。
// 渲染沿 selftestTier1 的 ok/RED 配色，另加 warn(黄)/route-human(灰)。
//
// 凭据纪律（护栏 #7，GRILL D6）：全输出零凭据值、零真目标地址（隧道只述回环端口号）、零裸 ://、
//   零用户绝对路径（output-seal）。site.json/凭据只 existsSync + JSON.parse 后查顶层键名，值绝不进输出。
import { runDoctor } from '../lib/doctor.mjs';
import { collectDoctorEnv } from '../lib/doctor-probes.mjs';

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', gray: '\x1b[90m', cyan: '\x1b[36m', bold: '\x1b[1m' };
const col = (c, s) => `${c}${s}${C.reset}`;
const LABEL = {
  ok: col(C.green, 'ok  '), fail: col(C.red, 'RED '), warn: col(C.yellow, 'warn'), 'route-human': col(C.gray, 'hum '),
};

function executionTargetItem(shape, sitePresent) {
  if (!sitePresent) {
    return {
      id: 'execution-target',
      status: 'warn',
      detail: '执行目标未配置（hermetic 用户可无）',
      hint: '真机运行前补齐规范逻辑目标',
    };
  }
  if (!shape.ready) {
    return {
      id: 'execution-target',
      status: 'fail',
      detail: `执行目标分类不可准入：${shape.runtimeClass} / ${shape.transportMode}`,
      hint: '使用与运行平台匹配的传输方式，并保持逻辑目标独立',
    };
  }
  return {
    id: 'execution-target',
    status: 'ok',
    detail: `执行目标分类：${shape.runtimeClass} / ${shape.transportMode} / origin ${shape.originContinuity}`,
    hint: '',
  };
}

async function main() {
  const { site, env } = await collectDoctorEnv();

  const base = runDoctor(env);
  const targetItem = executionTargetItem(env.executionTarget, site.present);
  const items = [...base.items, targetItem];
  const exitCode = base.exitCode || (targetItem.status === 'fail' ? 1 : 0);
  console.log(col(C.bold, '\ncasey doctor —— 跨平台就绪自检') + col(C.gray, '（node / playwright / 中文字体 / 凭据·site.json / 隧道）') + '\n');
  for (const it of items) {
    const line = `${LABEL[it.status]} ${col(C.cyan, `[${it.id}]`)} ${it.detail}${it.hint ? col(C.gray, '  → ' + it.hint) : ''}`;
    console.log(line);
  }
  console.log('');
  if (exitCode === 0) {
    console.log(col(C.green, '就绪级全 ok → hermetic 回放就绪（exit 0）。warn/route-human 项按上方建议自行处理，不阻塞。'));
  } else {
    console.log(col(C.red, '就绪级有 RED → 未就绪（exit 1）。按上方建议修复就绪级项后重跑；本命令只诊断不自动修。'));
  }
  process.exit(exitCode);
}

main().catch(() => {
  // fail-closed：采集壳意外故障不得抛裸栈（可能夹带路径/环境），静默退 1。
  console.error(col(C.red, 'casey doctor：采集期意外故障（详情已抑制，防泄漏），exit 1。'));
  process.exit(1);
});
