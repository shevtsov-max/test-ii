// Генерирует стилизованные портреты-заглушки (SVG) для демо-древа в public/photos/.
// Это собственные иллюстрации, не реальные фотографии. Запуск: node scripts/gen-portraits.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const outDir = new URL('../public/photos/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })

const SKIN = ['#f1d3b8', '#e8c3a0', '#f5dcc6', '#dcb08a']

/**
 * hair: short | side | receding | bald | bun | updo | long | curly | cap
 * facial: none | mustache | beard | fullbeard | sideburns | muttonchops
 * dress: uniform | suit | gown | lace | robe
 * extra: list of medals | sash | pearls | tiara | crown | bonnet | hat
 */
const portraits = {
  'nikolai-ii': { bg: ['#6b5a45', '#2c241b'], skin: 1, hair: 'receding', hc: '#7a5a3a', facial: 'beard', fc: '#8a6a44', dress: 'uniform', cc: '#3f5a3a', extra: ['medals', 'epaulettes'], sepia: true },
  'nikolai-ii-young': { bg: ['#74624a', '#30281e'], skin: 2, hair: 'short', hc: '#6f5236', facial: 'mustache', fc: '#6f5236', dress: 'uniform', cc: '#4a5a6a', extra: ['epaulettes'], sepia: true },
  'aleksandra': { bg: ['#6f6353', '#2b251e'], skin: 0, hair: 'updo', hc: '#8a6a4a', facial: 'none', dress: 'lace', cc: '#e9e2d6', extra: ['pearls'], sepia: true },
  'olga': { bg: ['#7a8a8f', '#2f3b40'], skin: 0, hair: 'long', hc: '#a07a52', facial: 'none', dress: 'lace', cc: '#f0ece4', extra: [] },
  'tatiana': { bg: ['#8a7a8f', '#3a2f40'], skin: 0, hair: 'long', hc: '#5a3b26', facial: 'none', dress: 'lace', cc: '#f0ece4', extra: ['pearls'] },
  'maria': { bg: ['#8f8a7a', '#403b2f'], skin: 2, hair: 'long', hc: '#8b6a45', facial: 'none', dress: 'lace', cc: '#efe9de', extra: [] },
  'anastasia': { bg: ['#7a8f80', '#2f4036'], skin: 2, hair: 'long', hc: '#a9825a', facial: 'none', dress: 'lace', cc: '#f3eee6', extra: [] },
  'aleksei': { bg: ['#7a8090', '#2b3038'], skin: 2, hair: 'side', hc: '#a58358', facial: 'none', dress: 'suit', cc: '#2f3f5a', extra: ['sailor'] },
  'aleksandr-iii': { bg: ['#5f5346', '#231e18'], skin: 1, hair: 'receding', hc: '#5a4030', facial: 'fullbeard', fc: '#5a4030', dress: 'uniform', cc: '#2f3a2f', extra: ['medals', 'epaulettes'], sepia: true },
  'dagmar': { bg: ['#6a5d58', '#2a2321'], skin: 0, hair: 'updo', hc: '#3f2f26', facial: 'none', dress: 'gown', cc: '#3a2b3f', extra: ['pearls', 'tiara'], sepia: true },
  'aleksandr-ii': { bg: ['#5c5b52', '#22221c'], skin: 1, hair: 'receding', hc: '#6a6a66', facial: 'muttonchops', fc: '#6a6a66', dress: 'uniform', cc: '#2f3f34', extra: ['medals', 'epaulettes'], sepia: true },
  'marie-hesse': { bg: ['#65605a', '#25221f'], skin: 0, hair: 'updo', hc: '#4a3a30', facial: 'none', dress: 'gown', cc: '#2b2b3a', extra: ['pearls'], sepia: true },
  'victoria': { bg: ['#54524e', '#1c1b19'], skin: 0, hair: 'cap', hc: '#dcdad4', facial: 'none', dress: 'gown', cc: '#141414', extra: ['bonnet', 'crown'], sepia: true },
  'albert': { bg: ['#5a5650', '#1f1d1a'], skin: 1, hair: 'receding', hc: '#5a4a3a', facial: 'sideburns', fc: '#5a4a3a', dress: 'suit', cc: '#1f1f26', extra: ['sash'], sepia: true },
  'dolgorukova': { bg: ['#6a5f58', '#282320'], skin: 0, hair: 'updo', hc: '#3b2c24', facial: 'none', dress: 'gown', cc: '#4a2f3a', extra: ['pearls'], sepia: true },
  'ella': { bg: ['#7a6f6a', '#2f2926'], skin: 0, hair: 'updo', hc: '#8a6a4a', facial: 'none', dress: 'gown', cc: '#e8e1d6', extra: ['pearls'], sepia: true },
  'sergei-a': { bg: ['#60584e', '#221e19'], skin: 1, hair: 'short', hc: '#6a5038', facial: 'beard', fc: '#6a5038', dress: 'uniform', cc: '#3a4a3a', extra: ['epaulettes'], sepia: true },
  'mikhail-a': { bg: ['#675a4c', '#241e18'], skin: 2, hair: 'side', hc: '#7a5a3a', facial: 'mustache', fc: '#7a5a3a', dress: 'uniform', cc: '#4a5568', extra: ['epaulettes'], sepia: true },
  'ksenia': { bg: ['#72665e', '#2a2521'], skin: 0, hair: 'updo', hc: '#4a3428', facial: 'none', dress: 'gown', cc: '#3f5a5a', extra: ['pearls'], sepia: true },
  'christian-ix': { bg: ['#5a5750', '#1f1d19'], skin: 1, hair: 'receding', hc: '#cfcac0', facial: 'fullbeard', fc: '#d8d3c8', dress: 'uniform', cc: '#2a3a55', extra: ['medals', 'sash'], sepia: true },
  'george-v': { bg: ['#5e5a50', '#211f1a'], skin: 1, hair: 'receding', hc: '#8a8478', facial: 'beard', fc: '#8a8478', dress: 'uniform', cc: '#243a5a', extra: ['medals', 'sash'], sepia: true },
  'mary-teck': { bg: ['#6a5f5f', '#262121'], skin: 0, hair: 'updo', hc: '#5a4238', facial: 'none', dress: 'gown', cc: '#5a3a4a', extra: ['pearls', 'tiara'], sepia: true },
  'felix': { bg: ['#6f6a62', '#28251f'], skin: 0, hair: 'side', hc: '#2f241c', facial: 'mustache', fc: '#2f241c', dress: 'suit', cc: '#26262e', extra: [] },
  'elizabeth-ii': { bg: ['#7a9aa8', '#2e4552'], skin: 0, hair: 'curly', hc: '#c9c4bb', facial: 'none', dress: 'gown', cc: '#2f8a86', extra: ['pearls'] },
  'philip': { bg: ['#6f7f95', '#28323f'], skin: 1, hair: 'short', hc: '#bdb8ae', facial: 'none', dress: 'suit', cc: '#1e2b45', extra: ['medals'] },
}

