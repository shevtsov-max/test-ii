<script setup>
/**
 * Интерактивная схема древа: камера (перемещение, масштаб, перелёты), выбор и подсветка линии,
 * плавная смена центра, мини-карта, подписи поколений, отсечение невидимых карточек.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useQuasar } from 'quasar'
import ChartScene from './ChartScene.vue'
import ChartMinimap from './ChartMinimap.vue'
import ChartControls from './ChartControls.vue'
import AddRelativeOverlay from './AddRelativeOverlay.vue'
import PersonContextMenu from './PersonContextMenu.vue'
import { chartPalette } from './palette'
import { resetTextCache } from './text'
import { usePanZoom } from '@/composables/usePanZoom'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { shortName } from '@/domain/names'

const props = defineProps({
  layout: { type: Object, required: true },
  opts: { type: Object, required: true },
})
const emit = defineEmits(['select', 'fullscreen'])
const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()

const root = ref()
const cam = usePanZoom(root, {
  minK: 0.05,
  maxK: 2.4,
  onFirstSize: () => {
    cam.k.value = defaultZoom()
    centerFocus(0)
  },
  onResize: () => centerFocus(0),
})
const { tx, ty, k, size } = cam
function defaultZoom() {
  return cam.size.value.w < 700 ? 0.72 : 0.95
}

const P = computed(() => chartPalette($q.dark.isActive))
const M = computed(() => props.layout.metrics)
const lod = computed(() => (k.value < 0.17 ? 'dots' : k.value < 0.4 ? 'simple' : 'full'))

// Шрифты: после загрузки пересчитываем переносы в карточках
const fontsVersion = ref(0)
onMounted(() => {
  document.fonts?.ready.then(() => {
    resetTextCache()
    fontsVersion.value++
  })
})

// ------------------------------------------------------------------ смещение мира при смене центра
/*
 * Чтобы смена центра читалась «откуда → куда», мир не перестраивается вокруг новой персоны:
 *  1. Якорная карточка (новый центр или общая с прошлой схемой) остаётся на месте — это `shift`,
 *     поэтому «переезжает» камера, а не всё древо.
 *  2. Нажатая карточка пульсирует, затем камера плавно едет к ней.
 *  3. Ушедшие карточки гаснут на месте, новые «вырастают» из якорной волнами по поколениям.
 *  4. Плашка сверху говорит, куда перешли, и даёт вернуться назад.
 */
const TRAVEL_MS = 900
const shift = ref({ x: 0, y: 0 })
const travel = ref(false)
const entering = shallowRef(null)
const pulseKey = ref(null)
const cameFrom = ref(null)
let pendingOriginKey = null
let tTravel, tEnter, tPulse, tChip, tExpand

const snapshot = (nodes) => new Map(nodes.map((n) => [n.key, { left: n.left, top: n.top, row: n.row ?? n.gen ?? 0 }]))
let prevNodes = snapshot(props.layout.nodes)
let prevFocus = tree.focusId
let prevType = props.layout.type

function nodeCenter(n) {
  return { x: n.left + n.w / 2 + shift.value.x, y: n.top + n.h / 2 + shift.value.y }
}
function centerFocus(ms = 450) {
  const f = props.layout.focusNode
  cam.resetUserMoved()
  if (f) {
    const c = nodeCenter(f)
    cam.centerOn(c.x, c.y, k.value, ms)
  }
}
const worldBounds = computed(() => {
  const b = props.layout.bounds
  return { minX: b.minX + shift.value.x, maxX: b.maxX + shift.value.x, minY: b.minY + shift.value.y, maxY: b.maxY + shift.value.y }
})
function fit(ms = 450) {
  cam.fit(worldBounds.value, { ms })
}
function pulse(key) {
  pulseKey.value = key
  clearTimeout(tPulse)
  tPulse = setTimeout(() => (pulseKey.value = null), 1500)
}

