export async function waitUntil(
  condition: () => Promise<boolean> | boolean,
  timeoutMs = 30000,
  intervalMs = 100,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await condition()) return;
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`waitUntil: condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
