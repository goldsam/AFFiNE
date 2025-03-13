import type {
  BlockLayoutPainter,
  HostToWorkerMessage,
  ViewportLayout,
  WorkerToHostMessage,
} from '../types';

class BlockPainterRegistry {
  private readonly painters = new Map<string, BlockLayoutPainter>();

  register(type: string, painter: BlockLayoutPainter) {
    this.painters.set(type, painter);
  }

  getPainter(type: string): BlockLayoutPainter | undefined {
    return this.painters.get(type);
  }
}

class ViewportLayoutPainter {
  private readonly canvas: OffscreenCanvas = new OffscreenCanvas(0, 0);
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private zoom = 1;
  public readonly registry = new BlockPainterRegistry();

  setSize(layoutRectW: number, layoutRectH: number, dpr: number, zoom: number) {
    const width = layoutRectW * dpr * zoom;
    const height = layoutRectH * dpr * zoom;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.zoom = zoom;
    this.clearBackground();
  }

  private clearBackground() {
    if (!this.canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  paint(layout: ViewportLayout, version: number) {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;
    if (layout.rect.w === 0 || layout.rect.h === 0) {
      console.warn('empty layout rect');
      return;
    }

    this.clearBackground();

    ctx.scale(this.zoom, this.zoom);

    layout.blocks.forEach(blockLayout => {
      const painter = this.registry.getPainter(blockLayout.type);
      if (!painter) return;
      painter.paint(ctx, blockLayout, layout.rect.x, layout.rect.y);
    });

    const bitmap = canvas.transferToImageBitmap();
    const message: WorkerToHostMessage = {
      type: 'bitmapPainted',
      bitmap,
      version,
    };
    self.postMessage(message, { transfer: [bitmap] });
  }
}

const painter = new ViewportLayoutPainter();

self.onmessage = async (e: MessageEvent<HostToWorkerMessage>) => {
  const { type, data } = e.data;

  switch (type) {
    case 'paintLayout': {
      const { layout, width, height, dpr, zoom, version } = data;
      painter.setSize(width, height, dpr, zoom);
      painter.paint(layout, version);
      break;
    }
    case 'registerPainter': {
      const { painterConfigs } = data;
      painterConfigs.forEach(async ({ type, path }) => {
        painter.registry.register(type, new (await import(path)).default());
      });
      break;
    }
  }
};
