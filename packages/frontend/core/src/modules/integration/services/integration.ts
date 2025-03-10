import { LiveData, Service } from '@toeverything/infra';
import { combineLatest, map } from 'rxjs';

import type { I18nService } from '../../i18n';
import {
  INTEGRATION_PROPERTY_SCHEMA,
  INTEGRATION_TYPE_NAME_MAP,
} from '../constant';
import { ReadwiseIntegration } from '../entities/readwise';
import { IntegrationWriter } from '../entities/writer';
import type { IntegrationStore } from '../store/integration';

export class IntegrationService extends Service {
  writer = this.framework.createEntity(IntegrationWriter);
  readwise = this.framework.createEntity(ReadwiseIntegration, {
    writer: this.writer,
  });

  constructor(
    private readonly integrationStore: IntegrationStore,
    private readonly i18nService: I18nService
  ) {
    super();
  }

  importing$ = LiveData.computed(get => {
    return get(this.readwise.importing$);
  });

  propertiesRaw$(docId: string) {
    return LiveData.from(this.integrationStore.watchIntegration(docId), null);
  }

  /**
   * Get doc's integration properties
   * @param docId - The id of the document
   * @returns The properties of the integration, null if doc is not an integration doc
   */
  properties$(docId: string) {
    return LiveData.from(
      combineLatest([
        this.integrationStore.watchIntegration(docId),
        this.i18nService.i18n.currentLanguageKey$,
      ]).pipe(
        map(([integration, lng]) => {
          const type = integration?.type;
          if (!type) return null;
          const schema = INTEGRATION_PROPERTY_SCHEMA[type];
          return Object.entries(schema).map(([key, propertySchema]) => {
            const value =
              propertySchema.get?.(integration.meta) ?? integration.meta[key];
            const i18nKey = propertySchema.label;
            const label = this.i18nService.i18n.i18next.t(
              typeof i18nKey === 'string' ? i18nKey : i18nKey.i18nKey,
              { lng }
            );
            return {
              key,
              value,
              label,
              type: propertySchema.type,
            };
          });
        })
      ),
      null
    );
  }

  name$(docId: string) {
    return LiveData.from(
      combineLatest([
        this.integrationStore.watchIntegration(docId),
        this.i18nService.i18n.currentLanguageKey$,
      ]).pipe(
        map(([integration, lng]) => {
          if (!integration?.type) return null;
          const i18nKey = INTEGRATION_TYPE_NAME_MAP[integration.type];
          return this.i18nService.i18n.i18next.t(
            typeof i18nKey === 'string' ? i18nKey : i18nKey.i18nKey,
            { lng }
          );
        })
      ),
      null
    );
  }
}
