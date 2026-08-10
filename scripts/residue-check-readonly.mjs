#!/usr/bin/env node
// 真机残留只读核查（零建、零删、零改）。
//
// 用途：某次回放的清理链未完成时，回答唯一一个问题——本轮建的实体是否还留在真实环境里。
// 只做两件事：登录预备动作 + 按名调 fetchCreatedWorkflowListScan 查工作流列表；不点任何
// 按钮、不发任何变更请求。输出只有「命中 / 未命中 / 查询未成立」与计数，绝不回显真实地址、
// 凭据或整行数据。
//
// 纪律：查询未成立（denied）一律按 NEEDS_HUMAN 报、退出码 65，**绝不当成「没残留」**——
// 那是把「没查成」读成「查过了是空的」，典型假绿。本脚本首版就踩过这个坑（调用签名传错，
// denied 被当空列表读成无残留），故在此写死。
//
// 用法：node scripts/residue-check-readonly.mjs <profile.json> <名称子串> [<名称子串>...]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pw from '@playwright/test';
import { loadCreds, loadSiteConfig, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { playwrightLaunchOptions, resolveCliExecutionTarget } from '../lib/execution-target/wiring.mjs';
import { fetchCreatedWorkflowListScan } from '../lib/entity-created-workflow-continuity-v3.mjs';

const { chromium } = pw;
const profilePath = resolve(process.argv[2] || 'cases/tc_wf_publish_states/profile.json');
const needles = process.argv.slice(3).filter(Boolean);
if (!needles.length) {
  console.error('用法：node scripts/residue-check-readonly.mjs <profile.json> <名称子串> [...]');
  process.exit(64);
}

const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const site = loadSiteConfig(undefined, { strict: true });
const creds = loadCreds();
const endpoint = site?.target?.transportEndpoint
  ?? site?.target?.transport?.endpoint
  ?? site?.target?.devProxyUrl;
const execution = resolveCliExecutionTarget({ site, cliSut: endpoint, requiresOriginContinuity: true });
if (!execution.ok) throw new Error(execution.reason);

const browser = await chromium.launch(playwrightLaunchOptions(execution.runtime, { headless: true }));
let exitCode = 0;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = await loginBootstrap(page, {
    site,
    creds,
    startUrl: execution.runtime.browserVisibleStartUrl,
    executionTargetAuthority: execution.authority,
  });
  if (login?.loggedIn !== true) throw new Error(login?.reason || 'LOGIN_FAILED');

  for (const needle of needles) {
    const result = await fetchCreatedWorkflowListScan(page, { profile, entityName: needle });
    if (result?.ok !== true) {
      exitCode = 65;
      console.log(`查询未成立：「${needle}」拒因 ${result?.reason ?? '未知'} —— 判不出有无残留，按 NEEDS_HUMAN 处理`);
      continue;
    }
    const records = result.scan?.records || [];
    const hits = records.filter((r) => String(r?.name ?? '').includes(needle));
    const meta = `total=${result.scan?.total} complete=${result.scan?.complete} hasNext=${result.scan?.hasNext}`;
    if (hits.length) {
      exitCode = 1;
      console.log(`残留命中：「${needle}」× ${hits.length}（${meta}；标识后四位 ${hits.map((h) => String(h?.id ?? '').slice(-4)).join(', ')}）`);
    } else {
      console.log(`未命中：「${needle}」——该名下无残留（${meta}）`);
    }
  }
} catch (err) {
  console.error(`探针失败（内容不回显）：${String(err?.message || err).slice(0, 160)}`);
  exitCode = 65;
} finally {
  await browser.close().catch(() => {});
}
process.exit(exitCode);