const gid = (n) => n.replace(/[^a-z0-9]/gi, '')

function hair(style, c) {
  const back = {
    long: `<path d="M92 170 C84 95 118 78 150 78 C182 78 216 95 208 170 C214 250 196 300 186 330 L114 330 C104 300 86 250 92 170Z" fill="${c}"/>`,
    updo: `<ellipse cx="150" cy="104" rx="62" ry="40" fill="${c}"/><ellipse cx="150" cy="70" rx="30" ry="20" fill="${c}"/>`,
    bun: `<circle cx="150" cy="68" r="22" fill="${c}"/>`,
    curly: `<ellipse cx="150" cy="118" rx="70" ry="66" fill="${c}"/>`,
  }
  const top = {
    short: `<path d="M98 150 C96 96 124 84 150 84 C176 84 204 96 202 150 C192 122 172 112 150 112 C128 112 108 122 98 150Z" fill="${c}"/>`,
    side: `<path d="M98 150 C94 92 128 80 158 84 C184 88 206 104 202 150 C196 128 178 110 138 114 C118 118 104 132 98 150Z" fill="${c}"/>`,
    receding: `<path d="M98 152 C94 106 108 92 122 92 C120 108 112 126 108 148Z M202 152 C206 106 192 92 178 92 C180 108 188 126 192 148Z" fill="${c}"/><path d="M118 96 C136 82 164 82 182 96 C170 92 130 92 118 96Z" fill="${c}" opacity=".7"/>`,
    bald: '',
    long: `<path d="M98 150 C96 100 124 86 150 86 C176 86 204 100 202 150 C190 122 172 110 150 110 C128 110 110 122 98 150Z" fill="${c}"/>`,
    updo: `<path d="M98 148 C98 104 122 90 150 90 C178 90 202 104 202 148 C190 124 172 116 150 116 C128 116 110 124 98 148Z" fill="${c}"/>`,
    bun: `<path d="M98 148 C98 104 122 90 150 90 C178 90 202 104 202 148 C190 124 172 116 150 116 C128 116 110 124 98 148Z" fill="${c}"/>`,
    curly: `<path d="M96 150 C92 104 120 92 150 92 C180 92 208 104 204 150 C194 124 176 116 150 116 C124 116 106 124 96 150Z" fill="${c}"/>`,
    cap: `<path d="M100 150 C100 118 126 108 150 108 C174 108 200 118 200 150 C190 132 172 126 150 126 C128 126 110 132 100 150Z" fill="${c}"/>`,
  }
  return { back: back[style] ?? '', top: top[style] ?? '' }
}

