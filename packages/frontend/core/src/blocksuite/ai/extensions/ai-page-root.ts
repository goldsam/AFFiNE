import {
  BlockFlavourIdentifier,
  LifeCycleWatcher,
} from '@blocksuite/affine/block-std';
import { PageRootBlockSpec } from '@blocksuite/affine/blocks/root';
import { ToolbarModuleExtension } from '@blocksuite/affine/shared/services';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { FrameworkProvider } from '@toeverything/infra';

import { buildAIPanelConfig } from '../ai-panel';
import { toolbarAIEntryConfig } from '../entries';
import { setupSpaceAIEntry } from '../entries/space/setup-space';
import {
  AffineAIPanelWidget,
  aiPanelWidget,
} from '../widgets/ai-panel/ai-panel';
import { AiSlashMenuConfigExtension } from './ai-slash-menu';

function getAIPageRootWatcher(framework: FrameworkProvider) {
  class AIPageRootWatcher extends LifeCycleWatcher {
    static override key = 'ai-page-root-watcher';

    override mounted() {
      super.mounted();
      const { view } = this.std;
      view.viewUpdated.subscribe(payload => {
        if (payload.type !== 'widget' || payload.method !== 'add') {
          return;
        }
        const component = payload.view;
        if (component instanceof AffineAIPanelWidget) {
          component.style.width = '630px';
          component.config = buildAIPanelConfig(component, framework);
          setupSpaceAIEntry(component);
        }
      });
    }
  }
  return AIPageRootWatcher;
}

export function createAIPageRootBlockSpec(
  framework: FrameworkProvider
): ExtensionType[] {
  return [
    ...PageRootBlockSpec,
    aiPanelWidget,
    getAIPageRootWatcher(framework),
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:note'),
      config: toolbarAIEntryConfig(),
    }),
    AiSlashMenuConfigExtension(),
  ];
}
