
import * as THREE from 'three';
import {
  K, STR_THICK, S_GAP, MAX_RENDER_STRINGS, NFRETS, PALETTES,
  fretX, sY, lowerBoundT,
} from '../constants';
import type { RenderBundle, ChartNote } from '@/features/player/types';

// Ribbon spans the full board width in X, displaced in Y by a sine wave.
// Camera looks from +Z in −Z direction so the XY-plane ribbon is face-on.

const N_SEGS     = 60;
const HALF_THICK = STR_THICK * 3;   // ribbon half-height; slightly thicker than the static string
const MAX_AMP    = S_GAP * 0.42;    // peak Y displacement at full energy
const VIB_SPEED  = 20.0;            // temporal frequency, rad/s
const VIB_Z      = 0.35 * K;       // sits just above the fretboard plane

// Energy accumulation
const HIT_ENERGY  = 0.38;  // energy added per hit
const ENERGY_CAP  = 1.0;   // hard ceiling — many hits can't push past this
const DECAY_RATE  = 1.8;   // energy lost per second (full decay in ~0.55 s with no hits)

interface VibState {
  energy  : number;  // 0 → ENERGY_CAP
  lastWall: number;  // wall time of previous frame (for dt)
}

export interface StringVibratePool {
  group  : THREE.Group;
  update : (bundle: RenderBundle) => void;
  dispose: () => void;
}

export function createStringVibrate(): StringVibratePool {
  const group = new THREE.Group();

  interface Slot {
    mesh : THREE.Mesh;
    mat  : THREE.MeshBasicMaterial;
    pos  : Float32Array;
    attr : THREE.BufferAttribute;
    state: VibState;
  }

  const slots: Slot[] = [];
  const X_START = fretX(0);
  const X_END   = fretX(NFRETS);

  function makeSlot(s: number): Slot {
    const vertCount = 2 * (N_SEGS + 1);
    const pos       = new Float32Array(vertCount * 3);
    const idx       = new Uint16Array(N_SEGS * 6);

    for (let i = 0; i < N_SEGS; i++) {
      const base = i * 2, ib = i * 6;
      idx[ib    ] = base;     idx[ib + 1] = base + 1; idx[ib + 2] = base + 2;
      idx[ib + 3] = base + 1; idx[ib + 4] = base + 3; idx[ib + 5] = base + 2;
    }

    const geo  = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9999);

    const mat = new THREE.MeshBasicMaterial({
      color      : PALETTES.default[s % PALETTES.default.length],
      transparent: true,
      opacity    : 0,
      blending   : THREE.AdditiveBlending,
      depthWrite : false,
      side       : THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder   = 14;
    mesh.visible       = false;
    group.add(mesh);

    return { mesh, mat, pos, attr, state: { energy: 0, lastWall: 0 } };
  }

  function ensureSlot(s: number): Slot {
    while (slots.length <= s) slots.push(makeSlot(slots.length));
    return slots[s];
  }

  // Add energy on hit — capped so repeated hits can't exceed ENERGY_CAP
  function addEnergy(s: number) {
    const sl = ensureSlot(s);
    sl.state.energy = Math.min(ENERGY_CAP, sl.state.energy + HIT_ENERGY);
  }

  const hitKeys = new Set<string>();
  let lastChartTime = -1;

  function update(bundle: RenderBundle) {
    if (!bundle.isReady) {
      for (const sl of slots) { sl.mesh.visible = false; sl.state.energy = 0; }
      hitKeys.clear();
      lastChartTime = -1;
      return;
    }

    const { currentTime: now, notes, chords, stringCount, inverted } = bundle;

    // Clear stale keys on seek
    if (lastChartTime >= 0 && Math.abs(now - lastChartTime) > 0.5) {
      hitKeys.clear();
    }
    lastChartTime = now;

    // Accumulate energy for every newly-hit note
    const hitWin   = 0.45;
    const startIdx = lowerBoundT(notes, now - hitWin);
    for (let i = startIdx; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > now + hitWin) break;
      const key = `${n.t}_${n.s}_${n.f}`;
      if (hitKeys.has(key)) continue;
      const st = bundle.getNoteState(n, n.t);
      if (!st || st.state !== 'hit') continue;
      hitKeys.add(key);
      if (n.s >= 0 && n.s < stringCount) addEnergy(n.s);
    }
    for (const ch of chords) {
      if (ch.t < now - hitWin) continue;
      if (ch.t > now + hitWin) break;
      for (const cn of ch.notes) {
        const key = `${ch.t}_${cn.s}_${cn.f}`;
        if (hitKeys.has(key)) continue;
        const fake = { ...cn, t: ch.t } as unknown as ChartNote;
        const st   = bundle.getNoteState(fake, ch.t);
        if (!st || st.state !== 'hit') continue;
        hitKeys.add(key);
        if (cn.s >= 0 && cn.s < stringCount) addEnergy(cn.s);
      }
    }
    if (hitKeys.size > 2000) hitKeys.clear();

    const wallNow = performance.now() / 1000;

    for (let s = 0; s < stringCount; s++) {
      const sl  = ensureSlot(s);
      const { state } = sl;

      // dt for energy decay — clamp to avoid large jumps after tab switch
      const dt = state.lastWall > 0 ? Math.min(wallNow - state.lastWall, 0.1) : 0;
      state.lastWall = wallNow;

      // Decay energy
      state.energy = Math.max(0, state.energy - DECAY_RATE * dt);

      if (state.energy < 0.005) {
        sl.mesh.visible = false;
        continue;
      }

      const e     = state.energy;        // 0..1
      const e2    = e * e;               // quadratic — ramps up dramatically near the cap
      const baseY = sY(s, stringCount, inverted);
      const phase = wallNow * VIB_SPEED;
      const { pos, attr } = sl;

      for (let i = 0; i <= N_SEGS; i++) {
        const t   = i / N_SEGS;
        const x   = X_START + t * (X_END - X_START);
        const env = Math.sin(Math.PI * t); // pins to 0 at nut & bridge

        const wave =
          MAX_AMP * e2 * env * (
            Math.sin(t * Math.PI * 2.0 + phase)        * 0.60 +
            Math.sin(t * Math.PI * 4.0 - phase * 1.35) * 0.28 +
            Math.sin(t * Math.PI * 6.2 + phase * 0.55) * 0.12
          );

        const y     = baseY + wave;
        const thick = HALF_THICK * (0.4 + 0.6 * e) * (0.3 + 0.7 * env);

        const vi = i * 2;
        pos[vi * 3    ] = x;  pos[vi * 3 + 1] = y - thick;  pos[vi * 3 + 2] = VIB_Z;
        pos[(vi+1)*3  ] = x;  pos[(vi+1)*3+1] = y + thick;  pos[(vi+1)*3+2] = VIB_Z;
      }

      attr.needsUpdate = true;
      sl.mat.opacity   = Math.sqrt(e) * 0.88;
      sl.mesh.visible  = true;
    }

    // Hide slots for strings beyond current string count
    for (let s = stringCount; s < slots.length; s++) {
      slots[s].mesh.visible = false;
    }
  }

  function dispose() {
    for (const sl of slots) { sl.mesh.geometry.dispose(); sl.mat.dispose(); }
    slots.length = 0;
    hitKeys.clear();
  }

  return { group, update, dispose };
}
