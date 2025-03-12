import type {
  UpdateUserSettingInput,
  UserSettingType,
} from '../../core/user/types';
import type { TestingApp } from './testing-app';

export async function getUserSetting(
  app: TestingApp
): Promise<UserSettingType> {
  const res = await app.gql(
    `
    query userSetting {
      currentUser {
        setting {
          receiveInvitationEmail
          receiveMentionEmail
        }
      }
    }
    `
  );
  return res.currentUser.setting;
}

export async function updateUserSetting(
  app: TestingApp,
  input: UpdateUserSettingInput
): Promise<boolean> {
  const res = await app.gql(
    `
    mutation updateUserSetting($input: UpdateUserSettingInput!) {
      updateUserSetting(input: $input)
    }
    `,
    { input }
  );
  return res.updateUserSetting;
}
