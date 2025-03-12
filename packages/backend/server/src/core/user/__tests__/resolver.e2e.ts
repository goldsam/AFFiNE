import test from 'ava';

import {
  createTestingApp,
  getUserSetting,
  TestingApp,
  updateUserSetting,
} from '../../../__tests__/utils';

let app: TestingApp;

test.before(async () => {
  app = await createTestingApp();
});

test.after.always(async () => {
  await app.close();
});

test('should get user setting', async t => {
  await app.signup();
  const setting = await getUserSetting(app);
  t.deepEqual(setting, {
    receiveInvitationEmail: true,
    receiveMentionEmail: true,
  });
});

test('should update user setting', async t => {
  await app.signup();
  await updateUserSetting(app, {
    receiveInvitationEmail: false,
    receiveMentionEmail: false,
  });
  const setting = await getUserSetting(app);
  t.deepEqual(setting, {
    receiveInvitationEmail: false,
    receiveMentionEmail: false,
  });

  await updateUserSetting(app, {
    receiveMentionEmail: true,
  });
  const setting2 = await getUserSetting(app);
  t.deepEqual(setting2, {
    receiveInvitationEmail: false,
    receiveMentionEmail: true,
  });

  await updateUserSetting(app, {
    // ignore undefined value
    receiveInvitationEmail: undefined,
  });
  const setting3 = await getUserSetting(app);
  t.deepEqual(setting3, {
    receiveInvitationEmail: false,
    receiveMentionEmail: true,
  });
});

test('should throw error when update user setting with invalid input', async t => {
  await app.signup();
  await t.throwsAsync(
    updateUserSetting(app, {
      receiveInvitationEmail: false,
      // @ts-expect-error invalid value
      receiveMentionEmail: null,
    }),
    {
      message: /Expected boolean, received null/,
    }
  );
});

test('should not update user setting when not logged in', async t => {
  await app.logout();
  await t.throwsAsync(
    updateUserSetting(app, {
      receiveInvitationEmail: false,
      receiveMentionEmail: false,
    }),
    {
      message: 'You must sign in first to access this resource.',
    }
  );
});
