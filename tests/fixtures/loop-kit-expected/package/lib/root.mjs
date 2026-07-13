#!/usr/bin/env node
// lib/root.mjs — loop-kit 包内 ROOT 解析与原子认领单点（提取后包内唯一新增逻辑面，GRILL D4）。
//
// 语义（评审 M2/M3/R2-H3 + round-1/round-2 实现审收严后版本）：
//   1. LOOP_KIT_ROOT（显式参数 envRoot，缺省读同名环境变量）在场则必须有效——目录存在 + 含
//      loop/config.json 根标记 + realpath 规范化；无效立即失败，绝不静默回退到 cwd 上溯。
//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）——复用前重新校验该
//      值仍存在且仍带根标记（round-2 实现审 A1 采信：不可对 globalThis 槽内容照单全收，见下）；否则自
//      cwd（缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
//   3. 两路皆空/皆无效 → 抛结构化 RootResolutionError；本函数绝不 process.exit 终止宿主进程——
//      受支持入口（Casey 侧 shim/boot）总先注入有效 ROOT，本函数在受支持路径不会失败。
//   4. 解析成功即原子认领进程唯一 ROOT：首次认领后不可变、同根幂等；异根立即抛、绝不静默采用
//      他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前以显式 envRoot 参数调用本函数完成
//      认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一值，不依赖 cwd 恰好匹配。
//   5. claimedRoot() 是认领值的只读探针；未认领返回 null。
//   6. 仅支持 Node 主线程；worker_threads 的独立 Worker 各有独立 globalThis，本机制无法跨 Worker
//      协调认领（round-2 实现审 A1 采信：见下）——非主线程调用直接拒绝，不产生「各自静默认领互不冲突」
//      的假象。
//
//   认领槽存储位置（round-1 实现审 A1 采信后修订）：认领值存在 globalThis[Symbol.for(...)] ——
//   进程级共享位置，而非本模块的顶层 let 变量。原因：包可能以多个不同的物理目录被加载（如两棵
//   消费树各自的兄弟目录约定解析到不同包副本、或显式 LOOP_KIT_PKG 指向另一份包拷贝）——不同物理
//   路径对 ESM 而言是不同的 file:// URL，会各自得到独立的模块实例；若认领槽是模块顶层变量，则
//   「进程唯一 ROOT」只在两次加载解析到同一物理包目录（同一模块实例）时成立，两树解析到不同包
//   目录时防线静默不在场（同进程可各自认领不同 ROOT，零冲突）——这与本节语义 4 的「进程唯一」直接
//   矛盾。Symbol.for() 使用全局符号注册表，同一键名在同进程内任何模块实例中都解析到同一 Symbol，
//   故 globalThis[Symbol.for(...)] 是真正意义上的进程级单例存储，与「加载自哪个物理文件」无关。
//
//   round-2 实现审两处加固（codex HIGH 采信）：
//   ① worker_threads 边界：globalThis 按 JS 执行环境（Node 主线程 / 每个 Worker）独立，不是操作系统
//      进程级共享——同进程内的两个 Worker 各有独立 globalThis，会各自静默认领不同 ROOT、互不冲突，
//      与语义 4 矛盾。本仓与消费侧 casey 代码库均未使用 worker_threads（已用 grep 核验零命中）；
//      为避免「看似成立、实则在 Worker 场景下静默违反不变量」，resolveRoot() 在非主线程直接拒绝，把
//      未支持的执行环境变成显式失败而非静默错误——若未来确需 Worker 内消费本包，须先设计跨 Worker
//      协调机制（如经 SharedArrayBuffer/Atomics 或专用 broker）并重新评估本假设，不能绕过此拒绝。
//   ② 槽内容不可信问题：globalThis[Symbol.for(...)] 一旦公开，同进程内任何代码都能读写（不像模块
//      顶层变量那样只能经本模块导出的函数触达）——若外部代码在本模块首次认领前预置一个不存在/无根
//      标记的值，旧版会不经校验直接复用。现改为：a) 首次认领后用 Object.defineProperty 冻结该属性
//      （writable:false/configurable:false），本模块自身的合法流程只会在「尚未认领」时写一次，此后
//      同进程任何代码（含本模块自身）再尝试赋值都会在严格模式下抛 TypeError，不会静默覆盖；
//      b) 幂等复用路径（语义 2）每次复用前都重新对槽内容跑一遍与首次认领相同的校验（存在性 + 根标记 +
//      realpath），槽内容不存在/无标记/被非常规篡改会在复用时立即抛错，不会被当成「已验证过」而照单
//      全收。两者合力：认领后无法被同进程其它代码静默替换，认领前的伪造值也过不了复用校验。
//
//   round-2 第二轮实现审加固（codex HIGH 采信）：上述 ②a 的冻结只挂在「从空槽写入」这一条代码路径
//   （claimAtomic 的 current===null 分支）上——若外部先用普通赋值预置一个「合法、规范化」的 ROOT
//   （存在 + 有根标记 + 已是 realpath 形态），复用路径/同值路径会校验通过并接受它，但从未走到
//   writeClaimed()，属性仍可写，外部随后可再悄悄改写成另一个同样合法的 ROOT——两次合法值之间的静默
//   切换，独立探针实测复现（同一主线程进程先后接受两个不同的真实合法目录）。修复：不再只在「从空槽
//   写入」时冻结，而是在任何代码路径打算把某个槽值当「已认领」使用（幂等复用 revalidateClaimed()、
//   同值复用 claimAtomic()）之前，先查属性描述符是否已不可写/不可配置（isClaimSlotFrozen()），
//   不是则当场补冻结（adoptAndFreezeIfNeeded()）——把「首次被信任使用的时刻」当作认领时刻，不局限于
//   「首次从空槽写入」这一种途径，堵死「两个合法值之间来回切换」的窗口。
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isMainThread } from 'node:worker_threads';

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

