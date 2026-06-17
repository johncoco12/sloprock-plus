
import * as THREE from 'three';
import { K, S_GAP, PALETTES, sY, fretX } from '../constants';
import type { RenderBundle } from '@/features/player/types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToPitchLabel(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

const STANDARD_GUITAR = [40, 45, 50, 55, 59, 64];
const STANDARD_BASS = [28, 33, 38, 43];
const STANDARD_BASS5 = [23, 28, 33, 38, 43];

function getBaseMidi(stringCount: number): number[] {
  if (stringCount <= 4) return STANDARD_BASS;
  if (stringCount === 5) return STANDARD_BASS5;
  const base = [...STANDARD_GUITAR];
  if (stringCount >= 7) base.unshift(35);
  if (stringCount >= 8) base.unshift(30);
  return base.slice(0, stringCount);
}

const CANVAS_W = 128;
const CANVAS_H = 64;
const _matCache = new Map<string, THREE.SpriteMaterial>();

function makeTuningMaterial(label: string, colour: number): THREE.SpriteMaterial {
  const key = `${label}_${colour}`;
  const cached = _matCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = '#000';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  const hex = '#' + colour.toString(16).padStart(6, '0');
  ctx.fillStyle = hex;
  ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });
  _matCache.set(key, mat);
  return mat;
}

export interface TuningLabelsPool {
  group: THREE.Group;
  update: (bundle: RenderBundle) => void;
  dispose: () => void;
}

export function createTuningLabels(): TuningLabelsPool {
  const group = new THREE.Group();
  const sprites: THREE.Sprite[] = [];

  let lastStringCount = -1;
  let lastTuningKey = '';

  function rebuild(bundle: RenderBundle) {
    const stringCount = bundle.stringCount;
    const tuning = bundle.tuning ?? bundle.songInfo.tuning ?? [];
    const capo = bundle.capo ?? bundle.songInfo.capo ?? 0;
    const inverted = bundle.inverted;

    const tuningKey = `${stringCount}_${inverted}_${capo}_${tuning.join(',')}`;
    if (tuningKey === lastTuningKey && stringCount === lastStringCount) return;
    lastTuningKey = tuningKey;
    lastStringCount = stringCount;

    for (const s of sprites) {
      group.remove(s);
      s.geometry.dispose();
    }
    sprites.length = 0;

    const baseMidi = getBaseMidi(stringCount);
    const palette = PALETTES.default;

    const labelX = -6 * K;

    for (let s = 0; s < stringCount; s++) {
      const offset = s < tuning.length ? tuning[s] : 0;
      const midi = (s < baseMidi.length ? baseMidi[s] : 40) + offset + capo;
      const label = midiToPitchLabel(midi);
      const colour = palette[s % palette.length];

      const mat = makeTuningMaterial(label, colour);
      const sprite = new THREE.Sprite(mat.clone());
      sprite.frustumCulled = false;
      sprite.renderOrder = 8;

      const y = sY(s, stringCount, inverted);
      sprite.position.set(labelX, y, -0.08 * K);

      const scale = 2.42 * K;
      sprite.scale.set(scale * 2, scale, 1);

      group.add(sprite);
      sprites.push(sprite);
    }
  }

  function update(bundle: RenderBundle) {
    rebuild(bundle);
  }

  function dispose() {
    for (const s of sprites) {
      (s.material as THREE.SpriteMaterial).dispose();
      s.geometry.dispose();
    }
    sprites.length = 0;
  }

  return { group, update, dispose };
}
