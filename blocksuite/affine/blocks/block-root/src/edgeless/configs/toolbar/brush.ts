import { EdgelessCRUDIdentifier } from '@blocksuite/affine-block-surface';
import {
  packColor,
  type PickColorEvent,
} from '@blocksuite/affine-components/color-picker';
import {
  BrushElementModel,
  DefaultTheme,
  LineWidth,
  resolveColor,
} from '@blocksuite/affine-model';
import {
  FeatureFlagService,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { getMostCommonValue } from '@blocksuite/affine-shared/utils';
import { html } from 'lit';

import type { LineWidthEvent } from '../../components/panel/line-width-panel';

export const builtinBrushToolbarConfig = {
  actions: [
    {
      id: 'a.line-width',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(BrushElementModel);
        if (!models.length) return null;

        const lineWidth =
          getMostCommonValue(models, 'lineWidth') ?? LineWidth.Four;
        const onPick = (e: LineWidthEvent) => {
          e.stopPropagation();

          const lineWidth = e.detail;

          for (const model of models) {
            ctx.std
              .get(EdgelessCRUDIdentifier)
              .updateElement(model.id, { lineWidth });
          }
        };

        return html`
          <edgeless-line-width-panel
            .selectedSize=${lineWidth}
            @select=${onPick}
          >
          </edgeless-line-width-panel>
        `;
      },
    },
    {
      id: 'b.color-picker',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(BrushElementModel);
        if (!models.length) return null;

        const firstModel = models[0];
        const theme = ctx.themeProvider.edgelessTheme;
        const color =
          getMostCommonValue(
            models.map(model => ({ color: resolveColor(model.color, theme) })),
            'color'
          ) ?? resolveColor(DefaultTheme.black, theme);
        const onPick = (e: PickColorEvent) => {
          const field = 'color';

          if (e.type === 'pick') {
            const color = e.detail.value;
            for (const model of models) {
              const props = packColor(field, color);
              ctx.std
                .get(EdgelessCRUDIdentifier)
                .updateElement(model.id, props);
            }
            return;
          }

          for (const model of models) {
            model[e.type === 'start' ? 'stash' : 'pop'](field);
          }
        };

        return html`
          <edgeless-color-picker-button
            class="color"
            .label="${'Color'}"
            .pick=${onPick}
            .color=${color}
            .theme=${theme}
            .originalColor=${firstModel.color}
            .enableCustomColor=${ctx.std
              .get(FeatureFlagService)
              .getFlag('enable_color_picker')}
          >
          </edgeless-color-picker-button>
        `;
      },
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(BrushElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;
