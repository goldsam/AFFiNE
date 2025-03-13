import { notify } from '@affine/component';
import {
  generateUrl,
  type UseSharingUrl,
} from '@affine/core/components/hooks/affine/use-share-url';
import { WorkspaceServerService } from '@affine/core/modules/cloud';
import { EditorService } from '@affine/core/modules/editor';
import { copyLinkToBlockStdScopeClipboard } from '@affine/core/utils/clipboard';
import { I18n } from '@affine/i18n';
import { track } from '@affine/track';
import {
  BlockFlavourIdentifier,
  BlockSelection,
  TextSelection,
} from '@blocksuite/affine/block-std';
import {
  GfxBlockElementModel,
  GfxPrimitiveElementModel,
} from '@blocksuite/affine/block-std/gfx';
import { BookmarkBlockComponent } from '@blocksuite/affine/blocks/bookmark';
import {
  EmbedFigmaBlockComponent,
  EmbedGithubBlockComponent,
  EmbedIframeBlockComponent,
  EmbedLinkedDocBlockComponent,
  EmbedLoomBlockComponent,
  EmbedSyncedDocBlockComponent,
  EmbedYoutubeBlockComponent,
  getDocContentWithMaxLength,
} from '@blocksuite/affine/blocks/embed';
import { toggleEmbedCardEditModal } from '@blocksuite/affine/components/embed-card-modal';
import {
  notifyLinkedDocClearedAliases,
  notifyLinkedDocSwitchedToCard,
} from '@blocksuite/affine/components/notification';
import { isPeekable, peek } from '@blocksuite/affine/components/peek';
import { toast } from '@blocksuite/affine/components/toast';
import type {
  MenuContext,
  MenuItemGroup,
} from '@blocksuite/affine/components/toolbar';
import { watch } from '@blocksuite/affine/global/lit';
import {
  BookmarkBlockModel,
  EmbedLinkedDocModel,
  EmbedSyncedDocModel,
} from '@blocksuite/affine/model';
import {
  AffineReference,
  toggleReferencePopup,
} from '@blocksuite/affine/rich-text';
import { getSelectedModelsCommand } from '@blocksuite/affine/shared/commands';
import { ImageSelection } from '@blocksuite/affine/shared/selection';
import {
  ActionPlacement,
  FeatureFlagService,
  GenerateDocUrlProvider,
  isRemovedUserInfo,
  type OpenDocMode,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  UserProvider,
} from '@blocksuite/affine/shared/services';
import { matchModels } from '@blocksuite/affine/shared/utils';
import type { ExtensionType } from '@blocksuite/affine/store';
import {
  ArrowDownSmallIcon,
  CenterPeekIcon,
  CopyAsImgaeIcon,
  CopyIcon,
  EditIcon,
  ExpandFullIcon,
  LinkIcon,
  OpenInNewIcon,
  SplitViewIcon,
} from '@blocksuite/icons/lit';
import { computed } from '@preact/signals-core';
import type { FrameworkProvider } from '@toeverything/infra';
import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import { createCopyAsPngMenuItem } from './copy-as-image';

export function createToolbarMoreMenuConfig(framework: FrameworkProvider) {
  return {
    configure: <T extends MenuContext>(groups: MenuItemGroup<T>[]) => {
      const clipboardGroup = groups.find(group => group.type === 'clipboard');

      if (clipboardGroup) {
        let copyIndex = clipboardGroup.items.findIndex(
          item => item.type === 'copy'
        );
        if (copyIndex === -1) {
          copyIndex = clipboardGroup.items.findIndex(
            item => item.type === 'duplicate'
          );
          if (copyIndex !== -1) {
            copyIndex -= 1;
          }
        }

        // after `copy` or before `duplicate`
        clipboardGroup.items.splice(
          copyIndex + 1,
          0,
          createCopyLinkToBlockMenuItem(framework)
        );

        clipboardGroup.items.splice(
          copyIndex + 1,
          0,
          createCopyAsPngMenuItem(framework)
        );
      }

      return groups;
    },
  };
}

