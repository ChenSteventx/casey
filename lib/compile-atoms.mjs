// lib/compile-atoms.mjs —— 相1 编译执行引擎：骑 atom 知识把 flow 步翻成确定性 events + 观测现状 + 核验记录。
// 决策依 docs/plans/p3-compile/proposed/GRILL.md：G1 取 B（本引擎只产事实，回放核验另跑）、
// G6 分岔三取 C（events url 一律 {{baseUrl}} 占位符）、G1 附属（入口可证缺席 → 候选 + 不落该步、编译继续）、
// G7-3（assert.* 原子不产 event、折进所在 intent 意图留痕）。
// 本引擎零 LLM：flow 草稿由 LLM 在 CLI 外产出；这里是确定性执行 + 采集（L0）。
// 裁判零 LLM（护栏 #15）：本模块只产事实，绝不裁定、绝不写 verdict/passes。
import { instantiate } from './instantiate.mjs';
import { stripUrlQuery } from './cred-gate.mjs';

export const ROUTE_LIST = '/ai-manager/process/list';
const SEARCH_BOX_NAME = '输入工作流名称或编码进行搜索';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// {{baseUrl}} 占位符 → 路径段（执行期与 --sut 拼接；events 落盘保留占位符）。
const pathOfPlaceholder = (u) => String(u).replace('{{baseUrl}}', '') || '/';

// 语义定位（与 lib/replay-actions.mjs 的 semanticLocator 同语义——编译期作者与回放期消费者同构）。
function locatorFor(page, ev) {
  const s = ev.semantic;
  if (s && s.kind === 'role' && s.role) return page.getByRole(s.role, { name: s.name, exact: s.exact !== false });
  if (s && s.kind === 'label' && s.name) return page.getByLabel(s.name);
  if (s && s.kind === 'text' && s.name) return page.getByText(s.name, { exact: !!s.exact });
  if (ev.role && ev.accessibleName) return page.getByRole(ev.role, { name: ev.accessibleName, exact: true });
  if (ev.fieldLabel) return page.getByLabel(ev.fieldLabel);
  return null;
}

