import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import {
  Config,
  MailService,
  NotificationNotFound,
  PaginationInput,
  URLHelper,
} from '../../base';
import {
  defaultWorkspaceName,
  InvitationNotificationCreate,
  MentionNotification,
  MentionNotificationCreate,
  Models,
  NotificationType,
  UnionNotificationBody,
  Workspace,
} from '../../models';
import { DocReader } from '../doc';
import { WorkspaceBlobStorage } from '../storage';
import { generateDocPath } from '../utils/doc';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly models: Models,
    private readonly docReader: DocReader,
    private readonly workspaceBlobStorage: WorkspaceBlobStorage,
    private readonly mailer: MailService,
    private readonly url: URLHelper,
    private readonly config: Config
  ) {}

  async cleanExpiredNotifications() {
    return await this.models.notification.cleanExpiredNotifications();
  }

  async createMention(input: MentionNotificationCreate) {
    const notification = await this.models.notification.createMention(input);
    // send email in background
    this.sendMentionEmail(input).catch(err => {
      this.logger.error(
        `Failed to send mention email to user ${input.userId}`,
        err
      );
    });
    return notification;
  }

  private async sendMentionEmail(input: MentionNotificationCreate) {
    const userSetting = await this.models.userSetting.get(input.userId);
    if (userSetting.receiveMentionEmail) {
      const receiver = await this.models.user.getWorkspaceUser(input.userId);
      if (!receiver) {
        return;
      }
      const user = await this.models.user.getWorkspaceUser(
        input.body.createdByUserId
      );
      if (!user) {
        return;
      }
      const doc = await this.models.doc.getMeta(
        input.body.workspaceId,
        input.body.doc.id
      );
      const title = doc?.title ?? input.body.doc.title;
      const url = this.url.link(
        generateDocPath({
          workspaceId: input.body.workspaceId,
          docId: input.body.doc.id,
          mode: input.body.doc.mode,
          blockId: input.body.doc.blockId,
          elementId: input.body.doc.elementId,
        })
      );
      await this.mailer.sendMentionMail(receiver.email, {
        user,
        doc: {
          title,
          url,
        },
      });
    }
  }

  async createInvitation(input: InvitationNotificationCreate) {
    const isActive = await this.models.workspaceUser.getActive(
      input.body.workspaceId,
      input.userId
    );
    if (isActive) {
      this.logger.debug(
        `User ${input.userId} is already a active member of workspace ${input.body.workspaceId}, skip creating notification`
      );
      return;
    }
    await this.ensureWorkspaceContentExists(input.body.workspaceId);
    const notification = await this.models.notification.createInvitation(
      input,
      NotificationType.Invitation
    );
    this.sendInvitationEmail(input).catch(err => {
      this.logger.error(
        `Failed to send invitation email to user ${input.userId}`,
        err
      );
    });
    return notification;
  }

  private async sendInvitationEmail(input: InvitationNotificationCreate) {
    const userSetting = await this.models.userSetting.get(input.userId);
    if (!userSetting.receiveInvitationEmail) {
      return;
    }
    const receiver = await this.models.user.getWorkspaceUser(input.userId);
    if (!receiver) {
      return;
    }
    const user = await this.models.user.getWorkspaceUser(
      input.body.createdByUserId
    );
    if (!user) {
      return;
    }
    const workspace = await this.models.workspace.get(input.body.workspaceId);
    if (!workspace) {
      return;
    }
    const inviteUrl = this.url.link(`/invite/${input.body.inviteId}`);
    if (this.config.node.dev) {
      // make it easier to test in dev mode
      this.logger.debug(`Invite link: ${inviteUrl}`);
    }
    await this.mailer.sendMemberInviteMail(receiver.email, {
      user,
      workspace: this.formatWorkspaceInfo(workspace),
      url: inviteUrl,
    });
  }

  async createInvitationAccepted(input: InvitationNotificationCreate) {
    const isActive = await this.models.workspaceUser.getActive(
      input.body.workspaceId,
      input.userId
    );
    if (!isActive) {
      return;
    }
    await this.ensureWorkspaceContentExists(input.body.workspaceId);
    const notification = await this.models.notification.createInvitation(
      input,
      NotificationType.InvitationAccepted
    );
    this.sendInvitationAcceptedEmail(input).catch(err => {
      this.logger.error(
        `Failed to send invitation accepted email to user ${input.userId}`,
        err
      );
    });
    return notification;
  }

  private async sendInvitationAcceptedEmail(
    input: InvitationNotificationCreate
  ) {
    const userSetting = await this.models.userSetting.get(input.userId);
    if (!userSetting.receiveInvitationEmail) {
      return;
    }
    const receiver = await this.models.user.getWorkspaceUser(input.userId);
    if (!receiver) {
      return;
    }
    const user = await this.models.user.getWorkspaceUser(
      input.body.createdByUserId
    );
    if (!user) {
      return;
    }
    const workspace = await this.models.workspace.get(input.body.workspaceId);
    if (!workspace) {
      return;
    }
    await this.mailer.sendMemberAcceptedEmail(receiver.email, {
      user,
      workspace: this.formatWorkspaceInfo(workspace),
    });
  }

  async createInvitationBlocked(input: InvitationNotificationCreate) {
    await this.ensureWorkspaceContentExists(input.body.workspaceId);
    return await this.models.notification.createInvitation(
      input,
      NotificationType.InvitationBlocked
    );
  }

  async createInvitationRejected(input: InvitationNotificationCreate) {
    await this.ensureWorkspaceContentExists(input.body.workspaceId);
    return await this.models.notification.createInvitation(
      input,
      NotificationType.InvitationRejected
    );
  }

  private async ensureWorkspaceContentExists(workspaceId: string) {
    const workspace = await this.models.workspace.get(workspaceId);
    if (!workspace || workspace.name) {
      return;
    }
    const content = await this.docReader.getWorkspaceContent(workspaceId);
    if (!content?.name) {
      return;
    }
    await this.models.workspace.update(workspaceId, {
      name: content.name,
      avatarKey: content.avatarKey,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    try {
      await this.models.notification.markAsRead(notificationId, userId);
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        // https://www.prisma.io/docs/orm/reference/error-reference#p2025
        throw new NotificationNotFound();
      }
      throw err;
    }
  }

  /**
   * Find notifications by user id, order by createdAt desc
   */
  async findManyByUserId(userId: string, options?: PaginationInput) {
    const notifications = await this.models.notification.findManyByUserId(
      userId,
      options
    );

    // fill user info
    const userIds = new Set(notifications.map(n => n.body.createdByUserId));
    const users = await this.models.user.getPublicUsers(Array.from(userIds));
    const userInfos = new Map(users.map(u => [u.id, u]));

    // fill workspace info
    const workspaceIds = new Set(notifications.map(n => n.body.workspaceId));
    const workspaces = await this.models.workspace.findMany(
      Array.from(workspaceIds)
    );
    const workspaceInfos = new Map(
      workspaces.map(w => [w.id, this.formatWorkspaceInfo(w)])
    );

    // fill latest doc title
    const mentions = notifications.filter(
      n => n.type === NotificationType.Mention
    ) as MentionNotification[];
    const mentionDocs = await this.models.doc.findMetas(
      mentions.map(m => ({
        workspaceId: m.body.workspaceId,
        docId: m.body.doc.id,
      }))
    );
    for (const [index, mention] of mentions.entries()) {
      const doc = mentionDocs[index];
      if (doc?.title) {
        // use the latest doc title
        mention.body.doc.title = doc.title;
      }
    }

    return notifications.map(n => ({
      ...n,
      body: {
        ...(n.body as UnionNotificationBody),
        // set type to body.type to improve type inference on frontend
        type: n.type,
        workspace: workspaceInfos.get(n.body.workspaceId),
        createdByUser: userInfos.get(n.body.createdByUserId),
      },
    }));
  }

  async countByUserId(userId: string) {
    return await this.models.notification.countByUserId(userId);
  }

  private formatWorkspaceInfo(workspace: Workspace) {
    return {
      id: workspace.id,
      name: workspace.name ?? defaultWorkspaceName,
      avatarUrl: this.workspaceBlobStorage.getAvatarUrl(
        workspace.id,
        workspace.avatarKey
      ),
      url: this.url.link(`/workspace/${workspace.id}`),
    };
  }
}
