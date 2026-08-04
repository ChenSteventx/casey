#!/usr/bin/env node
// 零 SUT：纯进程内最小 DOM 模型 + page 门面。不起服务、不连浏览器、不发网络、不派子进程。
//
// 钉的是 lib/workflow-delete-domain.mjs 在【卡片布局】下的删除路径：
//   悬停目标卡片 → 点更多操作入口（button.agent-card__more，title=更多操作）
//   → 因果浮现的浮层菜单（div.hr-popup.hr-dropdown.hr-dropdown--bottom-right）内取「删除」
//   → 交回既有确认弹层因果授权链 → 确认 → 出站删除请求。
//
// DOM 形状与出站请求形状均来自真机实采，非臆造：
//   docs/plans/p9-created-workflow-cleanup-continuity-v3/evidence/shape-probe-20260804.md
//   docs/plans/admission-stale-green-triage/REAL-MACHINE-SEAMS-20260731.json（17 条实删互证）
// 出站请求这一钉的语义边界：删除域自己不发请求，本金牌钉的是「链条走到确认落笔那一击时，
// 夹具按实采形状发出的请求恰为 POST /ai-manager/process/delete + body.masProcessId」，
// 即形状是夹具契约、链条能否走到才是被测面。真机时序与真实 class 归 route:human（B4 段）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  inspectWorkflowDeleteTarget,
  performWorkflowDeleteTrigger,
  inspectWorkflowDeleteConfirm,
  performWorkflowDeleteConfirm,
} from '../../lib/workflow-delete-domain.mjs';
import { summarizeDeleteCountAudit } from '../../lib/compile-atoms-support.mjs';

const SEARCH_BOX_NAME = '输入工作流名称或编码进行搜索';
const TARGET = 'atl_shape0804a';
const TARGET_ID = 'wf-1001';
const DELETE_PATH = '/ai-manager/process/delete';

// ---------------------------------------------------------------- 最小 DOM 模型

globalThis.window = { getComputedStyle: (node) => node.__style };

class El {
  constructor(tag, attrs = {}, text = '') {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.__attrs = { ...attrs };
    this.__text = text;
    this.children = [];
    this.parentElement = null;
    this.__style = { display: 'block', visibility: 'visible' };
    this.__rect = { width: 120, height: 24 };
    this.__onClick = null;
    this.__onHover = null;
  }
  get className() { return this.__attrs.class || ''; }
  get classList() {
    const tokens = String(this.__attrs.class || '').split(/\s+/).filter(Boolean);
    return { contains: (name) => tokens.includes(name) };
  }
  get textContent() { return this.__text + this.children.map((child) => child.textContent).join(''); }
  get isConnected() {
    let node = this;
    while (node.parentElement) node = node.parentElement;
    return node.__isDocumentRoot === true;
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.__attrs, name) ? this.__attrs[name] : null; }
  setAttribute(name, value) { this.__attrs[name] = String(value); }
  removeAttribute(name) { delete this.__attrs[name]; }
  getBoundingClientRect() { return { ...this.__rect }; }
  contains(other) {
    let node = other;
    while (node) { if (node === this) return true; node = node.parentElement; }
    return false;
  }
  querySelectorAll(selector) {
    const specs = parseSelectorList(selector);
    return descendants(this).filter((node) => specs.some((spec) => matchesSpec(node, spec)));
  }
}