export function createCompileRun({ page, forensics, state, sut, uniqueName, site }) {
  return {
    page, forensics, state, site,
    sut: String(sut).replace(/\/$/, ''),
    ctx: { uniqueName, baseUrl: String(sut).replace(/\/$/, '') },
    events: [], observed: [], verification: [], caseDefectCandidates: [], assertionAtoms: [], notes: [],
    countAudit: null,
    stepN: 0, intentN: 0, lastIntentId: null,

    newIntent() { return `intent_${this.intentN++}`; },

    mark() {
      return { events: this.events.length, observed: this.observed.length, verification: this.verification.length, stepN: this.stepN, intentN: this.intentN, lastIntentId: this.lastIntentId };
    },
    rollback(m) {
      this.events.length = m.events; this.observed.length = m.observed; this.verification.length = m.verification;
      this.stepN = m.stepN; this.intentN = m.intentN; this.lastIntentId = m.lastIntentId;
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
      try {
        if (customAct) {
          await customAct();
          acted = true;
        } else if (spec.action === 'nav') {
          await this.page.goto(this.sut + pathOfPlaceholder(spec.url), { waitUntil: 'load' });
          acted = true;
        } else if (spec.action === 'selectOption') {
          const du = spec.dropdownUnit;
          const combo = this.page.getByRole('combobox', { name: du.fieldLabel });
          candidateCount = await combo.count().catch(() => 0);
          resolution = candidateCount === 1 ? 'unique' : candidateCount > 1 ? 'multi' : 'absent';
          // 点击身份门对称（R1-F2）：count===1 才动作，多匹配绝不点击（防真机点错/污染 SUT）。
          if (candidateCount === 1) {
            await combo.first().click({ timeout: 3000 });
            const list = this.page.locator(du.optionListSelector || '.hr-select__list');
            await list.getByText(du.optionText, { exact: true }).first().click({ timeout: 3000 });
            acted = true;
          }
        } else if (spec.action === 'press') {
          const { locator, count } = await this.resolveTarget(ev);
          candidateCount = count;
          resolution = count === 1 ? 'unique' : count > 1 ? 'multi' : 'absent';
          if (count === 1) { await locator.first().press(spec.key || 'Enter', { timeout: 3000 }); acted = true; }
        } else {
          const { locator, count } = await this.resolveTarget(ev);
          candidateCount = count;
          resolution = count === 1 ? 'unique' : count > 1 ? 'multi' : 'absent';
          if (count === 1) {
            const first = locator.first();
            if (spec.action === 'fill') await first.fill(instantiate(spec.value, this.ctx), { timeout: 3000 });
            else if (spec.action === 'dblclick') await first.dblclick({ timeout: 3000 });
            else await first.click({ timeout: 3000 });
            acted = true;
          }
        }
      } catch (e) {
        resolution = 'action_failed';
        this.notes.push(`步 ${stepId}（${spec.atom}/${spec.action}）动作失败：${String(e && e.message).slice(0, 160)}`);
      }
      await respWait;
      if (spec.action === 'click') await sleep(150); // 动作直接异步后果的出现窗（因果作用域，非任意时间窗）
      const quiet = await this.quietPoint();
      this.state.currentStepId = null;
      await this.capture(stepId, spec.intentId, spec.atom, recStart, quiet);
      this.events.push(ev);
      this.verification.push({ stepId, intentId: spec.intentId, atom: spec.atom, action: spec.action, resolution, candidateCount, acted });
      if (resolution !== 'unique') this.notes.push(`步 ${stepId} 定位核验非唯一（${resolution}，count=${candidateCount}）→ route:human`);
      return { stepId, resolution };
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

export async function compileFlow(run, flow) {
  for (const step of flow.steps || []) {
    await compileAtomStep(run, step);
  }
}

async function compileAtomStep(run, { atom, params = {} }) {
  if (atom === 'login') { run.notes.push('login 原子由登录预备动作承接，不产 event（凭据红线，护栏 #7）'); return; }
  if (atom && atom.startsWith('assert.')) {
    // 断言原子不产 event：折进所在 intent 作 P4 草拟输入（G7-3 取 A，意图留痕）。
    run.assertionAtoms.push({ intentId: run.lastIntentId, atom, params });
    return;
  }
  if (atom === 'workflow.create') return compileWorkflowCreate(run, params);
  if (atom === 'workflow.save') return compileWorkflowSave(run, params);
  if (atom === 'workflow.deleteByName') return compileWorkflowDelete(run, params);
  throw new Error(`原子 ${atom} 暂无编译知识（P3 第一条只骑 catalog_wf_crud 所用原子，扩表走后续飞轮）`);
}

// workflow.create：拆两 intent（进列表 + 新增）——对齐重表达清单草稿一。
async function compileWorkflowCreate(run, params) {
  const iNav = run.newIntent();
  await run.emit({ intentId: iNav, atom: 'workflow.create', action: 'nav', url: `{{baseUrl}}${ROUTE_LIST}` });

  const iCreate = run.newIntent();
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true }, text: '新增工作流',
  });
  // 下拉菜单分支线性化（约定 4）：真机若开菜单则多一步 menuitem 点击；直开抽屉则无本步。
  const menuitem = run.page.getByRole('menuitem', { name: '新增工作流' });
  await sleep(250);
  if ((await menuitem.count().catch(() => 0)) >= 1) {
    await run.emit({
      intentId: iCreate, atom: 'workflow.create', action: 'click',
      semantic: { kind: 'role', role: 'menuitem', name: '新增工作流', exact: true }, text: '新增工作流',
    });
  }
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'fill',
    semantic: { kind: 'label', name: '工作流名称' }, fieldLabel: '工作流名称', required: true,
    value: params.name, uniqueGuard: true,
  });
  if (params.desc) {
    // 描述 textarea 标签锚定可行性 = route:human ④：锚不上则不落步、记录。
    const descLoc = run.page.getByLabel('描述');
    if ((await descLoc.count().catch(() => 0)) >= 1) {
      await run.emit({ intentId: iCreate, atom: 'workflow.create', action: 'fill', semantic: { kind: 'label', name: '描述' }, fieldLabel: '描述', value: params.desc });
    } else {
      run.notes.push('描述 textarea 无标签锚定（route:human ④）：本步不落 event');
    }
  }
  if (params.category) {
    const sel = (run.site && run.site.select) || {};
    await run.emit({
      intentId: iCreate, atom: 'workflow.create', action: 'selectOption',
      dropdownUnit: {
        fieldLabel: '分类', optionText: params.category,
        scope: (sel.scopes && sel.scopes[0]) || '.hr-drawer__content-wrapper',
        optionListSelector: sel.optionList || '.hr-select__list',
        native: false,
      },
    });
  }
  // 抽屉确认按钮文本实采（确定/确认，route:human ⑤ 的编译期核验位）。
  let confirmName = null;
  for (const cand of ['确定', '确认']) {
    if ((await run.page.getByRole('button', { name: cand, exact: true }).count().catch(() => 0)) >= 1) { confirmName = cand; break; }
  }
  if (!confirmName) {
    confirmName = '确定';
    run.notes.push('抽屉确认按钮文本实采失败（确定/确认均 0 命中）→ route:human ⑤');
  }
  await run.emit({
    intentId: iCreate, atom: 'workflow.create', action: 'click',
    semantic: { kind: 'role', role: 'button', name: confirmName, exact: true }, text: confirmName,
    fallbackCss: '.hr-drawer__footer button.hr-button--primary',
  });
}

