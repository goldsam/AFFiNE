import { LiveData, Store } from '@toeverything/infra';

import { AuthService, type WorkspaceServerService } from '../../cloud';
import type { WorkspaceService } from '../../workspace';
import type { IntegrationType } from '../type';

export class LocalUserWorkspaceStore extends Store {
  constructor(
    public readonly workspaceService: WorkspaceService,
    public readonly workspaceServerService: WorkspaceServerService
  ) {
    super();
  }

  private _getKey({
    type,
    userId,
    workspaceId,
  }: {
    type: IntegrationType;
    userId: string;
    workspaceId: string;
  }) {
    return `${type}:${userId}:${workspaceId}`;
  }

  authService = this.workspaceServerService.server?.scope.get(AuthService);
  workspaceId = this.workspaceService.workspace.id;

  userId$ =
    this.workspaceService.workspace.meta.flavour === 'local' ||
    !this.authService
      ? new LiveData('__local__')
      : this.authService.session.account$.map(
          account => account?.id ?? '__local__'
        );

  getUserId() {
    return this.workspaceService.workspace.meta.flavour === 'local' ||
      !this.authService
      ? '__local__'
      : (this.authService.session.account$.value?.id ?? '__local__');
  }

  storageKey$(type: IntegrationType) {
    const workspaceId = this.workspaceService.workspace.id;
    return this.userId$.map(userId =>
      this._getKey({ type, userId, workspaceId })
    );
  }

  getStorageKey(type: IntegrationType) {
    const userId = this.getUserId();
    const workspaceId = this.workspaceService.workspace.id;
    return this._getKey({ type, userId, workspaceId });
  }
}