function el(tag, attrs = {}, text = '') { return new El(tag, attrs, text); }
function append(parent, child) { child.parentElement = parent; parent.children.push(child); return child; }
function detach(node) {
  const parent = node.parentElement;
  if (!parent) return;
  parent.children = parent.children.filter((child) => child !== node);
  node.parentElement = null;
}
function descendants(root) {
  const out = [];
  const walk = (node) => { for (const child of node.children) { out.push(child); walk(child); } };
  walk(root);
  return out;
}
function hide(node) { node.__style = { display: 'none', visibility: 'visible' }; return node; }
function show(node) { node.__style = { display: 'block', visibility: 'visible' }; return node; }
function visibleNode(node) {
  if (!node || node.nodeType !== 1 || !node.isConnected) return false;
  const style = node.__style;
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// 只支持复合选择器（tag / .class / [attr op "value"]）与逗号列表——生产侧删除域用到的全部形态。
function parseCompound(input) {
  const spec = { any: false, tag: null, classes: [], attrs: [] };
  let rest = input.trim();
  if (rest === '*') { spec.any = true; return spec; }
  while (rest.length) {
    if (rest[0] === '.') {
      const m = /^\.([A-Za-z0-9_-]+)/.exec(rest);
      if (!m) throw new Error(`选择器不支持：${input}`);
      spec.classes.push(m[1]); rest = rest.slice(m[0].length);
    } else if (rest[0] === '[') {
      const m = /^\[([A-Za-z0-9_:-]+)(?:([*$^~|]?=)"([^"]*)")?\]/.exec(rest);
      if (!m) throw new Error(`选择器不支持：${input}`);
      spec.attrs.push({ name: m[1], op: m[2] || null, value: m[3] == null ? null : m[3] });
      rest = rest.slice(m[0].length);
    } else {
      const m = /^([A-Za-z][A-Za-z0-9]*)/.exec(rest);
      if (!m) throw new Error(`选择器不支持：${input}`);
      spec.tag = m[1].toUpperCase(); rest = rest.slice(m[0].length);
    }
  }
  return spec;
}
function parseSelectorList(selector) {
  return String(selector).split(',').map((part) => part.trim()).filter(Boolean).map(parseCompound);
}
function matchesSpec(node, spec) {
  if (spec.any) return true;
  if (spec.tag && node.tagName !== spec.tag) return false;
  for (const name of spec.classes) if (!node.classList.contains(name)) return false;
  for (const attr of spec.attrs) {
    const value = node.getAttribute(attr.name);
    if (value == null) return false;
    if (!attr.op) continue;
    if (attr.op === '=' && value !== attr.value) return false;
    if (attr.op === '*=' && !value.includes(attr.value)) return false;
    if (attr.op === '$=' && !value.endsWith(attr.value)) return false;
    if (attr.op === '^=' && !value.startsWith(attr.value)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- page / handle 门面
// 替身按【调用链】建模：locator() 的返回值既被 elementHandles() 也被 evaluateAll() 调；
// getByRole().first() 的返回值还会被 inputValue() 调；handle.evaluate 里的函数是真跑的。

function unwrap(value) {
  if (value instanceof Handle) return value.node;
  if (Array.isArray(value)) return value.map(unwrap);
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = unwrap(item);
    return out;
  }
  return value;
}

function label(node) {
  return {
    tag: node.tagName.toLowerCase(),
    class: node.className,
    title: node.getAttribute('title'),
    text: node.textContent.replace(/\s+/g, ' ').trim(),
  };
}

class Handle {
  constructor(node, page) { this.node = node; this.page = page; this.disposed = false; }
  #live() { if (this.disposed) throw new Error('handle 已 dispose'); }
  async evaluate(fn, arg) { this.#live(); return fn(this.node, unwrap(arg)); }
  async dispose() { this.disposed = true; }
  async hover() {
    this.#live();
    if (!visibleNode(this.node)) throw new Error('hover 目标不可见');
    this.page.log.push({ kind: 'hover', ...label(this.node) });
    for (let node = this.node; node; node = node.parentElement) if (node.__onHover) node.__onHover();
  }
  async click() {
    this.#live();
    if (!visibleNode(this.node)) throw new Error('click 目标不可见');
    this.page.log.push({ kind: 'click', ...label(this.node) });
    for (let node = this.node; node; node = node.parentElement) if (node.__onClick) await node.__onClick();
  }
}

class Page {
  constructor(root) {
    this.root = root;
    this.log = [];
    this.requests = [];
    this.keyboard = {
      press: async (key) => {
        this.log.push({ kind: 'key', text: key });
        if (this.root.__onKey) this.root.__onKey(key);
      },
    };
  }
  #all() { return descendants(this.root).filter((node) => node.isConnected); }
  locator(selector) {
    const specs = parseSelectorList(selector);
    const find = () => this.#all().filter((node) => specs.some((spec) => matchesSpec(node, spec)));
    const page = this;
    return {
      async elementHandles() { return find().map((node) => new Handle(node, page)); },
      async evaluateAll(fn, arg) { return fn(find(), unwrap(arg)); },
      async count() { return find().length; },
      first() { return { async inputValue() { const node = find()[0]; return node ? String(node.__value == null ? '' : node.__value) : ''; } }; },
    };
  }
  getByRole(role, options = {}) {
    const find = () => this.#all().filter((node) => node.__role === role && node.__accName === options.name);
    return {
      async count() { return find().length; },
      first() { return { async inputValue() { const node = find()[0]; return node ? String(node.__value == null ? '' : node.__value) : ''; } }; },
    };
  }
  async evaluate(fn) { return fn(); }
  async waitForTimeout(ms) { await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5))); }
  clicks() { return this.log.filter((entry) => entry.kind === 'click'); }
  hovers() { return this.log.filter((entry) => entry.kind === 'hover'); }
}

// ---------------------------------------------------------------- 夹具

function makeConfirmDialog(page, doc, card) {
  // 2026-07-31 实采：.hr-dialog.hr-dialog__modal-warning，页脚两个可见钮 取消 / 确认（全页无「确定」）。
  const dialog = el('div', { class: 'hr-dialog hr-dialog__modal-warning' });
  append(dialog, el('div', { class: 'hr-dialog__body' }, '删除后不可恢复，请谨慎操作。'));
  const footer = append(dialog, el('div', { class: 'hr-dialog__footer' }));
  append(footer, el('button', { class: 'hr-button' }, '取消'));
  const ok = append(footer, el('button', { class: 'hr-button hr-button--danger' }, '确认'));
  ok.__onClick = () => {
    page.requests.push({ method: 'POST', path: DELETE_PATH, body: { masProcessId: card.getAttribute('data-id') } });
    detach(dialog);
    detach(card);
  };
  return dialog;
}

function makeMenu(page, doc, card, options) {
  const {
    menuLabels = ['编辑', '复制', '删除', '停用'],
    nestedItemText = false,
    attachTo = 'body',
    keepOpenAfterDelete = false,
  } = options;
  const popup = el('div', { class: 'hr-popup hr-dropdown hr-dropdown--bottom-right' });
  const menu = append(popup, el('div', { class: 'hr-dropdown__menu' }));
  for (const text of menuLabels) {
    const item = append(menu, el('div', { class: 'hr-dropdown__item' }));
    // 真机是 div 汤、无 menuitem 角色；嵌套变体让 item 与 item-text 两层 textContent 都恰为该文本。
    if (nestedItemText) append(item, el('span', { class: 'hr-dropdown__item-text' }, text));
    else item.__text = text;
    if (text === '删除') {
      item.__onClick = () => {
        if (!keepOpenAfterDelete) detach(popup);
        append(doc, makeConfirmDialog(page, doc, card));
      };
    }
  }
  append(attachTo === 'card' ? card : doc, popup);
  return popup;
}

function buildFixture(options = {}) {
  const {
    layout = 'card',
    cards = 1,
    moreButtons = 1,
    moreSignal = 'both',
    directDelete = false,
    menuAppears = true,
    searchValue = TARGET,
  } = options;

  const doc = el('body');
  doc.__isDocumentRoot = true;
  const page = new Page(doc);

  const search = append(doc, el('input', { class: 'hr-input__inner' }));
  search.__role = 'textbox';
  search.__accName = SEARCH_BOX_NAME;
  search.__value = searchValue;

  // 2026-07-31 seam-2 caveat：新建工作流抽屉里另有一个【不可见】的同名「确认」钮，
  // 授权弹层域外命中不得被取走——这是确认环作用域纪律的负控。
  const drawer = append(doc, el('div', { class: 'dialog-concent' }));
  hide(append(drawer, el('button', { class: 'hr-button' }, '确认')));

  const list = append(doc, el('div', { class: 'agent-card-list' }));
  const built = [];
  for (let i = 0; i < cards; i++) {
    const record = layout === 'table'
      ? append(list, el('tr', { class: 'hr-table-row', 'data-id': `${TARGET_ID}-${i}` }))
      : append(list, el('article', { class: 'agent-card', 'data-id': i === 0 ? TARGET_ID : `${TARGET_ID}-${i}` }));
    append(record, el('div', { class: layout === 'table' ? 'cell-name' : 'agent-card__title' }, TARGET));
    append(record, el('div', { class: layout === 'table' ? 'cell-code' : 'agent-card__subtitle' }, `CODE_${i}`));

    if (layout === 'table' || directDelete) {
      const del = append(record, el('button', { class: 'hr-action-delete' }, '删除'));
      del.__onClick = () => { append(doc, makeConfirmDialog(page, doc, record)); };
    }
    if (layout === 'card') {
      for (let k = 0; k < moreButtons; k++) {
        const attrs = { class: moreSignal === 'title-only' ? 'agent-card__action' : 'agent-card__more' };
        if (moreSignal !== 'class-only') attrs.title = '更多操作';
        const more = hide(append(record, el('button', attrs)));
        // 真机：更多操作入口悬停才浮现；故只读审计环数不到「可见」的它——存在性计数是设计定案。
        record.__onHover = () => { for (const node of record.querySelectorAll('button')) show(node); };
        if (menuAppears) more.__onClick = () => { makeMenu(page, doc, record, options); };
      }
    }
    built.push(record);
  }

  // 真机实采：菜单有隐藏副本多份（2026-07-02 注）——可见性谓词必须把它们滤掉。
  const ghost = hide(append(doc, el('div', { class: 'hr-popup hr-dropdown hr-dropdown--bottom-right' })));
  append(hide(append(ghost, el('div', { class: 'hr-dropdown__menu' }))), el('div', { class: 'hr-dropdown__item' }, '删除'));

  doc.__onKey = (key) => {
    if (key !== 'Escape') return;
    for (const node of doc.querySelectorAll('.hr-popup')) if (visibleNode(node)) detach(node);
  };

  return { page, doc, records: built };
}

// ---------------------------------------------------------------- 断言

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}：期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
}
function ok(value, what) { if (!value) throw new Error(what); }

