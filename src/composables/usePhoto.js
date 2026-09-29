import { useQuasar } from 'quasar'
import { useTreeStore } from '@/stores/tree'
import { fileToDataUrl, pickFile } from '@/utils/image'

export function usePhotoUpload() {
  const $q = useQuasar()
  const store = useTreeStore()

  async function upload(personId, opts = {}) {
    const files = await pickFile('image/*', !!opts.multiple)
    if (!files.length) return
    try {
      for (const [i, f] of files.entries()) {
        const src = await fileToDataUrl(f)
        store.addPhoto(personId, src, f.name.replace(/\.[^.]+$/, ''), !!opts.avatar && i === 0)
      }
      $q.notify({ type: 'positive', message: files.length > 1 ? `Добавлено фото: ${files.length}` : 'Фото добавлено' })
    } catch (e) {
      $q.notify({ type: 'negative', message: e.message })
    }
  }
  return { upload }
}
