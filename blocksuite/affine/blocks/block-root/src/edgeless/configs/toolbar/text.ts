import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinTextToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Text',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
