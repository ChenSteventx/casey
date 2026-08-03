# Codex final audit — R3 blocker

- Scope: read-only final blocker audit after Grok R2 approval
- Verdict: `REVIEW_CHANGES_REQUIRED`

The audit found that a legal entity-lock resign with the old entity lock present but the old expected frozen file absent produced a journal beginning with the entity archive. Recovery inferred every first entry different from the expected target as an expected archive, recovered the same entity archive twice, and failed with duplicate output paths instead of completing the same-input late-interrupt recovery.

## Resolution

- Added a separate red-first end-to-end golden for the exact missing-expected late-interrupt state; the pre-fix implementation exited 65 with the duplicate-target collision.
- Added pure journal-target classification that derives the optional expected archive slot relative to the unique expected target and optional entity revocation slot.
- Kept the recovery flag check fail-closed: a journal-bound expected archive still requires `--resign`, while absence of an archive does not reject the explicitly legal `--resign` mode.
- Re-ran the new golden and complete successor gate to green.

The same reviewer re-read the fix and returned `APPROVE` with no new blocker.
