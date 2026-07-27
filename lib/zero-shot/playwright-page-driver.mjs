// Playwright 1.60.0 page port for the zero-shot observer.
// Discovery is main-document DOM traversal; actions retain the original ElementHandle.

import { settleBeforeCapture } from '../replay-settle.mjs';

export const PLAYWRIGHT_PAGE_DRIVER_VERSION = '1.60.0';
const MAX_DISCOVERED = 1000;
const MAX_VISITED = 20000;

function validPage(page) {
  return page && typeof page === 'object'
    && typeof page.evaluateHandle === 'function'
    && typeof page.evaluate === 'function'
    && typeof page.url === 'function'
    && typeof page.title === 'function'
    && typeof page.context === 'function'
    && typeof page.isClosed === 'function';
}

function validContext(context) {
  return context && typeof context === 'object'
    && typeof context.pages === 'function'
    && typeof context.on === 'function';
}

async function releaseHandle(handle) {
  if (handle && typeof handle.dispose === 'function') {
    await Promise.resolve(handle.dispose()).catch(() => {});
  }
}

async function releaseHandles(handles) {
  await Promise.all([...new Set(handles.filter(Boolean))].map(releaseHandle));
}

async function discoverMainFrame(page) {
  let root;
  let nodesHandle;
  let unsupportedHandle;
  let truncatedHandle;
  const transferred = [];
  const disposableProperties = [];
  try {
    root = await page.evaluateHandle(({ maxDiscovered, maxVisited }) => {
      const nodes = [];
      let iframe = false;
      let shadow = false;
      let sourceTruncated = false;
      let visited = 0;
      const walker = document.createTreeWalker(
        document.documentElement || document.body,
        NodeFilter.SHOW_ELEMENT,
      );
      let element = walker.currentNode;
      while (element) {
        visited += 1;
        const tag = element.tagName?.toLowerCase() || '';
        if (tag === 'iframe' || tag === 'frame') iframe = true;
        if (element.shadowRoot) shadow = true;
        const explicitRole = element.getAttribute?.('role');
        const inputType = tag === 'input'
          ? (element.getAttribute('type') || 'text').toLowerCase()
          : '';
        const nativeCandidate = tag === 'button'
          || tag === 'a' && element.hasAttribute('href')
          || tag === 'textarea' || tag === 'select' || tag === 'summary'
          || tag === 'option'
          || tag === 'input' && inputType !== 'hidden';
        const roleCandidate = typeof explicitRole === 'string' && explicitRole.trim() !== '';
        if (nativeCandidate || roleCandidate) {
          if (nodes.length < maxDiscovered) nodes.push(element);
          else sourceTruncated = true;
        }
        if (visited >= maxVisited) {
          if (walker.nextNode()) sourceTruncated = true;
          break;
        }
        element = walker.nextNode();
      }
      return {
        nodes,
        unsupportedScopes: { iframe, shadow, containerOnly: false },
        sourceTruncated,
      };
    }, { maxDiscovered: MAX_DISCOVERED, maxVisited: MAX_VISITED });

    nodesHandle = await root.getProperty('nodes');
    unsupportedHandle = await root.getProperty('unsupportedScopes');
    truncatedHandle = await root.getProperty('sourceTruncated');
    const properties = await nodesHandle.getProperties();
    const entries = [...properties.entries()]
      .sort(([left], [right]) => Number(left) - Number(right));
    for (const [key, property] of entries) {
      const element = /^\d+$/.test(key) && typeof property.asElement === 'function'
        ? property.asElement()
        : null;
      if (element) transferred.push(element);
      else disposableProperties.push(property);
    }
    const unsupportedScopes = await unsupportedHandle.jsonValue();
    const sourceTruncated = await truncatedHandle.jsonValue();
    return { handles: transferred, unsupportedScopes, sourceTruncated };
  } catch (error) {
    await releaseHandles(transferred);
    throw error;
  } finally {
    await releaseHandles([
      ...disposableProperties,
      nodesHandle,
      unsupportedHandle,
      truncatedHandle,
      root,
    ]);
  }
}