function createCopyLinkToBlockMenuItem(
  framework: FrameworkProvider,
  item = {
    icon: LinkIcon({ width: '20', height: '20' }),
    label: 'Copy link to block',
    type: 'copy-link-to-block',
    when: (ctx: MenuContext) => {
      if (ctx.isEmpty()) return false;

      const { editor } = framework.get(EditorService);
      const mode = editor.mode$.value;

      if (mode === 'edgeless') {
        // linking blocks in notes is currently not supported in edgeless mode.
        if (ctx.selectedBlockModels.length > 0) {
          return false;
        }

        // linking single block/element in edgeless mode.
        if (ctx.isMultiple()) {
          return false;
        }
      }

      return true;
    },
  }
) {
  return {
    ...item,
    action: async (ctx: MenuContext) => {
      const workspaceServerService = framework.get(WorkspaceServerService);

      const { editor } = framework.get(EditorService);
      const mode = editor.mode$.value;
      const pageId = editor.doc.id;
      const workspaceId = editor.doc.workspace.id;
      const options: UseSharingUrl = { workspaceId, pageId, mode };
      let type = '';

      if (mode === 'page') {
        // maybe multiple blocks
        const blockIds = ctx.selectedBlockModels.map(model => model.id);
        options.blockIds = blockIds;
        type = ctx.selectedBlockModels[0].flavour;
      } else if (mode === 'edgeless' && ctx.firstElement) {
        // single block/element
        const id = ctx.firstElement.id;
        if (ctx.isElement()) {
          options.elementIds = [id];
          type = (ctx.firstElement as GfxPrimitiveElementModel).type;
        } else {
          options.blockIds = [id];
          type = (ctx.firstElement as GfxBlockElementModel).flavour;
        }
      }

      const str = generateUrl({
        ...options,
        baseUrl: workspaceServerService.server?.baseUrl ?? location.origin,
      });
      if (!str) {
        ctx.close();
        return;
      }

      const success = await copyLinkToBlockStdScopeClipboard(
        str,
        ctx.std.clipboard
      );

      if (success) {
        notify.success({ title: I18n['Copied link to clipboard']() });
      }

      track.doc.editor.toolbar.copyBlockToLink({ type });

      ctx.close();
    },
  };
}

