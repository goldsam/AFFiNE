import {
  LifeCycleWatcher,
  LifeCycleWatcherIdentifier,
  StdIdentifier,
} from '@blocksuite/block-std';
import {
  GfxControllerIdentifier,
  type GfxViewportElement,
} from '@blocksuite/block-std/gfx';
import type { Container, ServiceIdentifier } from '@blocksuite/global/di';
import { DisposableGroup } from '@blocksuite/global/disposable';
import debounce from 'lodash-es/debounce';

import {
  debugLog,
  getViewportLayout,
  initTweakpane,
  paintPlaceholder,
  syncCanvasSize,
} from './renderer-utils.js';
import type { RenderingState, ViewportLayout } from './types.js';

const debug = false; // Toggle for debug logs
const zoomThreshold = 1; // With high enough zoom, fallback to DOM rendering
const debounceTime = 1000; // During this period, fallback to DOM
const workerUrl = new URL('./painter.worker.ts', import.meta.url);

export class ViewportTurboRendererExtension extends LifeCycleWatcher {
  public state: RenderingState = 'inactive';
  public readonly canvas: HTMLCanvasElement = document.createElement('canvas');
  private readonly worker: Worker = new Worker(workerUrl, { type: 'module' });
  private readonly disposables = new DisposableGroup();
  private layoutCacheData: ViewportLayout | null = null;
  private layoutVersion = 0;
  private bitmap: ImageBitmap | null = null;
  private viewportElement: GfxViewportElement | null = null;

  static override setup(di: Container) {
    di.addImpl(ViewportTurboRendererIdentifier, this, [StdIdentifier]);
  }

  override mounted() {
    const mountPoint = document.querySelector('.affine-edgeless-viewport');
    if (mountPoint) {
      mountPoint.append(this.canvas);
      initTweakpane(this, mountPoint as HTMLElement);
    }

    const subscription = this.viewport.elementReady.subscribe(element => {
      subscription.unsubscribe();
      this.viewportElement = element;
      syncCanvasSize(this.canvas, this.std.host);
      this.setState('pending');

      this.disposables.add(
        this.viewport.sizeUpdated.subscribe(() => this.handleResize())
      );
      this.disposables.add(
        this.viewport.viewportUpdated.subscribe(() => {
          this.refresh().catch(console.error);
        })
      );

      this.disposables.add({
        dispose: this.viewport.zooming$.subscribe(isZooming => {
          this.debugLog(`Zooming signal changed: ${isZooming}`);
          if (isZooming) {
            this.setState('zooming');
          } else if (this.state === 'zooming') {
            this.setState('pending');
            this.refresh().catch(console.error);
          }
        }),
      });
    });

    this.disposables.add(
      this.selection.slots.updated.subscribe(() => this.invalidate())
    );
    this.disposables.add(
      this.std.store.slots.blockUpdated.subscribe(() => this.invalidate())
    );
  }

  override unmounted() {
    this.debugLog('Unmounting renderer');
    this.clearBitmap();
    this.clearOptimizedBlocks();
    this.worker.terminate();
    this.canvas.remove();
    this.disposables.dispose();
    this.setState('inactive');
  }

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  get viewport() {
    return this.gfx.viewport;
  }

  get selection() {
    return this.gfx.selection;
  }

  get layoutCache() {
    if (this.layoutCacheData) return this.layoutCacheData;
    const layout = getViewportLayout(this.std.host, this.viewport);
    this.debugLog('Layout cache updated');
    return (this.layoutCacheData = layout);
  }

  async refresh() {
    if (this.state === 'inactive') return;

    this.clearCanvas();
    // -> pending
    if (this.viewport.zoom > zoomThreshold) {
      this.debugLog('Zoom above threshold, falling back to DOM rendering');
      this.setState('pending');
      this.clearOptimizedBlocks();
    }
    // -> zooming
    else if (this.isZooming()) {
      this.debugLog('Currently zooming, using placeholder rendering');
      this.setState('zooming');
      this.paintPlaceholder();
      this.updateOptimizedBlocks();
    }
    // -> ready
    else if (this.canUseBitmapCache()) {
      this.debugLog('Using cached bitmap');
      this.setState('ready');
      this.drawCachedBitmap();
      this.updateOptimizedBlocks();
    }
    // -> rendering
    else {
      this.setState('rendering');
      await this.paintLayout();
      this.drawCachedBitmap();
      this.updateOptimizedBlocks();
    }
  }

