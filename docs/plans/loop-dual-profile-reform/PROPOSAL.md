# Loop durable orchestration and dual-profile reform

> Status: APPROVED AND ACTIVE — sole Loop reform design source since 2026-07-13 (approval record in section 0). Fable review `PASS WITH REQUIRED CHANGES` dispositioned; focused follow-up closed as `ACCEPT WITH FACTUAL CORRECTION`. Kernel implementation proceeds only as separately accepted `kernel` contracts per section 14.
> Priority if approved: P0. Existing B/C delivery work is deferred, not cancelled, until the new Loop passes self-hosting and takeover drills.
> Design principle: one workflow kernel, two execution profiles. Do not fork the governance logic into separate Claude Code and Codex implementations.

## 0. Approval and supersession record

This proposal intentionally reverses two decisions recorded as approved in `docs/plans/loop-orchestration-reform/NEXT-SESSION-PROPOSAL.md` on 2026-07-13:

1. old decision: complete B/C before the Loop reform; proposed replacement: preserve B/C immediately, defer their implementation, and resume them only after the new Loop passes the bounded self-hosting proof;
2. old decision: extend the six-stage contract and do not introduce `state.json`; proposed replacement: adopt the durable 16-node per-worktree state and retire the six-stage file as independent truth through the staged migration in section 4.4.

`docs/plans/loop-ddd-overhaul/DESIGN.md` and the earlier next-session proposal remain historical design inputs, not silently merged authorities. Until the decision owner signs the following record, their prior approved execution order remains authoritative and no implementation work in this proposal may start.

```text
Decision owner: Steven
Decision: approve the two replacements above and make this proposal the sole active Loop reform design source
Status: APPROVED
Approved on: 2026-07-13
Approval evidence: Steven's explicit in-session statement (2026-07-13):
  "我批准以 loop-dual-profile-reform/PROPOSAL.md 取代旧决策①和③：B/C 延后，
  采用16节点 durable state，并以该提案作为唯一改革设计源。"
Recorded by: the session that performed the Fable review and follow-up
Provenance: user-asserted (section 4.2); no machine-proven identity is claimed
```

After explicit approval, update both older documents to `SUPERSEDED`, link them to this proposal and its review disposition, then update `docs/HANDOFF.md` and `docs/NEXT-SESSION.md` in the same documentation commit. Never leave two documents claiming to be the active execution order.

## 1. Decision summary

Build a single durable 16-node Loop state machine and expose two interchangeable execution profiles:

- `claude-code`: the normal primary profile;
- `codex`: the continuation profile when Claude Code usage is constrained, rate-limited, or exhausted.

Both profiles use the same state, contracts, gates, DDD rules, checkpoints, review packets, and completion criteria. Normal switching occurs at passed node boundaries; a quota failure mid-node closes the current attempt as blocked and starts a verified fallback attempt.

Two cross-family checks are mandatory for every behavioral task:

1. the plan must be reviewed by a different model family before acceptance/build;
2. the implementation must be reviewed by a different model family before affected closure/merge readiness.

Execution inside an approved plan remains deliberately lightweight: the implementer may complete a coherent story and run focused gates without a reviewer on every edit.

## 2. Current system

The live Loop uses six contract stages:

```text
grill -> plan -> accept -> loop -> review -> learn
```

Each worktree stores an independent gitignored `loop/active-contract.json`. The current strengths are stage interlocks, frozen acceptance checksums, deterministic gate ownership of `passes`, breaker limits, terminology linting, and worktree isolation.

The material weaknesses are:

- stage completion is weakly evidenced and is not consistently bound to artifact hashes or commit SHAs;
- `user-confirmed` and `red-verified` are caller assertions rather than durable receipts;
- the separate eight-stage Workflow scripts keep in-memory/session state that is not the same state as the six-stage contract;
- session recovery depends heavily on narrative HANDOFF documents;
- `direct|light|full` has no formal `kernel` lane;
- the gate is single-PRD and single-layer, with no focused/affected/full separation;
- model identities are embedded in task scripts instead of selected through capability profiles;
- DDD ownership is mostly prose plus terminology lint, rather than executable boundaries;
- worktrees provide isolation but not dependency-aware scheduling or reliable cross-agent takeover.

The read-only Test Ratchet reverse index was implemented at `76a05a7`, merged into `dev` at `164636e`, and reverified at `e81ce7f`. The current repository scan is GREEN for 68 PRDs / 103 frozen files / 0 issues. Gate layering should consume this existing capability rather than schedule another merge.

### 2.1 Repository-grounded self-review

The following claims were checked against the live repositories on 2026-07-13:

