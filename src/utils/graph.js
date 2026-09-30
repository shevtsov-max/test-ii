import { sortKey } from './person'

export function parentFamily(t, pid) {
  for (const f of Object.values(t.families)) if (f.children.includes(pid)) return f
  return undefined
}

export function spouseFamilies(t, pid) {
  return Object.values(t.families)
    .filter((f) => f.partners.includes(pid))
    .sort((a, b) => sortKey(a.marriage.date) - sortKey(b.marriage.date))
}

export function partnerIn(f, pid) {
  return f.partners.find((x) => x !== pid)
}

/** Отец и мать (по полу; при одинаковом/неизвестном — по порядку). */
export function orderPartners(t, f) {
  const [a, b] = f.partners
  if (!b) {
    const p = a ? t.persons[a] : undefined
    if (!p) return [undefined, undefined]
    return p.gender === 'F' ? [undefined, a] : [a, undefined]
  }
  const pa = t.persons[a]
  const pb = t.persons[b]
  if (pa?.gender === 'F' && pb?.gender !== 'F') return [b, a]
  return [a, b]
}

export function parentsOf(t, pid) {
  const family = parentFamily(t, pid)
  if (!family) return { family: undefined, father: undefined, mother: undefined }
  const [father, mother] = orderPartners(t, family)
  return { family, father, mother }
}

export function byBirth(t) {
  return (a, b) => sortKey(t.persons[a]?.birth.date) - sortKey(t.persons[b]?.birth.date)
}

export function childrenOf(t, pid) {
  const out = []
  for (const f of spouseFamilies(t, pid)) for (const c of f.children) if (!out.includes(c)) out.push(c)
  return out.sort(byBirth(t))
}

export function partnersOf(t, pid) {
  return spouseFamilies(t, pid)
    .map((f) => ({ id: partnerIn(f, pid), family: f }))
    .filter((x) => !!x.id)
}

export function siblingsOf(t, pid) {
  const pf = parentFamily(t, pid)
  const full = pf ? pf.children.filter((c) => c !== pid) : []
  const half = []
  if (pf) {
    for (const par of pf.partners) {
      for (const f of spouseFamilies(t, par)) {
        if (f.id === pf.id) continue
        for (const c of f.children) if (c !== pid && !full.includes(c) && !half.includes(c)) half.push(c)
      }
    }
  }
  const s = byBirth(t)
  return { full: full.sort(s), half: half.sort(s) }
}

export function ancestorsWithDistance(t, pid) {
  const dist = new Map([[pid, 0]])
  const q = [pid]
  while (q.length) {
    const cur = q.shift()
    const pf = parentFamily(t, cur)
    if (!pf) continue
    for (const p of pf.partners) {
      if (!dist.has(p)) {
        dist.set(p, dist.get(cur) + 1)
        q.push(p)
      }
    }
  }
  return dist
}

const g = (p, m, f, u) => (p?.gender === 'F' ? f : p?.gender === 'M' ? m : (u ?? `${m}/${f}`))

function pra(n) {
  return 'пра'.repeat(Math.max(0, n))
}

function cousinPrefix(n) {
  const list = ['', 'двоюродный', 'троюродный', 'четвероюродный', 'пятиюродный']
  return list[n] ?? `${n + 1}-юродный`
}

function feminize(prefix, female) {
  if (!female) return prefix
  return prefix.replace(/ый$/, 'ая')
}

