<script setup>
/**
 * Лента жизни: у каждого человека — полоса от рождения до смерти (у живых — до сегодня).
 * Видно, чьи жизни пересекались, кто кого застал; на фоне — крупные исторические события.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { computeTimeline, generationLabel } from '@/domain/layout'
import { shortName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'

const props = defineProps({
  personIds: { type: Array, required: true },
  generations: { type: Object, required: true },
})
const emit = defineEmits(['select'])
const tree = useTreeStore()
const scroller = ref()

const ERAS = [
  { from: 1812, to: 1812, label: '1812' },
  { from: 1861, to: 1861, label: 'Отмена крепостного права' },
  { from: 1914, to: 1918, label: 'Первая мировая' },
  { from: 1917, to: 1922, label: 'Революция и Гражданская' },
  { from: 1941, to: 1945, label: 'Великая Отечественная' },
  { from: 1991, to: 1991, label: 'Распад СССР' },
]

const data = computed(() => computeTimeline(tree.graph, props.personIds, props.generations))
const PX = computed(() => {
  const span = data.value.maxYear - data.value.minYear
  return span > 260 ? 4 : span > 160 ? 6 : 8
})
const width = computed(() => (data.value.maxYear - data.value.minYear) * PX.value)
const x = (year) => (year - data.value.minYear) * PX.value
const ticks = computed(() => {
  const out = []
  const step = PX.value >= 8 ? 10 : 20
  for (let y = Math.ceil(data.value.minYear / step) * step; y <= data.value.maxYear; y += step) out.push(y)
  return out
})
const eras = computed(() => ERAS.filter((e) => e.to >= data.value.minYear && e.from <= data.value.maxYear))

const groups = computed(() => {
  const out = []
  for (const r of data.value.rows) {
    let g = out.find((x) => x.gen === r.generation)
    if (!g) out.push((g = { gen: r.generation, rows: [] }))
    g.rows.push(r)
  }
  return out
})

function barStyle(r) {
  const p = tree.person(r.personId)
  const color = p.gender === 'F' ? 'var(--ft-female)' : p.gender === 'M' ? 'var(--ft-male)' : 'var(--ft-unknown)'
  const w = Math.max(6, x(r.end) - x(r.start))
  let bg = `color-mix(in srgb, ${color} 72%, var(--ft-surface))`
  if (r.living) bg = `linear-gradient(90deg, ${bg} 70%, color-mix(in srgb, ${color} 25%, var(--ft-surface)))`
  else if (r.approxEnd) bg = `linear-gradient(90deg, ${bg} 55%, transparent)`
  return { left: x(r.start) + 'px', width: w + 'px', background: bg, '--c': color }
}

const hoverYear = ref(null)
function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  hoverYear.value = Math.round((e.clientX - rect.left) / PX.value + data.value.minYear)
}
function ageAtHover(r) {
  if (hoverYear.value === null || hoverYear.value < r.start || hoverYear.value > r.end) return null
  return hoverYear.value - r.start
}

function scrollToFocus() {
  const row = data.value.rows.find((r) => r.personId === tree.focusId)
  if (!row || !scroller.value) return
  scroller.value.scrollLeft = Math.max(0, x(row.start) - 200)
}
onMounted(() => nextTick(scrollToFocus))
watch(() => tree.focusId, () => nextTick(scrollToFocus))
</script>

<template>
  <div class="tlc">
    <div v-if="!data.rows.length" class="tlc__empty text-muted">Нет людей с известными годами жизни</div>
    <div v-else ref="scroller" class="tlc__scroll ft-scroll">
      <div class="tlc__grid" :style="{ '--w': width + 'px' }">
        <!-- Ось -->
        <div class="tlc__corner">Поколение / год</div>
        <div class="tlc__axis">
          <span v-for="t in ticks" :key="t" class="tlc__tick" :style="{ left: x(t) + 'px' }">{{ t }}</span>
        </div>

        <template v-for="g in groups" :key="g.gen">
          <div class="tlc__gen">{{ generationLabel(g.gen) }}</div>
          <div class="tlc__gen-line" />
          <template v-for="r in g.rows" :key="r.personId">
            <button
              type="button"
              class="tlc__name"
              :class="{ active: r.personId === tree.selectedId, focus: r.personId === tree.focusId }"
              @click="tree.selectPerson(r.personId), emit('select', r.personId)"
            >
              <PersonAvatar :person="tree.person(r.personId)" :size="24" />
              <span class="ellipsis-1">{{ shortName(tree.person(r.personId)) }}</span>
            </button>
            <div class="tlc__lane" @mousemove="onMove" @mouseleave="hoverYear = null" @click="tree.selectPerson(r.personId), emit('select', r.personId)">
              <div
                class="tlc__bar"
                :class="{ active: r.personId === tree.selectedId, approx: r.approxStart }"
                :style="barStyle(r)"
              >
                <span class="tlc__bar-text">{{ lifeSpan(tree.person(r.personId)) }}</span>
              </div>
              <span
                v-for="(ev, i) in r.events"
                :key="i"
                class="tlc__ev"
                :class="`tlc__ev--${ev.kind}`"
                :style="{ left: x(ev.year) + 'px' }"
                :title="ev.kind === 'child' ? `${ev.year}: рождение ребёнка — ${shortName(tree.person(ev.personId))}` : ev.kind === 'marriage' ? `${ev.year}: брак` : `${ev.year}`"
              />
              <span v-if="ageAtHover(r) !== null" class="tlc__age" :style="{ left: x(hoverYear) + 'px' }">{{ ageAtHover(r) }}</span>
            </div>
          </template>
        </template>

        <!-- Эпохи и курсор (на всю высоту) -->
        <div class="tlc__overlay">
          <div v-for="e in eras" :key="e.label" class="tlc__era" :style="{ left: x(e.from) + 'px', width: Math.max(2, x(e.to + 1) - x(e.from)) + 'px' }">
            <span>{{ e.label }}</span>
          </div>
          <div class="tlc__now" :style="{ left: x(data.nowYear) + 'px' }"><span>Сегодня</span></div>
          <div v-if="hoverYear !== null" class="tlc__cursor" :style="{ left: x(hoverYear) + 'px' }">
            <span>{{ hoverYear }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tlc {
  position: relative;
  height: 100%;
  background: var(--ft-surface);
}
.tlc__empty {
  padding: 60px;
  text-align: center;
}
.tlc__scroll {
  height: 100%;
  overflow: auto;
}
.tlc__grid {
  position: relative;
  display: grid;
  grid-template-columns: 220px var(--w);
  padding-bottom: 40px;
  min-width: calc(220px + var(--w) + 40px);
}
.tlc__corner,
.tlc__axis {
  position: sticky;
  top: 0;
  z-index: 3;
  height: 34px;
  background: var(--ft-surface-2);
  border-bottom: 1px solid var(--ft-border);
}
.tlc__corner {
  left: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-size: 11.5px;
  font-weight: 650;
  color: var(--ft-muted);
  border-right: 1px solid var(--ft-border);
}
.tlc__axis {
  position: sticky;
}
.tlc__tick {
  position: absolute;
  top: 9px;
  transform: translateX(-50%);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ft-muted);
  font-variant-numeric: tabular-nums;
}
.tlc__gen {
  position: sticky;
  left: 0;
  z-index: 2;
  padding: 14px 14px 4px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ft-faint);
  background: var(--ft-surface);
  border-right: 1px solid var(--ft-border);
}
.tlc__gen-line {
  border-bottom: 1px dashed var(--ft-border);
  margin-bottom: 4px;
}
.tlc__name {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-right: 1px solid var(--ft-border);
  background: var(--ft-surface);
  font: inherit;
  font-size: 13px;
  color: var(--ft-text-2);
  text-align: left;
  cursor: pointer;
  min-width: 0;
  &:hover {
    background: var(--ft-surface-2);
  }
  &.active {
    color: var(--ft-primary-text);
    font-weight: 650;
  }
  &.focus span {
    font-weight: 700;
  }
}
.tlc__lane {
  position: relative;
  height: 32px;
  cursor: pointer;
  &:hover {
    background: color-mix(in srgb, var(--ft-surface-3) 60%, transparent);
  }
}
.tlc__bar {
  position: absolute;
  top: 7px;
  height: 18px;
  border-radius: 9px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent);
  display: flex;
  align-items: center;
  overflow: hidden;
  transition: box-shadow 0.15s;
  &.active {
    box-shadow:
      inset 0 0 0 1px var(--c),
      0 0 0 3px color-mix(in srgb, var(--c) 25%, transparent);
  }
  &.approx {
    border-top-left-radius: 2px;
    border-bottom-left-radius: 2px;
  }
}
.tlc__bar-text {
  padding: 0 8px;
  font-size: 11px;
  font-weight: 650;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}
.tlc__ev {
  position: absolute;
  top: 12px;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--ft-surface);
  border: 2px solid var(--ft-text-2);
  z-index: 1;
}
.tlc__ev--marriage {
  border-color: var(--ft-primary);
  background: var(--ft-primary);
}
.tlc__age {
  position: absolute;
  top: -2px;
  transform: translateX(-50%);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ft-text);
  background: var(--ft-surface);
  border-radius: 6px;
  padding: 0 4px;
  z-index: 2;
  pointer-events: none;
}
.tlc__overlay {
  position: absolute;
  left: 220px;
  top: 34px;
  bottom: 0;
  width: var(--w);
  pointer-events: none;
  z-index: 0;
}
.tlc__era {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--ft-warning) 9%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--ft-warning) 30%, transparent);
  span {
    position: absolute;
    top: 8px;
    left: 3px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--ft-warning);
    white-space: nowrap;
    writing-mode: vertical-rl;
  }
}
.tlc__now {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 2px solid var(--ft-primary);
  span {
    position: absolute;
    top: 4px;
    left: 4px;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--ft-primary-text);
  }
}
.tlc__cursor {
  position: absolute;
  top: -34px;
  bottom: 0;
  border-left: 1px dashed var(--ft-text-2);
  span {
    position: absolute;
    top: 8px;
    left: 4px;
    font-size: 11px;
    font-weight: 700;
    background: var(--ft-text);
    color: var(--ft-surface);
    padding: 0 5px;
    border-radius: 5px;
  }
}
.tlc__lane {
  z-index: 1;
}
.tlc__name,
.tlc__gen {
  z-index: 3;
}
</style>