function createToolbarMoreMenuConfigV2(baseUrl?: string) {
  return {
    actions: [
      {
        placement: ActionPlacement.More,
        id: 'a.clipboard',
        actions: [
          {
            id: 'copy-as-image',
            label: 'Copy as Image',
            icon: CopyAsImgaeIcon(),
            when: ({ isEdgelessMode, gfx }) =>
              isEdgelessMode && gfx.selection.selectedElements.length > 0,
          },
          {
            id: 'copy-link-to-block',
            label: 'Copy link to block',
            icon: LinkIcon(),
            when: ({ isPageMode, selection, gfx }) => {
              const items = selection
                .getGroup('note')
                .filter(item =>
                  [TextSelection, BlockSelection, ImageSelection].some(t =>
                    item.is(t)
                  )
                );
              const hasNoteSelection = items.length > 0;

              if (isPageMode) {
                const item = items[0];
                if (item && item.is(TextSelection)) {
                  return (
                    !item.isCollapsed() &&
                    Boolean(item.from.length + (item.to?.length ?? 0))
                  );
                }
                return hasNoteSelection;
              }

              // Linking blocks in notes is currently not supported under edgeless.
              if (hasNoteSelection) return false;

              // Linking single block/element in edgeless mode.
              return gfx.selection.selectedElements.length === 1;
            },
            run({ isPageMode, std, store, gfx, workspace, editorMode }) {
              const pageId = store.doc.id;
              const mode = editorMode;
              const workspaceId = workspace.id;
              const options: UseSharingUrl = { workspaceId, pageId, mode };
              let type = '';

              if (isPageMode) {
                const [ok, { selectedModels = [] }] = std.command.exec(
                  getSelectedModelsCommand
                );

                if (!ok || !selectedModels.length) return;

                options.blockIds = selectedModels.map(model => model.id);
                type = selectedModels[0].flavour;
              } else {
                const firstElement = gfx.selection.firstElement;
                if (!firstElement) return;

                const ids = [firstElement.id];
                if (firstElement instanceof GfxPrimitiveElementModel) {
                  type = firstElement.type;
                  options.elementIds = ids;
                } else if (firstElement instanceof GfxBlockElementModel) {
                  type = firstElement.flavour;
                  options.blockIds = ids;
                }
              }

              if (!type) return;

              const str = generateUrl({
                ...options,
                baseUrl: baseUrl ?? location.origin,
              });

              if (!str) return;

              copyLinkToBlockStdScopeClipboard(str, std.clipboard)
                .then(ok => {
                  if (!ok) return;

                  notify.success({ title: I18n['Copied link to clipboard']() });
                })
                .catch(console.error);

              track.doc.editor.toolbar.copyBlockToLink({ type });
            },
          },
        ],
      },
      {
        placement: ActionPlacement.More,
        id: 'z.block-meta',
        actions: [
          {
            id: 'block-meta-display',
            when: cx => {
              const featureFlag = cx.std.get(FeatureFlagService);
              const isEnabled = featureFlag.getFlag('enable_block_meta');
              if (!isEnabled) return false;

              // only display when one block is selected by block selection
              const { selection, getCurrentBlockBy } = cx;
              const hasBlockSelection =
                selection.filter(BlockSelection).length === 1;
              if (!hasBlockSelection) return false;
              const block = getCurrentBlockBy.call(cx, BlockSelection);
              if (!block) return false;

              const createdAt = 'meta:createdAt';
              const createdBy = 'meta:createdBy';
              return (
                createdAt in block.model &&
                block.model[createdAt] !== undefined &&
                createdBy in block.model &&
                block.model[createdBy] !== undefined &&
                typeof block.model[createdBy] === 'string' &&
                typeof block.model[createdAt] === 'number'
              );
            },
            content: cx => {
              const model = cx.getCurrentModelBy(BlockSelection);
              if (!model) return null;
              const createdAt = 'meta:createdAt';
              if (!(createdAt in model)) return null;
              const createdBy = 'meta:createdBy';
              if (!(createdBy in model)) return null;
              const createdByUserId = model[createdBy] as string;
              const createdAtTimestamp = model[createdAt] as number;
              const date = new Date(createdAtTimestamp);
              const userProvider = cx.std.get(UserProvider);
              userProvider.revalidateUserInfo(createdByUserId);
              const userSignal = userProvider.userInfo$(createdByUserId);
              userSignal.subscribe(console.log);
              const user = computed(() => {
                const value = userSignal.value;
                if (!value) return 'Unknown User';
                const removed = isRemovedUserInfo(value);
                if (removed) return 'Deleted User';
                return value.name;
              });
              const createdAtString = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
              });
              const wrapperStyle = {
                padding: '4px 8px',
                fontSize: '12px',
              };
              return html`<div style=${styleMap(wrapperStyle)}>
                <div>Created by ${watch(user)}</div>
                <div>${createdAtString}</div>
              </div>`;
            },
          },
        ],
      },
    ],
  } as const satisfies ToolbarModuleConfig;
}

