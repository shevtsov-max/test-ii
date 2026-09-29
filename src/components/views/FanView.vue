<script setup>
import { computed, ref } from 'vue'
import ViewToolbar from './ViewToolbar.vue'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { lifeSpan, shortName } from '@/utils/person'

const store = useTreeStore()
const ui = useUiStore()
const MAX = 6
const gens = computed(() => Math.min(Math.max(store.ui.generations, 2), MAX))

const SPAN = 240 // градусов
const START = -90 - SPAN / 2
const R0 = 92
const ringW = (g) => (g <= 2 ? 96 : g <= 4 ? 82 : 70)
const inner = (g) => {
  let r = R0
  for (let i = 1; i < g; i++) r += ringW(i)
  return r
}

const rad = (a) => (a * Math.PI) / 180
const pt = (r, a) => [r * Math.cos(rad(a)), r * Math.sin(rad(a))]

function arcPath(r0, r1, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = pt(r1, a0)
  const [x1, y1] = pt(r1, a1)
  const [x2, y2] = pt(r0, a1)
  const [x3, y3] = pt(r0, a0)
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
}

const sectors = computed(() => {
  const out = []
  const focus = store.focusId
  if (!focus) return out
  const walk = (pid, gen, idx) => {
    if (gen >= gens.value) return
    const { father, mother, family } = store.parentsOf(pid)
    const full = (family?.partners.length ?? 0) >= 2
    const parents = [
      [father, 'father'],
      [mother, 'mother'],
    ]
    parents.forEach(([par, role], j) => {
      const g = gen + 1
      const i = idx * 2 + j
      const count = 2 ** g
      const a0 = START + (SPAN / count) * i
      const a1 = a0 + SPAN / count
      const r0 = inner(g)
      const r1 = r0 + ringW(g)
      if (!par && full) return
      out.push({
        key: `${g}-${i}`,
        gen: g,
        idx: i,
        personId: par,
        forId: par ? undefined : pid,
        role,
        d: arcPath(r0 + 1.5, r1 - 1.5, a0 + 0.35, a1 - 0.35),
        a0,
        a1,
        r0,
        r1,
      })
      if (par) walk(par, g, i)
    })
  }
  walk(focus, 0, 0)
  return out
})

const outerR = computed(() => inner(gens.value) + ringW(gens.value))
const viewBox = computed(() => {
  const R = outerR.value + 12
  const bottom = Math.max(R0 + 70, R * Math.sin(rad(SPAN / 2 - 90)) + 20)
  return `${-R} ${-R} ${R * 2} ${R + bottom}`
})

function labelFor(s) {
  const p = store.person(s.personId)
  if (!p) return null
  const mid = (s.a0 + s.a1) / 2
  const rMid = (s.r0 + s.r1) / 2
  const angSize = s.a1 - s.a0
  const arcLen = rad(angSize) * rMid
  // радиальный текст для узких секторов
  const radial = arcLen < 90
  const [x, y] = pt(rMid, mid)
  let rot = radial ? mid : mid + 90
  if (radial && (mid > 90 || mid < -90)) rot += 180
  if (!radial && Math.sin(rad(mid)) > 0.2) rot += 180
  const width = radial ? s.r1 - s.r0 - 8 : arcLen - 10
  const size = s.gen <= 1 ? 13 : s.gen <= 3 ? 11.5 : 10
  const maxChars = Math.max(3, Math.floor(width / (size * 0.56)))
  const cut = (t) => (t.length > maxChars ? t.slice(0, maxChars - 1) + '…' : t)
  return {
    x,
    y,
    rot,
    size,
    first: cut(p.firstName || '—'),
    last: cut(p.lastName),
    years: s.gen <= 4 ? cut(lifeSpan(p)) : '',
  }
}

const hover = ref(null)
const focusPerson = computed(() => store.focus)
function onClick(s) {
  if (s.personId) store.select(s.personId)
  else if (s.forId && s.role) ui.addRelative(s.forId, s.role)
}
</script>

