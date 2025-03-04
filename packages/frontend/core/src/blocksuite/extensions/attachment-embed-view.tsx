import type { ElementOrFactory } from '@affine/component';
import { AttachmentEmbedPreview } from '@affine/core/components/attachment-viewer/attachment-embed-preview';
import { AttachmentEmbedConfigIdentifier } from '@blocksuite/affine/blocks/attachment';
import { Bound } from '@blocksuite/affine/global/gfx';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { TemplateResult } from 'lit';

export function patchForPDFEmbedView(
  reactToLit: (
    element: ElementOrFactory,
    rerendering?: boolean
  ) => TemplateResult
): ExtensionType {
  return {
    setup: di => {
      di.override(AttachmentEmbedConfigIdentifier('pdf'), () => ({
        name: 'pdf',
        check: (model, maxFileSize) =>
          model.type === 'application/pdf' && model.size <= maxFileSize,
        action: model => {
          const bound = Bound.deserialize(model.xywh);
          bound.w = 537 + 24 + 2;
          bound.h = 759 + 46 + 24 + 2;
          model.doc.updateBlock(model, {
            embed: true,
            style: 'pdf',
            xywh: bound.serialize(),
          });
        },
        template: (model, std, _blobUrl) =>
          reactToLit(<AttachmentEmbedPreview model={model} std={std} />, false),
      }));
    },
  };
}

export function patchForAudioEmbedView(
  reactToLit: (
    element: ElementOrFactory,
    rerendering?: boolean
  ) => TemplateResult
): ExtensionType {
  return {
    setup: di => {
      di.override(AttachmentEmbedConfigIdentifier('audio'), () => ({
        name: 'audio',
        check: (model, maxFileSize) =>
          (model.type.startsWith('audio/') ||
            ['mp3', 'wav', 'ogg', 'flac', 'm4a'].some(ext =>
              model.name.toLowerCase().endsWith(`.${ext}`)
            )) &&
          model.size <= maxFileSize,
        template: (model, std, _blobUrl) =>
          reactToLit(<AttachmentEmbedPreview model={model} std={std} />, false),
      }));
    },
  };
}
