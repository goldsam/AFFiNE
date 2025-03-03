import { AiJobStatus } from '@prisma/client';
import type { JsonValue } from '@prisma/client/runtime/library';

export enum CopilotJobType {
  Transcription = 'transcription',
}

export interface CopilotJob {
  id?: string;
  workspaceId: string;
  blobId: string;
  createdBy?: string;
  type: CopilotJobType;
  status?: AiJobStatus;
  config?: JsonValue;
}
