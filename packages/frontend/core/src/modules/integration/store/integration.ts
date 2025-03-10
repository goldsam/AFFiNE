import { Store } from '@toeverything/infra';

import type { WorkspaceDBService } from '../../db';
import type { DocIntegrationProperties } from '../../db/schema/schema';

export class IntegrationStore extends Store {
  constructor(private readonly dbService: WorkspaceDBService) {
    super();
  }

  watchIntegration(docId: string) {
    return this.dbService.db.docIntegration.get$(docId);
  }

  getIntegration(docId: string) {
    return this.dbService.db.docIntegration.get(docId);
  }

  getIntegrationDocs(
    where: Parameters<typeof this.dbService.db.docIntegration.find>[0]
  ) {
    return this.dbService.db.docIntegration.find(where);
  }

  updateProperties(docId: string, config: Partial<DocIntegrationProperties>) {
    return this.dbService.db.docIntegration.create({
      id: docId,
      ...(config as Omit<DocIntegrationProperties, 'id'>),
    });
  }
}
