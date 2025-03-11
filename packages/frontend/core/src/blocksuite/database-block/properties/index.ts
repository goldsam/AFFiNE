import type { PropertyMetaConfig } from '@blocksuite/affine/blocks/database';

import { filePropertyConfig } from './file/view';

export const propertiesPresets: PropertyMetaConfig<string, any, any>[] = [
  filePropertyConfig,
];
