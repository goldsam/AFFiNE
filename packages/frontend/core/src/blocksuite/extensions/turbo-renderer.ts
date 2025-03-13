import {
  ParagraphLayoutHandlerExtension,
  ParagraphPaintConfigExtension,
} from '@blocksuite/affine/blocks/paragraph';
import {
  TurboRendererConfigFactory,
  ViewportTurboRendererExtension,
} from '@blocksuite/affine/gfx/turbo-renderer';

export function patchTurboRendererExtension() {
  return [
    ParagraphLayoutHandlerExtension,
    ParagraphPaintConfigExtension,
    TurboRendererConfigFactory({
      options: {
        zoomThreshold: 1,
        debounceTime: 1000,
      },
    }),
    ViewportTurboRendererExtension,
  ];
}
