
import * as THREE from 'three';
import { K, NH, S_GAP, NFRETS, AHEAD, fretMid, sY, lowerBoundT } from '../constants';
import type { RenderBundle } from '@/features/player/types';

const IDLE_COLOUR = '#9ab8cc';
const ACTIVE_COLOUR = '#D8A636';
const CANVAS_SIZE = 64;
const HEAT_DECAY = 3.0;

const _texCache = new Map<string, THREE.CanvasTexture>();

function getFretTex(fret: number, colour: string): THREE.CanvasTexture {
  const key = `${fret}_${colour}`;
  const cached = _texCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = '#000';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = colour;
  ctx.fillText(String(fret), CANVAS_SIZE / 2, CANVAS_SIZE / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  _texCache.set(key, tex);
  return tex;
}

export interface FretRowLabelsPool {
  group: THREE.Group;
  update: (bundle: RenderBundle) => void;
  dispose: () => void;
}

export function createFretRowLabels(): FretRowLabelsPool {
  const group = new THREE.Group();
  const sprites: THREE.Sprite[] = [];
  const mats: THREE.SpriteMaterial[] = [];

  const fretHeat = new Float32Array(NFRETS + 1);
  let lastTime = 0;
  let built = false;
  let lastStringCount = -1;
  let lastInverted: boolean | null = null;

  function build(stringCount: number, inverted: boolean) {
    for (const s of sprites) {
      group.remove(s);
    }
    sprites.length = 0;
    mats.length = 0;

    const minY = Math.min(sY(0, stringCount, inverted), sY(stringCount - 1, stringCount, inverted));
    const labelY = minY - S_GAP * 1.4;

    for (let f = 1; f <= NFRETS; f++) {
      const mat = new THREE.SpriteMaterial({
        map: getFretTex(f, IDLE_COLOUR),
        transparent: true,
        opacity: 0.35,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
      });
      mats.push(mat);

      const sprite = new THREE.Sprite(mat);
      sprite.frustumCulled = false;
      sprite.renderOrder = 1000;

      const x = fretMid(f);
      sprite.position.set(x, labelY, 0.5 * K);

      const baseScale = 3.5 * K;
      sprite.scale.set(baseScale, baseScale, 1);

      group.add(sprite);
      sprites.push(sprite);
    }

    built = true;
    lastStringCount = stringCount;
    lastInverted = inverted;
  }

  function update(bundle: RenderBundle) {
    const { currentTime, notes, stringCount, inverted } = bundle;

    if (!built || stringCount !== lastStringCount || inverted !== lastInverted) {
      build(stringCount, inverted);
    }

    const rawDt = currentTime - lastTime;
    if (rawDt < -0.05) fretHeat.fill(0);
    const dt = lastTime > 0 ? Math.min(Math.max(rawDt, 0), 0.1) : 0.016;
    lastTime = currentTime;

    for (let f = 1; f <= NFRETS; f++) {
      fretHeat[f] = Math.max(0, fretHeat[f] - HEAT_DECAY * dt);
    }

    const hitWindow = 0.15;
    const startIdx = lowerBoundT(notes, currentTime - hitWindow);
    for (let i = startIdx; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > currentTime + hitWindow) break;
      if (n.f > 0 && n.f <= NFRETS) {
        fretHeat[n.f] = 1.0;
      }
      if (n.f > 0 && n.f <= NFRETS && (n.sus ?? 0) > 0) {
        if (n.t <= currentTime && currentTime <= n.t + n.sus!) {
          fretHeat[n.f] = 1.0;
        }
      }
    }

    for (let f = 1; f <= NFRETS; f++) {
      const heat = fretHeat[f];
      const mat = mats[f - 1];
      const sprite = sprites[f - 1];

      mat.opacity = 0.35 + heat * 0.65;

      const scale = (3.5 + heat * 2.2) * K;
      sprite.scale.set(scale, scale, 1);

      const targetColour = heat > 0.3 ? ACTIVE_COLOUR : IDLE_COLOUR;
      const expectedTex = getFretTex(f, targetColour);
      if (mat.map !== expectedTex) {
        mat.map = expectedTex;
        mat.needsUpdate = true;
      }
    }
  }

  function dispose() {
    for (const mat of mats) mat.dispose();
    for (const s of sprites) s.geometry.dispose();
    sprites.length = 0;
    mats.length = 0;
  }

  return { group, update, dispose };
}
