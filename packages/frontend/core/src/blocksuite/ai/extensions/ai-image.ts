import { LifeCycleWatcher } from '@blocksuite/affine/block-std';
import { ImageBlockSpec } from '@blocksuite/affine/blocks/image';
import { AffineImageToolbarWidget } from '@blocksuite/affine/blocks/root';
import type { ExtensionType } from '@blocksuite/affine/store';

import { setupImageToolbarAIEntry } from '../entries/image-toolbar/setup-image-toolbar';

class AIImageBlockWatcher extends LifeCycleWatcher {
  static override key = 'ai-image-block-watcher';

  override mounted() {
    super.mounted();
    const { view } = this.std;
    view.viewUpdated.subscribe(payload => {
      if (payload.type !== 'widget' || payload.method !== 'add') {
        return;
      }
      const component = payload.view;
      if (component instanceof AffineImageToolbarWidget) {
        setupImageToolbarAIEntry(component);
      }
    });
  }
}

export const AIImageBlockSpec: ExtensionType[] = [
  ...ImageBlockSpec,
  AIImageBlockWatcher,
];
