import { EdgelessFrameManagerIdentifier } from '@blocksuite/affine-block-frame';
import { EdgelessCRUDIdentifier } from '@blocksuite/affine-block-surface';
import {
  packColor,
  type PickColorEvent,
} from '@blocksuite/affine-components/color-picker';
import { toast } from '@blocksuite/affine-components/toast';
import {
  DEFAULT_NOTE_HEIGHT,
  DefaultTheme,
  FrameBlockModel,
  NoteBlockModel,
  NoteBlockSchema,
  NoteDisplayMode,
  resolveColor,
  SurfaceRefBlockSchema,
} from '@blocksuite/affine-model';
import {
  FeatureFlagService,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@blocksuite/affine-shared/services';
import {
  getMostCommonValue,
  matchModels,
} from '@blocksuite/affine-shared/utils';
import { BlockFlavourIdentifier } from '@blocksuite/block-std';
import { Bound } from '@blocksuite/global/gfx';
import { EditIcon, PageIcon, UngroupIcon } from '@blocksuite/icons/lit';
import type { ExtensionType } from '@blocksuite/store';
import { html } from 'lit';

import { mountFrameTitleEditor } from '../../utils/text';
import { getEdgelessWith } from './utils';

const builtinSurfaceToolbarConfig = {
  actions: [
    {
      id: 'a.insert-into-page',
      label: 'Insert into Page',
      tooltip: 'Insert into Page',
      icon: PageIcon(),
      when: ctx => ctx.getSurfaceModelsByType(FrameBlockModel).length === 1,
      run(ctx) {
        const model = ctx.getCurrentModelByType(FrameBlockModel);
        if (!model) return;

        const rootModel = ctx.store.root;
        if (!rootModel) return;

        const { id: frameId, xywh } = model;
        let lastNoteId = rootModel.children
          .filter(
            note =>
              matchModels(note, [NoteBlockModel]) &&
              note.displayMode !== NoteDisplayMode.EdgelessOnly
          )
          .pop()?.id;

        if (!lastNoteId) {
          const bounds = Bound.deserialize(xywh);
          bounds.y += bounds.h;
          bounds.h = DEFAULT_NOTE_HEIGHT;

          lastNoteId = ctx.store.addBlock(
            NoteBlockSchema.model.flavour,
            { xywh: bounds.serialize() },
            rootModel.id
          );
        }

        ctx.store.addBlock(
          SurfaceRefBlockSchema.model.flavour,
          { reference: frameId, refFlavour: NoteBlockSchema.model.flavour },
          lastNoteId
        );

        toast(ctx.host, 'Frame has been inserted into doc');
      },
    },
    {
      id: 'b.rename',
      tooltip: 'Rename',
      icon: EditIcon(),
      when: ctx => ctx.getSurfaceModelsByType(FrameBlockModel).length === 1,
      run(ctx) {
        const model = ctx.getCurrentModelByType(FrameBlockModel);
        if (!model) return;

        const edgeless = getEdgelessWith(ctx);
        if (!edgeless) return;

        mountFrameTitleEditor(model, edgeless);
      },
    },
    {
      id: 'b.ungroup',
      tooltip: 'Ungroup',
      icon: UngroupIcon(),
      run(ctx) {
        const models = ctx.getSurfaceModelsByType(FrameBlockModel);
        if (!models.length) return;

        const edgeless = getEdgelessWith(ctx);
        if (!edgeless) return;

        ctx.store.captureSync();

        const frameManager = ctx.std.get(EdgelessFrameManagerIdentifier);

        for (const model of models) {
          frameManager.removeAllChildrenFromFrame(model);
        }

        for (const model of models) {
          edgeless.service.removeElement(model);
        }

        edgeless.service.selection.clear();
      },
    },
    {
      id: 'c.color-picker',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(FrameBlockModel);
        if (!models.length) return null;

        const field = 'background';
        const firstModel = models[0];
        const theme = ctx.themeProvider.edgelessTheme;
        const background =
          getMostCommonValue(
            models.map(model => ({
              [field]: resolveColor(model[field], theme),
            })),
            field
          ) ?? DefaultTheme.transparent;
        const onPick = (e: PickColorEvent) => {
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
            class="background"
            .label="${'Background'}"
            .pick=${onPick}
            .color=${background}
            .theme=${theme}
            .originalColor=${firstModel.background}
            .enableCustomColor=${ctx.std
              .get(FeatureFlagService)
              .getFlag('enable_color_picker')}
          >
          </edgeless-color-picker-button>
        `;
      },
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(FrameBlockModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const createFrameToolbarConfig = (flavour: string): ExtensionType => {
  const name = flavour.split(':').pop();

  return ToolbarModuleExtension({
    id: BlockFlavourIdentifier(`affine:surface:${name}`),
    config: builtinSurfaceToolbarConfig,
  });
};
