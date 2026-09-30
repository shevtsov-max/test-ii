/**
 * Экспорт схемы древа: SVG (векторный файл), PNG (картинка) и печать / PDF.
 * Сцена рисуется заново целиком (без отсечения и кнопок), с встроенными шрифтом и фото —
 * файл открывается где угодно и выглядит как на экране.
 */
import { createApp, h, nextTick } from 'vue'
import ChartScene from './ChartScene.vue'
import { chartPalette } from './palette'
import { blobToDataUrl, downloadBlob, fileSlug } from '@/utils/files'
import interCyrillic from '@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url'
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'

const PAD = 48
const HEADER = 64

async function toDataUrl(url) {
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    return await blobToDataUrl(await res.blob())
  } catch {
    return null
  }
}

let fontCss = null
async function embeddedFonts() {
  if (fontCss !== null) return fontCss
  const [cyr, lat] = await Promise.all([toDataUrl(interCyrillic), toDataUrl(interLatin)])
  fontCss = [
    cyr && `@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${cyr}) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}`,
    lat && `@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${lat}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`,
  ]
    .filter(Boolean)
    .join('')
  return fontCss
}

/**
 * Собирает самостоятельный SVG-документ схемы.
 * @param {{ layout: object, tree: object, opts: object, relationOf: Function, homeId: string, title: string, subtitle?: string, dark?: boolean }} p
 */
export async function buildChartSvg(p) {
  const P = chartPalette(!!p.dark)
  const b = p.layout.bounds
  const width = Math.ceil(b.maxX - b.minX + PAD * 2)
  const height = Math.ceil(b.maxY - b.minY + PAD * 2 + HEADER)
  const ox = PAD - b.minX
  const oy = PAD + HEADER - b.minY

  // Фото — в data URL, иначе браузер не нарисует их на canvas
  const media = { ...(p.tree.media ?? {}) }
  if (p.opts.photos) {
    const needed = new Set(p.layout.nodes.map((n) => p.tree.persons[n.personId]?.avatarId).filter(Boolean))
    await Promise.all(
      [...needed].map(async (id) => {
        const m = media[id]
        if (!m) return
        const src = await toDataUrl(m.thumb ?? m.src)
        media[id] = { ...m, thumb: src, src: null }
      }),
    )
  }
  const tree = { ...p.tree, media }

  const host = document.createElement('div')
  const app = createApp({
    render: () =>
      h(
        'svg',
        { xmlns: 'http://www.w3.org/2000/svg', 'xmlns:xlink': 'http://www.w3.org/1999/xlink', width, height, viewBox: `0 0 ${width} ${height}` },
        [
          h('rect', { width, height, fill: P.canvas }),
          h('text', { x: PAD, y: PAD + 8, fill: P.text, 'font-size': 26, 'font-weight': 750, 'font-family': "'Inter Variable', Inter, sans-serif" }, p.title),
          p.subtitle
            ? h('text', { x: PAD, y: PAD + 32, fill: P.muted, 'font-size': 14, 'font-family': "'Inter Variable', Inter, sans-serif" }, p.subtitle)
            : null,
          h('g', { transform: `translate(${ox} ${oy})` }, [
            h(ChartScene, {
              nodes: p.layout.nodes,
              edges: p.layout.edges,
              tree,
              metrics: p.layout.metrics,
              palette: P,
              opts: p.opts,
              relationOf: p.relationOf,
              lod: 'full',
              homeId: p.homeId,
              interactive: false,
              animate: false,
              idPrefix: 'x',
            }),
          ]),
        ],
      ),
  })
  app.mount(host)
  await nextTick()
  const svg = host.querySelector('svg')
  const css = await embeddedFonts()
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = css
    svg.insertBefore(style, svg.firstChild)
  }
  // Служебные атрибуты Vue и классы в файле не нужны
  svg.querySelectorAll('[data-key]').forEach((el) => el.removeAttribute('data-key'))
  const markup = new XMLSerializer().serializeToString(svg)
  app.unmount()
  return { markup, width, height }
}

/** Скачать SVG. */
export async function downloadSvg(p) {
  const { markup } = await buildChartSvg(p)
  downloadBlob(`${fileSlug(p.title)}.svg`, new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
}

/** Скачать PNG (по умолчанию в двойном разрешении, с ограничением размера холста). */
export async function downloadPng(p, scale = 2) {
  const { markup, width, height } = await buildChartSvg(p)
  const maxSide = 16000
  const maxArea = 120e6
  const s = Math.max(0.25, Math.min(scale, maxSide / width, maxSide / height, Math.sqrt(maxArea / (width * height))))
  const img = new Image()
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Не удалось нарисовать схему'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * s)
    canvas.height = Math.round(height * s)
    const ctx = canvas.getContext('2d')
    ctx.scale(s, s)
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Схема слишком большая для PNG — сохраните в SVG')
    downloadBlob(`${fileSlug(p.title)}.png`, blob)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Печать или сохранение в PDF через системный диалог печати. */
export async function printChart(p, { orientation = 'landscape', paper = 'A4' } = {}) {
  const { markup } = await buildChartSvg({ ...p, dark: false })
  const w = window.open('', '_blank')
  if (!w) throw new Error('Разрешите всплывающие окна, чтобы распечатать схему')
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${p.title}</title>
    <style>@page{size:${paper} ${orientation};margin:10mm}html,body{margin:0;background:#fff}
    svg{width:100%;height:auto;max-height:calc(100vh - 2px);display:block}</style></head>
    <body>${markup}<script>window.onload=()=>{setTimeout(()=>{window.print()},300)}<\/script></body></html>`)
  w.document.close()
}
