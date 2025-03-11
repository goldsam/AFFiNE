import zod from 'zod';

import { t } from '../../core/logical/type-presets.js';
import { propertyType } from '../../core/property/property-config.js';
export const checkboxPropertyType = propertyType('checkbox');

const FALSE_VALUES = new Set([
  'false',
  'no',
  '0',
  '',
  'undefined',
  'null',
  '否',
  '不',
  '错',
  '错误',
  '取消',
  '关闭',
]);

export const checkboxPropertyModelConfig = checkboxPropertyType.modelConfig({
  name: 'Checkbox',
  propertyData: {
    schema: zod.object({}),
    default: () => ({}),
  },
  cellValue: {
    schema: zod.boolean(),
    default: () => false,
    type: () => t.boolean.instance(),
    toString: ({ value }) => (value ? 'True' : 'False'),
    fromString: ({ value }) => ({
      value: !FALSE_VALUES.has((value?.trim() ?? '').toLowerCase()),
    }),
    toJSON: ({ value }) => value ?? null,
    fromJSON: ({ value }) => (typeof value !== 'boolean' ? undefined : value),
    isEmpty: () => false,
  },
  jsonValue: {
    schema: zod.boolean(),
  },
  minWidth: 34,
});
