#!/usr/bin/env node
// PreToolUse 钩子 —— 真机命令的 SUT 账户守卫（硬层，防串账户）。
//
// 为什么是机制不是纪律：本机同时跑 casey 与死亡报卡两个项目，真机测试账户不同
// （casey = autotest，死亡报卡 = hxz），凭据文件与环境变量是共用面。用错账户就是往别人
// 的账户里真建真删。2026-08-10 之前零机制校验，当日实况是只在第一次口头确认、后续两次
// 真机回放与一次探针都没再确认（事后核为 autotest，属侥幸）。Steven 据此定：上钩子。
//
// 触发面：Bash 命令里出现真机标志（--sut / --login-bootstrap / --execute 且带 --sut）。
// 不匹配期望账户 → exit 2 拦截（stderr 反馈）。读不到凭据 → 同样拦（fail-closed）。
// 守卫自身故障不阻塞（fail-open，同 hook-posttool 约定）——它是安全网不是唯一防线，
// 崩了不该把正常工作卡死；真正的 fail-closed 由被调命令自己的凭据门兜底。
//
// 凭据红线（护栏 #7）：只比对、只报匹配与否，绝不打印用户名、口令或文件内容。
import { readFileSync } from 'node:fs';

const EXPECTED = process.env.CASEY_EXPECTED_SUT_ACCOUNT || 'autotest';
// 真机标志：--sut 传的是隧道回环基址，--login-bootstrap 会真登录。两者任一出现即视为真机面。
const REAL_MACHINE = /(^|\s)--(sut|login-bootstrap)(\s|=|$)/;

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (input.tool_name !== 'Bash') process.exit(0);
  const command = String(input.tool_input?.command ?? '');
  if (!REAL_MACHINE.test(command)) process.exit(0);
  // 账户守卫脚本本身也带 --sut 之类参数时不自锁（它不碰真机，只读凭据比对）。
  if (/assert-sut-account\.mjs/.test(command)) process.exit(0);

  let creds = null;
  try {
    const mod = await import('../lib/login-bootstrap.mjs');
    creds = mod.loadCreds();
  } catch (err) {
    console.error(`SUT 账户守卫：读不到凭据、判不出账户，按 fail-closed 拦下真机命令。\n原因（内容不回显）：${String(err?.message || err).slice(0, 120)}`);
    process.exit(2);
  }

  const actual = String(creds?.user ?? '').trim();
  if (!actual) {
    console.error('SUT 账户守卫：凭据缺非空 user 字段，判不出账户，按 fail-closed 拦下真机命令。');
    process.exit(2);
  }
  if (actual === EXPECTED) process.exit(0);

  const fingerprint = `长度 ${actual.length}、首字符 ${actual[0]}、末字符 ${actual[actual.length - 1]}`;
  console.error(`SUT 账户守卫：拦截真机命令——当前凭据不是本项目账户「${EXPECTED}」。
实际值不回显；指纹：${fingerprint}。
本机另一项目（死亡报卡）用 hxz，请先带外核对凭据来源是否串项目了。
确需改期望账户，设环境变量 CASEY_EXPECTED_SUT_ACCOUNT。`);
  process.exit(2);
} catch {
  process.exit(0); // 守卫自身故障不阻塞正常动作
}
