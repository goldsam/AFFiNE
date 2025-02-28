import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinFrameToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Frame',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
