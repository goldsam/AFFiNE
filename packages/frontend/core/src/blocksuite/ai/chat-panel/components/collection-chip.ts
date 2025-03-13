import { ShadowlessElement } from '@blocksuite/affine/block-std';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { AddCollectionIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

import type { CollectionChip } from '../chat-context';
import { getChipIcon, getChipTooltip } from './utils';

export class ChatPanelCollectionChip extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  @property({ attribute: false })
  accessor chip!: CollectionChip;

  override render() {
    const { state, collectionName } = this.chip;
    const isLoading = state === 'processing';
    const tooltip = getChipTooltip(state, collectionName, this.chip.tooltip);
    const collectionIcon = AddCollectionIcon();
    const icon = getChipIcon(state, collectionIcon);

    return html`<chat-panel-chip
      .state=${state}
      .name=${collectionName}
      .tooltip=${tooltip}
      .icon=${icon}
      .closeable=${!isLoading}
    ></chat-panel-chip>`;
  }
}
