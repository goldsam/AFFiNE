import { app, e2e } from './test';

e2e('should create test app correctly', async t => {
  t.truthy(app);
});