| Finding | Repository evidence | Consequence for this proposal |
|---|---|---|
| six-stage evidence is weak | `contract.mjs:225-249`: grill checks non-empty text; plan checks path plus the word 验收; accept checks non-empty checksums; review accepts any matching PASS audit row; learn always returns true | replace booleans with hash-bound evidence and invalidate stale downstream nodes |
| human/red receipts are caller assertions | `contract.mjs:265` converts free CLI flags directly to booleans | bind receipts to artifact hashes, but honestly retain a semi-hard trust label unless a real user-event integration supplies provenance |
| direct is currently an unrestricted bypass | `contract.mjs:65` returns allow for every action when lane is direct | machine-restrict direct paths/diffs; implementation, PRD, schema, hook, config and frozen changes must auto-escalate |
| the hook cannot be the shared hard gate | `hook-loop-guard.mjs:69-70` fails open; `.claude/settings.json` installs it only for Claude Code | hooks remain convenience/early feedback; transition and merge readiness must be enforced by runner-independent CLI/gate checks |
| current cross-family review is not a hard gate | B/C Workflow accepts `FALLBACK_SAME_FAMILY_PASS`; `crossFamily` is recorded but not used to block; `contract.mjs` review validation does not inspect family | new review runner and transition validator must fail closed when author and reviewer families are equal/unknown |
| plan review can become stale | B/C Workflow `PlanArb` may edit plan while explicitly keeping plan done; no plan hash is checked | plan changes invalidate plan-review and all dependent nodes |
| audit is not a versioned structured contract in practice | 58 live `audit.jsonl` rows: 0 have `schemaVersion`, `reviewerFamily`, or a separate `model` field | introduce a new versioned review receipt; migrate old rows as legacy evidence, never infer family from prose for new gates |
| gate is single-layer and does not validate `prd.schema.json` | `gate.mjs:39-116` parses JSON, checks one PRD's checksums, term lint and acceptance commands, then writes passes | static gate needs real schema/shape validation; affected gate composes Ratchet; preserve Gate as the sole passes writer |
| breaker progress is git-only | `breaker.mjs:23-88` uses HEAD plus error-text hash; config itself warns replay loops need progress hash | add explicit progress evidence while preserving current thresholds and inbox escalation |
| tier-1 does not cover the proposed kernel | `casey.mjs:168-217` covers term lint, breaker reset, a synthetic Gate and verdict purity; it does not run contract/hook/model-lane/Ratchet tests | add dedicated kernel goldens and include them in the new full/kernel gate before claiming migration safety |
| model routing exists as policy, not a general runner | `loop/config.json` says implementation subagent routing has no runner; model-lane guard checks only implementation vs review config | adapters must execute real installed CLIs and validate their different output protocols |
| all three requested runner surfaces exist | Claude Code 2.1.207 supports Fable and JSON schema; Codex CLI 0.144.1 supports output schema; Pi 0.80.3 supports DeepSeek but not an equivalent final-output schema flag | adapters share a logical result schema but require runner-specific capture/validation; Pi output must be parsed and validated locally |
| loop-kit extraction debt is real | autotester ADR-0001 says the second consumer triggers independent extraction; Casey ADR-0001 instead copied in place; eight shared scripts still byte-match, while Casey `contract.mjs` has already diverged for worktree baton | resolve distribution/source ownership before a large generic kernel rewrite; do not silently create a third variant |
| B/C are not clean 2/6 snapshots | both batons are 2/6 and both branches are four commits behind dev; B has a substantive uncommitted fake-SUT half-build; B/C plan artifacts are untracked | postponement begins with branch-local durable checkpoints that preserve dirty bytes and plan artifacts, then later migration/rebase is explicit |

Known limitation: local deterministic controls can make approved code paths fail closed, but an agent with arbitrary filesystem write permission can always attempt to edit runtime JSON directly. The security claim is therefore integrity verification and single-writer enforcement at transition/gate/merge boundaries, not protection against a hostile operating-system user.

## 3. Target state machine

Adopt one durable per-worktree state machine:

```text
intake
-> risk-classify
-> plan
-> plan-review
-> acceptance
-> red-baseline
-> build
-> focused-gate
-> review
-> adjudicate
-> fix
-> affected-gate
-> merge-ready
-> merged
-> post-merge-gate
-> learn
```

These are machine nodes, not sixteen manual meetings. The principal model-work nodes are `plan`, `plan-review`, `build`, `review`, and exceptional `adjudicate/fix`. Gate and transition nodes should normally advance through deterministic commands.

Each node records at least:

```text
nodeId, status, attempt
profile, capabilityRole, agentFamily, model
startedAt, finishedAt
baseSha, headSha
inputArtifactHashes, outputArtifactHashes
command, exitCode, evidenceHash
findings, findingsDisposition
checkpoint, failureReason, nextCommand
```

Allowed statuses:

```text
pending | running | passed | failed | blocked | invalidated
```

If a bound plan, acceptance artifact, frozen test, implementation diff, or evidence input changes, downstream nodes whose evidence depended on it become `invalidated`; they cannot remain passed.

`red-baseline` is evidence-bearing rather than a caller boolean. Its receipt binds the exact command, expected failure class, non-zero exit code, normalized output-summary hash, test/fixture hashes, tool/runtime identity, and base SHA. A changed command or input invalidates the receipt; an infrastructure failure cannot satisfy an expected behavioral red baseline.

## 4. State ownership and migration

Introduce:

