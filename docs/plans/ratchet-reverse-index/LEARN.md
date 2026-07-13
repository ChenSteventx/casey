# ratchet-reverse-index learn

## DDD fallback

- Ownership stays in the generic `loop-kit` orchestration context. Casey core does not import or depend on the reverse index.
- Existing PRD `testChecksums` remains the Published Language and single write-side source. The reverse index is a derived, read-only query projection.
- Only `gate.mjs` may write `passes`; only the existing signing flow may update frozen checksums. This tool has no file-write import and cannot self-authorize either action.
- Any future persisted index, automatic re-signing, gate integration, or state-machine migration is a separate kernel contract and must not be smuggled into this light lane.
- Missing, malformed, inconsistent, unreadable, or escaped inputs make the result incomplete or RED. Empty discovery is not success.

## Pi orchestration

- Prefer `deepseek-v4-pro` for compact final review packets.
- Locally reduce spec, diff, and gate evidence before model invocation; avoid asking the model to rediscover the entire repository when a bounded review is sufficient.
- On timeout, retry once with a shorter evidence-only prompt and lower thinking. Use a minimal health probe to distinguish endpoint failure from request latency.
- Do not stall the loop indefinitely on one reviewer. Preserve the failed attempts, use the configured fallback reviewer when necessary, and keep the final trust asymmetry explicit.
