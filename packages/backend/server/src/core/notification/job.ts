import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { JobQueue, OnJob } from '../../base';
import { Models } from '../../models';
import { NotificationService } from './service';

declare global {
  interface Jobs {
    'nightly.cleanExpiredNotifications': {};
    'notification.sendInvitation': {
      inviterId: string;
      inviteId: string;
    };
    'notification.sendInvitationAccepted': {
      inviterId: string;
      inviteId: string;
    };
  }
}

@Injectable()
export class NotificationJob {
  constructor(
    private readonly models: Models,
    private readonly service: NotificationService,
    private readonly queue: JobQueue
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async nightlyJob() {
    await this.queue.add(
      'nightly.cleanExpiredNotifications',
      {},
      {
        jobId: 'nightly-notification-clean-expired',
      }
    );
  }

  @OnJob('nightly.cleanExpiredNotifications')
  async cleanExpiredNotifications() {
    await this.service.cleanExpiredNotifications();
  }

  @OnJob('notification.sendInvitation')
  async sendInvitation({
    inviterId,
    inviteId,
  }: Jobs['notification.sendInvitation']) {
    const invite = await this.models.workspaceUser.getById(inviteId);
    if (!invite) {
      return;
    }
    await this.service.createInvitation({
      userId: invite.userId,
      body: {
        workspaceId: invite.workspaceId,
        createdByUserId: inviterId,
        inviteId,
      },
    });
  }

  @OnJob('notification.sendInvitationAccepted')
  async sendInvitationAccepted({
    inviterId,
    inviteId,
  }: Jobs['notification.sendInvitationAccepted']) {
    const invite = await this.models.workspaceUser.getById(inviteId);
    if (!invite) {
      return;
    }
    await this.service.createInvitationAccepted({
      userId: inviterId,
      body: {
        workspaceId: invite.workspaceId,
        createdByUserId: invite.userId,
        inviteId,
      },
    });
  }
}
