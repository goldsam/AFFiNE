import type { Bound } from '@blocksuite/global/gfx';

import type { GfxBlockComponent } from '../../view';
import type { GfxModel } from '../model/model';
import type { GfxElementModelView } from '../view/view';

export type DragMoveContext = {
  /**
   * The elements that are being dragged
   */
  elements: {
    view: GfxBlockComponent | GfxElementModelView;
    originalBound: Bound;
    model: GfxModel;
  }[];

  /**
   * The bound of element when drag starts
   */
  currentBound: Bound;

  /**
   * The delta x of current drag position compared to the start position in model coordinate.
   */
  dx: number;

  /**
   * The delta y of current drag position compared to the start position in model coordinate.
   */
  dy: number;
};

export type GfxViewTransformInterface = {
  onDragMoveDelta: (context: DragMoveContext) => void;
  onRotate: (context: {}) => void;
  onResize: (context: {}) => void;
};
