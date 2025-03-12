import type { EditorHost, GfxBlockComponent } from '@blocksuite/block-std';
import {
  clientToModelCoord,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type Viewport,
} from '@blocksuite/block-std/gfx';
import { Pane } from 'tweakpane';

import { getSentenceRects, segmentSentences } from './text-utils.js';
import type { ViewportTurboRendererExtension } from './turbo-renderer.js';
import type {
  ParagraphLayout,
  RenderingState,
  ViewportLayout,
} from './types.js';

export function syncCanvasSize(canvas: HTMLCanvasElement, host: HTMLElement) {
  const hostRect = host.getBoundingClientRect();
  const dpr = window.devicePixelRatio;
  canvas.style.position = 'absolute';
  canvas.style.left = '0px';
  canvas.style.top = '0px';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.width = hostRect.width * dpr;
  canvas.height = hostRect.height * dpr;
  canvas.style.pointerEvents = 'none';
}

function getParagraphs(host: EditorHost) {
  const gfx = host.std.get(GfxControllerIdentifier);
  const models = gfx.gfxElements.filter(e => e instanceof GfxBlockElementModel);
  const components = models
    .map(model => gfx.view.get(model.id))
    .filter(Boolean) as GfxBlockComponent[];

  const paragraphs: ParagraphLayout[] = [];
  const selector = '.affine-paragraph-rich-text-wrapper [data-v-text="true"]';

  components.forEach(component => {
    const paragraphNodes = component.querySelectorAll(selector);
    const viewportRecord = component.gfx.viewport.deserializeRecord(
      component.dataset.viewportState
    );
    if (!viewportRecord) return;
    const { zoom, viewScale } = viewportRecord;

    paragraphNodes.forEach(paragraphNode => {
      const paragraph: ParagraphLayout = {
        sentences: [],
      };
      const sentences = segmentSentences(paragraphNode.textContent || '');
      paragraph.sentences = sentences.map(sentence => {
        const sentenceRects = getSentenceRects(paragraphNode, sentence);
        const rects = sentenceRects.map(({ text, rect }) => {
          const [modelX, modelY] = clientToModelCoord(viewportRecord, [
            rect.x,
            rect.y,
          ]);
          return {
            text,
            ...rect,
            rect: {
              x: modelX,
              y: modelY,
              w: rect.w / zoom / viewScale,
              h: rect.h / zoom / viewScale,
            },
          };
        });
        return {
          text: sentence,
          rects,
        };
      });

      paragraphs.push(paragraph);
    });
  });

  return paragraphs;
}

export function getViewportLayout(
  host: EditorHost,
  viewport: Viewport
): ViewportLayout {
  const zoom = viewport.zoom;

  let layoutMinX = Infinity;
  let layoutMinY = Infinity;
  let layoutMaxX = -Infinity;
  let layoutMaxY = -Infinity;

  const paragraphs = getParagraphs(host);
  paragraphs.forEach(paragraph => {
    paragraph.sentences.forEach(sentence => {
      sentence.rects.forEach(r => {
        layoutMinX = Math.min(layoutMinX, r.rect.x);
        layoutMinY = Math.min(layoutMinY, r.rect.y);
        layoutMaxX = Math.max(layoutMaxX, r.rect.x + r.rect.w);
        layoutMaxY = Math.max(layoutMaxY, r.rect.y + r.rect.h);
      });
    });
  });

  const layoutModelCoord = [layoutMinX, layoutMinY];
  const w = (layoutMaxX - layoutMinX) / zoom / viewport.viewScale;
  const h = (layoutMaxY - layoutMinY) / zoom / viewport.viewScale;
  const layout: ViewportLayout = {
    paragraphs,
    rect: {
      x: layoutModelCoord[0],
      y: layoutModelCoord[1],
      w: Math.max(w, 0),
      h: Math.max(h, 0),
    },
  };
  return layout;
}

export function initTweakpane(
  renderer: ViewportTurboRendererExtension,
  viewportElement: HTMLElement
) {
  const debugPane = new Pane({ container: viewportElement });
  const paneElement = debugPane.element;
  paneElement.style.position = 'absolute';
  paneElement.style.top = '10px';
  paneElement.style.right = '10px';
  paneElement.style.width = '250px';
  debugPane.title = 'Viewport Turbo Renderer';
  debugPane.addButton({ title: 'Invalidate' }).on('click', () => {
    renderer.invalidate();
  });
}

export function debugLog(message: string, state: RenderingState) {
  console.log(
    `%c[ViewportTurboRenderer]%c ${message} | state=${state}`,
    'color: #4285f4; font-weight: bold;',
    'color: inherit;'
  );
}

export function paintPlaceholder(
  canvas: HTMLCanvasElement,
  layout: ViewportLayout | null,
  viewport: Viewport
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (!layout) return;
  const dpr = window.devicePixelRatio;
  const layoutViewCoord = viewport.toViewCoord(layout.rect.x, layout.rect.y);

  const offsetX = layoutViewCoord[0];
  const offsetY = layoutViewCoord[1];
  const colors = [
    'rgba(200, 200, 200, 0.7)',
    'rgba(180, 180, 180, 0.7)',
    'rgba(160, 160, 160, 0.7)',
  ];

  layout.paragraphs.forEach((paragraph, paragraphIndex) => {
    ctx.fillStyle = colors[paragraphIndex % colors.length];
    const renderedPositions = new Set<string>();

    paragraph.sentences.forEach(sentence => {
      sentence.rects.forEach(textRect => {
        const x =
          ((textRect.rect.x - layout.rect.x) * viewport.zoom + offsetX) * dpr;
        const y =
          ((textRect.rect.y - layout.rect.y) * viewport.zoom + offsetY) * dpr;
        dpr;
        const width = textRect.rect.w * viewport.zoom * dpr;
        const height = textRect.rect.h * viewport.zoom * dpr;

        const posKey = `${x},${y}`;
        if (renderedPositions.has(posKey)) return;
        ctx.fillRect(x, y, width, height);
        if (width > 10 && height > 5) {
          ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
          ctx.strokeRect(x, y, width, height);
        }

        renderedPositions.add(posKey);
      });
    });
  });
}
