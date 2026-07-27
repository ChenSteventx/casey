#!/usr/bin/env node
// Playwright page driver 的纯内存端口回归；零 browser/server/SUT/network。
import {
  bindObservationAuthority,
  createAffordanceCatalog,
} from '../../lib/zero-shot/affordance-catalog.mjs';
import { createPlaywrightPageDriver } from '../../lib/zero-shot/playwright-page-driver.mjs';

const failures = [];
let passed = 0;

async function check(checkId, name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${checkId} ${name}`);
  } catch (error) {
    failures.push(`${checkId} ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deferredTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function disposableHandle(id) {
  return {
    id,
    disposed: 0,
    async dispose() {
      this.disposed += 1;
    },
  };
}

class ElementHandleDouble {
  constructor(node, { kind = 'source' } = {}) {
    this.node = node;
    this.kind = kind;
    this.disposed = 0;
  }

  asElement() {
    return this;
  }

  async evaluate(fn, argument) {
    const resolved = argument instanceof ElementHandleDouble ? argument.node : argument;
    return fn(this.node, resolved);
  }

  async click() {
    if (typeof this.node.onClick === 'function') await this.node.onClick();
  }

  async dispose() {
    this.disposed += 1;
  }
}

class PropertyHandleDouble {
  constructor(value) {
    this.value = value;
    this.disposed = 0;
  }

  async getProperties() {
    return new Map(this.value.map((item, index) => [String(index), item]));
  }

  async jsonValue() {
    return structuredClone(this.value);
  }

  async dispose() {
    this.disposed += 1;
  }
}

class RootHandleDouble {
  constructor(handles) {
    this.properties = {
      nodes: new PropertyHandleDouble(handles),
      unsupportedScopes: new PropertyHandleDouble({
        iframe: false,
        shadow: false,
        containerOnly: false,
      }),
      sourceTruncated: new PropertyHandleDouble(false),
    };
    this.disposed = 0;
  }

  async getProperty(name) {
    return this.properties[name];
  }

  async dispose() {
    this.disposed += 1;
  }
}

function element({
  tag = 'button',
  attrs = {},
  text = '',
  parent = null,
  imageAlt = null,
  hidden = false,
  disabled = false,
} = {}) {
  const normalized = new Map(
    Object.entries(attrs).map(([key, value]) => [key, String(value)]),
  );
  const node = {
    tagName: tag.toUpperCase(),
    textContent: text,
    parentElement: parent,
    labels: [],
    disabled,
    isConnected: true,
    _hidden: hidden,
    _enabled: !disabled,
    style: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
    },
    getAttribute(name) {
      return normalized.has(name) ? normalized.get(name) : null;
    },
    hasAttribute(name) {
      return normalized.has(name);
    },
    querySelector(selector) {
      return selector === 'img[alt]' && imageAlt !== null
        ? { getAttribute: (name) => name === 'alt' ? imageAlt : null }
        : null;
    },
    getBoundingClientRect() {
      return { width: 80, height: 24 };
    },
  };
  return node;
}

function locatorFor(targets, calls, options) {
  const matched = targets.filter((node) => options.includeHidden === true || node._hidden !== true);
  return {
    async count() {
      return matched.length;
    },
    nth(index) {
      return locatorFor(matched[index] ? [matched[index]] : [], calls, options);
    },
    first() {
      return this.nth(0);
    },
    async elementHandle() {
      return matched[0] ? new ElementHandleDouble(matched[0], { kind: 'locator' }) : null;
    },
    async isVisible() {
      return matched.length === 1 && matched[0]._hidden !== true;
    },
    async isEnabled() {
      return matched.length === 1 && matched[0]._enabled !== false;
    },
  };
}

function contextDouble(initialPage) {
  const pages = [initialPage];
  const listeners = new Map();
  const context = {
    pages: () => [...pages],
    on(event, listener) {
      const bucket = listeners.get(event) || new Set();
      bucket.add(listener);
      listeners.set(event, bucket);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event, value) {
      for (const listener of listeners.get(event) || []) listener(value);
    },
    add(page) {
      pages.push(page);
      context.emit('page', page);
    },
    remove(page) {
      const index = pages.indexOf(page);
      if (index >= 0) pages.splice(index, 1);
    },
  };
  return context;
}

