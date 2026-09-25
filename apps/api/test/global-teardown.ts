export default async function teardown(): Promise<void> {
  const containers = (globalThis as { __containers?: { stop(): Promise<unknown> }[] }).__containers ?? [];
  for (const c of containers) await c.stop();
}
