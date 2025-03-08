import { toast } from '@blocksuite/affine-components/toast';
import { EmbedSyncedDocModel } from '@blocksuite/affine-model';
import {
  ActionPlacement,
  type OpenDocMode,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarContext,
  type ToolbarModuleConfig,
} from '@blocksuite/affine-shared/services';
import { getBlockProps } from '@blocksuite/affine-shared/utils';
import {
  ArrowDownSmallIcon,
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  ExpandFullIcon,
  OpenInNewIcon,
} from '@blocksuite/icons/lit';
import { Slice } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';

import { EmbedSyncedDocBlockComponent } from '../embed-synced-doc-block';

const trackBaseProps = {
  segment: 'doc',
  page: 'doc editor',
  module: 'toolbar',
  category: 'linked doc',
  type: 'embed view',
};

export const builtinToolbarConfig = {
  actions: [
    {
      placement: ActionPlacement.Start,
      id: 'A.open-doc',
      actions: [
        {
          id: 'open-in-active-view',
          label: 'Open this doc',
          icon: ExpandFullIcon(),
        },
      ],
      content(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedSyncedDocBlockComponent);
        if (!block) return null;

        const actions = this.actions
          .map<ToolbarAction>(action => {
            const shouldOpenInActiveView = action.id === 'open-in-active-view';
            const allowed =
              typeof action.when === 'function'
                ? action.when(ctx)
                : (action.when ?? true);
            return {
              ...action,
              disabled: shouldOpenInActiveView
                ? block.model.pageId === ctx.store.id
                : false,
              when: allowed,
              run: (_ctx: ToolbarContext) =>
                block.open({
                  openMode: action.id as OpenDocMode,
                }),
            };
          })
          .filter(action => {
            if (typeof action.when === 'function') return action.when(ctx);
            return action.when ?? true;
          });

        return html`
          <editor-menu-button
            .contentPadding="${'8px'}"
            .button=${html`
              <editor-icon-button aria-label="Open doc" .tooltip=${'Open doc'}>
                ${OpenInNewIcon()} ${ArrowDownSmallIcon()}
              </editor-icon-button>
            `}
          >
            <div data-size="small" data-orientation="vertical">
              ${repeat(
                actions,
                action => action.id,
                ({ label, icon, run, disabled }) => html`
                  <editor-menu-action
                    aria-label=${ifDefined(label)}
                    ?disabled=${ifDefined(
                      typeof disabled === 'function' ? disabled(ctx) : disabled
                    )}
                    @click=${() => run?.(ctx)}
                  >
                    ${icon}<span class="label">${label}</span>
                  </editor-menu-action>
                `
              )}
            </div>
          </editor-menu-button>
        `;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'a.conversions',
      actions: [
        {
          id: 'inline',
          label: 'Inline view',
          run(ctx) {
            const block = ctx.getCurrentBlockByType(
              EmbedSyncedDocBlockComponent
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
          run(ctx) {
            const block = ctx.getCurrentBlockByType(
              EmbedSyncedDocBlockComponent
            );
            block?.convertToCard();

            ctx.track('SelectedView', {
              ...trackBaseProps,
              control: 'select view',
              type: 'card view',
            });
          },
        },
        {
          id: 'embed',
          label: 'Embed view',
          disabled: true,
        },
      ],
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedSyncedDocModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({ ...action }));
        const onToggle = (e: CustomEvent<boolean>) => {
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
            @toggle=${onToggle}
            .actions=${actions}
            .context=${ctx}
            .viewType$=${signal(actions[2].label)}
          ></affine-view-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'b.caption',
      tooltip: 'Caption',
      icon: CaptionIcon(),
      run(ctx) {
        const block = ctx.getCurrentBlockByType(EmbedSyncedDocBlockComponent);
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
            const model = ctx.getCurrentModelByType(EmbedSyncedDocModel);
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
            const model = ctx.getCurrentModelByType(EmbedSyncedDocModel);
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
        const model = ctx.getCurrentModelByType(EmbedSyncedDocModel);
        if (!model) return;

        ctx.store.deleteBlock(model);

        // Clears
        ctx.select('note');
        ctx.reset();
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;
