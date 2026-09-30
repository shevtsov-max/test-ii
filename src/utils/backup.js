/**
 * Резервная копия древа (.json) с файлами медиа внутри и импорт из .json / .ged.
 */
import { api } from '@/api'
import { exportGedcom, importGedcom } from '@/domain/gedcom'
import { looksLikeTree, migrateTree } from '@/domain/migrate'
import { downloadText, fileSlug } from './files'

export const BACKUP_FORMAT = 'rodoslovnaya-backup'

/** Скачать резервную копию: древо + файлы (data URL). */
export async function downloadBackup(tree) {
  const media = {}
  for (const [id, m] of Object.entries(tree.media ?? {})) {
    const data = m.fileKey ? await api.media.exportData(m.fileKey).catch(() => null) : null
    media[id] = data ? { ...m, fileKey: null, data } : { ...m, fileKey: null }
  }
  const out = { $format: BACKUP_FORMAT, $exportedAt: new Date().toISOString(), ...tree, media }
  downloadText(`${fileSlug(tree.name)}.json`, JSON.stringify(out, null, 1))
}

export function downloadGedcom(tree, opts) {
  downloadText(`${fileSlug(tree.name)}.ged`, exportGedcom(tree, opts), 'text/plain')
}

/**
 * Прочитать файл резервной копии или GEDCOM. Файлы медиа из копии сохраняются в хранилище.
 * @param {File} file
 * @returns {Promise<import('@/domain/types').TreeData>}
 */
export async function readTreeFile(file, treeIdHint = 'import') {
  const text = await file.text()
  const isGed = /\.ged(com)?$/i.test(file.name) || /^﻿?0 HEAD/m.test(text.slice(0, 300))
  if (isGed) return importGedcom(text, file.name.replace(/\.[^.]+$/, ''))
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Файл не похож на резервную копию (.json) или GEDCOM (.ged)')
  }
  if (!looksLikeTree(raw)) throw new Error('В файле нет данных древа')
  const tree = migrateTree(raw)
  // Файлы из копии → локальное хранилище
  for (const [id, m] of Object.entries(raw.media ?? {})) {
    if (!m?.data || !tree.media[id]) continue
    try {
      const fileKey = await api.media.importData(treeIdHint, m.data)
      tree.media[id] = { ...tree.media[id], fileKey, src: null }
    } catch {
      tree.media[id] = { ...tree.media[id], src: m.data }
    }
  }
  return tree
}