```text
loop-kit/schema/workflow-state.schema.json   generic tracked schema
loop-kit/schema/review-receipt.schema.json   generic tracked schema
loop/state.json                 gitignored per-worktree current state
loop/events.jsonl               gitignored per-worktree transition log
docs/plans/<slug>/reviews/<review-id>.json   tracked structured review evidence
```

`loop/state.json` becomes the only writable current-workflow truth after cutover.

### 4.1 Single transition authority

Only `workflow-state.mjs` may mutate runtime state or append transition events. It validates schema, current revision, allowed predecessor, evidence manifest, and ownership before using a same-directory exclusive temporary file plus rename protocol based on the existing `bin/sign.mjs` pattern, strengthened by revision/CAS checks and crash tests. Its residual filesystem and power-loss limits must be documented and tested on supported platforms rather than described as universally atomic. Each event includes the previous event hash; malformed or discontinuous chains fail closed.

Other components have deliberately narrower authority:

- the orchestrator requests transitions but does not edit state directly;
- `contract show/check` reads the projection and requests compatibility transitions through the same state API;
- hooks read state and provide early denial only; because current hooks are Claude-only and fail-open, no final completion claim depends on them;
- Gate remains the sole writer of PRD `passes`, emits hash-bound evidence, and the state engine validates that evidence before advancing a gate node;
- sign remains the sole checksum mutation path;
- the merge owner supplies target-branch git evidence but cannot bypass transition validation;
- model runners write candidate review output to a temporary capture; the transition engine validates and installs the final review receipt.

Direct edits to `state.json`, events, adapters, or review receipts are detected by revision/event/evidence validation at the next transition and at merge readiness. This is an integrity control, not a claim of cryptographic protection from a hostile local user.

### 4.2 Human approval honesty

Artifact-hash binding prevents an approval from silently surviving a later plan/test change, but a free CLI flag cannot prove that the human actually approved it. Until Claude/Codex user-event provenance is normalized and verified, approval receipts are marked `provenance: user-asserted` and remain semi-hard. The design must not describe them as machine-proven identity. Kernel and live approvals still require the named human to be present and are surfaced explicitly in the completion report.

### 4.3 Durability and worktree lifecycle

Runtime state remains per-worktree and gitignored to preserve guardrail #18 isolation. The source worktree remains the owning baton through `merged`, `post-merge-gate`, and `learn`; it is not removed at merge-ready.

At `plan-review`, `red-baseline`, `merge-ready`, and `learn`, the state engine emits an immutable checkpoint under `docs/plans/<slug>/checkpoints/`. A checkpoint contains hashes and recovery metadata, not mutable authority. "Tracked" means that the exact checkpoint blob is committed and reachable from the recorded owning branch or target ref; merely writing under a normally tracked path, staging it, or leaving it untracked is not durable evidence. The transition engine must block the next checkpoint-dependent boundary until reachability is verified. It may prepare the file, but it does not bypass the repository's human-controlled commit policy. This provides same-repository session and worktree-deletion recovery; it is not a claim of host/disk disaster recovery, which requires an independently replicated ref and is outside this reform's completion claim. At learn, it also emits `docs/plans/<slug>/workflow-result.json`. The worktree may be removed only after the final receipt is committed, verified, and merged.

If gitignored runtime state is lost, recovery replays the last committed checkpoint plus validated repository evidence into a new state with a recorded recovery event. Narrative HANDOFF text alone cannot restore passed nodes.

The old six stages become a read-only projection:

| Existing stage | Durable nodes |
|---|---|
| `grill` | intake, risk-classify |
| `plan` | plan, plan-review |
| `accept` | acceptance, red-baseline |
| `loop` | build, focused-gate |
| `review` | review, adjudicate, fix, affected-gate |
| `learn` | merge-ready through learn |

`contract show/check` reads the projection. It must not maintain an independent stage truth. `active-contract.json` is supported only by a one-way migration/compatibility reader and is retired after the migration drill. Avoid indefinite dual-write.

### 4.4 Cutover without dual truth

1. Build the new engine in an isolated kernel worktree while existing contracts continue on the old writer.
2. Run read-only imports of completed sample batons and compare six-stage projections; do not write either live state.
3. Self-host a small new behavioral contract entirely on the new writer.
4. Freeze creation of old-format contracts for a bounded cutover window.
5. Migrate each paused active baton once from an immutable snapshot, verify its projection, and switch contract CLI plus guards together.
6. Rollback restores old binaries plus the untouched pre-migration baton snapshot; it never dual-writes old and new formats.

B/C remain untouched during kernel construction. Before P0 implementation begins, preserve each branch's actual state: commit or otherwise durably capture the untracked plan artifacts; record branch/base SHA, `git status`, and content hashes; preserve B's dirty fake-SUT half-build as an explicitly non-merge-ready WIP checkpoint. Both branches are currently four commits behind dev, so later recovery includes an explicit rebase/merge-base review rather than assuming they still sit on current dev.

## 5. Risk lanes

Formalize four lanes:

