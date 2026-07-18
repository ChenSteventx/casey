// zero-SUT golden 专用：瞬时文件系统竞争吸收器（transient FS race absorber）。
// 9p/DrvFs（WSL /mnt/d）上固定 canonical 路径的 create→delete→recreate churn，会偶发
// Windows sharing-violation（STATUS_ACCESS_DENIED → EACCES/EPERM/EBUSY/ENOTEMPTY）：
// 外部句柄（Defender/indexer/9p-server）瞬时占用刚 churn 的目录，与 renameSync 撞。
// 有界重试吸收「瞬时」竞争；真实拒绝（耗尽重试）仍抛、非瞬时 errno 立即抛——绝不掩盖真错。
// 同步 sleep 用 Atomics.wait（zero-SUT 金牌无 async），不忙等 CPU。

const TRANSIENT_CODES = new Set(['EACCES', 'EPERM', 'EBUSY', 'ENOTEMPTY']);

export function retryOnTransientFsRace(fn, { tries = 10, delayMs = 80 } = {}) {
  if (typeof fn !== 'function') throw new TypeError('retryOnTransientFsRace: fn 必须是函数');
  if (!Number.isInteger(tries) || tries < 1) throw new RangeError('retryOnTransientFsRace: tries 须为正整数');
  if (!Number.isInteger(delayMs) || delayMs < 0) throw new RangeError('retryOnTransientFsRace: delayMs 须为非负整数');
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  let lastError;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return fn();
    } catch (error) {
      if (!TRANSIENT_CODES.has(error?.code)) throw error; // 非瞬时立即抛，不重试、不掩盖真错
      lastError = error;
      if (attempt < tries - 1 && delayMs > 0) Atomics.wait(waiter, 0, 0, delayMs); // 同步退避
    }
  }
  throw lastError; // 耗尽重试 = 真实拒绝，忠实抛出
}
