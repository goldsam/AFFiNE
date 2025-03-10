import {
  defaultBlockMarkdownAdapterMatchers,
  InlineDeltaToMarkdownAdapterExtensions,
  MarkdownInlineToDeltaAdapterExtensions,
  MixTextAdapter,
  replaceIdMiddleware,
} from '@blocksuite/affine/blocks';
import { Container, type ServiceProvider } from '@blocksuite/affine/global/di';
import { Transformer } from '@blocksuite/affine/store';
import { Entity } from '@toeverything/infra';

import type { DocRecord, DocsService } from '../../doc';
import {
  getAFFiNEWorkspaceSchema,
  type WorkspaceService,
} from '../../workspace';

export class IntegrationWriter extends Entity {
  private provider: ServiceProvider | null = null;

  constructor(
    private readonly docsService: DocsService,
    private readonly workspaceService: WorkspaceService
  ) {
    super();
  }

  private _getProvider() {
    if (this.provider) {
      return this.provider;
    }

    const container = new Container();
    [
      ...MarkdownInlineToDeltaAdapterExtensions,
      ...defaultBlockMarkdownAdapterMatchers,
      ...InlineDeltaToMarkdownAdapterExtensions,
    ].forEach(ext => {
      ext.setup(container);
    });

    this.provider = container.provider();
    return this.provider;
  }

  public async writeDoc(options: {
    /**
     * Title of the doc
     */
    title?: string;
    /**
     * Markdown string
     */
    content: string;
    /**
     * Doc id, if not provided, a new doc will be created
     */
    docId?: string;
    /**
     * Update strategy, default is `override`
     */
    updateStrategy?: 'override' | 'append';
  }) {
    const provider = this._getProvider();
    const { title, content, docId, updateStrategy = 'override' } = options;

    let doc: DocRecord;
    if (!docId) {
      doc = this.docsService.createDoc();
    } else {
      const existsDoc = this.docsService.list.doc$(docId).value;
      if (!existsDoc) {
        console.warn(`doc ${docId} not found while writing markdown to doc`);
        return null;
      }
      doc = existsDoc;
    }

    if (title) {
      await this.docsService.changeDocTitle(doc.id, title);
    }

    const collection = this.workspaceService.workspace.docCollection;
    const transformer = new Transformer({
      schema: getAFFiNEWorkspaceSchema(),
      blobCRUD: collection.blobSync,
      docCRUD: {
        create: (id: string) => collection.createDoc({ id }),
        get: (id: string) => collection.getDoc(id),
        delete: (id: string) => collection.removeDoc(id),
      },
      middlewares: [replaceIdMiddleware(collection.idGenerator)],
    });

    const markdownAdapter = new MixTextAdapter(transformer, provider);
    const payload = {
      file: content,
      assets: transformer.assetsManager,
      workspaceId: this.workspaceService.workspace.id,
      pageId: doc.id,
    };

    const snapshot = await markdownAdapter.toSliceSnapshot(payload);
    if (!snapshot) {
      throw new Error('Failed to create snapshot');
    }
    const bsDoc = collection.getDoc(doc.id);
    if (!bsDoc) {
      throw new Error('Doc not found');
    }
    if (updateStrategy === 'append') {
      await transformer.snapshotToSlice(snapshot, bsDoc, bsDoc.root?.id);
    } else {
      bsDoc.root?.children.forEach(child => bsDoc.deleteBlock(child));
      await transformer.snapshotToSlice(snapshot, bsDoc, bsDoc.root?.id);
    }

    return doc;
  }
}