| Lane | Scope | Required flow |
|---|---|---|
| `direct` | documentation, comments, isolated non-behavioral fixtures | static gate; no synthetic plan/review ceremony |
| `light` | single-module additive behavior inside an existing contract | plan-lite, cross-family plan review, red baseline, focused gate, cross-family implementation review, affected gate |
| `full` | cross-module flow, shared schema, shared frozen surface, multiple PRDs | full plan, acceptance freeze, dual-view review where useful, affected closure, post-merge gate |
| `kernel` | verdict, sign, credentials, fail-safe, frozen protocol, gate/contract/hooks and bulk re-sign authority | double design review, cross-family implementation review plus round 2, full gate, explicit human approval |

An agent may preserve or raise a lane but may not lower it. Automatic escalation triggers include:

- a Published Language change;
- a new cross-context dependency;
- a shared frozen artifact or multiple affected PRDs;
- changes to `gate`, `contract`, hooks, sign, verdict, credential gates, fail-safe behavior, or mutation authority;
- expansion beyond the reviewed file or aggregate boundary.

The `direct` lane is restricted by a machine-owned path and diff policy. Any implementation root, PRD, executable schema/config, hook, frozen assertion, acceptance command, state engine, or mutation-authority change rejects `direct` and reruns risk classification. This closes the current unconditional `direct` bypass in `checkAction`.

## 6. Execution profiles

### 6.1 Claude Code profile

Default routing:

| Node/role | Agent family |
|---|---|
| plan | Claude, normally Claude Code/Fable |
| plan-review | OpenAI Codex |
| build/fix | Claude Code |
| implementation review | OpenAI Codex; DeepSeek may provide a second view |
| adjudication | Fable/task owner, with cross-family findings presumed valid absent concrete counter-evidence |
| verdict/gate | deterministic local tools, never an LLM |

### 6.2 Codex profile

Fallback routing:

| Node/role | Agent family |
|---|---|
| plan | OpenAI Codex |
| plan-review | DeepSeek v4 Pro through pi.dev; Claude may review when usage returns |
| build/fix | OpenAI Codex |
| implementation review | DeepSeek v4 Pro through pi.dev; Claude may provide an additional view |
| adjudication | Fable when available, otherwise an explicitly named human/task owner |
| verdict/gate | deterministic local tools, never an LLM |

The Codex profile must not use Codex as both author and final reviewer. A provider surface is not a family boundary; the stored evidence records the model family.

If Claude is unavailable and the DeepSeek reviewer times out, is unavailable, or cannot produce a valid receipt, the review node becomes `blocked` with `failureReason: reviewer-unavailable`. The orchestrator writes the bounded escalation request to `loop/inbox.md`, releases any reviewer capacity, and continues other independent ready nodes. It never waits invisibly, treats the timeout as a review, or substitutes a same-family PASS. A named human may disposition availability and scheduling, but cannot impersonate the missing cross-family receipt; implementation requiring that receipt remains blocked until a valid reviewer is available.

Adapters are executable runner definitions, not documentation-only model labels. The initial implementations target the installed surfaces:

- Claude Code 2.1.207: non-interactive print mode plus JSON schema;
- Codex CLI 0.144.1: `codex exec`, sandbox selection and output schema;
- Pi 0.80.3: explicit provider/model, read-only/no-tool review mode, local parse and schema validation of final text.

The existing `config-lane-guard` is extended rather than duplicated, but config validation alone is insufficient: the review receipt must include runner-captured requested/reported model identity. Unknown family, missing identity, fallback to the author's family, malformed output, timeout without valid output, or schema mismatch cannot satisfy a cross-family node.

### 6.3 Profile modes

Support:

```text
primary   Claude Code receives new implementation work
conserve  Claude closes the current atomic node; new work starts on Codex
fallback  Codex owns new plan/build nodes until Claude availability returns
auto      switch to fallback only on explicit quota/rate-limit signals
```

Do not infer exact remaining usage from latency. Initially, mode changes are human-set. `auto` remains disabled until the concurrent-writer contention golden and lease-release crash drill pass on the supported filesystems. Enabling it is a separately recorded configuration decision, not a default. A returning primary profile does not pre-empt an active node; ownership changes only at the next valid checkpoint.

Normal switches happen at passed node boundaries. A hard quota failure may occur mid-node; in that case the current attempt becomes `blocked`, its last durable tool-boundary checkpoint and dirty-tree manifest are recorded, and its ownership lease is released. The fallback profile starts a new attempt of the same node, inspects the real working tree, and reruns the node's focused evidence. It may reuse bytes but never inherits an unverified passed result. Two writer leases are never valid simultaneously.

## 7. Cross-family hard gates

For behavioral lanes, enforce:

```text
plan.authorFamily != planReview.reviewerFamily
build.agentFamily != review.reviewerFamily
```

The plan review binds:

```text
planHash, requirementsHash, baseSha, reviewerFamily, model, verdict, findings
```

The implementation review binds:

```text
planHash, acceptanceHash, baseSha, headSha, diffHash,
gateEvidenceHash, reviewerFamily, model, verdict, findings
```

