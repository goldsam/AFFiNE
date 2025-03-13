import { propertyType, t } from '@blocksuite/affine/blocks/database';
import zod from 'zod';

export const memberColumnType = propertyType('member');

export const MemberItemSchema = zod.object({
  id: zod.string(),
  order: zod.string(),
});

export type MemberItemType = zod.TypeOf<typeof MemberItemSchema>;
const MemberCellRawValueTypeSchema = zod.record(zod.string(), MemberItemSchema);
export const MemberCellJsonValueTypeSchema = zod.array(zod.string());
export type MemberCellRawValueType = zod.TypeOf<
  typeof MemberCellRawValueTypeSchema
>;
export type MemberCellJsonValueType = zod.TypeOf<
  typeof MemberCellJsonValueTypeSchema
>;
export const memberPropertyModelConfig = memberColumnType.modelConfig({
  name: 'Member',
  propertyData: {
    schema: zod.object({}),
    default: () => ({}),
  },
  rawValue: {
    schema: MemberCellRawValueTypeSchema,
    default: () => ({}) as MemberCellRawValueType,
    fromString: () => ({
      value: {},
    }),
    toString: ({ value }) =>
      Object.values(value ?? {})
        ?.map(v => v.id)
        .join(',') ?? '',
    toJson: ({ value }) => Object.values(value ?? {}).map(v => v.id),
  },
  jsonValue: {
    schema: MemberCellJsonValueTypeSchema,
    type: () => t.array.instance(t.string.instance()),
    isEmpty: ({ value }) => value.length === 0,
  },
});
