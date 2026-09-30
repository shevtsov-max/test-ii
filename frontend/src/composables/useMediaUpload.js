import { useQuasar } from 'quasar'
import { api, errorMessage } from '@/api'
import { newMedia } from '@/domain/model'
import { useTreeStore } from '@/stores/tree'
import { pickFiles } from '@/utils/files'

/** Загрузка фото и документов в древо. */
export function useMediaUpload() {
  const $q = useQuasar()
  const tree = useTreeStore()

  /**
   * @param {string[]} personIds к кому привязать файлы
   * @param {{ avatar?: boolean, accept?: string, multiple?: boolean, files?: File[] }} [opts]
   * @returns {Promise<string[]>} id новых медиа
   */
  async function uploadFor(personIds = [], opts = {}) {
    const files = opts.files ?? (await pickFiles(opts.accept ?? 'image/*,application/pdf,.doc,.docx,.txt,audio/*,video/*', opts.multiple ?? !opts.avatar))
    if (!files.length) return []
    const dismiss = files.length > 1 ? $q.notify({ group: false, spinner: true, message: `Загрузка файлов: ${files.length}…`, timeout: 0 }) : null
    const items = []
    const errors = []
    for (const f of files) {
      try {
        const r = await api.media.upload(tree.treeId, f)
        items.push(newMedia({ ...r, personIds: [...personIds] }))
      } catch (e) {
        errors.push(`${f.name}: ${errorMessage(e)}`)
      }
    }
    dismiss?.()
    if (items.length) {
      tree.addMedia(items)
      if (opts.avatar && personIds.length === 1 && items[0].kind === 'photo') tree.setAvatar(personIds[0], items[0].id)
      $q.notify({ type: 'positive', message: items.length > 1 ? `Добавлено файлов: ${items.length}` : opts.avatar ? 'Фото обновлено' : 'Файл добавлен' })
    }
    if (errors.length) $q.notify({ type: 'negative', message: errors.join('\n'), timeout: 6000, multiLine: true })
    return items.map((m) => m.id)
  }

  return { uploadFor }
}
