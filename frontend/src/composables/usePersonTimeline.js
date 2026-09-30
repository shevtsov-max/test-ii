import { computed } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { formatDate, hasDate, sortKey, yearsBetween, formatAge } from '@/domain/dates'
import { eventTitle, eventTypeInfo, statusInfo } from '@/domain/model'
import { shortName } from '@/domain/names'
import { placeName } from '@/domain/places'

/**
 * Хронология жизни персоны: рождение, события, браки, рождение детей, смерти близких, смерть.
 * @param {import('vue').Ref<import('@/domain/types').Person | undefined>} person
 */
export function usePersonTimeline(person, opts = {}) {
  const tree = useTreeStore()
  const ui = useUiStore()

  return computed(() => {
    const p = person.value
    const G = tree.graph
    if (!p || !G) return []
    const t = tree.tree
    const out = []
    const sub = (d, placeId, extra) => [formatDate(d), placeName(t, placeId), extra].filter(Boolean).join(' · ')
    const age = (d) => {
      const a = yearsBetween(p.birth.date, d)
      return a ? `в ${formatAge(a).replace(/^~/, '~')}` : ''
    }

    out.push({
      key: 'birth',
      kind: 'birth',
      year: p.birth.date.year ?? null,
      sort: hasDate(p.birth.date) ? sortKey(p.birth.date) : -1,
      title: 'Рождение',
      subtitle: sub(p.birth.date, p.birth.placeId) || 'дата неизвестна',
      icon: 'sym_r_child_friendly',
      onClick: () => ui.editPerson(p.id),
    })

    for (const f of G.spouseFamilies(p.id)) {
      const partner = G.partnerIn(f, p.id)
      const st = statusInfo(f.status)
      if (partner && (hasDate(f.marriage.date) || f.marriage.placeId)) {
        out.push({
          key: 'm-' + f.id,
          kind: 'marriage',
          year: f.marriage.date.year ?? null,
          sort: sortKey(f.marriage.date),
          title: `${f.status === 'engaged' ? 'Помолвка' : f.status === 'partners' ? 'Союз' : 'Брак'}: ${shortName(G.person(partner))}`,
          subtitle: sub(f.marriage.date, f.marriage.placeId, age(f.marriage.date)),
          icon: st.icon,
          onClick: () => ui.editFamily(f.id),
        })
      }
      if (partner && f.status === 'divorced' && hasDate(f.divorce.date)) {
        out.push({
          key: 'd-' + f.id,
          kind: 'divorce',
          year: f.divorce.date.year ?? null,
          sort: sortKey(f.divorce.date),
          title: `Развод: ${shortName(G.person(partner))}`,
          subtitle: sub(f.divorce.date, f.divorce.placeId),
          icon: 'sym_r_heart_broken',
          onClick: () => ui.editFamily(f.id),
        })
      }
      for (const c of f.children) {
        const ch = G.person(c)
        if (!ch || !hasDate(ch.birth.date)) continue
        out.push({
          key: 'c-' + c,
          kind: 'child',
          year: ch.birth.date.year ?? null,
          sort: sortKey(ch.birth.date),
          title: `Рождение ${ch.gender === 'F' ? 'дочери' : ch.gender === 'M' ? 'сына' : 'ребёнка'}: ${ch.firstName || 'без имени'}`,
          subtitle: sub(ch.birth.date, ch.birth.placeId, age(ch.birth.date)),
          icon: 'sym_r_stroller',
          personId: c,
          onClick: () => tree.selectPerson(c),
        })
      }
    }

    for (const e of p.events) {
      const info = eventTypeInfo(e.type)
      out.push({
        key: 'e-' + e.id,
        kind: e.type,
        year: e.date.year ?? null,
        sort: hasDate(e.date) ? sortKey(e.date) : Number.MAX_SAFE_INTEGER - 1,
        title: eventTitle(e),
        subtitle: [e.description, sub(e.date, e.placeId)].filter(Boolean).join(' · '),
        icon: info.icon,
        eventId: e.id,
        citations: e.citations?.length ?? 0,
        onClick: () => ui.editEvent(p.id, e.id),
      })
    }

    // Смерти родителей и супругов — контекст жизни
    if (opts.relatives) {
      const { father, mother } = G.parents(p.id)
      const rel = [
        [father, 'отца'],
        [mother, 'матери'],
        ...G.partners(p.id).map((x) => [x.id, G.person(x.id)?.gender === 'F' ? 'жены' : 'мужа']),
      ]
      for (const [id, word] of rel) {
        const r = G.person(id)
        if (!r || r.living || !hasDate(r.death.date)) continue
        if (!p.living && sortKey(r.death.date) > sortKey(p.death.date)) continue
        if (sortKey(r.death.date) < sortKey(p.birth.date)) continue
        out.push({
          key: 'rd-' + id,
          kind: 'relative-death',
          year: r.death.date.year,
          sort: sortKey(r.death.date),
          title: `Смерть ${word}: ${shortName(r)}`,
          subtitle: sub(r.death.date, r.death.placeId),
          icon: 'sym_r_local_florist',
          muted: true,
          personId: id,
          onClick: () => tree.selectPerson(id),
        })
      }
    }

    if (!p.living) {
      out.push({
        key: 'death',
        kind: 'death',
        year: p.death.date.year ?? null,
        sort: hasDate(p.death.date) ? sortKey(p.death.date) : Number.MAX_SAFE_INTEGER,
        title: 'Смерть',
        subtitle: [sub(p.death.date, p.death.placeId, age(p.death.date)), p.death.cause].filter(Boolean).join(' · ') || 'дата неизвестна',
        icon: 'sym_r_deceased',
        onClick: () => ui.editPerson(p.id),
      })
    }
    return out.sort((a, b) => a.sort - b.sort)
  })
}
