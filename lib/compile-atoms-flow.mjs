// Atom dispatch and flow-level fail-closed orchestration.
import { projectCompileEntityProvenance } from './entity-semantic-lock-preflight.mjs';
import { ENTITY_KIND_COMPILE_CHANNELS, ENTITY_OBSERVATION_REGISTRY } from './entity-observation-registry.mjs';
import { compileNavAgentManagement, compileNavWorkflowManagement, compileWorkflowAddNode, compileWorkflowConnectNodes, compileWorkflowOpen } from './compile-atoms-workflow-nav.mjs';
import { compileWorkflowBindAgent, compileWorkflowOpenNode, compileWorkflowSelectNodeDropdown, compileWorkflowSetNodeField } from './compile-atoms-workflow-drawer.mjs';
import { compileAgentConfirmToolPicker, compileAgentCreate, compileAgentDelete, compileAgentOpenTestPanel, compileAgentOpenToolPicker, compileAgentSearchOpen, compileChatCloseTestPanel, compileChatSendAndWait, compilePickerExpandPrimary, compilePickerSearch, compilePickerSelectFirstTool } from './compile-atoms-agent.mjs';
import { compileWorkflowClickEditorButton, compileWorkflowCloseDrawer, compileWorkflowCreate, compileWorkflowDelete, compileWorkflowPublish, compileWorkflowSave } from './compile-atoms-workflow-crud.mjs';

const COMPILE_ATOM_COMPILERS = Object.assign(Object.create(null), {
  'workflow.create': compileWorkflowCreate,
  'workflow.save': compileWorkflowSave,
  'workflow.publish': compileWorkflowPublish,
  'workflow.clickEditorButton': compileWorkflowClickEditorButton,
  'workflow.closeDrawer': compileWorkflowCloseDrawer,
  'workflow.deleteByName': compileWorkflowDelete,
  'workflow.open': compileWorkflowOpen,
  'workflow.addNode': compileWorkflowAddNode,
  'workflow.connectNodes': compileWorkflowConnectNodes,
  'workflow.openNode': compileWorkflowOpenNode,
  'workflow.selectNodeDropdown': compileWorkflowSelectNodeDropdown,
  'workflow.setNodeField': compileWorkflowSetNodeField,
  'workflow.bindAgent': compileWorkflowBindAgent,
  'nav.agentManagement': compileNavAgentManagement,
  'nav.workflowManagement': compileNavWorkflowManagement,
  'agent.searchOpen': compileAgentSearchOpen,
  'agent.openTestPanel': compileAgentOpenTestPanel,
  'agent.create': compileAgentCreate,
  'agent.openToolPicker': compileAgentOpenToolPicker,
  'picker.search': compilePickerSearch,
  'picker.expandPrimary': compilePickerExpandPrimary,
  'picker.selectFirstTool': compilePickerSelectFirstTool,
  'agent.confirmToolPicker': compileAgentConfirmToolPicker,
  'agent.delete': compileAgentDelete,
  'chat.sendAndWait': compileChatSendAndWait,
  'chat.closeTestPanel': compileChatCloseTestPanel,
});
const NAMED_ASSERTION_ATOMS = new Set(['workflow.assertNodeFieldValue']);
export const COMPILE_KNOWN_ATOMS = new Set(Object.keys(COMPILE_ATOM_COMPILERS));
export function isCompilableAtom(atom) {
  return atom === 'login'
    || (typeof atom === 'string' && atom.startsWith('assert.'))
    || NAMED_ASSERTION_ATOMS.has(atom)
    || (typeof atom === 'string' && Object.hasOwn(COMPILE_ATOM_COMPILERS, atom));
}

