import type { AudioMediaPlaybackState } from '@affine/core/modules/media/entities/audio-media';
import { useEffect, useState } from 'react';

export const useSeekTime = (
  playbackState:
    | {
        state: AudioMediaPlaybackState;
        seekOffset: number;
        updateTime: number;
      }
    | undefined
    | null
) => {
  const [seekTime, setSeekTime] = useState(0);
  useEffect(() => {
    if (!playbackState) {
      return;
    }
    const updateSeekTime = () => {
      if (playbackState) {
        const timeElapsed =
          playbackState.state === 'playing'
            ? (Date.now() - playbackState.updateTime) / 1000
            : 0;
        setSeekTime(timeElapsed + playbackState.seekOffset);
      }
    };
    updateSeekTime();
    const interval = setInterval(updateSeekTime, 16.67);
    return () => clearInterval(interval);
  }, [playbackState]);

  return seekTime;
};
