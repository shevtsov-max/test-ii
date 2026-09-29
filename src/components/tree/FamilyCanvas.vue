<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LayoutResult, LNode } from '@/utils/layout'
import PersonCard from './PersonCard.vue'
import AddRelativeOverlay from './AddRelativeOverlay.vue'
import CanvasControls from './CanvasControls.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePhotoUpload } from '@/composables/usePhoto'
import { FAMILY_STATUSES } from '@/utils/person'

const props = defineProps<{ layout: LayoutResult }>()
const store = useTreeStore()
const ui = useUiStore()
const { upload } = usePhotoUpload()

const root = ref<HTMLDivElement>()
const tx = ref(0)
const ty = ref(0)
const k = ref(1)
const animating = ref(false)
const MIN_K = 0.15
const MAX_K = 2.2

const size = ref({ w: 800, h: 600 })
let ro: ResizeObserver | undefined

// ------------------------------------------------------------------ view helpers
function animate(fn: () => void, ms = 450) {
  animating.value = true
  fn()
  clearTimeout(animTimer)
  animTimer = setTimeout(() => (animating.value = false), ms)
}
let animTimer: ReturnType<typeof setTimeout> | undefined

function centerOn(x: number, y: number, scale = k.value, smooth = true) {
  const apply = () => {
    k.value = scale
    tx.value = size.value.w / 2 - x * scale
    ty.value = size.value.h / 2 - y * scale
  }
  smooth ? animate(apply) : apply()
}

function nodeCenter(n: LNode) {
  return { x: n.x, y: (n.top ?? 0) + n.h / 2 }
}

function centerFocus(smooth = true) {
  const f = props.layout.focusNode
  if (f) {
    const c = nodeCenter(f)
    centerOn(c.x, c.y, k.value, smooth)
  }
}

function fit(smooth = true) {
  const b = props.layout.bounds
  const pad = 80
  const w = b.maxX - b.minX + pad * 2
  const h = b.maxY - b.minY + pad * 2
  const scale = Math.max(MIN_K, Math.min(1.1, size.value.w / w, size.value.h / h))
  centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, scale, smooth)
}

function zoomAt(factor: number, px = size.value.w / 2, py = size.value.h / 2, smooth = false) {
  const nk = Math.min(MAX_K, Math.max(MIN_K, k.value * factor))
  const apply = () => {
    tx.value = px - ((px - tx.value) * nk) / k.value
    ty.value = py - ((py - ty.value) * nk) / k.value
    k.value = nk
  }
  smooth ? animate(apply, 250) : apply()
}

// ------------------------------------------------------------------ pan / pinch
const pointers = new Map<number, { x: number; y: number }>()
let panStart: { x: number; y: number; tx: number; ty: number } | null = null
let pinchStart: { d: number; k: number; cx: number; cy: number; tx: number; ty: number } | null = null
const dragging = ref(false)
let moved = false

