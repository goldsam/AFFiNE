import { Button } from '@affine/component';
import type { AudioAttachmentBlock } from '@affine/core/modules/media/entities/audio-attachment-block';
import { useAttachmentMediaBlock } from '@affine/core/modules/media/views/use-attachment-media';
import { useI18n } from '@affine/i18n';
import { TranscriptWithAiIcon } from '@blocksuite/icons/rc';
import { useLiveData } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { AudioPlayer } from '../../audio-player';
import { useSeekTime } from '../../audio-player/use-seek-time';
import { useEnableAI } from '../../hooks/affine/use-enable-ai';
import type { AttachmentViewerProps } from '../types';
import * as styles from './audio-block.css';
import { TranscriptionBlock } from './transcription-block';

const AttachmentAudioPlayer = ({ block }: { block: AudioAttachmentBlock }) => {
  const audioMedia = block.audioMedia;
  const playbackState = useLiveData(audioMedia.playbackState$);
  const buffer = useLiveData(audioMedia.audioBuffer$);
  const waveform = useLiveData(audioMedia.waveform$);
  const duration = buffer?.duration || 0;
  const expanded = useLiveData(block.expanded$);
  const transcribing = useLiveData(block.transcribing$);
  const transcribed = useLiveData(block.transcribed$);
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  const seekTime = useSeekTime(playbackState);

  const handlePlay = useCallback(() => {
    audioMedia?.play();
  }, [audioMedia]);

  const handlePause = useCallback(() => {
    audioMedia?.pause();
  }, [audioMedia]);

  const handleStop = useCallback(() => {
    audioMedia?.stop();
  }, [audioMedia]);

  const handleSeek = useCallback(
    (time: number) => {
      audioMedia?.seekTo(time);
    },
    [audioMedia]
  );

  const t = useI18n();

  const enableAi = useEnableAI();

  const notesEntry = useMemo(() => {
    if (!enableAi) {
      return null;
    }
    return (
      <Button
        variant="plain"
        prefix={<TranscriptWithAiIcon />}
        loading={transcribing}
        disabled={transcribing}
        size="large"
        prefixClassName={styles.notesButtonIcon}
        className={styles.notesButton}
        onClick={() => {
          if (transcribed) {
            block.expanded$.setValue(!expanded);
          } else {
            block.transcribe();
          }
        }}
      >
        {transcribing
          ? t['com.affine.attachmentViewer.audio.transcribing']()
          : t['com.affine.attachmentViewer.audio.notes']()}
      </Button>
    );
  }, [enableAi, transcribing, t, transcribed, block, expanded]);

  return (
    <AudioPlayer
      name={block.props.name}
      size={block.props.size}
      playbackState={playbackState?.state || 'idle'}
      waveform={waveform}
      seekTime={seekTime}
      duration={duration}
      onClick={handleClick}
      onPlay={handlePlay}
      onPause={handlePause}
      onStop={handleStop}
      onSeek={handleSeek}
      notesEntry={notesEntry}
    />
  );
};

export const AudioBlockEmbedded = (props: AttachmentViewerProps) => {
  const audioAttachmentBlock = useAttachmentMediaBlock(props.model);
  const transcriptionBlock = useLiveData(
    audioAttachmentBlock?.transcriptionBlock$
  );
  const expanded = useLiveData(audioAttachmentBlock?.expanded$);
  return (
    <div className={styles.root}>
      {audioAttachmentBlock && (
        <AttachmentAudioPlayer block={audioAttachmentBlock} />
      )}
      {transcriptionBlock && expanded && props.std && (
        <TranscriptionBlock block={transcriptionBlock} std={props.std} />
      )}
    </div>
  );
};
