// 录制 runtime 生命周期见证与一次性 fresh replay runtime authority。
// 纯核心：零 browser 依赖（只按鸭子类型调用传入对象的真实事件接口）、零 fs、零 network、零 LLM。
// 只有「录制 context close + 录制 browser disconnected 两个真实事件均已观察到」，且新 Browser/Context/Page
// 的对象身份与归属正确时才铸权。布尔自报、时间戳、随机 ID、clone/spread/JSON 往返一律无效。

const WITNESS_STATE = new WeakMap();
const RECORDING_PAIR_WITNESS = new WeakMap();
const FRESH_AUTHORITY_STATE = new WeakMap();
const USED_REPLAY_OBJECTS = new WeakSet();

const PUBLIC_RECEIPT = Object.freeze({
  schemaVersion: 1,
  lifecycle: 'recording-closed/replay-new',
  valuePersistence: 'memory-only',
});

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function isEmitter(value) {
  return !!value && typeof value === 'object' && typeof value.on === 'function';
}

export function createFreshReplayWitness(options = {}) {
  let recordingBrowser;
  let recordingContext;
  try {
    if (!options || typeof options !== 'object') {
      return denied('FRESH_RUNTIME_WITNESS_INVALID');
    }
    ({ recordingBrowser, recordingContext } = options);
  } catch {
    return denied('FRESH_RUNTIME_WITNESS_INVALID');
  }
  if (!isEmitter(recordingBrowser) || !isEmitter(recordingContext)) {
    return denied('FRESH_RUNTIME_WITNESS_INVALID');
  }
  // record 在人工等待前预装监听，cycle adapter 在关闭后取回同一枚见证。以 Context
  // 对象身份作键且复核 Browser 身份；已铸权的旧见证也原样返回，后续 authorize 会拒绝，
  // 不允许同一段关闭事实再铸第二枚 fresh authority。
  const existing = RECORDING_PAIR_WITNESS.get(recordingContext);
  if (existing?.recordingBrowser === recordingBrowser) {
    return frozen({ ok: true, witness: existing.witness });
  }
  const record = {
    recordingBrowser,
    recordingContext,
    contextClosed: false,
    browserDisconnected: false,
    // 一次关闭只见证一段后继 runtime：canonical 全周期三枚 fresh 各有自己的 witness
    // （录制关闭→source、source 关闭→authoring、authoring 关闭→distilled，
    //  见 runtime-seams-design §2 的 23 步与 GRILL D2），因此 1:1 是设计语义，
    //  一枚 witness 铸权成功后即作废，不许同一次关闭铸出第二段 runtime 的 fresh。
    authorized: false,
  };
  try {
    // 必须在录制 runtime 关闭前安装：关闭事实只能来自真实事件，不接受事后自报。
    recordingContext.on('close', () => {
      record.contextClosed = true;
    });
    recordingBrowser.on('disconnected', () => {
      // Browser 断连蕴含其 Context 已不可继续使用；Playwright 通常也会发 close，
      // 这里同时置位可抵抗事件顺序/遗漏，仍然只来自真实 disconnected 事件。
      record.contextClosed = true;
      record.browserDisconnected = true;
    });
  } catch {
    return denied('FRESH_RUNTIME_WITNESS_INVALID');
  }
  const witness = frozen(Object.create(null));
  WITNESS_STATE.set(witness, record);
  RECORDING_PAIR_WITNESS.set(recordingContext, { recordingBrowser, witness });
  return frozen({ ok: true, witness });
}

function readWitness(witness) {
  return witness && typeof witness === 'object'
    ? WITNESS_STATE.get(witness) || null
    : null;
}

function ownerOf(value, method) {
  try {
    return typeof value?.[method] === 'function' ? value[method]() : null;
  } catch {
    return null;
  }
}

