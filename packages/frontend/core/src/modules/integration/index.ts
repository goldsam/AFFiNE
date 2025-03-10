import type { Framework } from '@toeverything/infra';

import { WorkspaceServerService } from '../cloud';
import { WorkspaceDBService } from '../db';
import { DocsService } from '../doc';
import { GlobalState } from '../storage';
import { WorkspaceScope, WorkspaceService } from '../workspace';
import { ReadwiseIntegration } from './entities/readwise';
import { IntegrationWriter } from './entities/writer';
import { IntegrationService } from './services/integration';
import { IntegrationStore } from './store/integration';
import { ReadwiseStore } from './store/readwise';

export { IntegrationService };

export function configureIntegrationModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .store(IntegrationStore, [WorkspaceDBService])
    .store(ReadwiseStore, [
      GlobalState,
      WorkspaceService,
      WorkspaceServerService,
    ])
    .service(IntegrationService, [IntegrationStore])
    .entity(IntegrationWriter, [DocsService, WorkspaceService])
    .entity(ReadwiseIntegration, [IntegrationStore, ReadwiseStore]);
}