async function runWholeChain(page, confirmName) {
  const trigger = await performWorkflowDeleteTrigger(page, TARGET);
  if (trigger.resolution !== 'unique') return { trigger };
  const found = await inspectWorkflowDeleteConfirm(page);
  if (found.resolution !== 'unique') return { trigger, found };
  const confirmed = await performWorkflowDeleteConfirm(page, confirmName || found.confirmName, TARGET);
  return { trigger, found, confirmed };
}

await check('R1 卡片布局全链：悬停→更多操作→菜单删除→确认→出站请求形状', async () => {
  const { page } = buildFixture({ layout: 'card' });
  const { trigger, found, confirmed } = await runWholeChain(page);
  eq(trigger.resolution, 'unique', '触发解析态');
  eq(trigger.identityReadback?.ok, true, '触发身份回读');
  eq(page.hovers().length, 1, '悬停次数');
  eq(page.hovers()[0].class, 'agent-card', '悬停对象须是目标卡片');
  const clicks = page.clicks();
  eq(clicks.length, 3, '点击次数（更多操作/菜单删除/确认）');
  ok(/agent-card__more/.test(clicks[0].class) || clicks[0].title === '更多操作', '第一击须是更多操作入口');
  eq(clicks[1].text, '删除', '第二击须是菜单内删除项');
  ok(/hr-dropdown__item/.test(clicks[1].class), '第二击须落在浮层菜单项上');
  eq(found?.resolution, 'unique', '确认弹层发现解析态');
  eq(found?.confirmName, '确认', '确认按钮文案（2026-07-31 实采：确认，非确定）');
  eq(confirmed?.resolution, 'unique', '确认落笔解析态');
  eq(page.requests.length, 1, '出站请求条数');
  eq(page.requests[0].method, 'POST', '出站方法');
  eq(page.requests[0].path, DELETE_PATH, '出站路径');
  eq(JSON.stringify(Object.keys(page.requests[0].body)), JSON.stringify(['masProcessId']), '出站 body 字段集');
  eq(page.requests[0].body.masProcessId, TARGET_ID, '出站 id 取值');
});

