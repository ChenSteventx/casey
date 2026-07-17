// Hand-published runtime authority bundles.
//
// A bundle is executable-code input. A real entry must bind one rootId,
// contractId, adapterId and issuerId to concrete driver/issuer functions; its
// matching publication and frozen health proof live in the semantic-lock
// publication table. Test bundles are installed only in isolated module copies.
const bundles = {};

for (const bundle of Object.values(bundles)) {
  Object.freeze(bundle.driver);
  Object.freeze(bundle.issuer);
  Object.freeze(bundle);
}

export const ENTITY_RUNTIME_AUTHORITY_BUNDLES = Object.freeze(bundles);
