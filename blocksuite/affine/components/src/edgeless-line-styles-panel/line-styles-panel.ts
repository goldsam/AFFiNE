import { LineWidth, StrokeStyle } from '@blocksuite/affine-model';
import { BanIcon, DashLineIcon, StraightLineIcon } from '@blocksuite/icons/lit';
import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

export type LineDetailType =
  | {
      type: 'size';
      value: LineWidth;
    }
  | {
      type: 'style';
      value: StrokeStyle;
    };

const LINE_STYLE_LIST = [
  {
    name: 'Solid',
    value: StrokeStyle.Solid,
    icon: StraightLineIcon(),
  },
  {
    name: 'Dash',
    value: StrokeStyle.Dash,
    icon: DashLineIcon(),
  },
  {
    name: 'None',
    value: StrokeStyle.None,
    icon: BanIcon(),
  },
];

export class EdgelessLineStylesPanel extends LitElement {
  select(detail: LineDetailType) {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  }

  override render() {
    const { lineSize, lineStyle, lineStyles } = this;

    return html`
      <affine-edgeless-line-width-panel
        ?disabled=${lineStyle === StrokeStyle.None}
        .selectedSize=${lineSize}
        @select=${(e: CustomEvent<LineWidth>) => {
          e.stopPropagation();
          this.select({ type: 'size', value: e.detail });
        }}
      ></affine-edgeless-line-width-panel>

      <editor-toolbar-separator></editor-toolbar-separator>

      ${repeat(
        LINE_STYLE_LIST.filter(item => lineStyles.includes(item.value)),
        item => item.value,
        ({ name, icon, value }) => {
          const active = lineStyle === value;
          const classInfo = {
            'line-style-button': true,
            [`mode-${value}`]: true,
          };
          if (active) classInfo['active'] = true;

          return html`
            <editor-icon-button
              class=${classMap(classInfo)}
              .tooltip="${name}"
              .withHover=${active}
              @click=${() => this.select({ type: 'style', value })}
            >
              ${icon}
            </editor-icon-button>
          `;
        }
      )}
    `;
  }

  @property({ attribute: false })
  accessor lineStyle!: StrokeStyle;

  @property({ attribute: false })
  accessor lineSize: LineWidth = LineWidth.Two;

  @property({ attribute: false })
  accessor lineStyles: StrokeStyle[] = [
    StrokeStyle.Solid,
    StrokeStyle.Dash,
    StrokeStyle.None,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-edgeless-line-styles-panel': EdgelessLineStylesPanel;
  }
}
