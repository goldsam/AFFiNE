import {
  ParagraphLayoutHandlerExtension,
  ParagraphPaintConfigExtension,
} from '@blocksuite/affine/blocks/paragraph';
import {
  TurboRendererConfigFactory,
  ViewportTurboRendererExtension,
  ViewportTurboRendererIdentifier,
} from '@blocksuite/affine/gfx/turbo-renderer';

import { addSampleNotes } from './doc-generator.js';
import { setupEditor } from './setup.js';

async function init() {
  setupEditor('edgeless', [
    ParagraphLayoutHandlerExtension,
    ParagraphPaintConfigExtension,
    TurboRendererConfigFactory({
      options: {
        zoomThreshold: 1,
        debounceTime: 1000,
      },
    }),
    ViewportTurboRendererExtension,
  ]);
  addSampleNotes(doc, 100);
  doc.load();

  const renderer = editor.std.get(
    ViewportTurboRendererIdentifier
  ) as ViewportTurboRendererExtension;
  window.renderer = renderer;
}

init();
