import {
  CaptionedBlockComponent,
  SelectedStyle,
} from '@blocksuite/affine-components/caption';
import type { EmbedIframeBlockModel } from '@blocksuite/affine-model';
import {
  FeatureFlagService,
  LinkPreviewerService,
} from '@blocksuite/affine-shared/services';
import { BlockSelection } from '@blocksuite/block-std';
import { BlockSuiteError, ErrorCode } from '@blocksuite/global/exceptions';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { type ClassInfo, classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { IframeOptions } from './extension/embed-iframe-config.js';
import { EmbedIframeService } from './extension/embed-iframe-service.js';
import { embedIframeBlockStyles } from './style.js';

export type EmbedIframeStatus = 'idle' | 'loading' | 'success' | 'error';
const DEFAULT_IFRAME_HEIGHT = 152;

export class EmbedIframeBlockComponent extends CaptionedBlockComponent<EmbedIframeBlockModel> {
  selectedStyle$: ReadonlySignal<ClassInfo> | null = computed<ClassInfo>(
    () => ({
      'selected-style': this.selected$.value,
    })
  );

  blockDraggable = true;

  static override styles = embedIframeBlockStyles;

  readonly status$ = signal<EmbedIframeStatus>('idle');
  readonly error$ = signal<Error | null>(null);

  readonly isLoading$ = computed(() => this.status$.value === 'loading');
  readonly hasError$ = computed(() => this.status$.value === 'error');
  readonly isSuccess$ = computed(() => this.status$.value === 'success');

  private _iframeOptions: IframeOptions | undefined = undefined;

  get embedIframeService() {
    return this.std.get(EmbedIframeService);
  }

  get linkPreviewService() {
    return this.std.get(LinkPreviewerService);
  }

  open = () => {
    const link = this.model.url;
    window.open(link, '_blank');
  };

  refreshData = async () => {
    try {
      // set loading status
      this.status$.value = 'loading';
      this.error$.value = null;

      // get embed data
      const embedIframeService = this.embedIframeService;
      const linkPreviewService = this.linkPreviewService;
      if (!embedIframeService || !linkPreviewService) {
        throw new BlockSuiteError(
          ErrorCode.ValueNotExists,
          'EmbedIframeService or LinkPreviewerService not found'
        );
      }

      const { url } = this.model;
      if (!url) {
        throw new BlockSuiteError(
          ErrorCode.ValueNotExists,
          'No original URL provided'
        );
      }

      // get embed data and preview data in a promise
      const [embedData, previewData] = await Promise.all([
        embedIframeService.getEmbedIframeData(url),
        linkPreviewService.query(url),
      ]);

      // if the embed data is not found, and the iframeUrl is not set, throw an error
      const currentIframeUrl = this.model.iframeUrl;
      if (!embedData && !currentIframeUrl) {
        throw new BlockSuiteError(
          ErrorCode.ValueNotExists,
          'Failed to get embed data'
        );
      }

      // update model
      this.doc.updateBlock(this.model, {
        iframeUrl: embedData?.iframe_url,
        title: embedData?.title || previewData?.title,
        description: embedData?.description || previewData?.description,
      });

      // update iframe options, to ensure the iframe is rendered with the correct options
      this._updateIframeOptions(url);

      // set success status
      this.status$.value = 'success';
    } catch (err) {
      // set error status
      this.status$.value = 'error';
      this.error$.value = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to refresh iframe data:', err);
    }
  };

  private readonly _updateIframeOptions = (url: string) => {
    const config = this.embedIframeService?.getConfig(url);
    if (config) {
      this._iframeOptions = config.options;
    }
  };

  private readonly _handleDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    this.open();
  };

  private readonly _selectBlock = () => {
    const selectionManager = this.host.selection;
    const blockSelection = selectionManager.create(BlockSelection, {
      blockId: this.blockId,
    });
    selectionManager.setGroup('note', [blockSelection]);
  };

  protected readonly _handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    this._selectBlock();
  };

  private readonly _handleRetry = async () => {
    await this.refreshData();
  };

  private readonly _embedIframeBlockEnabled$: ReadonlySignal = computed(() => {
    const featureFlagService = this.doc.get(FeatureFlagService);
    const flag = featureFlagService.getFlag('enable_embed_iframe_block');
    return flag ?? false;
  });

  private readonly _renderIframe = () => {
    const { iframeUrl } = this.model;
    const {
      defaultWidth,
      defaultHeight,
      style,
      allow,
      referrerpolicy,
      scrolling,
      allowFullscreen,
    } = this._iframeOptions ?? {};
    return html`
      <iframe
        width=${defaultWidth ?? '100%'}
        height=${defaultHeight ?? DEFAULT_IFRAME_HEIGHT}
        ?allowfullscreen=${allowFullscreen}
        loading="lazy"
        frameborder="0"
        src=${ifDefined(iframeUrl)}
        allow=${ifDefined(allow)}
        referrerpolicy=${ifDefined(referrerpolicy)}
        scrolling=${ifDefined(scrolling)}
        style=${ifDefined(style)}
      ></iframe>
    `;
  };

  private readonly _renderContent = () => {
    if (this.isLoading$.value) {
      return html`<embed-iframe-loading-card
        .std=${this.std}
      ></embed-iframe-loading-card>`;
    }

    if (this.hasError$.value) {
      return html`<embed-iframe-error-card
        .error=${this.error$.value}
        .model=${this.model}
        .onRetry=${this._handleRetry}
        .std=${this.std}
      ></embed-iframe-error-card>`;
    }

    return this._renderIframe();
  };

  override connectedCallback() {
    super.connectedCallback();

    this.contentEditable = 'false';

    if (!this.model.iframeUrl) {
      this.doc.withoutTransact(() => {
        this.refreshData().catch(console.error);
      });
    } else {
      // update iframe options, to ensure the iframe is rendered with the correct options
      this._updateIframeOptions(this.model.url);
      this.status$.value = 'success';
    }

    // refresh data when original url changes
    this.disposables.add(
      this.model.propsUpdated.subscribe(({ key }) => {
        if (key === 'url') {
          this.refreshData().catch(console.error);
        }
      })
    );
  }

  override renderBlock() {
    if (!this._embedIframeBlockEnabled$.value) {
      return nothing;
    }

    const classes = classMap({
      'affine-embed-iframe-block': true,
      ...this.selectedStyle$?.value,
    });

    const style = styleMap({
      width: '100%',
    });

    return html`
      <div
        draggable=${this.blockDraggable ? 'true' : 'false'}
        class=${classes}
        style=${style}
        @click=${this._handleClick}
        @dblclick=${this._handleDoubleClick}
      >
        ${this._renderContent()}
      </div>
    `;
  }

  override accessor blockContainerStyles = { margin: '18px 0' };

  override accessor useCaptionEditor = true;

  override accessor useZeroWidth = true;

  override accessor selectedStyle = SelectedStyle.Border;
}
