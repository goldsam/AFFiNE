import {
  ActionPlacement,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import {
  ConnectorCIcon,
  LockIcon,
  ReleaseFromGroupIcon,
} from '@blocksuite/icons/lit';

export const builtinMiscToolbarConfig = {
  actions: [
    {
      placement: ActionPlacement.Start,
      id: 'a.release-from-group',
      tooltip: 'Release from group',
      icon: ReleaseFromGroupIcon(),
      run() {},
    },
    {
      placement: ActionPlacement.Start,
      id: 'a.misc',
      label: 'Misc',
      run() {},
    },
    {
      placement: ActionPlacement.End,
      id: 'a.draw-connector',
      icon: ConnectorCIcon(),
      tooltip: 'Draw connector',
      run() {},
    },
    {
      placement: ActionPlacement.End,
      id: 'b.lock',
      icon: LockIcon(),
      tooltip: 'Lock',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
