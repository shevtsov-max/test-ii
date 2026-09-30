<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
  bounds: { type: Object, required: true },
  shift: { type: Object, required: true },
  tx: { type: Number, required: true },
  ty: { type: Number, required: true },
  k: { type: Number, required: true },
  size: { type: Object, required: true },
  palette: { type: Object, required: true },
  selectedId: { type: String, default: null },
  homeId: { type: String, default: null },
  persons: { type: Object, required: true },
})
const emit = defineEmits(['pan'])
const W = 190
const H = 124
const collapsed = ref(false)

const box = computed(() => {
  const b = props.bounds
  const pad = 60
  const w = b.maxX - b.minX + pad * 2
  const h = b.maxY - b.minY + pad * 2
  const s = Math.min(W / w, H / h)
  const ox = (W - w * s) / 2 - (b.minX - pad) * s
  const oy = (H - h * s) / 2 - (b.minY - pad) * s
  return { s, ox, oy }
})
const map = (x, y) => ({ x: x * box.value.s + box.value.ox, y: y * box.value.s + box.value.oy })

const view = computed(() => {
  // Видимая область в координатах мира (без shift)
  const x0 = -props.tx / props.k - props.shift.x
  const y0 = -props.ty / props.k - props.shift.y
  const a = map(x0, y0)
  return { x: a.x, y: a.y, w: (props.size.w / props.k) * box.value.s, h: (props.size.h / props.k) * box.value.s }
})

const colorOf = (n) => {
  if (n.kind !== 'person') return props.palette.line
  if (n.personId === props.homeId) return props.palette.primary
  if (n.personId === props.selectedId) return props.palette.text
  const g = props.persons[n.personId]?.gender
  return g === 'F' ? props.palette.female : g === 'M' ? props.palette.male : props.palette.unknown
}

let dragging = false
function toWorld(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const mx = e.clientX - r.left
  const my = e.clientY - r.top
  return { x: (mx - box.value.ox) / box.value.s + props.shift.x, y: (my - box.value.oy) / box.value.s + props.shift.y }
}
function down(e) {
  dragging = true
  e.currentTarget.setPointerCapture(e.pointerId)
  const p = toWorld(e)
  emit('pan', p.x, p.y)
}
function move(e) {
  if (!dragging) return
  const p = toWorld(e)
  emit('pan', p.x, p.y)
}
function up() {
  dragging = false
}
</script>

<template>
  <div class="mm" :class="{ 'mm--collapsed': collapsed }" @pointerdown.stop @wheel.stop>
    <button class="mm__toggle" type="button" :title="collapsed ? 'Показать карту' : 'Скрыть карту'" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'sym_r_map' : 'sym_r_close_fullscreen'" size="16px" />
    </button>
    <svg v-if="!collapsed" :width="W" :height="H" class="mm__svg" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
      <rect
        v-for="n in nodes"
        :key="n.key"
        :x="map(n.left, n.top).x"
        :y="map(n.left, n.top).y"
        :width="Math.max(1.5, n.w * box.s)"
        :height="Math.max(1.5, n.h * box.s)"
        :rx="1.5"
        :fill="colorOf(n)"
        :fill-opacity="n.kind === 'person' ? 0.75 : 0.3"
      />
      <rect :x="view.x" :y="view.y" :width="view.w" :height="view.h" rx="3" class="mm__view" />
    </svg>
  </div>
</template>

<style scoped lang="scss">
.mm {
  position: absolute;
  left: 14px;
  bottom: 14px;
  z-index: 5;
  background: color-mix(in srgb, var(--ft-surface) 92%, transparent);
  border: 1px solid var(--ft-border);
  border-radius: 14px;
  box-shadow: var(--ft-shadow);
  padding: 6px;
  backdrop-filter: blur(8px);
}
.mm--collapsed {
  padding: 0;
}
.mm__svg {
  display: block;
  cursor: pointer;
  touch-action: none;
}
.mm__view {
  fill: color-mix(in srgb, var(--ft-primary) 10%, transparent);
  stroke: var(--ft-primary);
  stroke-width: 1.5;
}
.mm__toggle {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--ft-muted);
  cursor: pointer;
  z-index: 1;
  &:hover {
    background: var(--ft-surface-3);
  }
}
.mm--collapsed .mm__toggle {
  position: static;
  width: 36px;
  height: 36px;
}
</style>