function facial(kind, c) {
  switch (kind) {
    case 'mustache':
      return `<path d="M124 200 C136 190 146 196 150 200 C154 196 164 190 176 200 C166 210 156 204 150 206 C144 204 134 210 124 200Z" fill="${c}"/>`
    case 'beard':
      return `<path d="M104 190 C104 250 126 262 150 262 C174 262 196 250 196 190 C190 222 172 232 150 232 C128 232 110 222 104 190Z" fill="${c}"/><path d="M124 200 C136 190 146 196 150 200 C154 196 164 190 176 200 C166 210 156 204 150 206 C144 204 134 210 124 200Z" fill="${c}"/>`
    case 'fullbeard':
      return `<path d="M100 178 C96 262 124 288 150 288 C176 288 204 262 200 178 C196 226 176 240 150 240 C124 240 104 226 100 178Z" fill="${c}"/><path d="M122 202 C136 190 146 197 150 201 C154 197 164 190 178 202 C166 214 156 206 150 208 C144 206 134 214 122 202Z" fill="${c}"/>`
    case 'sideburns':
      return `<path d="M100 150 C98 190 104 208 112 214 C112 190 112 170 108 150Z M200 150 C202 190 196 208 188 214 C188 190 188 170 192 150Z" fill="${c}"/>`
    case 'muttonchops':
      return `<path d="M100 148 C94 200 108 232 130 240 C124 214 124 190 112 156Z M200 148 C206 200 192 232 170 240 C176 214 176 190 188 156Z" fill="${c}"/><path d="M126 202 C138 194 146 199 150 203 C154 199 162 194 174 202 C166 210 156 205 150 207 C144 205 134 210 126 202Z" fill="${c}"/>`
    default:
      return ''
  }
}

function body(dress, c, extras) {
  const shoulders = `<path d="M10 375 C14 318 62 296 112 286 L188 286 C238 296 286 318 290 375Z" fill="${c}"/>`
  let d = shoulders
  if (dress === 'uniform') {
    d += `<path d="M126 286 L150 330 L174 286Z" fill="#e9e5da"/><path d="M112 286 L134 375 L128 375 L104 296Z M188 286 L166 375 L172 375 L196 296Z" fill="#00000030"/>`
    d += `<rect x="128" y="286" width="44" height="14" rx="6" fill="${c}" opacity=".0"/>`
  } else if (dress === 'suit') {
    d += `<path d="M124 286 L150 350 L176 286Z" fill="#f1eee6"/><path d="M112 286 L150 375 L124 375 L96 300Z M188 286 L150 375 L176 375 L204 300Z" fill="#00000035"/><path d="M146 300 L154 300 L152 340 L148 340Z" fill="#7a2f2f"/>`
  } else if (dress === 'lace') {
    d += `<path d="M112 286 Q150 344 188 286 L176 280 Q150 320 124 280Z" fill="${extras.cc2 ?? '#f4f0e8'}"/>`
  } else if (dress === 'gown') {
    d += `<path d="M104 292 Q150 350 196 292 L186 284 Q150 330 114 284Z" fill="#ece5d8" opacity=".9"/>`
  }
  return d
}

