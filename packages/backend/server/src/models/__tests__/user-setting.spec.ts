import { randomUUID } from 'node:crypto';
import { mock } from 'node:test';

import ava, { TestFn } from 'ava';
import { ZodError } from 'zod';

import { createTestingModule, type TestingModule } from '../../__tests__/utils';
import { Config } from '../../base/config';
import { Models, User } from '../../models';

interface Context {
  config: Config;
  module: TestingModule;
  models: Models;
}

const test = ava as TestFn<Context>;

test.before(async t => {
  const module = await createTestingModule();

  t.context.models = module.get(Models);
  t.context.config = module.get(Config);
  t.context.module = module;
  await t.context.module.initTestingDB();
});

let user: User;

test.beforeEach(async t => {
  user = await t.context.models.user.create({
    email: `test-${randomUUID()}@affine.pro`,
  });
});

test.afterEach.always(() => {
  mock.reset();
  mock.timers.reset();
});

test.after(async t => {
  await t.context.module.close();
});

test('should get a user setting with default value', async t => {
  const setting = await t.context.models.userSetting.get(user.id);
  t.is(setting.receiveInvitationEmail, true);
  t.is(setting.receiveMentionEmail, true);
});

test('should update a user setting', async t => {
  const setting = await t.context.models.userSetting.set(user.id, {
    receiveInvitationEmail: false,
  });
  t.is(setting.receiveInvitationEmail, false);
  t.is(setting.receiveMentionEmail, true);
  const setting2 = await t.context.models.userSetting.get(user.id);
  t.deepEqual(setting2, setting);

  // update existing setting
  const setting3 = await t.context.models.userSetting.set(user.id, {
    receiveInvitationEmail: true,
  });
  t.is(setting3.receiveInvitationEmail, true);
  t.is(setting3.receiveMentionEmail, true);
  const setting4 = await t.context.models.userSetting.get(user.id);
  t.deepEqual(setting4, setting3);

  const setting5 = await t.context.models.userSetting.set(user.id, {
    receiveMentionEmail: false,
    receiveInvitationEmail: false,
  });
  t.is(setting5.receiveInvitationEmail, false);
  t.is(setting5.receiveMentionEmail, false);
  const setting6 = await t.context.models.userSetting.get(user.id);
  t.deepEqual(setting6, setting5);
});

test('should throw error when update setting with invalid payload', async t => {
  await t.throwsAsync(
    t.context.models.userSetting.set(user.id, {
      // @ts-expect-error invalid setting input types
      receiveInvitationEmail: 1,
    }),
    {
      instanceOf: ZodError,
      message: /Expected boolean, received number/,
    }
  );
});
