/**
 * Работа с файлами в браузере: выбор, скачивание, уменьшение изображений.
 */

/** Открывает диалог выбора файлов. */
export function pickFiles(accept = '*/*', multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(input.files ? Array.from(input.files) : [])
    input.addEventListener('cancel', () => resolve([]))
    input.click()
  })
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(filename, text, mime = 'application/json') {
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }))
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Не удалось прочитать файл'))
    r.readAsDataURL(blob)
  })
}

export function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  if (head.includes(';base64')) {
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(body)], { type: mime })
}

/**
 * Загружает изображение и даёт уменьшенные копии.
 * @param {Blob} file
 */
export async function readImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Не удалось открыть изображение'))
      i.src = url
    })
    const draw = (max) => {
      const w0 = img.naturalWidth || 512
      const h0 = img.naturalHeight || 512
      const scale = Math.min(1, max / Math.max(w0, h0))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w0 * scale))
      canvas.height = Math.max(1, Math.round(h0 * scale))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return canvas
    }
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      toDataUrl: async (max, q = 0.85) => draw(max).toDataURL('image/jpeg', q),
      toBlob: (max, q = 0.88) => new Promise((resolve) => draw(max).toBlob((b) => resolve(b ?? file), 'image/jpeg', q)),
      release: () => URL.revokeObjectURL(url),
    }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

/** Человекочитаемый размер файла. */
export function formatBytes(n) {
  if (!n) return '0 Б'
  const u = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0).replace('.0', '')} ${u[i]}`
}

/** Безопасное имя файла из названия. */
export function fileSlug(name) {
  return (
    (name || 'tree')
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) +
    '_' +
    new Date().toISOString().slice(0, 10)
  )
}
