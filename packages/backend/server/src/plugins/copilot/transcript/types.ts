import { z } from 'zod';

import { OneMB } from '../../../base';

const TranscriptionItemSchema = z.object({
  speaker: z.string(),
  start: z.string(),
  end: z.string(),
  transcription: z.string(),
});

export const TranscriptionSchema = z.array(TranscriptionItemSchema);

export const TranscriptConfigSchema = z.object({
  transcription: TranscriptionSchema.nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type TranscriptionItem = z.infer<typeof TranscriptionItemSchema>;
export type Transcription = z.infer<typeof TranscriptionSchema>;
export type TranscriptionConfig = z.infer<typeof TranscriptConfigSchema>;

declare global {
  interface Jobs {
    'copilot.transcript.submit': {
      jobId: string;
      url: string;
      mimeType: string;
      retry?: number;
    };
    'copilot.summary.submit': {
      jobId: string;
      transcription: Transcription;
      retry?: number;
    };
  }
}

export const MAX_TRANSCRIPTION_SIZE = 50 * OneMB;

export function checkTranscriptionAudioExceeded(recvSize: number) {
  return recvSize > MAX_TRANSCRIPTION_SIZE;
}
