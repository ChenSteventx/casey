export async function probe() {
  const { startPublishSut: launchFixture } = await import('../../../../fixtures/publish-sut/server.mjs');
  const server = await launchFixture({ scenario: 'happy' });
  await server.close();
}