// 首次认领后冻结该 globalThis 属性——同进程内（含本模块自身）此后任何再赋值尝试都会在 ESM 的严格
// 模式下抛 TypeError，不会静默覆盖已认领的值（round-2 实现审 A1 采信）。正常流程下 claimAtomic() 只在
// current===null 时调用本函数一次，故这里的冻结不会与自身的合法调用冲突。
function writeClaimed(v) {
  try {
    Object.defineProperty(globalThis, CLAIM_KEY, {
      value: v, writable: false, configurable: false, enumerable: false,
    });
  } catch (e) {
    throw new RootResolutionError(`进程级认领槽写入失败（可能已被外部代码以不兼容方式预置）：${e.message}`);
  }
}

// 槽当前是否已是不可写/不可配置的冻结形态（round-2 第二轮实现审 codex HIGH 采信）。缺口：外部若在
// 本模块首次认领前，用普通赋值预置一个「合法、规范化」的 ROOT（存在 + 有根标记 + 已是 realpath），
// revalidateClaimed()/claimAtomic() 的「同值直接复用」分支会校验通过并接受它——但从未经过
// writeClaimed()，属性仍是 writable:true/configurable:true，外部随后可再次悄悄改写成另一个同样合法
// 的 ROOT，下次复用又校验通过、静默换根，「首次认领后不可变」名存实亡（codex 独立探针实测复现：同一
// 主线程进程先后接受两个不同合法 ROOT）。修复：任何代码路径只要打算把某个槽值当「已认领」使用，先检查
// 该属性是否已不可写/不可配置；不是则就地补冻结（把「首次真正被信任使用的时刻」当认领时刻，而不是只认
// 「经由 claimAtomic 从空槽写入」这一条路径），此后同样不可被普通赋值覆盖。
// 命名说明（round-2 第三轮实现审 codex LOW 采信）：本函数只能证明「属性当前已不可写/不可配置」，不能
// 证明该冻结确由本模块的 writeClaimed() 产生——外部代码理论上可以构造出描述符完全相同（仅
// enumerable 等无关字段可能不同）的「假冻结」。但这不构成漏洞：任何 writable:false+configurable:false
// 的描述符，不论来源，都同样拒绝后续改写，「两个合法值间来回切换」的窗口一样被堵死；本函数命名与注释
// 因此不再声称「本模块自身产生」，只如实描述「当前是否已冻结」这一可观察状态。
function isClaimSlotFrozen() {
  const desc = Object.getOwnPropertyDescriptor(globalThis, CLAIM_KEY);
  return !!desc && desc.writable === false && desc.configurable === false;
}

