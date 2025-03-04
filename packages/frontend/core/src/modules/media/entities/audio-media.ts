import { DebugLogger } from '@affine/debug';
import {
  catchErrorInto,
  effect,
  Entity,
  fromPromise,
  LiveData,
  type MediaStats,
  onComplete,
  onStart,
} from '@toeverything/infra';
import { clamp } from 'lodash-es';
import { EMPTY, mergeMap, switchMap } from 'rxjs';

import type { WorkspaceService } from '../../workspace';

const logger = new DebugLogger('AttachmentBlockMedia');

/**
 * Interface for audio sources that can be played by AudioMedia
 */
export interface AudioSource {
  /**
   * The source ID (blob id) for the blob
   */
  blobId: string;

  /**
   * The metadata of the audio source Web Media Session API
   */
  metadata: MediaMetadata;
}

export type AudioMediaPlaybackState = 'idle' | 'playing' | 'paused' | 'stopped';

export interface AudioMediaSyncState {
  state: AudioMediaPlaybackState;
  seekOffset: number;
  updateTime: number; // the time when the playback state is updated
}

/**
 * Audio media entity.
 * Controls the playback of audio media.
 */
export class AudioMedia extends Entity<AudioSource> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();

    // Create audio element
    this.audioElement = new Audio();

    // Set up event listeners for the audio element
    const onPlay = () => {
      this.updatePlaybackState(
        'playing',
        this.playbackState$.getValue().seekOffset,
        Date.now()
      );
      this.updateMediaSessionPlaybackState('playing');
    };

    const onPause = () => {
      this.pause();
    };

    const onEnded = () => {
      this.pause();
    };

    // Add event listeners
    this.audioElement.addEventListener('play', onPlay);
    this.audioElement.addEventListener('pause', onPause);
    this.audioElement.addEventListener('ended', onEnded);

    this.revalidateBuffer();

    this.disposables.push(() => {
      // Clean up audio resources before calling super.dispose
      try {
        // Remove event listeners
        this.audioElement.removeEventListener('play', onPlay);
        this.audioElement.removeEventListener('pause', onPause);
        this.audioElement.removeEventListener('ended', onEnded);

        // Revoke blob URL if it exists
        if (
          this.audioElement.src &&
          this.audioElement.src.startsWith('blob:')
        ) {
          URL.revokeObjectURL(this.audioElement.src);
        }

        this.audioElement.pause();
        this.audioElement.src = '';
        this.audioElement.load(); // Reset and release resources

        // Clean up media session
        this.cleanupMediaSession();
      } catch (e) {
        // Ignore errors during cleanup
        logger.warn('Error cleaning up audio element during disposal', e);
      }
    });
  }

  audioBuffer$ = new LiveData<AudioBuffer | null>(null);
  loadingBuffer$ = new LiveData(false);
  loadError$ = new LiveData<Error | null>(null);
  waveform$ = new LiveData<number[] | null>(null);

  /**
   * LiveData that exposes the current playback state and data for global state synchronization
   */
  playbackState$ = new LiveData<AudioMediaSyncState>({
    state: 'idle',
    seekOffset: 0,
    updateTime: 0,
  });

  private readonly audioElement: HTMLAudioElement;

  private updatePlaybackState(
    state: AudioMediaPlaybackState,
    seekOffset: number,
    updateTime = Date.now()
  ) {
    this.playbackState$.setValue({
      state,
      seekOffset,
      updateTime,
    });
  }

  async getBuffer() {
    const blobId = this.props.blobId;
    if (!blobId) {
      throw new Error('Audio source ID not found');
    }

    const blobRecord =
      await this.workspaceService.workspace.engine.blob.get(blobId);

    if (!blobRecord) {
      throw new Error('Audio blob not found');
    }

    return blobRecord.data;
  }

  private async loadAudioBuffer() {
    const uint8Array = await this.getBuffer();

    // Create a blob from the uint8Array
    const blob = new Blob([uint8Array]);
    const url = URL.createObjectURL(blob);

    // Set the audio element source
    this.audioElement.src = url;

    // We still need to decode the audio data for waveform generation
    const newArrayBuffer = new ArrayBuffer(uint8Array.byteLength);
    const newUint8Array = new Uint8Array(newArrayBuffer);
    newUint8Array.set(uint8Array);

    // Create AudioContext only when needed
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(newArrayBuffer);

    return { audioBuffer, waveform: await this.calculateWaveform(audioBuffer) };
  }

  readonly revalidateBuffer = effect(
    switchMap(() => {
      return fromPromise(async () => {
        return this.loadAudioBuffer();
      }).pipe(
        mergeMap(({ audioBuffer, waveform }) => {
          this.audioBuffer$.setValue(audioBuffer);
          this.waveform$.setValue(waveform);
          // If the media is playing, resume the playback
          if (this.playbackState$.getValue().state === 'playing') {
            this.play(true);
          }
          return EMPTY;
        }),
        onStart(() => this.loadingBuffer$.setValue(true)),
        onComplete(() => {
          this.loadingBuffer$.setValue(false);
        }),
        catchErrorInto(this.loadError$)
      );
    })
  );

  get audioBuffer() {
    return this.audioBuffer$.getValue();
  }

  get waveform() {
    return this.waveform$.getValue();
  }

  getStats(): Pick<MediaStats, 'duration' | 'waveform'> {
    return {
      duration: this.audioElement.duration || this.audioBuffer?.duration || 0,
      waveform: this.waveform || [],
    };
  }

  private setupMediaSession() {
    if (!('mediaSession' in navigator)) {
      return;
    }

    // Set up media session action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      this.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.stop();
    });

    navigator.mediaSession.setActionHandler('seekto', details => {
      if (details.seekTime !== undefined) {
        this.seekTo(details.seekTime);
      }
    });
  }

  private updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !this.props.metadata) {
      return;
    }
    navigator.mediaSession.metadata = this.props.metadata;
  }

  private updateMediaSessionPositionState(seekTime: number) {
    if (!('mediaSession' in navigator)) {
      return;
    }

    const duration = this.audioElement.duration || 0;
    if (duration > 0) {
      navigator.mediaSession.setPositionState({
        duration,
        position: seekTime,
        playbackRate: 1.0,
      });
    }
  }

  private updateMediaSessionPlaybackState(state: AudioMediaPlaybackState) {
    if (!('mediaSession' in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState =
      state === 'playing' ? 'playing' : 'paused';
    this.updateMediaSessionMetadata();
  }

  private cleanupMediaSession() {
    if (!('mediaSession' in navigator)) {
      return;
    }
    navigator.mediaSession.metadata = null;
    // Reset all action handlers
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('stop', null);
    navigator.mediaSession.setActionHandler('seekto', null);
  }

  play(skipUpdate?: boolean) {
    if (!this.audioElement.src) {
      return;
    }
    const duration = this.audioElement.duration || 0;
    const currentSeek = this.getCurrentSeekPosition();
    if (!skipUpdate || currentSeek >= duration) {
      // If we're at the end of the track, reset the seek position to 0
      if (currentSeek >= duration) {
        this.audioElement.currentTime = 0;
        this.updatePlaybackState('playing', 0);
      } else {
        this.updatePlaybackState(
          'playing',
          this.playbackState$.getValue().seekOffset
        );
      }
    }

    // Play the audio element
    this.audioElement.play().catch(error => {
      logger.error('Error playing audio:', error);
      this.updatePlaybackState('paused', this.audioElement.currentTime);
    });

    // Set up media session when playback starts
    this.setupMediaSession();
    this.updateMediaSessionPositionState(this.audioElement.currentTime);
    this.updateMediaSessionPlaybackState('playing');
  }

  pause(skipUpdate?: boolean) {
    if (!this.audioElement.src) {
      return;
    }
    if (!skipUpdate) {
      // Update startSeekOffset before pausing
      this.updatePlaybackState('paused', this.audioElement.currentTime);
    }

    // Pause the audio element
    this.audioElement.pause();
    this.updateMediaSessionPlaybackState('paused');
  }

  stop(skipUpdate?: boolean) {
    if (!this.audioElement.src) {
      return;
    }
    // Pause the audio element and reset position
    this.audioElement.pause();
    this.audioElement.currentTime = 0;

    if (!skipUpdate) {
      // Reset the seek position
      this.updatePlaybackState('stopped', 0);
    }

    this.updateMediaSessionPlaybackState('stopped');

    // Clean up media session when stopped
    this.cleanupMediaSession();
  }

  // Add a seekTo method to handle seeking
  seekTo(seekTime: number, skipUpdate?: boolean) {
    if (!this.audioElement.src) {
      return;
    }

    const duration = this.audioElement.duration;
    // Clamp the time value between 0 and duration
    const clampedTime = clamp(0, seekTime, duration || 0);

    // Update the audio element's current time
    this.audioElement.currentTime = clampedTime;

    // Update startSeekOffset and startTime if playing
    const currentState = this.playbackState$.getValue();
    if (!skipUpdate) {
      this.updatePlaybackState(currentState.state, clampedTime);
    }
    this.updateMediaSessionPositionState(clampedTime);
  }

  syncState(state: AudioMediaSyncState) {
    const currentState = this.playbackState$.getValue();
    if (state.updateTime <= currentState.updateTime) {
      return;
    }
    this.updatePlaybackState(state.state, state.seekOffset, state.updateTime);
    if (state.state !== currentState.state) {
      if (state.state === 'playing') {
        this.play(true);
      } else if (state.state === 'paused') {
        this.pause(true);
      } else if (state.state === 'stopped') {
        this.stop(true);
      }
    }
    this.seekTo(state.seekOffset, true);
  }

  /**
   * Get the current playback seek position
   */
  getCurrentSeekPosition(): number {
    if (this.playbackState$.getValue().state === 'playing') {
      // For playing state, use the actual current time from audio element
      return this.audioElement.currentTime;
    }
    // For other states, return the stored offset
    return this.playbackState$.getValue().seekOffset;
  }

  /**
   * Get the playback state data
   */
  getPlaybackStateData() {
    return this.playbackState$.getValue();
  }

  /**
   * Calculate the waveform of the audio buffer for visualization
   */
  private async calculateWaveform(audioBuffer: AudioBuffer) {
    // Get the first channel's data
    const channelData = audioBuffer.getChannelData(0);
    const samples = 1000; // Number of points in the waveform
    const blockSize = Math.floor(channelData.length / samples);
    const waveform = [];

    // First pass: calculate raw averages
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      let sum = 0;

      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }

      const average = sum / blockSize;
      waveform.push(average);
    }

    // Second pass: normalize to make max value 1
    const maxValue = Math.max(...waveform);
    if (maxValue > 0) {
      for (let i = 0; i < waveform.length; i++) {
        waveform[i] = waveform[i] / maxValue;
      }
    }

    return waveform;
  }
}