Changing a bound input invalidates the review. A same-family corroboration may be stored but cannot satisfy the cross-family gate.

Evidence hashes use explicit manifests, not the whole worktree. Plan review hashes requirements, GRILL and plan but excludes its own receipt. Implementation review hashes the reviewed implementation/test/spec manifest and diff but excludes runtime state, generated review receipts and later Gate bookkeeping. Otherwise creating the review would invalidate itself. A changed behavioral file outside the declared manifest is an incomplete-evidence error and blocks progression until the manifest and review are regenerated.

The current audit prose is imported only as legacy history. New review gates consume versioned structured receipts with explicit `authorFamily`, `reviewerFamily`, requested/reported model, bound hashes, verdict and findings disposition. Family is never inferred from free-form reviewer text.

Review input follows trust asymmetry: provide spec, plan, diff, and deterministic gate evidence; do not provide the implementer's hidden reasoning narrative.

## 8. Build-loop policy

After plan review and red baseline, execution is optimized for throughput:

```text
select one failing story
-> implement the smallest coherent behavior
-> run static + focused gate
-> update checkpoint
-> continue or form a review batch
```

Do not require cross-family review for each edit or micro-commit. Interrupt build only when:

- the reviewed plan is wrong or incomplete;
- scope or lane must expand;
- a Published Language or context boundary must change;
- a kernel surface is encountered;
- acceptance appears incorrect;
- the breaker detects repeated failure or no measurable progress.

Progress should use story count, failure fingerprint, evidence hash, and affected closure, not only git HEAD.

## 9. Checkpoint and takeover

Planned profile takeover is legal only at a node boundary with a valid checkpoint. The sole mid-node exception is the quota/rate-limit failure protocol in section 6.3: close the old attempt as blocked, release its lease, and start a new verified attempt rather than continuing the old attempt under a second writer. The checkpoint contains:

```text
task and contract slug
current node and profile
base/head SHA
plan and acceptance hashes
completed/current stories
touched files and aggregate ownership
last command and exit code
next deterministic command
decisions, findings, blockers, and takeover permission
```

On takeover, the new profile verifies hashes and worktree state before continuing. If Codex or Claude modifies the reviewed plan, `plan-review` reopens. If implementation changes after a review, `review` and downstream affected evidence reopen.

Required drills:

1. Claude Code to Codex takeover during a behavioral contract;
2. Codex to Claude Code takeover after availability returns;
3. session termination during build;
4. session termination during review;
5. zero-context recovery to the next deterministic command within five minutes.

## 10. Gate architecture

Split the gate into:

```text
gate static
gate focused
gate affected
gate full
gate live
```

- `static`: syntax, lint, term-lint, schema checks, DDD fitness functions;
- `focused`: current story/contract acceptance;
- `affected`: reverse-index-derived PRD/frozen-file closure plus conservative source-code escalation;
- `full`: complete repository gate for kernel, merge closure, scheduled build, and release;
- `live`: structured human UAT evidence; never auto-passed from machine tests.

Development normally runs static plus focused. Review readiness adds affected. Kernel/release runs full. Completion remains gate evidence plus required human UAT, not model self-report.

`static` must add real PRD/state/review shape validation; merely keeping JSON schema files is insufficient because the current Gate does not load `prd.schema.json`. Implementation may use explicit deterministic validators first or add an audited schema validator dependency, but malformed/unknown schema versions fail closed.

### 10.1 Ratchet integration

The read-only reverse index is already merged and GREEN. Compose its `index`, `affected`, and `verify` results into the affected gate. Preserve `testChecksums` as the Published Language/write-side source. The index is a derived read-only projection and must not become a second mutation authority. Bulk re-sign remains a separate kernel concern and is not implied by affected discovery.

The Ratchet index covers frozen artifacts, not arbitrary implementation dependencies. Therefore affected selection is explicitly conservative:

```text
affected closure = Ratchet PRDs for changed frozen files
                 + deterministic registered source-to-PRD dependencies
                 + conservative escalation rules
```

If Ratchet returns `complete !== true`, any `issues`, or a non-empty `untracked` list, the affected gate fails closed. Until a code-to-PRD dependency map is both implemented and proven complete, any behavioral change under `lib/`, `bin/`, or `loop-kit/` escalates affected validation to `full`; an empty Ratchet PRD set is never evidence that a source change has no impact. Narrower rules may replace this only through a reviewed dependency manifest and adversarial completeness tests.

### 10.2 Cache policy

Add caching only after gate layering works without it. A cached PASS key must include implementation dependency hash, test hash, fixture hash, config hash, runtime/tool versions, and command identity. Unknown inputs force execution. Kernel and live gates do not trust cache by default. Cache never writes `passes`.

## 11. Agent scheduling

Default capacity after stabilization:

```text
1 orchestration owner
3 implementation worktrees
2 reviewer slots
1 merge owner role
```

These are logical roles, not seven worktrees. Active worktrees remain at or below guardrail #18's recommended five; reviewers use read-only access to an existing task worktree or an evidence packet and do not create a shared pool.

Scheduling rules:

