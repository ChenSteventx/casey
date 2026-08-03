// zero-shot page driver 的纯内存测试替身。
//
// 只提供调用方给定的惰性页面事实、opaque handle、revision 和调用计数：
// - 不启动 browser/server，不访问 SUT；
// - 不解释 TestCase，不实现 resolver/admission/progress；
// - perform 成功后自动切到下一 snapshot，供 single-step runner 取得 fresh after observation。

// 通用透传：如实转交调用方给的每个自有键（按 === true 归一），不做键过滤。
// 夹具不是归一化器——归一化由生产 page-observer 独占；白名单在这里只提供一次静默吞键的机会。
function copyUnsupported(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const copied = {};
  for (const key of Object.keys(source)) copied[key] = source[key] === true;
  return copied;
}

function copyAffordance(value, index, revision) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const handleId = typeof source.handleId === 'string' && source.handleId
    ? source.handleId
    : `handle_${index}`;
  const handle = Object.freeze(Object.create(null));
  return {
    ...structuredClone(source),
    handleId,
    handle,
    revision,
    role: typeof source.role === 'string' ? source.role : null,
    accessibleName: typeof source.accessibleName === 'string' ? source.accessibleName : null,
    label: typeof source.label === 'string' ? source.label : null,
    text: typeof source.text === 'string' ? source.text : null,
    visible: source.visible !== false,
    enabled: source.enabled !== false,
    actionSpace: Array.isArray(source.actionSpace) ? [...source.actionSpace] : ['click'],
  };
}

function normalizeSnapshot(value, index) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const revision = typeof source.revision === 'string' && source.revision
    ? source.revision
    : `revision_${index + 1}`;
  return {
    revision,
    url: typeof source.url === 'string' ? source.url : 'https://sut.invalid/',
    title: typeof source.title === 'string' ? source.title : '',
    settled: source.settled !== false,
    waitedMs: Number.isFinite(source.waitedMs) && source.waitedMs >= 0 ? source.waitedMs : 0,
    unsupportedScopes: copyUnsupported(source.unsupportedScopes),
    affordances: Array.isArray(source.affordances)
      ? source.affordances.map((item, itemIndex) => copyAffordance(item, itemIndex, revision))
      : [],
  };
}

function snapshotFromFlatOptions(options) {
  return {
    revision: options.revision,
    url: options.url,
    title: options.title,
    settled: options.settled,
    waitedMs: options.waitedMs,
    unsupportedScopes: options.unsupportedScopes,
    affordances: options.affordances,
  };
}

function publicDriverAffordance(record) {
  // 惰性额外事实原样交给生产投影，方便验收证明它们不会进入 public observation。
  const {
    handleId: _handleId,
    revision: _revision,
    pageCount: _pageCount,
    connected: _connected,
    sameNode: _sameNode,
    performError: _performError,
    ...facts
  } = record;
  return { ...structuredClone(facts), handle: record.handle };
}

export function createPageDriverDouble(options = {}) {
  const sourceSnapshots = Array.isArray(options.snapshots) && options.snapshots.length
    ? options.snapshots
    : [snapshotFromFlatOptions(options)];
  const snapshots = sourceSnapshots.map(normalizeSnapshot);
  const calls = {
    settle: 0,
    snapshot: 0,
    revalidate: 0,
    perform: 0,
  };
  const history = {
    settle: [],
    snapshot: [],
    revalidate: [],
    perform: [],
  };
  let cursor = 0;
  let revalidationOverride = options.revalidate && typeof options.revalidate === 'object'
    ? structuredClone(options.revalidate)
    : null;

  const current = () => snapshots[cursor];

  const control = {
    calls,
    history,

    advance() {
      if (cursor < snapshots.length - 1) cursor += 1;
      return current().revision;
    },

    replace(handleId) {
      const snap = current();
      const index = snap.affordances.findIndex((item) => item.handleId === handleId);
      if (index < 0) return false;
      const previous = snap.affordances[index];
      const replacementRevision = `${snap.revision}:replacement`;
      snap.revision = replacementRevision;
      snap.affordances[index] = copyAffordance({
        ...previous,
        handleId: `${handleId}:replacement`,
      }, index, replacementRevision);
      return true;
    },

    setRevalidation(patch) {
      revalidationOverride = patch && typeof patch === 'object'
        ? structuredClone(patch)
        : null;
    },

    setUrl(url) {
      current().url = String(url);
    },

    setSettled(settled, waitedMs = current().waitedMs) {
      current().settled = settled === true;
      current().waitedMs = Number.isFinite(waitedMs) && waitedMs >= 0 ? waitedMs : 0;
    },

    currentRevision() {
      return current().revision;
    },
  };

  const driver = {
    async settle() {
      calls.settle += 1;
      const fact = { settled: current().settled, waitedMs: current().waitedMs };
      history.settle.push(structuredClone(fact));
      return fact;
    },

    async snapshotMainFrame({ maxCandidates } = {}) {
      calls.snapshot += 1;
      history.snapshot.push({ maxCandidates: maxCandidates ?? null, revision: current().revision });
      return {
        revision: current().revision,
        url: current().url,
        title: current().title,
        unsupportedScopes: structuredClone(current().unsupportedScopes),
        affordances: current().affordances.map(publicDriverAffordance),
      };
    },

    async revalidate({ handle, semanticSignature, revision } = {}) {
      calls.revalidate += 1;
      history.revalidate.push({
        handle,
        semanticSignature: structuredClone(semanticSignature ?? null),
        revision: revision ?? null,
      });
      if (options.revalidateError) {
        throw options.revalidateError instanceof Error
          ? options.revalidateError
          : new Error(String(options.revalidateError));
      }
      const record = current().affordances.find((item) => item.handle === handle);
      const base = record
        ? {
            connected: record.connected !== false,
            sameNode: record.sameNode !== false && revision === current().revision,
            pageCount: Number.isInteger(record.pageCount) && record.pageCount >= 0
              ? record.pageCount
              : 1,
            visible: record.visible === true,
            enabled: record.enabled === true,
          }
        : {
            connected: false,
            sameNode: false,
            pageCount: 0,
            visible: false,
            enabled: false,
          };
      return revalidationOverride ? { ...base, ...structuredClone(revalidationOverride) } : base;
    },

    async perform({ handle, action } = {}) {
      calls.perform += 1;
      history.perform.push({ handle, action: action ?? null, revision: current().revision });
      const record = current().affordances.find((item) => item.handle === handle);
      const configuredError = record?.performError ?? options.performError;
      if (configuredError) {
        throw configuredError instanceof Error ? configuredError : new Error(String(configuredError));
      }
      if (!record || record.visible !== true || record.enabled !== true
        || !record.actionSpace.includes(action)) {
        throw new Error('adapter-double: 当前 handle/action 不可执行');
      }
      const fact = {
        performed: true,
        action,
        revision: current().revision,
        handleId: record.handleId,
      };
      if (typeof options.afterPerform === 'function') {
        await options.afterPerform({ fact: structuredClone(fact), control });
      }
      control.advance();
      return fact;
    },
  };

  return { driver, control };
}