function bloodRelation(a, b, target, halfNote = '') {
  const female = target?.gender === 'F'
  if (a === 0 && b === 0) return 'Это Вы'
  if (b === 0) {
    if (a === 1) return g(target, 'Отец', 'Мать', 'Родитель')
    return cap(pra(a - 2) + g(target, 'дедушка', 'бабушка', 'дедушка/бабушка'))
  }
  if (a === 0) {
    if (b === 1) return g(target, 'Сын', 'Дочь', 'Ребёнок')
    return cap(pra(b - 2) + g(target, 'внук', 'внучка', 'внук/внучка'))
  }
  if (a === 1 && b === 1) return g(target, 'Брат', 'Сестра', 'Брат/сестра') + halfNote
  if (b === 1) {
    // брат/сестра предка
    if (a === 2) return g(target, 'Дядя', 'Тётя', 'Дядя/тётя')
    return cap(`${feminize('двоюродный', female)} ${pra(a - 3)}${g(target, 'дедушка', 'бабушка')}`)
  }
  if (a === 1) {
    if (b === 2) return g(target, 'Племянник', 'Племянница', 'Племянник/племянница')
    return cap(`${female ? 'внучатая' : 'внучатый'} ${pra(b - 3)}${g(target, 'племянник', 'племянница')}`)
  }
  const degree = Math.min(a, b) - 1
  const prefix = feminize(cousinPrefix(degree), female)
  if (a === b) return cap(`${prefix} ${g(target, 'брат', 'сестра')}`)
  if (a > b) {
    const up = a - b
    if (up === 1) return cap(`${prefix} ${g(target, 'дядя', 'тётя')}`)
    return cap(`${prefix} ${pra(up - 2)}${g(target, 'дедушка', 'бабушка')}`)
  }
  const down = b - a
  if (down === 1) return cap(`${prefix} ${g(target, 'племянник', 'племянница')}`)
  return cap(`${prefix} ${pra(down - 2)}${g(target, 'внук', 'внучка')}`)
}

