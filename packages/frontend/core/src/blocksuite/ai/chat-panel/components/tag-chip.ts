import { ShadowlessElement } from '@blocksuite/affine/block-std';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import type { TagChip } from '../chat-context';
import { getChipIcon, getChipTooltip } from './utils';

export class ChatPanelTagChip extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .tag-icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tag-icon {
      border-radius: 50%;
      height: 8px;
      width: 8px;
      margin: 4px;
      background-color: var(--affine-color-secondary);
    }
  `;

  @property({ attribute: false })
  accessor chip!: TagChip;

  override render() {
    const { state, tagName, tagColor } = this.chip;
    const isLoading = state === 'processing';
    const tooltip = getChipTooltip(state, tagName, this.chip.tooltip);
    const tagIcon = html`
      <div class="tag-icon-container">
        <div class="tag-icon" style="background-color: ${tagColor};"></div>
      </div>
    `;
    const icon = getChipIcon(state, tagIcon);

    return html`<chat-panel-chip
      .state=${state}
      .name=${tagName}
      .tooltip=${tooltip}
      .icon=${icon}
      .closeable=${!isLoading}
    ></chat-panel-chip>`;
  }
}