- prioritize the critical path and ready nodes;
- parallelize read-only discovery and independent aggregates;
- serialize writers to one shared frozen artifact or kernel mutation entry;
- allow review of task A, build of task B, and plan of task C concurrently;
- keep the queue productive while awaiting human UAT/signing;
- preserve per-worktree baton isolation;
- use a read-only discovered readiness/dependency view, not a shared writable worktree pool;
- merge remains sequential and conflict disposition remains human-owned unless guardrail #18 is explicitly replaced by a separately reviewed decision.

The readiness view is computed from `git worktree list` and each worktree's read-only projection. It has no writable global queue file and no merge authority. Scheduling choices are recorded only through a validated `workflow-state.mjs annotate` transition event; the scheduler/orchestrator cannot edit task state directly. This avoids both a new shared truth source and a backdoor around the single transition authority.

## 12. DDD enforcement

Start with two bounded contexts rather than prematurely splitting Casey internal modules:

Before the first implementation contract, register the bilingual canonical names and owners for at least execution profile, durable workflow state, ownership lease, kernel lane, review receipt, readiness view, and fitness function in `CONTEXT.md` using its four-column format. The English proposal is the normative technical design during review; P0-1 must also produce a concise Chinese decision/supersession record and verify that its terms map to the same registered concepts. Translation must not create a second design source.

### Casey Core

Owns TestCase, authoring/compilation, replay, verdict, reporting, user-visible testing semantics, and core business invariants.

### Loop Orchestration

Owns workflow state, contracts, gates, breaker, Test Ratchet, agent adapters, worktree batons, checkpoints, and review evidence.

Add tracked assets:

```text
docs/domain/context-map.md
docs/domain/aggregates.md
docs/domain/published-language.md
loop-kit/bin/fitness.mjs
```

`risk-classify` records:

```text
boundedContext, aggregate, invariants, publishedLanguageChanges,
crossContextDependencies, mutationAuthority, forbiddenOwners
```

Plan review includes explicit DDD findings:

```text
misplaced responsibility
aggregate bypass
context leakage
duplicated domain rule
vocabulary drift
invalid Published Language dependency
```

Fitness functions should enforce at least:

- loop-kit does not import Casey Core internals;
- report does not mutate verdict;
- CLI/MCP does not implement independent verdict logic;
- only Gate writes `passes`;
- only the signing path updates frozen checksums;
- Published Language changes are made by the registered owner;
- kernel files require the kernel lane;
- cross-context dependencies use registered interfaces/schemas;
- verdict remains zero-LLM and fail-safe remains fail-closed.

These checks must match available implementation techniques. Reuse the existing dependency-closure pattern from `verdict-purity-guard` for import boundaries, extend the existing model-lane guard for family separation, and add narrow mutation-authority checks with adversarial goldens. Do not claim that term lint or a broad regex proves aggregate correctness. Rules that cannot yet be checked structurally remain explicit review obligations until a load-bearing test exists.

## 12.1 Shared loop-kit ownership

This proposal cannot treat Casey's copied `loop-kit` as the unquestioned source of a new generic kernel. Autotester's accepted ADR-0001 says the second consumer triggers extraction to an independent package; Casey's ADR-0001 instead accepted a temporary copy with manual synchronization. The real repositories now have eight shared scripts byte-identical, while Casey's `contract.mjs` has already diverged by adding worktree baton support.

Before implementing the durable engine, record and approve one distribution decision:

1. recommended bold route: extract generic engine, schemas and runner contracts into a local independent `loop-kit` package, migrate Casey first through compatibility tests, then migrate autotester without touching its unrelated dirty test data;
2. fallback route: explicitly declare a Casey-specific fork in a new ADR and stop claiming byte/shared-kernel parity.

Do not silently continue copy-paste evolution. Project-specific adapters, config, context maps and PRD instances stay in Casey; generic transition/schema/gate primitives belong to the selected loop-kit source. Cross-repository migration is a separately bounded workstream with byte/API compatibility goldens.

## 13. Planned code and document changes

State/orchestration additions:

```text
loop-kit/bin/workflow-state.mjs
loop-kit/bin/orchestrate.mjs
loop-kit/schema/workflow-state.schema.json
loop-kit/schema/review-receipt.schema.json
loop/adapters/claude-code.json
loop/adapters/codex.json
loop/adapters/pi-deepseek.json
```

State/orchestration modifications:

```text
loop-kit/bin/contract.mjs
loop-kit/bin/hook-loop-guard.mjs
loop-kit/bin/breaker.mjs
loop/config.json
bin/config-lane-guard.mjs
```

Gate modifications:

```text
loop-kit/bin/gate.mjs
loop-kit/bin/ratchet.mjs
loop/prd.schema.json
```

DDD additions/modifications:

```text
docs/domain/*
loop-kit/bin/fitness.mjs
CONTEXT.md
plan and review templates
```

Recovery/documentation modifications:

