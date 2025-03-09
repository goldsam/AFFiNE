import { EdgelessLineWidthPanel } from './line-width-panel';

export * from './line-width-panel';

export function effects() {
  customElements.define(
    'affine-edgeless-line-width-panel',
    EdgelessLineWidthPanel
  );
}