function isLive(replayBrowser, replayPage) {
  try {
    if (typeof replayBrowser.isConnected === 'function'
      && replayBrowser.isConnected() !== true) return false;
    if (typeof replayPage.isClosed === 'function'
      && replayPage.isClosed() === true) return false;
    return true;
  } catch {
    return false;
  }
}

export function authorizeFreshReplayRuntime(options = {}) {
  let witness;
  let replayBrowser;
  let replayContext;
  let replayPage;
  let topologyAuthority;
  try {
    if (!options || typeof options !== 'object') {
      return denied('FRESH_RUNTIME_WITNESS_INVALID');
    }
    ({
      witness,
      replayBrowser,
      replayContext,
      replayPage,
      topologyAuthority,
    } = options);
  } catch {
    return denied('FRESH_RUNTIME_WITNESS_INVALID');
  }
  const record = readWitness(witness);
  if (!record) return denied('FRESH_RUNTIME_WITNESS_INVALID');
  // 已铸过权的 witness 与伪造 witness 同罪：稳定拒绝，且不泄露它曾经 genuine。
  if (record.authorized) return denied('FRESH_RUNTIME_WITNESS_INVALID');
  if (!record.contextClosed || !record.browserDisconnected) {
    return denied('RECORDING_RUNTIME_NOT_CLOSED');
  }
  if (!replayBrowser || typeof replayBrowser !== 'object'
    || !replayContext || typeof replayContext !== 'object'
    || !replayPage || typeof replayPage !== 'object'
    || !topologyAuthority || typeof topologyAuthority !== 'object') {
    return denied('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
  }
  if (replayBrowser === record.recordingBrowser
    || replayContext === record.recordingContext) {
    return denied('REPLAY_RUNTIME_NOT_FRESH');
  }
  // 同一 replay 三层对象只允许铸权一次：换一枚真实 witness 也不能复用同一 runtime。
  if (USED_REPLAY_OBJECTS.has(replayBrowser)
    || USED_REPLAY_OBJECTS.has(replayContext)
    || USED_REPLAY_OBJECTS.has(replayPage)) {
    return denied('REPLAY_RUNTIME_REUSED');
  }
  if (ownerOf(replayContext, 'browser') !== replayBrowser
    || ownerOf(replayPage, 'context') !== replayContext) {
    return denied('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
  }
  if (!isLive(replayBrowser, replayPage)) {
    return denied('REPLAY_RUNTIME_NOT_LIVE');
  }

  record.authorized = true;
  const freshRuntimeAuthority = frozen(Object.create(null));
  FRESH_AUTHORITY_STATE.set(freshRuntimeAuthority, {
    replayBrowser,
    replayContext,
    replayPage,
    topologyAuthority,
    consumed: false,
  });
  USED_REPLAY_OBJECTS.add(replayBrowser);
  USED_REPLAY_OBJECTS.add(replayContext);
  USED_REPLAY_OBJECTS.add(replayPage);
  return frozen({
    ok: true,
    freshRuntimeAuthority,
    receipt: PUBLIC_RECEIPT,
  });
}

// 一次性消费：错 topology 不消费也不放行；genuine 消费成功后重放恒拒（失败也不退还）。
export function consumeFreshReplayRuntimeAuthority(options = {}) {
  let freshRuntimeAuthority;
  let topologyAuthority;
  try {
    if (!options || typeof options !== 'object') {
      return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
    }
    ({ freshRuntimeAuthority, topologyAuthority } = options);
  } catch {
    return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
  }
  const record = freshRuntimeAuthority && typeof freshRuntimeAuthority === 'object'
    ? FRESH_AUTHORITY_STATE.get(freshRuntimeAuthority)
    : null;
  if (!record || record.consumed) return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
  if (record.topologyAuthority !== topologyAuthority) {
    return denied('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
  }
  if (!isLive(record.replayBrowser, record.replayPage)) {
    return denied('REPLAY_RUNTIME_NOT_LIVE');
  }
  record.consumed = true;
  return frozen({ ok: true });
}
