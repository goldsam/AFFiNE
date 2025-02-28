import type { ToolbarModuleConfig } from '@blocksuite/affine-shared/services';
import {
  AddTextIcon,
  ConnectorCIcon,
  FlipDirectionIcon,
  StartPointIcon,
} from '@blocksuite/icons/lit';

export const builtinConnectorToolbarConfig = {
  actions: [
    {
      id: 'a.stroke-color',
      tooltip: 'Stroke style',
      run() {},
    },
    {
      id: 'b.style',
      tooltip: 'Style',
      run() {},
    },
    {
      id: 'c.start-point-style',
      icon: StartPointIcon(),
      tooltip: 'Start point style',
      run() {},
    },
    {
      id: 'd.flip-direction',
      icon: FlipDirectionIcon(),
      tooltip: 'Flip direction',
      run() {},
    },
    {
      id: 'e.end-point-style',
      icon: StartPointIcon(),
      tooltip: 'End point style',
      run() {},
    },
    {
      id: 'f.connector-shape',
      icon: ConnectorCIcon(),
      tooltip: 'Connector shape',
      run() {},
    },
    {
      id: 'g.add-text',
      icon: AddTextIcon(),
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
