# gen-prompts 修复层评审（r2）——pi

调用式：`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro @docs/plans/gen-prompts/review/material-r2.md <指令>`（pi v0.80.3，provider=deepseek，thinking=high；实测冒烟先确认真选中 deepseek-v4-pro）。评审对象：round-1 的 10 条 finding（`docs/plans/gen-prompts/review/arb-r1.md` 汇裁采信）经修复者逐条处置后的结果，与 codex 本轮评审对象一致、同一份 `material-r2.md`、同一条指令，并行跑，供跨模型家族交叉核对。实现方 Claude，评审方 pi/deepseek-v4-pro（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

Based on my analysis of the diff and the current state of the repository, I conclude **PASS**（原文，译：通过）.

### 1. Round-1 finding 逐条兑现验证

All 10 findings are genuinely addressed (logic changed, not just wording):

- **A1 (HIGH)** – Real internal address removed from `tests/_golden/gen-prompts.golden.mjs` (S3f now uses synthetic `10.20.30.40`), S3h expanded to scan via `scanPrivateAddress`, S3i added to self-scan the gold file for old regress flag remnants. Grep-confirmed zero occurrences of the original address.
- **A2 (HIGH)** – `sanitizeFreezeError()` replaces raw error messages with fixed hints; both catch blocks in `bin/promptset-freeze.mjs` use it. New gold tests F3o and F2d assert that distinct sentinel keys and illegal source values never leak into stderr.
- **A3/A8 (HIGH/MED)** – `atomicWriteFileSync` now uses per-call random temporary names (`randomBytes(9)` → 72-bit entropy) and `writeFileSync` with `{ flag: 'wx' }` to prevent symlink-following. Gold tests F4h (different tmp names per call) and F4i (black-box symlink attack; victim file unchanged) verify the fix.
- **A4 (HIGH)** – Order changed: `green-by-construction` self-check runs before the `fresh.length === 0` early exit. Gold test F2d confirms that bad existing data causes exit 65 even with zero new candidates.
- **A5 (MED)** – `CONTEXT.md`: `promptset` source enumeration now uses full-width pipe `｜` instead of `\|`, avoiding `parseRegistry`'s bare `split('|')`. T1a–T1c verify no ghost alias, correct gloss, and `term-lint --registry` exit 0.
- **A6 (MED)** – `scanEquivalentEncodings` added to `lib/promptset-authoring.mjs`, canonicalising hex/octal/decimal/percent-encoded host parts before checking against existing private-address patterns. F4c1 tests five equivalent forms (all now hit) plus clean texts (no false positives); F4c2 does an end-to-end freeze CLI test with decimal-integer loopback.
- **A7 (MED)** – N1b is upgraded from scanning only entry-point files to scanning the entire import closure (via `scanClosure`), with comment stripping to avoid false alarms from doc-only references. The gold test shows the closure is currently clean.
- **A9 (LOW)** – `--dry-run` now prints only `id` / `category` summaries. F2c2 verifies that full candidate text and `expect.note` are absent.
- **A10 (LOW)** – F4j added: existing `promptset.json` containing credential or private-address content triggers exit 1 without echoing the sensitive value. The mechanism existed before; this only fills the test gap.

### 2. 红先行证据可信性

The "red-before-green" evidence is plausible, not self-fulfilling（略，同 dispositions-r1.md 逐条举证）。

### 3. 本轮新引入缺陷审计

No new defects detected. Specific points reviewed: `sanitizeFreezeError` bracket-regex bypass（未发现泄漏路径）、random-tmp + `wx` race（无 TOCTOU 窗口）、`scanEquivalentEncodings` performance/false positives/false negatives（评估为窄提取+归一，未见回归）、`stripCommentsForScan` bypass（评估为启发式防线，非对抗式设计意图）。

### 4. 铁不变量核验

裁判零 LLM / authoring 不进回放闭包 / 零 API key·零网络·零凭据接线 / 无真实内网地址——四项均判通过。

**All 10 round-1 findings are properly resolved, no new defects are introduced, and core invariants remain intact.**

---

## 驱动员核对（sonnet5，修复者本人）

pi 本轮给出 PASS，与 codex 同轮给出的 4 条具体缺陷（`docs/plans/gen-prompts/review/codex-r2.md`）方向相反。核实：codex 的 4 条均给出文件+行号+可独立复现实测（真实地址字面量残留、三处地址等价编码具体漏检形态、具体假阳性语料、具体绕过构造），逐条复现属实；pi 对同一批风险点（`sanitizeFreezeError` 正则/竞态/假阳性/`stripCommentsForScan` 绕过）给出的是评估性论述而非可执行反例。这不构成对 pi 评审"错误"的指控——两路评审对同一代码区域给出不同覆盖深度是异构评审的正常信号，本轮不因 pi 的 PASS 而跳过 codex 给出的具体证据，codex 的 4 条已逐条修死（见 `docs/plans/gen-prompts/review/dispositions-r2.md`）。
