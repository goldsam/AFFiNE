import { EdgelessCRUDIdentifier } from '@blocksuite/affine-block-surface';
import {
  packColor,
  type PickColorEvent,
} from '@blocksuite/affine-components/color-picker';
import type { LineDetailType } from '@blocksuite/affine-components/edgeless-line-styles-panel';
import {
  ConnectorElementModel,
  type ConnectorElementProps,
  type ConnectorLabelProps,
  ConnectorMode,
  DEFAULT_FRONT_ENDPOINT_STYLE,
  DEFAULT_REAR_ENDPOINT_STYLE,
  DefaultTheme,
  LineWidth,
  PointStyle,
  resolveColor,
  StrokeStyle,
} from '@blocksuite/affine-model';
import {
  FeatureFlagService,
  type ToolbarContext,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { getMostCommonValue } from '@blocksuite/affine-shared/utils';
import {
  AddTextIcon,
  ConnectorCIcon,
  ConnectorEIcon,
  ConnectorLIcon,
  EndPointArrowIcon,
  EndPointCircleIcon,
  EndPointDiamondIcon,
  EndPointTriangleIcon,
  FlipDirectionIcon,
  StartPointArrowIcon,
  StartPointCircleIcon,
  StartPointDiamondIcon,
  StartPointIcon,
  StartPointTriangleIcon,
} from '@blocksuite/icons/lit';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { EdgelessRootBlockComponent } from '../..';
import { mountConnectorLabelEditor } from '../../utils/text';
import { LINE_STYLE_LIST } from './consts';
import type { MenuItem } from './types';
import { renderMenu } from './utils';

const FRONT_ENDPOINT_STYLE_LIST = [
  {
    value: PointStyle.None,
    icon: StartPointIcon(),
  },
  {
    value: PointStyle.Arrow,
    icon: StartPointArrowIcon(),
  },
  {
    value: PointStyle.Triangle,
    icon: StartPointTriangleIcon(),
  },
  {
    value: PointStyle.Circle,
    icon: StartPointCircleIcon(),
  },
  {
    value: PointStyle.Diamond,
    icon: StartPointDiamondIcon(),
  },
] as const satisfies MenuItem<PointStyle>[];

const REAR_ENDPOINT_STYLE_LIST = [
  {
    value: PointStyle.Diamond,
    icon: EndPointDiamondIcon(),
  },
  {
    value: PointStyle.Circle,
    icon: EndPointCircleIcon(),
  },
  {
    value: PointStyle.Triangle,
    icon: EndPointTriangleIcon(),
  },
  {
    value: PointStyle.Arrow,
    icon: EndPointArrowIcon(),
  },
  {
    value: PointStyle.None,
    icon: StartPointIcon(),
  },
] as const satisfies MenuItem<PointStyle>[];

const CONNECTOR_MODE_LIST = [
  {
    key: 'Curve',
    value: ConnectorMode.Curve,
    icon: ConnectorCIcon(),
  },
  {
    key: 'Elbowed',
    value: ConnectorMode.Orthogonal,
    icon: ConnectorEIcon(),
  },
  {
    key: 'Straight',
    value: ConnectorMode.Straight,
    icon: ConnectorLIcon(),
  },
] as const satisfies MenuItem<ConnectorMode>[];

export const builtinConnectorToolbarConfig = {
  actions: [
    {
      id: 'a.stroke-color',
      tooltip: 'Stroke style',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        if (!models.length) return null;

        const firstModel = models[0];
        const theme = ctx.themeProvider.edgelessTheme;
        const lineSize =
          getMostCommonValue(models, 'strokeWidth') ?? LineWidth.Four;
        const lineStyle =
          getMostCommonValue(models, 'strokeStyle') ?? StrokeStyle.Solid;
        const stroke =
          getMostCommonValue(
            models.map(model => ({
              stroke: resolveColor(model.stroke, theme),
            })),
            'stroke'
          ) ?? resolveColor(DefaultTheme.connectorColor, theme);

        const onPickColor = (e: PickColorEvent) => {
          const field = 'stroke';

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

        const onPickStrokeStyle = (e: CustomEvent<LineDetailType>) => {
          e.stopPropagation();

          const { type, value } = e.detail;

          if (type === 'size') {
            updateModelsWith(ctx, models, 'strokeWidth', value);
            return;
          }

          updateModelsWith(ctx, models, 'strokeStyle', value);
        };

        return html`
          <edgeless-color-picker-button
            class="stroke-color"
            .label="${'Stroke style'}"
            .pick=${onPickColor}
            .color=${stroke}
            .theme=${theme}
            .hollowCircle=${true}
            .originalColor=${firstModel.stroke}
            .enableCustomColor=${ctx.std
              .get(FeatureFlagService)
              .getFlag('enable_color_picker')}
          >
            <affine-edgeless-line-styles-panel
              slot="other"
              style=${styleMap({
                display: 'flex',
                alignSelf: 'stretch',
                gap: '8px',
              })}
              @select=${onPickStrokeStyle}
              .lineSize=${lineSize}
              .lineStyle=${lineStyle}
            ></affine-edgeless-line-styles-panel>
            <editor-toolbar-separator
              slot="separator"
              data-orientation="horizontal"
            ></editor-toolbar-separator>
          </edgeless-color-picker-button>
        `;
      },
    },
    {
      id: 'b.style',
      // TODO(@fundon): should add a feature flag
      when: false,
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        if (!models.length) return null;

        const field = 'rough';
        const rough = getMostCommonValue(models, field) ?? false;
        const onPick = (value: boolean) => {
          updateModelsWith(ctx, models, field, value);
        };

        return renderMenu({
          label: 'Style',
          items: LINE_STYLE_LIST,
          currentValue: rough,
          onPick,
        });
      },
    },
    {
      id: 'c.endpoint-style',
      actions: [
        {
          id: 'a.start-point-style',
          content(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return null;

            const field = 'frontEndpointStyle';
            const pointStyle =
              getMostCommonValue(models, field) ?? DEFAULT_FRONT_ENDPOINT_STYLE;
            const onPick = (value: PointStyle) => {
              updateModelsWith(ctx, models, field, value);
            };

            return renderMenu({
              label: 'Start point style',
              items: FRONT_ENDPOINT_STYLE_LIST,
              currentValue: pointStyle,
              onPick,
            });
          },
        },
        {
          id: 'b.flip-direction',
          icon: FlipDirectionIcon(),
          tooltip: 'Flip direction',
          run(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return;

            const frontEndpointStyle =
              getMostCommonValue(models, 'frontEndpointStyle') ??
              DEFAULT_FRONT_ENDPOINT_STYLE;
            const rearEndpointStyle =
              getMostCommonValue(models, 'rearEndpointStyle') ??
              DEFAULT_REAR_ENDPOINT_STYLE;

            if (frontEndpointStyle === rearEndpointStyle) return;

            for (const model of models) {
              ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, {
                frontEndpointStyle: rearEndpointStyle,
                rearEndpointStyle: frontEndpointStyle,
              });
            }
          },
        },
        {
          id: 'c.end-point-style',
          content(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return null;

            const field = 'rearEndpointStyle';
            const pointStyle =
              getMostCommonValue(models, field) ?? DEFAULT_REAR_ENDPOINT_STYLE;
            const onPick = (value: PointStyle) => {
              updateModelsWith(ctx, models, field, value);
            };

            return renderMenu({
              label: 'End point style',
              items: REAR_ENDPOINT_STYLE_LIST,
              currentValue: pointStyle,
              onPick,
            });
          },
        },
        {
          id: 'd.connector-shape',
          content(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return null;

            const field = 'mode';
            const mode =
              getMostCommonValue(models, field) ?? ConnectorMode.Orthogonal;
            const onPick = (value: ConnectorMode) => {
              updateModelsWith(ctx, models, field, value);
            };

            return renderMenu({
              label: 'Shape',
              tooltip: 'Connector shape',
              items: CONNECTOR_MODE_LIST,
              currentValue: mode,
              onPick,
            });
          },
        },
      ],
    },
    {
      id: 'g.add-text',
      icon: AddTextIcon(),
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        return models.length === 1 && !models[0].text;
      },
      run(ctx) {
        const model = ctx.getCurrentModelByType(ConnectorElementModel);
        if (!model) return;

        const rootModel = ctx.store.root;
        if (!rootModel) return;

        // TODO(@fundon): it should be simple
        const edgeless = ctx.view.getBlock(rootModel.id);
        if (!ctx.matchBlock(edgeless, EdgelessRootBlockComponent)) {
          console.error('edgeless view is not found.');
          return;
        }

        mountConnectorLabelEditor(model, edgeless);
      },
    },
    {
      id: 'g.text',
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        return models.length > 0 && !models.some(model => !model.text);
      },
      // TODO(@fundon): text actoins
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(ConnectorElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

function updateModelsWith<
  T extends keyof Omit<ConnectorElementProps, keyof ConnectorLabelProps>,
>(
  ctx: ToolbarContext,
  models: ConnectorElementModel[],
  field: T,
  value: ConnectorElementProps[T]
) {
  ctx.store.captureSync();

  for (const model of models) {
    ctx.std
      .get(EdgelessCRUDIdentifier)
      .updateElement(model.id, { [field]: value });
  }
}
