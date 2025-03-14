import { ModuleMetadata } from '@nestjs/common';
import {
  Test,
  TestingModule as NestjsTestingModule,
  TestingModuleBuilder,
} from '@nestjs/testing';

import { FunctionalityModules } from '../app.module';
import { AFFiNELogger } from '../base';
import { TEST_LOG_LEVEL } from './utils';

interface TestingModuleMetadata extends ModuleMetadata {
  tapModule?(m: TestingModuleBuilder): void;
}

export interface TestingModule extends NestjsTestingModule {
  [Symbol.asyncDispose](): Promise<void>;
}

export async function createModule(
  metadata: TestingModuleMetadata
): Promise<TestingModule> {
  const { tapModule, ...meta } = metadata;

  const builder = Test.createTestingModule({
    ...meta,
    imports: [...FunctionalityModules, ...(meta.imports ?? [])],
  });

  // when custom override happens
  if (tapModule) {
    tapModule(builder);
  }

  const module = (await builder.compile()) as TestingModule;

  const logger = new AFFiNELogger();
  // we got a lot smoking tests try to break nestjs
  // can't tolerate the noisy logs
  logger.setLogLevels([TEST_LOG_LEVEL]);
  module.useLogger(logger);

  await module.init();
  module[Symbol.asyncDispose] = async () => {
    await module.close();
  };

  return module;
}
