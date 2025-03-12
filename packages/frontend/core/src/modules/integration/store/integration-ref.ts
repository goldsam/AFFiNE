import { Store } from '@toeverything/infra';

import type { WorkspaceDBService } from '../../db';
import type { DocIntegrationRef } from '../../db/schema/schema';

export class IntegrationRefStore extends Store {
  constructor(private readonly dbService: WorkspaceDBService) {
    super();
  }

  watchIntegration(docId: string) {
    return this.dbService.db.docIntegrationRef.get$(docId);
  }

  getIntegration(docId: string) {
    return this.dbService.db.docIntegrationRef.get(docId);
  }

  getIntegrationDocs(
    where: Parameters<typeof this.dbService.db.docIntegrationRef.find>[0]
  ) {
    return this.dbService.db.docIntegrationRef.find(where);
  }

  updateRef(docId: string, config: Partial<DocIntegrationRef>) {
    return this.dbService.db.docIntegrationRef.create({
      id: docId,
      ...(config as Omit<DocIntegrationRef, 'id'>),
    });
  }
}