watch(
  () => props.layout,
  (nl) => {
    const next = snapshot(nl.nodes)
    const focusChanged = tree.focusId !== prevFocus
    const typeChanged = nl.type !== prevType
    const fk = nl.focusNode?.key
    let anchor = !typeChanged && fk && prevNodes.has(fk) ? fk : null
    if (!anchor && !typeChanged) {
      let best = Infinity
      const frow = nl.focusNode?.row ?? 0
      for (const [key, v] of next) {
        if (prevNodes.has(key) && Math.abs(v.row - frow) < best) {
          best = Math.abs(v.row - frow)
          anchor = key
        }
      }
    }
    const old = shift.value
    let ns = { x: 0, y: 0 }
    if (anchor) {
      const a = prevNodes.get(anchor)
      const b = next.get(anchor)
      ns = { x: old.x + a.left - b.left, y: old.y + a.top - b.top }
    }
    if (ns.x !== old.x || ns.y !== old.y) shift.value = ns

    if (focusChanged && anchor && props.opts.animate) {
      const originKey = pendingOriginKey && next.has(pendingOriginKey) ? pendingOriginKey : anchor
      const o = next.get(originKey)
      const keys = new Set([...next.keys()].filter((key) => !prevNodes.has(key)))
      entering.value = { keys, origin: o }
      clearTimeout(tEnter)
      tEnter = setTimeout(() => (entering.value = null), TRAVEL_MS + 1100)
      travel.value = true
      clearTimeout(tTravel)
      tTravel = setTimeout(() => (travel.value = false), TRAVEL_MS + 600)
      if (fk) pulse(fk)
      nextTick(() => centerFocus(TRAVEL_MS))
    } else if (focusChanged || typeChanged) {
      entering.value = null
      nextTick(() => centerFocus(focusChanged && !typeChanged ? 450 : 0))
    }
    if (focusChanged && prevFocus && tree.person(prevFocus) && tree.focusId) {
      cameFrom.value = { fromId: prevFocus, toId: tree.focusId }
      clearTimeout(tChip)
      tChip = setTimeout(() => (cameFrom.value = null), 8000)
    }
    pendingOriginKey = null
    prevNodes = next
    prevFocus = tree.focusId
    prevType = nl.type
  },
  { flush: 'pre' },
)
onBeforeUnmount(() => [tTravel, tEnter, tPulse, tChip, tExpand].forEach(clearTimeout))

function goBack() {
  const id = cameFrom.value?.fromId
  cameFrom.value = null
  if (id && tree.person(id)) tree.setFocus(id)
}

// ------------------------------------------------------------------ отсечение невидимых карточек
const cull = ref(null)
let cullRaf = 0
watch([tx, ty, k, size, shift], () => {
  if (props.layout.nodes.length < 200) {
    cull.value = null
    return
  }
  cancelAnimationFrame(cullRaf)
  cullRaf = requestAnimationFrame(() => {
    const q = 400
    const x0 = Math.floor((-tx.value / k.value - shift.value.x) / q) * q - q
    const y0 = Math.floor((-ty.value / k.value - shift.value.y) / q) * q - q
    const x1 = Math.ceil(((size.value.w - tx.value) / k.value - shift.value.x) / q) * q + q
    const y1 = Math.ceil(((size.value.h - ty.value) / k.value - shift.value.y) / q) * q + q
    const c = cull.value
    if (!c || c.x0 !== x0 || c.y0 !== y0 || c.x1 !== x1 || c.y1 !== y1) cull.value = { x0, y0, x1, y1 }
  })
})
const visibleNodes = computed(() => {
  const c = cull.value
  if (!c || props.layout.nodes.length < 200) return props.layout.nodes
  return props.layout.nodes.filter((n) => n.left + n.w > c.x0 && n.left < c.x1 && n.top + n.h > c.y0 && n.top < c.y1)
})

// ------------------------------------------------------------------ подсветка линии родства
const hoverId = ref(null)
let hoverTimer
function onHover(n) {
  clearTimeout(hoverTimer)
  if (!n?.personId) {
    hoverTimer = setTimeout(() => (hoverId.value = null), 120)
    return
  }
  hoverTimer = setTimeout(() => (hoverId.value = n.personId), 280)
}
// В «Родословной» все — прямые предки, поэтому там подсвечивается только наведённый
const highlightSource = computed(() => (props.opts.highlight && props.layout.type === 'tree' ? (hoverId.value ?? tree.selectedId) : hoverId.value))
const highlight = computed(() => {
  const id = highlightSource.value
  if (!id || !tree.graph) return null
  const set = tree.graph.lineage(id)
  return new Set([...set].filter((x) => props.layout.shown.has(x)))
})