async function factsFor(handle) {
  return handle.evaluate((element) => {
    const textOf = (value) => typeof value === 'string'
      ? value.replace(/\s+/gu, ' ').trim().slice(0, 256)
      : '';
    const tag = element.tagName?.toLowerCase() || '';
    const type = tag === 'input'
      ? (element.getAttribute('type') || 'text').toLowerCase()
      : '';
    const nativeRole = () => {
      if (tag === 'button') return 'button';
      if (tag === 'a' && element.hasAttribute('href')) return 'link';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'select') return element.multiple ? 'listbox' : 'combobox';
      if (tag === 'option') return 'option';
      if (tag === 'summary') return 'button';
      if (tag !== 'input') return null;
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'search') return 'searchbox';
      return 'textbox';
    };
    const role = textOf(element.getAttribute('role')).toLowerCase().split(/\s+/u)[0]
      || nativeRole();
    const label = textOf(
      element.labels && element.labels.length
        ? [...element.labels].map((item) => item.textContent || '').join(' ')
        : '',
    );
    const labelledBy = textOf(element.getAttribute('aria-labelledby'))
      .split(' ')
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' ');
    const inputValue = tag === 'input' && ['button', 'submit', 'reset'].includes(type)
      ? element.getAttribute('value')
        || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : '')
      : '';
    const descendantImageAlt = tag === 'button'
      ? element.querySelector?.('img[alt]')?.getAttribute?.('alt')
      : '';
    const accessibleName = textOf(
      element.getAttribute('aria-label')
      || labelledBy
      || label
      || element.getAttribute('alt')
      || element.getAttribute('title')
      || inputValue
      || (tag === 'input' ? element.getAttribute('placeholder') : '')
      || element.textContent
      || descendantImageAlt,
    );
    const text = textOf(element.textContent);
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const visible = style.display !== 'none' && style.visibility !== 'hidden'
      && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    let inertAncestor = false;
    let ariaHiddenAncestor = false;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hasAttribute('inert')) {
        inertAncestor = true;
      }
      if (ancestor.hasAttribute('hidden')
        || ancestor.getAttribute('aria-hidden') === 'true') ariaHiddenAncestor = true;
    }
    const disabled = element.disabled === true
      || element.getAttribute('aria-disabled') === 'true'
      || inertAncestor;
    return {
      role: role || null,
      accessibleName: accessibleName || null,
      label: label || null,
      text: text || null,
      visible: visible && !ariaHiddenAncestor,
      enabled: !disabled,
      actionSpace: ['click'],
    };
  });
}

function signatureKey(value) {
  return JSON.stringify(value);
}

function exactLocator(page, semanticSignature, { includeHidden = false } = {}) {
  if (!semanticSignature || semanticSignature.exact !== true) return null;
  if (semanticSignature.kind === 'role'
    && typeof semanticSignature.role === 'string'
    && typeof semanticSignature.name === 'string'
    && typeof page.getByRole === 'function') {
    return page.getByRole(semanticSignature.role, {
      name: semanticSignature.name,
      exact: true,
      ...(includeHidden ? { includeHidden: true } : {}),
    });
  }
  if (semanticSignature.kind === 'label'
    && typeof semanticSignature.name === 'string'
    && typeof page.getByLabel === 'function') {
    return page.getByLabel(semanticSignature.name, { exact: true });
  }
  if (semanticSignature.kind === 'text'
    && typeof semanticSignature.name === 'string'
    && typeof page.getByText === 'function') {
    return page.getByText(semanticSignature.name, { exact: true });
  }
  return null;
}

async function locatorHandle(locator) {
  if (!locator || typeof locator.elementHandle !== 'function') return null;
  return locator.elementHandle({ timeout: 1000 });
}

async function physicalSameNode(handle, candidate) {
  if (!candidate) return false;
  try {
    return await handle.evaluate((node, other) => node === other, candidate);
  } catch {
    return false;
  }
}

