import { createServer as makeServer } from 'node:http';

export async function probe() {
  const server = makeServer(() => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.close();
}
