import { Injectable } from '@nestjs/common';
import { AiJobStatus } from '@prisma/client';

import {
  CopilotPromptNotFound,
  CopilotTranscriptionJobExists,
  type FileUpload,
  JobQueue,
  mapAnyError,
  NoCopilotProviderAvailable,
  OnJob,
} from '../../../base';
import { Models } from '../../../models';
import { CopilotJobType } from '../../../models/common/copilot';
import { PromptService } from '../prompt';
import { CopilotProviderService } from '../providers';
import { CopilotStorage } from '../storage';
import {
  CopilotCapability,
  CopilotTextProvider,
  PromptMessage,
} from '../types';
import { readBufferFromStream } from '../utils';
import {
  checkTranscriptionAudioExceeded,
  TranscriptConfigSchema,
  TranscriptionConfig,
  TranscriptionSchema,
} from './types';

@Injectable()
export class CopilotTranscriptionService {
  constructor(
    private readonly models: Models,
    private readonly job: JobQueue,
    private readonly storage: CopilotStorage,
    private readonly prompt: PromptService,
    private readonly provider: CopilotProviderService
  ) {}

  async submitTranscriptionJob(
    userId: string,
    workspaceId: string,
    blobId: string,
    blob: FileUpload
  ): Promise<string> {
    if (
      await this.models.copilotJob.has(
        workspaceId,
        blobId,
        CopilotJobType.Transcription
      )
    ) {
      throw new CopilotTranscriptionJobExists();
    }

    const { id: jobId } = await this.models.copilotJob.create({
      workspaceId,
      blobId,
      createdBy: userId,
      type: CopilotJobType.Transcription,
    });

    const buffer = await readBufferFromStream(
      blob.createReadStream(),
      checkTranscriptionAudioExceeded
    );
    const url = await this.storage.put(userId, workspaceId, blobId, buffer);

    await this.models.copilotJob.update(jobId, {
      status: AiJobStatus.running,
    });

    await this.job.add('copilot.transcript.submit', {
      jobId,
      url,
      mimeType: blob.mimetype,
    });

    return jobId;
  }

  async claimTranscriptionResult(
    userId: string,
    jobId: string
  ): Promise<{
    transcription?: TranscriptionConfig;
    status?: AiJobStatus;
  } | null> {
    const status = await this.models.copilotJob.claim(jobId, userId);
    if (status === AiJobStatus.claim) {
      const transcription = await this.models.copilotJob.getConfig(
        jobId,
        TranscriptConfigSchema
      );
      return { transcription, status };
    }
    return { status };
  }

  async queryTranscriptionJobs(userId: string, workspaceId: string) {
    return this.models.copilotJob.list(
      userId,
      workspaceId,
      CopilotJobType.Transcription
    );
  }

  private async getProvider(model: string): Promise<CopilotTextProvider> {
    let provider = await this.provider.getProviderByCapability(
      CopilotCapability.TextToText,
      model
    );

    if (!provider) {
      throw new NoCopilotProviderAvailable();
    }

    return provider;
  }

  private async chatWithPrompt(
    promptName: string,
    message: Partial<PromptMessage>
  ): Promise<string> {
    const prompt = await this.prompt.get(promptName);
    if (!prompt) {
      throw new CopilotPromptNotFound({ name: promptName });
    }

    const provider = await this.getProvider(prompt.model);
    return provider.generateText(
      [...prompt.finish({}), { role: 'user', content: '', ...message }],
      prompt.model
    );
  }

  private cleanupResponse(response: string): string {
    return response
      .replace(/```[\w\s]+\n/g, '')
      .replace(/\n```/g, '')
      .trim();
  }

  @OnJob('copilot.transcript.submit')
  async transcriptAudio({
    jobId,
    url,
    mimeType,
    retry,
  }: Jobs['copilot.transcript.submit']) {
    try {
      const result = await this.chatWithPrompt('Transcript audio', {
        attachments: [url],
        params: { mimetype: mimeType },
      });

      const transcription = TranscriptionSchema.parse(
        JSON.parse(this.cleanupResponse(result))
      );
      await this.models.copilotJob.update(jobId, { config: { transcription } });

      await this.job.add('copilot.summary.submit', {
        jobId,
        transcription,
      });
    } catch (e: any) {
      if (retry === undefined || retry < 3) {
        // retry 3 times if an error occurs
        // such as the model returning content that does not conform to the schema
        await this.job.add('copilot.transcript.submit', {
          jobId,
          url,
          mimeType,
          retry: (retry ?? 0) + 1,
        });
        return;
      }
      const error = mapAnyError(e);
      error.log('Failed to transcription in job', { jobId, url, mimeType });

      await this.models.copilotJob.update(jobId, {
        status: AiJobStatus.failed,
      });
    }
  }

  @OnJob('copilot.summary.submit')
  async summaryTranscription({
    jobId,
    transcription,
    retry,
  }: Jobs['copilot.summary.submit']) {
    try {
      const content = transcription.map(t => t.transcription).join('\n');
      const result = await this.chatWithPrompt('Summary', { content });

      const config = await this.models.copilotJob.getConfig(
        jobId,
        TranscriptConfigSchema
      );
      config.summary = this.cleanupResponse(result);
      await this.models.copilotJob.update(jobId, { config });
    } catch (e: any) {
      if (retry === undefined || retry < 3) {
        // retry 3 times if an error occurs
        // such as the model returning content that does not conform to the schema
        await this.job.add('copilot.summary.submit', {
          jobId,
          transcription,
          retry: (retry ?? 0) + 1,
        });
        return;
      }
      const error = mapAnyError(e);
      error.log('Failed to summary in job', { jobId });
      await this.models.copilotJob.update(jobId, {
        status: AiJobStatus.failed,
      });
    }
  }
}
