// Compile-run state, guarded navigation, and observed projection.
import { instantiate } from './instantiate.mjs';
import { createAgentToolCompileState } from './agent-tool-compile.mjs';
import { resolveExecutionTarget } from './execution-target/authority.mjs';
import {
  executionTargetUrl,
  navigateExecutionTargetPage,
  projectExecutionTargetRuntime,
  verifyExecutionTargetPageOrigin,
} from './execution-target/runtime.mjs';
import { ROUTE_LIST, locatorFor, requestLogPath, sleep } from './compile-atoms-support.mjs';

export function createCompileRun({ page, forensics, state, sut, uniqueName, site, listRoute, agentListRoute, profile, identityLedger, identityProfileDigest, executionTargetAuthority, executionTargetRuntime }) {
  let targetAuthority = executionTargetAuthority;
  let targetRuntime = executionTargetRuntime;
  if (targetAuthority !== undefined) {
    // authority 是 runtime 的唯一事实源：即使 caller 同时给了 runtime/sut，也只认 genuine
    // process-local authority 的投影。clone/plain authority 投影为 null，绝不借 caller URL 兜底。
    targetRuntime = projectExecutionTargetRuntime(targetAuthority);
  } else if (targetRuntime === undefined) {
    const compatibility = resolveExecutionTarget({
      runtime: { platform: 'linux', isWSL: false },
      logicalTarget: { startUrl: sut },
      transport: { mode: 'direct' },
      requiresOriginContinuity: true,
    });
    if (compatibility.ok) {
      targetAuthority = compatibility.authority;
      targetRuntime = projectExecutionTargetRuntime(compatibility.authority);
    }
  }
  // sut/ctx.baseUrl 与导航器使用同一份 runtime 投影；caller 的 sut 只用于上面的 legacy
  // authority 铸成输入，不能在 authority/runtime 已成立后成为第二事实源。
  const runtimeBaseUrl = typeof targetRuntime?.browserVisibleBaseUrl === 'string'
    ? targetRuntime.browserVisibleBaseUrl.replace(/\/$/, '')
    : '';
  return {
    page, forensics, state, site,
    // 身份观察账本（agent-id-readback；剖面声明 agents.listApi 时由 bin/compile.mjs 注入，未声明=null 零行为差）。
    identityLedger: identityLedger || null,
    identityObservations: [],
    // 身份通道指纹（C3 修复：Critical-1 ①）：由 bin/compile.mjs 在启动前算好注入（= sha256(规范化 listApi)），
    // 供破坏性 ref 武装取真指纹；剖面未声明身份通道时为 null（零行为差，加法式 ref 本就 gated）。
    identityProfileDigest: identityProfileDigest || null,
    // 目标连续性 ref 账（C3）：破坏性/targeting 原子编译处由匹配的 identity observation 铸 ref（携 platformId）。
    // 加法式、不改 events/observed/draft 冻结投影；无匹配观察时不武装（当前 hermetic 删除用例字节零漂移）。
    targetContinuityRefs: [],
    pendingIdentityObservation: null,
    identityGateOutcome: null,
    // 通道剖面（非凭据）：agent.searchOpen 条目容器覆写通道（profile.agents.itemContainer），与回放 ctx 同参。
    profile: profile && typeof profile === 'object' ? profile : null,
    // 列表页路由：通道剖面可选 routes.workflowList（非凭据通道配置，channel-driver schema 边界注明归剖面）；
    // 缺省 = ROUTE_LIST（hermetic 假 SUT 路由，行为不变）。真机实采：/ai-manager/* 是 API 前缀（503），列表真身另有其路。
    listRoute: listRoute || ROUTE_LIST,
    // 智能体列表路由（chief-bringup G1）：有则 nav.agentManagement 走路由导航，无则退点击通路。
    agentListRoute: agentListRoute || null,
    sut: runtimeBaseUrl,
    executionTargetAuthority: targetAuthority,
    executionTargetRuntime: targetRuntime,
    ctx: { uniqueName, baseUrl: runtimeBaseUrl },
    events: [], entityBindingProvenance: [], observed: [], verification: [], caseDefectCandidates: [], assertionAtoms: [], notes: [],
    countAudit: null,
    blockers: [], // 证不出的硬阻断（计数口径不恒等等）：executeMode 据此 fail-closed、不产成功产物
    stepN: 0, intentN: 0, lastIntentId: null,
    nodeDrawerLabel: null, // drawer-lock-hardening D3：编译期 run 态当前节点抽屉标题（compileWorkflowOpenNode 成功后写入，SelectNodeDropdown/SetNodeField 读它作标题锚域锁）
    agentToolState: createAgentToolCompileState(), // regress 智能体工具首纵切：创建目标与选择器一级目标只在本次编译内存传递

    newIntent() { return `intent_${this.intentN++}`; },

    mark() {
      return { events: this.events.length, entityBindingProvenance: this.entityBindingProvenance.length, observed: this.observed.length, verification: this.verification.length, stepN: this.stepN, intentN: this.intentN, lastIntentId: this.lastIntentId, nodeDrawerLabel: this.nodeDrawerLabel };
    },
    rollback(m) {
      this.events.length = m.events; this.observed.length = m.observed; this.verification.length = m.verification;
      this.entityBindingProvenance.length = m.entityBindingProvenance;
      this.stepN = m.stepN; this.intentN = m.intentN; this.lastIntentId = m.lastIntentId; this.nodeDrawerLabel = m.nodeDrawerLabel;
    },

    async admitPageOrigin(label = '动作') {
      const origin = await verifyExecutionTargetPageOrigin({
        page: this.page,
        authority: this.executionTargetAuthority,
      });
      if (origin.ok) return true;
      this.blockers.push(`${label} origin 拒绝（${origin.reason}）→ fail-closed 中止`);
      return false;
    },

    // 静默点（确定性条件，替代固定睡眠，ADR-0003）：DOM 连续两拍稳定；networkidle 对带背景轮询的 SPA 永不达成、不作判据。
    async quietPoint(budgetMs = 2500) {
      let prev = -1;
      const t0 = Date.now();
      while (Date.now() - t0 < budgetMs) {
        let n = -2;
        try { n = await this.page.evaluate(() => document.body ? document.body.innerHTML.length : 0); } catch { n = -2; }
        if (n >= 0 && n === prev) return true;
        prev = n;
        await sleep(120);
      }
      return false;
    },

    async capture(stepId, intentId, atom, recStart, quiet) {
      let urlPathnameAfter = '';
      try { urlPathnameAfter = new URL(this.page.url()).pathname; } catch { urlPathnameAfter = ''; }
      const cleanTitles = await this.page.evaluate(() => {
        const out = [];
        if (document.title) out.push(document.title.trim());
        for (const el of document.querySelectorAll('h1,h2,h3,[class*="__title"]')) {
          const t = (el.textContent || '').trim();
          if (t) out.push(t);
        }
        return [...new Set(out)].filter(Boolean);
      }).catch(() => []);
      const toastTexts = await this.page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.hr-toast,.hr-message,[role="status"],[role="alert"]')) {
          const t = (el.textContent || '').trim();
          if (t) out.push(t);
        }
        return [...new Set(out)];
      }).catch(() => []);
      this.observed.push({
        stepId, intentId, atom, urlPathnameAfter, cleanTitles, toastTexts,
        replyText: null, replyStreamUrl: null,
        recStart, recEnd: this.forensics.records().length,
        quietPointReached: quiet,
      });
    },

    // 单事件全生命周期：定位核验 → 动作（归因窗开在动作+静默期，镜像 bin/replay.mjs 的因果作用域）→ 静默点 → 采观测。
    async emit(spec, customAct) {
      const stepId = `atstep_${this.stepN++}`;
      this.lastIntentId = spec.intentId;
      const ev = { stepId, ...spec };
      const recStart = this.forensics.records().length;
      let resolution = 'unique', candidateCount = 1, acted = false;
      this.state.currentStepId = stepId;
      const respWait = spec.action === 'click'
        ? this.page.waitForResponse((r) => /saveOrModifyProcessData|streamReply/.test(r.url()), { timeout: 600 }).catch(() => null)
        : Promise.resolve(null);
      let originReady = true;
      try {
        if (spec.action !== 'nav') {
          originReady = await this.admitPageOrigin(`步 ${stepId} 动作前`);
          if (!originReady) { resolution = 'action_failed'; candidateCount = 0; }
        }
        if (!originReady) {
          acted = false;
        } else if (customAct) {
          const outcome = await customAct();
          if (outcome && typeof outcome.resolution === 'string') {
            resolution = outcome.resolution;
            candidateCount = Number.isInteger(outcome.candidateCount) ? outcome.candidateCount : candidateCount;
            acted = resolution === 'unique' && outcome.identityReadback?.ok === true;
          } else {
            acted = true;
          }
        } else if (spec.action === 'nav') {
          const targetUrl = executionTargetUrl(this.executionTargetRuntime, spec.url);
          const navigation = await navigateExecutionTargetPage({
            page: this.page,
            authority: this.executionTargetAuthority,
            targetUrl,
            gotoOptions: { waitUntil: 'load' },
          });
          if (navigation.ok) {
            acted = true;
          } else {
            resolution = 'action_failed';
            candidateCount = 0;
            this.blockers.push(`步 ${stepId} 导航拒绝（${navigation.reason}）→ fail-closed 中止`);
          }
        } else if (spec.action === 'selectOption') {
          const du = spec.dropdownUnit;
          const combo = this.page.getByRole('combobox', { name: du.fieldLabel });
          candidateCount = await combo.count().catch(() => 0);
          resolution = candidateCount === 1 ? 'unique' : candidateCount > 1 ? 'ambiguous' : 'absent';
          // 点击身份门对称（R1-F2）：count===1 才动作，多匹配绝不点击（防真机点错/污染 SUT）。
          if (candidateCount === 1) {
            originReady = await this.admitPageOrigin(`步 ${stepId} 下拉触发前`);
            if (!originReady) {
              resolution = 'action_failed';
              candidateCount = 0;
            } else {
              await combo.first().click({ timeout: 3000 });
            }
            // 选项点击同过身份门（R2-F2）：限定 scope 容器内的选项浮层、选项文本唯一才点。
            if (originReady) {
              const scopeLoc = du.scope ? this.page.locator(du.scope) : this.page;
              const list = scopeLoc.locator(du.optionListSelector || '.hr-select__list');
              const opt = list.getByText(du.optionText, { exact: true });
              const optCount = await opt.count().catch(() => 0);
              if (optCount === 1) {
                originReady = await this.admitPageOrigin(`步 ${stepId} 下拉选项前`);
                if (originReady) {
                  await opt.first().click({ timeout: 3000 });
                  acted = true;
                } else {
                  resolution = 'action_failed';
                  candidateCount = 0;
                }
              } else {
                resolution = optCount > 1 ? 'ambiguous' : 'absent';
                candidateCount = optCount;
                this.notes.push(`步 ${stepId} 选项「${du.optionText}」在 scope 内 count=${optCount} 非唯一/缺席，拒点`);
              }
            }
          }
        } else if (spec.action === 'press') {
          const { locator, count } = await this.resolveTarget(ev);
          candidateCount = count;
          resolution = count === 1 ? 'unique' : count > 1 ? 'ambiguous' : 'absent';
          if (count === 1) {
            originReady = await this.admitPageOrigin(`步 ${stepId} press 前`);
            if (originReady) {
              await locator.first().press(spec.key || 'Enter', { timeout: 3000 });
              acted = true;
            } else {
              resolution = 'action_failed';
              candidateCount = 0;
            }
          }
        } else {
          const { locator, count } = await this.resolveTarget(ev);
          candidateCount = count;
          resolution = count === 1 ? 'unique' : count > 1 ? 'ambiguous' : 'absent';
          if (count === 1) {
            originReady = await this.admitPageOrigin(`步 ${stepId} 物理动作前`);
            if (originReady) {
              const first = locator.first();
              if (spec.action === 'fill') await first.fill(instantiate(spec.value, this.ctx), { timeout: 3000 });
              else if (spec.action === 'dblclick') await first.dblclick({ timeout: 3000 });
              else await first.click({ timeout: 3000 });
              acted = true;
            } else {
              resolution = 'action_failed';
              candidateCount = 0;
            }
          }
        }
      } catch (e) {
        resolution = 'action_failed';
        this.notes.push(`步 ${stepId}（${spec.atom}/${spec.action}）动作失败（详情不回显）`);
      }
      if (acted && originReady) {
        originReady = await this.admitPageOrigin(`步 ${stepId} 动作后`);
        if (!originReady) {
          resolution = 'action_failed';
          candidateCount = 0;
          acted = false;
        }
      }
      await respWait;
      if (spec.action === 'click') await sleep(150); // 动作直接异步后果的出现窗（因果作用域，非任意时间窗）
      const quiet = await this.quietPoint();
      if (originReady) {
        originReady = await this.admitPageOrigin(`步 ${stepId} 采证前`);
        if (!originReady) {
          resolution = 'action_failed';
          candidateCount = 0;
          acted = false;
        }
      }
      this.state.currentStepId = null;
      await this.capture(stepId, spec.intentId, spec.atom, recStart, quiet);
      this.events.push(ev);
      this.verification.push({ stepId, intentId: spec.intentId, atom: spec.atom, action: spec.action, resolution, candidateCount, acted });
      if (resolution !== 'unique') this.notes.push(`步 ${stepId} 定位核验非唯一（${resolution}，count=${candidateCount}）→ route:human`);
      return { stepId, resolution, candidateCount, acted };
    },

    async resolveTarget(ev) {
      const loc = locatorFor(this.page, ev);
      if (loc) {
        try { await loc.first().waitFor({ state: 'attached', timeout: 1500 }); } catch { /* 计数照实 */ }
        const n = await loc.count().catch(() => 0);
        if (n >= 1) return { locator: loc, count: n };
      }
      if (ev.fallbackCss) {
        const fb = this.page.locator(ev.fallbackCss);
        const n = await fb.count().catch(() => 0);
        if (n >= 1) return { locator: fb, count: n };
      }
      return { locator: null, count: 0 };
    },
  };
}

// ── 原子编译知识（第一条只骑 catalog_wf_crud 所用原子；atomId 钉 registry 原名） ──

export function projectObserved(run, { caseId, capturedAt, capturedAgainstBuild = null }) {
  const records = run.forensics.records();
  const steps = run.observed.map((o) => ({
    stepId: o.stepId, intentId: o.intentId, atom: o.atom,
    urlPathnameAfter: o.urlPathnameAfter, cleanTitles: o.cleanTitles, toastTexts: o.toastTexts,
    replyText: o.replyText, replyStreamUrl: o.replyStreamUrl,
    requestLog: records.slice(o.recStart, o.recEnd).map((r) => ({
      url: requestLogPath(r.url),
      method: r.method ?? null,
      status: Number.isInteger(r.status) ? r.status : 0,
      ts: Math.round((r.ts || 0) * 1000),
      initiator: r.attributedStepId != null ? r.attributedStepId : 'background',
      attributedStepId: r.attributedStepId ?? null,
      errorEnvelope: r.errorEnvelope ?? null,
    })),
    quietPointReached: o.quietPointReached,
  }));
  return { schemaVersion: 1, caseId, channel: 'web', capturedAt, capturedAgainstBuild, steps };
}
