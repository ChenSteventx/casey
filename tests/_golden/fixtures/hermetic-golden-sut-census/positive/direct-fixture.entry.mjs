import { startFakeSut as beginFixture } from '../../../../fixtures/fake-sut/server.mjs';

export async function probe() {
  const server = await beginFixture({ scenario: 'happy' });
  await server.close();
}