async function compileWorkflowSave(run) {
  const iSave = run.newIntent();
  await run.emit({
    intentId: iSave, atom: 'workflow.save', action: 'click',
    semantic: { kind: 'role', role: 'button', name: '保存', exact: true }, text: '保存',
  });
}

// workflow.deleteByName（收尾清理线性化）：入口 = 列表搜索框；可证缺席（count===0）→ CASE_DEFECT 候选，
// 整个原子不落 event、编译继续（G1 附属人签形态）。
async function compileWorkflowDelete(run, params) {
  const m = run.mark();
  const iDel = run.newIntent();
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'nav', url: `{{baseUrl}}${ROUTE_LIST}` });
  const search = run.page.getByRole('textbox', { name: SEARCH_BOX_NAME });
  const n = await search.count().catch(() => 0);
  if (n === 0) {
    run.rollback(m);
    run.caseDefectCandidates.push({
      atom: 'workflow.deleteByName', params,
      evidence: { target: `role=textbox name=${SEARCH_BOX_NAME}`, count: 0 },
      note: '入口可证缺席：目标 role/text 全 DOM count===0；候选仅编译期/人签前有效（design §4.3）',
    });
    run.notes.push('workflow.deleteByName 入口可证缺席 → CASE_DEFECT 候选、不落该步、编译继续（G1 附属）');
    return;
  }
  const searchSemantic = { kind: 'role', role: 'textbox', name: SEARCH_BOX_NAME };
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'fill', semantic: searchSemantic, value: params.name });
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'press', semantic: searchSemantic, key: 'Enter' });
  // 计数口径对账（R1-F6，机械决策兑现）：搜索隔离后实采表格行 count 与「删除」目标 count，
  // 恒等则 .hr-table-row 口径可直用；不恒等升 route:human（接缝级，expected 计数目标表达待决）。
  const tableRows = await run.page.locator('.hr-table-row').count().catch(() => null);
  const deleteButtons = await run.page.getByText('删除', { exact: true }).count().catch(() => null);
  run.countAudit = {
    tableRows, deleteButtons,
    equal: tableRows != null && deleteButtons != null && tableRows === deleteButtons,
  };
  if (!run.countAudit.equal) run.notes.push(`计数口径不恒等（表格行=${tableRows}，删除目标=${deleteButtons}）→ route:human（接缝级）`);
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'text', name: '删除', exact: true }, text: '删除' });
  // 删除确认按钮文本实采（route:human ⑦）。
  let confirmName = null;
  for (const cand of ['确定', '确认']) {
    if ((await run.page.getByRole('button', { name: cand, exact: true }).count().catch(() => 0)) >= 1) { confirmName = cand; break; }
  }
  if (!confirmName) { confirmName = '确定'; run.notes.push('删除确认按钮文本实采失败 → route:human ⑦'); }
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'click', semantic: { kind: 'role', role: 'button', name: confirmName, exact: true }, text: confirmName });
  // 重搜（删后归零断言的取数前提，属动作不属断言）。
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'fill', semantic: searchSemantic, value: params.name });
  await run.emit({ intentId: iDel, atom: 'workflow.deleteByName', action: 'press', semantic: searchSemantic, key: 'Enter' });
}

// 观测现状最终投影（drain 后调用，让异步 status/errorEnvelope 都已就位）：
// requestLog 条目与 watchNetworkForensics 记录同形；url 剥 query（G5）、initiator = 归因步或 background、
// status 取不到记 0（schema：requestfailed 记 0）、ts 归一 epoch 毫秒。
export function projectObserved(run, { caseId, capturedAt, capturedAgainstBuild = null }) {
  const records = run.forensics.records();
  const steps = run.observed.map((o) => ({
    stepId: o.stepId, intentId: o.intentId, atom: o.atom,
    urlPathnameAfter: o.urlPathnameAfter, cleanTitles: o.cleanTitles, toastTexts: o.toastTexts,
    replyText: o.replyText, replyStreamUrl: o.replyStreamUrl,
    requestLog: records.slice(o.recStart, o.recEnd).map((r) => ({
      url: stripUrlQuery(r.url),
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
