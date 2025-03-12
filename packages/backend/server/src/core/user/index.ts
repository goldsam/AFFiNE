import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { StorageModule } from '../storage';
import { UserAvatarController } from './controller';
import { UserEventsListener } from './event';
import {
  UserManagementResolver,
  UserResolver,
  UserSettingResolver,
} from './resolver';

@Module({
  imports: [StorageModule, PermissionModule],
  providers: [
    UserResolver,
    UserManagementResolver,
    UserEventsListener,
    UserSettingResolver,
  ],
  controllers: [UserAvatarController],
})
export class UserModule {}

export { PublicUserType, UserType, WorkspaceUserType } from './types';
