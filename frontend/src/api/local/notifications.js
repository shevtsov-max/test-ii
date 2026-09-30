/**
 * Памятные даты в локальном режиме: считаются в браузере по всем древам пользователя.
 * Уведомления в Telegram требуют сервера — здесь они недоступны.
 */
import { FamilyGraph } from '@/domain/graph'
import { shortName } from '@/domain/names'
import { upcomingAnniversaries } from '@/domain/stats'
import { store } from './db'

const dateString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const notifications = {
  async settings() {
    return { available: false, botUsername: null, telegramLinked: false, telegramUsername: null, enabled: false, sendTime: '09:00', timezone: 'Europe/Moscow', birthdays: true, anniversaries: true, memorials: false }
  },

  /** Ближайшие памятные даты по всем древам пользователя. */
  async upcoming(userId, days = 7) {
    const out = []
    for (const s of await store.byIndex('summaries', 'ownerId', userId)) {
      const tree = await store.get('trees', s.id)
      if (!tree) continue
      const G = new FamilyGraph(tree)
      for (const a of upcomingAnniversaries(G, days)) {
        out.push({
          kind: a.kind.replace('-', '_'),
          date: dateString(a.when),
          inDays: a.inDays,
          years: a.years,
          treeId: s.id,
          treeName: s.name,
          personIds: a.personIds,
          names: a.personIds.map((id) => shortName(tree.persons[id])),
        })
      }
    }
    return out.sort((a, b) => a.inDays - b.inDays)
  },
}
