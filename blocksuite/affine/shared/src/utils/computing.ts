import groupBy from 'lodash-es/groupBy';
import maxBy from 'lodash-es/maxBy';

export function getMostCommonValue<T, F extends keyof T>(items: T[], field: F) {
  const grouped = groupBy(items, item => item[field]);
  const values = Object.values(grouped);
  const item = maxBy(values, items => items.length)?.[0];
  return item?.[field];
}
