
import { drawBackground } from './painters/background.js';
import { drawFretLines, drawFretNumbers } from './painters/fretLines.js';
import { drawBeats } from './painters/beats.js';
import { drawStrings, drawNowLine } from './painters/strings.js';
import { drawNotes, drawSustains } from './painters/notes.js';
import { drawChords, FretLinePreview } from './painters/chords.js';
import { drawLyrics } from './painters/lyrics.js';
import { ChordChainCache } from './chordCache.js';
import type { CanvasRenderer, RenderBundle, DrawContext, DrawHook } from '@/features/player/types';

export class DefaultRenderer implements CanvasRenderer {
  readonly contextType = '2d' as const;

  private ctx: CanvasRenderingContext2D | null = null;
  private ctxWarned = false;
  private readonly chordCache = new ChordChainCache();
  private readonly fretPreview = new FretLinePreview();
  private hooks: DrawHook[] = [];

  init(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d');
    if (!this.ctx && !this.ctxWarned) {
      console.error('DefaultRenderer: canvas already locked to a different context type. Reload to recover.');
      this.ctxWarned = true;
    }
  }

  draw(bundle: RenderBundle): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = (ctx.canvas as HTMLCanvasElement).width;
    const H = (ctx.canvas as HTMLCanvasElement).height;

    const notes   = bundle.notes;
    const chords  = bundle.chords;
    const anchors = bundle.anchors;

    const cx: DrawContext = {
      ctx,
      W, H,
      currentTime: bundle.currentTime,
      notes,
      chords,
      anchors,
      beats: bundle.beats,
      chordTemplates: bundle.chordTemplates,
      handShapes: bundle.handShapes,
      stringCount: bundle.stringCount,
      inverted: bundle.inverted,
      lefty: bundle.lefty,
      noteStateProvider: bundle.getNoteState as DrawContext['noteStateProvider'],
      displayMaxFret: (bundle as any)._displayMaxFret ?? 12,
      project: bundle.project,
      fretX: bundle.fretX,
      fillTextReadable: (bundle as any)._fillTextReadable ?? ((t: string, x: number, y: number) => ctx.fillText(t, x, y)),
    };

    try {
      ctx.fillStyle = '#080810';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      if (bundle.lefty) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }

      drawBackground(cx);
      drawFretLines(cx);
      drawBeats(cx);
      drawStrings(cx);
      drawSustains(cx);
      drawNowLine(cx);
      drawNotes(cx);
      drawChords(cx, this.chordCache, this.fretPreview);
      drawFretNumbers(cx);

      for (const hook of this.hooks) {
        try { hook(ctx, W, H); } catch { /* ignore plugin errors */ }
      }

      ctx.restore();

      if (bundle.lyricsVisible) {
        drawLyrics(ctx, W, H, bundle.lyrics, bundle.currentTime);
      }
    } catch (e) {
      console.error('[DefaultRenderer] draw error:', e);
    }
  }

  resize(): void {
  }

  destroy(): void {
    // ctx stays valid — the browser caches the same 2D context object for the
    // lifetime of a canvas element. A subsequent init() on a fresh canvas
    // re-acquires it. Reset warn guard so a new init on a new canvas is a
    // fresh start.
    this.ctxWarned = false;
    this.chordCache.reset();
    this.fretPreview.reset();
  }

  // Draw hooks are managed by the Highway class; it exposes these internal
  // setters so it can forward addDrawHook / removeDrawHook / fireDrawHooks.
  setHooks(hooks: DrawHook[]): void {
    this.hooks = hooks;
  }
}
