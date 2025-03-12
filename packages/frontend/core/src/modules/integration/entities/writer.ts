import { type DocProps } from '@affine/core/blocksuite/initialization';
import { defaultBlockMarkdownAdapterMatchers } from '@blocksuite/affine/adapters';
import { Container, type ServiceProvider } from '@blocksuite/affine/global/di';
import {
  InlineDeltaToMarkdownAdapterExtensions,
  MarkdownInlineToDeltaAdapterExtensions,
} from '@blocksuite/affine/rich-text';
import {
  MixTextAdapter,
  replaceIdMiddleware,
} from '@blocksuite/affine/shared/adapters';
import { Transformer } from '@blocksuite/affine/store';
import { Entity } from '@toeverything/infra';

import type { DocRecord, DocsService } from '../../doc';
import type { EditorSettingService } from '../../editor-setting';
import {
  getAFFiNEWorkspaceSchema,
  type WorkspaceService,
} from '../../workspace';

export class IntegrationWriter extends Entity {
  private provider: ServiceProvider | null = null;

  constructor(
    private readonly docsService: DocsService,
    private readonly workspaceService: WorkspaceService,
    private readonly editorSettingService: EditorSettingService
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
      // Only set title for new doc
      const docProps: DocProps = {
        note: this.editorSettingService.editorSetting.get('affine:note'),
      };

      doc = this.docsService.createDoc({
        primaryMode: 'page',
        docProps,
      });
    } else {
      const existsDoc = this.docsService.list.doc$(docId).value;
      if (!existsDoc) {
        console.warn(`doc ${docId} not found while writing markdown to doc`);
        return null;
      }
      doc = existsDoc;
    }

    if (
      title &&
      doc.meta$.value.title !== title &&
      (updateStrategy === 'override' || !doc.meta$.value.title)
    ) {
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
      bsDoc.root?.children.forEach(child => {
        if (child.flavour === 'affine:page') bsDoc.deleteBlock(child);
      });
      await transformer.snapshotToSlice(snapshot, bsDoc, bsDoc.root?.id);
    }

    return doc;
  }
}
