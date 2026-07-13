# Fable review disposition: Loop dual-profile reform

> Review date: 2026-07-13
> Reviewer: Fable, read-only repository-grounded architecture review
> Verdict: `PASS WITH REQUIRED CHANGES`
> Disposition status: closed — all design corrections incorporated; governance approval recorded in `PROPOSAL.md` section 0 (Steven, 2026-07-13)
> Implementation status: P0 active per `PROPOSAL.md` section 14; every P0-4a..P0-10 item runs as a separately accepted kernel contract under the old Loop until the bounded cutover

## Verified baseline

Fable rechecked every row in `PROPOSAL.md` section 2.1 against the live Casey and autotester repositories. It reported no self-review claim disproved by code. In particular, it confirmed the weak six-stage evidence, caller-asserted approvals, unrestricted `direct` bypass, Claude-only fail-open hook, non-enforced family separation, stale plan review, unstructured audit rows, single-layer Gate, git-only breaker progress, limited tier-1 coverage, policy-only model routing, installed runner surfaces, loop-kit divergence, and the non-clean B/C worktrees.

## Required findings and dispositions

### HIGH-1: competing approved execution orders

**Finding:** the earlier approved next-session proposal still says B/C first and forbids a new `state.json`, while this proposal defers B/C and adopts the durable 16-node state.

**Disposition:** section 0 now names both reversed decisions, makes sole-source activation conditional on Steven's explicit approval, and requires the earlier proposal, `loop-ddd-overhaul/DESIGN.md`, HANDOFF, and NEXT-SESSION to be updated in one documentation commit. Candidate conflict notices are present in both older reform documents. They must not be labeled `SUPERSEDED` until approval is recorded.

**Status:** pending decision-owner approval; this is the only remaining implementation blocker.

### MED-1: affected selection misses source-only changes

**Disposition:** sections 10 and 10.1 define affected closure as Ratchet PRDs plus registered source dependencies plus conservative escalation. Incomplete Ratchet output, issues, or untracked files fail closed. Behavioral changes under `lib/`, `bin/`, or `loop-kit/` run full validation until a proven dependency map exists.

### MED-2: Codex profile reviewer starvation

**Disposition:** section 6.2 records `blocked` with `reviewer-unavailable`, writes a bounded Inbox escalation, releases reviewer capacity, and permits unrelated ready work to continue. Timeout and same-family output cannot satisfy the review node.

### MED-3: checkpoint path is not checkpoint durability

**Disposition:** section 4.3 requires the exact checkpoint blob to be committed and reachable from a recorded ref. Staged, untracked, or merely path-resident files do not count. The engine prepares/verifies evidence but does not bypass human-controlled commit policy.

### MED-4: no healthy pause points across a multi-session P0

**Disposition:** section 14 splits the work into separately accepted kernel contracts under the old Loop, defines pause conditions, separates P0-4a state work from P0-4b gate work, and keeps the new engine dark until bounded cutover.

### MED-5: automatic quota takeover is unproven

**Disposition:** sections 6.3, 14, and 15 keep mode changes manual until concurrent-writer contention and lease-release crash evidence passes. Enabling `auto` is a separate recorded decision.

## LOW dispositions

1. New bilingual terms and owners must be registered in `CONTEXT.md` before implementation; P0-1 also produces a Chinese decision/supersession summary.
2. P1 branch divergence is calculated at recovery time rather than freezing the current four-commit count.
3. `red-baseline` now binds command, expected failure class, non-zero exit, output-summary hash, inputs, tools, and base SHA.
4. Scheduling annotations must use the transition engine; the scheduler cannot write state directly.
5. The English design remains normative during review; its Chinese decision record maps to registered concepts and cannot become a second design source.

## Additional test obligations

The kernel test list now includes concurrent-writer contention, lease-release crash recovery, affected incompleteness/untracked fail-closed behavior, source-change escalation, checkpoint commit reachability, a negative proof that completion does not depend on hooks, and breaker progress evidence.

## Author review of the Fable response

The review is accepted as strong and materially useful, but four statements are narrowed rather than copied as new facts:

1. Section 2.1 contains 14 factual finding rows, not 18. Fable's "18 rows" phrase is a counting error; it does not change the row-by-row verification result.
2. A committed checkpoint supports same-repository session and worktree-deletion recovery. Without an independently replicated ref it does not prove recovery from host or disk loss, so the proposal now states that boundary.
3. Sending behavioral `lib/`, `bin/`, and `loop-kit/` changes to full validation is a conservative migration default, not the desired steady-state performance model. A reviewed, completeness-tested source dependency manifest may narrow it later.
4. Breaker progress is itself kernel work and is a weaker self-hosting demonstration because of circularity. The initial suggestion to replace it with `countChange` was also disproved by a later current-code check: `profile.countSelector` was already implemented by `wf-add-node` at `dbc0d0d` and is live in `bin/replay.mjs:138-142,234-242` with multiple golden consumers. P0-9 therefore selects a still-unfinished non-kernel item from current repository evidence at intake; it does not trust the stale `DESIGN.md` backlog row.

