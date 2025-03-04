import { createReactComponentFromLit } from '@affine/component';
import { LitTranscriptionBlock } from '@affine/core/blocksuite/ai/blocks/ai-chat-block/ai-transcription-block';
import type { BlockStdScope } from '@blocksuite/affine/block-std';
import type { TranscriptionBlockModel } from '@blocksuite/affine/model';
import { LiveData, useLiveData } from '@toeverything/infra';
import React, { useMemo } from 'react';

import * as styles from './transcription-block.css';

const AdaptedTranscriptionBlock = createReactComponentFromLit({
  react: React,
  elementClass: LitTranscriptionBlock,
});

export const TranscriptionBlock = ({
  block,
  std,
}: {
  block: TranscriptionBlockModel;
  std: BlockStdScope;
}) => {
  const childMap$ = useMemo(
    () => LiveData.fromSignal(block.childMap),
    [block.childMap]
  );
  const childMap = useLiveData(childMap$);
  if (childMap.size === 0) {
    return null;
  }
  return (
    <div className={styles.root}>
      <AdaptedTranscriptionBlock blockId={block.id} std={std} />
    </div>
  );
};
