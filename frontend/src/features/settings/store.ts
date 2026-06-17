import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchSettings,
  saveSettings as apiSave,
  exportSettings as apiExport,
  importSettings as apiImport,
  fetchVersion,
} from '@/features/settings/api'
import type { Settings, VersionInfo } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref<boolean>(false)

  const dlcPath            = ref<string>('')
  const lefty              = ref<boolean>(false)
  const defaultArrangement = ref<string>('auto')
  const demucsUrl          = ref<string>('')

  const version    = ref<string>('')
  const sourceUrl  = ref<string>('')
  const licenseUrl = ref<string>('')

  async function load(): Promise<void> {
    if (loaded.value) return
    try {
      const [s, v] = await Promise.all([fetchSettings(), fetchVersion()]) as [Settings, VersionInfo]
      dlcPath.value            = s.dlc_path ?? s.dlcPath ?? ''
      lefty.value              = s.lefty ?? false
      defaultArrangement.value = s.default_arrangement ?? s.defaultArrangement ?? 'auto'
      demucsUrl.value          = s.demucs_url ?? s.demucsUrl ?? ''
      version.value    = v.version    ?? ''
      sourceUrl.value  = v.source_url ?? ''
      licenseUrl.value = v.license_url ?? ''
      loaded.value = true
    } catch (e) {
      console.error('Settings load failed', e)
    }
  }

  async function save(): Promise<void> {
    await apiSave({
      dlc_path:            dlcPath.value,
      lefty:               lefty.value,
      default_arrangement: defaultArrangement.value,
      demucs_url:          demucsUrl.value,
    })
  }

  return {
    loaded,
    dlcPath, lefty, defaultArrangement, demucsUrl,
    version, sourceUrl, licenseUrl,
    load, save,
    export: apiExport,
    import: apiImport,
  }
})
