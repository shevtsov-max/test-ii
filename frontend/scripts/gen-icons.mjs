// Собирает все используемые иконки `sym_r_*` в один модуль с SVG-путями (tree-shaking вместо 5 МБ шрифта).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../src', import.meta.url).pathname
const dts = readFileSync(new URL('../node_modules/@quasar/extras/exports/material-symbols-rounded/index.d.ts', import.meta.url), 'utf8')
const available = new Set([...dts.matchAll(/const (symRounded\w+)/g)].map((m) => m[1]))

const names = new Set()
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(vue|js)$/.test(f) && !f.includes('icons.generated')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/sym_r_([a-z0-9_]+)/g)) names.add(m[1])
    }
  }
}
walk(root)

const camel = (s) => 'symRounded' + s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
const ok = []
const missing = []
for (const n of [...names].sort()) (available.has(camel(n)) ? ok : missing).push(n)
if (missing.length) console.warn('[icons] нет в наборе:', missing.join(', '))

const out = `// Сгенерировано scripts/gen-icons.mjs — не редактировать вручную
import {
${ok.map((n) => `  ${camel(n)},`).join('\n')}
} from '@quasar/extras/material-symbols-rounded'

export const ICONS = {
${ok.map((n) => `  sym_r_${n}: ${camel(n)},`).join('\n')}
}
`
writeFileSync(join(root, 'icons.generated.js'), out)
console.log(`[icons] ${ok.length} иконок`)
