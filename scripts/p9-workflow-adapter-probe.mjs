#!/usr/bin/env node
// Real-browser, no-mutation probe for the P9 workflow adapters.
// It logs only structural field names. The delete request is always aborted
// before it reaches the SUT.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pw from '@playwright/test';
import { loadCreds, loadSiteConfig, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { playwrightLaunchOptions, resolveCliExecutionTarget } from '../lib/execution-target/wiring.mjs';
import { executionTargetUrl } from '../lib/execution-target/runtime.mjs';
import { fetchCreatedWorkflowListScan } from '../lib/entity-created-workflow-continuity-v3.mjs';
import {
  inspectWorkflowDeleteConfirm,
  inspectWorkflowDeleteTarget,
  performWorkflowDeleteConfirm,
  performWorkflowDeleteTrigger,
} from '../lib/workflow-delete-domain.mjs';
import { SEARCH_BOX_NAME } from '../lib/compile-atoms-support.mjs';

const { chromium } = pw;
const profilePath = resolve(process.argv[2] || 'cases/tc_catalog_wf_crud/profile.json');
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const site = loadSiteConfig(undefined, { strict: true });
const creds = loadCreds();
const endpoint = site?.target?.transportEndpoint
  ?? site?.target?.transport?.endpoint
  ?? site?.target?.devProxyUrl;
const execution = resolveCliExecutionTarget({
  site,
  cliSut: endpoint,
  requiresOriginContinuity: true,
});
if (!execution.ok) throw new Error(execution.reason);

function findRecordArray(value, path = '$', seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.some((row) => row && typeof row === 'object'
      && typeof row.masProcessId === 'string'
      && typeof row.masProcessName === 'string')) return { path, rows: value };
    for (let index = 0; index < value.length; index += 1) {
      const found = findRecordArray(value[index], `${path}.${index}`, seen);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    const found = findRecordArray(child, `${path}.${key}`, seen);
    if (found) return found;
  }
  return null;
}

