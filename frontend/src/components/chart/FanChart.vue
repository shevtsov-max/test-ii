<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import ChartControls from './ChartControls.vue'
import PersonContextMenu from './PersonContextMenu.vue'
import { chartPalette } from './palette'
import { usePanZoom } from '@/composables/usePanZoom'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { computeFan, polar, sectorLabel } from '@/domain/layout'
import { lifeSpan } from '@/domain/person'
import { shortName } from '@/domain/names'

const props = defineProps({ opts: { type: Object, required: true } })
const emit = defineEmits(['select', 'fullscreen'])
const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const root = ref()

const fan = computed(() => computeFan(tree.graph, tree.focusId, { generations: Math.max(3, props.opts.up + 1), placeholders: props.opts.placeholders }))
const P = computed(() => chartPalette($q.dark.isActive))
const bounds = computed(() => {
  const v = fan.value.viewBox
  return { minX: v.x, minY: v.y, maxX: v.x + v.w, maxY: v.y + v.h }
})
const cam = usePanZoom(root, { minK: 0.2, maxK: 4, onFirstSize: () => cam.fit(bounds.value, { ms: 0, pad: 20, maxScale: 2 }), onResize: () => cam.fit(bounds.value, { ms: 0, pad: 20, maxScale: 2 }) })

const lineageHue = { father: [28, 72], mother: [205, 58] }
function fill(s) {
  const p = s.personId && tree.person(s.personId)
  if (!p) return 'transparent'
  const t = Math.min(1, (s.gen - 1) / Math.max(1, fan.value.gens - 1))
  if (props.opts.fanColor === 'gender') {
    const base = p.gender === 'F' ? P.value.female : p.gender === 'M' ? P.value.male : P.value.unknown
    return `color-mix(in srgb, ${base} ${Math.round(46 - t * 30)}%, ${P.value.surface})`
  }
  const [h, sat] = lineageHue[s.line] ?? [0, 0]
  const light = $q.dark.isActive ? 26 + t * 10 : 72 + t * 16
  return `hsl(${h} ${sat - t * 20}% ${light}%)`
}
const label = (s) => {
  const p = tree.person(s.personId)
  return p ? sectorLabel(s, p, lifeSpan(p)) : null
}
const focus = computed(() => tree.focus)

function onClick(s) {
  if (cam.wasMoved() && cam.dragging.value) return
  if (s.personId) {
    tree.selectPerson(s.personId)
    emit('select', s.personId)
  } else if (s.forId && tree.canEdit(s.forId)) ui.addRelative(s.forId, s.role)
}
const ctx = ref(null)
function onContext(s, e) {
  if (!s.personId) return
  const r = root.value.getBoundingClientRect()
  ctx.value = { personId: s.personId, x: e.clientX - r.left, y: e.clientY - r.top }
}
</script>