  debouncedRefresh = debounce(() => {
    this.refresh().catch(console.error);
  }, debounceTime);

  invalidate() {
    this.layoutVersion++;
    this.layoutCacheData = null;
    this.clearBitmap();
    this.clearCanvas();
    this.clearOptimizedBlocks();
    this.setState('pending');
    this.debugLog(`Invalidated renderer (layoutVersion=${this.layoutVersion})`);
  }

  private debugLog(message: string) {
    if (!debug) return;
    debugLog(message, this.state);
  }

  private clearBitmap() {
    if (!this.bitmap) return;
    this.bitmap.close();
    this.bitmap = null;
    this.debugLog('Bitmap cleared');
  }

  private async paintLayout(): Promise<void> {
    return new Promise(resolve => {
      if (!this.worker) return;

      const layout = this.layoutCache;
      const dpr = window.devicePixelRatio;
      const currentVersion = this.layoutVersion;

      this.debugLog(`Requesting bitmap painting (version=${currentVersion})`);
      this.worker.postMessage({
        type: 'paintLayout',
        data: {
          layout,
          width: layout.rect.w,
          height: layout.rect.h,
          dpr,
          zoom: this.viewport.zoom,
          version: currentVersion,
        },
      });

      this.worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'bitmapPainted') {
          if (e.data.version === this.layoutVersion) {
            this.debugLog(
              `Bitmap painted successfully (version=${e.data.version})`
            );
            this.clearBitmap();
            this.bitmap = e.data.bitmap;
            this.setState('ready');
            resolve();
          } else {
            this.debugLog(
              `Received outdated bitmap (got=${e.data.version}, current=${this.layoutVersion})`
            );
            e.data.bitmap.close();
            this.setState('pending');
            resolve();
          }
        }
      };
    });
  }

  private canUseBitmapCache(): boolean {
    // Never use bitmap cache during zooming
    if (this.isZooming()) return false;
    return !!(this.layoutCache && this.bitmap);
  }

  private isZooming(): boolean {
    return this.viewport.zooming$.value;
  }

  private clearCanvas() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.debugLog('Canvas cleared');
  }

  private drawCachedBitmap() {
    if (!this.bitmap) {
      this.debugLog('No cached bitmap available, requesting refresh');
      this.debouncedRefresh();
      return;
    }

    const layout = this.layoutCache;
    const bitmap = this.bitmap;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    this.clearCanvas();
    const layoutViewCoord = this.viewport.toViewCoord(
      layout.rect.x,
      layout.rect.y
    );

    ctx.drawImage(
      bitmap,
      layoutViewCoord[0] * window.devicePixelRatio,
      layoutViewCoord[1] * window.devicePixelRatio,
      layout.rect.w * window.devicePixelRatio * this.viewport.zoom,
      layout.rect.h * window.devicePixelRatio * this.viewport.zoom
    );

    this.debugLog('Bitmap drawn to canvas');
  }

  setState(newState: RenderingState) {
    if (this.state === newState) return;
    this.state = newState;
    this.debugLog(`State change: ${this.state} -> ${newState}`);
  }

  private canOptimize(): boolean {
    const isBelowZoomThreshold = this.viewport.zoom <= zoomThreshold;
    return (
      (this.state === 'ready' || this.state === 'zooming') &&
      isBelowZoomThreshold
    );
  }

  private updateOptimizedBlocks() {
    requestAnimationFrame(() => {
      if (!this.viewportElement || !this.layoutCache) return;
      if (!this.canOptimize()) return;

      const blockElements = this.viewportElement.getModelsInViewport();
      const blockIds = Array.from(blockElements).map(model => model.id);
      this.debugLog(`Optimized ${blockIds.length} blocks`);
    });
  }

  private clearOptimizedBlocks() {
    this.debugLog('Cleared optimized blocks');
  }

  private handleResize() {
    this.debugLog('Container resized, syncing canvas size');
    syncCanvasSize(this.canvas, this.std.host);
    this.invalidate();
    this.debouncedRefresh();
  }

  private paintPlaceholder() {
    paintPlaceholder(this.canvas, this.layoutCache, this.viewport);
  }
}

export const ViewportTurboRendererIdentifier = LifeCycleWatcherIdentifier(
  'ViewportTurboRenderer'
) as ServiceIdentifier<ViewportTurboRendererExtension>;
