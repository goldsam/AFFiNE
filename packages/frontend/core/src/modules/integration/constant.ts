import type { IntegrationProperty, IntegrationType } from './type';

export const INTEGRATION_PROPERTY_SCHEMA: Record<
  IntegrationType,
  Record<string, IntegrationProperty>
> = {
  readwise: {
    author: {
      label: 'Author',
      key: 'author',
      type: 'text',
    },
  },
  zotero: {},
};
