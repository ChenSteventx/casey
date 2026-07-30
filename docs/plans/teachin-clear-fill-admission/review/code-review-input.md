# 评审包 — teachin-clear-fill-admission 实现轮（联审输入）

> 输入=spec+diff+门禁证据（护栏 #9：不含实现者推理过程）。仓库根 /mnt/d/ctx/heren/casey。

## spec

- `docs/plans/teachin-clear-fill-admission/GRILL.md`（证据链与定案；D4 已按计划评审 r1 收紧）
- `docs/plans/teachin-clear-fill-admission/plan.md`（含金牌矩阵 G1-G6、复跑矩阵、验收点；
  §7 计划评审已 codex 三轮至 PLAN_APPROVE）

## diff（生产件全部改动，共两处）

### 1) `lib/record-capture.mjs`（git diff 原样）

```diff
@@ -87,7 +87,10 @@ export function sanitizeRecordEvent(input, index = 0) {
       continue;
     }
     const v = cleanString(raw[k], k === 'value' ? 1000 : 200);
-    if (v) out[k] = v;
+    // fill 的 value 是语义值不是装饰字段：真清空（原始值恰为空串）必须保键，否则
+    // 「清空输入框」被抹成「没值」、下游准入误拒。仅限原始 ===''：纯空白等「洗成
+    // 空串」形态继续丢键、交准入拒付——放行等于把原拒付形态洗成静默清空（fail-open）。
+    if (v || (k === 'value' && action === 'fill' && raw[k] === '')) out[k] = v;
   }
   for (const k of NUMBER_FIELDS) {
     const n = Number(raw[k]);
```

### 2) `lib/teachin/raw-capture.mjs`（该目录未跟踪、无 git 基线，改动为 `checkReplayableFields` 首循环判据，前后如下）

改前：

```js
function checkReplayableFields(events) {
  for (const event of events) {
    if (event.action === 'fill'
      && (typeof event.value !== 'string' || !event.value)) {
      return denied('FILL_VALUE_UNAVAILABLE', event.seq);
    }
  }
```

改后：

```js
function checkReplayableFields(events) {
  for (const event of events) {
    // 空串是合法回放目标值（fill('') 即清空）；缺键与非 string 仍是值不可用。
    if (event.action === 'fill' && typeof event.value !== 'string') {
      return denied('FILL_VALUE_UNAVAILABLE', event.seq);
    }
  }
```

其余生产件零改动（`bin/record.mjs` 注入侧、`lib/teachin/raw-action.mjs`、
`lib/teachin/raw-playwright-driver.mjs`、`lib/record-intake.mjs`、`lib/teachin/raw-replay-runner.mjs`、
蒸馏侧、`verdict.mjs`）。

## 新冻结金牌

- `tests/_golden/teachin-clear-fill-admission.zero-sut.golden.mjs`（13 组断言，G1-G6；
  sha256 已冻入 `loop/prd-teachin-clear-fill-admission.json` testChecksums）
- 红先行证据：实现前实跑 exit 1（4 红=新语义、9 绿=不变量）；实现后 exit 0（13/13）。

## 门禁证据

- gate GREEN：`loop/prd-teachin-clear-fill-admission.json` s1/s2 `passes:true`，
  evidence 戳 `gate@2026-07-29T02:21:42.083Z` 与 `gate@2026-07-29T02:25:22.970Z`，
  s2 含 15 枚邻接金牌 acceptance 全 exit 0。
- 改前基线：`docs/plans/teachin-clear-fill-admission/review/baseline-pre-change.txt`
  （51 枚：44 绿 + 5 陈旧红 + 2 枚 exit 78 吊销墓碑，既红全在 observation 家族、含失败签名附录）。
- 改后全量复跑进行中，将落 `review/postchange-sweep.txt`（同目录）。

## 评审要求

对抗式核验，重点：
1. 两处判据改动的语义正确性与 fail-safe 保持（缺键/非 string/纯空白/敏感遮值四路仍 fail-closed；
   闸序敏感先于可回放）。
2. 金牌是否真钉住语义（可自己跑：`node tests/_golden/teachin-clear-fill-admission.zero-sut.golden.mjs`），
   有无可绕过断言的实现变体（奖励钻营面）。
3. 爆炸半径：有无其他消费方隐式假设「fill 必有非空 value」被漏（可全仓检索）。
4. 首轮只报 Critical/High/Medium；输出第一行为 APPROVE 或 CHANGES_REQUIRED；
   每条 finding 附文件:行号+一句证据+一句修法；最后一行固定哨兵 REVIEW_DONE_SENTINEL。