await check('R2 表格布局回归：直见删除钮路径零位移、零悬停、卡片路径不执行', async () => {
  const { page } = buildFixture({ layout: 'table' });
  const { trigger, found, confirmed } = await runWholeChain(page);
  eq(trigger.resolution, 'unique', '触发解析态');
  eq(trigger.candidateCount, 1, '触发候选数');
  eq(page.hovers().length, 0, '表格路径不得悬停');
  const clicks = page.clicks();
  eq(clicks.length, 2, '点击次数（删除/确认）');
  eq(clicks[0].text, '删除', '第一击须是行内直见删除钮');
  eq(clicks[0].class, 'hr-action-delete', '第一击控件类');
  eq(found?.resolution, 'unique', '确认弹层发现解析态');
  eq(confirmed?.resolution, 'unique', '确认落笔解析态');
  eq(page.requests.length, 1, '出站请求条数');
});

await check('R3 多卡同名歧义拒：零点击、零请求', async () => {
  const { page } = buildFixture({ layout: 'card', cards: 2 });
  const trigger = await performWorkflowDeleteTrigger(page, TARGET);
  eq(trigger.resolution, 'ambiguous', '解析态');
  eq(trigger.candidateCount, 2, '候选数');
  eq(page.clicks().length, 0, '歧义时绝不点击');
  eq(page.requests.length, 0, '歧义时绝不发请求');
});

