const { h, ref, defineComponent } = window.__sloprockVue;

function getToken() {
  return localStorage.getItem('sloprock_token') ?? '';
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function Icon(d, cls = 'w-4 h-4') {
  return h('svg', {
    class: cls,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    viewBox: '0 0 24 24',
  }, (Array.isArray(d) ? d : [d]).map(p => h('path', { d: p })));
}

const ICONS = {
  music:    ['M9 18V5l12-2v13', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  upload:   ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  audio:    ['M17.5 22h.5c.5 0 1-.2 1.4-.6.4-.4.6-.9.6-1.4V7.5L14.5 2H6c-.5 0-1 .2-1.4.6C4.2 3 4 3.5 4 4v3', 'M14 2v6h6', 'M2 17v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3', 'M10 20v-1a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0z', 'M6 17v-1a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0z'],
  image:    ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
  x:        ['M18 6 6 18', 'M6 6l12 12'],
  spin:     'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5',
  alert:    'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z',
};

async function pollJob(jobId) {
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(`/api/import/status/${jobId}`, { headers: authHeaders() });
      if (!res.ok) break;
      const job = await res.json();
      if (job.status === 'completed' || job.status === 'failed') break;
    } catch { break; }
  }
}

const GpImportPanel = defineComponent({
  name: 'GpImportPanel',
  setup() {
    const open        = ref(false);
    const files       = ref([]);
    const title       = ref('');
    const artist      = ref('');
    const album       = ref('');
    const audioFile   = ref(null);
    const coverFile   = ref(null);
    const uploading   = ref(false);
    const status      = ref('');
    const error       = ref('');

    let gpInputEl    = null;
    let audioInputEl = null;
    let coverInputEl = null;

    function onGpPicked(e) {
      const picked = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (!picked.length) return;
      title.value  = '';
      artist.value = '';
      album.value  = '';
      audioFile.value = null;
      coverFile.value = null;
      error.value  = '';
      files.value  = picked;
      open.value   = true;
    }

    function onAudioPicked(e) {
      audioFile.value = e.target.files?.[0] ?? null;
    }

    function onCoverPicked(e) {
      coverFile.value = e.target.files?.[0] ?? null;
    }

    function clearAudio() {
      audioFile.value = null;
      if (audioInputEl) audioInputEl.value = '';
    }

    function clearCover() {
      coverFile.value = null;
      if (coverInputEl) coverInputEl.value = '';
    }

    function close() {
      if (!uploading.value) open.value = false;
    }

    async function submit() {
      if (!files.value.length || uploading.value) return;
      error.value   = '';
      uploading.value = true;
      status.value  = 'Uploading…';

      try {
        const form = new FormData();
        form.append('file', files.value[0]);
        if (title.value.trim())  form.append('title',  title.value.trim());
        if (artist.value.trim()) form.append('artist', artist.value.trim());
        if (album.value.trim())  form.append('album',  album.value.trim());
        if (audioFile.value)     form.append('audio',    audioFile.value);
        if (coverFile.value)     form.append('coverArt', coverFile.value);

        const res = await fetch('/api/plugins/format_gp/import', {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed (${res.status})`);
        }

        const data = await res.json();
        const jobs = [...(data.jobs ?? [])];

        // Extra files without metadata go through standard route
        if (files.value.length > 1) {
          const extraForm = new FormData();
          for (const f of files.value.slice(1)) extraForm.append('files', f);
          const extraRes = await fetch('/api/import/upload', {
            method: 'POST',
            headers: authHeaders(),
            body: extraForm,
          });
          if (extraRes.ok) {
            const extraData = await extraRes.json();
            jobs.push(...(extraData.jobs ?? []));
          }
        }

        open.value = false;

        if (jobs.length) {
          status.value = 'Processing…';
          await Promise.all(jobs.map(j => pollJob(j.jobId)));
          status.value = 'Done';
          setTimeout(() => { status.value = ''; }, 3000);
        }
      } catch (e) {
        error.value = e.message ?? 'Upload failed';
      } finally {
        uploading.value = false;
      }
    }

    function FileChip(file, onClear, iconPaths) {
      return h('div', { class: 'flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-600 border border-white/[.06]' }, [
        Icon(iconPaths, 'w-3.5 h-3.5 text-green-400 shrink-0'),
        h('span', { class: 'text-xs text-gray-200 truncate flex-1' }, file.name),
        h('button', {
          type: 'button',
          class: 'p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-200 transition-colors',
          disabled: uploading.value,
          onClick: onClear,
        }, Icon(ICONS.x, 'w-3 h-3')),
      ]);
    }

    return () => {
      const primaryFile = files.value[0] ?? null;
      const extraCount  = Math.max(0, files.value.length - 1);

      return h('section', { class: 'settings-section' }, [

        // Section header + import button
        h('div', { class: 'flex items-center justify-between mb-3' }, [
          h('h2', { class: 'flex items-center gap-2 text-sm font-semibold text-gray-200' }, [
            Icon(ICONS.music, 'w-4 h-4 text-accent'),
            'Guitar Pro Import',
          ]),
          status.value
            ? h('span', { class: 'text-xs text-gray-400' }, status.value)
            : null,
        ]),

        h('p', { class: 'text-xs text-gray-500 mb-3' }, 'Import .gp / .gpx tabs with audio, cover art and metadata.'),

        h('button', {
          class: 'settings-btn flex items-center gap-1.5',
          disabled: uploading.value,
          onClick: () => gpInputEl?.click(),
        }, [
          Icon(ICONS.upload, 'w-3.5 h-3.5'),
          uploading.value ? status.value || 'Importing…' : 'Import Guitar Pro Tab…',
        ]),

        // Hidden GP file input
        h('input', {
          type: 'file',
          accept: '.gp,.gpx',
          multiple: true,
          style: 'display:none',
          ref: el => { gpInputEl = el; },
          onChange: onGpPicked,
        }),

        // Modal overlay
        open.value ? h('div', {
          style: 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px)',
          onClick: e => { if (e.target === e.currentTarget) close(); },
        }, [
          h('div', {
            class: 'bg-dark-700 border border-white/[.08] rounded-2xl shadow-2xl w-full max-w-md mx-4',
            onClick: e => e.stopPropagation(),
          }, [

            // Dialog header
            h('div', { class: 'flex items-center justify-between px-5 py-4 border-b border-white/[.06]' }, [
              h('h2', { class: 'text-sm font-semibold text-gray-100' }, 'Import Guitar Pro Tab'),
              h('button', {
                type: 'button',
                class: 'p-1.5 rounded-lg hover:bg-white/[.07] text-gray-500 hover:text-gray-200 transition-colors',
                onClick: close,
              }, Icon(ICONS.x, 'w-4 h-4')),
            ]),

            // Dialog body
            h('div', { class: 'px-5 py-4 space-y-4' }, [

              // File badge
              h('div', { class: 'flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-600 border border-white/[.06]' }, [
                Icon(ICONS.music, 'w-3.5 h-3.5 text-accent shrink-0'),
                h('span', { class: 'text-sm font-medium text-gray-200 truncate flex-1' }, primaryFile?.name ?? ''),
                extraCount > 0
                  ? h('span', { class: 'text-xs text-gray-500 shrink-0' }, `+${extraCount} more`)
                  : null,
              ]),

              // Track name
              h('div', null, [
                h('label', { class: 'settings-label' }, 'Track Name'),
                h('input', {
                  class: 'settings-input',
                  type: 'text',
                  placeholder: 'Taken from tab if blank',
                  disabled: uploading.value,
                  value: title.value,
                  onInput: e => { title.value = e.target.value; },
                }),
              ]),

              // Artist
              h('div', null, [
                h('label', { class: 'settings-label' }, 'Artist'),
                h('input', {
                  class: 'settings-input',
                  type: 'text',
                  placeholder: 'Taken from tab if blank',
                  disabled: uploading.value,
                  value: artist.value,
                  onInput: e => { artist.value = e.target.value; },
                }),
              ]),

              // Album
              h('div', null, [
                h('label', { class: 'settings-label' }, [
                  'Album ',
                  h('span', { class: 'text-gray-500 font-normal' }, 'optional'),
                ]),
                h('input', {
                  class: 'settings-input',
                  type: 'text',
                  placeholder: '',
                  disabled: uploading.value,
                  value: album.value,
                  onInput: e => { album.value = e.target.value; },
                }),
              ]),

              // Audio file
              h('div', null, [
                h('label', { class: 'settings-label' }, [
                  'Audio File ',
                  h('span', { class: 'text-gray-500 font-normal' }, 'optional'),
                ]),
                audioFile.value
                  ? FileChip(audioFile.value, clearAudio, ICONS.audio)
                  : h('div', { class: 'flex items-center gap-2' }, [
                      h('button', {
                        type: 'button',
                        class: 'settings-btn flex items-center gap-1.5',
                        disabled: uploading.value,
                        onClick: () => audioInputEl?.click(),
                      }, [Icon(ICONS.audio, 'w-3.5 h-3.5'), 'Choose file…']),
                      h('span', { class: 'text-xs text-gray-500' }, 'OGG, MP3, WAV, FLAC…'),
                    ]),
                h('input', {
                  type: 'file',
                  accept: 'audio/*,.ogg,.mp3,.wav,.flac,.m4a,.aac',
                  style: 'display:none',
                  ref: el => { audioInputEl = el; },
                  onChange: onAudioPicked,
                }),
              ]),

              // Cover art
              h('div', null, [
                h('label', { class: 'settings-label' }, [
                  'Cover Art ',
                  h('span', { class: 'text-gray-500 font-normal' }, 'optional'),
                ]),
                coverFile.value
                  ? FileChip(coverFile.value, clearCover, ICONS.image)
                  : h('div', { class: 'flex items-center gap-2' }, [
                      h('button', {
                        type: 'button',
                        class: 'settings-btn flex items-center gap-1.5',
                        disabled: uploading.value,
                        onClick: () => coverInputEl?.click(),
                      }, [Icon(ICONS.image, 'w-3.5 h-3.5'), 'Choose image…']),
                      h('span', { class: 'text-xs text-gray-500' }, 'JPG, PNG, WEBP…'),
                    ]),
                h('input', {
                  type: 'file',
                  accept: 'image/*,.jpg,.jpeg,.png,.webp,.gif',
                  style: 'display:none',
                  ref: el => { coverInputEl = el; },
                  onChange: onCoverPicked,
                }),
              ]),

              // Extra files notice
              extraCount > 0
                ? h('p', { class: 'text-xs text-gray-500 bg-dark-600 border border-white/[.05] rounded-lg px-3 py-2' },
                    `${extraCount} additional .gp ${extraCount === 1 ? 'file' : 'files'} will be imported without metadata.`)
                : null,

              // Error
              error.value
                ? h('div', { class: 'flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm' }, [
                    Icon(ICONS.alert, 'w-4 h-4 shrink-0'),
                    error.value,
                  ])
                : null,
            ]),

            // Dialog footer
            h('div', { class: 'flex justify-end gap-2 px-5 py-4 border-t border-white/[.06]' }, [
              h('button', {
                type: 'button',
                class: 'settings-btn',
                disabled: uploading.value,
                onClick: close,
              }, 'Cancel'),
              h('button', {
                type: 'button',
                class: 'settings-btn primary flex items-center gap-1.5',
                disabled: uploading.value || !primaryFile,
                onClick: submit,
              }, [
                Icon(uploading.value ? ICONS.spin : ICONS.upload,
                  `w-3.5 h-3.5${uploading.value ? ' animate-spin' : ''}`),
                uploading.value ? 'Importing…' : 'Import',
              ]),
            ]),

          ]),
        ]) : null,

      ]);
    };
  },
});

export async function setup(ctx) {
  ctx.slots.register('settings-panel', GpImportPanel, { order: 30 });
}
