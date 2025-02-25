import {
  getCurrentMailMessageCount,
  getLatestMailMessage,
} from '@affine-test/kit/utils/cloud';
import { PrismaClient, WorkspaceMemberStatus } from '@prisma/client';
import type { TestFn } from 'ava';
import ava from 'ava';
import Sinon from 'sinon';

import { EventBus, JobQueue } from '../base';
import { MailService } from '../base/mailer';
import { AuthService } from '../core/auth/service';
import { Models } from '../models';
import {
  acceptInviteById,
  createTestingApp,
  createWorkspace,
  getWorkspace,
  inviteUser,
  leaveWorkspace,
  revokeUser,
  TestingApp,
} from './utils';

const test = ava as TestFn<{
  app: TestingApp;
  client: PrismaClient;
  auth: AuthService;
  mail: MailService;
  models: Models;
  queue: JobQueue;
  event: Sinon.SinonStubbedInstance<EventBus>;
}>;

test.before(async t => {
  const app = await createTestingApp({
    tapModule: module => {
      module
        .overrideProvider(EventBus)
        .useValue(Sinon.createStubInstance(EventBus));
    },
  });
  t.context.app = app;
  t.context.client = app.get(PrismaClient);
  t.context.auth = app.get(AuthService);
  t.context.mail = app.get(MailService);
  t.context.models = app.get(Models);
  t.context.queue = app.get(JobQueue);
  t.context.event = app.get(EventBus);
});

test.beforeEach(async t => {
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  await t.context.app.close();
});

test('should invite a user', async t => {
  const { app, queue } = t.context;
  const u2 = await app.signup('u2@affine.pro');
  const owner = await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);

  const spy = Sinon.spy(queue, 'add');
  const invite = await inviteUser(app, workspace.id, u2.email);
  t.truthy(invite, 'failed to invite user');
  // add invitation notification job
  t.is(spy.callCount, 1);
  t.is(spy.firstCall.args[0], 'notification.sendInvitation');
  t.is(spy.firstCall.args[1].inviterId, owner.id);
  t.truthy(spy.firstCall.args[1].inviteId);
  spy.restore();
});

test('should leave a workspace', async t => {
  const { app } = t.context;
  const u2 = await app.signup('u2@affine.pro');
  await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const invite = await inviteUser(app, workspace.id, u2.email);

  app.switchUser(u2.id);
  await acceptInviteById(app, workspace.id, invite);

  const leave = await leaveWorkspace(app, workspace.id);

  t.true(leave, 'failed to leave workspace');
});

test('should revoke a user', async t => {
  const { app } = t.context;
  const u2 = await app.signup('u2@affine.pro');
  await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);
  await inviteUser(app, workspace.id, u2.email);

  const currWorkspace = await getWorkspace(app, workspace.id);
  t.is(currWorkspace.members.length, 2, 'failed to invite user');

  const revoke = await revokeUser(app, workspace.id, u2.id);
  t.true(revoke, 'failed to revoke user');
});

test('should revoke a user on under review', async t => {
  const { app, event, models } = t.context;
  const user = await app.signup();
  const owner = await app.signup();

  await app.switchUser(owner);
  const workspace = await createWorkspace(app);
  await inviteUser(app, workspace.id, user.email);
  // set user to under review
  await models.workspaceUser.setStatus(
    workspace.id,
    user.id,
    WorkspaceMemberStatus.UnderReview
  );

  const revoke = await revokeUser(app, workspace.id, user.id);
  t.true(revoke, 'failed to revoke user');
  t.truthy(event.emit.lastCall);
  t.deepEqual(
    event.emit.lastCall.args,
    [
      'workspace.members.requestDeclined',
      { userId: user.id, workspaceId: workspace.id, reviewerId: owner.id },
    ],
    'should emit request declined event'
  );
});

test('should create user if not exist', async t => {
  const { app, models } = t.context;
  await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);

  await inviteUser(app, workspace.id, 'u2@affine.pro');

  const u2 = await models.user.getUserByEmail('u2@affine.pro');
  t.not(u2, undefined, 'failed to create user');
  t.is(u2?.name, 'u2', 'failed to create user');
});