export async function compileFlow(run, flow) {
  for (const step of flow.steps || []) {
    const firstEvent = run.events.length;
    // run.blockers 在生产恒为 createCompileRun 初始化的数组；纯函数金牌可传只驱断言原子路径的极简 run 桩（无 blockers
    // 字段，如 regress-wf-node-script C2）——故防御性取值，桩 run 视作恒零 blocker（永不触发下方中止，语义正确）。
    const blockersBefore = Array.isArray(run.blockers) ? run.blockers.length : 0;
    await compileAtomStep(run, step);
    if (run.events.length > firstEvent) {
      // projectCompileEntityProvenance 保留旧纯函数契约；真实 compile 不扩 events v2，
      // sourceIntentId/entityBindings 只投影到独立 entity-bindings.draft sidecar。
      const bindings = Array.isArray(step.entityBindings) ? step.entityBindings : [];
      for (const event of run.events.slice(firstEvent)) {
        for (const binding of bindings) {
          run.entityBindingProvenance.push({
            stepId: event.stepId,
            intentId: event.intentId,
            atom: event.atom,
            sourceIntentId: step.sourceIntentId,
            candidateId: binding.candidateId,
            role: binding.role,
          });
        }
      }
      // 身份观察归档（agent-id-readback plan §4）：观察只 join 终端 click binding，provenance 取本 flow 步。
      // 归档不齐=硬阻断（codex R1-C1 附带封缝）：静默丢观察会让含身份义务的编译降级出 v1 产物，
      // 后续 sign 无从对账——缺 provenance/缺 sourceIntentId 一律 blocker，绝不静默降级。
      if (run.pendingIdentityObservation) {
        const pendingObservation = run.pendingIdentityObservation;
        run.pendingIdentityObservation = null;
        const primaryBinding = bindings[0];
        // C2 归档泛化（母规格 point 3）：kind/sourcePath 不再硬钉 agent——据 step.atom 查注册表 boundKind +
        // ENTITY_KIND_COMPILE_CHANNELS 的 profileKey 取该 kind 的 listApi.pathname。agent 逐字回落原值（boundKind=agent
        // → profileKey=agents → run.profile.agents.listApi.pathname，与旧硬钉字节等价、零漂移）；workflow.create/open
        // → boundKind=workflow → profileKey=workflows → run.profile.workflows.listApi.pathname。
        const regEntry = ENTITY_OBSERVATION_REGISTRY.get(step.atom);
        const archivedKind = (regEntry && regEntry.boundKind) || pendingObservation.kind || 'agent';
        const channelSpec = ENTITY_KIND_COMPILE_CHANNELS.get(archivedKind);
        const profileKey = channelSpec && channelSpec.profileKey;
        const archivedSourcePath = (profileKey && run.profile && run.profile[profileKey]
          && run.profile[profileKey].listApi && run.profile[profileKey].listApi.pathname)
          || pendingObservation.sourcePath || 'unknown';
        if (!pendingObservation.evidenceStepId || !primaryBinding || !step.sourceIntentId) {
          run.blockers.push(`${step.atom} 身份观察归档不齐（evidenceStepId=${pendingObservation.evidenceStepId ?? 'null'}、binding=${primaryBinding ? '有' : '缺'}、sourceIntentId=${step.sourceIntentId ?? '缺'}）→ 硬阻断，绝不静默降级出无观察产物`);
          run.notes.push(run.blockers[run.blockers.length - 1]);
        } else {
          run.identityObservations.push({
            kind: archivedKind,
            name: pendingObservation.matched.name,
            code: pendingObservation.matched.code,
            platformId: pendingObservation.matched.platformId,
            sourceIntentId: step.sourceIntentId,
            candidateId: primaryBinding.candidateId,
            role: primaryBinding.role,
            atom: step.atom,
            evidenceStepId: pendingObservation.evidenceStepId,
            sourcePath: archivedSourcePath,
          });
        }
      }
    }
    // 执行 fail-closed 中止（codex C2 High-2）：任一步产生硬阻断（证不出/身份读回不齐/容器外命中——如 workflow.open
    // 点开后 source 读回双证门失败、或点击落在记录容器外）即【立即中止整个 flow】，绝不继续执行后续步骤。杜绝
    // 「错对象已被打开/导航，读回随后失败，但后续 workflow.bindAgent/save 等破坏动作仍落到该错对象、exit 65 已无法
    // 撤销已发生的动作」的执行 fail-open。硬阻断本就令 compile 不产成功产物（bin/compile.mjs nonUnique/blockers→exit 65），
    // 此处提前中止只收窄破坏动作爆炸半径、不改成品与否（成功路径零 blocker→零影响）。清除任何未消费的待归档观察。
    if (Array.isArray(run.blockers) && run.blockers.length > blockersBefore) {
      run.pendingIdentityObservation = null;
      if (Array.isArray(run.notes)) run.notes.push(`compileFlow 于步 ${step.atom} 硬阻断后 fail-closed 中止：后续步骤不再执行（不让破坏动作落到未证对象）`);
      break;
    }
  }
}

async function compileAtomStep(run, { atom, params = {} }) {
  if (atom === 'login') { run.notes.push('login 原子由登录预备动作承接，不产 event（凭据红线，护栏 #7）'); return; }
  if ((atom && atom.startsWith('assert.')) || NAMED_ASSERTION_ATOMS.has(atom)) {
    // 断言原子不产 event：折进所在 intent 作 P4 草拟输入（G7-3 取 A，意图留痕）。
    run.assertionAtoms.push({ intentId: run.lastIntentId, atom, params });
    return;
  }
  // 命名原子经单一事实源分派表执行（own key 判定，防原型链键绕过，codex R1-F1/R2）。
  if (typeof atom === 'string' && Object.hasOwn(COMPILE_ATOM_COMPILERS, atom)) return COMPILE_ATOM_COMPILERS[atom](run, params);
  throw new Error(`原子 ${atom} 暂无编译知识（扩表走飞轮排期，护栏 #17 加法式）`);
}

// ── chat 维度编译知识（chiefcomplaint-smoke；决策依 docs/plans/chiefcomplaint-smoke/proposed/GRILL.md）──

// 气泡文本稳定等待——逻辑逐字同构 bin/replay.mjs 的 waitReplyStable（编译期作者与回放期消费者同构，
// 采集器同构纪律；regress 实测「网络流结束 ≠ UI 渲染完成」）。取不到回 null（证不出，不背书）。
