import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import z from 'zod';

import { BaseModel } from './base';

export const UserSettingSchema = z.object({
  receiveInvitationEmail: z.boolean().default(true),
  receiveMentionEmail: z.boolean().default(true),
});

export type UserSettingInput = z.input<typeof UserSettingSchema>;
export type UserSetting = z.infer<typeof UserSettingSchema>;

/**
 * User Setting Model
 */
@Injectable()
export class UserSettingModel extends BaseModel {
  @Transactional()
  async set(userId: string, setting: UserSettingInput) {
    const existsSetting = await this.get(userId);
    const payload = UserSettingSchema.parse({
      ...existsSetting,
      ...setting,
    });
    await this.db.userSetting.upsert({
      where: {
        userId,
      },
      update: {
        payload,
      },
      create: {
        userId,
        payload,
      },
    });
    this.logger.log(`User setting updated for user ${userId}`);
    return payload;
  }

  async get(userId: string): Promise<UserSetting> {
    const row = await this.db.userSetting.findUnique({
      where: {
        userId,
      },
    });
    return UserSettingSchema.parse(row?.payload ?? {});
  }
}
