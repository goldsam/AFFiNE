import test, { registerCompletionHandler } from 'ava';

export const e2e = test;
// @ts-expect-error created in prelude.ts
export const app = globalThis.app;

registerCompletionHandler(() => {
  app.close();
});