function pageDouble(handles) {
  const calls = [];
  const root = new RootHandleDouble(handles);
  const page = {
    roleTargets: [],
    labelTargets: [],
    textTargets: [],
    legacyCount: 1,
    closed: false,
    async evaluateHandle() {
      return root;
    },
    async evaluate() {
      return page.legacyCount;
    },
    url() {
      return 'https://synthetic.invalid/read';
    },
    async title() {
      return 'synthetic';
    },
    isClosed() {
      return page.closed;
    },
    getByRole(role, options = {}) {
      calls.push({ kind: 'role', role, ...options });
      return locatorFor(page.roleTargets, calls, options);
    },
    getByLabel(name, options = {}) {
      calls.push({ kind: 'label', name, ...options });
      return locatorFor(page.labelTargets, calls, options);
    },
    getByText(name, options = {}) {
      calls.push({ kind: 'text', name, ...options });
      return locatorFor(page.textTargets, calls, options);
    },
  };
  page.browserContext = contextDouble(page);
  page.context = () => page.browserContext;
  return { page, calls, root };
}

const previousGetComputedStyle = globalThis.getComputedStyle;
const previousDocument = globalThis.document;
globalThis.getComputedStyle = (node) => node.style;
globalThis.document = { getElementById: () => null };

// sourceObligationId:zs-driver-hardening-h1 unitCheckId:playwright-driver-hardening-h1
await check('playwright-driver-hardening-h1',
  'catalog 丢弃无语义和超预算 handle，bind 拒绝时释放剩余 handle', async () => {
    const invalid = disposableHandle('invalid');
    const kept = disposableHandle('kept');
    const overflow = disposableHandle('overflow');
    const catalog = createAffordanceCatalog({
      snapshot: {
        affordances: [
          { handle: invalid, visible: true, enabled: true, actionSpace: ['click'] },
          {
            handle: kept,
            role: 'link',
            accessibleName: '甲',
            visible: true,
            enabled: true,
            actionSpace: ['click'],
          },
          {
            handle: overflow,
            role: 'link',
            accessibleName: '乙',
            visible: true,
            enabled: true,
            actionSpace: ['click'],
          },
        ],
      },
      maxCandidates: 1,
    });
    assert(catalog.ok === true && catalog.records.size === 1, 'catalog 应保留一个有界 handle');
    await deferredTick();
    assert(invalid.disposed === 1 && overflow.disposed + kept.disposed === 1,
      `未保留 handle 应释放：${JSON.stringify({
        invalid: invalid.disposed,
        overflow: overflow.disposed,
        kept: kept.disposed,
      })}`);
    const rejected = bindObservationAuthority({
      driver: {},
      observation: null,
      revision: 'rev_1',
      records: catalog.records,
    });
    assert(rejected.ok === false, '无效 observation 应拒绝 bind');
    await deferredTick();
    assert(kept.disposed === 1 && overflow.disposed === 1,
      'bind 拒绝后剩余 handle 也必须释放');
  });

// sourceObligationId:zs-driver-hardening-h2 unitCheckId:playwright-driver-hardening-h2
await check('playwright-driver-hardening-h2',
  'facts 处理 aria-hidden、submit value、button img alt 与多 token role', async () => {
    const ariaHidden = element({ tag: 'div', attrs: { 'aria-hidden': 'true' } });
    const hiddenButton = element({ tag: 'button', text: '隐藏入口', parent: ariaHidden });
    const submit = element({ tag: 'input', attrs: { type: 'submit', value: '发送' } });
    const imageButton = element({ tag: 'button', imageAlt: '图像入口' });
    const multiRole = element({
      tag: 'div',
      attrs: { role: 'button presentation', 'aria-label': '组合角色' },
    });
    const handles = [hiddenButton, submit, imageButton, multiRole]
      .map((node) => new ElementHandleDouble(node));
    const { page } = pageDouble(handles);
    const driver = createPlaywrightPageDriver({ page });
    const snapshot = await driver.snapshotMainFrame();

    assert(snapshot.affordances[0].visible === false, 'aria-hidden ancestor 必须使候选不可动作');
    assert(snapshot.affordances[1].accessibleName === '发送', 'submit accessible name 应读 value');
    assert(snapshot.affordances[2].accessibleName === '图像入口', 'button 应读 descendant img alt');
    assert(snapshot.affordances[3].role === 'button', '多 token role 应选首 token');
    for (const handle of handles) await handle.dispose();
  });

