import { computed, type Ref } from 'vue'
import type { Person } from '@/types'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { FACT_TYPES, FAMILY_STATUSES, formatDate, hasDate, shortName, sortKey } from '@/utils/person'

export interface TimelineItem {
  key: string
  year: number | null
  sort: number
  title: string
  subtitle: string
  icon: string
  onClick: () => void
}

export function usePersonTimeline(person: Ref<Person | undefined | null>) {
  const store = useTreeStore()
  const ui = useUiStore()

  return computed<TimelineItem[]>(() => {
    const p = person.value
    if (!p) return []
    const out: TimelineItem[] = []
    const sub = (d: string, place: string) => [d, place].filter(Boolean).join(' · ')

    out.push({
      key: 'birth',
      year: p.birth.date.year ?? null,
      sort: hasDate(p.birth.date) ? sortKey(p.birth.date) : -1,
      title: 'Рождение',
      subtitle: sub(formatDate(p.birth.date), p.birth.place) || 'Дата неизвестна',
      icon: 'sym_r_child_friendly',
      onClick: () => ui.editPerson(p.id),
    })

    for (const f of store.spouseFamilies(p.id)) {
      const partner = f.partners.find((x) => x !== p.id)
      const st = FAMILY_STATUSES.find((s) => s.value === f.status)
      if (partner && (hasDate(f.marriage.date) || f.marriage.place)) {
        out.push({
          key: 'm-' + f.id,
          year: f.marriage.date.year ?? null,
          sort: sortKey(f.marriage.date),
          title: `${f.status === 'partners' ? 'Союз' : 'Брак'} с ${shortName(store.person(partner))}`,
          subtitle: sub(formatDate(f.marriage.date), f.marriage.place),
          icon: 'sym_r_favorite',
          onClick: () => ui.editFamily(f.id),
        })
      }
      if (partner && f.status === 'divorced' && hasDate(f.divorce.date)) {
        out.push({
          key: 'd-' + f.id,
          year: f.divorce.date.year ?? null,
          sort: sortKey(f.divorce.date),
          title: `Развод с ${shortName(store.person(partner))}`,
          subtitle: sub(formatDate(f.divorce.date), f.divorce.place),
          icon: st?.icon ?? 'sym_r_heart_broken',
          onClick: () => ui.editFamily(f.id),
        })
      }
      for (const c of f.children) {
        const ch = store.person(c)
        if (!ch || !hasDate(ch.birth.date)) continue
        out.push({
          key: 'c-' + c,
          year: ch.birth.date.year ?? null,
          sort: sortKey(ch.birth.date),
          title: `Рождение ${ch.gender === 'F' ? 'дочери' : ch.gender === 'M' ? 'сына' : 'ребёнка'} ${ch.firstName}`,
          subtitle: sub(formatDate(ch.birth.date), ch.birth.place),
          icon: 'sym_r_stroller',
          onClick: () => store.select(c),
        })
      }
    }

    for (const f of p.facts) {
      const t = FACT_TYPES.find((x) => x.value === f.type)
      out.push({
        key: 'f-' + f.id,
        year: f.date.year ?? null,
        sort: sortKey(f.date),
        title: f.type === 'custom' ? f.title || 'Событие' : (t?.label ?? 'Событие'),
        subtitle: [f.description, formatDate(f.date), f.place].filter(Boolean).join(' · '),
        icon: t?.icon ?? 'sym_r_event',
        onClick: () => ui.editFact(p.id, f.id),
      })
    }

    if (!p.living) {
      out.push({
        key: 'death',
        year: p.death.date.year ?? null,
        sort: hasDate(p.death.date) ? sortKey(p.death.date) : Number.MAX_SAFE_INTEGER,
        title: 'Смерть',
        subtitle: sub(formatDate(p.death.date), p.death.place) || 'Дата неизвестна',
        icon: 'sym_r_local_florist',
        onClick: () => ui.editPerson(p.id),
      })
    }
    return out.sort((a, b) => a.sort - b.sort)
  })
}
