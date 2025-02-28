import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinGroupToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Group',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