function adoptAndFreezeIfNeeded(value) {
  if (!isClaimSlotFrozen()) writeClaimed(value);
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

// 幂等复用前重新校验槽内容（round-2 实现审 A1 采信）：不对 globalThis 槽内容照单全收——若其已不存在/
// 无根标记（环境劣化，或槽在本模块首次认领前已被外部预置成无效值），在复用点立即抛错，绝不静默返回
// 一个未经校验的值。合法场景下 revalidated 应恒等于 value（value 本就是 validate() 的输出、已是
// realpath 规范化后的绝对路径）；两者不等则视为槽内容异常（记为「篡改」而非静默接受）。
function revalidateClaimed(value) {
  const revalidated = validate(value, '进程级认领槽（幂等复用前复核）');
  if (revalidated !== value) {
    throw new RootResolutionError(`进程级认领槽内容异常（重新校验后规范化结果与槽内值不一致，疑似被篡改）：槽值「${value}」`);
  }
  adoptAndFreezeIfNeeded(revalidated); // 本次校验通过即视为「被信任使用」，就地补冻结（见上）
  return revalidated;
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
  // 同值分支（round-2 第二轮实现审 codex HIGH 采信）：current 可能来自外部普通赋值预置（同一显式
  // envRoot 恰好与之相等），此时槽未必已冻结——就地补冻结，防止后续被改写成另一个「同样合法」的 ROOT。
  adoptAndFreezeIfNeeded(current);
  return current;
}

// 单点解析 + 原子认领。envRoot 缺省读 process.env.LOOP_KIT_ROOT；cwd 缺省读 process.cwd()。
// 显式传参（boot 库模式用法）与缺省裸调用（CLI 转发子进程 / 受支持路径外的直接调用）共用同一函数、同一原子性。
export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process.cwd() } = {}) {
  if (!isMainThread) {
    // round-2 实现审 A1 采信：worker_threads 的每个 Worker 有独立 globalThis，本机制无法跨 Worker
    // 协调认领——与其让各 Worker 各自静默认领互不冲突（违反「进程唯一 ROOT」），不如在非主线程直接
    // 拒绝，把未支持的执行环境变成显式失败。
    throw new RootResolutionError('resolveRoot() 仅支持 Node 主线程；worker_threads 的 Worker 各有独立 globalThis，本机制无法跨 Worker 协调 ROOT 认领');
  }
  if (envRoot !== undefined && envRoot !== '') {
    return claimAtomic(validate(envRoot, 'LOOP_KIT_ROOT'));
  }
  const already = readClaimed();
  if (already !== null) return revalidateClaimed(already); // 已认领：幂等直接复用，但复用前重新校验（见上）
  const found = upwardSearch(cwd);
  if (!found) {
    throw new RootResolutionError(`未设 LOOP_KIT_ROOT，且从 ${resolve(String(cwd))} 上溯未找到根标记 loop/config.json`);
  }
  return claimAtomic(found);
}

// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。不重新校验——纯读，供诊断/测试观察当前认领
// 状态，语义与 resolveRoot() 的复用路径（会重新校验）刻意区分。
export function claimedRoot() {
  return readClaimed();
}