await check('R4 单卡多个更多操作入口歧义拒：零点击、零请求', async () => {
  const { page } = buildFixture({ layout: 'card', moreButtons: 2 });
  const trigger = await performWorkflowDeleteTrigger(page, TARGET);
  eq(trigger.resolution, 'ambiguous', '解析态');
  eq(trigger.candidateCount, 2, '候选数');
  eq(page.clicks().length, 0, '入口非唯一时绝不点击');
  eq(page.requests.length, 0, '入口非唯一时绝不发请求');
});

await check('R5 菜单无删除项具名拒：菜单确实开过、但零菜单项点击、零请求', async () => {
  const { page } = buildFixture({ layout: 'card', menuLabels: ['编辑', '复制', '停用'] });
  const trigger = await performWorkflowDeleteTrigger(page, TARGET);
  eq(trigger.resolution, 'none', '解析态');
  const clicks = page.clicks();
  eq(clicks.length, 1, '只应点开更多操作入口这一击');
  ok(/agent-card__more/.test(clicks[0].class) || clicks[0].title === '更多操作', '唯一一击须是更多操作入口');
  eq(page.requests.length, 0, '零请求');
});

await check('R6 菜单内多个删除项歧义拒', async () => {
  const { page } = buildFixture({ layout: 'card', menuLabels: ['编辑', '删除', '删除'] });
  const trigger = await performWorkflowDeleteTrigger(page, TARGET);
  eq(trigger.resolution, 'ambiguous', '解析态');
  eq(trigger.candidateCount, 2, '候选数');
  eq(page.clicks().length, 1, '只应点开更多操作入口这一击');
  eq(page.requests.length, 0, '零请求');
});

await check('R7 点开更多操作后菜单不浮现：有界等待后具名拒', async () => {
  const { page } = buildFixture({ layout: 'card', menuAppears: false });
  const trigger = await performWorkflowDeleteTrigger(page, TARGET);
  eq(trigger.resolution, 'none', '解析态');
  eq(page.clicks().length, 1, '只应点开更多操作入口这一击');
  eq(page.requests.length, 0, '零请求');
});

await check('R8 嵌套同文本两层 + 隐藏菜单副本 + 浮层根与内层同时命中 → 归一为恰 1', async () => {
  const { page } = buildFixture({ layout: 'card', nestedItemText: true });
  const { trigger, confirmed } = await runWholeChain(page);
  eq(trigger.resolution, 'unique', '触发解析态（父子同文本须收敛成 1，不得假歧义）');
  eq(confirmed?.resolution, 'unique', '确认落笔解析态');
  eq(page.requests.length, 1, '出站请求条数');
});

await check('R9 菜单挂在卡片内（非文档根）时同样成立', async () => {
  const { page } = buildFixture({ layout: 'card', attachTo: 'card' });
  const { trigger, confirmed } = await runWholeChain(page);
  eq(trigger.resolution, 'unique', '触发解析态');
  eq(confirmed?.resolution, 'unique', '确认落笔解析态');
  eq(page.requests.length, 1, '出站请求条数');
});

