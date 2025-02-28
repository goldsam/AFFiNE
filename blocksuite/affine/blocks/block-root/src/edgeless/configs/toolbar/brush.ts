import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinBrushToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Brush',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
