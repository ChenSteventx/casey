# Independent R1 implementation audit

- Scope: current production diff and adjacent zero-SUT suites
- Verdict: `CHANGES_REQUIRED` (`C=0 / H=2 / M=2 / L=1`)

## Accepted findings

- High: a profile declaring an identity `listApi` could reach authoring compile without an identity ledger/network watcher and silently use the legacy DOM-only branch.
- High: source runtime preparation was consumed before all namespace/target/owner checks, so a rejected claim could make the live owner impossible to dispose.
- Medium: the initial tests did not traverse the whole genuine profile authority chain.
- Medium: baseline and source closure compared labels, not the same private source-plan record, allowing a same-label distinct-plan mix in one process.

The R2 implementation adds pre-open identity/malformed refusal, verify-before-consume preparation handling, private source-plan record identity binding, and a four-case frozen boundary golden.

