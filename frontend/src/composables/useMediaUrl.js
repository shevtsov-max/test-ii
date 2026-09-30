import { ref, watch } from 'vue'
import { api } from '@/api'

/** URL полного файла медиа (из IndexedDB или по ссылке) — загружается асинхронно. */
export function useMediaUrl(mediaRef) {
  const url = ref(null)
  const loading = ref(false)
  watch(
    mediaRef,
    async (m) => {
      url.value = m?.thumb ?? null
      if (!m) return
      loading.value = true
      try {
        const u = await api.media.url(m)
        if (mediaRef.value?.id === m.id) url.value = u ?? m.thumb ?? null
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )
  return { url, loading }
}
