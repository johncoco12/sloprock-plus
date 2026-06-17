
import * as THREE from 'three';
import {
  K, NW, BEHIND, PALETTES,
  fretMid, sY, lowerBoundT, getAnchorAt, NFRETS,
} from '../constants';
import type { RenderBundle, ChartNote } from '@/features/player/types';

const GLOW_DURATION = 0.42;      // total wall-clock lifetime seconds
const SCALE_START   = NW * 1.6;  // initial sprite size
const SCALE_END     = NW * 9.0;  // final (expanded) sprite size
const INNER_GLOW_S  = NW * 3.5;  // persistent inner-core size (separate sprite)

// Build a soft radial gradient texture once
function makeGlowTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r   = size / 2;
  const g   = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.90)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.10)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Sharp inner star texture for the "core flash"
function makeStarTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r   = size / 2;
  const g   = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.70)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.15)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface Burst {
  wallStart : number;
  x         : number;
  y         : number;
  s         : number;
}

export interface HitGlowPool {
  group  : THREE.Group;
  update : (bundle: RenderBundle) => void;
  dispose: () => void;
}

export function createHitGlow(): HitGlowPool {
  const group   = new THREE.Group();
  const glowTex = makeGlowTexture();
  const starTex = makeStarTexture();

  // Two sprite pools: outer expanding glow + inner persistent star
  interface SpriteSlot {
    sprite: THREE.Sprite;
    mat   : THREE.SpriteMaterial;
  }
  const outerPool: SpriteSlot[] = [];
  const innerPool: SpriteSlot[] = [];

  function acquireOuter(s: number): SpriteSlot {
    const colour = PALETTES.default[s % PALETTES.default.length];
    for (const sl of outerPool) {
      if (!sl.sprite.visible) {
        sl.mat.color.setHex(colour);
        sl.sprite.visible = true;
        return sl;
      }
    }
    const mat = new THREE.SpriteMaterial({
      map        : glowTex,
      color      : colour,
      transparent: true,
      blending   : THREE.AdditiveBlending,
      depthWrite : false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.frustumCulled = false;
    sprite.renderOrder   = 315;
    group.add(sprite);
    outerPool.push({ sprite, mat });
    return { sprite, mat };
  }

  function acquireInner(s: number): SpriteSlot {
    const colour = PALETTES.default[s % PALETTES.default.length];
    for (const sl of innerPool) {
      if (!sl.sprite.visible) {
        sl.mat.color.setHex(colour);
        sl.sprite.visible = true;
        return sl;
      }
    }
    const mat = new THREE.SpriteMaterial({
      map        : starTex,
      color      : colour,
      transparent: true,
      blending   : THREE.AdditiveBlending,
      depthWrite : false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.frustumCulled = false;
    sprite.renderOrder   = 316;
    group.add(sprite);
    innerPool.push({ sprite, mat });
    return { sprite, mat };
  }

  const bursts: Burst[] = [];
  const hitKeys = new Set<string>();
  let lastChartTime = -1;

  function trySpawn(
    key: string,
    x: number, y: number, s: number,
    noteT: number,
    n: ChartNote,
    bundle: RenderBundle,
  ) {
    if (hitKeys.has(key)) return;
    const state = bundle.getNoteState(n, noteT);
    if (!state || state.state !== 'hit') return;
    hitKeys.add(key);
    bursts.push({ wallStart: performance.now() / 1000, x, y, s });
  }

  function update(bundle: RenderBundle) {
    for (const sl of outerPool) sl.sprite.visible = false;
    for (const sl of innerPool) sl.sprite.visible = false;

    if (!bundle.isReady) {
      bursts.length = 0;
      hitKeys.clear();
      lastChartTime = -1;
      return;
    }

    const { currentTime: now, notes, chords, stringCount, inverted, anchors } = bundle;

    if (lastChartTime >= 0 && Math.abs(now - lastChartTime) > 0.5) {
      hitKeys.clear();
      bursts.length = 0;
    }
    lastChartTime = now;

    const hitWin   = 0.45;
    const startIdx = lowerBoundT(notes, now - BEHIND);
    for (let i = startIdx; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > now + hitWin) break;
      let x: number;
      if (n.f === 0) {
        const anc = getAnchorAt(anchors, n.t);
        x = anc ? fretMid(anc.fret) : 0;
      } else {
        x = fretMid(n.f);
      }
      const y = sY(n.s, stringCount, inverted);
      trySpawn(`${n.t}_${n.s}_${n.f}`, x, y, n.s, n.t, n, bundle);
    }

    for (const ch of chords) {
      if (ch.t < now - BEHIND) continue;
      if (ch.t > now + hitWin) break;
      for (const cn of ch.notes) {
        const fake  = { ...cn, t: ch.t } as unknown as ChartNote;
        const x     = cn.f === 0 ? 0 : fretMid(cn.f);
        const y     = sY(cn.s, stringCount, inverted);
        trySpawn(`${ch.t}_${cn.s}_${cn.f}`, x, y, cn.s, ch.t, fake, bundle);
      }
    }

    if (hitKeys.size > 2000) hitKeys.clear();

    const wallNow = performance.now() / 1000;
    const glowZ   = 0.4 * K;

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b   = bursts[i];
      const age = wallNow - b.wallStart;
      if (age >= GLOW_DURATION) { bursts.splice(i, 1); continue; }

      const t = age / GLOW_DURATION;

      // Outer glow: expands quickly with easeOut, fades
      const expandT  = 1.0 - Math.pow(1.0 - t, 2.5);
      const outerSc  = SCALE_START + expandT * (SCALE_END - SCALE_START);
      const outerOp  = Math.pow(1.0 - t, 1.8) * 0.80;

      const outer = acquireOuter(b.s);
      outer.sprite.position.set(b.x, b.y, glowZ);
      outer.sprite.scale.set(outerSc, outerSc, 1);
      outer.mat.opacity = outerOp;

      // Inner core: stays small for first 60% then shrinks, bright
      if (t < 0.65) {
        const innerT  = t / 0.65;
        const innerSc = INNER_GLOW_S * (0.5 + 0.5 * (1.0 - innerT * 0.3));
        const innerOp = (1.0 - innerT * 0.5) * 0.95;

        const inner = acquireInner(b.s);
        inner.sprite.position.set(b.x, b.y, glowZ + 0.01 * K);
        inner.sprite.scale.set(innerSc, innerSc, 1);
        inner.mat.opacity = innerOp;
      }
    }
  }

  function dispose() {
    glowTex.dispose();
    starTex.dispose();
    for (const sl of outerPool) { sl.mat.dispose(); group.remove(sl.sprite); }
    for (const sl of innerPool) { sl.mat.dispose(); group.remove(sl.sprite); }
    outerPool.length = 0;
    innerPool.length = 0;
    bursts.length    = 0;
    hitKeys.clear();
  }

  return { group, update, dispose };
}
