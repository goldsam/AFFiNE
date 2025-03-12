export { NotificationCountService } from './services/count';
export { NotificationListService } from './services/list';
export type { Notification, NotificationBody } from './stores/notification';
export { NotificationType } from './stores/notification';
import type { Framework } from '@toeverything/infra';

import { GraphQLService, ServerScope, ServerService } from '../cloud';
import { GlobalSessionState } from '../storage';
import { NotificationCountService } from './services/count';
import { NotificationListService } from './services/list';
import { NotificationStore } from './stores/notification';

export function configureNotificationModule(framework: Framework) {
  framework
    .scope(ServerScope)
    .service(NotificationCountService, [NotificationStore])
    .service(NotificationListService, [
      NotificationStore,
      NotificationCountService,
    ])
    .store(NotificationStore, [
      GraphQLService,
      ServerService,
      GlobalSessionState,
    ]);
}
