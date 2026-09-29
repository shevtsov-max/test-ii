<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PersonCard from './PersonCard.vue'
import AddRelativeOverlay from './AddRelativeOverlay.vue'
import CanvasControls from './CanvasControls.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePhotoUpload } from '@/composables/usePhoto'
import { FAMILY_STATUSES, shortName } from '@/utils/person'

const props = defineProps({ layout: { type: Object, required: true } })
const store = useTreeStore()
const ui = useUiStore()
const { upload } = usePhotoUpload()

const root = ref()
const tx = ref(0)
const ty = ref(0)
const k = ref(1)
const animating = ref(false)
const animMs = ref(450)
const MIN_K = 0.15
const MAX_K = 2.2

const size = ref({ w: 800, h: 600 })
let ro

// ------------------------------------------------------------------ view helpers
function animate(fn, ms = 450) {
  animating.value = true
  animMs.value = ms
  fn()
  clearTimeout(animTimer)
  animTimer = setTimeout(() => (animating.value = false), ms)
}
let animTimer

function centerOn(x, y, scale = k.value, smooth = true, ms = 450) {
  const apply = () => {
    k.value = scale
    tx.value = size.value.w / 2 - x * scale
    ty.value = size.value.h / 2 - y * scale
  }
  smooth ? animate(apply, ms) : apply()
}

// Координаты узлов из layout + смещение мира `shift` (см. блок «Смена центра» ниже)
function nodeCenter(n) {
  return { x: n.x + shift.value.x, y: (n.top ?? 0) + n.h / 2 + shift.value.y }
}

function centerFocus(smooth = true, ms = 450) {
  const f = props.layout.focusNode
  if (f) {
    const c = nodeCenter(f)
    centerOn(c.x, c.y, k.value, smooth, ms)
  }
}

function fit(smooth = true) {
  const sb = props.layout.bounds
  const b = {
    minX: sb.minX + shift.value.x,
    maxX: sb.maxX + shift.value.x,
    minY: sb.minY + shift.value.y,
    maxY: sb.maxY + shift.value.y,
  }
  const pad = 80
  const w = b.maxX - b.minX + pad * 2
  const h = b.maxY - b.minY + pad * 2
  const scale = Math.max(MIN_K, Math.min(1.1, size.value.w / w, size.value.h / h))
  centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, scale, smooth)
}

function zoomAt(factor, px = size.value.w / 2, py = size.value.h / 2, smooth = false) {
  const nk = Math.min(MAX_K, Math.max(MIN_K, k.value * factor))
  const apply = () => {
    tx.value = px - ((px - tx.value) * nk) / k.value
    ty.value = py - ((py - ty.value) * nk) / k.value
    k.value = nk
  }
  smooth ? animate(apply, 250) : apply()
}

// ------------------------------------------------------------------ pan / pinch
const pointers = new Map()
let panStart = null
let pinchStart = null
const dragging = ref(false)
let moved = false

function local(e) {
  const r = root.value.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onPointerDown(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  const p = local(e)
  pointers.set(e.pointerId, p)
  moved = false
  if (pointers.size === 1) {
    panStart = { x: p.x, y: p.y, tx: tx.value, ty: ty.value }
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      k: k.value,
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      tx: tx.value,
      ty: ty.value,
    }
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
    const nk = Math.min(MAX_K, Math.max(MIN_K, (pinchStart.k * d) / pinchStart.d))
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    tx.value = cx - ((pinchStart.cx - pinchStart.tx) * nk) / pinchStart.k
    ty.value = cy - ((pinchStart.cy - pinchStart.ty) * nk) / pinchStart.k
    k.value = nk
    moved = true
  } else if (panStart) {
    const dx = p.x - panStart.x
    const dy = p.y - panStart.y
    if (!moved && Math.hypot(dx, dy) < 4) return
    if (!moved) {
      moved = true
      dragging.value = true
      root.value?.setPointerCapture(e.pointerId)
    }
    tx.value = panStart.tx + dx
    ty.value = panStart.ty + dy
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
  if (pointers.size === 0) {
    panStart = null
    dragging.value = false
  }
}

function onClickBackground() {
  if (moved) return
}

function onWheel(e) {
  e.preventDefault()
  const p = local(e)
  const isTrackpadPan = !e.ctrlKey && e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || Math.abs(e.deltaY) < 40)
  if (isTrackpadPan) {
    tx.value -= e.deltaX
    ty.value -= e.deltaY
    return
  }
  const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
  const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018))
  zoomAt(factor, p.x, p.y)
}

