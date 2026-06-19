
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { K, S_GAP, sY, MAX_RENDER_STRINGS, PALETTES } from '../constants'
import type { RenderBundle } from '@/features/player/types'
import setupRaw from '@/assets/headstocks/4StringBass_Headstock_Setup.json'
import glbUrl from '@/assets/headstocks/4StringBass_Headstock.glb?url'

// ── Config types ────────────────────────────────────────────────────────────
interface LabelEmptyRef { empty: string; string: number }
interface HeadstockSetup {
  model: string
  stringCount: number
  rootEmpty: string
  stringLabelEmpties: LabelEmptyRef[]
  tuningUIEmpty: string
  transform: {
    rotation: [number, number, number]
    scale: number
    nutOffset: [number, number, number]
    sceneOffset?: [number, number, number]
  }
  gauge?: {
    radius?: number          // size in K units (default 5.5)
    offset?: [number, number, number]  // nudge from Tuning_UI empty
  }
}

const CFG = setupRaw as HeadstockSetup

// Prefer direct scene children to avoid armature bone name collisions
function findNode(scene: THREE.Group, name: string): THREE.Object3D | undefined {
  return scene.children.find(c => c.name === name) ?? scene.getObjectByName(name)
}

// ── Tuning helpers ──────────────────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BASS_4_MIDI = [28, 33, 38, 43]

function midiToLabel(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

// ── Canvas-text sprite ──────────────────────────────────────────────────────
function makeLabelSprite(text: string, color: number): THREE.Sprite {
  const W = 96, H = 48
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx2d = canvas.getContext('2d')!
  ctx2d.clearRect(0, 0, W, H)
  ctx2d.font = 'bold 30px sans-serif'
  ctx2d.textAlign = 'center'
  ctx2d.textBaseline = 'middle'
  ctx2d.shadowColor = '#000'
  ctx2d.shadowBlur = 5
  ctx2d.fillStyle = '#' + color.toString(16).padStart(6, '0')
  ctx2d.fillText(text, W / 2, H / 2)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true,
    depthTest: false, depthWrite: false, sizeAttenuation: true,
  })
  const sprite = new THREE.Sprite(mat)
  sprite.frustumCulled = false
  sprite.renderOrder = 20
  sprite.scale.set(3.2 * K * 2, 3.2 * K, 1)
  return sprite
}

// ── Gauge: Rocksmith-style D-shape opening rightward ────────────────────────
function buildGauge(R: number): THREE.Group & { needle: THREE.Mesh } {
  const g = new THREE.Group() as THREE.Group & { needle: THREE.Mesh }
  const DO: { depthTest: false; depthWrite: false } = { depthTest: false, depthWrite: false }

  // Dark inner face — DoubleSide so it shows from any camera angle
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.93, 48, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x1a1b22, side: THREE.DoubleSide, ...DO }),
  )
  face.position.z = -0.002
  face.renderOrder = 15
  g.add(face)

  // Chrome outer arc ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R, R * 0.11, 12, 80, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0xb8bcc8, ...DO }),
  )
  ring.renderOrder = 16
  g.add(ring)

  // Chrome straight edge — the flat left spine of the D
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(R * 2.02, R * 0.11, R * 0.09),
    new THREE.MeshBasicMaterial({ color: 0xb8bcc8, ...DO }),
  )
  edge.renderOrder = 16
  g.add(edge)

  // Tick marks at arc endpoints and centre
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x777788, transparent: true, opacity: 0.80, ...DO })
  for (const [theta, len] of [
    [0,           R * 0.22],
    [Math.PI / 2, R * 0.34],
    [Math.PI,     R * 0.22],
  ] as [number, number][]) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(R * 0.035, len, R * 0.035), tickMat)
    tick.position.set(Math.cos(theta) * R, Math.sin(theta) * R, 0.004)
    tick.rotation.z = theta + Math.PI / 2
    tick.renderOrder = 18
    g.add(tick)
  }

  // Needle — geometry pre-translated so base is exactly at pivot origin
  const needleLen = R * 0.88
  const needleGeo = new THREE.BoxGeometry(R * 0.040, needleLen, R * 0.040)
  needleGeo.translate(0, needleLen / 2, 0)
  const needleMat = new THREE.MeshBasicMaterial({ color: 0xff3030, ...DO })
  const needle = new THREE.Mesh(needleGeo, needleMat)
  needle.position.set(0, 0, 0.06)
  needle.renderOrder = 50
  g.add(needle)
  g.needle = needle

  // Centre pivot dot
  const pivot = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.12, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, ...DO }),
  )
  pivot.position.set(0, 0, 0.062)
  pivot.renderOrder = 51
  g.add(pivot)

  // Ensure every child renders regardless of frustum
  g.traverse(o => { if (o instanceof THREE.Mesh) o.frustumCulled = false })
  g.frustumCulled = false

  // Rotate upper-semicircle → right-opening D (in-tune needle points right)
  g.rotation.z = -Math.PI / 2

  return g
}