async function exactRevalidation(page, handle, semanticSignature) {
  const countLocator = exactLocator(page, semanticSignature, { includeHidden: true });
  const actionLocator = exactLocator(page, semanticSignature);
  if (!countLocator || !actionLocator
    || typeof countLocator.count !== 'function'
    || typeof actionLocator.count !== 'function') {
    return { pageCount: 0, sameNode: false, locatorVisible: false, locatorEnabled: false };
  }
  const pageCount = await countLocator.count();
  const actionCount = await actionLocator.count();
  let countHandle = null;
  let actionHandle = null;
  try {
    countHandle = pageCount === 1 ? await locatorHandle(countLocator) : null;
    actionHandle = actionCount === 1 ? await locatorHandle(actionLocator) : null;
    const sameNode = pageCount === 1 && await physicalSameNode(handle, countHandle);
    const actionableSameNode = actionCount === 1
      && await physicalSameNode(handle, actionHandle);
    const locatorVisible = actionableSameNode
      && typeof actionLocator.isVisible === 'function'
      && await actionLocator.isVisible();
    const locatorEnabled = actionableSameNode
      && typeof actionLocator.isEnabled === 'function'
      && await actionLocator.isEnabled();
    return { pageCount, sameNode, locatorVisible, locatorEnabled };
  } finally {
    await releaseHandles([countHandle, actionHandle]);
  }
}

function samePageSet(before, after) {
  return before.length === after.length
    && before.every((candidate) => after.includes(candidate));
}

export function createPlaywrightPageDriver({
  page,
  profile = {},
  inFlight = () => 0,
  settleOptions = {},
} = {}) {
  if (!validPage(page)) throw new TypeError('page must be a Playwright Page');
  const context = page.context();
  if (!validContext(context)) throw new TypeError('page context must expose topology');
  let revisionSequence = 0;
  let latestRevision = null;

  const driver = {
    async settle() {
      return settleBeforeCapture(page, {
        profile,
        inFlight,
        ...settleOptions,
      });
    },

    async snapshotMainFrame() {
      const discovered = await discoverMainFrame(page);
      const affordances = [];
      try {
        for (const handle of discovered.handles) {
          affordances.push({ handle, ...await factsFor(handle) });
        }
        latestRevision = `pwrev_${++revisionSequence}`;
        return {
          revision: latestRevision,
          url: page.url(),
          title: await page.title(),
          unsupportedScopes: discovered.unsupportedScopes,
          sourceTruncated: discovered.sourceTruncated,
          affordances,
        };
      } catch (error) {
        await releaseHandles(discovered.handles);
        throw error;
      }
    },

    async revalidate({ handle, semanticSignature, revision } = {}) {
      if (!handle || typeof handle.evaluate !== 'function') {
        return { connected: false, sameNode: false, pageCount: 0, visible: false, enabled: false };
      }
      try {
        const current = await factsFor(handle);
        const currentSemantic = current.role && current.accessibleName
          ? { kind: 'role', role: current.role, name: current.accessibleName, exact: true }
          : current.label
            ? { kind: 'label', name: current.label, exact: true }
            : current.text
              ? { kind: 'text', name: current.text, exact: true }
              : null;
        const exact = await exactRevalidation(page, handle, semanticSignature);
        return {
          connected: await handle.evaluate((element) => element.isConnected === true),
          sameNode: revision === latestRevision
            && signatureKey(currentSemantic) === signatureKey(semanticSignature)
            && exact.sameNode,
          pageCount: exact.pageCount,
          visible: current.visible && exact.locatorVisible,
          enabled: current.enabled && exact.locatorEnabled,
        };
      } catch {
        return { connected: false, sameNode: false, pageCount: 0, visible: false, enabled: false };
      }
    },

    async perform({ handle, action } = {}) {
      if (action !== 'click' || !handle || typeof handle.click !== 'function') {
        throw new Error('unsupported zero-shot action');
      }
      let pageEvent = false;
      const onPage = () => {
        pageEvent = true;
      };
      context.on('page', onPage);
      try {
        const before = context.pages();
        if (!Array.isArray(before) || page.isClosed() || !before.includes(page)) {
          throw new Error('PAGE_TOPOLOGY_UNAVAILABLE');
        }
        await handle.click({ timeout: 3000 });
        const after = context.pages();
        if (pageEvent || page.isClosed() || !Array.isArray(after)
          || !after.includes(page) || !samePageSet(before, after)) {
          throw new Error('PAGE_TOPOLOGY_CHANGED');
        }
        return Object.freeze({ performed: true, action: 'click', revision: latestRevision });
      } finally {
        if (typeof context.off === 'function') context.off('page', onPage);
        else if (typeof context.removeListener === 'function') context.removeListener('page', onPage);
      }
    },
  };
  return Object.freeze(driver);
}
