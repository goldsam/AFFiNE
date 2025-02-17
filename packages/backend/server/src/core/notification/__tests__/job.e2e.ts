import test from 'ava';
import Sinon from 'sinon';

import {
  createTestingApp,
  createWorkspace,
  inviteUser,
  TestingApp,
} from '../../../__tests__/utils';
import { JobQueue } from '../../../base';

let app: TestingApp;
let queue: JobQueue;

test.before(async () => {
  app = await createTestingApp();
  queue = app.get(JobQueue);
});

test.afterEach.always(() => {
  Sinon.restore();
});

test.after.always(async () => {
  await app.close();
});

test('should add job to send invitation notification when user is invited to a workspace', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const spy = Sinon.spy(queue, 'add');
  await inviteUser(app, workspace.id, member.email);
  t.is(spy.callCount, 1);
  t.is(spy.firstCall.args[0], 'notification.sendInvitation');
  t.is(spy.firstCall.args[1].inviterId, owner.id);
  t.truthy(spy.firstCall.args[1].inviteId);
});
