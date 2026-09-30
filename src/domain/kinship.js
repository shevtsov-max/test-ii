/**
 * Родство по-русски: «Прадедушка», «Двоюродная сестра», «Дядя (сводн.)», «Муж свояченицы»…
 * relationship(G, from, to) — кем `to` приходится `from`.
 */
import { childLink, statusInfo } from './model'

const g = (p, m, f, u) => (p?.gender === 'F' ? f : p?.gender === 'M' ? m : (u ?? `${m}/${f}`))
const pra = (n) => 'пра'.repeat(Math.max(0, n))
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function cousinPrefix(n) {
  const list = ['', 'двоюродный', 'троюродный', 'четвероюродный', 'пятиюродный', 'шестиюродный']
  return list[n] ?? `${n + 1}-юродный`
}
const feminize = (prefix, female) => (female ? prefix.replace(/ый$/, 'ая') : prefix)

function bloodLabel(a, b, target, halfNote = '') {
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
    if (a === 2) return g(target, 'Дядя', 'Тётя', 'Дядя/тётя')
    return cap(`${feminize('двоюродный', female)} ${pra(a - 3)}${g(target, 'дедушка', 'бабушка', 'дедушка/бабушка')}`)
  }
  if (a === 1) {
    if (b === 2) return g(target, 'Племянник', 'Племянница', 'Племянник/племянница')
    return cap(`${female ? 'внучатая' : 'внучатый'} ${pra(b - 3)}${g(target, 'племянник', 'племянница')}`)
  }
  const degree = Math.min(a, b) - 1
  const prefix = feminize(cousinPrefix(degree), female)
  if (a === b) return cap(`${prefix} ${g(target, 'брат', 'сестра', 'брат/сестра')}`)
  if (a > b) {
    const up = a - b
    if (up === 1) return cap(`${prefix} ${g(target, 'дядя', 'тётя', 'дядя/тётя')}`)
    return cap(`${prefix} ${pra(up - 2)}${g(target, 'дедушка', 'бабушка', 'дедушка/бабушка')}`)
  }
  const down = b - a
  if (down === 1) return cap(`${prefix} ${g(target, 'племянник', 'племянница', 'племянник/племянница')}`)
  return cap(`${prefix} ${pra(down - 2)}${g(target, 'внук', 'внучка', 'внук/внучка')}`)
}

/** Родительный падеж для терминов родства: «двоюродная сестра» → «двоюродной сестры». */
export function genitive(label) {
  return label
    .split(' ')
    .map((w, i, arr) => {
      if (w.startsWith('(')) return w
      if (i > 0 && arr[i - 1] === 'по') return w
      if (w === 'по') return w
      if (/ый$|ий$/.test(w) && i < arr.length - 1) return w.replace(/(ый|ий)$/, 'ого')
      if (/ая$/.test(w) && i < arr.length - 1) return w.replace(/ая$/, 'ой')
      if (w === 'дочь') return 'дочери'
      if (w === 'мать') return 'матери'
      if (w === 'отец') return 'отца'
      if (/я$/.test(w)) return w.slice(0, -1) + 'и'
      if (/[кгхжшчщ]а$/.test(w)) return w.slice(0, -1) + 'и'
      if (/а$/.test(w)) return w.slice(0, -1) + 'ы'
      if (/ь$/.test(w)) return w.slice(0, -1) + 'я'
      if (/[бвгджзклмнпрстфхцчшщ]$/.test(w)) return w + 'а'
      return w
    })
    .join(' ')
}

/**
 * @param {import('./graph').FamilyGraph} G
 * @param {'blood' | 'all'} links
 */
