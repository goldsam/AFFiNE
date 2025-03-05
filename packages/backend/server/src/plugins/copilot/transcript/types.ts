import { z } from 'zod';

export const TranscriptionSchema = z
  .object({
    speaker: z.string(),
    start: z.string(),
    end: z.string(),
    transcription: z.string(),
  })
  .array();

export const TranscriptConfigSchema = z.object({
  transcription: TranscriptionSchema.optional(),
  summary: z.string().optional(),
});

export type Transcription = z.infer<typeof TranscriptionSchema>;

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
