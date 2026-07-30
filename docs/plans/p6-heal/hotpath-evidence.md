# P6 heal · S0 热路径可达性证据（A0 分支②：不可达并挂账）

> 对应 `docs/plans/p6-heal/plan.md` 的 S0 与 GRILL.md 的 D10「热路径先证」。
> 待证命题：「词表原子回放未命中（定位解析态 `none`）→ 只读漂移探针跑出正向证据 →
> 三轴落 `driftProbe` → `bin/verdict.mjs` 判 `HARNESS_ERROR`」这条链在**现役生产接线**上全程可达。
> 全程零浏览器、零网络、零 SUT、零凭据。

## 结论

**证伪：热路径在现役生产接线上不可达。**

断点在**第一环**（回放未命中 → 只读漂移探针）。第一环有两处彼此独立的断裂，各自单独就足以令
链路断开；第二、三环（三轴投影 → 多态裁定）实测全通，不是瓶颈。

- 断点一 · 分发绕开：唯一词表原子 `workflow.deleteByName` 的点击步在回放分发点被**破坏动作域锁**
  截走，那条路径根本不调用 `findEquivalentAffordance`，产出的动作轴连 `driftProbe` 这个键都没有。
- 断点二 · 字段悬空：三处探针调用位读的是 `event.targetName`，而**全仓没有任何生产代码往事件上写
  这个字段**，仓内 `cases/*/events.json` 里该字段出现 0 次。词表原子的目标名实际存放在 `value` 里，
  且只在断点一那条绕开分支内被取出。

因此，能到达探针的原子集合与探针词表内的原子集合在现役接线上**互不相交**：词表原子的点击步到不了
探针；能到探针的步（含词表原子自己的搜索框填写步）因 `targetName` 悬空，只能拿到零命中形状。
自然回放下，词表原子的定位漂移一律落 `NEEDS_HUMAN`，永远不会被判成 `HARNESS_ERROR`。

按 D10 的两分支约定，本契约不松「零改 replay 生产库」这一条，改走诚实缩范围：机械全链照做，
热路径缺口连同本文证据挂账给后继契约（见文末「挂账与解除条件」）。

## 证据

### 0. 待证链的四环与实测口径

| 环 | 生产代码位 | 实测结果 |
|---|---|---|
| ① 回放未命中 → 探针 | `lib/replay-actions.mjs` 分发点 + `lib/drift-probe.mjs` | **断**（两处独立断裂） |
| ② 探针结果 → 动作轴 | `lib/replay/action-authority.mjs:93-104` | 通（但①不供料） |
| ③ 动作轴 → 三轴 `driftProbe` | `lib/intent-action-fold.mjs:83`、`lib/replay-axes.mjs:70/101` | 通（实测） |
| ④ 三轴 → `HARNESS_ERROR` | `bin/verdict.mjs:66-73` | 通（实测，见对照组 C） |

口径：所有实测都用现役生产模块的真实导出（`dispatchReplayAction`、`projectReplayAxes`、
真 `bin/verdict.mjs` 子进程），配 zero-SUT 假运行时接缝
`tests/_golden/support/p6-heal-runtime-seam.mjs`（金牌既有件）。喂进去的事件**逐字段抄自真实编译
产物** `cases/tc_catalog_wf_crud/events.json`，不是为结论定制的形状。

### 1. 断点一：词表原子的点击步被分发绕开探针

`lib/drift-probe.mjs:8-10` 是词表的单一事实源，当前只有一个原子：

```
const ATOM_AFFORDANCE = {
  'workflow.deleteByName': { role: 'button', name: '删除' },
};
```

而 `lib/replay-actions.mjs:100-109` 在通用点击身份门**之前**就把这个原子的点击步截走：

```
if (ev.action === 'click' && ev.atom === 'workflow.deleteByName') {
  const label = ev.semantic && typeof ev.semantic.name === 'string' ? ev.semantic.name : ev.text;
  const targetName = typeof ev.value === 'string' && ev.value.trim() ? instantiate(ev.value, ctx) : null;
  if (!targetName) return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  if (label === '删除') return await performWorkflowDeleteTrigger(page, targetName);
  if (label === '确定' || label === '确认') return await performWorkflowDeleteConfirm(page, label, targetName);
  return { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
}
```

被截去的目的地 `lib/workflow-delete-domain.mjs` 全模块**零次**出现 `findEquivalentAffordance`
（`grep -rn findEquivalentAffordance lib/` 只命中 `drift-probe.mjs`、`replay-actions.mjs:211/278`、
`replay-actions/canvas.mjs:112` 三个文件）。该模块所有出口都经同一个轴工厂
`lib/workflow-delete-domain.mjs:32-34`：

