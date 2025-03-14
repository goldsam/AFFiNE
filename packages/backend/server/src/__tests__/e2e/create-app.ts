import { INestApplication } from '@nestjs/common';
import { NestApplication } from '@nestjs/core';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';

import {
  AFFiNELogger,
  CacheInterceptor,
  CloudThrottlerGuard,
  GlobalExceptionFilter,
  OneMB,
} from '../../base';
import { SocketIoAdapter } from '../../base/websocket';
import { AuthGuard } from '../../core/auth';
import { TEST_LOG_LEVEL } from '../utils';

interface TestingAppMetadata {
  tapModule?(m: TestingModuleBuilder): void;
  tapApp?(app: INestApplication): void;
}

export class TestingApp extends NestApplication {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}

export async function createApp(
  metadata: TestingAppMetadata = {}
): Promise<TestingApp> {
  const { buildAppModule } = await import('../../app.module');
  const { tapModule, tapApp } = metadata;

  const builder = Test.createTestingModule({
    imports: [buildAppModule()],
  });

  // when custom override happens
  if (tapModule) {
    tapModule(builder);
  }

  const module = await builder.compile();

  module.useCustomApplicationConstructor(TestingApp);

  const app = module.createNestApplication<TestingApp>({
    cors: true,
    bodyParser: true,
    rawBody: true,
  });

  const logger = new AFFiNELogger();
  logger.setLogLevels([TEST_LOG_LEVEL]);
  app.useLogger(logger);
  app.use(cookieParser());
  app.useBodyParser('raw', { limit: 1 * OneMB });
  app.use(
    graphqlUploadExpress({
      maxFileSize: 10 * OneMB,
      maxFiles: 5,
    })
  );

  app.useGlobalGuards(app.get(AuthGuard), app.get(CloudThrottlerGuard));
  app.useGlobalInterceptors(app.get(CacheInterceptor));
  app.useGlobalFilters(new GlobalExceptionFilter(app.getHttpAdapter()));

  const adapter = new SocketIoAdapter(app);
  app.useWebSocketAdapter(adapter);
  app.enableShutdownHooks();

  if (tapApp) {
    tapApp(app);
  }

  return app;
}
