import {
  ConnectorElementModel,
  DEFAULT_CONNECTOR_MODE,
} from '@blocksuite/affine-model';
import {
  ActionPlacement,
  type ToolbarAction,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import {
  ConnectorCIcon,
  LockIcon,
  ReleaseFromGroupIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';

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
      tooltip: 'Draw connector',
      icon: ConnectorCIcon(),
      when(ctx) {
        const models = ctx.getSurfaceModels();
        if (models.length !== 1) return false;
        if (models[0].isLocked()) return false;
        return !ctx.matchModel(models[0], ConnectorElementModel);
      },
      content(ctx) {
        const models = ctx.getSurfaceModels();
        if (!models.length) return null;

        const { id, label, icon, tooltip } = this;

        const quickConnect = (e: MouseEvent) => {
          e.stopPropagation();

          const { x, y } = e;
          const point = ctx.gfx.viewport.toViewCoordFromClientCoord([x, y]);

          ctx.store.captureSync();
          ctx.gfx.tool.setTool('connector', { mode: DEFAULT_CONNECTOR_MODE });

          const ctc = ctx.gfx.tool.get('connector');
          ctc.quickConnect(point, models[0]);
        };

        return html`
          <editor-icon-button
            data-testid=${id}
            aria-label=${label}
            .tooltip=${tooltip}
            @click=${quickConnect}
          >
            ${icon}
          </editor-icon-button>
        `;
      },
    } satisfies ToolbarAction,
    {
      placement: ActionPlacement.End,
      id: 'b.lock',
      icon: LockIcon(),
      tooltip: 'Lock',
      run() {},
    },
  ],
} as const satisfies ToolbarModuleConfig;