function local(e: PointerEvent | WheelEvent) {
  const r = root.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onPointerDown(e: PointerEvent) {
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

function onPointerMove(e: PointerEvent) {
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

function onPointerUp(e: PointerEvent) {
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

function onWheel(e: WheelEvent) {
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
function onKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
  if (document.querySelector('.q-dialog')) return
  if (e.key === '+' || e.key === '=') zoomAt(1.2, undefined, undefined, true)
  else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.2, undefined, undefined, true)
  else if (e.key === '0') centerOn(nodeCenter(props.layout.focusNode!).x, nodeCenter(props.layout.focusNode!).y, 1)
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
  ro.observe(root.value!)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
})

// При смене центральной персоны — плавно к ней
watch(
  () => store.focusId,
  async () => {
    await nextTick()
    centerFocus(true)
  },
)
watch(
  () => store.ui.generations,
  async () => {
    await nextTick()
    centerFocus(true)
  },
)

// ------------------------------------------------------------------ overlay
const overlayNode = computed(() => {
  const id = ui.addOverlayFor
  if (!id) return null
  return props.layout.nodes.find((n) => n.personId === id && !n.dup) ?? null
})
const overlayScale = computed(() => Math.min(1, (size.value.w - 16) / 920, (size.value.h - 16) / 420))

function openAdd(n: LNode) {
  const c = nodeCenter(n)
  if (size.value.w >= 640) centerOn(c.x, c.y, k.value, true)
  ui.addOverlayFor = n.personId!
}

// ------------------------------------------------------------------ cards
function onSelect(n: LNode) {
  if (moved) return
  store.select(n.personId!)
  if (!store.ui.panelOpen && window.innerWidth >= 1024) store.ui.panelOpen = true
}
function onExpand(n: LNode) {
  store.setFocus(n.personId!)
}

const statusIcon = (s?: string) => FAMILY_STATUSES.find((x) => x.value === s)?.icon ?? 'sym_r_favorite'
const statusLabel = (s?: string) => FAMILY_STATUSES.find((x) => x.value === s)?.label ?? ''

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
    :class="{ 'fc--drag': dragging, 'fc--anim': animating }"
    :style="{ '--k': k, backgroundSize: `${24 * k}px ${24 * k}px`, backgroundPosition: `${tx}px ${ty}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @click="onClickBackground"
  >
    <div class="fc__world" :style="worldStyle">
      <svg class="fc__links" width="1" height="1">
        <path
          v-for="l in layout.links"
          :key="l.key"
          :class="['fc__link', `fc__link--${l.kind}`, { 'fc__link--dashed': l.dashed, 'fc__link--ex': l.status === 'divorced' || l.status === 'separated' }]"
          :d="l.d"
          :style="{ d: `path('${l.d}')` }"
        />
      </svg>

      <template v-for="l in layout.links" :key="'b-' + l.key">
        <button
          v-if="l.badge && l.familyId"
          class="fc__badge"
          :class="`fc__badge--${l.status}`"
          :style="{ left: l.badge.x + 'px', top: l.badge.y + 'px' }"
          @pointerdown.stop
          @click.stop="ui.editFamily(l.familyId)"
        >
          <q-icon :name="statusIcon(l.status)" size="13px" />
          <q-tooltip :delay="400">{{ statusLabel(l.status) }} · нажмите, чтобы изменить</q-tooltip>
        </button>
      </template>

      <div
        v-for="n in layout.nodes"
        :key="n.key"
        class="fc__node"
        :class="{ 'fc__node--ph': n.kind === 'placeholder' }"
        :style="{ width: n.w + 'px', height: n.h + 'px', transform: `translate(${n.left}px, ${n.top}px)` }"
      >
        <PersonCard
          v-if="n.kind === 'person' && store.person(n.personId)"
          :person="store.person(n.personId)!"
          :selected="store.selectedId === n.personId"
          :focus="n.focus"
          :home="store.homeId === n.personId"
          :more-up="n.moreUp"
          :more-down="n.moreDown"
          :dup="n.dup"
          @select="onSelect(n)"
          @open="store.setFocus(n.personId!)"
          @edit="ui.editPerson(n.personId!)"
          @add="openAdd(n)"
          @camera="upload(n.personId!, { avatar: true })"
          @expand="onExpand(n)"
        />
        <button
          v-else-if="n.kind === 'placeholder'"
          class="fc__ph"
          :class="n.role === 'father' ? 'gender-M' : 'gender-F'"
          @click.stop="!moved && ui.addRelative(n.forId!, n.role!)"
        >
          <q-icon name="sym_r_add" size="18px" />
          <span>Добавить<br />{{ n.role === 'father' ? 'отца' : 'мать' }}</span>
        </button>
      </div>
    </div>

    <AddRelativeOverlay
      v-if="overlayNode"
      :person-id="overlayNode.personId!"
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
.fc--anim .fc__world {
  transition: transform 0.45s cubic-bezier(0.22, 0.8, 0.26, 1);
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
  transition: transform 0.45s cubic-bezier(0.22, 0.8, 0.26, 1);
  animation: nodeIn 0.35s ease-out;
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
    left 0.45s cubic-bezier(0.22, 0.8, 0.26, 1),
    top 0.45s cubic-bezier(0.22, 0.8, 0.26, 1),
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
@keyframes linkIn {
  from {
    opacity: 0;
  }
}
</style>