// ------------------------------------------------------------------ действия с карточками
function onSelect(n) {
  if (cam.wasMoved() && cam.dragging.value) return
  tree.selectPerson(n.personId)
  emit('select', n.personId)
}
function onOpen(n) {
  if (tree.focusId === n.personId) return centerFocus()
  expandTo(n)
}
function expandTo(n) {
  if (tExpand) return
  pendingOriginKey = n.key
  pulse(n.key)
  tExpand = setTimeout(() => {
    tExpand = null
    tree.setFocus(n.personId)
  }, 200)
}
function onAdd(n) {
  if (!tree.canEdit(n.personId)) return
  const c = nodeCenter(n)
  if (size.value.w >= 640) cam.centerOn(c.x, c.y, Math.max(k.value, 0.7), 350)
  tree.selectPerson(n.personId)
  ui.addOverlayFor = n.personId
}
function onPlaceholder(n) {
  if (tree.canEdit(n.forId)) ui.addRelative(n.forId, n.role)
}

// Контекстное меню
const ctx = ref(null)
function onContext(n, e) {
  const r = root.value.getBoundingClientRect()
  tree.selectPerson(n.personId)
  ctx.value = { personId: n.personId, x: e.clientX - r.left, y: e.clientY - r.top }
}
// Долгое нажатие на телефоне — то же меню
let longPress
function onPointerDownRoot(e) {
  cam.handlers.pointerdown(e)
  if (e.pointerType !== 'mouse') {
    clearTimeout(longPress)
    const target = e.target.closest?.('[data-key]')
    if (!target) return
    longPress = setTimeout(() => {
      if (cam.wasMoved()) return
      const n = props.layout.nodes.find((x) => x.key === target.dataset.key)
      if (n?.personId) onContext(n, e)
    }, 550)
  }
}
function onPointerUpRoot(e) {
  clearTimeout(longPress)
  cam.handlers.pointerup(e)
}

