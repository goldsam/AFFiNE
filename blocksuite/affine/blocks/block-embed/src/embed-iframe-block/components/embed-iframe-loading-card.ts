import { ThemeProvider } from '@blocksuite/affine-shared/services';
import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import type { BlockStdScope } from '@blocksuite/block-std';
import { EmbedIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

import { getEmbedCardIcons } from '../../common/utils';

export class EmbedIframeLoadingCard extends LitElement {
  static override styles = css`
    :host {
      width: 100%;
    }

    .affine-embed-iframe-loading-card {
      container: affine-embed-iframe-loading-card / inline-size;
      display: flex;
      box-sizing: border-box;
      width: 100%;
      border-radius: 8px;
      user-select: none;
      height: 114px;
      padding: 12px;
      align-items: flex-start;
      gap: 12px;
      overflow: hidden;
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      background: ${unsafeCSSVarV2('layer/white')};

      .loading-content {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        flex: 1 0 0;
        align-self: stretch;

        .loading-spinner {
          display: flex;
          width: 24px;
          height: 24px;
          justify-content: center;
          align-items: center;
        }

        .loading-text {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
          flex: 1 0 0;
          overflow: hidden;
          color: ${unsafeCSSVarV2('text/primary')};
          text-overflow: ellipsis;
          /* Client/smMedium */
          font-family: Inter;
          font-size: var(--affine-font-sm);
          font-style: normal;
          font-weight: 500;
          line-height: 22px; /* 157.143% */
        }
      }

      .loading-banner {
        display: flex;
        width: 204px;
        box-sizing: border-box;
        padding: 3.139px 42.14px 0px 42.14px;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;

        .icon-box {
          display: flex;
          width: 106px;
          height: 106px;
          transform: rotate(8deg);
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
          border-radius: 4px 4px 0px 0px;
          background: ${unsafeCSSVarV2('slashMenu/background')};
          box-shadow: 0px 0px 5px 0px rgba(66, 65, 73, 0.17);

          svg {
            fill: black;
            fill-opacity: 0.07;
          }
        }
      }

      @container affine-embed-iframe-loading-card (width < 480px) {
        .loading-banner {
          display: none;
        }
      }
    }
  `;

  override render() {
    const theme = this.std.get(ThemeProvider).theme;
    const { LoadingIcon } = getEmbedCardIcons(theme);
    return html`
      <div class="affine-embed-iframe-loading-card">
        <div class="loading-content">
          <div class="loading-spinner">${LoadingIcon}</div>
          <div class="loading-text">Loading...</div>
        </div>
        <div class="loading-banner">
          <div class="icon-box">
            ${EmbedIcon({ width: '66px', height: '66px' })}
          </div>
        </div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor std!: BlockStdScope;
}
