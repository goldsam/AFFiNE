import { Injectable } from '@nestjs/common';
import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import type { FileUpload } from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import { CopilotType } from '../resolver';
import { CopilotTranscriptionService } from './service';
import type { TranscriptionConfig, TranscriptionItem } from './types';

@ObjectType()
class TranscriptionItemType implements TranscriptionItem {
  @Field(() => String)
  speaker!: string;

  @Field(() => String)
  start!: string;

  @Field(() => String)
  end!: string;

  @Field(() => String)
  transcription!: string;
}

@ObjectType()
class TranscriptionResultType implements TranscriptionConfig {
  @Field(() => [TranscriptionItemType], { nullable: true })
  transcription!: TranscriptionItemType[] | null;

  @Field(() => String, { nullable: true })
  summary!: string | null;
}

@ObjectType()
class TranscriptionsJob {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  blobId!: string;

  @Field(() => String, { nullable: true })
  createdBy!: string | null;
}

@Injectable()
@Resolver(() => CopilotType)
export class CopilotTranscriptionResolver {
  constructor(
    private readonly ac: AccessController,
    private readonly service: CopilotTranscriptionService
  ) {}

  @Mutation(() => String)
  async submitTranscriptionJob(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId') workspaceId: string,
    @Args('blobId') blobId: string,
    @Args({ name: 'blob', type: () => GraphQLUpload })
    blob: FileUpload
  ): Promise<string> {
    const jobId = await this.service.submitTranscriptionJob(
      user.id,
      workspaceId,
      blobId,
      blob
    );

    return jobId;
  }

  @Mutation(() => TranscriptionResultType)
  async claimTranscriptionJob(
    @CurrentUser() user: CurrentUser,
    @Args('jobId') jobId: string
  ): Promise<TranscriptionResultType | null> {
    const result = await this.service.claimTranscriptionResult(user.id, jobId);
    if (result) {
      return {
        transcription: result.transcription || null,
        summary: result.summary || null,
      };
    }
    return null;
  }

  @ResolveField(() => [TranscriptionsJob], {})
  async transcriptionsJobs(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUser
  ): Promise<TranscriptionsJob[]> {
    if (!copilot.workspaceId) return [];
    await this.ac
      .user(user.id)
      .workspace(copilot.workspaceId)
      .allowLocal()
      .assert('Workspace.Copilot');

    return this.service.queryTranscriptionJobs(user.id, copilot.workspaceId);
  }
}