```
function axis(resolution, candidateCount = 0, ok = false) {
  return { resolution, candidateCount, identityReadback: { ok } };
}
```

三键闭合，没有 `driftProbe`。目标记录缺席时的两条 `none` 出口分别在
`lib/workflow-delete-domain.mjs:152`（`waitForTargetRecordDomain` 超时）与 `:361`
（`targetNameFromSearch` 搜索框缺席），二者产出的都是无探针字段的 `none`。

对照：真正带探针的路径是通用点击身份门 `lib/replay-actions.mjs:114-115` → `gateAndAct` →
`lib/replay/action-authority.mjs:93-104` 的零候选分支 → `probeFormalDrift`
（`lib/replay-actions.mjs:209-212`）。词表原子的点击步永远进不到这里。

### 2. 断点二：探针入参 `event.targetName` 在生产事件面上不存在

三处探针调用位读的都是 `event.targetName`：

- `lib/replay-actions.mjs:211` —— 通用点击身份门的零候选探针；
- `lib/replay-actions.mjs:278` —— 自定义下拉 `doSelect` 的零候选探针；
- `lib/replay-actions/canvas.mjs:112` —— 画布拖拽 `doDragTo` 的零候选探针。

而 `lib/drift-probe.mjs:23-27` 对空 `targetName` 直接短路成零命中形状：

```
export async function findEquivalentAffordance(page, atom, targetName) {
  const a = ATOM_AFFORDANCE[atom];
  const canonical = canonicalSignature(atom, targetName);
  if (!a || !targetName) {
    return { sameSignatureUniquePresent: false, candidateCount: 0, matchedSignature: null };
  }
```

实测：全仓 `lib/` 与 `bin/` 没有任何一处把 `targetName` 写到事件对象上
（`grep -rn targetName lib bin --include=*.mjs` 的命中全是局部变量、函数形参或读取位）；
`cases/*/events.json` 里 `"targetName"` 出现 **0** 次。编译面
`lib/compile-atoms-workflow-crud.mjs:174/175/197/215/225/226` 发的六个 `workflow.deleteByName`
事件，目标名一律落在 `value` 上。真实产物样本（`cases/tc_catalog_wf_crud/events.json`）：

```json
{
  "stepId": "atstep_12", "intentId": "intent_3",
  "atom": "workflow.deleteByName", "action": "click",
  "semantic": { "kind": "text", "name": "删除", "exact": true },
  "text": "删除", "value": "atl_{{uniqueName}}"
}
```

后果：词表原子在现役接线上**唯一**能走到探针的步，是同一意图里的搜索框 `fill` / `press` 步
（这两个动作不匹配 `lib/replay-actions.mjs:100` 的 `action === 'click'` 条件，会落到通用点击身份门）。
它们带着正确的原子进探针，却因 `targetName` 悬空只能拿到零命中形状——这条路即使接通也答错了问题：
词表的稳定签名 `role=button|name=删除|withinRow=<目标名>` 描述的是删除按钮，不是搜索框。

补注：历史夹具 `tests/_golden/fixtures/seams/drift-patch.fixture.json` 的 `locatorBefore` 是
CSS 选择器 `.hr-table-row:nth-child(2) .hr-action-delete`，这个形状同样从未出现在真实编译产物里
（真产物用文本语义 `删除`）。这佐证了相5 的只读漂移探针当初是照一个假想定位模型设计的，
与后来落地的破坏动作域锁路径从未对接过。

### 3. 复现（探针实测输出）

第一步，喂现役生产分发 `dispatchReplayAction`（假运行时接缝全 miss 局面），观察动作轴：

```
--- 编译产物 click(删除)
    axis = {"resolution":"none","candidateCount":0,"identityReadback":{"ok":false}}
    has driftProbe key: false
--- 编译产物 fill(搜索框)
    axis = {"resolution":"none","candidateCount":0,"driftProbe":{"sameSignatureUniquePresent":false,"candidateCount":0,"matchedSignature":null}}
    has driftProbe key: true
--- 夹具形状 click + targetName
    axis = {"resolution":"none","candidateCount":0,"identityReadback":{"ok":false}}
    has driftProbe key: false
--- 探针直调（绕过回放接线）
    canonicalSignature(deleteByName, atl_wf_p6heal) = role=button|name=删除|withinRow=atl_wf_p6heal
    findEquivalentAffordance(targetName=undefined) = {"sameSignatureUniquePresent":false,"candidateCount":0,"matchedSignature":null}
```

