// Рисует PNG-иконки PWA из public/favicon.svg (нужен Playwright с Chromium; запускается вручную,
// результат лежит в public/icons и коммитится).
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url)

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const page = await browser.newPage()
async function render(size, file, { maskable = false, bg = null } = {}) {
  // Маскируемая иконка: фон на весь квадрат, значок в безопасной зоне (80 %)
  const inner = maskable ? svg.replace(/<rect[^>]*\/>/, '') : svg
  const scale = maskable ? 0.74 : 1
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:${bg ?? 'transparent'}">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? 'linear-gradient(135deg,#EF7B4F,#C4401D)' : 'transparent'}">
      <div style="width:${size * scale}px;height:${size * scale}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`)
  writeFileSync(out(file), await page.screenshot({ omitBackground: !maskable && !bg, type: 'png' }))
}
await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'maskable-512.png', { maskable: true })
await render(180, 'apple-touch-icon.png', { bg: '#ffffff' })
await render(32, 'favicon-32.png')
await browser.close()
console.log('[icons] готово')