function createExternalLinkableToolbarConfig(
  kclass:
    | typeof BookmarkBlockComponent
    | typeof EmbedFigmaBlockComponent
    | typeof EmbedGithubBlockComponent
    | typeof EmbedLoomBlockComponent
    | typeof EmbedYoutubeBlockComponent
) {
  return {
    actions: [
      {
        id: 'a.preview.after.copy-link-and-edit',
        actions: [
          {
            id: 'copy-link',
            tooltip: 'Copy link',
            icon: CopyIcon(),
            run(ctx) {
              const model = ctx.getCurrentBlockComponentBy(
                BlockSelection,
                kclass
              )?.model;
              if (!model) return;

              const { url } = model;

              navigator.clipboard.writeText(url).catch(console.error);
              toast(ctx.host, 'Copied link to clipboard');

              ctx.track('CopiedLink', {
                segment: 'doc',
                page: 'doc editor',
                module: 'toolbar',
                category: matchModels(model, [BookmarkBlockModel])
                  ? 'bookmark'
                  : 'link',
                type: 'card view',
                control: 'copy link',
              });
            },
          },
          {
            id: 'edit',
            tooltip: 'Edit',
            icon: EditIcon(),
            run(ctx) {
              const component = ctx.getCurrentBlockComponentBy(
                BlockSelection,
                kclass
              );
              if (!component) return;

              ctx.hide();

              const model = component.model;
              const abortController = new AbortController();
              abortController.signal.onabort = () => ctx.show();

              toggleEmbedCardEditModal(
                ctx.host,
                model,
                'card',
                undefined,
                undefined,
                (_std, _component, props) => {
                  ctx.store.updateBlock(model, props);
                  component.requestUpdate();
                },
                abortController
              );

              ctx.track('OpenedAliasPopup', {
                segment: 'doc',
                page: 'doc editor',
                module: 'toolbar',
                category: matchModels(model, [BookmarkBlockModel])
                  ? 'bookmark'
                  : 'link',
                type: 'card view',
                control: 'edit',
              });
            },
          },
        ],
      },
    ],
  } as const satisfies ToolbarModuleConfig;
}

const openDocActions = [
  {
    id: 'open-in-active-view',
    label: I18n['com.affine.peek-view-controls.open-doc'](),
    icon: ExpandFullIcon(),
  },
  {
    id: 'open-in-new-view',
    label: I18n['com.affine.peek-view-controls.open-doc-in-split-view'](),
    icon: SplitViewIcon(),
    when: () => BUILD_CONFIG.isElectron,
  },
  {
    id: 'open-in-new-tab',
    label: I18n['com.affine.peek-view-controls.open-doc-in-new-tab'](),
    icon: OpenInNewIcon(),
  },
  {
    id: 'open-in-center-peek',
    label: I18n['com.affine.peek-view-controls.open-doc-in-center-peek'](),
    icon: CenterPeekIcon(),
  },
] as const satisfies ToolbarAction[];

