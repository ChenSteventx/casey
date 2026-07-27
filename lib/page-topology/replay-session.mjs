import {
  createActivePageFacade,
  createPageTopologyController,
} from './controller.mjs';
import { createSessionSeedAuthority } from './session-seed.mjs';

function denied(reason) {
  return Object.freeze({ ok: false, reason });
}

export async function captureReplaySessionSeed(page) {
  if (!page || typeof page.evaluate !== 'function') {
    return denied('SESSION_SEED_CAPTURE_FAILED');
  }
  let snapshot;
  try {
    snapshot = await page.evaluate(() => {
      const entries = [];
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        entries.push([key, sessionStorage.getItem(key)]);
      }
      return { origin: location.origin, entries };
    });
  } catch {
    return denied('SESSION_SEED_CAPTURE_FAILED');
  }
  if (!snapshot || typeof snapshot.origin !== 'string'
    || !Array.isArray(snapshot.entries)) {
    return denied('SESSION_SEED_CAPTURE_FAILED');
  }
  return Object.freeze({
    ok: true,
    reason: null,
    snapshot,
  });
}

export async function installReplaySessionSeedBeforeNavigation(page, snapshot) {
  if (!page || typeof page.addInitScript !== 'function'
    || !snapshot || typeof snapshot.origin !== 'string'
    || !Array.isArray(snapshot.entries)) {
    return denied('SESSION_SEED_INSTALL_FAILED');
  }
  try {
    await page.addInitScript(({ origin, entries }) => {
      if (location.origin !== origin) return;
      for (const [key, value] of entries) sessionStorage.setItem(key, value);
    }, snapshot);
  } catch {
    return denied('SESSION_SEED_INSTALL_FAILED');
  }
  return Object.freeze({ ok: true, reason: null });
}

export async function openReplayTopology({
  context,
  initialPage,
  seedSnapshot,
  attachForensics,
} = {}) {
  let sessionSeedAuthority;
  if (seedSnapshot) {
    const seed = createSessionSeedAuthority(seedSnapshot);
    if (!seed.ok) return denied(seed.reason);
    sessionSeedAuthority = seed.authority;
  }
  let pageSequence = 0;
  const created = await createPageTopologyController({
    context,
    initialPage,
    ...(sessionSeedAuthority ? { sessionSeedAuthority } : {}),
    attachForensics,
    idFactory: () => {
      pageSequence += 1;
      return `page_${pageSequence}`;
    },
  });
  if (!created.ok) return denied(created.reason);
  const active = createActivePageFacade(created.controller);
  if (!active.ok) return active;
  return Object.freeze({
    ok: true,
    reason: null,
    controller: created.controller,
    activePage: active.page,
  });
}