## Focused follow-up requested from Fable

Fable must read this disposition and the revised proposal, then respond specifically to the four qualifications above. For each item it must state `ACCEPT`, `DISPUTE`, or `ACCEPT WITH EDIT`, cite repository evidence for any disagreement, and provide exact replacement wording when proposing an edit.

The follow-up must also answer these bounded questions:

1. Does correcting the section 2.1 count from 18 to 14 change any substantive verification conclusion?
2. Is the checkpoint recovery boundary now stated accurately without implying host/disk disaster recovery?
3. Is conservative full validation for behavioral `lib/`, `bin/`, and `loop-kit/` changes acceptable as a temporary fail-closed rule with an explicit path to a proven dependency manifest?
4. Is `countChange` selector hardening a less circular self-host workload than breaker progress evidence?
5. Do the revised sections fully disposition HIGH-1 and MED-1 through MED-5, apart from Steven's intentionally pending approval?

This is a read-only focused rereview. Fable must not modify files, broaden the architecture, restart implementation, or repeat findings already accepted unless the revision failed to resolve them. It must end with exactly one of:

```text
QUALIFICATIONS ACCEPTED
QUALIFICATIONS ACCEPTED WITH REQUIRED EDITS
QUALIFICATIONS REJECTED
```

## Focused follow-up result and disposition

Fable returned `QUALIFICATIONS ACCEPTED`. A subsequent Codex repository check accepts its answers on the row count, checkpoint scope, temporary affected escalation, and resolution of HIGH-1/MED-1..5, with one required factual correction:

- `git remote -v` is empty and `git branch -a` contains only local branches, so Fable's additional no-remote observation is verified;
- Fable's claim that `countChange` selector hardening remains a bounded backlog item is false in the current repository. `bin/replay.mjs` already reads and validates `profile.countSelector`, the behavior shipped in `dbc0d0d`, and current workflow goldens exercise it;
- the architectural principle behind Fable's answer remains valid: the first self-host workload must be real, non-kernel, and independently testable. The proposal now chooses that workload only after a live backlog/code/history check at P0-9 intake.

Final disposition of the focused follow-up: `ACCEPT WITH FACTUAL CORRECTION`. This correction does not reopen the architecture or add a new HIGH/MED blocker, but it invalidates the named `countChange` candidate and records another concrete reason not to treat narrative backlog tables as current truth.

## Final cross-family reconciliation

Fable independently rechecked `bin/replay.mjs:236-242` and commit `dbc0d0d`, accepted the factual correction without reservation, and confirmed the revised P0-9 live-selection policy. The cross-family plan-review chain is therefore closed as:

```text
PASS WITH REQUIRED CHANGES
-> QUALIFICATIONS ACCEPTED
-> ACCEPT WITH FACTUAL CORRECTION
-> FACTUAL CORRECTION VERIFIED BY FABLE
```

Fable also observed remaining `.hr-table-row` and `.hr-card--bordered` literals in `lib/compile-atoms.mjs`. Those belong to compile-time observation/container probes rather than the already-completed replay `countChange` channel. This is recorded only as P0-9 intake evidence to inspect; it is not declared unfinished work, a defect, or the selected self-host task without the live code/test/history analysis required by section 14.

No further architecture rereview is required for the current proposal unless its design changes materially. The only remaining activation blocker is Steven's explicit section 0 approval.

## Preserved decisions

The review explicitly preserves the repository-grounded self-audit, honest limits on human provenance and hostile local writes, staged no-dual-write migration, Ratchet as a read-only projection over `testChecksums`, guardrail #18 worktree isolation and human merge conflict disposition, two bounded contexts, explicit loop-kit ownership decision, manifest-based review hashing, and fail-closed family separation.

## Activation record

Steven explicitly approved both decision replacements on 2026-07-13 (verbatim statement recorded in `PROPOSAL.md` section 0; provenance: user-asserted). P0-0/P0-1 documentation and the P0-2 B/C branch-local freeze were executed in the same session; both older reform documents now carry `SUPERSEDED` banners. This resolves the duplicate activation-condition section that previously appeared here.