/** Родительный падеж для терминов родства: «двоюродная сестра» → «двоюродной сестры». */
export function genitive(label) {
  return label
    .split(' ')
    .map((w, i, arr) => {
      if (i > 0 && arr[i - 1] === 'по') return w
      if (w === 'по') return w
      if (/ый$|ий$/.test(w) && i < arr.length - 1) return w.replace(/(ый|ий)$/, 'ого')
      if (/ая$/.test(w) && i < arr.length - 1) return w.replace(/ая$/, 'ой')
      if (w === 'дочь') return 'дочери'
      if (/я$/.test(w)) return w.slice(0, -1) + 'и'
      if (/[кгхжшчщ]а$/.test(w)) return w.slice(0, -1) + 'и'
      if (/а$/.test(w)) return w.slice(0, -1) + 'ы'
      if (/[бвгджзклмнпрстфхцчшщ]$/.test(w)) return w + 'а'
      return w
    })
    .join(' ')
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function blood(t, from, to) {
  if (from === to) return { a: 0, b: 0, label: 'Это Вы' }
  const A = ancestorsWithDistance(t, from)
  const B = ancestorsWithDistance(t, to)
  let best = null
  let bestCount = 0
  for (const [anc, da] of A) {
    const db = B.get(anc)
    if (db === undefined) continue
    if (!best || da + db < best.a + best.b) {
      best = { a: da, b: db, anc }
      bestCount = 1
    } else if (da + db === best.a + best.b) bestCount++
  }
  if (!best) return null
  // Родство через одного общего предка, у которого несколько браков (дядя — сын деда от другой жены и т. п.)
  const sharedOne = best.a >= 1 && best.b >= 1 && !(best.a === 1 && best.b === 1) && bestCount === 1 && spouseFamilies(t, best.anc).length >= 2
  const halfCollateral = sharedOne ? ' (сводн.)' : ''
  let half = ''
  if (best.a === 1 && best.b === 1) {
    const pa = parentFamily(t, from)
    const pb = parentFamily(t, to)
    if (pa && pb && pa.id !== pb.id) {
      const common = pa.partners.find((x) => pb.partners.includes(x))
      const cp = common ? t.persons[common] : undefined
      half = cp?.gender === 'F' ? ' по матери' : cp?.gender === 'M' ? ' по отцу' : ' (сводн.)'
    }
  }
  return { a: best.a, b: best.b, label: bloodRelation(best.a, best.b, t.persons[to], half) + halfCollateral }
}

function spouseWord(t, f, pid) {
  const p = t.persons[pid]
  if (f.status === 'divorced' || f.status === 'separated') return g(p, 'Бывший муж', 'Бывшая жена', 'Бывший партнёр')
  if (f.status === 'partners' || f.status === 'unknown') return g(p, 'Партнёр', 'Партнёрша', 'Партнёр')
  if (f.status === 'engaged') return g(p, 'Жених', 'Невеста', 'Жених/невеста')
  return g(p, 'Муж', 'Жена', 'Супруг(а)')
}

/** Родство «кем приходится to для from» по-русски. */
export function relationship(t, from, to, depth = 0) {
  if (!from || !t.persons[from] || !t.persons[to]) return ''
  const bl = blood(t, from, to)
  if (bl) return bl.label
  const target = t.persons[to]
  const me = t.persons[from]
  // Супруг
  for (const f of spouseFamilies(t, from)) {
    if (f.partners.includes(to)) return spouseWord(t, f, to)
  }
  // Супруг кровного родственника
  for (const f of spouseFamilies(t, to)) {
    const rel = partnerIn(f, to)
    if (!rel) continue
    const r = blood(t, from, rel)
    if (!r) continue
    if (f.status === 'divorced' || f.status === 'separated') return `${spouseWord(t, f, to)} ${genitive(r.label.toLowerCase())}`
    if (r.a === 1 && r.b === 0) return g(target, 'Отчим', 'Мачеха', 'Отчим/мачеха')
    if (r.a === 0 && r.b === 1) return g(target, 'Зять', 'Невестка', 'Зять/невестка')
    if (r.a === 1 && r.b === 1) return g(target, 'Зять', 'Невестка', 'Зять/невестка')
    if (r.a === 0 && r.b === 2) return g(target, 'Муж внучки', 'Жена внука')
    return `${spouseWord(t, f, to)} ${genitive(r.label.toLowerCase())}`
  }
  // Кровный родственник супруга
  for (const f of spouseFamilies(t, from)) {
    const sp = partnerIn(f, from)
    if (!sp) continue
    const r = blood(t, sp, to)
    if (!r) continue
    const wife = me.gender === 'M'
    if (r.a === 1 && r.b === 0) return wife ? g(target, 'Тесть', 'Тёща') : g(target, 'Свёкор', 'Свекровь')
    if (r.a === 0 && r.b === 1) return g(target, 'Пасынок', 'Падчерица', 'Пасынок/падчерица')
    if (r.a === 1 && r.b === 1) return wife ? g(target, 'Шурин', 'Свояченица') : g(target, 'Деверь', 'Золовка')
    const spW = t.persons[sp]?.gender === 'F' ? 'жены' : t.persons[sp]?.gender === 'M' ? 'мужа' : 'супруга'
    return `${r.label} ${spW}`
  }
  // Дальше — цепочка через ещё одного человека: «Муж свояченицы», «Бывший муж невестки», «Дочь невестки»
  if (depth === 0) {
    const known = (id) => {
      const r = relationship(t, from, id, 1)
      return r && r !== 'Родственник' && r !== 'Это Вы' ? r : ''
    }
    for (const f of spouseFamilies(t, to)) {
      const other = partnerIn(f, to)
      const r = other && known(other)
      if (r) return `${spouseWord(t, f, to)} ${genitive(r.toLowerCase())}`
    }
    const pf = parentFamily(t, to)
    for (const par of pf?.partners ?? []) {
      const r = known(par)
      if (r) return `${g(target, 'Сын', 'Дочь', 'Ребёнок')} ${genitive(r.toLowerCase())}`
    }
  }
  return 'Родственник'
}

/** Все персоны, связанные с pid (компонента связности). */
export function connectedComponent(t, pid) {
  const seen = new Set([pid])
  const q = [pid]
  const fams = Object.values(t.families)
  while (q.length) {
    const cur = q.shift()
    for (const f of fams) {
      if (!f.partners.includes(cur) && !f.children.includes(cur)) continue
      for (const x of [...f.partners, ...f.children]) {
        if (!seen.has(x)) {
          seen.add(x)
          q.push(x)
        }
      }
    }
  }
  return seen
}
