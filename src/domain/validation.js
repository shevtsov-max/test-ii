/**
 * Проверка данных древа: противоречивые даты, подозрительный возраст, пустые записи, возможные дубликаты.
 * Объединение дубликатов — mergePersonsRecipe (выполняется внутри immer-черновика).
 */
import { hasDate, sortKey, yearsBetween } from './dates'
import { shortName } from './names'
import { normalize } from './search'

const yearOf = (d) => (d?.year ? d.year : null)

/**
 * @param {import('./graph').FamilyGraph} G
 * @returns {{ id: string, severity: 'error' | 'warning' | 'info', code: string, title: string, text: string, personIds: string[], familyId?: string }[]}
 */
export function checkTree(G) {
  const t = G.tree
  const out = []
  const add = (severity, code, title, text, personIds, familyId) =>
    out.push({ id: `${code}:${personIds.join(',')}:${familyId ?? ''}`, severity, code, title, text, personIds, familyId })
  const nowYear = new Date().getFullYear()

  for (const p of Object.values(t.persons)) {
    const name = shortName(p)
    const b = p.birth.date
    const d = p.death.date
    if (!p.firstName && !p.lastName && !p.birthName) add('warning', 'noname', 'Персона без имени', 'Укажите имя или фамилию.', [p.id])
    if (!p.living && hasDate(b) && hasDate(d) && sortKey(d) < sortKey(b))
      add('error', 'death-before-birth', 'Смерть раньше рождения', `${name}: дата смерти раньше даты рождения.`, [p.id])
    if (p.living && b.year && nowYear - b.year > 110)
      add('warning', 'too-old', 'Возможно, человек умер', `${name}: родился(ась) в ${b.year} году и отмечен(а) как живой(ая).`, [p.id])
    if (!p.living && b.year && d.year && d.year - b.year > 115)
      add('warning', 'long-life', 'Слишком долгая жизнь', `${name}: ${d.year - b.year} лет — проверьте даты.`, [p.id])
    if (b.year && b.year > nowYear) add('error', 'future-birth', 'Рождение в будущем', `${name}: год рождения ${b.year}.`, [p.id])

    // Возраст родителей
    const { father, mother, family } = G.parents(p.id)
    for (const par of [father, mother]) {
      const pp = G.person(par)
      if (!pp || !b.year) continue
      const age = yearsBetween(pp.birth.date, b)
      if (pp.birth.date.year && b.year < pp.birth.date.year)
        add('error', 'child-before-parent', 'Ребёнок старше родителя', `${name} родился(ась) раньше, чем ${shortName(pp)}.`, [p.id, pp.id], family?.id)
      else if (age && age.years < 13)
        add('warning', 'young-parent', 'Слишком юный родитель', `${shortName(pp)} было ${age.years} при рождении ${name}.`, [p.id, pp.id], family?.id)
      else if (age && age.years > (pp.gender === 'F' ? 55 : 80))
        add('warning', 'old-parent', 'Поздний ребёнок', `${shortName(pp)} было ${age.years} при рождении ${name}.`, [p.id, pp.id], family?.id)
      if (!pp.living && pp.death.date.year && b.year > pp.death.date.year + (pp.gender === 'M' ? 1 : 0))
        add('error', 'born-after-parent-death', 'Рождение после смерти родителя', `${name} родился(ась) после смерти ${shortName(pp)}.`, [p.id, pp.id], family?.id)
    }
  }

  for (const f of Object.values(t.families)) {
    const m = f.marriage.date
    if (!m.year) continue
    for (const pid of f.partners) {
      const pp = G.person(pid)
      if (!pp?.birth.date.year) continue
      const age = yearsBetween(pp.birth.date, m)
      if (age && age.years < 14) add('warning', 'young-marriage', 'Ранний брак', `${shortName(pp)}: брак в ${age.years} лет.`, [pid], f.id)
      if (!pp.living && pp.death.date.year && m.year > pp.death.date.year)
        add('error', 'marriage-after-death', 'Брак после смерти', `${shortName(pp)}: брак после даты смерти.`, [pid], f.id)
    }
  }

  // Люди без связей
  for (const p of Object.values(t.persons)) {
    if (!G.parentFamilies(p.id).length && !G.spouseFamilies(p.id).length && Object.keys(t.persons).length > 1)
      add('info', 'isolated', 'Нет связей', `${shortName(p)} не связан(а) ни с кем в древе.`, [p.id])
  }

  const order = { error: 0, warning: 1, info: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}

// ------------------------------------------------------------------ дубликаты
const translit = (s) => normalize(s).replace(/[ьъ]/g, '').replace(/й/g, 'и')

function nameKey(p) {
  return translit(p.firstName)
}
function surnameKeys(p) {
  return [p.lastName, p.birthName].filter(Boolean).map((s) => translit(s).replace(/(а|ая)$/, ''))
}

/**
 * Возможные дубликаты: совпадают имя и фамилия (с учётом рода), годы не противоречат друг другу.
 * @returns {{ a: string, b: string, score: number, reasons: string[] }[]}
 */
export function findDuplicates(G) {
  const persons = Object.values(G.tree.persons).filter((p) => p.firstName)
  const buckets = new Map()
  for (const p of persons) {
    const k = nameKey(p)
    const arr = buckets.get(k)
    if (arr) arr.push(p)
    else buckets.set(k, [p])
  }
  const out = []
  for (const list of buckets.values()) {
    if (list.length < 2 || list.length > 200) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a.gender !== 'U' && b.gender !== 'U' && a.gender !== b.gender) continue
        const sa = surnameKeys(a)
        const sb = surnameKeys(b)
        if (sa.length && sb.length && !sa.some((x) => sb.includes(x))) continue
        const reasons = ['Совпадает имя']
        let score = 30
        if (sa.length && sb.length) {
          score += 25
          reasons.push('совпадает фамилия')
        }
        if (a.middleName && b.middleName) {
          if (translit(a.middleName) === translit(b.middleName)) {
            score += 20
            reasons.push('совпадает отчество')
          } else continue
        }
        const ya = yearOf(a.birth.date)
        const yb = yearOf(b.birth.date)
        if (ya && yb) {
          if (Math.abs(ya - yb) > 2) continue
          score += ya === yb ? 20 : 10
          reasons.push(ya === yb ? 'тот же год рождения' : 'близкий год рождения')
        }
        // Уже связаны напрямую (родитель/ребёнок/супруг) — точно не дубликат
        if (G.neighbours(a.id).some((n) => n.id === b.id)) continue
        if (score >= 55) out.push({ a: a.id, b: b.id, score: Math.min(100, score), reasons })
      }
    }
  }
  return out.sort((x, y) => y.score - x.score)
}

