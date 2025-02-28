import { Mp3Encoder } from '@affine/native';

// encode audio samples to mp3 buffer
export function encodeToMp3(
  samples: Float32Array,
  opts: {
    channels?: number;
    sampleRate?: number;
  } = {}
): Uint8Array {
  const mp3Encoder = new Mp3Encoder({
    channels: opts.channels ?? 2,
    sampleRate: opts.sampleRate ?? 44100,
  });
  return mp3Encoder.encode(samples);
}
