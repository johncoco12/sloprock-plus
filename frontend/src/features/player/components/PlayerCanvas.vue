<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted, watch, defineAsyncComponent, shallowRef } from 'vue'
import { TresCanvas } from '@tresjs/core'
import {
  usePlayer, RendererManager,
  BUILTIN_RENDERERS, isRendererSupported,
  type RendererDescriptor, type RendererSupportResult,
} from '@/features/player'
import { usePlayerStore } from '@/features/player/store'
import { renderBundleKey } from '@/features/player/renderers/keys'

const playerStore = usePlayerStore()

const allRenderers = shallowRef<RendererDescriptor[]>(BUILTIN_RENDERERS)

const supportedRenderers = computed(() =>
  allRenderers.value.filter(d => isRendererSupported(d).supported)
)

const unsupportedRenderers = computed(() =>
  allRenderers.value
    .map(d => ({ descriptor: d, ...isRendererSupported(d) }))
    .filter(r => !r.supported)
)

// Pre-build async components for any scene-type renderer
const sceneComponents = new Map<string, ReturnType<typeof defineAsyncComponent>>()
for (const desc of BUILTIN_RENDERERS.filter(d => d.type === 'scene' && d.sceneComponent)) {
  sceneComponents.set(desc.id, defineAsyncComponent(desc.sceneComponent!))
}

const { bundle } = usePlayer()
provide(renderBundleKey, bundle as any)

const activeDescriptor = ref<RendererDescriptor>(BUILTIN_RENDERERS[0])

// ── Canvas setup (for canvas-type renderers) ───────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)
const emit = (event: string, detail?: unknown) => {
  ;(window as any).sloprock?.emit?.(event, detail)
}
const rendererMgr = new RendererManager(emit)

for (const desc of BUILTIN_RENDERERS.filter(d => d.type === 'canvas')) {
  rendererMgr.register(desc)
}

;(window as any).rendererManager = rendererMgr

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    rendererMgr.setCanvas(canvas)
    rendererMgr.setRenderer(null)
    rendererMgr.resize(canvas.parentElement, window.devicePixelRatio)
    rendererMgr.startLoop(() => bundle.value ?? undefined)
  }
  window.addEventListener('resize', onResize)

  playerStore.availableRenderers = supportedRenderers.value.map(d => ({ id: d.id, name: d.name }))

  if (playerStore.rendererSelection !== activeDescriptor.value.id) {
    switchRenderer(playerStore.rendererSelection)
  }
})

watch(() => playerStore.rendererSelection, (id) => {
  if (id !== activeDescriptor.value.id) {
    switchRenderer(id)
  }
})

onUnmounted(() => {
  rendererMgr.stopLoop()
  window.removeEventListener('resize', onResize)
})

function onResize() {
  const canvas = canvasRef.value
  if (!canvas) return
  rendererMgr.resize(canvas.parentElement, window.devicePixelRatio)
}


/**
 * Switch to a renderer by descriptor id.
 * Returns the support result — callers can check .supported and .reason.
 */
function switchRenderer(id: string): RendererSupportResult {
  const desc = allRenderers.value.find(d => d.id === id)
  if (!desc) return { supported: false, reason: `Unknown renderer: ${id}` }

  const support = isRendererSupported(desc)
  if (!support.supported) return support

  // Deactivate current
  if (activeDescriptor.value.type === 'canvas' && desc.type === 'scene') {
    rendererMgr.stopLoop()
  }

  // Activate new
  activeDescriptor.value = desc
  if (desc.type === 'canvas') {
    const canvas = canvasRef.value
    if (canvas) {
      rendererMgr.setCanvas(canvas)
      rendererMgr.switchTo(desc.id)
      rendererMgr.resize(canvas.parentElement, window.devicePixelRatio)
      rendererMgr.startLoop(() => bundle.value ?? undefined)
    }
  }
  // scene-type: TresCanvas v-if handles mount/unmount via template

  // Sync back to store
  playerStore.rendererSelection = desc.id

  return { supported: true }
}

/** Cycle to the next supported renderer. */
function cycleRenderer(): RendererSupportResult {
  const supported = supportedRenderers.value
  if (supported.length < 2) return { supported: false, reason: 'No alternative renderers available' }
  const idx = supported.findIndex(d => d.id === activeDescriptor.value.id)
  const next = supported[(idx + 1) % supported.length]
  return switchRenderer(next.id)
}

defineExpose({
  switchRenderer,
  cycleRenderer,
  activeDescriptor,
  supportedRenderers,
  unsupportedRenderers,
  rendererMgr,
})
</script>

<template>
  <canvas
    v-show="activeDescriptor.type === 'canvas'"
    ref="canvasRef"
    id="highway"
    class="flex-1 block w-full min-h-0"
    aria-label="Note highway"
  />

  <template v-for="desc in supportedRenderers.filter(d => d.type === 'scene')" :key="desc.id">
    <TresCanvas
      v-if="activeDescriptor.id === desc.id"
      clear-color="#101820"
      :antialias="true"
      :alpha="false"
      window-size
      class="flex-1 block w-full min-h-0"
    >
      <component :is="sceneComponents.get(desc.id)" />
    </TresCanvas>
  </template>
</template>
