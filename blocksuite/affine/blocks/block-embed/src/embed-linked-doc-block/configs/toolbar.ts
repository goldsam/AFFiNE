import { toast } from '@blocksuite/affine-components/toast';
import {
  type EmbedCardStyle,
  EmbedLinkedDocModel,
  EmbedLinkedDocStyles,
} from '@blocksuite/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@blocksuite/affine-shared/consts';
import {
  ActionPlacement,
  type LinkEventType,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@blocksuite/affine-shared/services';
import {
  getBlockProps,
  referenceToNode,
} from '@blocksuite/affine-shared/utils';
import { BlockFlavourIdentifier } from '@blocksuite/block-std';
import { Bound } from '@blocksuite/global/gfx';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
} from '@blocksuite/icons/lit';
import { type ExtensionType, Slice } from '@blocksuite/store';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { EmbedLinkedDocBlockComponent } from '../embed-linked-doc-block';

const trackBaseProps = {
  category: 'linked doc',
  type: 'card view',
};

const docTitleAction = {
  id: 'a.doc-title',
  content(ctx) {
    const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
    if (!block) return null;

    const model = block.model;
    if (!model.title) return null;

    const originalTitle =
      ctx.workspace.getDoc(model.pageId)?.meta?.title || 'Untitled';

    return html`<affine-linked-doc-title
      .title=${originalTitle}
      .open=${(event: MouseEvent) => block.open({ event })}
    ></affine-linked-doc-title>`;
  },
} as const satisfies ToolbarAction;

const captionAction = {
  id: 'd.caption',
  tooltip: 'Caption',
  icon: CaptionIcon(),
  run(ctx) {
    const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
    block?.captionEditor?.show();

    ctx.track('OpenedCaptionEditor', {
      ...trackBaseProps,
      control: 'add caption',
    });
  },
} as const satisfies ToolbarAction;

const conversionsActionGroup = {
  id: 'b.conversions',
  actions: [
    {
      id: 'inline',
      label: 'Inline view',
      run(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
        block?.covertToInline();

        // Clears
        ctx.select('note');
        ctx.reset();

        ctx.track('SelectedView', {
          ...trackBaseProps,
          control: 'select view',
          type: 'inline view',
        });
      },
      when: ctx => !ctx.hasSelectedSurfaceModels,
    },
    {
      id: 'card',
      label: 'Card view',
      disabled: true,
    },
    {
      id: 'embed',
      label: 'Embed view',
      disabled(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
        if (!block) return true;

        if (block.closest('affine-embed-synced-doc-block')) return true;

        const model = block.model;

        // same doc
        if (model.pageId === ctx.store.id) return true;

        // linking to block
        if (referenceToNode(model)) return true;

        return false;
      },
      run(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedLinkedDocBlockComponent);
        block?.convertToEmbed();

        ctx.track('SelectedView', {
          ...trackBaseProps,
          control: 'select view',
          type: 'embed view',
        });
      },
    },
  ],
  content(ctx) {
    const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
    if (!model) return null;

    const actions = this.actions.map(action => ({ ...action }));
    const viewType$ = signal('Card view');
    const onToggle = createOnToggleFn(ctx, 'OpenedViewSelector', 'switch view');

    return html`${keyed(
      model,
      html`<affine-view-dropdown-menu
        @toggle=${onToggle}
        .actions=${actions}
        .context=${ctx}
        .viewType$=${viewType$}
      ></affine-view-dropdown-menu>`
    )}`;
  },
} as const satisfies ToolbarActionGroup<ToolbarAction>;

const createOnToggleFn =
  (
    ctx: ToolbarContext,
    name: Extract<
      LinkEventType,
      | 'OpenedViewSelector'
      | 'OpenedCardStyleSelector'
      | 'OpenedCardScaleSelector'
    >,
    control: 'switch view' | 'switch card style' | 'switch card scale'
  ) =>
  (e: CustomEvent<boolean>) => {
    e.stopPropagation();
    const opened = e.detail;
    if (!opened) return;

    ctx.track(name, { ...trackBaseProps, control });
  };