function findNumberPaths(value, path = '$', out = [], seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`;
    if (Number.isSafeInteger(child)) out.push(next);
    else if (child != null && typeof child === 'object') findNumberPaths(child, next, out, seen);
  }
  return out;
}

function collectArrayShapes(value, path = '$', out = [], seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) {
    const first = value[0];
    out.push({
      path: path.replace(/^\$\./, ''),
      count: value.length,
      firstType: first === null ? 'null' : Array.isArray(first) ? 'array' : typeof first,
      firstKeys: first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first).sort() : [],
    });
    for (let index = 0; index < Math.min(value.length, 2); index += 1) collectArrayShapes(value[index], `${path}.${index}`, out, seen);
    return out;
  }
  for (const [key, child] of Object.entries(value)) collectArrayShapes(child, `${path}.${key}`, out, seen);
  return out;
}

function matchingLocations(value, expected, path = 'body', out = [], seen = new Set()) {
  if (value === expected) out.push(path);
  if (value == null || typeof value !== 'object' || seen.has(value)) return out;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) matchingLocations(child, expected, `${path}.${key}`, out, seen);
  return out;
}

async function inspectWorkflowListDom(page, targetUrl, name) {
  await page.goto(targetUrl, { waitUntil: 'load', timeout: 20000 });
  const search = page.getByRole('textbox', { name: SEARCH_BOX_NAME });
  await search.fill(name);
  await search.press('Enter');
  await page.waitForTimeout(800);
  return page.evaluate((wanted) => {
    const matches = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if ((el.textContent || '').trim() !== wanted) return false;
      return !Array.from(el.children).some((child) => (child.textContent || '').trim() === wanted);
    });
    return {
      exactLeafCount: matches.length,
      candidates: matches.slice(0, 5).map((el) => {
        const container = el.closest('.hr-table-row, .hr-card.hr-card--bordered, .agent-card');
        return {
          tag: el.tagName.toLowerCase(),
          classes: Array.from(el.classList).sort(),
          containerTag: container ? container.tagName.toLowerCase() : null,
          containerClasses: container ? Array.from(container.classList).sort() : [],
        };
      }),
    };
  }, name);
}

let browser;
try {
  browser = await chromium.launch(playwrightLaunchOptions(execution.runtime, { headless: true }));
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = await loginBootstrap(page, {
    site,
    creds,
    startUrl: execution.runtime.browserVisibleStartUrl,
    executionTargetAuthority: execution.authority,
  });
  if (login?.loggedIn !== true) throw new Error(login?.reason || 'LOGIN_PROBE_FAILED');

  const listResult = await page.evaluate(async () => {
    const response = await fetch('/ai-manager/process/queryProcess?pageSize=50&pageIndex=1', {
      method: 'GET', credentials: 'same-origin',
    });
    return { status: response.status, ok: response.ok, body: await response.json() };
  });
  if (!listResult.ok) throw new Error('LIST_PROBE_FAILED');
  const recordArray = findRecordArray(listResult.body);
  if (!recordArray) {
    console.log(JSON.stringify({
      schemaVersion: 1,
      artifactKind: 'p9-workflow-list-shape-probe',
      mutationSent: false,
      statusClass: `${Math.floor(listResult.status / 100)}xx`,
      topLevelKeys: Object.keys(listResult.body).sort(),
      objectKeys: Object.fromEntries(Object.entries(listResult.body)
        .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
        .map(([key, value]) => [key, Object.keys(value).sort()])),
      arrays: collectArrayShapes(listResult.body),
    }, null, 2));
    throw new Error('LIST_RECORD_ARRAY_NOT_FOUND');
  }
  const first = recordArray.rows[0] || {};
  const helperReadback = await fetchCreatedWorkflowListScan(page, {
    profile,
    entityName: first.masProcessName,
  });
  const helperShape = helperReadback.ok ? {
    ok: true,
    complete: helperReadback.scan.complete,
    total: helperReadback.scan.total,
    exactMatchCount: helperReadback.scan.records.filter((row) => row.name === first.masProcessName).length,
    idType: typeof helperReadback.scan.records[0]?.id,
  } : { ok: false, reason: helperReadback.reason };
  const prefixedTarget = recordArray.rows.find((row) => row.masProcessName.startsWith('atl_'));
  const workflowRoute = profile?.routes?.workflowList;
  const targetUrl = executionTargetUrl(execution.runtime, workflowRoute);
  if (!targetUrl) throw new Error('WORKFLOW_ROUTE_INVALID');
  let target = prefixedTarget || null;
  if (!target) {
    for (const row of recordArray.rows) {
      await page.goto(targetUrl, { waitUntil: 'load', timeout: 20000 });
      const candidateSearch = page.getByRole('textbox', { name: SEARCH_BOX_NAME });
      await candidateSearch.fill(row.masProcessName);
      await candidateSearch.press('Enter');
      await page.waitForTimeout(500);
      const inspected = await inspectWorkflowDeleteTarget(page, row.masProcessName);
      if (inspected.resolution === 'unique' && inspected.deleteButtons === 1) {
        target = row;
        break;
      }
    }
  }
  if (!target) {
    const dom = await inspectWorkflowListDom(page, targetUrl, first.masProcessName);
    console.log(JSON.stringify({
      schemaVersion: 1,
      artifactKind: 'p9-workflow-adapter-probe',
      mutationSent: false,
      mutationProbeSkipped: 'NO_DELETE_CAPABLE_RECORD_AVAILABLE',
      listApi: {
        method: 'GET', path: '/ai-manager/process/queryProcess',
        statusClass: `${Math.floor(listResult.status / 100)}xx`,
        recordsPath: recordArray.path.replace(/^\$\./, ''),
        recordKeys: Object.keys(first).sort(),
        numericPaths: findNumberPaths(listResult.body).map((path) => path.replace(/^\$\./, '')),
      },
      dom,
      v3ListHelper: helperShape,
    }, null, 2));
    const complete = new Error('PROBE_COMPLETE');
    complete.code = 'PROBE_COMPLETE';
    throw complete;
  }
  const dom = await inspectWorkflowListDom(page, targetUrl, target.masProcessName);

  let deleteShape = null;
  let blockedMutationCount = 0;
  const mutationBlockPattern = '**/*';
  const mutationBlock = async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      await route.continue();
      return;
    }
    blockedMutationCount += 1;
    let body = null;
    try { body = JSON.parse(request.postData() || 'null'); } catch { body = null; }
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/ai-manager/process/delete') {
      deleteShape = {
        method: request.method(),
        path: pathname,
        bodyKeys: body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [],
        idLocations: matchingLocations(body, target.masProcessId),
      };
    }
    await route.abort('blockedbyclient');
  };

  await page.goto(targetUrl, { waitUntil: 'load', timeout: 20000 });
  const search = page.getByRole('textbox', { name: SEARCH_BOX_NAME });
  await search.fill(target.masProcessName);
  await search.press('Enter');
  await page.waitForTimeout(800);
  const deleteTargetInspection = await inspectWorkflowDeleteTarget(page, target.masProcessName);
  const trigger = await performWorkflowDeleteTrigger(page, target.masProcessName);
  if (trigger.resolution !== 'unique' || trigger.acted !== true) {
    console.log(JSON.stringify({
      schemaVersion: 1,
      artifactKind: 'p9-workflow-delete-domain-probe',
      mutationSent: false,
      deleteTargetInspection,
      trigger,
    }, null, 2));
    const complete = new Error('PROBE_COMPLETE');
    complete.code = 'PROBE_COMPLETE';
    throw complete;
  }
  const confirm = await inspectWorkflowDeleteConfirm(page);
  if (confirm.resolution !== 'unique' || !confirm.confirmName) throw new Error('DELETE_CONFIRM_NOT_UNIQUE');
  // Confirm is exercised only after every non-read request has been blocked.
  // This captures the real browser payload without allowing any mutation to reach the SUT.
  await page.route(mutationBlockPattern, mutationBlock);
  await performWorkflowDeleteConfirm(page, confirm.confirmName, target.masProcessName);
  await page.waitForTimeout(800);
  await page.unroute(mutationBlockPattern, mutationBlock);
  if (!deleteShape) throw new Error('DELETE_REQUEST_NOT_CAPTURED');

  const result = {
    schemaVersion: 1,
    artifactKind: 'p9-workflow-adapter-probe',
    mutationSent: false,
    targetClass: prefixedTarget ? 'test-prefix' : 'existing-readonly-blocked',
    blockedMutationCount,
    listApi: {
      method: 'GET',
      path: '/ai-manager/process/queryProcess',
      statusClass: `${Math.floor(listResult.status / 100)}xx`,
      recordsPath: recordArray.path.replace(/^\$\./, ''),
      recordKeys: Object.keys(first).sort(),
      numericPaths: findNumberPaths(listResult.body).map((path) => path.replace(/^\$\./, '')),
    },
    dom,
    v3ListHelper: helperShape,
    mutationAdapter: deleteShape,
  };
  console.log(JSON.stringify(result, null, 2));
  await context.close();
} catch (error) {
  if (error?.code !== 'PROBE_COMPLETE') throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
}
