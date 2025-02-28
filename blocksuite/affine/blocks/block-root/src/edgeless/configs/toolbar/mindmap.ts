import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinMindmapToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Mindmap',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