test('should invite a user by link', async t => {
  const { app } = t.context;
  const u2 = await app.signup('u2@affine.pro');
  const u1 = await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);

  const invite = await inviteUser(app, workspace.id, u2.email);

  app.switchUser(u2.id);
  const accept = await acceptInviteById(app, workspace.id, invite);
  t.true(accept, 'failed to accept invite');

  app.switchUser(u1.id);
  const invite1 = await inviteUser(app, workspace.id, u2.email);

  t.is(invite, invite1, 'repeat the invitation must return same id');

  const currWorkspace = await getWorkspace(app, workspace.id);
  const currMember = currWorkspace.members.find(u => u.email === u2.email);
  t.not(currMember, undefined, 'failed to invite user');
  t.is(currMember?.inviteId, invite, 'failed to check invite id');
});

test('should send email and notification', async t => {
  const { mail, app, queue } = t.context;
  const u2 = await app.signup('u2@affine.pro');
  const owner = await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const spy = Sinon.spy(queue, 'add');
  let primitiveMailCount = 0;
  if (mail.hasConfigured()) {
    primitiveMailCount = await getCurrentMailMessageCount();
  }

  const invite = await inviteUser(app, workspace.id, u2.email, true);
  t.truthy(invite, 'failed to invite user');
  t.is(spy.callCount, 1);
  t.is(spy.firstCall.args[0], 'notification.sendInvitation');
  t.is(spy.firstCall.args[1].inviterId, owner.id);
  t.truthy(spy.firstCall.args[1].inviteId);

  if (mail.hasConfigured()) {
    primitiveMailCount++;
    const afterInviteMailCount = await getCurrentMailMessageCount();
    t.is(
      primitiveMailCount,
      afterInviteMailCount,
      'failed to send invite email'
    );
    const inviteEmailContent = await getLatestMailMessage();

    t.not(
      inviteEmailContent.To.find((item: any) => {
        return item.Mailbox === 'u2';
      }),
      undefined,
      'invite email address was incorrectly sent'
    );
  }

  app.switchUser(u2.id);
  const accept = await acceptInviteById(app, workspace.id, invite, true);
  t.true(accept, 'failed to accept invite');
  t.is(spy.callCount, 2);
  t.is(spy.secondCall.args[0], 'notification.sendInvitationAccepted');
  t.is(spy.secondCall.args[1].inviterId, owner.id);
  t.is(spy.secondCall.args[1].inviteId, invite);

  if (mail.hasConfigured()) {
    primitiveMailCount++;
    const afterAcceptMailCount = await getCurrentMailMessageCount();
    t.is(
      primitiveMailCount,
      afterAcceptMailCount,
      'failed to send accepted email to owner'
    );
    const acceptEmailContent = await getLatestMailMessage();
    t.not(
      acceptEmailContent.To.find((item: any) => {
        return item.Mailbox === 'u1';
      }),
      undefined,
      'accept email address was incorrectly sent'
    );
  }

  await leaveWorkspace(app, workspace.id, true);

  // TODO(@darkskygit): enable this after cluster event system is ready
  // const afterLeaveMailCount = await getCurrentMailMessageCount();
  // t.is(
  //   afterAcceptMailCount + 1,
  //   afterLeaveMailCount,
  //   'failed to send leave email to owner'
  // );
  if (mail.hasConfigured()) {
    const leaveEmailContent = await getLatestMailMessage();
    t.not(
      leaveEmailContent.To.find((item: any) => {
        return item.Mailbox === 'u1';
      }),
      undefined,
      'leave email address was incorrectly sent'
    );
  }
  spy.restore();
});

test('should support pagination for member', async t => {
  const { app } = t.context;
  await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);
  await inviteUser(app, workspace.id, 'u2@affine.pro');
  await inviteUser(app, workspace.id, 'u3@affine.pro');

  const firstPageWorkspace = await getWorkspace(app, workspace.id, 0, 2);
  t.is(firstPageWorkspace.members.length, 2, 'failed to check invite id');
  const secondPageWorkspace = await getWorkspace(app, workspace.id, 2, 2);
  t.is(secondPageWorkspace.members.length, 1, 'failed to check invite id');
});

test('should limit member count correctly', async t => {
  const { app } = t.context;
  await app.signup('u1@affine.pro');

  const workspace = await createWorkspace(app);
  await Promise.allSettled(
    Array.from({ length: 10 }).map(async (_, i) =>
      inviteUser(app, workspace.id, `u${i}@affine.pro`)
    )
  );
  const ws = await getWorkspace(app, workspace.id);
  t.assert(ws.members.length <= 3, 'failed to check member list');
});
