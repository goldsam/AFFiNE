import { Injectable } from '@nestjs/common';
import { Args, Field, Mutation, ObjectType } from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import type { FileUpload } from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { TranscriptionService } from './service';
import type { TranscriptionConfig, TranscriptionItem } from './types';

@ObjectType()
class TranscriptionItemType implements TranscriptionItem {
  @Field()
  speaker!: string;

  @Field()
  start!: string;

  @Field()
  end!: string;

  @Field()
  transcription!: string;
}

@ObjectType()
class TranscriptionResultType implements TranscriptionConfig {
  @Field(() => [TranscriptionItemType], { nullable: true })
  transcription!: TranscriptionItemType[] | null;

  @Field({ nullable: true })
  summary!: string | null;
}

@Injectable()
export class TranscriptionResolver {
  constructor(private readonly service: TranscriptionService) {}

  @Mutation(() => String)
  async submitTranscriptionJob(
    @CurrentUser() userId: string,
    @Args('workspaceId') workspaceId: string,
    @Args('blobId') blobId: string,
    @Args({ name: 'blob', type: () => GraphQLUpload })
    blob: FileUpload
  ): Promise<string> {
    const jobId = await this.service.submitTranscriptionJob(
      userId,
      workspaceId,
      blobId,
      blob
    );

    return jobId;
  }

  @Mutation(() => TranscriptionResultType)
  async claimTranscriptionJob(
    @CurrentUser() userId: string,
    @Args('jobId') jobId: string
  ): Promise<TranscriptionResultType | null> {
    const result = await this.service.claimTranscriptionResult(userId, jobId);
    if (result) {
      return {
        transcription: result.transcription || null,
        summary: result.summary || null,
      };
    }
    return null;
  }
}
