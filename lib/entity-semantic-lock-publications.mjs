// Hand-published semantic-lock trust anchors.
//
// These digests are executable-code inputs, not workspace PRD data. A caller
// may select one published contract/key pair, but cannot publish a new pair by
// writing a PRD beside a lock file. Real release signing/launcher provenance is
// deliberately still route:human; absence from this table is fail-closed.

// No real release resource or signed manifest has been published yet. Test
// fixtures are deliberately absent: a frozen test digest is not production
// provenance. A real entry must arrive with its own real-SUT publication gate.
const publications = {};

for (const publication of Object.values(publications)) {
  Object.freeze(publication.locks);
  if (publication.actionPolicy) Object.freeze(publication.actionPolicy);
  if (publication.healthProof) Object.freeze(publication.healthProof);
  Object.freeze(publication);
}

export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = Object.freeze(publications);
