import { toast } from '@blocksuite/affine-components/toast';
import { EmbedLinkedDocModel } from '@blocksuite/affine-model';
import {
  ActionPlacement,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import {
  getBlockProps,
  referenceToNode,
} from '@blocksuite/affine-shared/utils';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
} from '@blocksuite/icons/lit';
import { Slice } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { EmbedLinkedDocBlockComponent } from '../embed-linked-doc-block';

const trackBaseProps = {
  segment: 'doc',
  page: 'doc editor',
  module: 'toolbar',
  category: 'linked doc',
  type: 'card view',
};

export const builtinToolbarConfig = {
  actions: [
    {
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
    },
    {
      id: 'b.conversions',
      actions: [
        {
          id: 'inline',
          label: 'Inline view',
          run(ctx) {
            const block = ctx.getCurrentBlockByType(
              EmbedLinkedDocBlockComponent
            );
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
            const block = ctx.getCurrentBlockByType(
              EmbedLinkedDocBlockComponent
            );
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
            const block = ctx.getCurrentBlockByType(
              EmbedLinkedDocBlockComponent
            );
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
        const toggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          ctx.track('OpenedViewSelector', {
            ...trackBaseProps,
            control: 'switch view',
          });
        };

        return html`${keyed(
          model,
          html`<affine-view-dropdown-menu
            .actions=${actions}
            .context=${ctx}
            .toggle=${toggle}
            .viewType$=${signal(actions[1].label)}
          ></affine-view-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
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
      ],
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
        const toggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          ctx.track('OpenedCardStyleSelector', {
            ...trackBaseProps,
            control: 'switch card style',
          });
        };

        return html`${keyed(
          model,
          html`<affine-card-style-dropdown-menu
            .actions=${actions}
            .context=${ctx}
            .toggle=${toggle}
            .style$=${model.style$}
          ></affine-card-style-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
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
    },
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