// ------------------------------------------------------------------ клавиатура
function onKey(e) {
  const t = e.target
  if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return
  if (document.querySelector('.q-dialog') || e.ctrlKey || e.metaKey || e.altKey) return
  const key = e.key
  if (key === '+' || key === '=') cam.zoomAt(1.2, undefined, undefined, 200)
  else if (key === '-' || key === '_') cam.zoomAt(1 / 1.2, undefined, undefined, 200)
  else if (key === '0') centerFocus()
  else if (key.toLowerCase() === 'f' || key.toLowerCase() === 'а') fit()
  else if (key.toLowerCase() === 'h' || key.toLowerCase() === 'р') goHome()
  else if (key.toLowerCase() === 'r' || key.toLowerCase() === 'к') resetView()
  else if (key === 'ArrowLeft') cam.pan(100, 0, 150)
  else if (key === 'ArrowRight') cam.pan(-100, 0, 150)
  else if (key === 'ArrowUp') cam.pan(0, 100, 150)
  else if (key === 'ArrowDown') cam.pan(0, -100, 150)
  else if (key === 'Escape') {
    ui.addOverlayFor = null
    ctx.value = null
    return
  } else return
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/** Кнопка «Сбросить»: как при первом открытии раздела. */
function resetView() {
  ui.addOverlayFor = null
  cameFrom.value = null
  tree.resetView()
  nextTick(() => {
    const f = props.layout.focusNode
    cam.resetUserMoved()
    if (f) {
      const c = nodeCenter(f)
      cam.centerOn(c.x, c.y, defaultZoom(), 450)
    }
  })
}

function goHome() {
  const h = tree.homeId
  if (!h) return
  if (tree.focusId === h) centerFocus()
  else tree.setFocus(h)
}

// ------------------------------------------------------------------ оверлей «добавить»
const overlayPerson = computed(() => (ui.addOverlayFor && props.layout.shown.has(ui.addOverlayFor) ? ui.addOverlayFor : null))
const overlayScale = computed(() => Math.min(1, (size.value.w - 16) / 920, (size.value.h - 16) / 420))

// ------------------------------------------------------------------ подписи поколений
const rails = computed(() => {
  if (!props.opts.genLabels) return []
  if (props.layout.type === 'tree') {
    const m = M.value
    return (props.layout.rows ?? []).map((r) => ({ ...r, top: (r.row * m.ROW_H - m.ROW_GAP / 2 + shift.value.y) * k.value + ty.value + 8 }))
  }
  return []
})
const columns = computed(() => {
  if (!props.opts.genLabels || props.layout.type !== 'pedigree') return []
  const names = ['Центр', 'Родители', 'Деды', 'Прадеды', 'Прапрадеды', '3×прадеды', '4×прадеды', '5×прадеды', '6×прадеды']
  return (props.layout.columns ?? []).map((c) => ({ ...c, label: c.gen < 0 ? 'Дети' : names[c.gen] ?? `${c.gen}-е`, left: (c.x + shift.value.x) * k.value + tx.value }))
})

const bgStyle = computed(() => {
  // Сетка точек не мельче 16 px: при отдалении шаг удваивается
  let step = 24 * k.value
  while (step < 16) step *= 2
  return {
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${tx.value + shift.value.x * k.value}px ${ty.value + shift.value.y * k.value}px`,
  }
})

defineExpose({ fit, centerFocus, zoomAt: cam.zoomAt, goHome, resetView, svgRoot: () => root.value?.querySelector('svg.tc__svg') })
</script>

<template>
  <div
    ref="root"
    class="tc"
    :class="{ 'tc--drag': cam.dragging.value, 'tc--travel': travel }"
    :style="bgStyle"
    @pointerdown="onPointerDownRoot"
    @pointermove="cam.handlers.pointermove"
    @pointerup="onPointerUpRoot"
    @pointercancel="onPointerUpRoot"
    @wheel="cam.handlers.wheel"
    @contextmenu.prevent
    @click="ctx = null"
  >
    <svg class="tc__svg" width="100%" height="100%" role="img" :aria-label="`Схема древа: ${layout.nodes.length} карточек`">
      <g :transform="`translate(${tx} ${ty}) scale(${k})`">
        <g :transform="`translate(${shift.x} ${shift.y})`">
          <g v-if="opts.genLabels && layout.type === 'tree' && lod !== 'dots'" class="tc__bands">
            <rect
              v-for="(r, i) in layout.rows"
              :key="r.row"
              :x="layout.bounds.minX - 6000"
              :y="r.row * M.ROW_H - M.ROW_GAP / 2"
              :width="layout.bounds.maxX - layout.bounds.minX + 12000"
              :height="M.ROW_H"
              :fill="i % 2 ? 'transparent' : P.band"
            />
          </g>
          <ChartScene
            :nodes="visibleNodes"
            :edges="layout.edges"
            :tree="tree.tree"
            :metrics="M"
            :palette="P"
            :opts="opts"
            :relation-of="tree.relationToHome"
            :lod="lod"
            :selected-id="tree.selectedId"
            :home-id="tree.homeId"
            :locked="tree.locks.persons.size ? tree.locks.persons : null"
            :highlight="highlight"
            :dim="!!hoverId"
            :entering="entering"
            :pulse-key="pulseKey"
            :fonts-version="fontsVersion"
            interactive
            :animate="opts.animate"
            @select="onSelect"
            @open="onOpen"
            @add="onAdd"
            @edit="(n) => ui.editPerson(n.personId)"
            @expand="expandTo"
            @placeholder="onPlaceholder"
            @context="onContext"
            @badge="(e) => ui.editFamily(e.familyId)"
            @hover="onHover"
          />
        </g>
      </g>
    </svg>

    <!-- Подписи поколений -->
    <div v-if="rails.length && lod !== 'dots'" class="tc__rails no-print" @pointerdown.stop>
      <div v-for="r in rails" :key="r.row" class="tc__rail" :style="{ transform: `translateY(${r.top}px)` }">
        <b>{{ r.label }}</b>
        <span v-if="r.years">{{ r.years }}</span>
      </div>
    </div>
    <div v-if="columns.length" class="tc__cols no-print">
      <div v-for="c in columns" :key="c.gen" class="tc__col" :style="{ transform: `translateX(${c.left}px)` }">{{ c.label }}</div>
    </div>

    <transition name="tc-chip">
      <div v-if="cameFrom" class="tc__from no-print" @pointerdown.stop @click.stop>
        <span class="tc__from-text">Центр: <b>{{ shortName(tree.person(cameFrom.toId)) }}</b></span>
        <button type="button" class="tc__from-back" @click="goBack">
          <q-icon name="sym_r_undo" size="16px" />
          <span>{{ shortName(tree.person(cameFrom.fromId)) }}</span>
        </button>
        <button type="button" class="tc__from-x" aria-label="Закрыть" @click="cameFrom = null"><q-icon name="sym_r_close" size="16px" /></button>
      </div>
    </transition>

    <ChartMinimap
      v-if="opts.minimap && layout.nodes.length > 6 && size.w > 640"
      class="no-print"
      :nodes="layout.nodes"
      :bounds="layout.bounds"
      :shift="shift"
      :tx="tx"
      :ty="ty"
      :k="k"
      :size="size"
      :palette="P"
      :selected-id="tree.selectedId"
      :home-id="tree.homeId"
      :persons="tree.tree.persons"
      @pan="(x, y) => cam.centerOn(x, y, k, 0)"
    />

    <ChartControls
      class="no-print"
      :zoom="Math.round(k * 100)"
      @zoom-in="cam.zoomAt(1.25, undefined, undefined, 220)"
      @zoom-out="cam.zoomAt(0.8, undefined, undefined, 220)"
      @fit="fit()"
      @center="centerFocus()"
      @home="goHome"
      @reset="resetView"
      @fullscreen="emit('fullscreen')"
    />

    <AddRelativeOverlay
      v-if="overlayPerson"
      :person-id="overlayPerson"
      :x="size.w / 2"
      :y="size.h / 2"
      :scale="overlayScale"
      :compact="size.w < 640"
      @close="ui.addOverlayFor = null"
    />
    <PersonContextMenu v-if="ctx" :person-id="ctx.personId" :x="ctx.x" :y="ctx.y" :bounds="size" @close="ctx = null" />
  </div>
</template>

<style scoped lang="scss">
.tc {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  user-select: none;
  background-color: var(--ft-canvas);
  background-image: radial-gradient(var(--ft-dot) 1.1px, transparent 1.2px);
  outline: none;
}
.tc--drag {
  cursor: grabbing;
}
.tc--travel {
  --move-ms: 0.9s;
}
.tc__svg {
  position: absolute;
  inset: 0;
  display: block;
}
.tc__rails {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: none;
  z-index: 2;
}
.tc__rail {
  position: absolute;
  left: 10px;
  top: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ft-surface) 88%, transparent);
  border: 1px solid var(--ft-border);
  backdrop-filter: blur(6px);
  white-space: nowrap;
  font-size: 11.5px;
  line-height: 1.25;
  box-shadow: var(--ft-shadow-xs);
  b {
    color: var(--ft-text-2);
    font-weight: 650;
  }
  span {
    color: var(--ft-muted);
    font-variant-numeric: tabular-nums;
  }
}
.tc__cols {
  position: absolute;
  top: 10px;
  left: 0;
  pointer-events: none;
}
.tc__col {
  position: absolute;
  top: 0;
  left: 0;
  margin-left: -60px;
  width: 120px;
  text-align: center;
  font-size: 12px;
  font-weight: 650;
  color: var(--ft-muted);
  white-space: nowrap;
}
.tc__from {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  max-width: calc(100% - 140px);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 5px 5px 14px;
  border-radius: 999px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow-lg);
  font-size: 13px;
  cursor: default;
}
.tc__from-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tc__from-back,
.tc__from-x {
  border: 0;
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  color: var(--ft-primary-text);
  background: var(--ft-primary-soft);
  padding: 5px 10px;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tc__from-x {
  padding: 5px;
  color: var(--ft-muted);
  background: transparent;
}
@media (max-width: 600px) {
  .tc__from-text {
    display: none;
  }
  .tc__from {
    padding-left: 5px;
  }
  .tc__rail {
    left: 6px;
    padding: 3px 7px;
    span {
      display: none;
    }
  }
}
.tc-chip-enter-active,
.tc-chip-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.tc-chip-enter-from,
.tc-chip-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>
