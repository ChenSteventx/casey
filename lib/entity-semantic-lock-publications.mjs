// Hand-published semantic-lock trust anchors.
//
// These digests are executable-code inputs, not workspace PRD data. A caller
// may select one published contract/key pair, but cannot publish a new pair by
// writing a PRD beside a lock file. Real release signing/launcher provenance is
// deliberately still route:human; absence from this table is fail-closed.

const publications = {
  'teachin-semantic-lock-capability-hardening': {
    locks: {
      'tests/_golden/fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json':
        '027296d2b2bcafc12b69c40891bb4b89c70f04051f9ac77a9e89251a918c020c',
    },
  },
  'teachin-semantic-lock-runtime-authority': {
    actionPolicy: {
      key: 'tests/_golden/fixtures/teachin-semantic-lock-runtime-authority/entity-action-policy.frozen.json',
      sha256: '74f3d362045a4cf0db77a560b218232942280055dbd942beab2728ba2b32955f',
    },
    locks: {
      'tests/_golden/fixtures/teachin-semantic-lock-runtime-authority/relation-source-only.locks.json':
        '4440ebfba3bf214e04718899c9f13bd22c89f27db69da0ca23dc8b1d18418c86',
      'tests/_golden/fixtures/teachin-semantic-lock-runtime-authority/relation-target-only.locks.json':
        '28d771f1801886b8a5a016eb6a3ff4afb4391d9e206d41defc05fbf4ba151b08',
      'tests/_golden/fixtures/teachin-semantic-lock-runtime-authority/mutation-empty.locks.json':
        '290a8485016688ed68273e2995511318f66422c27c17c4c72dae61168d9ba6f6',
      'tests/_golden/fixtures/teachin-semantic-lock-runtime-authority/unknown-role.locks.json':
        '09d50ac939a62c711ac050d2a07e3378f97a9459121daabe13a7168fe170bb14',
    },
  },
};

for (const publication of Object.values(publications)) {
  Object.freeze(publication.locks);
  if (publication.actionPolicy) Object.freeze(publication.actionPolicy);
  Object.freeze(publication);
}

export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = Object.freeze(publications);
