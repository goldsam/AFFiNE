import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinEmbedToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Embed',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
