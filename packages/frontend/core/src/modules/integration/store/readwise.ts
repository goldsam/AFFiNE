import { exhaustMap } from 'rxjs';

import { type WorkspaceServerService } from '../../cloud';
import type { GlobalState } from '../../storage';
import type { WorkspaceService } from '../../workspace';
import { type ReadwiseConfig } from '../type';
import { LocalUserWorkspaceStore } from './local-user-workspace';

export class ReadwiseStore extends LocalUserWorkspaceStore {
  constructor(
    private readonly globalState: GlobalState,
    public override readonly workspaceService: WorkspaceService,
    public override readonly workspaceServerService: WorkspaceServerService
  ) {
    super(workspaceService, workspaceServerService);
  }

  watchSetting() {
    return this.storageKey$('readwise').pipe(
      exhaustMap(storageKey => {
        return this.globalState.watch<ReadwiseConfig>(storageKey);
      })
    );
  }

  getSetting(): ReadwiseConfig | undefined;
  getSetting<Key extends keyof ReadwiseConfig>(
    key: Key
  ): ReadwiseConfig[Key] | undefined;
  getSetting(key?: keyof ReadwiseConfig) {
    const config = this.globalState.get<ReadwiseConfig>(
      this.getStorageKey('readwise')
    );
    if (!key) return config;
    return config?.[key];
  }

  setSetting<Key extends keyof ReadwiseConfig>(
    key: Key,
    value: ReadwiseConfig[Key]
  ) {
    this.globalState.set(this.getStorageKey('readwise'), {
      ...this.getSetting(),
      [key]: value,
    });
  }
}
