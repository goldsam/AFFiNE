import type { BlockStdScope } from '@blocksuite/affine/block-std';
import type { AttachmentBlockModel } from '@blocksuite/affine/model';

export type AttachmentType = 'pdf' | 'image' | 'audio' | 'video' | 'unknown';

export type AttachmentViewerProps = {
  model: AttachmentBlockModel;
  std?: BlockStdScope;
};

export type AttachmentViewerBaseProps = {
  model: AttachmentBlockModel;
  name: string;
  ext: string;
  size: string;
};