const builtinToolbarConfig = {
  actions: [
    docTitleAction,
    conversionsActionGroup,
    {
      id: 'c.style',
      actions: [
        {
          id: 'horizontal',
          label: 'Large horizontal style',
        },
        {
          id: 'list',
          label: 'Small horizontal style',
        },
      ].filter(action =>
        EmbedLinkedDocStyles.includes(action.id as EmbedCardStyle)
      ),
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({
          ...action,
          run: ({ store }) => {
            store.updateBlock(model, { style: action.id });

            ctx.track('SelectedCardStyle', {
              ...trackBaseProps,
              control: 'select card style',
              type: action.id,
            });
          },
        })) satisfies ToolbarAction[];
        const onToggle = createOnToggleFn(
          ctx,
          'OpenedCardStyleSelector',
          'switch card style'
        );

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown-menu
            @toggle=${onToggle}
            .actions=${actions}
            .context=${ctx}
            .style$=${model.style$}
          ></affine-card-style-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    captionAction,
    {
      placement: ActionPlacement.More,
      id: 'a.clipboard',
      actions: [
        {
          id: 'copy',
          label: 'Copy',
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
            if (!model) return;

            const slice = Slice.fromModels(ctx.store, [model]);
            ctx.clipboard
              .copySlice(slice)
              .then(() => toast(ctx.host, 'Copied to clipboard'))
              .catch(console.error);
          },
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          icon: DuplicateIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
            if (!model) return;

            const { flavour, parent } = model;
            const props = getBlockProps(model);
            const index = parent?.children.indexOf(model);

            ctx.store.addBlock(flavour, props, parent, index);
          },
        },
      ],
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      label: 'Delete',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
        if (!model) return;

        ctx.store.deleteBlock(model);

        // Clears
        ctx.select('note');
        ctx.reset();
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

const builtinSurfaceToolbarConfig = {
  actions: [
    docTitleAction,
    conversionsActionGroup,
    {
      id: 'c.style',
      actions: [
        {
          id: 'horizontal',
          label: 'Large horizontal style',
        },
        {
          id: 'list',
          label: 'Small horizontal style',
        },
        {
          id: 'vertical',
          label: 'Large vertical style',
        },
        {
          id: 'cube',
          label: 'Small vertical style',
        },
      ].filter(action =>
        EmbedLinkedDocStyles.includes(action.id as EmbedCardStyle)
      ),
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedLinkedDocModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({
          ...action,
          run: ({ store }) => {
            const style = action.id as EmbedCardStyle;
            const bounds = Bound.deserialize(model.xywh);
            bounds.w = EMBED_CARD_WIDTH[style];
            bounds.h = EMBED_CARD_HEIGHT[style];
            const xywh = bounds.serialize();

            store.updateBlock(model, { style, xywh });

            ctx.track('SelectedCardStyle', {
              ...trackBaseProps,
              control: 'select card style',
              type: style,
            });
          },
        })) satisfies ToolbarAction[];
        const onToggle = createOnToggleFn(
          ctx,
          'OpenedCardStyleSelector',
          'switch card style'
        );

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown-menu
            @toggle=${onToggle}
            .actions=${actions}
            .context=${ctx}
            .style$=${model.style$}
          ></affine-card-style-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    captionAction,
    {
      id: 'e.scale',
      content(ctx) {
        const model = ctx.getCurrentBlockByType(
          EmbedLinkedDocBlockComponent
        )?.model;
        if (!model) return null;

        const scale$ = computed(() => {
          const {
            xywh$: { value: xywh },
            style$: { value: style },
          } = model;
          const bounds = Bound.deserialize(xywh);
          const height = EMBED_CARD_HEIGHT[style];
          return Math.round(100 * (bounds.h / height));
        });
        const onSelect = (e: CustomEvent<number>) => {
          e.stopPropagation();

          const scale = e.detail / 100;

          const bounds = Bound.deserialize(model.xywh);
          const style = model.style;
          bounds.h = EMBED_CARD_HEIGHT[style] * scale;
          bounds.w = EMBED_CARD_WIDTH[style] * scale;
          const xywh = bounds.serialize();

          ctx.store.updateBlock(model, { xywh });

          ctx.track('SelectedCardScale', {
            ...trackBaseProps,
            control: 'select card scale',
          });
        };
        const onToggle = createOnToggleFn(
          ctx,
          'OpenedCardScaleSelector',
          'switch card scale'
        );
        const format = (value: number) => `${value}%`;

        return html`${keyed(
          model,
          html`<affine-size-dropdown-menu
            @select=${onSelect}
            @toggle=${onToggle}
            .format=${format}
            .size$=${scale$}
          ></affine-size-dropdown-menu>`
        )}`;
      },
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(EmbedLinkedDocModel).length === 1,
} as const satisfies ToolbarModuleConfig;

export const createBuiltinToolbarConfigExtension = (
  flavour: string
): ExtensionType[] => {
  const name = flavour.split(':').pop();

  return [
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(flavour),
      config: builtinToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(`affine:surface:${name}`),
      config: builtinSurfaceToolbarConfig,
    }),
  ];
};
