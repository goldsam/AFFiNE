import { Entity, LiveData } from '@toeverything/infra';
import { chunk } from 'lodash-es';

import type { DocsService } from '../../doc';
import { IntegrationPropertyService } from '../services/integration-property';
import type { IntegrationRefStore } from '../store/integration-ref';
import type { ReadwiseStore } from '../store/readwise';
import type {
  ReadwiseBook,
  ReadwiseBookMap,
  ReadwiseConfig,
  ReadwiseHighlight,
  ReadwiseRefMeta,
  ReadwiseResponse,
} from '../type';
import { encryptPBKDF2 } from '../utils/encrypt';
import type { IntegrationWriter } from './writer';

export class ReadwiseIntegration extends Entity<{ writer: IntegrationWriter }> {
  writer = this.props.writer;

  constructor(
    private readonly integrationRefStore: IntegrationRefStore,
    private readonly readwiseStore: ReadwiseStore,
    private readonly docsService: DocsService
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

  /**
   * Get all integration metas of current user & token in current workspace
   */
  async getRefs() {
    const token = this.readwiseStore.getSetting('token');
    if (!token) return [];

    const integrationId = await encryptPBKDF2(token);

    return this.integrationRefStore
      .getRefs({ type: 'readwise', integrationId })
      .map(ref => ({
        ...ref,
        refMeta: ref.refMeta as ReadwiseRefMeta,
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
          queryParams.append('pageCursor', nextPageCursor.toString());
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
        const responseJson = (await response.json()) as ReadwiseResponse;
        highlights.push(
          ...responseJson.results.flatMap(
            (book: ReadwiseBook) => book.highlights
          )
        );
        responseJson.results.forEach((book: ReadwiseBook) => {
          if (books[book.user_book_id]) return;
          const { highlights: _, ...copy } = book;
          books[book.user_book_id] = copy;
        });
        onUpdate?.(highlights, books);

        nextPageCursor = responseJson.nextPageCursor;
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
      const localRefs = await this.getRefs();
      const localRefsMap = new Map(
        localRefs.map(ref => [ref.refMeta.highlightId, ref])
      );
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
            const localRef = localRefsMap.get(highlight.id);
            const refMeta = localRef?.refMeta;
            const localUpdatedAt = refMeta?.updatedAt;
            const localDocId = localRef?.id;
            // write if not matched
            if (localUpdatedAt !== highlight.updated_at && !signal?.aborted) {
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
    const { updateStrategy, integrationId } = options;
    const { text, ...highlightWithoutText } = highlight;

    const writtenDocId = await this.writer.writeDoc({
      content: text,
      title: book.title,
      docId,
      comment: highlight.note,
      updateStrategy,
    });

    // write failed
    if (!writtenDocId) return;

    const { doc, release } = this.docsService.open(writtenDocId);
    const integrationPropertyService = doc.scope.get(
      IntegrationPropertyService
    );

    // write doc properties
    integrationPropertyService.updateIntegrationProperties('readwise', {
      ...highlightWithoutText,
      ...book,
    });
    release();

    // update integration ref
    this.integrationRefStore.createRef(doc.id, {
      type: 'readwise',
      integrationId,
      refMeta: {
        highlightId: highlight.id,
        updatedAt: highlight.updated_at,
      },
    });
  }

  disconnect() {
    this.readwiseStore.setSetting('token', undefined);
    this.readwiseStore.setSetting('lastImportedAt', undefined);
  }
}
