import { createIdentifier } from '@blocksuite/global/di';
import { Bound, Point } from '@blocksuite/global/gfx';
import { DisposableGroup } from '@blocksuite/global/slot';
import { Extension } from '@blocksuite/store';

import type {
  DragExtensionInitializeContext,
  DragInitializationOption,
  ExtensionDragEndContext,
  ExtensionDragMoveContext,
  ExtensionDragStartContext,
} from './element-transform/drag';
import { GfxExtension } from './extension';

export const TransformExtensionIdentifier =
  createIdentifier<TransformExtension>('element-transform-manager');

export class ElementTransformManager extends GfxExtension {
  static override key = 'element-transform-manager';

  private readonly _disposable = new DisposableGroup();

  override mounted(): void {
    //
  }

  override unmounted(): void {
    this._disposable.dispose();
  }

  private _safeExecute(fn: () => void, errorMessage: string) {
    try {
      fn();
    } catch (e) {
      console.error(errorMessage, e);
    }
  }

  initializeDrag(options: DragInitializationOption) {
    let cancelledByExt = false;
    const context: DragExtensionInitializeContext = {
      /**
       * The elements that are being dragged
       */
      elements: options.movingElements,

      preventDefault: () => {
        cancelledByExt = true;
      },
    };
    const extension = this.std.provider.getAll(TransformExtensionIdentifier);
    const activeExtensionHandlers = extension.values().map(ext => {
      return ext.onDragInitialize(context);
    });

    if (cancelledByExt) {
      activeExtensionHandlers.forEach(handler => handler.clear?.());
      return;
    }

    const host = this.std.host;
    const { event } = options;
    const internal = {
      elements: context.elements.map(model => {
        return {
          view: this.gfx.view.get(model)!,
          originalBound: Bound.deserialize(model.xywh),
          model: model,
        };
      }),
      dragStartPos: Point.from(
        this.gfx.viewport.toModelCoordFromClientCoord([event.x, event.y])
      ),
    };
    let dragLastPos = internal.dragStartPos;

    const onDragMove = (event: PointerEvent) => {
      dragLastPos = Point.from(
        this.gfx.viewport.toModelCoordFromClientCoord([event.x, event.y])
      );
      const moveContext: ExtensionDragMoveContext = {
        ...internal,
        event,
        dragLastPos,
        dx: dragLastPos.x - internal.dragStartPos.x,
        dy: dragLastPos.y - internal.dragStartPos.y,
      };

      this._safeExecute(() => {
        activeExtensionHandlers.forEach(handler =>
          handler.onDragMove?.(moveContext)
        );
      }, 'Error while executing extension `onDragMove`');

      internal.elements.forEach(element => {
        const { view, originalBound } = element;

        view.onDragMoveDelta({
          currentBound: originalBound,
          dx: moveContext.dx,
          dy: moveContext.dy,
          elements: internal.elements,
        });
      });
    };
    const onDragEnd = (event: PointerEvent) => {
      host.removeEventListener('pointermove', onDragMove, false);
      host.removeEventListener('pointerup', onDragEnd, false);

      dragLastPos = Point.from(
        this.gfx.viewport.toModelCoordFromClientCoord([event.x, event.y])
      );
      const endContext: ExtensionDragEndContext = {
        ...internal,
        event,
        dragLastPos,
        dx: dragLastPos.x - internal.dragStartPos.x,
        dy: dragLastPos.y - internal.dragStartPos.y,
      };

      this._safeExecute(() => {
        activeExtensionHandlers.forEach(handler =>
          handler.onDragEnd?.(endContext)
        );
      }, 'Error while executing extension `onDragEnd` handler');

      internal.elements.forEach(element => {
        const { view, model, originalBound } = element;

        view.onDragMoveDelta({
          currentBound: originalBound.moveDelta(endContext.dx, endContext.dy),
          dx: 0,
          dy: 0,
          elements: internal.elements,
        });

        model.pop('xywh');
      });

      this._safeExecute(() => {
        activeExtensionHandlers.forEach(handler => handler.clear?.());
      }, 'Error while executing extension `clear` handler');
    };
    const listenEvent = () => {
      host.addEventListener('pointermove', onDragMove, false);
      host.addEventListener('pointerup', onDragEnd, false);
    };
    const dragStart = () => {
      internal.elements.forEach(({ model }) => {
        model.stash('xywh');
      });

      const dragStartContext: ExtensionDragStartContext = {
        ...internal,
        event: event as PointerEvent,
        dragLastPos,
      };

      this._safeExecute(() => {
        activeExtensionHandlers.forEach(handler =>
          handler.onDragStart?.(dragStartContext)
        );
      }, 'Error while executing extension `onDragStart` handler');
    };

    listenEvent();
    dragStart();
  }
}

export class TransformExtension extends Extension {
  mounted() {}

  unmounted() {}

  onDragInitialize(_: DragExtensionInitializeContext): {
    onDragStart?: (context: ExtensionDragStartContext) => void;
    onDragMove?: (context: ExtensionDragMoveContext) => void;
    onDragEnd?: (context: ExtensionDragEndContext) => void;
    clear?: () => void;
  } {
    return {};
  }
}