// ------------------------------------------------------------------ keyboard
function onKey(e) {
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  if (document.querySelector('.q-dialog')) return
  if (e.key === '+' || e.key === '=') zoomAt(1.2, undefined, undefined, true)
  else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.2, undefined, undefined, true)
  else if (e.key === '0') centerOn(nodeCenter(props.layout.focusNode).x, nodeCenter(props.layout.focusNode).y, 1)
  else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) fit()
  else if (e.key === 'ArrowLeft') tx.value += 80
  else if (e.key === 'ArrowRight') tx.value -= 80
  else if (e.key === 'ArrowUp') ty.value += 80
  else if (e.key === 'ArrowDown') ty.value -= 80
  else return
  e.preventDefault()
}

// ------------------------------------------------------------------ lifecycle
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    const first = size.value.w === 800 && size.value.h === 600
    size.value = { w: entry.contentRect.width, h: entry.contentRect.height }
    if (first) {
      k.value = size.value.w < 700 ? 0.7 : 1
      centerFocus(false)
    }
  })
  ro.observe(root.value)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
})

// ------------------------------------------------------------------ смена центра
/*
 * Чтобы смена центра читалась «откуда → куда», мир не перестраивается заново вокруг новой персоны:
 *  1. Якорная карточка (новый центр / общая с прошлым деревом) остаётся на месте — это `shift`,
 *     поэтому «переезжает» камера, а не всё дерево.
 *  2. Нажатая карточка пульсирует, затем камера плавно (TRAVEL_MS) едет к ней.
 *  3. Ушедшие карточки гаснут на месте (TransitionGroup), новые «вырастают» из якорной карточки
 *     волнами по поколениям.
 *  4. Линии на время перехода скрыты и проявляются в конце — иначе они прыгают (path morph
 *     есть только в Chromium).
 *  5. Плашка сверху говорит, куда перешли, и даёт вернуться назад.
 */
const TRAVEL_MS = 900
const ANTICIPATION_MS = 220

const shift = ref({ x: 0, y: 0 })
const travel = ref(false)
const linksHidden = ref(false)
const entering = ref(null)
const pulseKey = ref(null)
const cameFrom = ref(null)

const snapshot = (nodes) => new Map(nodes.map((n) => [n.key, { left: n.left, top: n.top, row: n.row }]))

// Стабильный порядок отрисовки: иначе Vue переставляет DOM-узлы, а браузер при этом перезапускает CSS-анимации
const seq = new Map()
let seqCounter = 0
function syncOrder(nodes) {
  const keys = new Set(nodes.map((n) => n.key))
  for (const key of seq.keys()) if (!keys.has(key)) seq.delete(key)
  for (const n of nodes) if (!seq.has(n.key)) seq.set(n.key, seqCounter++)
}
syncOrder(props.layout.nodes)
const renderNodes = computed(() => [...props.layout.nodes].sort((a, b) => seq.get(a.key) - seq.get(b.key)))
let prevNodes = snapshot(props.layout.nodes)
let prevFocusId = store.focusId
let prevGen = store.ui.generations
let pendingOriginKey = null
let tTravel, tLinks, tEnter, tPulse, tChip, tExpand

function startTravel() {
  travel.value = true
  linksHidden.value = true
  clearTimeout(tTravel)
  clearTimeout(tLinks)
  tLinks = setTimeout(() => (linksHidden.value = false), TRAVEL_MS * 0.85)
  tTravel = setTimeout(() => (travel.value = false), TRAVEL_MS + 700)
}

