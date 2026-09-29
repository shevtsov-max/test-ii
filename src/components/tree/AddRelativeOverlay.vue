<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { Gender, RelativeKind } from '@/types'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { lifeSpan, shortName } from '@/utils/person'

const props = defineProps<{ personId: string; x: number; y: number; scale: number; compact?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useTreeStore()
const ui = useUiStore()

const person = computed(() => store.person(props.personId)!)
const can = computed(() => store.canAdd(props.personId))

const W = 920
const H = 400
const cx = W / 2
const cy = H / 2
const OW = 232
const OH = 54
const CW = 246
const CH = 84

interface Opt {
  kind: RelativeKind
  label: string
  sub?: string
  gender: Gender
  x: number
  y: number
}

const options = computed<Opt[]>(() => {
  const list: Opt[] = []
  if (can.value.father) list.push({ kind: 'father', label: 'Добавить отца', gender: 'M', x: cx - 128, y: cy - 138 })
  if (can.value.mother) list.push({ kind: 'mother', label: 'Добавить мать', gender: 'F', x: cx + 128, y: cy - 138 })
  list.push({ kind: 'brother', label: 'Добавить брата', gender: 'M', x: cx - 340, y: cy - 44 })
  list.push({ kind: 'sister', label: 'Добавить сестру', gender: 'F', x: cx - 340, y: cy + 44 })
  const female = person.value.gender === 'F'
  list.push({
    kind: 'partner',
    label: 'Добавить партнёра',
    sub: female ? 'Муж, бывший муж, партнёр…' : 'Жена, бывшая жена, партнёрша…',
    gender: female ? 'M' : 'F',
    x: cx + 340,
    y: cy,
  })
  list.push({ kind: 'son', label: 'Добавить сына', gender: 'M', x: cx - 128, y: cy + 138 })
  list.push({ kind: 'daughter', label: 'Добавить дочь', gender: 'F', x: cx + 128, y: cy + 138 })
  return list
})

const lines = computed(() => {
  const r = 10
  const d: string[] = []
  const o = options.value
  const par = o.filter((x) => x.kind === 'father' || x.kind === 'mother')
  if (par.length) {
    const yBar = cy - 138 + OH / 2 + 22
    for (const p of par) d.push(`M ${cx} ${cy - CH / 2} L ${cx} ${yBar} L ${p.x} ${yBar} L ${p.x} ${p.y + OH / 2}`)
  }
  // братья/сёстры — скобка слева
  const bx = cx - 340 + OW / 2 + 26
  d.push(`M ${cx - CW / 2} ${cy} L ${bx} ${cy}`)
  d.push(`M ${cx - 340 + OW / 2} ${cy - 44} L ${bx - r} ${cy - 44} Q ${bx} ${cy - 44} ${bx} ${cy - 44 + r} L ${bx} ${cy + 44 - r} Q ${bx} ${cy + 44} ${bx - r} ${cy + 44} L ${cx - 340 + OW / 2} ${cy + 44}`)
  // партнёр
  d.push(`M ${cx + CW / 2} ${cy} L ${cx + 340 - OW / 2} ${cy}`)
  // дети
  const yKids = cy + 138 - OH / 2 - 22
  for (const k of o.filter((x) => x.kind === 'son' || x.kind === 'daughter')) {
    const s = Math.sign(k.x - cx)
    d.push(`M ${cx} ${cy + CH / 2} L ${cx} ${yKids - r} Q ${cx} ${yKids} ${cx + s * r} ${yKids} L ${k.x - s * r} ${yKids} Q ${k.x} ${yKids} ${k.x} ${yKids + r} L ${k.x} ${k.y - OH / 2}`)
  }
  return d
})

function choose(k: RelativeKind) {
  ui.addRelative(props.personId, k)
}

function onDown(e: PointerEvent) {
  e.stopPropagation()
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="aro" @pointerdown="onDown" @wheel.prevent.stop>
    <div v-if="compact" class="aro__sheet">
      <div class="aro__sheet-head" :class="`gender-${person.gender}`">
        <PersonAvatar :person="person" :size="44" />
        <div class="col" style="min-width: 0">
          <div class="text-weight-bold ellipsis">{{ shortName(person) }}</div>
          <div class="text-caption text-muted">Добавить родственника</div>
        </div>
        <q-btn flat round dense icon="sym_r_close" @click="emit('close')" />
      </div>
      <div class="aro__sheet-grid">
        <button
          v-for="(o, i) in options"
          :key="o.kind"
          class="aro__opt aro__opt--static"
          :class="[`gender-${o.gender}`, { 'aro__opt--wide': o.kind === 'partner' }]"
          :style="{ animationDelay: i * 25 + 'ms' }"
          @click="choose(o.kind)"
        >
          <PersonAvatar :gender="o.gender" :size="30" />
          <span class="aro__label">
            <span>{{ o.label.replace('Добавить ', '') }}</span>
          </span>
          <q-icon name="sym_r_add" size="18px" class="aro__plus" />
        </button>
      </div>
    </div>
    <div
      v-else
      class="aro__stage"
      :style="{
        width: W + 'px',
        height: H + 'px',
        transform: `translate(${x - W / 2}px, ${y - H / 2}px) scale(${scale})`,
      }"
    >
      <svg class="aro__lines" :width="W" :height="H">
        <path v-for="(d, i) in lines" :key="i" :d="d" />
      </svg>

      <button class="aro__close" :style="{ left: cx + 360 + 'px', top: cy - 150 + 'px' }" @click="emit('close')">
        Закрыть <q-icon name="sym_r_close" size="18px" />
      </button>

      <div
        class="aro__center"
        :class="`gender-${person.gender}`"
        :style="{ left: cx - CW / 2 + 'px', top: cy - CH / 2 + 'px', width: CW + 'px', height: CH + 'px' }"
      >
        <PersonAvatar :person="person" :size="54" />
        <div class="ellipsis-2-lines">
          <div class="text-weight-bold">{{ shortName(person) }}</div>
          <div class="text-caption text-muted">{{ lifeSpan(person) }}</div>
        </div>
      </div>

      <button
        v-for="(o, i) in options"
        :key="o.kind"
        class="aro__opt"
        :class="`gender-${o.gender}`"
        :style="{
          left: o.x - OW / 2 + 'px',
          top: o.y - OH / 2 + 'px',
          width: OW + 'px',
          height: OH + 'px',
          animationDelay: i * 25 + 'ms',
        }"
        @click="choose(o.kind)"
      >
        <PersonAvatar :gender="o.gender" :size="36" />
        <span class="aro__label">
          <span>{{ o.label }}</span>
          <small v-if="o.sub">{{ o.sub }}</small>
        </span>
        <q-icon name="sym_r_add" size="18px" class="aro__plus" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.aro {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: color-mix(in srgb, #0d1117 55%, transparent);
  backdrop-filter: blur(2px);
  animation: fade 0.18s ease-out;
  overflow: hidden;
}
.aro__stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: center center;
  pointer-events: none;
  > * {
    pointer-events: auto;
  }
}
.aro__lines {
  position: absolute;
  inset: 0;
  pointer-events: none !important;
  path {
    fill: none;
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }
}
.aro__center {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  border-radius: 16px;
  background: var(--ft-surface);
  border: 2px solid var(--g);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--g) 25%, transparent), var(--ft-shadow-lg);
  color: var(--ft-text);
}
.aro__opt {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 9px;
  border-radius: 14px;
  background: var(--ft-surface);
  border: 1.5px solid color-mix(in srgb, var(--g) 70%, transparent);
  color: var(--ft-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--ft-shadow);
  animation: pop 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
  transition:
    transform 0.15s,
    box-shadow 0.15s,
    background 0.15s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--ft-shadow-lg);
    background: var(--g-soft);
    .aro__plus {
      background: var(--ft-primary);
      color: #fff;
    }
  }
}
.aro__label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  small {
    font-weight: 400;
    font-size: 11.5px;
    color: var(--ft-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.aro__plus {
  border-radius: 50%;
  width: 26px;
  height: 26px;
  background: var(--ft-surface-2);
  color: var(--ft-muted);
  transition: 0.15s;
}
.aro__close {
  position: absolute;
  transform: translateX(-100%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  color: #fff;
  font: inherit;
  font-size: 15px;
  cursor: pointer;
  opacity: 0.9;
  &:hover {
    opacity: 1;
    text-decoration: underline;
  }
}
.aro__sheet {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 12px;
  border-radius: 20px;
  background: var(--ft-surface);
  box-shadow: var(--ft-shadow-lg);
  animation: pop 0.22s ease-out;
}
.aro__sheet-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 12px;
  color: var(--ft-text);
}
.aro__sheet-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.aro__opt--static {
  position: relative;
  height: 48px;
  text-transform: capitalize;
}
.aro__opt--wide {
  grid-column: span 2;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}
</style>
