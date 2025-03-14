import { createApp } from './create-app';

// @ts-expect-error testing
globalThis.app = await createApp();
