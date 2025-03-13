import { ArrowDownSmallIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';

import type { Menu, MenuItem } from './types';

export function renderCurrentMenuItemWith<T, F extends keyof MenuItem<T>>(
  items: MenuItem<T>[],
  currentValue: T,
  field: F
) {
  return items.find(({ value }) => value === currentValue)?.[field];
}

export function renderMenu<T>({
  label,
  tooltip,
  icon,
  items,
  currentValue,
  onPick,
}: Menu<T>) {
  return html`
    <editor-menu-button
      .button=${html`
        <editor-icon-button
          aria-label="${label}"
          .tooltip="${tooltip ?? label}"
        >
          ${icon ?? renderCurrentMenuItemWith(items, currentValue, 'icon')}
          ${ArrowDownSmallIcon()}
        </editor-icon-button>
      `}
    >
      ${renderMenuItems(items, currentValue, onPick)}
    </editor-menu-button>
  `;
}

export function renderMenuItems<T>(
  items: MenuItem<T>[],
  currentValue: T,
  onPick: (value: T) => void
) {
  return repeat(
    items,
    item => item.value,
    ({ key, value, icon, disabled }) => html`
      <editor-icon-button
        aria-label="${ifDefined(key)}"
        .disabled=${ifDefined(disabled)}
        .tooltip="${ifDefined(key)}"
        .active="${currentValue === value}"
        .activeMode="${'background'}"
        @click=${() => onPick(value)}
      >
        ${icon}
      </editor-icon-button>
    `
  );
}
