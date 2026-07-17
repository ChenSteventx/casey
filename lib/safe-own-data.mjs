// 公开纯函数入口的有界零执行数据快照。
// Proxy 在任何反射前拒绝；accessor 只读 descriptor，不执行 getter/setter。
import { isProxy } from 'node:util/types';

export const SAFE_OWN_DATA_LIMITS = Object.freeze({
  MAX_ITEMS: 1024,
  MAX_DEPTH: 32,
  MAX_KEYS: 256,
  MAX_BYTES: 1048576,
});

function fail(code = 'UNSAFE_DATA_SHAPE') {
  throw new TypeError(code);
}

export function isPlainOwnDataObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function snapshot(value, state, depth) {
  if (depth > SAFE_OWN_DATA_LIMITS.MAX_DEPTH) fail();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    state.bytes += Buffer.byteLength(value, 'utf8');
    if (state.bytes > SAFE_OWN_DATA_LIMITS.MAX_BYTES) fail();
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail();
    return value;
  }
  if ((typeof value === 'object' || typeof value === 'function') && isProxy(value)) fail();
  if (typeof value !== 'object') fail();

  if (Buffer.isBuffer(value)) {
    state.bytes += value.byteLength;
    if (state.bytes > SAFE_OWN_DATA_LIMITS.MAX_BYTES) fail();
    return Buffer.from(value);
  }
  if (value instanceof Uint8Array) {
    state.bytes += value.byteLength;
    if (state.bytes > SAFE_OWN_DATA_LIMITS.MAX_BYTES) fail();
    return new Uint8Array(value);
  }
  if (state.seen.has(value)) fail();
  state.seen.add(value);
  try {
    const proto = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (proto !== Array.prototype) fail();
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value')
        || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) fail();
      const length = lengthDescriptor.value;
      // 上限先于逐 index 反射；巨大稀疏 length 不分配同规模 Set/Array。
      if (length > SAFE_OWN_DATA_LIMITS.MAX_ITEMS || keys.length !== length + 1) fail();
      state.items += length;
      if (state.items > SAFE_OWN_DATA_LIMITS.MAX_ITEMS) fail();
      const out = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail();
        out.push(snapshot(descriptor.value, state, depth + 1));
      }
      return out;
    }
    if ((proto !== Object.prototype && proto !== null) || keys.length > SAFE_OWN_DATA_LIMITS.MAX_KEYS) fail();
    state.items += keys.length;
    if (state.items > SAFE_OWN_DATA_LIMITS.MAX_ITEMS) fail();
    const out = {};
    for (const key of keys) {
      if (typeof key !== 'string') fail();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail();
      state.bytes += Buffer.byteLength(key, 'utf8');
      if (state.bytes > SAFE_OWN_DATA_LIMITS.MAX_BYTES) fail();
      out[key] = snapshot(descriptor.value, state, depth + 1);
    }
    return out;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'UNSAFE_DATA_SHAPE') throw error;
    fail();
  } finally {
    state.seen.delete(value);
  }
}

export function snapshotPlainOwnData(value) {
  // items 是整次 traversal 的展开预算；共享 DAG 被多次展开也累计，不能靠 per-container 上限放大 CPU/内存。
  return snapshot(value, { seen: new Set(), bytes: 0, items: 0 }, 0);
}

export function snapshotClosedOptions(value, allowedKeys, { opaqueKeys = new Set() } = {}) {
  const input = value == null ? {} : value;
  if ((typeof input === 'object' || typeof input === 'function') && isProxy(input)) fail();
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail();
  const keys = Reflect.ownKeys(input);
  if (keys.length > SAFE_OWN_DATA_LIMITS.MAX_KEYS) fail();
  const state = { seen: new Set(), bytes: 0, items: keys.length };
  if (state.items > SAFE_OWN_DATA_LIMITS.MAX_ITEMS) fail();
  const out = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !allowedKeys.has(key)) throw new TypeError('UNKNOWN_FIELD');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail();
    if (opaqueKeys.has(key)) {
      const opaque = descriptor.value;
      if ((typeof opaque === 'object' || typeof opaque === 'function') && opaque !== null && isProxy(opaque)) fail();
      out[key] = opaque;
    } else {
      state.bytes += Buffer.byteLength(key, 'utf8');
      if (state.bytes > SAFE_OWN_DATA_LIMITS.MAX_BYTES) fail();
      out[key] = snapshot(descriptor.value, state, 0);
    }
  }
  return out;
}
