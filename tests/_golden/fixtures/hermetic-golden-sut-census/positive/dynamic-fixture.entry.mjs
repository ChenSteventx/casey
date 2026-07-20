export async function probe() {
  const fixtureModule = await import('../../../../fixtures/chat-sut/server.mjs');
  const launch = fixtureModule.startChatSut;
  const server = await launch({ scenario: 'happy' });
  await server.close();
}
