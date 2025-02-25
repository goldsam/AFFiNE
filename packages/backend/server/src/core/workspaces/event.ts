import { Injectable } from '@nestjs/common';

import { OnEvent } from '../../base';
import { Models } from '../../models';
import { WorkspaceService } from './resolvers/service';

@Injectable()
export class WorkspaceEvents {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly models: Models
  ) {}

  @OnEvent('workspace.members.reviewRequested')
  async onReviewRequested({
    inviteId,
  }: Events['workspace.members.reviewRequested']) {
    // send review request notification and mail to owner and admin
    await this.workspaceService.sendReviewRequestedNotification(inviteId);
  }

  @OnEvent('workspace.members.requestApproved')
  async onApproveRequest({
    inviteId,
    reviewerId,
  }: Events['workspace.members.requestApproved']) {
    // send approve notification and mail to invitee
    await this.workspaceService.sendReviewApprovedNotification(
      inviteId,
      reviewerId
    );
  }

  @OnEvent('workspace.members.requestDeclined')
  async onDeclineRequest({
    userId,
    workspaceId,
    reviewerId,
  }: Events['workspace.members.requestDeclined']) {
    // send decline notification and mail to invitee
    await this.workspaceService.sendReviewDeclinedNotification(
      userId,
      workspaceId,
      reviewerId
    );
  }

  @OnEvent('workspace.members.roleChanged')
  async onRoleChanged({
    userId,
    workspaceId,
    role,
  }: Events['workspace.members.roleChanged']) {
    // send role changed mail
    await this.workspaceService.sendRoleChangedEmail(userId, {
      id: workspaceId,
      role,
    });
  }

  @OnEvent('workspace.owner.changed')
  async onOwnerTransferred({
    workspaceId,
    from,
    to,
  }: Events['workspace.owner.changed']) {
    // send ownership transferred mail
    const fromUser = await this.models.user.getWorkspaceUser(from);
    const toUser = await this.models.user.getWorkspaceUser(to);

    if (fromUser) {
      await this.workspaceService.sendOwnershipTransferredEmail(
        fromUser.email,
        {
          id: workspaceId,
        }
      );
    }

    if (toUser) {
      await this.workspaceService.sendOwnershipReceivedEmail(toUser.email, {
        id: workspaceId,
      });
    }
  }
}