function createOpenDocActionGroup(
  klass:
    | typeof EmbedLinkedDocBlockComponent
    | typeof EmbedSyncedDocBlockComponent
) {
  return {
    placement: ActionPlacement.Start,
    id: 'A.open-doc',
    actions: openDocActions,
    content(ctx) {
      const component = ctx.getCurrentBlockComponentBy(BlockSelection, klass);
      if (!component) return null;

      const actions = this.actions
        .map<ToolbarAction>(action => {
          const shouldOpenInCenterPeek = action.id === 'open-in-center-peek';
          const shouldOpenInActiveView = action.id === 'open-in-active-view';
          const allowed =
            typeof action.when === 'function'
              ? action.when(ctx)
              : (action.when ?? true);
          return {
            ...action,
            disabled: shouldOpenInActiveView
              ? component.model.pageId === ctx.store.id
              : false,
            when:
              allowed &&
              (shouldOpenInCenterPeek ? isPeekable(component) : true),
            run: shouldOpenInCenterPeek
              ? (_ctx: ToolbarContext) => peek(component)
              : (_ctx: ToolbarContext) =>
                  component.open({
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
  } satisfies ToolbarActionGroup<ToolbarAction>;
}

const embedLinkedDocToolbarConfig = {
  actions: [
    createOpenDocActionGroup(EmbedLinkedDocBlockComponent),
    {
      id: 'a.doc-title.after.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(
              BlockSelection,
              EmbedLinkedDocModel
            );
            if (!model) return;

            const { pageId, params } = model;

            const url = ctx.std
              .getOptional(GenerateDocUrlProvider)
              ?.generateDocUrl(pageId, params);

            if (!url) return;

            navigator.clipboard.writeText(url).catch(console.error);
            toast(ctx.host, 'Copied link to clipboard');

            ctx.track('CopiedLink', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: 'linked doc',
              type: 'card view',
              control: 'copy link',
            });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(ctx) {
            const component = ctx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedLinkedDocBlockComponent
            );
            if (!component) return;

            ctx.hide();

            const model = component.model;
            const doc = ctx.workspace.getDoc(model.pageId);
            const abortController = new AbortController();
            abortController.signal.onabort = () => ctx.show();

            toggleEmbedCardEditModal(
              ctx.host,
              component.model,
              'card',
              doc
                ? {
                    title: doc.meta?.title,
                    description: getDocContentWithMaxLength(doc),
                  }
                : undefined,
              std => {
                component.refreshData();
                notifyLinkedDocClearedAliases(std);
              },
              (_std, _component, props) => {
                ctx.store.updateBlock(model, props);
                component.requestUpdate();
              },
              abortController
            );

            ctx.track('OpenedAliasPopup', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: 'linked doc',
              type: 'embed view',
              control: 'edit',
            });
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

const embedSyncedDocToolbarConfig = {
  actions: [
    createOpenDocActionGroup(EmbedSyncedDocBlockComponent),
    {
      placement: ActionPlacement.Start,
      id: 'B.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(
              BlockSelection,
              EmbedSyncedDocModel
            );
            if (!model) return;

            const { pageId, params } = model;

            const url = ctx.std
              .getOptional(GenerateDocUrlProvider)
              ?.generateDocUrl(pageId, params);

            if (!url) return;

            navigator.clipboard.writeText(url).catch(console.error);
            toast(ctx.host, 'Copied link to clipboard');

            ctx.track('CopiedLink', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: 'linked doc',
              type: 'embed view',
              control: 'copy link',
            });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(ctx) {
            const component = ctx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedSyncedDocBlockComponent
            );
            if (!component) return;

            ctx.hide();

            const model = component.model;
            const doc = ctx.workspace.getDoc(model.pageId);
            const abortController = new AbortController();
            abortController.signal.onabort = () => ctx.show();

            toggleEmbedCardEditModal(
              ctx.host,
              model,
              'embed',
              doc ? { title: doc.meta?.title } : undefined,
              undefined,
              (std, _component, props) => {
                component.convertToCard(props);

                notifyLinkedDocSwitchedToCard(std);
              },
              abortController
            );

            ctx.track('OpenedAliasPopup', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: 'linked doc',
              type: 'embed view',
              control: 'edit',
            });
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

const inlineReferenceToolbarConfig = {
  actions: [
    {
      placement: ActionPlacement.Start,
      id: 'A.open-doc',
      actions: openDocActions,
      content(ctx) {
        const registry = ctx.toolbarRegistry;
        const target = registry.message$.peek()?.element;
        if (!(target instanceof AffineReference)) return null;

        const actions = this.actions
          .map<ToolbarAction>(action => {
            const shouldOpenInCenterPeek = action.id === 'open-in-center-peek';
            const shouldOpenInActiveView = action.id === 'open-in-active-view';
            const allowed =
              typeof action.when === 'function'
                ? action.when(ctx)
                : (action.when ?? true);
            return {
              ...action,
              disabled: shouldOpenInActiveView
                ? target.referenceInfo.pageId === ctx.store.id
                : false,
              when:
                allowed && (shouldOpenInCenterPeek ? isPeekable(target) : true),
              run: shouldOpenInCenterPeek
                ? (_ctx: ToolbarContext) => peek(target)
                : (_ctx: ToolbarContext) =>
                    target.open({
                      openMode: action.id as OpenDocMode,
                    }),
            };
          })
          .filter(action => {
            if (typeof action.when === 'function') return action.when(ctx);
            return action.when ?? true;
          });

        return html`${keyed(
          target,
          html`
            <editor-menu-button
              .contentPadding="${'8px'}"
              .button=${html`
                <editor-icon-button
                  aria-label="Open doc"
                  .tooltip=${'Open doc'}
                >
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
                        typeof disabled === 'function'
                          ? disabled(ctx)
                          : disabled
                      )}
                      @click=${() => run?.(ctx)}
                    >
                      ${icon}<span class="label">${label}</span>
                    </editor-menu-action>
                  `
                )}
              </div>
            </editor-menu-button>
          `
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    {
      id: 'b.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineReference)) return;

            const { pageId, params } = target.referenceInfo;

            const url = ctx.std
              .getOptional(GenerateDocUrlProvider)
              ?.generateDocUrl(pageId, params);

            if (!url) return;

            // Clears
            ctx.reset();

            navigator.clipboard.writeText(url).catch(console.error);
            toast(ctx.host, 'Copied link to clipboard');

            ctx.track('CopiedLink', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: 'linked doc',
              type: 'inline view',
              control: 'copy link',
            });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(ctx) {
            const target = ctx.message$.peek()?.element;
            if (!(target instanceof AffineReference)) return;

            // Clears
            ctx.reset();

            const { inlineEditor, selfInlineRange, docTitle, referenceInfo } =
              target;
            if (!inlineEditor || !selfInlineRange) return;

            const abortController = new AbortController();
            const popover = toggleReferencePopup(
              ctx.std,
              docTitle,
              referenceInfo,
              inlineEditor,
              selfInlineRange,
              abortController
            );
            abortController.signal.onabort = () => popover.remove();

            ctx.track('OpenedAliasPopup', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: 'linked doc',
              type: 'inline view',
              control: 'edit',
            });
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

const embedIframeToolbarConfig = {
  actions: [
    {
      id: 'a.copy-link-and-edit',
      actions: [
        {
          id: 'copy-link',
          tooltip: 'Copy link',
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedIframeBlockComponent
            )?.model;
            if (!model) return;

            const { url } = model;

            navigator.clipboard.writeText(url).catch(console.error);
            toast(ctx.host, 'Copied link to clipboard');

            ctx.track('CopiedLink', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: matchModels(model, [BookmarkBlockModel])
                ? 'bookmark'
                : 'link',
              type: 'card view',
              control: 'copy link',
            });
          },
        },
        {
          id: 'edit',
          tooltip: 'Edit',
          icon: EditIcon(),
          run(ctx) {
            const component = ctx.getCurrentBlockComponentBy(
              BlockSelection,
              EmbedIframeBlockComponent
            );
            if (!component) return;

            ctx.hide();

            const model = component.model;
            const abortController = new AbortController();
            abortController.signal.onabort = () => ctx.show();

            toggleEmbedCardEditModal(
              ctx.host,
              model,
              'card',
              undefined,
              undefined,
              (_std, _component, props) => {
                ctx.store.updateBlock(model, props);
                component.requestUpdate();
              },
              abortController
            );

            ctx.track('OpenedAliasPopup', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              category: matchModels(model, [BookmarkBlockModel])
                ? 'bookmark'
                : 'link',
              type: 'card view',
              control: 'edit',
            });
          },
        },
      ],
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const createCustomToolbarExtension = (
  baseUrl: string
): ExtensionType[] => {
  return [
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:*'),
      config: createToolbarMoreMenuConfigV2(baseUrl),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:bookmark'),
      config: createExternalLinkableToolbarConfig(BookmarkBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-figma'),
      config: createExternalLinkableToolbarConfig(EmbedFigmaBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-github'),
      config: createExternalLinkableToolbarConfig(EmbedGithubBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-loom'),
      config: createExternalLinkableToolbarConfig(EmbedLoomBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-youtube'),
      config: createExternalLinkableToolbarConfig(EmbedYoutubeBlockComponent),
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-linked-doc'),
      config: embedLinkedDocToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-synced-doc'),
      config: embedSyncedDocToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:reference'),
      config: inlineReferenceToolbarConfig,
    }),

    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:embed-iframe'),
      config: embedIframeToolbarConfig,
    }),
  ];
};