// sourceObligationId:zs-driver-hardening-h3 unitCheckId:playwright-driver-hardening-h3
await check('playwright-driver-hardening-h3',
  'revalidate 以 exact hidden-aware locator 计数并验证物理同节点', async () => {
    const originalNode = element({ tag: 'button', text: '查看详情' });
    const original = new ElementHandleDouble(originalNode);
    const { page, calls } = pageDouble([original]);
    page.roleTargets = [originalNode];
    const driver = createPlaywrightPageDriver({ page });
    const snapshot = await driver.snapshotMainFrame();
    const semanticSignature = {
      kind: 'role',
      role: 'button',
      name: '查看详情',
      exact: true,
    };
    const unique = await driver.revalidate({
      handle: original,
      semanticSignature,
      revision: snapshot.revision,
    });
    assert(unique.pageCount === 1 && unique.sameNode === true
      && unique.visible === true && unique.enabled === true,
    `exact 唯一同节点应可动作：${JSON.stringify(unique)}`);
    assert(calls.some((call) => call.kind === 'role'
      && call.exact === true && call.includeHidden === true),
    'page-wide 计数须调用 exact + includeHidden role locator');

    const replacementNode = element({ tag: 'button', text: '查看详情' });
    page.roleTargets = [replacementNode];
    const replacement = await driver.revalidate({
      handle: original,
      semanticSignature,
      revision: snapshot.revision,
    });
    assert(replacement.sameNode === false, '同语义 replacement 不得冒充原物理节点');

    const hiddenDuplicate = element({
      tag: 'button',
      text: '查看详情',
      hidden: true,
      attrs: { 'aria-hidden': 'true' },
    });
    page.roleTargets = [originalNode, hiddenDuplicate];
    const duplicate = await driver.revalidate({
      handle: original,
      semanticSignature,
      revision: snapshot.revision,
    });
    assert(duplicate.pageCount === 2, `hidden duplicate 必须进入全页计数：${duplicate.pageCount}`);
    await original.dispose();
  });

// sourceObligationId:zs-driver-hardening-h4 unitCheckId:playwright-driver-hardening-h4
await check('playwright-driver-hardening-h4',
  'perform 遇 popup、新 page、原页关闭或 context topology 改变时 fail-closed', async () => {
    const normalNode = element({ tag: 'a', attrs: { href: '/detail' }, text: '详情' });
    const normalHandle = new ElementHandleDouble(normalNode);
    const normalPage = pageDouble([normalHandle]).page;
    const normalDriver = createPlaywrightPageDriver({ page: normalPage });
    const normal = await normalDriver.perform({ handle: normalHandle, action: 'click' });
    assert(normal.performed === true, 'topology 不变时允许签 performed');

    const popupNode = element({ tag: 'a', attrs: { href: '/popup' }, text: '弹窗' });
    const popupHandle = new ElementHandleDouble(popupNode);
    const popupPage = pageDouble([popupHandle]).page;
    popupNode.onClick = async () => {
      popupPage.browserContext.add({ isClosed: () => false });
    };
    const popupDriver = createPlaywrightPageDriver({ page: popupPage });
    await assertRejects(
      () => popupDriver.perform({ handle: popupHandle, action: 'click' }),
      'popup/new page 必须 fail-closed',
    );

    const closeNode = element({ tag: 'a', attrs: { href: '/close' }, text: '关闭' });
    const closeHandle = new ElementHandleDouble(closeNode);
    const closePage = pageDouble([closeHandle]).page;
    closeNode.onClick = async () => {
      closePage.closed = true;
      closePage.browserContext.remove(closePage);
    };
    const closeDriver = createPlaywrightPageDriver({ page: closePage });
    await assertRejects(
      () => closeDriver.perform({ handle: closeHandle, action: 'click' }),
      '原页关闭必须 fail-closed',
    );
  });

function assertRejects(fn, message) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      throw new Error(message);
    }, () => {});
}

globalThis.getComputedStyle = previousGetComputedStyle;
globalThis.document = previousDocument;

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nplaywright-page-driver-hardening: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\nplaywright-page-driver-hardening: ${passed}/4 passed`);
