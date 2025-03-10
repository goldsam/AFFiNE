import { Entity, LiveData } from '@toeverything/infra';
import { chunk } from 'lodash-es';

import type { IntegrationStore } from '../store/integration';
import type { ReadwiseStore } from '../store/readwise';
import type {
  ReadwiseBook,
  ReadwiseBookMap,
  ReadwiseConfig,
  ReadwiseHighlight,
  ReadwiseIntegrationMeta,
} from '../type';
import { encryptPBKDF2 } from '../utils/encrypt';
import type { IntegrationWriter } from './writer';

export class ReadwiseIntegration extends Entity<{ writer: IntegrationWriter }> {
  writer = this.props.writer;

  constructor(
    private readonly integrationStore: IntegrationStore,
    private readonly readwiseStore: ReadwiseStore
  ) {
    super();
  }

  importing$ = new LiveData(false);
  settings$ = LiveData.from(this.readwiseStore.watchSetting(), undefined);
  updateSetting<T extends keyof ReadwiseConfig>(
    key: T,
    value: ReadwiseConfig[T]
  ) {
    this.readwiseStore.setSetting(key, value);
  }

  getMeta(docId: string) {
    return this.integrationStore.getIntegration(docId)
      ?.meta as ReadwiseIntegrationMeta;
  }

  /**
   * Get all integration metas of current user & token in current workspace
   */
  async getMetas() {
    const token = this.readwiseStore.getSetting('token');
    if (!token) return [];

    const userId = this.readwiseStore.getUserId();
    const integrationId = await encryptPBKDF2(token);

    return this.integrationStore
      .getIntegrationDocs({
        type: 'readwise',
        userId,
        integrationId,
      })
      .map(integration => ({
        ...(integration.meta as ReadwiseIntegrationMeta),
        docId: integration.id,
      }));
  }

  private authHeaders(token: string) {
    return { Authorization: `Token ${token}` };
  }

  async verifyToken(token: string) {
    const response = await fetch('https://readwise.io/api/v2/auth/', {
      method: 'GET',
      headers: this.authHeaders(token),
    });
    return !!(response.ok && response.status === 204);
  }

  async crawlHighlights(options: {
    token?: string;
    lastImportedAt?: string;
    onUpdate?: (
      highlights: ReadwiseHighlight[],
      books: ReadwiseBookMap
    ) => void;
    onComplete?: (
      highlights: ReadwiseHighlight[],
      books: ReadwiseBookMap,
      lastImportedAt: string
    ) => void;
    onError?: (error: Error) => void;
    onAbort?: () => void;
    signal?: AbortSignal;
  }) {
    const { onUpdate, onError, onAbort, onComplete } = options;
    const token = options.token ?? this.readwiseStore.getSetting('token');
    const lastImportedAt =
      options.lastImportedAt ?? this.readwiseStore.getSetting('lastImportedAt');
    if (!token) {
      onError?.(new Error('Token is required'));
      return;
    }

    const highlights: ReadwiseHighlight[] = [];
    const books: ReadwiseBookMap = {};

    let nextPageCursor = null;
    const currentImportedAt = new Date().toISOString();

    try {
      while (true) {
        const queryParams = new URLSearchParams();
        if (nextPageCursor) {
          queryParams.append('pageCursor', nextPageCursor);
        }
        if (lastImportedAt) {
          queryParams.append('updatedAfter', lastImportedAt);
        }
        const response = await fetch(
          'https://readwise.io/api/v2/export/?' + queryParams.toString(),
          {
            method: 'GET',
            headers: this.authHeaders(token),
            signal: options.signal,
          }
        );
        const responseJson = await response.json();
        highlights.push(
          ...responseJson['results'].flatMap(
            (book: ReadwiseBook) => book.highlights
          )
        );
        responseJson['results'].forEach((book: ReadwiseBook) => {
          if (books[book.user_book_id]) return;
          const { highlights: _, ...copy } = book;
          books[book.user_book_id] = copy;
        });
        onUpdate?.(highlights, books);

        nextPageCursor = responseJson['nextPageCursor'];
        if (!nextPageCursor) {
          break;
        }
      }
      onComplete?.(highlights, books, currentImportedAt);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        onAbort?.();
      } else {
        onError?.(error as Error);
      }
    }
  }

  async highlightsToAffineDocs(
    highlights: ReadwiseHighlight[],
    books: ReadwiseBookMap,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
      onComplete?: () => void;
      onAbort?: (finished: number) => void;
    }
  ) {
    this.importing$.next(true);
    const disposables: (() => void)[] = [];
    try {
      const { signal, onProgress, onComplete, onAbort } = options;
      const integrationId = await encryptPBKDF2(
        this.readwiseStore.getSetting('token') ?? ''
      );
      const userId = this.readwiseStore.getUserId();
      const localMetas = await this.getMetas();
      const localMetasMap = new Map(localMetas.map(m => [m.highlight.id, m]));
      const updateStrategy = this.readwiseStore.getSetting('updateStrategy');
      const chunks = chunk(highlights, 2);
      const total = highlights.length;
      let finished = 0;

      for (const chunk of chunks) {
        if (signal?.aborted) {
          disposables.forEach(d => d());
          this.importing$.next(false);
          onAbort?.(finished);
          return;
        }
        await Promise.all(
          chunk.map(async highlight => {
            await new Promise(resolve => {
              const id = requestIdleCallback(resolve, { timeout: 500 });
              disposables.push(() => cancelIdleCallback(id));
            });
            const book = books[highlight.book_id];
            const localMeta = localMetasMap.get(highlight.id);
            const localUpdatedAt = localMeta?.highlight.updated_at;
            const localDocId = localMeta?.docId;
            // write if not matched
            if (localUpdatedAt !== highlight.updated_at) {
              await this.highlightToAffineDoc(highlight, book, localDocId, {
                updateStrategy,
                integrationId,
                userId,
              });
            }
            finished++;
            onProgress?.(finished / total);
          })
        );
      }
      onComplete?.();
    } catch (err) {
      console.error('Failed to import readwise highlights', err);
    } finally {
      disposables.forEach(d => d());
      this.importing$.next(false);
    }
  }

  async highlightToAffineDoc(
    highlight: ReadwiseHighlight,
    book: Omit<ReadwiseBook, 'highlights'>,
    docId: string | undefined,
    options: {
      integrationId: string;
      userId: string;
      updateStrategy?: ReadwiseConfig['updateStrategy'];
    }
  ) {
    const { updateStrategy, integrationId, userId } = options;
    const { text, ...highlightWithoutText } = highlight;

    const doc = await this.writer.writeDoc({
      content: text,
      title: book.title,
      docId,
      updateStrategy,
    });

    // write failed
    if (!doc) return;

    // write meta
    this.integrationStore.updateProperties(doc.id, {
      type: 'readwise',
      integrationId,
      userId,
      meta: {
        highlight: highlightWithoutText,
        book,
      },
    });
  }

  disconnect() {
    this.readwiseStore.setSetting('token', undefined);
    this.readwiseStore.setSetting('lastImportedAt', undefined);
  }
}
