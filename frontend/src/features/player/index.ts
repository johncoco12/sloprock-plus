
export { SongDataProvider } from './engine/SongDataProvider'
export { RendererManager } from './renderers/RendererManager'
export { usePlayer } from './composables/usePlayer'
export type { UsePlayerReturn } from './composables/usePlayer'
export { resolveNoteState } from './engine/noteState'
export { ChartClock } from './engine/clock'
export { ChartState } from './engine/chartState'
export { MasteryFilter } from './engine/masteryFilter'
export { ProjectionHelper } from './engine/projection'
export { HighwayRestClient } from './api'
export { HitDetector } from './engine/hitDetection'
export { checkRendererSupport, isRendererSupported, getSupportedRenderers } from './renderers/rendererSupport'
export { Highway2D, Modernway3D, BUILTIN_RENDERERS } from './renderers/rendererDescriptors'
export type {
  HighwayApi, ConnectOptions,
  CanvasRenderer, Renderer, RendererDescriptor,
  RendererType, RendererRequirements, RendererSupportResult,
  RenderBundle, DrawHook, NoteStateProvider, NoteState,
  ChartNote, ChartChordNote, ChartChord,
  Beat, Section, Anchor, ChordTemplate,
  Lyric, ToneChange, HandShape, SongInfo,
  DrawContext,
} from './types'
