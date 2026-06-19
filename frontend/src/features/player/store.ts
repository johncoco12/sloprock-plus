import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { fetchLoops, saveLoop as apiSaveLoop, deleteLoop as apiDeleteLoop } from '@/features/admin/loops'
import { useAuthStore } from '@/features/auth/store'
import type { SongInfo, Loop } from '@/types'
import { start as pitchStart, stop as pitchStop, isRunning as isPitchRunning } from '@/features/player/services/pitchDetection'
import type { SectionResult } from '@/features/player/engine/sectionScorer'

export const usePlayerStore = defineStore('player', () => {
  const auth = useAuthStore()
  const highway = shallowRef<typeof window.highway | null>(null)

  const filename    = ref<string | null>(null)
  const trackIdRef = ref<string | null>(null)
  const arrangement = ref<number>(0)
  const songInfo    = ref<SongInfo>({})
  const arrangements = ref<unknown[]>([])
  const duration    = ref<number>(0)

  const playing     = ref<boolean>(false)
  const currentTime = ref<number>(0)
  const loading     = ref<boolean>(false)

  const avOffsetMs    = useLocalStorage('avOffset', 0)
  const mastery       = useLocalStorage('masterDifficulty', 100)
  const vizSelection  = useLocalStorage('vizSelection', 'auto')
  const rendererSelection = useLocalStorage('rendererSelection', 'highway-2d')
  const showLyrics    = useLocalStorage('showLyrics', true)
  const masterVolume  = useLocalStorage('volume', 100)
  const songVolume    = useLocalStorage('songVolume', 100)

  const availableRenderers = ref<{ id: string; name: string }[]>([])

  const speed = ref<number>(1.0)
  const loopA = ref<number | null>(null)
  const loopB = ref<number | null>(null)
  const savedLoops = ref<Loop[]>([])

  const pitchDetectionEnabled = ref<boolean>(false)

  const sectionResults = ref<SectionResult[]>([])
  const currentSectionIndex = ref<number>(-1)
  const combo = ref<number>(0)
  const maxCombo = ref<number>(0)

  let _seekTarget: number | null = null


  function setHighway(hw: typeof window.highway): void {
    highway.value = hw
  }

  function setSongInfo(info: SongInfo | null): void {
    songInfo.value = info ?? {}
    if (vizSelection.value === 'auto' && highway.value) _applyViz()
  }

  async function playSong(fn: string, arrIdx = 0, tid?: string): Promise<void> {
    filename.value = fn
    trackIdRef.value = tid ?? null
    arrangement.value = arrIdx
    playing.value = false
    currentTime.value = 0
    loading.value = true
    loopA.value = null
    loopB.value = null

    const tkId = tid ?? fn

    if (highway.value) {
      await highway.value.reconnect(tkId, arrIdx)
      highway.value.setAvOffset?.(avOffsetMs.value)
      highway.value.setMasterDifficulty?.(mastery.value / 100)
      if (!showLyrics.value) highway.value.toggleLyrics?.()
      _applyViz()
    }

    const audio = document.getElementById('audio') as HTMLAudioElement | null
    if (audio) {
      const newSrc = `/api/tracks/${encodeURIComponent(tkId)}/audio`
      if (!audio.src.endsWith(newSrc)) {
        audio.src = newSrc
        audio.load()
      }
      await new Promise<void>((resolve, reject) => {
        if (audio.readyState >= 2) { resolve(); return }
        const onReady = () => { audio.removeEventListener('canplay', onReady); audio.removeEventListener('error', onError); resolve() }
        const onError = () => { audio.removeEventListener('canplay', onReady); audio.removeEventListener('error', onError); reject(new Error('Audio failed to load')) }
        audio.addEventListener('canplay', onReady)
        audio.addEventListener('error', onError)
      })
    }

    loading.value = false

    try {
      const profileId = auth.profile?.id ?? 0
      savedLoops.value = (profileId ? await fetchLoops(tkId, profileId) as Loop[] : [])
    } catch {
      savedLoops.value = []
    }
  }

  async function changeArrangement(idx: number): Promise<void> {
    arrangement.value = idx
    if (highway.value) {
      await highway.value.reconnect(trackIdRef.value ?? filename.value!, idx)
    }
  }

  function cleanup(): void {
    highway.value?.stop()
    highway.value = null
    playing.value = false
    filename.value = null
  }


  function togglePlay(): void {
    const audio = highway.value?.getAudioElement?.()
    if (!audio) return
    if (audio.paused) { audio.play(); playing.value = true }
    else              { audio.pause(); playing.value = false }
  }

  function seekBy(seconds: number): void {
    const audio = highway.value?.getAudioElement?.()
    if (!audio) return
    _seekTarget = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds))
    audio.currentTime = _seekTarget
  }

  function seekTo(time: number): void {
    const audio = highway.value?.getAudioElement?.()
    if (!audio || !isFinite(time) || !duration.value) return
    const clamped = Math.max(0, Math.min(duration.value, time))
    _seekTarget = clamped
    audio.currentTime = clamped
  }

  function setSpeed(v: number): void {
    speed.value = v
    const audio = highway.value?.getAudioElement?.()
    if (audio) audio.playbackRate = v
  }

  function setMastery(v: number): void {
    mastery.value = v
    highway.value?.setMasterDifficulty?.(v / 100)
  }

  function setAvOffset(ms: number): void {
    avOffsetMs.value = ms
    highway.value?.setAvOffset?.(ms)
  }

  function nudgeAvOffset(delta: number): void {
    setAvOffset(Math.max(-1000, Math.min(1000, avOffsetMs.value + delta)))
  }

  function setVolume(v: number): void {
    masterVolume.value = v
    _applyVolume()
  }

  function setSongVolume(v: number): void {
    songVolume.value = v
    _applyVolume()
  }

  function _applyVolume(): void {
    const audio = highway.value?.getAudioElement?.()
    if (audio) audio.volume = (masterVolume.value / 100) * (songVolume.value / 100)
  }


  function toggleLyrics(): void {
    showLyrics.value = !showLyrics.value
    highway.value?.toggleLyrics?.()
  }


  function togglePitchDetection(): void {
    if (isPitchRunning()) {
      pitchStop()
      pitchDetectionEnabled.value = false
    } else {
      pitchStart().then(() => {
        pitchDetectionEnabled.value = true
      }).catch(e => {
        console.error('[player] pitch detection start failed:', e)
      })
    }
  }


  function setViz(id: string): void {
    vizSelection.value = id
    _applyViz()
  }

  function _applyViz(): void {
    if (!highway.value) return

    if (vizSelection.value === 'default') {
      highway.value.setRenderer?.(null)
      return
    }

    if (vizSelection.value === 'auto') {
      const info = songInfo.value
      const match = Object.keys(window)
        .filter(k => k.startsWith('sloprockViz_'))
        .map(k => window[k] as any)
        .find(f =>
          typeof f?.matchesArrangement === 'function' &&
          !(f.contextType === 'webgl2' && !_canRun3D()) &&
          f.matchesArrangement(info)
        )
      highway.value.setRenderer?.(match ? match() : null)
      return
    }

    const factory = window[`sloprockViz_${vizSelection.value}`] as any
    if (!factory) return
    if (factory.contextType === 'webgl2' && !_canRun3D()) {
      highway.value.setRenderer?.(null)
      return
    }
    highway.value.setRenderer?.(factory())
  }

  let _webgl2: boolean | null = null
  function _canRun3D(): boolean {
    if (_webgl2 !== null) return _webgl2
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2')
      _webgl2 = !!gl
      if (gl) (gl.getExtension?.('WEBGL_lose_context') as any)?.loseContext?.()
    } catch { _webgl2 = false }
    return _webgl2!
  }

  window.sloprock?.on('plugins:ready', () => {
    if (highway.value) _applyViz()
  })

  window.sloprock?.on('viz:reverted', (e) => {
    vizSelection.value = 'default'
    console.warn('[player] viz reverted to default:', (e as CustomEvent).detail?.reason)
  })


  function setLoopA(): void {
    loopA.value = highway.value?.getTime?.() ?? currentTime.value
  }

  function setLoopB(): void {
    loopB.value = highway.value?.getTime?.() ?? currentTime.value
    if (loopA.value !== null) _activateLoop()
  }

  function _activateLoop(): void {
    const a = Math.min(loopA.value!, loopB.value!)
    const b = Math.max(loopA.value!, loopB.value!)
    highway.value?.setLoop?.(a, b)
  }

  function clearLoop(): void {
    loopA.value = null
    loopB.value = null
    highway.value?.setLoop?.(null, null)
  }

  async function saveLoop(): Promise<void> {
    if (loopA.value === null || loopB.value === null) return
    const tid = trackIdRef.value ?? filename.value
    if (!tid) return
    const profileId = auth.profile?.id ?? 0
    if (!profileId) return
    const loop = await apiSaveLoop(tid, profileId, {
      name: `Loop ${new Date().toLocaleTimeString()}`,
      start_time: Math.min(loopA.value, loopB.value),
      end_time:   Math.max(loopA.value, loopB.value),
    }) as Loop
    savedLoops.value.push(loop)
  }

  function loadLoop(loop: Loop): void {
    loopA.value = loop.startTime
    loopB.value = loop.endTime
    highway.value?.setLoop?.(loop.startTime, loop.endTime)
  }

  async function deleteLoop(loopId: number): Promise<void> {
    await apiDeleteLoop(loopId)
    savedLoops.value = savedLoops.value.filter(l => l.id !== loopId)
  }


  function syncTime(): void {
    if (!highway.value) return
    const audio = highway.value.getAudioElement?.()
    if (audio && audio.readyState > 0) {
      const t = (_seekTarget !== null && Math.abs(audio.currentTime - _seekTarget) > 0.5)
        ? _seekTarget
        : audio.currentTime
      if (_seekTarget !== null && Math.abs(audio.currentTime - _seekTarget) < 0.5) {
        _seekTarget = null
      }
      highway.value.setTime?.(t)
      duration.value = audio.duration || 0
    }
    currentTime.value = highway.value.getTime?.() ?? 0
    pitchDetectionEnabled.value = isPitchRunning()
  }

  return {
    highway, filename, trackIdRef, arrangement, songInfo, arrangements, duration,
    playing, currentTime, loading,
    avOffsetMs, mastery, vizSelection, showLyrics, masterVolume, songVolume,
    speed, loopA, loopB, savedLoops,
    pitchDetectionEnabled,
    sectionResults, currentSectionIndex, combo, maxCombo,
    setHighway, setSongInfo, playSong, changeArrangement, cleanup,
    togglePlay, seekBy, seekTo, setSpeed, setMastery, setAvOffset, nudgeAvOffset, setVolume, setSongVolume,
    toggleLyrics, setViz,
    togglePitchDetection,
    setLoopA, setLoopB, clearLoop, saveLoop, loadLoop, deleteLoop,
    syncTime,
    rendererSelection, availableRenderers,
  }
})
