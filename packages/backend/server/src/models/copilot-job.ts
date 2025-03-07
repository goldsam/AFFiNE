import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AiJobStatus } from '@prisma/client';
import type { ZodType } from 'zod';

import { BaseModel } from './base';
import { CopilotJob, CopilotJobType } from './common/copilot';

type CreateCopilotJobInput = Omit<CopilotJob, 'id' | 'status' | 'config'>;
type UpdateCopilotJobInput = Pick<CopilotJob, 'status' | 'config'>;

/**
 * Copilot Job Model
 */
@Injectable()
export class CopilotJobModel extends BaseModel {
  async create(job: CreateCopilotJobInput) {
    const row = await this.db.aiJobs.create({
      data: {
        workspaceId: job.workspaceId,
        blobId: job.blobId,
        createdBy: job.createdBy,
        type: job.type,
        status: AiJobStatus.pending,
        config: {},
      },
      select: {
        id: true,
      },
    });
    return row;
  }

  async update(jobId: string, data: UpdateCopilotJobInput) {
    const ret = await this.db.aiJobs.updateMany({
      where: {
        id: jobId,
      },
      data: {
        status: data.status || undefined,
        config: data.config || undefined,
      },
    });
    return ret.count > 0;
  }

  @Transactional()
  async claim(jobId: string, userId: string) {
    const job = await this.get(jobId);

    if (job) {
      if (job.status === AiJobStatus.claim) {
        return true;
      } else if (
        job?.createdBy === userId &&
        job.status === AiJobStatus.finished
      ) {
        return await this.update(jobId, { status: AiJobStatus.finished });
      }
    }

    return false;
  }

  async list(userId: string, workspaceId: string, type?: CopilotJobType) {
    const jobs = await this.db.aiJobs.findMany({
      where: {
        workspaceId,
        type,
        OR: [
          {
            createdBy: userId,
            status: { in: [AiJobStatus.finished, AiJobStatus.claim] },
          },
          { createdBy: { not: userId }, status: AiJobStatus.claim },
        ],
      },
      select: {
        id: true,
        workspaceId: true,
        blobId: true,
        createdBy: true,
        type: true,
        status: true,
      },
    });
    return jobs;
  }

  async get(jobId: string): Promise<CopilotJob | null> {
    const row = await this.db.aiJobs.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      blobId: row.blobId,
      createdBy: row.createdBy || undefined,
      type: row.type as CopilotJobType,
      status: row.status,
      config: row.config,
    };
  }

  async getConfig<
    C extends ZodType<any>,
    O = C extends ZodType<infer T> ? T : never,
  >(jobId: string, schema: C): Promise<O> {
    const row = await this.db.aiJobs.findUnique({
      where: {
        id: jobId,
      },
      select: {
        config: true,
      },
    });

    const ret = schema.safeParse(row?.config);
    return ret.success ? ret.data : ({} as O);
  }
}