function extrasSvg(extra, dress, c) {
  let s = ''
  if (extra.includes('epaulettes'))
    s += `<path d="M30 340 L64 306 L92 312 L58 350Z M270 340 L236 306 L208 312 L242 350Z" fill="#c9a24a"/><path d="M40 338 L64 314 M260 338 L236 314" stroke="#8a6a20" stroke-width="3"/>`
  if (extra.includes('sash'))
    s += `<path d="M112 286 L232 375 L206 375 L100 296Z" fill="#3a74b0" opacity=".9"/>`
  if (extra.includes('medals'))
    s += `<circle cx="112" cy="338" r="9" fill="#c9a24a"/><circle cx="132" cy="350" r="8" fill="#d8d8d0"/><circle cx="92" cy="352" r="7" fill="#b0402f"/><path d="M108 326 L116 326 L114 334 L110 334Z" fill="#b0402f"/>`
  if (extra.includes('pearls'))
    for (let i = 0; i < 11; i++) {
      const t = i / 10
      const x = 114 + t * 72
      const y = 296 + Math.sin(t * Math.PI) * 26
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="#f3efe6" stroke="#cbbfa8" stroke-width=".8"/>`
    }
  if (extra.includes('sailor'))
    s += `<path d="M104 292 L150 340 L196 292 L206 300 L150 356 L94 300Z" fill="#f2f2f2"/><path d="M116 300 L150 336 L184 300" stroke="#26374f" stroke-width="3" fill="none"/>`
  return s
}

function head(extra, hairC) {
  let s = ''
  if (extra.includes('tiara'))
    s += `<path d="M118 96 L126 76 L138 92 L150 68 L162 92 L174 76 L182 96Z" fill="#e6c96a" stroke="#a88b2a" stroke-width="1.5"/>`
  if (extra.includes('crown'))
    s += `<path d="M112 104 L122 78 L136 96 L150 72 L164 96 L178 78 L188 104Z" fill="#e6c96a" stroke="#a88b2a" stroke-width="1.5"/>`
  if (extra.includes('bonnet'))
    s += `<path d="M96 156 C92 92 124 86 150 86 C176 86 208 92 204 156 C196 118 176 108 150 108 C124 108 104 118 96 156Z" fill="#f2efe8"/><path d="M96 156 C90 190 90 230 96 262 L110 262 C104 226 104 190 106 156Z M204 156 C210 190 210 230 204 262 L190 262 C196 226 196 190 194 156Z" fill="#f2efe8"/>`
  return s
}

function svg(name, p) {
  const id = gid(name)
  const skin = SKIN[p.skin ?? 0]
  const h = hair(p.hair, p.hc)
  const extra = p.extra ?? []
  const filter = p.sepia
    ? `<filter id="s${id}"><feColorMatrix type="matrix" values="0.42 0.62 0.16 0 0.02  0.34 0.52 0.13 0 0.01  0.26 0.4 0.1 0 0  0 0 0 1 0"/></filter>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 375" width="300" height="375">
<defs>
<radialGradient id="g${id}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></radialGradient>
<radialGradient id="v${id}" cx="50%" cy="45%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
${filter}
</defs>
<g${p.sepia ? ` filter="url(#s${id})"` : ''}>
<rect width="300" height="375" fill="url(#g${id})"/>
${h.back}
${body(p.dress, p.cc, p)}
${extrasSvg(extra, p.dress, p.cc)}
<path d="M128 240 L128 292 Q150 312 172 292 L172 240Z" fill="${skin}"/><path d="M128 262 Q150 282 172 262 L172 240 L128 240Z" fill="#00000022"/>
<ellipse cx="97" cy="176" rx="8" ry="15" fill="${skin}"/><ellipse cx="203" cy="176" rx="8" ry="15" fill="${skin}"/>
<ellipse cx="150" cy="168" rx="52" ry="66" fill="${skin}"/>
${h.top}
${facial(p.facial, p.fc ?? p.hc)}
<ellipse cx="128" cy="166" rx="6.5" ry="3.6" fill="#2a1f1a"/><ellipse cx="172" cy="166" rx="6.5" ry="3.6" fill="#2a1f1a"/>
<path d="M116 154 Q128 148 140 153 M160 153 Q172 148 184 154" stroke="${p.hc}" stroke-width="3.6" stroke-linecap="round" fill="none" opacity=".9"/>
<path d="M150 170 L145 194 Q150 198 155 194Z" fill="#00000026"/>
<path d="M136 212 Q150 220 164 212" stroke="#8a4a3a" stroke-width="3" stroke-linecap="round" fill="none"/>
${head(extra, p.hc)}
</g>
<rect width="300" height="375" fill="url(#v${id})"/>
</svg>
`
}

for (const [name, p] of Object.entries(portraits)) writeFileSync(outDir + name + '.svg', svg(name, p))
console.log(`[portraits] ${Object.keys(portraits).length} файлов → public/photos/`)
