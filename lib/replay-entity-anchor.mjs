// 破坏性 cleanup 的实体锚一致性闸（纯函数，必须在 replay 启动浏览器前调用）。
//
// workflow.deleteByName 的动作域锁只能证明「删除/确认点在目标实体域内」，不能独自证明删除副作用
// 已经落地。若硬断言 countChange equals 0 使用无关/陈旧 selector（典型：本轮 atl_r2，profile
// 仍锚 atl_r1），before/after 都可能是 0，继而把未删除洗成假 PASS。因此凡 cleanup intent 含
// 该硬断言，profile.countSelector 必须经本轮 ctx 实例化后精确包含同一 atl_ 目标锚。
//
// 冻结件保持只读：本模块只返回本轮派生 selector/断言副本，不改 events/expected/profile。
import { instantiate } from './instantiate.mjs';

const ATL_ANCHOR_RE = /atl_[A-Za-z0-9_-]+/g;
const UNRESOLVED_PLACEHOLDER_RE = /\{\{[A-Za-z0-9_.-]+\}\}/;

function deleteLabel(ev) {
  return ev?.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev?.text;
}

function anchorsIn(value) {
  return typeof value === 'string' ? [...new Set(value.match(ATL_ANCHOR_RE) || [])] : [];
}

function projectString(value, ctx) {
  return typeof value === 'string' ? instantiate(value, ctx) : value;
}

export function projectReplayAssertion(assertion, ctx) {
  if (!assertion || typeof assertion !== 'object') return assertion;
  return typeof assertion.value === 'string'
    ? { ...assertion, value: projectString(assertion.value, ctx) }
    : { ...assertion };
}

export function validateReplayEntityAnchors({ events, expectedDoc, profile, ctx }) {
  const problems = [];
  const list = Array.isArray(events) ? events : [];
  const expectedIntents = new Map((expectedDoc?.intents || []).map((intent) => [intent.intentId, intent]));
  const deleteIntents = new Map();
  for (const ev of list) {
    if (ev?.atom !== 'workflow.deleteByName' || typeof ev.intentId !== 'string') continue;
    const grouped = deleteIntents.get(ev.intentId) || [];
    grouped.push(ev);
    deleteIntents.set(ev.intentId, grouped);
  }

  const rawCountSelector = profile?.countSelector;
  const projectedCountSelector = typeof rawCountSelector === 'string'
    ? projectString(rawCountSelector.trim(), ctx)
    : null;

  for (const [intentId, intentEvents] of deleteIntents) {
    const assertions = expectedIntents.get(intentId)?.expected || [];
    const requiresZeroProof = assertions.some((assertion) => assertion?.soft !== true
      && assertion?.kind === 'countChange'
      && assertion?.op === 'equals'
      && Number(assertion?.value) === 0);
    if (!requiresZeroProof) continue;

    const clickTargets = intentEvents
      .filter((ev) => ev.action === 'click' && ['删除', '确定', '确认'].includes(deleteLabel(ev)))
      .map((ev) => projectString(ev.value, ctx))
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim());
    const uniqueTargets = [...new Set(clickTargets)];
    if (uniqueTargets.length !== 1 || !uniqueTargets[0].startsWith('atl_')) {
      problems.push({ intentId, reason: 'cleanup_delete_target_not_unique' });
      continue;
    }
    const target = uniqueTargets[0];

    // 同一 cleanup 须在删除前、删除后都用同目标重搜。否则即使 selector 正确，after 也不一定对应
    // 删除副作用完成后的目标查询结果。
    const searchTargets = intentEvents
      .filter((ev) => ev.action === 'fill')
      .map((ev) => projectString(ev.value, ctx))
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim());
    if (searchTargets.length < 2 || searchTargets.some((value) => value !== target)) {
      problems.push({ intentId, reason: 'cleanup_search_target_not_repeated' });
    }

    if (typeof rawCountSelector !== 'string' || !rawCountSelector.trim()) {
      problems.push({ intentId, reason: 'cleanup_count_selector_missing' });
    } else if (UNRESOLVED_PLACEHOLDER_RE.test(projectedCountSelector)) {
      problems.push({ intentId, reason: 'cleanup_count_selector_unresolved' });
    } else {
      const selectorAnchors = anchorsIn(projectedCountSelector);
      if (selectorAnchors.length !== 1 || selectorAnchors[0] !== target) {
        problems.push({ intentId, reason: 'cleanup_count_selector_target_mismatch' });
      }
    }

    // cleanup intent 内若另有实体字符串断言，它也必须投影到同一目标；不扫描全局/其它 intent，
    // 避免把一个用例中合法的第二实体误判为 cleanup 锚漂移。
    for (const assertion of assertions) {
      if (typeof assertion?.value !== 'string') continue;
      const projected = projectString(assertion.value, ctx);
      const entityAnchors = anchorsIn(projected);
      if (UNRESOLVED_PLACEHOLDER_RE.test(projected) && assertion.value.includes('atl_')) {
        problems.push({ intentId, reason: 'cleanup_expected_anchor_unresolved' });
      } else if (entityAnchors.some((anchor) => anchor !== target)) {
        problems.push({ intentId, reason: 'cleanup_expected_anchor_target_mismatch' });
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    countSelector: projectedCountSelector,
  };
}
