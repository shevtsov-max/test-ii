import { onBeforeUnmount, onMounted, ref } from 'vue'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Перемещение и масштаб «камеры» над схемой: мышь, колесо, тачпад, щипок, плавные перелёты.
 * Координаты мира → экран: x * k + tx.
 * @param {import('vue').Ref<HTMLElement>} rootRef
 */
export function usePanZoom(rootRef, opts = {}) {
  const minK = opts.minK ?? 0.06
  const maxK = opts.maxK ?? 2.5
  const tx = ref(0)
  const ty = ref(0)
  const k = ref(1)
  const size = ref({ w: 800, h: 600 })
  const dragging = ref(false)
  const animating = ref(false)
  /** Пользователь сам двигал камеру (тогда при ресайзе центр не восстанавливается) */
  let userMoved = false
  let moved = false
  let raf = 0

  // ---------------------------------------------------------------- анимация
  function set(t) {
    tx.value = t.tx
    ty.value = t.ty
    k.value = t.k
  }
  function stop() {
    cancelAnimationFrame(raf)
    raf = 0
    animating.value = false
  }
  function animateTo(target, ms = 450) {
    stop()
    if (!ms || reduced()) return set(target)
    const from = { tx: tx.value, ty: ty.value, k: k.value }
    const t0 = performance.now()
    animating.value = true
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = ease(p)
      // Масштаб интерполируется логарифмически — «перелёт» выглядит естественнее
      const kk = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e)
      set({ tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e, k: kk })
      if (p < 1) raf = requestAnimationFrame(step)
      else stop()
    }
    raf = requestAnimationFrame(step)
  }

  const clampK = (v) => Math.min(maxK, Math.max(minK, v))

  function centerOn(x, y, scale = k.value, ms = 450) {
    const kk = clampK(scale)
    animateTo({ k: kk, tx: size.value.w / 2 - x * kk, ty: size.value.h / 2 - y * kk }, ms)
  }

  /** Показать прямоугольник мира целиком. */
  function fit(b, { pad = 56, maxScale = 1.1, ms = 450, offsetX = 0 } = {}) {
    if (!b) return
    userMoved = true
    const w = b.maxX - b.minX + pad * 2
    const h = b.maxY - b.minY + pad * 2
    const kk = clampK(Math.min(maxScale, (size.value.w - offsetX) / w, size.value.h / h))
    animateTo({ k: kk, tx: offsetX / 2 + size.value.w / 2 - ((b.minX + b.maxX) / 2) * kk, ty: size.value.h / 2 - ((b.minY + b.maxY) / 2) * kk }, ms)
  }

  function zoomAt(factor, px = size.value.w / 2, py = size.value.h / 2, ms = 0) {
    userMoved = true
    const base = raf ? k.value : k.value
    const nk = clampK(base * factor)
    const target = { k: nk, tx: px - ((px - tx.value) * nk) / k.value, ty: py - ((py - ty.value) * nk) / k.value }
    if (ms) animateTo(target, ms)
    else {
      stop()
      set(target)
    }
  }

  function pan(dx, dy, ms = 0) {
    userMoved = true
    if (ms) animateTo({ k: k.value, tx: tx.value + dx, ty: ty.value + dy }, ms)
    else set({ k: k.value, tx: tx.value + dx, ty: ty.value + dy })
  }

  // ---------------------------------------------------------------- указатель
  const pointers = new Map()
  let panStart = null
  let pinchStart = null

  function local(e) {
    const r = rootRef.value.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return
    const p = local(e)
    pointers.set(e.pointerId, p)
    moved = false
    if (pointers.size === 1) panStart = { x: p.x, y: p.y, tx: tx.value, ty: ty.value, id: e.pointerId }
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: k.value, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx: tx.value, ty: ty.value }
      panStart = null
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (pinchStart && pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const nk = clampK((pinchStart.k * d) / pinchStart.d)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      stop()
      set({ k: nk, tx: cx - ((pinchStart.cx - pinchStart.tx) * nk) / pinchStart.k, ty: cy - ((pinchStart.cy - pinchStart.ty) * nk) / pinchStart.k })
      moved = true
      userMoved = true
    } else if (panStart) {
      const dx = p.x - panStart.x
      const dy = p.y - panStart.y
      if (!moved && Math.hypot(dx, dy) < 5) return
      if (!moved) {
        moved = true
        userMoved = true
        dragging.value = true
        stop()
        try {
          rootRef.value?.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      set({ k: k.value, tx: panStart.tx + dx, ty: panStart.ty + dy })
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchStart = null
    if (pointers.size === 1) {
      const [id, p] = [...pointers.entries()][0]
      panStart = { x: p.x, y: p.y, tx: tx.value, ty: ty.value, id }
    }
    if (pointers.size === 0) {
      panStart = null
      // Клик после перетаскивания не должен выбирать карточку
      setTimeout(() => (dragging.value = false), 0)
    }
  }

  function onWheel(e) {
    e.preventDefault()
    const p = local(e)
    const trackpadPan = !e.ctrlKey && e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || Math.abs(e.deltaY) < 40)
    if (trackpadPan) {
      pan(-e.deltaX, -e.deltaY)
      return
    }
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    zoomAt(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0016)), p.x, p.y)
  }

  // ---------------------------------------------------------------- размер
  let ro
  let first = true
  onMounted(() => {
    ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      if (!w || !h) return
      const prev = size.value
      size.value = { w, h }
      if (first) {
        first = false
        opts.onFirstSize?.()
      } else if (!userMoved) opts.onResize?.()
      else {
        // Держим центр экрана на месте
        tx.value += (w - prev.w) / 2
        ty.value += (h - prev.h) / 2
      }
    })
    ro.observe(rootRef.value)
  })
  onBeforeUnmount(() => {
    ro?.disconnect()
    stop()
  })

  return {
    tx,
    ty,
    k,
    size,
    dragging,
    animating,
    animateTo,
    centerOn,
    fit,
    zoomAt,
    pan,
    stop,
    wasMoved: () => moved,
    resetUserMoved: () => (userMoved = false),
    isUserMoved: () => userMoved,
    handlers: { pointerdown: onPointerDown, pointermove: onPointerMove, pointerup: onPointerUp, pointercancel: onPointerUp, wheel: onWheel },
  }
}
