// Playwright-like context/page double：纯内存、零 browser/SUT/network。

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createPageDouble({
  name,
  url = 'https://same-origin.invalid/',
  opener = null,
  absentTokens = [],
} = {}) {
  const listeners = new Map();
  const storage = new Map();
  const calls = {
    initScripts: [],
    assertions: [],
    closed: 0,
  };
  let closed = false;

  const page = {
    name: String(name || 'page'),
    calls,
    storage,
    url() {
      return url;
    },
    async opener() {
      return opener;
    },
    on(event, handler) {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
    },
    async addInitScript(_script, payload) {
      calls.initScripts.push(payload);
      if (originOf(url) !== payload?.origin) return;
      for (const pair of payload?.entries || []) {
        if (Array.isArray(pair) && pair.length === 2) storage.set(String(pair[0]), String(pair[1]));
      }
    },
    isClosed() {
      return closed;
    },
    async close() {
      if (closed) return;
      closed = true;
      calls.closed += 1;
      for (const handler of listeners.get('close') || []) await handler();
    },
    async assertAbsent(token) {
      calls.assertions.push(token);
      return absentTokens.includes(token);
    },
  };
  return page;
}

export function createContextDouble({ initialPages = [] } = {}) {
  const listeners = new Map();
  const pages = [...initialPages];
  const calls = {
    contextOn: [],
    exposedBindings: [],
    contextInitScripts: [],
    emittedPages: [],
  };

  const context = {
    calls,
    pages() {
      return [...pages];
    },
    on(event, handler) {
      calls.contextOn.push(event);
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
    },
    async exposeBinding(name, handler) {
      calls.exposedBindings.push({ name, handler });
    },
    async addInitScript(script, payload) {
      calls.contextInitScripts.push({ script, payload });
    },
    async emitPage(page) {
      pages.push(page);
      calls.emittedPages.push(page.name);
      for (const handler of listeners.get('page') || []) handler(page);
      await Promise.resolve();
    },
  };
  return context;
}
