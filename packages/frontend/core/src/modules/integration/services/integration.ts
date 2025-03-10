import { LiveData, Service } from '@toeverything/infra';
import { map } from 'rxjs';

import { INTEGRATION_PROPERTY_SCHEMA } from '../constant';
import { ReadwiseIntegration } from '../entities/readwise';
import { IntegrationWriter } from '../entities/writer';
import type { IntegrationStore } from '../store/integration';

export class IntegrationService extends Service {
  writer = this.framework.createEntity(IntegrationWriter);
  readwise = this.framework.createEntity(ReadwiseIntegration, {
    writer: this.writer,
  });

  constructor(private readonly integrationStore: IntegrationStore) {
    super();
  }

  importing$ = LiveData.computed(get => {
    return get(this.readwise.importing$);
  });

  /**
   * Get doc's integration properties
   * @param docId - The id of the document
   * @returns The properties of the integration, null if doc is not an integration doc
   */
  properties$(docId: string) {
    return LiveData.from(
      this.integrationStore.watchIntegration(docId).pipe(
        map(integration => {
          const type = integration?.type;
          if (!type) return null;
          const schema = INTEGRATION_PROPERTY_SCHEMA[type];
          return Object.entries(schema).map(([key, propertySchema]) => {
            const value =
              propertySchema.get?.(integration.meta) ?? integration.meta[key];
            return {
              key,
              value,
              label: propertySchema.label,
              type: propertySchema.type,
            };
          });
        })
      ),
      null
    );
  }
}
