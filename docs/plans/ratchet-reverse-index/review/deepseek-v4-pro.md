# DeepSeek v4 Pro review

## Verdict

PASS. No HIGH or MED correctness, fail-open, write-authority, or DDD boundary issue remains.

## Review history

- Reviewer: `pi.dev` 0.80.3 with `deepseek/deepseek-v4-pro`.
- Round 1 found one MED implementation issue: `buildRatchetIndex` did not reject an existing frozen-file symlink whose real target escaped the repository root.
- The fix moved `realpath` containment into index construction. Unsafe references now produce `FILE_OUTSIDE_ROOT`, are excluded from the trusted mapping, and make `affected.complete` false.
- Round 2 returned formal PASS after reviewing the compact fix-and-evidence packet.
- Two tool-reading, high/medium-thinking attempts exceeded the 30-second provider window. A minimal health probe returned `OK`, and the compact evidence-only review then completed. This is provider latency, not a Pi model-registration failure.

## Evidence

- Frozen golden: 8/8 GREEN.
- Manual index-level symlink containment probe: GREEN.
- Wrong-root fail-closed probe: GREEN.
- Full main-tree verification: 67 PRDs, 102 frozen files, 0 issues.
- Contract gate: 2/2 GREEN, including Casey tier-1 selftest.

## Residual risk

The symlink case is covered by a manual adversarial probe rather than a new assertion in the already-frozen golden. Changing that golden would require an explicit human re-signing decision under ADR-0004. The implementation is independently covered by the full gate and v4 Pro review; test-ratchet discipline is not bypassed to improve the test in place.
