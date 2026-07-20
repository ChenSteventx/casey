import { bootFixture } from './reexport-helper.inc.mjs';

export async function probe() {
  const server = await bootFixture({});
  await server.close();
}
