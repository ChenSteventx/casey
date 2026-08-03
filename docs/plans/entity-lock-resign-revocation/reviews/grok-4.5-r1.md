# Grok 4.5 review — R1

- Scope: whole-repository review of `entity-lock-resign-revocation`
- Mode: read-only, inline repository access, no subagents, no web search
- Verdict: `REVIEW_CHANGES_REQUIRED`

## Findings

1. Expected-artifact and entity-lock recovery duplicated bounded archive scanning.
2. `sign.mjs` scattered the dual-flag and recovery-mode boolean matrix.
3. Revocation recovery reconstructed the prior JSONL prefix with `split`/`pop` and fabricated a PRD-shaped object.
4. `publicationEntryForPath` lived in the entity-lock module instead of the publication layer.
5. Entity-lock re-sign shadowed the canonical frozen-lock validator with a weaker local validator.
6. Acceptance lacked direct nails for revocation forks and pre-existing archive collisions.

## Resolution

- Extracted shared bounded, no-follow archive recovery in `lib/sign-resign-recovery.mjs`.
- Centralized the pure sign/re-sign mode matrix in `lib/sign-resign-surface.mjs`.
- Made recovery byte-preserving and routed it through the explicit verified builder boundary.
- Moved `publicationEntryForPath` to `lib/sign-publication.mjs`.
- Exported and reused `validateFrozenEntityLockArtifact` as the canonical validator.
- Added frozen hardening acceptance for the mode matrix, fork/duplicate rejection, and archive anti-clobber.

This round is intentionally recorded as non-approving. Approval requires a separate R2 review after the fixes.
