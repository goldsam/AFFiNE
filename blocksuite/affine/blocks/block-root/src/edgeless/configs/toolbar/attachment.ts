import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';

export const builtinAttachmentToolbarConfig = {
  actions: [
    {
      id: 'a.test',
      label: 'Attachment',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
