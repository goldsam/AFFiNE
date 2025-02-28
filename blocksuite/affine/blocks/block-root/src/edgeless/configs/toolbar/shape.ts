import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';
import {
  AddTextIcon,
  ShapeIcon,
  StyleGeneralIcon,
} from '@blocksuite/icons/lit';

export const builtinShapeToolbarConfig = {
  actions: [
    {
      id: 'a.switch-type',
      icon: ShapeIcon(),
      tooltip: 'Switch type',
      run() {},
    },
    {
      id: 'b.style',
      icon: StyleGeneralIcon(),
      tooltip: 'Style',
      run() {},
    },
    {
      id: 'c.fill-color',
      label: 'Fill color',
      run() {},
    },
    {
      id: 'd.border-style',
      label: 'Border style',
      run() {},
    },
    {
      id: 'e.text',
      icon: AddTextIcon(),
      tooltip: 'Show add button or text menu',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