// ── Fallback nut constants ──────────────────────────────────────────────────
const NUT_COLOUR = 0xf5efe0
const NUT_H = 3.5 * K
const NUT_D = 1.5 * K

export interface NutHeadstockPool {
  group: THREE.Group
  headstockCenter: THREE.Vector3 | null  // set once after GLB loads
  update: (bundle: RenderBundle, tunerMode: boolean) => void
  dispose: () => void
}

export function createNutHeadstock(): NutHeadstockPool {
  const group = new THREE.Group()

  // Apply scene-level offset — shifts whole headstock (model + gauge + labels) in world space
  const [sox, soy, soz] = CFG.transform.sceneOffset ?? [0, 0, 0]
  group.position.set(sox, soy, soz)

  // ── GLB state ────────────────────────────────────────────────────────────
  let glbLoaded = false
  let glbFailed = false
  let modelPivot: THREE.Group | null = null
  let gaugeGroup: (THREE.Group & { needle: THREE.Mesh }) | null = null
  const labelWorldPos = new Map<number, THREE.Vector3>()
  const tuningSprites: THREE.Sprite[] = []
  let lastTuningKey = ''
  let lastSpriteStringCount = -1

  // Headstock bounding center — exposed for camera focus
  let headstockCenter: THREE.Vector3 | null = null

  // ── Pitch / needle state ─────────────────────────────────────────────────
  let needleTargetCents = 0   // cents deviation from target pitch (−50…+50)
  let needleCurrentCents = 0  // lerped display value
  let pitchStaleTimer: ReturnType<typeof setTimeout> | null = null

  function onPitchDetected(event: Event) {
    const hz = (event as CustomEvent).detail?.hz ?? (event as any).hz
    if (!hz || hz <= 0) return
    const midiExact = 69 + 12 * Math.log2(hz / 440)
    const midiR = Math.round(midiExact)
    needleTargetCents = Math.max(-50, Math.min(50, (midiExact - midiR) * 100))
    if (pitchStaleTimer) clearTimeout(pitchStaleTimer)
    pitchStaleTimer = setTimeout(() => { needleTargetCents = 0 }, 650)
  }

  ;(window as any).sloprock?.on?.('pitch:detected', onPitchDetected)

  // ── Fallback nut state ────────────────────────────────────────────────────
  let nutMesh: THREE.Mesh | null = null
  let nutMat: THREE.MeshStandardMaterial | null = null
  let lastNutSC = -1
  let lastNutInv: boolean | null = null

  // ── Load GLB ─────────────────────────────────────────────────────────────
  const loader = new GLTFLoader()
  loader.load(
    glbUrl,
    (gltf) => {
      const pivot = new THREE.Group()
      const [rx, ry, rz] = CFG.transform.rotation
      pivot.rotation.set(rx, ry, rz)
      pivot.scale.setScalar(CFG.transform.scale)
      pivot.add(gltf.scene)
      group.add(pivot)

      // Anchor Root empty at nut — use findNode to avoid bone/empty name collision
      pivot.updateMatrixWorld(true)
      const rootNode = findNode(gltf.scene, CFG.rootEmpty)
      const [ox, oy, oz] = CFG.transform.nutOffset
      const nutCenterY = 9 * K
      if (rootNode) {
        const rp = new THREE.Vector3()
        rootNode.getWorldPosition(rp)
        // Compensate for group.position (sceneOffset) so Root still lands at nut in world space
        pivot.position.set(ox - rp.x + sox, nutCenterY + oy - rp.y + soy, oz - rp.z + soz)
        pivot.updateMatrixWorld(true)
      } else {
        console.warn('[useNutHeadstock] Root empty not found:', CFG.rootEmpty)
        pivot.position.set(ox + sox, nutCenterY + oy + soy, oz + soz)
        pivot.updateMatrixWorld(true)
      }

      // Extract label empty world positions + headstock center for camera
      const wp = new THREE.Vector3()
      let sumX = 0, sumY = 0, cnt = 0
      for (const entry of CFG.stringLabelEmpties) {
        const node = findNode(gltf.scene, entry.empty)
        if (node) {
          node.getWorldPosition(wp)
          labelWorldPos.set(entry.string, wp.clone())
          sumX += wp.x; sumY += wp.y; cnt++
        } else {
          console.warn('[useNutHeadstock] Label empty not found:', entry.empty)
        }
      }
      if (cnt > 0) {
        headstockCenter = new THREE.Vector3(sumX / cnt, sumY / cnt, soz)
      }

      // Gauge at Tuning_UI empty + optional config offset
      const tuningNode = findNode(gltf.scene, CFG.tuningUIEmpty)
      if (tuningNode) {
        tuningNode.getWorldPosition(wp)
        const GAUGE_R = (CFG.gauge?.radius ?? 5.5) * K
        const [gox, goy, goz] = CFG.gauge?.offset ?? [0, 0, 0]
        gaugeGroup = buildGauge(GAUGE_R)
        gaugeGroup.position.set(wp.x + gox, wp.y + goy, wp.z + goz)
        gaugeGroup.visible = false
        group.add(gaugeGroup)
      } else {
        console.warn('[useNutHeadstock] Tuning_UI empty not found:', CFG.tuningUIEmpty)
      }

      modelPivot = pivot
      pivot.visible = false
      glbLoaded = true
    },
    undefined,
    (err) => {
      console.error('[useNutHeadstock] GLB load failed:', err)
      glbFailed = true
    },
  )

  // ── Tuning label sprites ──────────────────────────────────────────────────
  function rebuildSprites(bundle: RenderBundle) {
    const { stringCount, tuning, capo, inverted } = bundle
    const tuningArr = tuning ?? bundle.songInfo.tuning ?? []
    const capoVal = capo ?? bundle.songInfo.capo ?? 0
    const key = `${stringCount}_${inverted}_${capoVal}_${tuningArr.join(',')}`
    if (key === lastTuningKey && stringCount === lastSpriteStringCount) return
    lastTuningKey = key
    lastSpriteStringCount = stringCount

    for (const s of tuningSprites) {
      group.remove(s)
      ;(s.material as THREE.SpriteMaterial).map?.dispose()
      ;(s.material as THREE.SpriteMaterial).dispose()
      s.geometry.dispose()
    }
    tuningSprites.length = 0

    const palette = PALETTES.default
    for (const entry of CFG.stringLabelEmpties) {
      const si = entry.string
      if (si >= stringCount) continue
      const wp2 = labelWorldPos.get(si)
      if (!wp2) continue
      const offset = si < tuningArr.length ? tuningArr[si] : 0
      const midi = BASS_4_MIDI[si] + offset + capoVal
      const sprite = makeLabelSprite(midiToLabel(midi), palette[si % palette.length])
      sprite.position.copy(wp2)
      group.add(sprite)
      tuningSprites.push(sprite)
    }
  }

  function clearSprites() {
    for (const s of tuningSprites) {
      group.remove(s)
      ;(s.material as THREE.SpriteMaterial).map?.dispose()
      ;(s.material as THREE.SpriteMaterial).dispose()
      s.geometry.dispose()
    }
    tuningSprites.length = 0
    lastTuningKey = ''
    lastSpriteStringCount = -1
  }

  // ── Fallback procedural nut ───────────────────────────────────────────────
  function buildNut(stringCount: number, inverted: boolean) {
    if (nutMesh) { group.remove(nutMesh); nutMesh.geometry.dispose(); nutMesh = null }
    if (nutMat)  { nutMat.dispose(); nutMat = null }

    const nStr = Math.min(stringCount, MAX_RENDER_STRINGS)
    const yTop = Math.max(sY(0, nStr, inverted), sY(nStr - 1, nStr, inverted))
    const yBot = Math.min(sY(0, nStr, inverted), sY(nStr - 1, nStr, inverted))
    const nutLen = (yTop - yBot) + S_GAP
    const nutCenterY = (yTop + yBot) / 2

    const geo = new THREE.BoxGeometry(NUT_D, nutLen, NUT_H)
    nutMat = new THREE.MeshStandardMaterial({
      color: NUT_COLOUR, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.9,
    })
    nutMesh = new THREE.Mesh(geo, nutMat)
    nutMesh.position.set(-NUT_D / 2, nutCenterY, 0)
    nutMesh.renderOrder = 50
    group.add(nutMesh)
    lastNutSC = stringCount
    lastNutInv = inverted
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  function update(bundle: RenderBundle, tunerMode: boolean) {
    if (!bundle.isReady) return
    const { stringCount, inverted } = bundle
    const useGLB = stringCount === 4 && glbLoaded && !glbFailed

    // GLB model: always visible for 4-string bass
    if (modelPivot) modelPivot.visible = useGLB

    // Fallback nut: only when not using GLB
    if (nutMesh) nutMesh.visible = !useGLB
    if (!useGLB && (stringCount !== lastNutSC || inverted !== lastNutInv)) {
      buildNut(stringCount, inverted)
    }

    // Headstock labels + gauge: tuner mode only
    const showTunerOverlay = useGLB && tunerMode
    if (gaugeGroup) gaugeGroup.visible = showTunerOverlay

    if (showTunerOverlay) {
      rebuildSprites(bundle)
      // Animate needle toward current pitch
      needleCurrentCents += (needleTargetCents - needleCurrentCents) * 0.14
      // D-shape: +cents=sharp=top, -cents=flat=bottom
      const needleRotZ = (needleCurrentCents / 50) * (Math.PI / 2)
      if (gaugeGroup) {
        gaugeGroup.needle.rotation.z = needleRotZ
        // Colour needle green/yellow/red based on deviation
        const abs = Math.abs(needleCurrentCents)
        const col = abs <= 5 ? 0x30ff60 : abs <= 20 ? 0xffaa00 : 0xff3030
        ;(gaugeGroup.needle.material as THREE.MeshBasicMaterial).color.setHex(col)
      }
    } else {
      clearSprites()
      // Reset needle when leaving tuner mode
      needleCurrentCents += (0 - needleCurrentCents) * 0.1
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  function dispose() {
    ;(window as any).sloprock?.off?.('pitch:detected', onPitchDetected)
    if (pitchStaleTimer) clearTimeout(pitchStaleTimer)
    clearSprites()
    if (modelPivot) { group.remove(modelPivot); modelPivot = null }
    if (gaugeGroup)  { group.remove(gaugeGroup);  gaugeGroup = null }
    if (nutMesh) { nutMesh.geometry.dispose(); nutMesh = null }
    if (nutMat)  { nutMat.dispose(); nutMat = null }
    labelWorldPos.clear()
  }

  const pool: NutHeadstockPool = {
    group,
    get headstockCenter() { return headstockCenter },
    update,
    dispose,
  }
  return pool
}
