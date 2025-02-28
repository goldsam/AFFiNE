import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinNoteToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Note',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
