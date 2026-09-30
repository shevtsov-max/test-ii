/**
 * Данные прежней версии приложения (localStorage `ft:tree:v1`) переносятся в новое хранилище
 * один раз. Старый ключ не удаляется — на случай отката.
 */
import { migrateTree } from '@/domain/migrate'

const LEGACY_KEY = 'ft:tree:v1'
const DONE_KEY = 'rd:legacy-imported'

export function hasLegacyTree() {
  try {
    return !!localStorage.getItem(LEGACY_KEY) && !localStorage.getItem(DONE_KEY)
  } catch {
    return false
  }
}

/** @returns {import('@/domain/types').TreeData | null} */
export function readLegacyTree() {
  if (!hasLegacyTree()) return null
  try {
    const tree = migrateTree(JSON.parse(localStorage.getItem(LEGACY_KEY)))
    // Прежние настройки: центр древа
    const ui = JSON.parse(localStorage.getItem('ft:ui:v1') ?? 'null')
    return { tree, focusId: ui?.focusId && tree.persons[ui.focusId] ? ui.focusId : null }
  } catch (e) {
    console.error('[legacy] не удалось прочитать старое древо', e)
    return null
  }
}

export function markLegacyImported() {
  try {
    localStorage.setItem(DONE_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}
