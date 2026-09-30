/**
 * Файлы медиа в IndexedDB: фото уменьшаются до 1600 px, миниатюра 240 px хранится прямо в древе.
 */
import { ApiError } from '../errors'
import { store } from './db'
import { uid } from '@/domain/model'
import { readImage, blobToDataUrl, dataUrlToBlob } from '@/utils/files'

const urlCache = new Map()

export const media = {
  /**
   * @param {string} treeId
   * @param {File} file
   * @returns {Promise<{ fileKey: string, src: null, thumb: string | null, mime: string, size: number, kind: string, title: string }>}
   */
  async upload(treeId, file) {
    const isImage = file.type.startsWith('image/')
    let blob = file
    let thumb = null
    if (isImage) {
      const img = await readImage(file)
      blob = file.type === 'image/svg+xml' ? file : await img.toBlob(1600, 0.88)
      thumb = await img.toDataUrl(240, 0.8)
      img.release()
    }
    if (blob.size > 25 * 1024 * 1024) throw new ApiError('Файл больше 25 МБ', 'VALIDATION')
    const fileKey = uid('f')
    await store.put('files', { treeId, blob, mime: blob.type || file.type, name: file.name }, fileKey)
    return {
      fileKey,
      src: null,
      thumb,
      mime: blob.type || file.type,
      size: blob.size,
      kind: isImage ? 'photo' : /pdf|word|text|document|sheet/i.test(file.type) ? 'document' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'other',
      title: file.name.replace(/\.[^.]+$/, ''),
    }
  },

  /** URL полного файла. */
  async url(m) {
    if (!m) return null
    if (m.src) return m.src
    if (!m.fileKey) return m.thumb ?? null
    if (urlCache.has(m.fileKey)) return urlCache.get(m.fileKey)
    const rec = await store.get('files', m.fileKey)
    if (!rec) return m.thumb ?? null
    const u = URL.createObjectURL(rec.blob)
    urlCache.set(m.fileKey, u)
    return u
  },

  async remove(fileKey) {
    if (!fileKey) return
    await store.delete('files', fileKey)
    const u = urlCache.get(fileKey)
    if (u) URL.revokeObjectURL(u)
    urlCache.delete(fileKey)
  },

  /** Для резервной копии: файл записи медиа как data URL (или null, если файла нет). */
  async exportData(m) {
    if (!m?.fileKey) return null
    const rec = await store.get('files', m.fileKey)
    return rec ? blobToDataUrl(rec.blob) : null
  },

  /** Восстановление файла из резервной копии. */
  async importData(treeId, dataUrl) {
    const blob = dataUrlToBlob(dataUrl)
    const fileKey = uid('f')
    await store.put('files', { treeId, blob, mime: blob.type, name: '' }, fileKey)
    return fileKey
  },
}
