import { Avatar, IconButton, Scrollable, Skeleton } from '@affine/component';
import {
  type Notification,
  NotificationListService,
  NotificationType,
} from '@affine/core/modules/notification';
import { UserFriendlyError } from '@affine/error';
import type { MentionNotificationBodyType } from '@affine/graphql';
import { i18nTime, Trans, useI18n } from '@affine/i18n';
import { DeleteIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo } from 'react';

import * as styles from './list.style.css';

export const NotificationList = () => {
  const t = useI18n();
  const notificationListService = useService(NotificationListService);
  const notifications = useLiveData(notificationListService.notifications$);
  const isLoading = useLiveData(notificationListService.isLoading$);
  const error = useLiveData(notificationListService.error$);

  const userFriendlyError = useMemo(() => {
    return error && UserFriendlyError.fromAny(error);
  }, [error]);

  useEffect(() => {
    // reset the notification list when the component is mounted
    notificationListService.reset();
    notificationListService.loadMore();
  }, [notificationListService]);

  const handleScrollEnd = useCallback(() => {
    notificationListService.loadMore();
  }, [notificationListService]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 1) {
        handleScrollEnd();
      }
    },
    [handleScrollEnd]
  );

  return (
    <Scrollable.Root>
      <Scrollable.Viewport
        className={styles.containerScrollViewport}
        onScroll={handleScroll}
      >
        {notifications.length > 0 ? (
          <ul className={styles.itemList}>
            {notifications.map(notification => (
              <li key={notification.id}>
                <NotificationItem notification={notification} />
              </li>
            ))}
            {userFriendlyError && (
              <div className={styles.error}>{userFriendlyError.message}</div>
            )}
          </ul>
        ) : isLoading ? (
          <NotificationItemSkeleton />
        ) : userFriendlyError ? (
          <div className={styles.error}>{userFriendlyError.message}</div>
        ) : (
          <div className={styles.listEmpty}>
            {t['com.affine.notification.empty']()}
          </div>
        )}
      </Scrollable.Viewport>
      <Scrollable.Scrollbar />
    </Scrollable.Root>
  );
};

const NotificationItemSkeleton = () => {
  return Array.from({ length: 3 }).map((_, i) => (
    // oxlint-disable-next-line no-array-index-key
    <div key={i} className={styles.itemContainer} data-disabled="true">
      <Skeleton variant="circular" width={22} height={22} />
      <div className={styles.itemMain}>
        <Skeleton variant="text" width={150} />
        <div className={styles.itemDate}>
          <Skeleton variant="text" width={100} />
        </div>
      </div>
    </div>
  ));
};

const NotificationItem = ({ notification }: { notification: Notification }) => {
  const notificationListService = useService(NotificationListService);
  const t = useI18n();
  const type = notification.type;

  const handleDelete = useCallback(() => {
    notificationListService.readNotification(notification.id).catch(err => {
      console.error(err);
    });
  }, [notificationListService, notification.id]);

  return (
    <div className={styles.itemContainer}>
      {type === NotificationType.Mention ? (
        <MentionNotificationItem notification={notification} />
      ) : (
        <>
          <Avatar size={22} />
          <div className={styles.itemNotSupported}>
            {t['com.affine.notification.unsupported']()} ({type})
          </div>
        </>
      )}
      <IconButton
        size={16}
        className={styles.itemDeleteButton}
        icon={<DeleteIcon />}
        onClick={handleDelete}
      />
    </div>
  );
};

const MentionNotificationItem = ({
  notification,
}: {
  notification: Notification;
}) => {
  const t = useI18n();
  const body = notification.body as MentionNotificationBodyType;
  const memberInactived = !body.createdByUser;
  const username =
    body.createdByUser?.name ?? t['com.affine.inactive-member']();
  return (
    <>
      <Avatar
        size={22}
        name={body.createdByUser?.name}
        url={body.createdByUser?.avatarUrl}
      />
      <div className={styles.itemMain}>
        <span>
          <Trans
            i18nKey={'com.affine.notification.mention'}
            components={{
              1: (
                <b
                  className={styles.itemNameLabel}
                  data-inactived={memberInactived}
                />
              ),
              2: <b className={styles.itemNameLabel} />,
            }}
            values={{
              username: username,
              docTitle: body.doc.title ?? t['Untitled'](),
            }}
          />
        </span>
        <div className={styles.itemDate}>
          {i18nTime(notification.createdAt, {
            relative: true,
          })}
        </div>
      </div>
    </>
  );
};
