I've completed the systematic review. Here's my analysis:

---

## Risk-by-Risk Analysis

### R1 — Agent family byte-level zero behavioral difference
**PASSED.** Traced through all three degenerate paths:
- **agents section with missing listApi**: `identityChannelsByKind.get('agent')` → absent → gate falls through to `"未声明 agents.listApi"` (same message as old code, line 328-329).
- **v1 lock (no identity rows)**: `frozenIdentityRows` null/empty → entire v2 gate block skipped → `identityExpectedByStep` stays null → identity ledger stays null (byte-identical to old path).
- **No lock**: same skip. All agent-row paths go through `identityExpectedByStep` construction with same Map shape `{signedName, signedCode, signedPlatformId}` (line 360), consumed by same `identityLedger` (line 465) and same ctx injection (line 512). C3 failclosed-replay golden (agent D2) passes independently.

### R2 — Intentional divergence from compile
**PASSED.** The compile-side "multi-kind declaration = reject" protects against compile-time ambiguity where no lock exists. The replay-side uses the lock as disambiguator: `deriveFrozenLockChannelKind` enforces single-kind (IDENTITY_LOCK_KIND_MIXED, line 91 of registry) with equal strength. Profile sections for non-selected kinds reside inert in maps — the lock's kind picks exactly one via `identityChannelsByKind.get(lockKind)` (line 323). No silent selection or degradation.

### R3 — Coverage exemption criterion vulnerability
**PASSED.** `createdWorkflowCovered` is built from `opened.controller.coveredIntentAtoms()` (line 276-277), which is the v3 authority's independently verified edge set — not lock self-reported fields. Three bypass attempts examined:

1. **evidenceStepId not in events**: `eventByStepId.get()` → `undefined` → the `&&` short-circuits → `!(false)` = `true` → row stays uncovered. ✓
2. **evidenceStepId maps to non-covered atom**: `createdWorkflowCovered.has()` → false → row stays uncovered. ✓
3. **evidenceStepId maps to covered atom but row has different entity's identity**: `coveredIntentAtoms()` returns only `workflow.create` and `workflow.deleteByName` atoms (verified in `lib/entity-created-workflow-continuity-v3.mjs:749-753`). Agent rows have `agent.searchOpen` atom → their evidenceStepIds anchor different events → never match the coverage set. The exemption is atom-specific, not row-specific, making cross-kind forgery impossible without also forging the signed lock (caught by signature verification in `readIdentityAdmissionAuthorityFromPrd`).

### R4 — Non-covered workflow row rejection bypass
**PASSED.** Four attempted bypass paths all fail:
- **Partial coverage**: uncovered rows remain → hit line 351 `lockKind !== 'agent'` → exit 65.
- **Mixed agent+workflow rows**: caught at `deriveFrozenLockChannelKind` line 91 → IDENTITY_LOCK_KIND_MIXED.
- **evidenceStepId to nav step**: `createdWorkflowCovered.has()` with nav atom → false → uncovered → exit 65.
- **evidenceStepId to non-existent step**: anchor undefined → uncovered → exit 65.

### R5 — `:344` v3 judgment not touched
**PASSED.** The v3 rebuild block's `!identityExpectedByStep` check (line 398) correctly fires when all workflow rows are covered (identityExpectedByStep stays null). This produces `DESTRUCTIVE_CONTINUITY_IDENTITY_CHANNEL_UNVERIFIED` → exit 65 — fail-closed, directionally safe. Disclosed in plan §1c and GRILL §5 as deliberate non-target. The error message is explicit, and the scenario isn't reachable in current usage (p9-…-v3 s5 deep consumer is future work).

### R6 — Enforcement timing stratification
**PASSED.** The amendment-1 change is empirically justified (two p9 authority CLI goldens would regress under immediate enforcement). The deferred enforcement path (lines 156-165) records parse failures in `identityChannelParseFailures` for non-agent kinds and defers exit until the lock names that kind (lines 324-327). v3-only minimal profiles (no lock naming workflow) pass through — correct, since v3's controller provides its own validation. The compile-vs-replay enforcement inconsistency is documented in plan-amendment-1.md. The known gap ("no hermetic test for deferred + lock-naming rejection") is disclosed as deferred work.

---

## Whitelist Compliance

All 9 changed files are within the whitelist (3 categories). No excess changes.

## Evidence Verification

- Golden test (6 scenarios): **exit 0** ✓
- Adjacent C3 failclosed-replay golden: **exit 0** ✓
- Adjacent destructive-continuity-guard zero-sut: **exit 0** (25/25) ✓

---

No Critical, High, or Medium findings. Both known hang items (plan.md W3 table documentation errata; plan §1b deferred enforcement hermetic test gap) are disclosed in the review prompt as deferred and are not new findings.

**VERDICT: APPROVE**
