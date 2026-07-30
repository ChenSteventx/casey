// source/authoring/distilled 三段 fresh runtime 的唯一生产 open 实现。
// 只走现役 execution-target/登录/会话种子/topology/取证/来源准入接缝：本模块不认识、不改写
// 逻辑目标、host 或传输端点；Windows direct 一律保留 logical origin，回环转发只可能由
// execution-target policy 已批准的 WSL transport 投影而来。
// 任一子步失败都逆序关闭已建的 Context/Browser，且只返回闭合 {ok:false,reason}。

import { chromium } from '@playwright/test';
import { projectExecutionTargetRuntime } from '../execution-target/runtime.mjs';
import { playwrightLaunchOptions } from '../execution-target/wiring.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../login-bootstrap.mjs';
import { createPageForensicsHub } from '../replay-forensics.mjs';
import {
  captureReplaySessionSeed,
  installReplaySessionSeedBeforeNavigation,
  openReplayTopology,
} from '../page-topology/replay-session.mjs';
import { createReplayOriginAdmission } from '../replay/origin-admission.mjs';

const OPEN_KEYS = ['role', 'executionTargetAuthority'];
const ROLES = new Set(['source', 'authoring', 'distilled']);
const OPEN_FAILED = 'AUTHORING_RUNTIME_OPEN_FAILED';

function frozen(value) {
  return Object.freeze(value);
}

function denied() {
  return frozen({ ok: false, reason: OPEN_FAILED });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

// canonical 接缝：真实调用现役实现，不复制其中任何目标/登录/取证知识。
const canonicalSeams = {
  projectExecutionTargetRuntime(authority) {
    return projectExecutionTargetRuntime(authority);
  },
  playwrightLaunchOptions(runtime, baseOptions) {
    return playwrightLaunchOptions(runtime, baseOptions);
  },
  async launchBrowser(options) {
    return chromium.launch(options);
  },
  loadSiteConfig() {
    return loadSiteConfig();
  },
  loadCreds() {
    return loadCreds();
  },
  async loginBootstrap(page, options) {
    return loginBootstrap(page, options);
  },
  async captureReplaySessionSeed(page) {
    return captureReplaySessionSeed(page);
  },
  async installReplaySessionSeedBeforeNavigation(page, snapshot) {
    return installReplaySessionSeedBeforeNavigation(page, snapshot);
  },
  createPageForensicsHub(input) {
    return createPageForensicsHub(input);
  },
  async openReplayTopology(input) {
    return openReplayTopology(input);
  },
  createReplayOriginAdmission(authority) {
    return createReplayOriginAdmission(authority);
  },
};

export function createRuntimeBootstrap(deps = {}) {
  const seams = { ...canonicalSeams, ...deps };

  async function openRuntime(options = {}) {
    if (!exactKeys(options, OPEN_KEYS)) return denied();
    const { role, executionTargetAuthority } = options;
    if (!ROLES.has(role)) return denied();
    if (!executionTargetAuthority || typeof executionTargetAuthority !== 'object') {
      return denied();
    }

    let browser = null;
    let context = null;
    try {
      const runtime = seams.projectExecutionTargetRuntime(executionTargetAuthority);
      if (!runtime) return denied();
      const launchOptions = seams.playwrightLaunchOptions(runtime, {});
      browser = await seams.launchBrowser(launchOptions);
      if (!browser) return denied();
      context = await browser.newContext();
      if (!context) return denied();
      const page = await context.newPage();
      if (!page) return denied();

      const site = seams.loadSiteConfig();
      const creds = seams.loadCreds();
      const login = await seams.loginBootstrap(page, {
        site,
        creds,
        startUrl: runtime.browserVisibleStartUrl,
        executionTargetAuthority,
      });
      if (!login || login.ok === false) return denied();

      const seed = await seams.captureReplaySessionSeed(page);
      if (seed?.ok !== true || !seed.snapshot) return denied();
      const installed = await seams.installReplaySessionSeedBeforeNavigation(
        page,
        seed.snapshot,
      );
      if (installed?.ok !== true) return denied();

      // 一段 runtime 只有一份 attribution state/pageErrors；初始页和后续 popup
      // 共用该引用，raw/formal runner 也消费同一引用，避免取证被装进一组数组、
      // 投影却读取另一组空数组。
      const state = { currentStepId: null };
      const pageErrors = [];
      const hub = seams.createPageForensicsHub({
        context,
        pageErrors,
        options: { currentStep: () => state.currentStepId },
      });
      if (!hub || typeof hub.attachPageForensics !== 'function') return denied();
      const opened = await seams.openReplayTopology({
        context,
        initialPage: page,
        seedSnapshot: seed.snapshot,
        attachForensics: hub.attachPageForensics,
      });
      if (opened?.ok !== true || !opened.controller) return denied();

      const originAdmission = seams.createReplayOriginAdmission(executionTargetAuthority);
      if (typeof originAdmission !== 'function') return denied();

      const live = {
        browser,
        context,
        // activePage 是 controller-backed 动态 façade；popup handoff 后仍指向当前活动页。
        page: opened.activePage,
        topology: opened.controller,
        forensics: hub.forensics,
        originAdmission,
      };
      // attribution state 是 runtime 内部共享引用，不扩张既有 public enumerable shape。
      Object.defineProperties(live, {
        state: { value: state, enumerable: false },
        pageErrors: { value: pageErrors, enumerable: false },
      });
      frozen(live);
      browser = null;
      context = null;
      return frozen({ ok: true, runtime: live });
    } catch {
      return denied();
    } finally {
      // 逆序清理 partial runtime：先 Context 后 Browser，异常一律吞掉不外泄。
      if (context) {
        try {
          await context.close();
        } catch { /* 关闭失败不改变闭合拒绝 */ }
      }
      if (browser) {
        try {
          await browser.close();
        } catch { /* 关闭失败不改变闭合拒绝 */ }
      }
    }
  }

  return frozen({ openRuntime });
}

export const canonicalRuntimeBootstrap = createRuntimeBootstrap({});
