import { propertyType, t } from '@blocksuite/affine/blocks/database';
import zod from 'zod';

export const fileColumnType = propertyType('file');

const FileCellTypeSchema = zod
  .record(
    zod.object({
      id: zod.string(),
      name: zod.string(),
      order: zod.string(),
    })
  )
  .optional();
export type FileCellType = zod.TypeOf<typeof FileCellTypeSchema>;
export const filePropertyModelConfig = fileColumnType.modelConfig({
  name: 'File',
  valueSchema: FileCellTypeSchema,
  type: () => t.richText.instance(),
  defaultData: () => ({}),
  cellToString: ({ value }) =>
    Object.values(value ?? {})
      ?.map(v => v.name)
      .join(',') ?? '',
  cellFromString: () => {
    return {
      value: undefined,
    };
  },
  cellToJson: ({ value }) => {
    if (!value) return null;
    return Object.values(value).map(v => v.name);
  },
  cellFromJson: () => undefined,
  isEmpty: ({ value }) => value == null,
});
