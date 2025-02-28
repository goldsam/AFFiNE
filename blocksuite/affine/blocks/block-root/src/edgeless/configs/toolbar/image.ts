import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinImageToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Image',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
