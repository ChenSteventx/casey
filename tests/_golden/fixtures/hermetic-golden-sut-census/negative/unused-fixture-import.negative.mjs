import { startPublishSut } from '../../../../fixtures/publish-sut/server.mjs';

export function probe() {
  return typeof startPublishSut === 'function';
}