function blood(G, from, to, links = 'blood') {
  if (from === to) return { a: 0, b: 0, label: 'Это Вы' }
  const A = G.ancestorDistances(from, links)
  const B = G.ancestorDistances(to, links)
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
  // Родство через одного общего предка с несколькими браками (дядя — сын деда от другой жены и т. п.)
  const sharedOne =
    best.a >= 1 && best.b >= 1 && !(best.a === 1 && best.b === 1) && bestCount === 1 && G.spouseFamilies(best.anc).length >= 2
  const halfCollateral = sharedOne ? ' (сводн.)' : ''
  let half = ''
  if (best.a === 1 && best.b === 1) {
    const pa = G.parentFamily(from)
    const pb = G.parentFamily(to)
    if (pa && pb && pa.id !== pb.id) {
      const common = pa.partners.find((x) => pb.partners.includes(x))
      const cp = G.person(common)
      half = cp?.gender === 'F' ? ' по матери' : cp?.gender === 'M' ? ' по отцу' : ' (сводн.)'
    }
  }
  return { ...best, label: bloodLabel(best.a, best.b, G.person(to), half) + halfCollateral }
}

function spouseWord(G, f, pid) {
  const p = G.person(pid)
  const [m, w, u] = statusInfo(f.status).partner
  return g(p, m, w, u)
}

/** Отношения через приёмную семью: приёмный отец, отчим, пасынок… */
function adoptive(G, from, to) {
  const r = blood(G, from, to, 'all')
  if (!r) return null
  const target = G.person(to)
  if (r.a === 1 && r.b === 0) {
    const f = G.parentFamilies(from).find((x) => x.partners.includes(to))
    const link = childLink(f, from)
    if (link === 'step') return g(target, 'Отчим', 'Мачеха', 'Отчим/мачеха')
    if (link === 'guardian') return g(target, 'Опекун', 'Опекунша', 'Опекун')
    return g(target, 'Приёмный отец', 'Приёмная мать', 'Приёмный родитель')
  }
  if (r.a === 0 && r.b === 1) {
    const f = G.parentFamilies(to).find((x) => x.partners.includes(from))
    const link = childLink(f, to)
    if (link === 'step') return g(target, 'Пасынок', 'Падчерица', 'Пасынок/падчерица')
    if (link === 'guardian') return g(target, 'Подопечный', 'Подопечная', 'Подопечный')
    return g(target, 'Приёмный сын', 'Приёмная дочь', 'Приёмный ребёнок')
  }
  if (r.a === 1 && r.b === 1) return g(target, 'Сводный брат', 'Сводная сестра', 'Сводный брат/сестра')
  return `${r.label} (по усыновлению)`
}

/**
 * Кем `to` приходится `from`. Пустая строка — если кого-то из них нет.
 * @param {import('./graph').FamilyGraph} G
 */
export function relationship(G, from, to) {
  if (!from || !G.person(from) || !G.person(to)) return ''
  return G.memo(`rel:${from}:${to}`, () => compute(G, from, to, 0))
}

