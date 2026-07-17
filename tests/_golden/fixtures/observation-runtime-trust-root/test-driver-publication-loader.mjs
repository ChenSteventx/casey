// TEST-ONLY ESM redirect: isolates frozen fixture key from the production registry.
const productionRegistry = new URL('../../../../lib/teachin-observation-driver-registry.mjs', import.meta.url).href;
const testPublication = new URL('./test-driver-publication.mjs', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  if (resolved.url === productionRegistry) return { url: testPublication, shortCircuit: true };
  return resolved;
}

