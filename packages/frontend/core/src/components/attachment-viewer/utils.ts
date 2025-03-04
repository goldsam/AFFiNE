import type { AttachmentBlockModel } from '@blocksuite/affine/model';
import { filesize } from 'filesize';

import { downloadBlob } from '../../utils/resource';
import type { AttachmentViewerBaseProps } from './types';

export async function getAttachmentBlob(model: AttachmentBlockModel) {
  const sourceId = model.sourceId;
  if (!sourceId) {
    return null;
  }

  const doc = model.doc;
  let blob = await doc.blobSync.get(sourceId);

  if (blob) {
    blob = new Blob([blob], { type: model.type });
  }

  return blob;
}

export async function download(model: AttachmentBlockModel) {
  const blob = await getAttachmentBlob(model);
  if (!blob) return;

  await downloadBlob(blob, model.name);
}

export function buildAttachmentProps(
  model: AttachmentBlockModel
): AttachmentViewerBaseProps {
  const pieces = model.name.split('.');
  const ext = pieces.pop() || '';
  const name = pieces.join('.');
  const size = filesize(model.size);
  return { model, name, ext, size };
}

export { getAttachmentType } from '@affine/core/modules/media/utils';