<template>
  <div class="column no-wrap fit">
    <ViewToolbar :max-gen="MAX" />
    <div class="col fan">
      <svg :viewBox="viewBox" class="fan__svg" preserveAspectRatio="xMidYMid meet">
        <g v-for="s in sectors" :key="s.key" class="fan__sec" @click="onClick(s)" @dblclick="s.personId && store.setFocus(s.personId)" @mouseenter="hover = s.key" @mouseleave="hover = null">
          <path
            :d="s.d"
            :class="[
              s.personId ? `gender-${store.person(s.personId)?.gender}` : 'fan__empty',
              { 'fan__sel': s.personId && store.selectedId === s.personId },
            ]"
            :style="{ '--lvl': s.gen }"
          />
          <template v-if="s.personId">
            <text
              v-if="labelFor(s)"
              :transform="`translate(${labelFor(s).x} ${labelFor(s).y}) rotate(${labelFor(s).rot})`"
              text-anchor="middle"
              :font-size="labelFor(s).size"
              class="fan__text"
            >
              <tspan x="0" :dy="labelFor(s).years ? '-0.6em' : '-0.1em'" font-weight="700">{{ labelFor(s).first }}</tspan>
              <tspan x="0" dy="1.15em">{{ labelFor(s).last }}</tspan>
              <tspan v-if="labelFor(s).years" x="0" dy="1.15em" class="fan__years">{{ labelFor(s).years }}</tspan>
            </text>
            <title>{{ shortName(store.person(s.personId)) }} · {{ lifeSpan(store.person(s.personId)) }}</title>
          </template>
          <template v-else>
            <text
              :transform="`translate(${pt((s.r0 + s.r1) / 2, (s.a0 + s.a1) / 2)[0]} ${pt((s.r0 + s.r1) / 2, (s.a0 + s.a1) / 2)[1]})`"
              text-anchor="middle"
              dominant-baseline="central"
              class="fan__plus"
              :font-size="s.gen <= 3 ? 20 : 15"
            >+</text>
            <title>Добавить {{ s.role === 'father' ? 'отца' : 'мать' }}</title>
          </template>
        </g>
        <foreignObject v-if="focusPerson" :x="-R0" :y="-R0" :width="R0 * 2" :height="R0 * 2">
          <div class="fan__center" :class="`gender-${focusPerson.gender}`" @click="store.select(focusPerson.id)">
            <PersonAvatar :person="focusPerson" :size="58" />
            <div class="fan__center-name">{{ shortName(focusPerson) }}</div>
            <div class="fan__center-years">{{ lifeSpan(focusPerson) }}</div>
          </div>
        </foreignObject>
      </svg>
      <div class="fan__legend text-caption text-muted">
        Клик — выбрать · двойной клик — сделать центральной · «+» — добавить родителя
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fan {
  position: relative;
  background-color: var(--ft-canvas);
  background-image: radial-gradient(var(--ft-dot) 1.2px, transparent 1.3px);
  background-size: 24px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
}
.fan__svg {
  width: 100%;
  height: 100%;
  max-width: 1200px;
}
.fan__sec {
  cursor: pointer;
  path {
    fill: color-mix(in srgb, var(--g) calc(38% - var(--lvl) * 4%), var(--ft-surface));
    stroke: var(--ft-surface);
    stroke-width: 1;
    transition:
      fill 0.15s,
      transform 0.2s;
  }
  &:hover path {
    fill: color-mix(in srgb, var(--g) 55%, var(--ft-surface));
  }
  path.fan__sel {
    stroke: var(--ft-text);
    stroke-width: 2;
  }
  path.fan__empty {
    fill: transparent;
    stroke: var(--ft-line);
    stroke-dasharray: 4 4;
  }
  &:hover path.fan__empty {
    fill: var(--ft-primary-soft);
    stroke: var(--ft-primary);
  }
}
.fan__text {
  fill: var(--ft-text);
  pointer-events: none;
  font-family: inherit;
}
.fan__years {
  fill: var(--ft-muted);
  font-size: 0.85em;
}
.fan__plus {
  fill: var(--ft-muted);
  pointer-events: none;
  font-weight: 300;
}
.fan__center {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--ft-surface);
  border: 3px solid var(--g);
  box-shadow: var(--ft-shadow-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  padding: 8px;
}
.fan__center-name {
  margin-top: 4px;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.15;
}
.fan__center-years {
  font-size: 11px;
  color: var(--ft-muted);
}
.fan__legend {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  text-align: center;
}
</style>
