import { BlockPainterConfigIdentifier } from '@blocksuite/affine-gfx-turbo-renderer';
import type { Container } from '@blocksuite/global/di';
import { Extension } from '@blocksuite/store';

export class ParagraphPaintConfigExtension extends Extension {
  static override setup(di: Container) {
    const config = {
      type: 'affine:paragraph',
      path: new URL(
        '@blocksuite/affine-block-paragraph/turbo-painter',
        import.meta.url
      ).href,
    };
    di.addImpl(BlockPainterConfigIdentifier, config);
  }
}