function pulse(key) {
  pulseKey.value = key
  clearTimeout(tPulse)
  tPulse = setTimeout(() => (pulseKey.value = null), 1800)
}

// flush: 'pre' — смещение и флаги выставляются до перерисовки, в том же кадре, что и новый layout
watch(
  () => props.layout,
  (nl) => {
    const next = snapshot(nl.nodes)
    syncOrder(nl.nodes)
    const focusChanged = store.focusId !== prevFocusId
    const genChanged = store.ui.generations !== prevGen

    // Якорь: новый центр, если он уже был на экране, иначе ближайший к нему общий узел
    const fk = nl.focusNode?.key
    let anchor = fk && prevNodes.has(fk) ? fk : null
    if (!anchor) {
      let best = Infinity
      const frow = nl.focusNode?.row ?? 0
      for (const [key, v] of next) {
        if (prevNodes.has(key) && Math.abs(v.row - frow) < best) {
          best = Math.abs(v.row - frow)
          anchor = key
        }
      }
    }

    const oldShift = shift.value
    let newShift = { x: 0, y: 0 }
    if (anchor) {
      const a = prevNodes.get(anchor)
      const b = next.get(anchor)
      newShift = { x: oldShift.x + a.left - b.left, y: oldShift.y + a.top - b.top }
    }

    let changed = next.size !== prevNodes.size
    if (!changed) {
      for (const [key, v] of next) {
        const p = prevNodes.get(key)
        if (!p || Math.abs(v.left + newShift.x - (p.left + oldShift.x)) > 0.5 || Math.abs(v.top + newShift.y - (p.top + oldShift.y)) > 0.5) {
          changed = true
          break
        }
      }
    }

    if (newShift.x !== oldShift.x || newShift.y !== oldShift.y) shift.value = newShift

    if (focusChanged && changed) {
      if (anchor) {
        // новые карточки вырастают из якорной (или из нажатой кнопкой «предки/потомки»)
        const originKey = pendingOriginKey && next.has(pendingOriginKey) ? pendingOriginKey : anchor
        const o = next.get(originKey)
        const keys = new Set([...next.keys()].filter((key) => !prevNodes.has(key)))
        entering.value = { keys, origin: { left: o.left + newShift.x, top: o.top + newShift.y, row: o.row } }
        clearTimeout(tEnter)
        tEnter = setTimeout(() => (entering.value = null), TRAVEL_MS + 1200)
        startTravel()
        if (fk) pulse(fk)
        nextTick(() => centerFocus(true, TRAVEL_MS))
      } else {
        // деревья не пересекаются — резкая смена сцены без «полёта»
        entering.value = null
        nextTick(() => centerFocus(false))
      }
    } else if (focusChanged || genChanged) {
      nextTick(() => centerFocus(true))
    }

    if (focusChanged && prevFocusId && store.person(prevFocusId) && store.focusId) {
      cameFrom.value = { fromId: prevFocusId, toId: store.focusId }
      clearTimeout(tChip)
      tChip = setTimeout(() => (cameFrom.value = null), 9000)
    }

    pendingOriginKey = null
    prevNodes = next
    prevFocusId = store.focusId
    prevGen = store.ui.generations
  },
  { flush: 'pre' },
)

onBeforeUnmount(() => {
  for (const t of [tTravel, tLinks, tEnter, tPulse, tChip, tExpand]) clearTimeout(t)
})

const nameOf = (id) => shortName(store.person(id) ?? { firstName: '', lastName: '' })
function goBack() {
  const id = cameFrom.value?.fromId
  cameFrom.value = null
  if (id && store.person(id)) store.setFocus(id)
}

