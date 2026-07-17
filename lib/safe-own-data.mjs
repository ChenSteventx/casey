// 公开纯函数入口的零执行数据快照。
// Proxy 在任何反射前用 node:util/types.isProxy 拒绝；accessor 只读 descriptor，不执行 getter/setter。
import { isProxy } from 'node:util/types';

function fail(code = 'UNSAFE_DATA_SHAPE') {
  throw new TypeError(code);
}

export function isPlainOwnDataObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function snapshotPlainOwnData(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail();
    return value;
  }
  if ((typeof value === 'object' || typeof value === 'function') && isProxy(value)) fail();
  if (typeof value !== 'object') fail();

  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (seen.has(value)) fail();
  seen.add(value);
  try {
    const proto = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (proto !== Array.prototype) fail();
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value')
        || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) fail();
      const length = lengthDescriptor.value;
      const allowed = new Set(['length', ...Array.from({ length }, (_unused, index) => String(index))]);
      if (keys.length !== length + 1 || keys.some((key) => typeof key !== 'string' || !allowed.has(key))) fail();
      const out = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail();
        out.push(snapshotPlainOwnData(descriptor.value, seen));
      }
      return out;
    }
    if (proto !== Object.prototype && proto !== null) fail();
    const out = {};
    for (const key of keys) {
      if (typeof key !== 'string') fail();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail();
      out[key] = snapshotPlainOwnData(descriptor.value, seen);
    }
    return out;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'UNSAFE_DATA_SHAPE') throw error;
    fail();
  } finally {
    seen.delete(value);
  }
}

export function snapshotClosedOptions(value, allowedKeys, { opaqueKeys = new Set() } = {}) {
  const input = value == null ? {} : value;
  if ((typeof input === 'object' || typeof input === 'function') && isProxy(input)) fail();
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail();
  const keys = Reflect.ownKeys(input);
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
      out[key] = snapshotPlainOwnData(descriptor.value);
    }
  }
  return out;
}