```text
docs/plans/loop-dual-profile-reform/FABLE-REVIEW-DISPOSITION.md
docs/plans/loop-orchestration-reform/NEXT-SESSION-PROPOSAL.md supersession banner
docs/plans/loop-ddd-overhaul/DESIGN.md supersession banner
docs/HANDOFF.md
docs/NEXT-SESSION.md
session-handoff skill
starter skill
CONTEXT.md bilingual term ownership entries
```

Test additions must cover the kernel directly rather than relying on current tier-1:

```text
workflow-state transition/CAS/state-write/crash-recovery goldens on supported filesystems
concurrent-writer contention and lease-release crash goldens
six-stage projection and one-way migration golden
cross-family stale-evidence and same-family rejection golden
Claude/Codex/Pi adapter protocol fixtures
direct-to-kernel auto-escalation golden
gate static/focused/affected/full composition golden
Ratchet incomplete/untracked and source-change affected fail-closed goldens
checkpoint commit-reachability, loss/recovery and worktree-lifecycle goldens
hook-advisory negative golden proving completion does not depend on hook execution
breaker progress-evidence golden
DDD boundary and mutation-authority adversarial golden
```

Do not change Casey verdict/replay/report business behavior as part of the orchestration reform unless a separately escalated contract proves it unavoidable.

## 14. Execution plan after approval

```text
P0-0  Record Steven's explicit decision reversal; mark both older reform documents SUPERSEDED and update HANDOFF/NEXT-SESSION in one documentation commit
P0-1  Close the Fable disposition, register bilingual terms, and publish the Chinese decision/supersession summary
P0-2  Freeze truthful committed B/C branch-local checkpoints, including B dirty bytes and every untracked plan artifact
P0-3  Decide loop-kit extraction versus explicit Casey fork in a new ADR; establish the selected source-of-truth boundary
P0-4a Build state schema, single transition authority, evidence manifests, one-way migration and kernel goldens under the old Loop
P0-4b Split static/focused/affected/full/live gates, add true schema validation and conservative affected escalation around the merged Ratchet
P0-5  Add executable Claude Code, Codex and Pi adapters plus strict runner-output protocol fixtures
P0-6  Enforce cross-family plan-review and implementation-review receipts, reviewer-unavailable blocking and stale-evidence invalidation
P0-7  Add committed checkpoints, manual emergency profile takeover, recovery, ownership leases and breaker progress evidence
P0-8  Add DDD assets, term ownership and load-bearing fitness-function goldens
P0-9  Self-host one small real backlog contract entirely through the new writer
P0-10 Run bidirectional profile takeover, concurrent-writer, lease-crash, session-crash and post-merge worktree-lifecycle drills
P0-11 Compare projections, freeze old contract creation, migrate active batons once, and switch contract CLI/guards in one bounded cutover
P0-12 Produce final receipts, enable auto mode only if its prerequisites pass, and retire old Workflow memory plus independent active-contract truth
```

Every implementation item from P0-4a through P0-10 is a separately accepted `kernel` contract executed under the still-active old Loop until the bounded cutover. Each contract declares its rollback, compatibility fixture, and healthy pause condition; a later item does not need to start merely because an earlier one merged. P0-4a and P0-4b may be built in isolated worktrees but are merged sequentially with full revalidation.

Required healthy pause points:

- after P0-2, B/C bytes and plans are committed and recoverable while their implementations remain frozen;
- after P0-3, ownership is decided without changing runtime behavior;
- after P0-4a, the new engine is dark/read-only and the old contract remains the sole writer;
- after P0-4b, layered gates are independently usable with conservative source escalation;
- after P0-6, structured receipts and same-family rejection may protect the old contract before state cutover;
- after P0-10, all takeover/crash evidence exists while rollback still restores untouched old batons.

P0-9 must use a real, bounded, still-unfinished Casey backlog item, not a synthetic demonstration or a self-referential change to the orchestration kernel being proven. Candidate selection happens at P0-9 intake by checking current code, tests, PRDs, audit history, and git history; a stale design/backlog row is not sufficient evidence that work remains. `countChange` selector hardening is explicitly not a candidate because `profile.countSelector` was already implemented by `wf-add-node` at `dbc0d0d` and is live in `bin/replay.mjs`. Breaker progress and `checkFingerprint` are also unsuitable first proofs because they modify the governance/gate machinery being proven. The selected item must be non-kernel, independently acceptance-testable, small enough for one contract, and permitted to exercise conservative affected escalation. The self-host proof covers plan mutation invalidation, the hash-bound red baseline, focused validation, rejection of a same-family receipt, pre-merge full validation, and zero-context recovery to the next deterministic command within five minutes.

B/C work remains deferred during P0. After P0 acceptance:

```text
P1-1 recover B through the new Loop
P1-2 recover C through the new Loop
P1-3 calculate current branch divergence at recovery time, reconcile each branch with then-current dev, and revalidate its reviewed plan
P1-4 run affected/full Ratchet closure
P1-5 merge sequentially with human conflict disposition
P1-6 complete human live UAT
```

## 15. Completion criteria

The reform is complete only when:

1. both Claude Code and Codex profiles complete a real contract;
2. plan and implementation reviews are machine-enforced as cross-family;
3. Claude-to-Codex and Codex-to-Claude takeover preserve decisions and do not repeat passed work;
4. changing a reviewed plan invalidates plan review;
5. changing reviewed implementation invalidates implementation review and downstream evidence;
6. affected gate finds all PRDs for shared frozen artifacts, fails closed on incomplete/untracked selection, and conservatively sends behavioral `lib/`, `bin/`, or `loop-kit/` changes to full validation until a proven source dependency map exists;
7. kernel files cannot pass through a lower lane;
8. DDD boundary violations are caught by executable fitness functions;
9. a terminated session resumes to the next deterministic command within five minutes;
10. old Workflow memory and `active-contract.json` no longer form competing truth sources;
11. verdict, signing, credential, frozen-protocol, and fail-safe strictness do not weaken;
12. B/C can be recovered and completed under the accepted new Loop;
13. human live UAT remains a necessary completion condition where required;
14. only the transition engine produces valid state revisions and stale/concurrent revisions fail closed;
15. worktree deletion after learn does not erase committed, ref-reachable recovery/final receipts;
16. emergency mid-node quota takeover starts a new attempt without two writers or inherited unverified success;
17. generic loop-kit ownership is resolved rather than creating another unsynchronized copy;
18. the new dedicated kernel goldens, not only legacy tier-1, pass on both consumer compatibility fixtures;
19. reviewer starvation becomes an observable blocked node plus Inbox escalation and never a same-family or timeout PASS;
20. `auto` profile switching cannot be enabled before concurrent-writer and lease-crash prerequisites pass;
21. the prior reform documents are marked superseded and no longer claim a competing active execution order.

## 16. Fable review record

Fable performed the requested read-only repository-grounded architecture review on 2026-07-13 and returned `PASS WITH REQUIRED CHANGES`. Its focused follow-up accepted the four qualifications; the subsequent Codex repository check corrected the already-shipped `countChange` self-host candidate, and Fable independently verified and accepted that correction without reservation. The cross-family review chain is closed as `ACCEPT WITH FACTUAL CORRECTION`. The complete disposition is recorded in `docs/plans/loop-dual-profile-reform/FABLE-REVIEW-DISPOSITION.md`. The review and follow-up do not authorize implementation or reopen settled scope without contrary repository evidence. The following was the review protocol and remains the checklist for any rereview after material design changes.

```text
loop-kit/bin/contract.mjs
loop-kit/bin/gate.mjs
loop-kit/bin/hook-loop-guard.mjs
loop-kit/bin/breaker.mjs
loop-kit/bin/ratchet.mjs
bin/config-lane-guard.mjs
bin/casey.mjs tier-1 composition
loop/config.json
loop/GUARDRAILS.md
CONTEXT.md
docs/adr/0001-reuse-loop-kit.md
docs/plans/loop-ddd-overhaul/DESIGN.md
docs/plans/_session-resume/bc-contracts-workflow.js
docs/plans/_session-resume/RESUME-2026-07-13.md
both B/C active-contract files and git status
/mnt/d/ctx/heren/autotester/docs/adr/0001-loop-kit-incubation.md
/mnt/d/ctx/heren/autotester/loop-kit shared implementation where cross-consumer claims are made
```

It must distinguish verified current behavior, proposed behavior, migration-only compatibility, and unsupported assumptions. Fable should challenge the proposal rather than restate it. Review at minimum:

1. Is immediate 16-node durable-state adoption justified, or is any narrower migration materially safer without recreating dual truth?
2. Does the one-kernel/two-profile design preserve cross-family independence and allow reliable quota-driven takeover?
3. Are plan-review and implementation-review evidence bindings sufficient to prevent stale approval?
4. Does the Codex profile have a credible reviewer/adjudicator route when Claude usage is unavailable and DeepSeek times out?
5. Are any proposed state writers ambiguous, especially hooks, orchestrator, contract CLI, Gate, and merge owner?
6. Does the gate/cache design contain any fail-open path?
7. Are DDD ownership and fitness functions concrete enough to prevent rule placement drift?
8. Does the plan violate guardrail #18 by accidentally creating a shared writable pool or automatic merge authority?
9. Can the migration be executed without stranding active contracts or weakening the current gate?
10. Is deferring B/C until P0 acceptance the correct priority decision, and what is the smallest self-hosting proof required before resuming them?
11. Is independent loop-kit extraction now required by the two accepted ADRs, and is the proposed extraction/fork decision sequenced correctly?
12. Are per-worktree gitignored runtime state plus tracked boundary checkpoints sufficient for merge/post-merge durability without violating guardrail #18?
13. Does the proposal honestly handle the limits of user approval provenance and local-agent write authority?
14. Are the proposed tests sufficient to replace the current untested contract/hook assumptions, given that legacy tier-1 does not cover them?

Report findings by HIGH/MED/LOW, cite exact proposal sections and repository files/lines, identify any self-review statement disproved by code, propose concrete corrections and a revised execution order, state what should be preserved, and end with one of:

```text
PASS
PASS WITH REQUIRED CHANGES
FAIL
```