/**
 * Объединить персону dropId в keepId (внутри immer-черновика древа).
 * Связи, события, медиа и источники переносятся; пустые поля keep заполняются из drop.
 * @param {import('./types').TreeData} draft
 */
export function mergePersonsRecipe(draft, keepId, dropId) {
  const keep = draft.persons[keepId]
  const drop = draft.persons[dropId]
  if (!keep || !drop || keepId === dropId) return
  for (const k of ['firstName', 'middleName', 'lastName', 'birthName', 'nickname', 'title', 'suffix', 'occupation', 'email', 'phone', 'note']) {
    if (!keep[k] && drop[k]) keep[k] = drop[k]
  }
  if (keep.biography && drop.biography && keep.biography !== drop.biography) keep.biography += '\n\n' + drop.biography
  else if (!keep.biography) keep.biography = drop.biography
  if (keep.gender === 'U') keep.gender = drop.gender
  if (!keep.clanId) keep.clanId = drop.clanId
  if (!keep.residencePlaceId) keep.residencePlaceId = drop.residencePlaceId
  if (!keep.avatarId) keep.avatarId = drop.avatarId
  if (!drop.living) keep.living = keep.living && drop.living
  for (const ev of ['birth', 'death']) {
    if (!hasDate(keep[ev].date) && hasDate(drop[ev].date)) keep[ev].date = drop[ev].date
    if (!keep[ev].placeId && drop[ev].placeId) keep[ev].placeId = drop[ev].placeId
    keep[ev].citations = [...(keep[ev].citations ?? []), ...(drop[ev].citations ?? [])]
  }
  if (!keep.death.cause) keep.death.cause = drop.death.cause
  keep.events.push(...drop.events)
  keep.citations.push(...drop.citations)
  keep.custom = { ...drop.custom, ...keep.custom }
  keep.favorite = keep.favorite || drop.favorite
  keep.updatedAt = Date.now()

  for (const f of Object.values(draft.families)) {
    if (f.partners.includes(dropId)) f.partners = [...new Set(f.partners.map((x) => (x === dropId ? keepId : x)))]
    if (f.children.includes(dropId)) {
      f.children = [...new Set(f.children.map((x) => (x === dropId ? keepId : x)))]
      if (f.childLinks?.[dropId]) {
        f.childLinks[keepId] ??= f.childLinks[dropId]
        delete f.childLinks[dropId]
      }
    }
  }
  // Одинаковые семьи (те же партнёры) сливаются
  const seen = new Map()
  for (const f of Object.values(draft.families)) {
    if (f.partners.length < 2) continue
    const key = [...f.partners].sort().join('|')
    const other = seen.get(key)
    if (!other) {
      seen.set(key, f)
      continue
    }
    for (const c of f.children) if (!other.children.includes(c)) other.children.push(c)
    Object.assign(other.childLinks, f.childLinks)
    if (!hasDate(other.marriage.date)) other.marriage = f.marriage
    delete draft.families[f.id]
  }
  for (const m of Object.values(draft.media ?? {})) {
    if (m.personIds.includes(dropId)) m.personIds = [...new Set(m.personIds.map((x) => (x === dropId ? keepId : x)))]
  }
  if (draft.homePersonId === dropId) draft.homePersonId = keepId
  delete draft.persons[dropId]
}