function compute(G, from, to, depth) {
  const bl = blood(G, from, to)
  if (bl) return bl.label
  const target = G.person(to)
  const me = G.person(from)
  // Супруг
  for (const f of G.spouseFamilies(from)) if (f.partners.includes(to)) return spouseWord(G, f, to)
  // Приёмные родители и дети, отчимы и мачехи
  const ad = adoptive(G, from, to)
  if (ad) return ad
  // Супруг кровного родственника
  for (const f of G.spouseFamilies(to)) {
    const rel = G.partnerIn(f, to)
    if (!rel) continue
    const r = blood(G, from, rel)
    if (!r) continue
    const ex = f.status === 'divorced' || f.status === 'separated'
    if (ex) return `${spouseWord(G, f, to)} ${genitive(r.label.toLowerCase())}`
    if (r.a === 1 && r.b === 0) return g(target, 'Отчим', 'Мачеха', 'Отчим/мачеха')
    if (r.a === 0 && r.b === 1) return g(target, 'Зять', 'Невестка', 'Зять/невестка')
    if (r.a === 1 && r.b === 1) return g(target, 'Зять', 'Невестка', 'Зять/невестка')
    if (r.a === 0 && r.b === 2) return g(target, 'Муж внучки', 'Жена внука', 'Супруг(а) внука')
    return `${spouseWord(G, f, to)} ${genitive(r.label.toLowerCase())}`
  }
  // Кровный родственник супруга
  for (const f of G.spouseFamilies(from)) {
    const sp = G.partnerIn(f, from)
    if (!sp) continue
    const r = blood(G, sp, to)
    if (!r) continue
    const husbandsSide = G.person(sp)?.gender === 'M'
    const wifesSide = G.person(sp)?.gender === 'F'
    if (r.a === 1 && r.b === 0) {
      if (wifesSide) return g(target, 'Тесть', 'Тёща', 'Родитель жены')
      if (husbandsSide) return g(target, 'Свёкор', 'Свекровь', 'Родитель мужа')
      return g(target, 'Отец супруга', 'Мать супруга', 'Родитель супруга')
    }
    if (r.a === 0 && r.b === 1) return g(target, 'Пасынок', 'Падчерица', 'Пасынок/падчерица')
    if (r.a === 1 && r.b === 1) {
      if (wifesSide) return g(target, 'Шурин', 'Свояченица', 'Брат/сестра жены')
      if (husbandsSide) return g(target, 'Деверь', 'Золовка', 'Брат/сестра мужа')
    }
    const spW = wifesSide ? 'жены' : husbandsSide ? 'мужа' : 'супруга'
    return `${r.label} ${spW}`
  }
  // Цепочка через ещё одного человека: «Муж свояченицы», «Дочь невестки»
  if (depth === 0) {
    const known = (id) => {
      const r = compute(G, from, id, 1)
      return r && r !== 'Родственник' && r !== 'Это Вы' ? r : ''
    }
    for (const f of G.spouseFamilies(to)) {
      const other = G.partnerIn(f, to)
      const r = other && known(other)
      if (r) return `${spouseWord(G, f, to)} ${genitive(r.toLowerCase())}`
    }
    const pf = G.parentFamily(to)
    for (const par of pf?.partners ?? []) {
      const r = known(par)
      if (r) return `${g(target, 'Сын', 'Дочь', 'Ребёнок')} ${genitive(r.toLowerCase())}`
    }
  }
  return G.component(from).has(to) ? 'Родственник' : ''
}

/** Степень родства: число поколений до общего предка (для сортировки «ближе — выше»). */
export function kinshipDistance(G, from, to) {
  if (!from || !to) return Infinity
  const b = blood(G, from, to)
  if (b) return b.a + b.b
  const path = G.path(from, to)
  return path ? path.length + 10 : Infinity
}

const STEP_WORDS = {
  parent: (p) => g(p, 'отец', 'мать', 'родитель'),
  child: (p) => g(p, 'сын', 'дочь', 'ребёнок'),
}

/**
 * Цепочка «как связаны» для объяснения: [{ id, word }] — word: кем следующий приходится предыдущему.
 * @returns {{ id: string, word: string }[] | null}
 */
export function kinshipChain(G, from, to) {
  const raw = G.path(from, to)
  if (!raw) return null
  // «Родитель → его ребёнок» читается проще как «брат/сестра»: отец → брат → сын, а не отец → дед → дядя → …
  const steps = []
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i]
    const n = raw[i + 1]
    if (s.type === 'parent' && n?.type === 'child' && n.to !== s.from) {
      steps.push({ from: s.from, to: n.to, type: 'sibling' })
      i++
    } else steps.push(s)
  }
  const out = [{ id: from, word: '' }]
  for (const s of steps) {
    const p = G.person(s.to)
    let word
    if (s.type === 'partner') {
      const f = G.spouseFamilies(s.from).find((x) => x.partners.includes(s.to))
      word = f ? spouseWord(G, f, s.to).toLowerCase() : 'партнёр'
    } else if (s.type === 'sibling') {
      const a = G.parents(s.from)
      const b = G.parents(s.to)
      const full = a.father === b.father && a.mother === b.mother
      word = full ? g(p, 'брат', 'сестра', 'брат или сестра') : g(p, 'сводный брат', 'сводная сестра', 'сводный брат или сестра')
    } else word = STEP_WORDS[s.type](p)
    out.push({ id: s.to, word })
  }
  return out
}