function nodeStyle(n) {
  const left = n.left + shift.value.x
  const top = n.top + shift.value.y
  const st = { width: n.w + 'px', height: n.h + 'px', transform: `translate(${left}px, ${top}px)` }
  const e = entering.value
  if (e?.keys.has(n.key)) {
    st['--fx'] = e.origin.left + 'px'
    st['--fy'] = e.origin.top + 'px'
    st['--tx'] = left + 'px'
    st['--ty'] = top + 'px'
    st['--delay'] = Math.min(800, 280 + Math.abs(n.row - e.origin.row) * 120) + 'ms'
  }
  return st
}
const isEntering = (n) => !!entering.value?.keys.has(n.key)

// ------------------------------------------------------------------ overlay
const overlayNode = computed(() => {
  const id = ui.addOverlayFor
  if (!id) return null
  return props.layout.nodes.find((n) => n.personId === id && !n.dup) ?? null
})
const overlayScale = computed(() => Math.min(1, (size.value.w - 16) / 920, (size.value.h - 16) / 420))

function openAdd(n) {
  const c = nodeCenter(n)
  if (size.value.w >= 640) centerOn(c.x, c.y, k.value, true)
  ui.addOverlayFor = n.personId
}

// ------------------------------------------------------------------ cards
function onSelect(n) {
  if (moved) return
  store.select(n.personId)
  if (!store.ui.panelOpen && window.innerWidth >= 1024) store.ui.panelOpen = true
}
function onExpand(n) {
  if (tExpand) return
  // Сначала подсвечиваем нажатую карточку, и только потом перестраиваем дерево
  pendingOriginKey = n.key
  pulse(n.key)
  tExpand = setTimeout(() => {
    tExpand = null
    store.setFocus(n.personId)
  }, ANTICIPATION_MS)
}

const statusIcon = (s) => FAMILY_STATUSES.find((x) => x.value === s)?.icon ?? 'sym_r_favorite'
const statusLabel = (s) => FAMILY_STATUSES.find((x) => x.value === s)?.label ?? ''

const worldStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${k.value})`,
}))

const zoomPercent = computed(() => Math.round(k.value * 100))

defineExpose({ fit, centerFocus, zoomAt })

// Fullscreen
const isFullscreen = ref(false)
function toggleFullscreen() {
  const el = root.value?.parentElement
  if (!el) return
  if (!document.fullscreenElement) el.requestFullscreen?.().then(() => (isFullscreen.value = true))
  else document.exitFullscreen?.().then(() => (isFullscreen.value = false))
}
const onFs = () => (isFullscreen.value = !!document.fullscreenElement)
onMounted(() => document.addEventListener('fullscreenchange', onFs))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFs))

function goHome() {
  const h = store.homeId
  if (!h) return
  if (store.focusId === h) centerFocus(true)
  else store.setFocus(h)
}
</script>

<template>
  <div
    ref="root"
    class="fc"
    :class="{ 'fc--drag': dragging, 'fc--anim': animating, 'fc--travel': travel, 'fc--links-hidden': linksHidden }"
    :style="{
      '--k': k,
      '--anim-ms': animMs + 'ms',
      backgroundSize: `${24 * k}px ${24 * k}px`,
      backgroundPosition: `${tx}px ${ty}px`,
    }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @click="onClickBackground"
  >
    <div class="fc__world" :style="worldStyle">
      <svg class="fc__links" width="1" height="1">
        <g :transform="`translate(${shift.x} ${shift.y})`">
          <path
            v-for="l in layout.links"
            :key="l.key"
            :class="['fc__link', `fc__link--${l.kind}`, { 'fc__link--dashed': l.dashed, 'fc__link--ex': l.status === 'divorced' || l.status === 'separated' }]"
            :d="l.d"
            :style="{ d: `path('${l.d}')` }"
          />
        </g>
      </svg>

      <template v-for="l in layout.links" :key="'b-' + l.key">
        <button
          v-if="l.badge && l.familyId"
          class="fc__badge"
          :class="`fc__badge--${l.status}`"
          :style="{ left: l.badge.x + shift.x + 'px', top: l.badge.y + shift.y + 'px' }"
          @pointerdown.stop
          @click.stop="ui.editFamily(l.familyId)"
        >
          <q-icon :name="statusIcon(l.status)" size="13px" />
          <q-tooltip :delay="400">{{ statusLabel(l.status) }} · нажмите, чтобы изменить</q-tooltip>
        </button>
      </template>

      <TransitionGroup tag="div" name="fcn" class="fc__nodes" appear>
      <div
        v-for="n in renderNodes"
        :key="n.key"
        class="fc__node"
        :class="{
          'fc__node--ph': n.kind === 'placeholder',
          'fc__node--enter': isEntering(n),
          'fc__node--pulse': pulseKey === n.key,
        }"
        :style="nodeStyle(n)"
      >
        <PersonCard
          v-if="n.kind === 'person' && store.person(n.personId)"
          :person="store.person(n.personId)"
          :selected="store.selectedId === n.personId"
          :focus="n.focus"
          :home="store.homeId === n.personId"
          :more-up="n.moreUp"
          :more-down="n.moreDown"
          :dup="n.dup"
          @select="onSelect(n)"
          @open="store.setFocus(n.personId)"
          @edit="ui.editPerson(n.personId)"
          @add="openAdd(n)"
          @camera="upload(n.personId, { avatar: true })"
          @expand="onExpand(n)"
        />
        <button
          v-else-if="n.kind === 'placeholder'"
          class="fc__ph"
          :class="n.role === 'father' ? 'gender-M' : 'gender-F'"
          @click.stop="!moved && ui.addRelative(n.forId, n.role)"
        >
          <q-icon name="sym_r_add" size="18px" />
          <span>Добавить<br />{{ n.role === 'father' ? 'отца' : 'мать' }}</span>
        </button>
      </div>
      </TransitionGroup>
    </div>

    <transition name="fc-chip">
      <div v-if="cameFrom" class="fc__from" @pointerdown.stop @click.stop>
        <span class="fc__from-text">
          Центр дерева: <b>{{ nameOf(cameFrom.toId) }}</b>
        </span>
        <button class="fc__from-back" type="button" @click="goBack">
          <q-icon name="sym_r_undo" size="16px" />
          <span>К {{ nameOf(cameFrom.fromId) }}</span>
        </button>
        <button class="fc__from-x" type="button" aria-label="Закрыть" @click="cameFrom = null">
          <q-icon name="sym_r_close" size="16px" />
        </button>
      </div>
    </transition>

    <AddRelativeOverlay
      v-if="overlayNode"
      :person-id="overlayNode.personId"
      :x="size.w / 2"
      :y="size.h / 2"
      :scale="overlayScale"
      :compact="size.w < 640"
      @close="ui.addOverlayFor = null"
    />

    <CanvasControls
      :zoom="zoomPercent"
      :fullscreen="isFullscreen"
      @zoom-in="zoomAt(1.25, undefined, undefined, true)"
      @zoom-out="zoomAt(0.8, undefined, undefined, true)"
      @fit="fit()"
      @home="goHome"
      @center="centerFocus()"
      @fullscreen="toggleFullscreen"
    />
  </div>
</template>

<style scoped lang="scss">
.fc {
  --move-ms: 0.45s;
  --ease: cubic-bezier(0.22, 0.8, 0.26, 1);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  background-color: var(--ft-canvas);
  background-image: radial-gradient(var(--ft-dot) 1.2px, transparent 1.3px);
  outline: none;
}
.fc--drag {
  cursor: grabbing;
  .fc__node {
    pointer-events: none;
  }
}
.fc__world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
}
.fc--travel {
  --move-ms: 0.9s;
  --ease: cubic-bezier(0.45, 0.05, 0.2, 1);
}
.fc--anim .fc__world {
  transition: transform var(--anim-ms, 0.45s) var(--ease);
}
.fc__nodes {
  position: absolute;
  left: 0;
  top: 0;
}
.fc__links,
.fc__badge {
  transition: opacity 0.4s ease;
}
.fc--links-hidden .fc__links,
.fc--links-hidden .fc__badge {
  opacity: 0;
  transition: none;
}
.fc__links {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  pointer-events: none;
}
.fc__link {
  fill: none;
  stroke: var(--ft-line);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: d 0.45s cubic-bezier(0.22, 0.8, 0.26, 1);
  animation: linkIn 0.45s ease-out;
}
.fc__link--dashed {
  stroke-dasharray: 5 5;
  opacity: 0.8;
}
.fc__link--ex {
  stroke-dasharray: 2 5;
}
.fc__node {
  position: absolute;
  left: 0;
  top: 0;
  transition: transform var(--move-ms) var(--ease);
}
/* Новые (но не переставленные) карточки появляются плавно */
.fcn-enter-active {
  animation: nodeIn 0.35s ease-out;
}
/* Новые карточки вырастают из якорной волнами по поколениям */
.fc__node--enter {
  animation: nodeGrow 0.75s cubic-bezier(0.2, 0.8, 0.25, 1) var(--delay, 0ms) backwards;
}
/* Уходящие карточки гаснут на месте */
.fcn-leave-active {
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.fcn-leave-to {
  opacity: 0;
}
/* Пульс вокруг выбранной карточки */
.fc__node--pulse {
  z-index: 2;
}
.fc__node--pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  pointer-events: none;
  animation: nodePulse 0.8s ease-out 2;
}
.fc__ph {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  border: 1.5px dashed color-mix(in srgb, var(--g) 60%, var(--ft-line));
  background: color-mix(in srgb, var(--ft-surface) 70%, transparent);
  color: var(--ft-muted);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.25;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  transition: 0.15s;
  &:hover {
    border-style: solid;
    border-color: var(--g);
    color: var(--g);
    background: var(--ft-surface);
    box-shadow: var(--ft-shadow);
  }
}
.fc__badge {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: 50%;
  border: 1.5px solid var(--ft-line);
  background: var(--ft-surface);
  color: var(--ft-primary);
  display: grid;
  place-items: center;
  padding: 0;
  cursor: pointer;
  transition:
    opacity 0.4s ease,
    transform 0.15s;
  &:hover {
    transform: scale(1.2);
    border-color: var(--ft-primary);
  }
}
.fc__badge--divorced,
.fc__badge--separated,
.fc__badge--unknown,
.fc__badge--widowed {
  color: var(--ft-muted);
}
.fc__badge--partners,
.fc__badge--engaged {
  color: #9b6bff;
}
@keyframes nodeIn {
  from {
    opacity: 0;
  }
}
@keyframes nodeGrow {
  from {
    opacity: 0;
    transform: translate(var(--fx), var(--fy)) scale(0.55);
  }
  to {
    opacity: 1;
    transform: translate(var(--tx), var(--ty)) scale(1);
  }
}
@keyframes nodePulse {
  from {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--ft-primary) 70%, transparent);
  }
  to {
    box-shadow: 0 0 0 20px transparent;
  }
}

/* Плашка «куда перешли / вернуться» */
.fc__from {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  max-width: calc(100% - 120px);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px 14px;
  border-radius: 999px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow-lg);
  font-size: 13px;
  cursor: default;
}
.fc__from-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fc__from-back,
.fc__from-x {
  border: 0;
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  color: var(--ft-primary);
  background: color-mix(in srgb, var(--ft-primary) 12%, transparent);
  padding: 5px 10px;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.15s;
  &:hover {
    background: color-mix(in srgb, var(--ft-primary) 22%, transparent);
  }
}
.fc__from-x {
  padding: 5px;
  color: var(--ft-muted);
  background: transparent;
}
@media (max-width: 600px) {
  .fc__from {
    padding-left: 6px;
  }
  .fc__from-text {
    display: none;
  }
}
.fc-chip-enter-active,
.fc-chip-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.fc-chip-enter-from,
.fc-chip-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
@keyframes linkIn {
  from {
    opacity: 0;
  }
}
</style>
