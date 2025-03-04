import type { BlockStdScope } from '@blocksuite/affine/block-std';
import {
  BlockComponent,
  BlockViewExtension,
  stdContext,
} from '@blocksuite/affine/block-std';
import type { TranscriptionBlockModel } from '@blocksuite/affine/model';
import type { ExtensionType } from '@blocksuite/affine/store';
import { consume } from '@lit/context';
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { literal } from 'lit/static-html.js';

export class LitTranscriptionBlock extends BlockComponent<TranscriptionBlockModel> {
  override render() {
    return this.std.host.renderChildren(this.model);
  }

  @property({ type: String, attribute: 'data-block-id' })
  override accessor blockId!: string;

  @property({ type: Object })
  @consume({ context: stdContext })
  override accessor std!: BlockStdScope;

  constructor() {
    super();
    // questionable:
    this.widgets = {};
  }

  override firstUpdated(changedProperties: PropertyValues) {
    super.firstUpdated(changedProperties);
    this.disposables.addFromEvent(this, 'click', this.onClick);
  }

  protected onClick(event: MouseEvent) {
    event.stopPropagation();
  }
}

export const AITranscriptionBlockSpec: ExtensionType[] = [
  BlockViewExtension('affine:transcription', () => {
    return literal`transcription-block`;
  }),
];