三条读法：① 真实编译形状的删除点击步，动作轴里**连 `driftProbe` 键都没有**（断点一）；
② 唯一能进探针的搜索框填写步只拿到零命中（断点二）；③ 即使按夹具形状硬给事件补上 `targetName`，
点击步照样没有 `driftProbe`——说明断点一与断点二互相独立，补字段治不好绕开。第四条是隔离对照：
探针函数本身没坏，`canonicalSignature` 对词表原子正常出规范签名，是接线到不了它。

第二步，把上面实测到的真实动作轴喂现役投影 `lib/replay-axes.mjs::projectReplayAxes`，
再交真裁判 `bin/verdict.mjs` 子进程：

```
--- A 生产实测·click 删除（无 driftProbe）
    verdict.mjs exit=0  目标步="NEEDS_HUMAN"
--- B 生产实测·fill 搜索框（负向 driftProbe）
    verdict.mjs exit=0  目标步="NEEDS_HUMAN"
--- C 对照组·假想正向 driftProbe
    verdict.mjs exit=0  目标步="HARNESS_ERROR"
```

对照组 C 是决定性的：只要有人把正向探针三元组放进动作轴，第二、三环（三轴投影 → 多态裁定）
当场把它抬成 `HARNESS_ERROR`，`bin/verdict.mjs:66-73` 的 `driftHolds` 判据一分未改。
所以缺口 100% 在第一环，与裁判和三轴投影无关；这也解释了为什么既有金牌
（`tests/_golden/resolution.golden.mjs:105`、`tests/_golden/p2-verdict-coverage.golden.mjs:93` 等）
一直是绿的——它们都是从动作轴往下测，从没测过动作轴**怎么来**。

复现口径（供后继契约复算）：

- 断点一，一行判死——破坏动作域锁模块零次引用探针：
  `grep -c findEquivalentAffordance lib/workflow-delete-domain.mjs` → `0`
- 断点二，一行判死——生产事件面零次出现该字段：
  `grep -ho '"targetName"' cases/*/events.json | wc -l` → `0`
- 全链实测：按上文两步，用 `lib/replay-actions.mjs::dispatchReplayAction` +
  `tests/_golden/support/p6-heal-runtime-seam.mjs` 造全 miss 局面，事件逐字段抄
  `cases/tc_catalog_wf_crud/events.json` 的 `atstep_12`；三轴走
  `lib/replay-axes.mjs::projectReplayAxes`；裁定 spawn 真 `bin/verdict.mjs --axes <f> --out <f>`。
  预期即上列 A/B/C 三行。

### 4. 为何本次不出可达性证明金牌

A0 金牌 `tests/_golden/p6-heal-hotpath-evidence.zero-sut.golden.mjs:33-52` 的分支①判据是
「存在 `tests/_golden/p6-heal-hotpath-*.golden.mjs` 且全部退出码 0」。若把上述**证伪**实测写成
该命名的金牌，它会退出 0，从而让 A0 报出「分支①可达性证明金牌绿」——把证伪当成证成，虚标可用。
故本次刻意不铸该命名的金牌，只走分支②：本文即证据文档，A0 据 `hotpath-evidence.md` 的
「结论」「证据」两节判绿。

## 挂账与解除条件

热路径缺口挂账给后继契约（`replay` 生产库改动面）。要让本文结论翻成「可达」，须同时修掉两处断裂：

1. 让词表原子的点击步在零候选时也能落到只读漂移探针——或者破坏动作域锁的 `none` 出口自己带上
   探针结果，或者把该原子的定位解析接回通用点击身份门；改动必须保住域锁现有的破坏动作安全属性
   （目标记录唯一才动作、确认弹层因果绑定、一次性授权），探针本身只读不点，不与之冲突。
2. 让探针拿得到目标名——或者编译面把目标名同时写进 `targetName`，或者探针调用位改从
   `value` 取（后者要经 `instantiate` 模板实例化，`lib/replay-actions.mjs:104` 已有先例）。

两处都属 `replay` 生产库改动，按 plan 的非目标清单不在本契约范围内。在此之前，本契约交付的
自愈准入门、重锚提案、漂移补丁与台账、候选式应用、事务性晋升、复核编排与熔断构成**机械全链**，
其正确性由 hermetic 金牌担保；但「真实回放自然产出确证 `HARNESS_ERROR`」这一入口尚未接通，
不得对外宣称词表原子的漂移已可自动自愈。
