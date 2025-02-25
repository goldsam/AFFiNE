import test from 'ava';
import Sinon from 'sinon';

import {
  acceptInviteById,
  approveMember,
  createInviteLink,
  createTestingApp,
  createWorkspace,
  inviteUser,
  revokeUser,
  sleep,
  TestingApp,
} from '../../../__tests__/utils';
import { JobQueue } from '../../../base';

let app: TestingApp;
let queue: JobQueue;

test.before(async () => {
  app = await createTestingApp();
  queue = app.get(JobQueue);
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

  spy.restore();
});

test('should add job to send invitation accepted notification when user accepts the invitation', async t => {
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

  const inviteId = spy.firstCall.args[1].inviteId;
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);
  t.is(spy.callCount, 2);
  t.is(spy.secondCall.args[0], 'notification.sendInvitationAccepted');
  t.is(spy.secondCall.args[1].inviteId, inviteId);

  spy.restore();
});

test('should add job to send invitation review requested notification when user requests to join a workspace', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const spy = Sinon.spy(queue, 'add');
  const { link } = await createInviteLink(app, workspace.id, 'OneDay');
  const inviteId = link.split('/').pop()!;
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);
  // wait for async event emit
  await sleep(10);
  t.is(spy.callCount, 1);
  t.is(spy.firstCall.args[0], 'notification.sendInvitationReviewRequested');
  t.is(spy.firstCall.args[1].reviewerId, owner.id);
  t.truthy(spy.firstCall.args[1].inviteId);

  spy.restore();
});

test('should add job to send invitation review approved notification when user approves the invitation', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const spy = Sinon.spy(queue, 'add');
  const { link } = await createInviteLink(app, workspace.id, 'OneDay');
  const inviteId = link.split('/').pop()!;
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);
  // wait for async event emit
  await sleep(10);
  t.is(spy.callCount, 1);
  t.is(spy.firstCall.args[0], 'notification.sendInvitationReviewRequested');
  t.is(spy.firstCall.args[1].reviewerId, owner.id);
  t.truthy(spy.firstCall.args[1].inviteId);

  await app.switchUser(owner);
  await approveMember(app, workspace.id, member.id);
  t.is(spy.callCount, 2);
  t.is(spy.secondCall.args[0], 'notification.sendInvitationReviewApproved');
  t.is(spy.secondCall.args[1].reviewerId, owner.id);
  t.truthy(spy.secondCall.args[1].inviteId);

  spy.restore();
});

test('should add job to send invitation review declined notification when user declines the invitation', async t => {
  const member = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  const spy = Sinon.spy(queue, 'add');
  const { link } = await createInviteLink(app, workspace.id, 'OneDay');
  const inviteId = link.split('/').pop()!;
  await app.switchUser(member);
  await acceptInviteById(app, workspace.id, inviteId);
  // wait for async event emit
  await sleep(10);
  t.is(spy.callCount, 1);
  t.is(spy.firstCall.args[0], 'notification.sendInvitationReviewRequested');
  t.is(spy.firstCall.args[1].reviewerId, owner.id);
  t.truthy(spy.firstCall.args[1].inviteId);

  await app.switchUser(owner);
  await revokeUser(app, workspace.id, member.id);
  t.is(spy.callCount, 2);
  t.is(spy.secondCall.args[0], 'notification.sendInvitationReviewDeclined');
  t.is(spy.secondCall.args[1].reviewerId, owner.id);
  t.is(spy.secondCall.args[1].userId, member.id);
  t.is(spy.secondCall.args[1].workspaceId, workspace.id);

  spy.restore();
});
