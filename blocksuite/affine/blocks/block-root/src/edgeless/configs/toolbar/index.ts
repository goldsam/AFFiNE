import { ToolbarModuleExtension } from '@blocksuite/affine-shared/services';
import { BlockFlavourIdentifier } from '@blocksuite/block-std';
import type { ExtensionType } from '@blocksuite/store';

import { builtinBrushToolbarConfig } from './brush';
import { builtinConnectorToolbarConfig } from './connector';
import { builtinFrameToolbarConfig } from './frame';
import { builtinGroupToolbarConfig } from './group';
import { builtinMindmapToolbarConfig } from './mindmap';
import { builtinMiscToolbarConfig } from './misc';
import { builtinNoteToolbarConfig } from './note';
import { builtinShapeToolbarConfig } from './shape';
import { builtinTextToolbarConfig } from './text';

export const EdgelessElementToolbarExtension: ExtensionType[] = [
  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:brush'),
    config: builtinBrushToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:connector'),
    config: builtinConnectorToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:frame'),
    config: builtinFrameToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:group'),
    config: builtinGroupToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:mindmap'),
    config: builtinMindmapToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:note'),
    config: builtinNoteToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:shape'),
    config: builtinShapeToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:text'),
    config: builtinTextToolbarConfig,
  }),

  ToolbarModuleExtension({
    id: BlockFlavourIdentifier('affine:surface:*'),
    config: builtinMiscToolbarConfig,
  }),
];
