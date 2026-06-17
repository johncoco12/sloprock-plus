
import type { RendererDescriptor } from '../types'
import { DefaultRenderer } from '@/features/player/renderers/highway/DefaultRenderer'
import { TabRenderer } from '@/features/player/renderers/tabmaster/TabRenderer'

export const Highway2D: RendererDescriptor = {
  id: 'highway-2d',
  name: 'Highway 2D',
  description: 'Classic 2D canvas note highway with full feature support',
  type: 'canvas',
  requirements: {
    contextType: '2d',
  },
  createRenderer: () => new DefaultRenderer(),
}

export const TabMaster: RendererDescriptor = {
  id: 'tabmaster',
  name: 'Tab',
  description: 'Guitar tablature notation with playback cursor and hit effects',
  type: 'canvas',
  requirements: {
    contextType: '2d',
  },
  createRenderer: () => new TabRenderer(),
}

export const Modernway3D: RendererDescriptor = {
  id: 'modernway-3d',
  name: 'Modernway 3D',
  description: '3D perspective highway powered by Three.js / TresJS',
  type: 'scene',
  requirements: {
    contextType: 'webgl2',
    minWidth: 480,
    minHeight: 320,
  },
  sceneComponent: () => import('@/features/player/renderers/modernway/ModernwayScene.vue'),
}

export const BUILTIN_RENDERERS: RendererDescriptor[] = [
  Highway2D,
  TabMaster,
  Modernway3D,
]
