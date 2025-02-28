import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinBookmarkToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Bookmark',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
