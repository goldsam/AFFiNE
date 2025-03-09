import { DatabaseSelection } from '@blocksuite/affine-block-database';
import { TableSelection } from '@blocksuite/affine-block-table';
import { EditorToolbar } from '@blocksuite/affine-components/toolbar';
import {
  CodeBlockModel,
  ImageBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import {
  ToolbarContext,
  ToolbarFlag as Flag,
  ToolbarRegistryIdentifier,
} from '@blocksuite/affine-shared/services';
import { matchModels } from '@blocksuite/affine-shared/utils';
import {
  type BlockComponent,
  BlockSelection,
  SurfaceSelection,
  TextSelection,
  WidgetComponent,
} from '@blocksuite/block-std';
import {
  GfxBlockElementModel,
  type GfxController,
  type GfxModel,
  GfxPrimitiveElementModel,
} from '@blocksuite/block-std/gfx';
import {
  Bound,
  getCommonBound,
  getCommonBoundWithRotation,
} from '@blocksuite/global/gfx';
import { nextTick } from '@blocksuite/global/utils';
import type { Placement, ReferenceElement, SideObject } from '@floating-ui/dom';
import { batch, effect, signal } from '@preact/signals-core';
import { css } from 'lit';
import groupBy from 'lodash-es/groupBy';
import throttle from 'lodash-es/throttle';
import toPairs from 'lodash-es/toPairs';

import { autoUpdatePosition, renderToolbar, sideMap } from './utils';

export const AFFINE_TOOLBAR_WIDGET = 'affine-toolbar-widget';

export class AffineToolbarWidget extends WidgetComponent {
  static override styles = css`
    editor-toolbar {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      display: none;
      width: max-content;
      backface-visibility: hidden;
      z-index: var(--affine-z-index-popover);

      will-change: opacity, overlay, display, transform;
      transition-property: opacity, overlay, display;
      transition-duration: 120ms;
      transition-timing-function: ease-out;
      transition-behavior: allow-discrete;
    }

    editor-toolbar[data-open] {
      display: flex;
      opacity: 1;
      transition-timing-function: ease-in;

      @starting-style {
        opacity: 0;
      }
    }
  `;

  placement$ = signal<Placement>('top');

  sideOptions$ = signal<Partial<SideObject> | null>(null);

  referenceElement$ = signal<(() => ReferenceElement | null) | null>(null);

  setReferenceElementWithRange(range: Range | null) {
    this.referenceElement$.value = range
      ? () => ({
          getBoundingClientRect: () => range.getBoundingClientRect(),
          getClientRects: () =>
            Array.from(range.getClientRects()).filter(rect =>
              Math.round(rect.width)
            ),
        })
      : null;
  }

  setReferenceElementWithHtmlElement(element: Element | null) {
    this.referenceElement$.value = element ? () => element : null;
  }

  setReferenceElementWithBlocks(blocks: BlockComponent[]) {
    const getClientRects = () => blocks.map(e => e.getBoundingClientRect());

    this.referenceElement$.value = blocks.length
      ? () => ({
          getBoundingClientRect: () => {
            const rects = getClientRects();
            const bounds = getCommonBound(rects.map(Bound.fromDOMRect));
            if (!bounds) return rects[0];
            return new DOMRect(bounds.x, bounds.y, bounds.w, bounds.h);
          },
          getClientRects,
        })
      : null;
  }

  setReferenceElementWithElements(gfx: GfxController, elements: GfxModel[]) {
    const getBoundingClientRect = () => {
      const bounds = getCommonBoundWithRotation(elements);
      const { x: offsetX, y: offsetY } = this.getBoundingClientRect();
      const [x, y, w, h] = gfx.viewport.toViewBound(bounds).toXYWH();
      const rect = new DOMRect(x + offsetX, y + offsetY, w, h);
      return rect;
    };

    this.referenceElement$.value = elements.length
      ? () => ({
          getBoundingClientRect,
          getClientRects: () => [getBoundingClientRect()],
        })
      : null;
  }

  toolbar = new EditorToolbar();

  get toolbarRegistry() {
    return this.std.get(ToolbarRegistryIdentifier);
  }

  override connectedCallback() {
    super.connectedCallback();

    const {
      placement$,
      sideOptions$,
      referenceElement$,
      disposables,
      toolbar,
      toolbarRegistry,
      host,
      std,
    } = this;
    const { flags, elementsMap$, flavour$, message$ } = toolbarRegistry;
    const context = new ToolbarContext(std);

    // TODO(@fundon): fix toolbar position shaking when the wheel scrolls
    // document.body.append(toolbar);
    this.shadowRoot!.append(toolbar);

    // Formatting
    // Selects text in note.
    disposables.add(
      std.selection.find$(TextSelection).subscribe(result => {
        const range = std.range.value ?? null;
        const activated = Boolean(
          context.activated &&
            range &&
            result &&
            !result.isCollapsed() &&
            result.from.length + (result.to?.length ?? 0)
        );

        batch(() => {
          flags.toggle(Flag.Text, activated);

          if (!activated) return;

          this.setReferenceElementWithRange(range);

          sideOptions$.value = null;
          flavour$.value = 'affine:note';
          placement$.value = 'top';
          flags.refresh(Flag.Text);
        });
      })
    );

    // Formatting
    // Selects `native` text in database's cell or in table.
    disposables.addFromEvent(document, 'selectionchange', () => {
      const range = std.range.value ?? null;
      let activated = context.activated && Boolean(range && !range.collapsed);
      let isNative = false;

      if (activated) {
        const result = std.selection.find(DatabaseSelection);
        const viewSelection = result?.viewSelection;
        if (viewSelection) {
          isNative = true;
          activated =
            (viewSelection.selectionType === 'area' &&
              viewSelection.isEditing) ||
            (viewSelection.selectionType === 'cell' && viewSelection.isEditing);
        }

        if (!isNative) {
          const result = std.selection.find(TableSelection);
          const viewSelection = result?.data;
          if (viewSelection) {
            isNative = true;
            activated = viewSelection.type === 'area';
          }
        }
      }

      batch(() => {
        if (!isNative && !activated && flags.check(Flag.Text)) {
          flags.toggle(Flag.Text, activated);
        }

        activated &&= isNative;
        flags.toggle(Flag.Native, activated);

        if (!activated) return;

        this.setReferenceElementWithRange(range);

        sideOptions$.value = null;
        flavour$.value = 'affine:note';
        placement$.value = 'top';
        flags.refresh(Flag.Native);
      });
    });

    // Selects blocks in note.
    disposables.add(
      std.selection.filter$(BlockSelection).subscribe(selections => {
        const blockIds = selections.map(s => s.blockId);
        const count = blockIds.length;
        let flavour = 'affine:note';
        let activated = context.activated && Boolean(count);

        if (activated) {
          // Handles a signal block.
          const block = count === 1 && std.store.getBlock(blockIds[0]);

          // Chencks if block's config exists.
          if (block) {
            const modelFlavour = block.model.flavour;
            const existed =
              toolbarRegistry.modules.has(modelFlavour) ??
              toolbarRegistry.modules.has(`custom:${modelFlavour}`);
            if (existed) {
              flavour = modelFlavour;
            } else {
              activated = matchModels(block.model, [
                ParagraphBlockModel,
                ListBlockModel,
                CodeBlockModel,
                ImageBlockModel,
              ]);
            }
          }
        }

        batch(() => {
          flags.toggle(Flag.Block, activated);

          if (!activated) return;

          this.setReferenceElementWithBlocks(
            blockIds
              .map(id => std.view.getBlock(id))
              .filter(block => block !== null)
          );

          sideOptions$.value = null;
          flavour$.value = flavour;
          placement$.value = flavour === 'affine:note' ? 'top' : 'top-start';
          flags.refresh(Flag.Block);
        });
      })
    );

    // Selects elements in edgeless.
    // Triggered only when not in editing state.
    disposables.add(
      std.selection.filter$(SurfaceSelection).subscribe(selections => {
        const elementIds = selections
          .map(s => (s.editing || s.inoperable ? [] : s.elements))
          .flat();
        const count = elementIds.length;
        const gfx = context.gfx;
        const surface = gfx.surface;
        const activated =
          context.activated && Boolean(surface) && Boolean(count);
        let flavour = 'affine:surface';
        let elements: GfxModel[] = [];
        let hasLocked = false;
        let sideOptions = null;
        let paired: [string, GfxModel[]][] = [];

        if (activated && surface) {
          elements = elementIds
            .map(id => gfx.getElementById(id))
            .filter(model => model !== null) as GfxModel[];

          hasLocked = elements.some(e => e.isLocked());

          const grouped = groupBy(
            elements.map(model => {
              let flavour = surface.flavour;

              if (model instanceof GfxBlockElementModel) {
                flavour += `:${model.flavour.split(':').pop()}`;
              } else if (model instanceof GfxPrimitiveElementModel) {
                flavour += `:${model.type}`;
              }

              return { model, flavour };
            }),
            e => e.flavour
          );

          paired = toPairs(grouped).map(([flavour, items]) => [
            flavour,
            items.map(({ model }) => model),
          ]);

          if (paired.length === 1) {
            flavour = paired[0][0];
            if (
              flavour === 'affine:surface:shape' &&
              paired[0][1].length === 1
            ) {
              sideOptions = sideMap.get(flavour) ?? null;
            }
          }
          if (!sideOptions) {
            const flavours = new Set(paired.map(([f]) => f));
            if (flavours.has('affine:surface:frame')) {
              sideOptions = sideMap.get('affine:surface:frame') ?? null;
            } else if (flavours.has('affine:surface:group')) {
              sideOptions = sideMap.get('affine:surface:group') ?? null;
            }
          }
        }

        batch(() => {
          flags.toggle(Flag.Surface, activated);

          elementsMap$.value = new Map(paired);

          if (!activated || !flavour) return;

          this.setReferenceElementWithElements(gfx, elements);

          sideOptions$.value = sideOptions;
          flavour$.value = flavour;
          placement$.value = hasLocked ? 'top' : 'top-start';
          flags.refresh(Flag.Surface);
        });
      })
    );

    disposables.add(
      std.selection.slots.changed.subscribe(selections => {
        if (!context.activated) return;

        const value = flags.value$.peek();
        if (flags.contains(Flag.Hovering | Flag.Hiding, value)) return;
        if (!flags.check(Flag.Text, value)) return;

        const hasTextSelection =
          selections.filter(s => s.is(TextSelection)).length > 0;
        if (!hasTextSelection) return;

        const range = std.range.value ?? null;

        this.setReferenceElementWithRange(range);

        // TODO(@fundon): maybe here can be further optimized
        // 1. Prevents flickering effects.
        // 2. We cannot use `host.getUpdateComplete()` here
        // because it would cause excessive DOM queries, leading to UI jamming.
        nextTick()
          .then(() => flags.refresh(Flag.Text))
          .catch(console.error);
      })
    );

    // TODO(@fundon): improve these cases
    // Waits until the view is created when switching the view mode.
    // `card view` or `embed view`
    disposables.add(
      std.view.viewUpdated.subscribe(record => {
        if (record.type !== 'block') return;
        if (!flags.isBlock()) return;

        const blockIds = std.selection
          .filter$(BlockSelection)
          .peek()
          .map(s => s.blockId);

        if (record.method === 'add' && blockIds.includes(record.id)) {
          batch(() => {
            this.setReferenceElementWithBlocks(
              blockIds
                .map(id => std.view.getBlock(id))
                .filter(block => block !== null)
            );
            flags.refresh(Flag.Block);
          });
          return;
        }
      })
    );

    disposables.add(
      std.store.slots.blockUpdated.subscribe(record => {
        if (
          flags.isBlock() &&
          record.type === 'update' &&
          record.props.key === 'text'
        ) {
          flags.refresh(Flag.Block);
          return;
        }
      })
    );

    // Handles `drag and drop`
    const dragStart = () => flags.toggle(Flag.Hiding, true);
    const dragEnd = () => flags.toggle(Flag.Hiding, false);
    const eventOptions = { passive: false };
    this.handleEvent('dragStart', () => {
      dragStart();
      host.addEventListener('pointerup', dragEnd, { once: true });
    });
    this.handleEvent('nativeDrop', dragEnd);
    disposables.addFromEvent(host, 'dragenter', dragStart, eventOptions);
    disposables.addFromEvent(
      host,
      'dragleave',
      throttle(
        event => {
          const { x, y, target } = event;
          if (target === this) return;
          const rect = host.getBoundingClientRect();
          if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          )
            return;
          dragEnd();
        },
        144,
        { trailing: true }
      ),
      eventOptions
    );

    // Handles element when hovering
    disposables.add(
      message$.subscribe(data => {
        if (
          !context.activated ||
          flags.contains(Flag.Text | Flag.Native | Flag.Block)
        ) {
          flags.toggle(Flag.Hovering, false);
          return;
        }

        const activated = !!data;

        batch(() => {
          flags.toggle(Flag.Hovering, activated);

          if (!activated) return;

          const { flavour, setFloating } = data;

          setFloating(toolbar);

          this.setReferenceElementWithHtmlElement(data.element);

          sideOptions$.value = null;
          flavour$.value = flavour;
          placement$.value = 'top';
          flags.refresh(Flag.Hovering);
        });
      })
    );

    disposables.add(
      effect(() => {
        const value = flags.value$.value;

        // Hides toolbar
        if (value === Flag.None || flags.check(Flag.Hiding, value)) {
          if (toolbar.dataset.open) delete toolbar.dataset.open;
          return;
        }

        const flavour = flavour$.value;

        // Shows toolbar
        // 1. `Flag.Text`: formatting in note
        // 2. `Flag.Native`: formating in database/table
        // 3. `Flag.Block`: blocks in note
        // 4. `Flag.Hovering`: inline links in note/database/table
        // 5. `Flag.Surface`: elements in edgeless
        renderToolbar(toolbar, context, flavour);
        if (toolbar.dataset.open) return;
        toolbar.dataset.open = 'true';
      })
    );

    let abortController = new AbortController();

    disposables.add(
      effect(() => {
        if (!abortController.signal.aborted) {
          abortController.abort();
        }

        const value = flags.value$.value;

        if (
          !context.activated ||
          Flag.None === value ||
          flags.contains(Flag.Hiding, value)
        )
          return;

        const build = referenceElement$.value;
        const referenceElement = build?.();
        if (!referenceElement) return;

        const flavour = flavour$.value;
        const placement = placement$.value;
        const sideOptions = sideOptions$.value;

        if (abortController.signal.aborted) {
          abortController = new AbortController();
        }
        const signal = abortController.signal;

        const cleanup = autoUpdatePosition(
          signal,
          toolbar,
          referenceElement,
          flavour,
          placement,
          sideOptions
        );

        signal.addEventListener('abort', cleanup, { once: true });

        return () => {
          if (signal.aborted) return;
          abortController.abort();
        };
      })
    );
  }
}
