#!/usr/bin/env node
// lib/root.mjs — loop-kit 包内 ROOT 解析与原子认领单点（提取后包内唯一新增逻辑面，GRILL D4）。
//
// 语义（评审 M2/M3/R2-H3 + round-1 实现审 A1 收严后版本）：
//   1. LOOP_KIT_ROOT（显式参数 envRoot，缺省读同名环境变量）在场则必须有效——目录存在 + 含
//      loop/config.json 根标记 + realpath 规范化；无效立即失败，绝不静默回退到 cwd 上溯。
//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）；否则自 cwd
//      （缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
//   3. 两路皆空/皆无效 → 抛结构化 RootResolutionError；本函数绝不 process.exit 终止宿主进程——
//      受支持入口（Casey 侧 shim/boot）总先注入有效 ROOT，本函数在受支持路径不会失败。
//   4. 解析成功即原子认领进程唯一 ROOT：首次认领后不可变、同根幂等；异根立即抛、绝不静默采用
//      他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前以显式 envRoot 参数调用本函数完成
//      认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一值，不依赖 cwd 恰好匹配。
//   5. claimedRoot() 是认领值的只读探针；未认领返回 null。
//
//   认领槽存储位置（round-1 实现审 A1 采信后修订）：认领值存在 globalThis[Symbol.for(...)] ——
//   进程级共享位置，而非本模块的顶层 let 变量。原因：包可能以多个不同的物理目录被加载（如两棵
//   消费树各自的兄弟目录约定解析到不同包副本、或显式 LOOP_KIT_PKG 指向另一份包拷贝）——不同物理
//   路径对 ESM 而言是不同的 file:// URL，会各自得到独立的模块实例；若认领槽是模块顶层变量，则
//   「进程唯一 ROOT」只在两次加载解析到同一物理包目录（同一模块实例）时成立，两树解析到不同包
//   目录时防线静默不在场（同进程可各自认领不同 ROOT，零冲突）——这与本节语义 4 的「进程唯一」直接
//   矛盾。Symbol.for() 使用全局符号注册表，同一键名在同进程内任何模块实例中都解析到同一 Symbol，
//   故 globalThis[Symbol.for(...)] 是真正意义上的进程级单例存储，与「加载自哪个物理文件」无关。
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export class RootResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RootResolutionError';
  }
}

// 进程级共享认领槽——键名含包名与用途，降低与其它代码的 Symbol.for 键碰撞概率。
const CLAIM_KEY = Symbol.for('loop-kit:root:claimed');

function readClaimed() {
  const v = globalThis[CLAIM_KEY];
  return v === undefined ? null : v;
}

function writeClaimed(v) {
  globalThis[CLAIM_KEY] = v;
}

function hasRootMarker(dir) {
  return existsSync(join(dir, 'loop', 'config.json'));
}

function validate(dir, sourceLabel) {
  const abs = resolve(String(dir));
  if (!existsSync(abs)) {
    throw new RootResolutionError(`${sourceLabel} 指向的目录不存在：${abs}`);
  }
  if (!hasRootMarker(abs)) {
    throw new RootResolutionError(`${sourceLabel} 指向的目录缺根标记 loop/config.json：${abs}`);
  }
  try {
    return realpathSync.native(abs);
  } catch (e) {
    throw new RootResolutionError(`${sourceLabel} 指向的目录 realpath 失败：${abs}（${e.message}）`);
  }
}

function upwardSearch(startCwd) {
  let cur = resolve(String(startCwd));
  for (;;) {
    if (hasRootMarker(cur)) {
      try {
        return realpathSync.native(cur);
      } catch (e) {
        throw new RootResolutionError(`上溯命中的根标记目录 realpath 失败：${cur}（${e.message}）`);
      }
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function claimAtomic(candidate) {
  const current = readClaimed();
  if (current === null) {
    writeClaimed(candidate);
    return candidate;
  }
  if (current !== candidate) {
    throw new RootResolutionError(
      `ROOT 认领冲突：进程已认领「${current}」，此次解析得「${candidate}」——同进程跨树不支持，绝不静默采用其一`
    );
  }
  return current;
}

// 单点解析 + 原子认领。envRoot 缺省读 process.env.LOOP_KIT_ROOT；cwd 缺省读 process.cwd()。
// 显式传参（boot 库模式用法）与缺省裸调用（CLI 转发子进程 / 受支持路径外的直接调用）共用同一函数、同一原子性。
export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process.cwd() } = {}) {
  if (envRoot !== undefined && envRoot !== '') {
    return claimAtomic(validate(envRoot, 'LOOP_KIT_ROOT'));
  }
  const already = readClaimed();
  if (already !== null) return already; // 已认领：幂等直接复用，不重复上溯（同进程库模式的核心防线）
  const found = upwardSearch(cwd);
  if (!found) {
    throw new RootResolutionError(`未设 LOOP_KIT_ROOT，且从 ${resolve(String(cwd))} 上溯未找到根标记 loop/config.json`);
  }
  return claimAtomic(found);
}

// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。
export function claimedRoot() {
  return readClaimed();
}
