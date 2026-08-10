#!/usr/bin/env node
// SUT 账户守卫（真机操作前必跑）。
//
// 为什么存在：本机同时跑 casey 与死亡报卡两个项目，各自的真机测试账户不同
// （casey = autotest，死亡报卡 = hxz）。凭据文件位置与环境变量是共用面，用错账户
// 就是往别人的账户里真建真删。2026-08-10 之前本项目零机制校验，全靠人口头确认一次，
// 而同一会话里后续的每次真机操作都没有再确认——Steven 当日据此定下「每次操作前必须
// 确认账户」。
//
// 凭据红线（护栏 #7）：本脚本**只做比对、只输出匹配与否**，绝不打印实际用户名、
// 口令或文件内容。不匹配时也只报「不匹配」与期望值，不报实际值。
//
// 用法：node scripts/assert-sut-account.mjs [期望账户]     （缺省 autotest）
// 退出码：0 = 匹配可继续；3 = 不匹配（禁止继续真机操作）；65 = 读不到凭据、判不出。
import { loadCreds } from '../lib/login-bootstrap.mjs';

const expected = (process.argv[2] || 'autotest').trim();

let creds;
try {
  creds = loadCreds();
} catch (err) {
  console.error(`账户守卫：读不到凭据，判不出账户 —— ${String(err?.message || err).slice(0, 120)}`);
  process.exit(65);
}

const actual = String(creds?.user ?? '').trim();
if (!actual) {
  console.error('账户守卫：凭据里没有非空 user 字段，判不出账户');
  process.exit(65);
}

if (actual === expected) {
  console.log(`账户守卫：匹配期望账户「${expected}」，允许真机操作`);
  process.exit(0);
}

// 不回显实际值：只给长度与首末字符这类不足以还原账户名的指纹，便于人判断是不是拿错项目。
const fingerprint = `长度 ${actual.length}、首字符 ${actual[0]}、末字符 ${actual[actual.length - 1]}`;
console.error(`账户守卫：不匹配！期望「${expected}」，实际不是它（实际值不回显；指纹：${fingerprint}）`);
console.error('禁止继续任何真机操作。请人带外核对凭据来源，确认是否串到了别的项目的账户。');
process.exit(3);