<template>
  <div
    ref="root"
    class="fc"
    :class="{ 'fc--drag': cam.dragging.value }"
    @pointerdown="cam.handlers.pointerdown"
    @pointermove="cam.handlers.pointermove"
    @pointerup="cam.handlers.pointerup"
    @pointercancel="cam.handlers.pointerup"
    @wheel="cam.handlers.wheel"
    @contextmenu.prevent
  >
    <svg class="fc__svg" width="100%" height="100%">
      <g :transform="`translate(${cam.tx.value} ${cam.ty.value}) scale(${cam.k.value})`" font-family="'Inter Variable', Inter, system-ui, sans-serif">
        <g
          v-for="s in fan.sectors"
          :key="s.key"
          class="fc__sec"
          :class="{ 'fc__sec--empty': !s.personId, 'fc__sec--sel': s.personId && s.personId === tree.selectedId }"
          @click.stop="onClick(s)"
          @dblclick.stop="s.personId && tree.setFocus(s.personId)"
          @contextmenu.prevent.stop="onContext(s, $event)"
        >
          <path :d="s.d" :style="{ fill: fill(s) }" :stroke="s.personId ? P.surface : P.line" :stroke-width="s.personId ? 1.5 : 1" :stroke-dasharray="s.personId ? undefined : '4 4'" />
          <template v-if="s.personId && label(s)">
            <text :transform="`translate(${label(s).x} ${label(s).y}) rotate(${label(s).rot})`" text-anchor="middle" :font-size="label(s).size" :fill="P.text">
              <tspan x="0" :dy="label(s).years ? '-0.55em' : label(s).last ? '-0.1em' : '0.35em'" font-weight="700">{{ label(s).first }}</tspan>
              <tspan v-if="label(s).last" x="0" dy="1.15em">{{ label(s).last }}</tspan>
              <tspan v-if="label(s).years" x="0" dy="1.15em" :fill="P.muted" font-size="0.85em">{{ label(s).years }}</tspan>
            </text>
            <title>{{ shortName(tree.person(s.personId)) }} · {{ lifeSpan(tree.person(s.personId)) }} · {{ tree.relationToHome(s.personId) }}</title>
          </template>
          <template v-else-if="!s.personId">
            <text
              :transform="`translate(${polar((s.r0 + s.r1) / 2, (s.a0 + s.a1) / 2)[0]} ${polar((s.r0 + s.r1) / 2, (s.a0 + s.a1) / 2)[1]})`"
              text-anchor="middle"
              dominant-baseline="central"
              :fill="P.muted"
              :font-size="s.gen <= 3 ? 20 : 15"
            >
              +
            </text>
            <title>Добавить {{ s.role === 'father' ? 'отца' : 'мать' }}</title>
          </template>
        </g>
        <!-- Центр -->
        <g v-if="focus" class="fc__center" @click.stop="tree.selectPerson(focus.id)">
          <circle :r="fan.R0 - 4" :fill="P.surface" :stroke="focus.gender === 'F' ? P.female : focus.gender === 'M' ? P.male : P.unknown" stroke-width="3" />
          <text y="-6" text-anchor="middle" :fill="P.text" font-size="15" font-weight="750">{{ focus.firstName }}</text>
          <text y="13" text-anchor="middle" :fill="P.text" font-size="13" font-weight="600">{{ focus.lastName }}</text>
          <text y="32" text-anchor="middle" :fill="P.muted" font-size="11.5">{{ lifeSpan(focus) }}</text>
        </g>
      </g>
    </svg>
    <div class="fc__legend no-print">
      <span v-if="opts.fanColor !== 'gender'"><i style="background: hsl(28 72% 72%)" /> по отцу</span>
      <span v-if="opts.fanColor !== 'gender'"><i style="background: hsl(205 58% 72%)" /> по матери</span>
      <span class="text-faint">Клик — выбрать · двойной клик — в центр · «+» — добавить родителя</span>
    </div>
    <ChartControls
      :zoom="Math.round(cam.k.value * 100)"
      @zoom-in="cam.zoomAt(1.25, undefined, undefined, 220)"
      @zoom-out="cam.zoomAt(0.8, undefined, undefined, 220)"
      @fit="cam.fit(bounds, { pad: 20, maxScale: 2 })"
      @center="cam.fit(bounds, { pad: 20, maxScale: 2 })"
      @home="tree.homeId && tree.setFocus(tree.homeId)"
      @fullscreen="emit('fullscreen')"
    />
    <PersonContextMenu v-if="ctx" :person-id="ctx.personId" :x="ctx.x" :y="ctx.y" :bounds="cam.size.value" @close="ctx = null" />
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
  user-select: none;
  background-color: var(--ft-canvas);
  background-image: radial-gradient(var(--ft-dot) 1.1px, transparent 1.2px);
  background-size: 24px 24px;
}
.fc--drag {
  cursor: grabbing;
}
.fc__svg {
  position: absolute;
  inset: 0;
}
.fc__sec {
  cursor: pointer;
  path {
    transition:
      filter 0.15s,
      stroke-width 0.15s;
  }
  &:hover path {
    filter: brightness(0.94) saturate(1.2);
  }
  text {
    pointer-events: none;
  }
}
.fc__sec--empty:hover path {
  fill: var(--ft-primary-soft) !important;
  stroke: var(--ft-primary);
  stroke-dasharray: none;
}
.fc__sec--sel path {
  stroke: var(--ft-text);
  stroke-width: 2.5;
}
.fc__center {
  cursor: pointer;
}
.fc__legend {
  position: absolute;
  left: 14px;
  bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: var(--ft-muted);
  max-width: calc(100% - 90px);
  i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 4px;
    vertical-align: -1px;
  }
}
</style>
