<script setup>
/**
 * Колонки для одного ряда данных (рождения по десятилетиям, возраст по векам).
 * Тонкие колонки со скруглённым верхом, волосяная сетка, подсказка на наведение/фокус, табличный вид.
 * Цвет — var(--viz-series, var(--ft-primary)).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  /** @type {{ label: string | number, value: number, hint?: string }[]} */
  data: { type: Array, required: true },
  height: { type: Number, default: 220 },
  /** Подписывать значения на колонках (для коротких рядов) */
  capLabels: Boolean,
  /** Показать данные таблицей */
  table: Boolean,
  labelHeader: { type: String, default: '' },
  valueHeader: { type: String, default: 'Значение' },
  format: { type: Function, default: (v) => v.toLocaleString('ru-RU') },
  formatLabel: { type: Function, default: (l) => String(l) },
})

const root = ref(null)
const width = ref(600)
let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(240, e.contentRect.width)))
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const PAD = { top: 18, right: 8, bottom: 26, left: 36 }

function niceMax(v) {
  if (v <= 4) return Math.max(1, Math.ceil(v))
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * pow
}

const geo = computed(() => {
  const n = props.data.length
  const w = width.value
  const h = props.height
  const plotW = w - PAD.left - PAD.right
  const plotH = h - PAD.top - PAD.bottom
  const max = niceMax(Math.max(1, ...props.data.map((d) => d.value)))
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, max / 4, max / 2, (max * 3) / 4, max].filter((t) => Number.isInteger(t))
  const band = n ? plotW / n : plotW
  const barW = Math.max(3, Math.min(24, band - 2))
  const labelEvery = Math.max(1, Math.ceil(46 / band))
  const cols = props.data.map((d, i) => {
    const x = PAD.left + i * band + (band - barW) / 2
    const bh = max ? (d.value / max) * plotH : 0
    return {
      ...d,
      i,
      x,
      w: barW,
      y: PAD.top + plotH - bh,
      h: bh,
      cx: PAD.left + i * band + band / 2,
      band,
      bandX: PAD.left + i * band,
      showLabel: i % labelEvery === 0,
    }
  })
  return { w, h, plotH, max, ticks, cols, y: (v) => PAD.top + plotH - (v / max) * plotH }
})

/** Колонка со скруглением 4px только на конце (у основания углы прямые). */
function colPath(c) {
  if (c.h <= 0) return ''
  const r = Math.min(4, c.w / 2, c.h)
  const { x, y, w, h } = c
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

const hover = ref(null)
const tip = computed(() => {
  const c = geo.value.cols[hover.value]
  if (!c) return null
  const left = Math.min(Math.max(c.cx, 70), geo.value.w - 70)
  return { c, left, top: Math.max(0, c.y - 8) }
})
</script>

<template>
  <div ref="root" class="cc">
    <table v-if="table" class="cc__table">
      <thead>
        <tr>
          <th>{{ labelHeader }}</th>
          <th class="num">{{ valueHeader }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in data" :key="d.label">
          <td>{{ formatLabel(d.label) }}</td>
          <td class="num tabular">{{ format(d.value) }}<span v-if="d.hint" class="text-muted"> · {{ d.hint }}</span></td>
        </tr>
      </tbody>
    </table>
    <template v-else>
      <svg :width="geo.w" :height="geo.h" class="cc__svg" role="img" @pointerleave="hover = null">
        <g class="cc__grid">
          <template v-for="t in geo.ticks" :key="t">
            <line :x1="36" :x2="geo.w - 8" :y1="geo.y(t)" :y2="geo.y(t)" :class="{ base: t === 0 }" />
            <text :x="30" :y="geo.y(t) + 4" text-anchor="end" class="cc__tick">{{ format(t) }}</text>
          </template>
        </g>
        <g>
          <g
            v-for="c in geo.cols"
            :key="c.label"
            class="cc__col"
            :class="{ dim: hover !== null && hover !== c.i }"
            tabindex="0"
            :aria-label="`${formatLabel(c.label)}: ${format(c.value)}`"
            @pointerenter="hover = c.i"
            @focus="hover = c.i"
            @blur="hover = null"
          >
            <rect :x="c.bandX" :y="18" :width="c.band" :height="geo.plotH" class="cc__hit" />
            <path :d="colPath(c)" class="cc__bar" />
            <text v-if="capLabels && c.value" :x="c.cx" :y="c.y - 5" text-anchor="middle" class="cc__cap">{{ format(c.value) }}</text>
            <text v-if="c.showLabel" :x="c.cx" :y="geo.h - 8" text-anchor="middle" class="cc__label">{{ formatLabel(c.label) }}</text>
          </g>
        </g>
      </svg>
      <div v-if="tip" class="cc__tip" :style="{ left: tip.left + 'px', top: tip.top + 'px' }">
        <b class="tabular">{{ format(tip.c.value) }}</b>
        <span>{{ formatLabel(tip.c.label) }}<template v-if="tip.c.hint"> · {{ tip.c.hint }}</template></span>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.cc {
  position: relative;
  width: 100%;
}
.cc__svg {
  display: block;
  overflow: visible;
}
.cc__grid line {
  stroke: var(--ft-border);
  stroke-width: 1;
  shape-rendering: crispEdges;
  &.base {
    stroke: var(--ft-border-strong);
  }
}
.cc__tick,
.cc__label {
  font-size: 11px;
  fill: var(--ft-muted);
  font-variant-numeric: tabular-nums;
}
.cc__cap {
  font-size: 11.5px;
  font-weight: 650;
  fill: var(--ft-text-2);
}
.cc__hit {
  fill: transparent;
}
.cc__bar {
  fill: var(--viz-series, var(--ft-primary));
  transition: opacity 0.15s;
}
.cc__col {
  outline: none;
  cursor: default;
  &.dim .cc__bar {
    opacity: 0.45;
  }
  &:focus-visible .cc__hit {
    fill: var(--ft-primary-soft);
  }
}
.cc__tip {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow);
  font-size: 12px;
  white-space: nowrap;
  color: var(--ft-muted);
  z-index: 2;
  b {
    font-size: 14px;
    color: var(--ft-text);
  }
}
.cc__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--ft-border);
    text-align: left;
  }
  th {
    font-size: 11.5px;
    color: var(--ft-muted);
    font-weight: 600;
  }
  .num {
    text-align: right;
  }
}
</style>