await check('R10 计数口径：卡片布局可达删除面 1:1，且直见/菜单入口分列留证', async () => {
  const card = buildFixture({ layout: 'card' });
  const cardAudit = await inspectWorkflowDeleteTarget(card.page, TARGET);
  eq(cardAudit.layout, 'card', '布局');
  eq(cardAudit.resolution, 'unique', '记录容器解析态');
  eq(cardAudit.deleteButtons, 1, '可达删除面数');
  eq(cardAudit.directDeleteButtons, 0, '直见删除钮数');
  eq(cardAudit.menuDeleteEntries, 1, '更多操作入口数');
  eq(card.page.hovers().length, 0, '只读审计环绝不悬停');
  eq(card.page.clicks().length, 0, '只读审计环绝不开菜单');
  eq(summarizeDeleteCountAudit({
    tableRows: cardAudit.tableRows, targetCards: cardAudit.targetCards,
    tableDeleteButtons: null, targetCardDeleteButtons: cardAudit.deleteButtons, globalDeleteButtons: 1,
  }).equal, true, '卡片布局对账恒等');

  const table = buildFixture({ layout: 'table' });
  const tableAudit = await inspectWorkflowDeleteTarget(table.page, TARGET);
  eq(tableAudit.layout, 'table', '布局');
  eq(tableAudit.deleteButtons, 1, '可达删除面数');
  eq(tableAudit.directDeleteButtons, 1, '直见删除钮数');
  eq(tableAudit.menuDeleteEntries, 0, '更多操作入口数');
  eq(summarizeDeleteCountAudit({
    tableRows: tableAudit.tableRows, targetCards: tableAudit.targetCards,
    tableDeleteButtons: tableAudit.deleteButtons, targetCardDeleteButtons: null, globalDeleteButtons: 1,
  }).equal, true, '表格布局对账恒等');
});

await check('R11 直见删除钮与更多操作入口并存 → 可达删除面 2 ≠ 记录容器 1，编译期硬阻断', async () => {
  const { page } = buildFixture({ layout: 'card', directDelete: true });
  const audit = await inspectWorkflowDeleteTarget(page, TARGET);
  eq(audit.layout, 'card', '布局');
  eq(audit.deleteButtons, 2, '可达删除面数');
  eq(audit.directDeleteButtons, 1, '直见删除钮数');
  eq(audit.menuDeleteEntries, 1, '更多操作入口数');
  eq(summarizeDeleteCountAudit({
    tableRows: audit.tableRows, targetCards: audit.targetCards,
    tableDeleteButtons: null, targetCardDeleteButtons: audit.deleteButtons, globalDeleteButtons: 2,
  }).equal, false, '双入口不得放行破坏性删除');
});

await check('R12 菜单浮层不串味：菜单点后不关闭时确认弹层因果授权仍唯一', async () => {
  const { page } = buildFixture({ layout: 'card', keepOpenAfterDelete: true });
  const { trigger, found, confirmed } = await runWholeChain(page);
  eq(trigger.resolution, 'unique', '触发解析态（菜单不得被弹层选择器当成新弹层）');
  eq(found?.resolution, 'unique', '确认弹层发现解析态');
  eq(confirmed?.resolution, 'unique', '确认落笔解析态');
  eq(page.requests.length, 1, '出站请求条数');
});

await check('R13 更多操作入口只带 title 无专用 class 时同样识别', async () => {
  const { page } = buildFixture({ layout: 'card', moreSignal: 'title-only' });
  const { trigger, confirmed } = await runWholeChain(page);
  eq(trigger.resolution, 'unique', '触发解析态');
  eq(confirmed?.resolution, 'unique', '确认落笔解析态');
  eq(page.requests.length, 1, '出站请求条数');
});

await check('R14 本金牌自身零 SUT 卫生', async () => {
  // 判据串必须运行期拼装：写成字面量会被自己扫到（自匹配假红），本轮首跑当场逮到过一次。
  const banned = [
    ['node:child', 'process'].join('_'),
    ['spawn', 'Sync'].join(''),
    ['exec', 'Sync'].join(''),
    ['play', 'wright'].join(''),
    ['node:', 'net'].join(''),
    ['.lis', 'ten('].join(''),
  ];
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  for (const token of banned) ok(!self.includes(token), `零 SUT 金牌不得出现 ${token}`);
});

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
