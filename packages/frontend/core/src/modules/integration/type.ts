import type { I18nString } from '@affine/i18n';

import type { DocIntegrationProperties } from '../db/schema/schema';

export type IntegrationType = NonNullable<DocIntegrationProperties['type']>;

export type IntegrationMetaMap = {
  readwise: ReadwiseIntegrationMeta;
  zotero: never;
};

export type IntegrationProperty<T extends IntegrationType> = {
  key: string;
  label?: I18nString;
  type: 'link' | 'text' | 'date' | 'source';
  /**
   * Customize how to get the property value from the original meta
   * @default `(meta) => originalMeta[key]`
   */
  get?: (meta: IntegrationMetaMap[T]) => any;
};

// ===============================
// Readwise
// ===============================
export interface ReadwiseResponse {
  count: number;
  nextPageCursor: number | null;
  results: ReadwiseBook[];
}
export interface ReadwiseBook {
  user_book_id: string | number;
  is_deleted: boolean;
  title: string;
  author: string;
  highlights: ReadwiseHighlight[];
}
export interface ReadwiseHighlight {
  id: string;
  is_deleted: boolean;
  text: string;
  location: number;
  location_type: 'page' | 'order' | 'time_offset';
  note: string | null;
  color: string;
  highlighted_at: string;
  created_at: string;
  updated_at: string;
  external_id: string;
  end_location: number | null;
  url: null;
  book_id: string | number;
  tags: string[];
  is_favorite: boolean;
  is_discard: boolean;
  readwise_url: string;
}
export type ReadwiseBookMap = Record<
  ReadwiseBook['user_book_id'],
  Omit<ReadwiseBook, 'highlights'>
>;
export interface ReadwiseIntegrationMeta {
  highlight: ReadwiseHighlight;
  book: Omit<ReadwiseBook, 'highlights'>;
}
export interface ReadwiseConfig {
  /**
   * User token
   */
  token?: string;
  /**
   * The last import time
   */
  lastImportedAt?: string;
  /**
   * The update strategy
   */
  updateStrategy?: 'override' | 'append';
}
// ===============================
// Zotero
// ===============================
// TODO
