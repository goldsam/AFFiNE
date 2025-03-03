import { AiJobStatus, PrismaClient } from '@prisma/client';
import ava, { TestFn } from 'ava';

import { Config } from '../../base';
import { CopilotJobModel } from '../../models';
import { CopilotJobType } from '../../models/common/copilot';
import { UserModel } from '../../models/user';
import { WorkspaceModel } from '../../models/workspace';
import { createTestingModule, type TestingModule } from '../utils';

interface Context {
  config: Config;
  module: TestingModule;
  db: PrismaClient;
  user: UserModel;
  workspace: WorkspaceModel;
  copilotJob: CopilotJobModel;
}

const test = ava as TestFn<Context>;

test.before(async t => {
  const module = await createTestingModule();
  t.context.user = module.get(UserModel);
  t.context.workspace = module.get(WorkspaceModel);
  t.context.copilotJob = module.get(CopilotJobModel);
  t.context.db = module.get(PrismaClient);
  t.context.config = module.get(Config);
  t.context.module = module;
});

test.beforeEach(async t => {
  await t.context.module.initTestingDB();
});

test.after(async t => {
  await t.context.module.close();
});

test('should create a copilot job', async t => {
  const user = await t.context.user.create({
    email: 'test@affine.pro',
  });
  const workspace = await t.context.workspace.create(user.id);

  const data = {
    workspaceId: workspace.id,
    blobId: 'blob-id',
    createdBy: user.id,
    type: CopilotJobType.Transcription,
  };

  const job = await t.context.copilotJob.create(data);

  t.truthy(job.id);

  const job1 = await t.context.copilotJob.get(job.id);
  t.deepEqual(
    {
      ...data,
      id: job.id,
      status: AiJobStatus.pending,
      config: {},
    },
    job1
  );
});

test('should get null for non-exist job', async t => {
  const job = await t.context.copilotJob.get('non-exist');
  t.is(job, null);
});

test('should update job', async t => {
  const user = await t.context.user.create({
    email: 'test@affine.pro',
  });
  const workspace = await t.context.workspace.create(user.id);
  const { id: jobId } = await t.context.copilotJob.create({
    workspaceId: workspace.id,
    blobId: 'blob-id',
    createdBy: user.id,
    type: CopilotJobType.Transcription,
  });
  const job = await t.context.copilotJob.get(jobId);

  const data = {
    status: AiJobStatus.running,
    config: { foo: 'bar' },
  };
  await t.context.copilotJob.update(jobId, data);
  const job1 = await t.context.copilotJob.get(jobId);
  t.deepEqual(job1, { ...job, ...data });
});
