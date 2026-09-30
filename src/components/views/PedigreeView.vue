<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ViewToolbar from './ViewToolbar.vue'
import PersonCard from '@/components/tree/PersonCard.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePhotoUpload } from '@/composables/usePhoto'
import { CARD_H } from '@/utils/layout'

const store = useTreeStore()
const ui = useUiStore()
const { upload } = usePhotoUpload()

const CW = 210
const CH = CARD_H
const GAP_X = 70
const GAP_Y = 34
const MAX = 5

const gens = computed(() => Math.min(store.ui.generations, MAX))

const layout = computed(() => {
  const focus = store.focusId
  if (!focus) return { slots: [], links: [], w: 0, h: 0 }
  const leaves = 2 ** gens.value
  const H = Math.max(leaves * (CH + GAP_Y), 400)
  const slots = []
  const links = []
  const byKey = new Map()

  const place = (gen, idx) => {
    const count = 2 ** gen
    const band = H / count
    return { x: gen * (CW + GAP_X), y: band * idx + band / 2 - CH / 2 }
  }

  const walk = (pid, gen, idx) => {
    const pos = place(gen, idx)
    const s = { key: `${gen}-${idx}`, gen, idx, personId: pid, ...pos }
    slots.push(s)
    byKey.set(s.key, s)
    if (gen >= gens.value) return
    const { father, mother, family } = store.parentsOf(pid)
    const full = (family?.partners.length ?? 0) >= 2
    const parents = [
      [father, 'father', idx * 2],
      [mother, 'mother', idx * 2 + 1],
    ]
    for (const [par, role, pidx] of parents) {
      const pp = place(gen + 1, pidx)
      if (par) walk(par, gen + 1, pidx)
      else if (!full) {
        const ph = { key: `${gen + 1}-${pidx}`, gen: gen + 1, idx: pidx, placeholder: { forId: pid, role }, ...pp }
        slots.push(ph)
      } else continue
      // связь
      const x1 = pos.x + CW
      const y1 = pos.y + CH / 2
      const x2 = pp.x
      const y2 = pp.y + CH / 2
      const mx = x1 + GAP_X / 2
      const r = Math.min(10, Math.abs(y2 - y1) / 2)
      const s2 = Math.sign(y2 - y1) || 1
      links.push(
        `M ${x1} ${y1} L ${mx - r} ${y1} Q ${mx} ${y1} ${mx} ${y1 + s2 * r} L ${mx} ${y2 - s2 * r} Q ${mx} ${y2} ${mx + r} ${y2} L ${x2} ${y2}`,
      )
    }
  }
  walk(focus, 0, 0)
  return { slots, links, w: (gens.value + 1) * (CW + GAP_X), h: H }
})

// Потомки центральной персоны — слева, компактным списком
const children = computed(() => (store.focusId ? store.childrenOf(store.focusId) : []))

function openAdd(id) {
  store.setFocus(id)
  store.ui.view = 'family'
  setTimeout(() => (ui.addOverlayFor = id), 350)
}

const scroller = ref()
function centerFocus() {
  const el = scroller.value
  if (!el) return
  el.scrollTo({ top: (layout.value.h - el.clientHeight) / 2 + 40, left: 0, behavior: 'smooth' })
}
onMounted(() => nextTick(centerFocus))
watch(
  () => store.focusId,
  () => nextTick(centerFocus),
)
</script>

<template>
  <div class="column no-wrap fit">
    <ViewToolbar :max-gen="MAX" />
    <div ref="scroller" class="col pv ft-scroll">
      <div class="pv__inner" :style="{ width: layout.w + 260 + 'px', height: layout.h + 80 + 'px' }">
        <div v-if="children.length" class="pv__kids" :style="{ top: layout.h / 2 + 40 - 20 - children.length * 22 + 'px' }">
          <div class="ft-section-title q-mb-xs">Дети</div>
          <button v-for="c in children" :key="c" class="pv__kid" :class="`gender-${store.person(c)?.gender}`" @click="store.setFocus(c)">
            <q-icon name="sym_r_arrow_back" size="14px" />
            {{ store.person(c)?.firstName }} {{ store.person(c)?.lastName }}
          </button>
        </div>
        <div class="pv__stage" :style="{ left: '240px', top: '40px' }">
          <svg class="pv__links" :width="layout.w" :height="layout.h">
            <path v-for="(d, i) in layout.links" :key="i" :d="d" />
          </svg>
          <div
            v-for="s in layout.slots"
            :key="s.key"
            class="pv__slot"
            :style="{ left: s.x + 'px', top: s.y + 'px', width: CW + 'px', height: CH + 'px' }"
          >
            <PersonCard
              v-if="s.personId && store.person(s.personId)"
              :person="store.person(s.personId)"
              :selected="store.selectedId === s.personId"
              :focus="s.gen === 0"
              :home="store.homeId === s.personId"
              @select="store.select(s.personId)"
              @open="store.setFocus(s.personId)"
              @edit="ui.editPerson(s.personId)"
              @add="openAdd(s.personId)"
              @camera="upload(s.personId, { avatar: true })"
            />
            <button
              v-else-if="s.placeholder"
              class="pv__ph"
              :class="s.placeholder.role === 'father' ? 'gender-M' : 'gender-F'"
              @click="ui.addRelative(s.placeholder.forId, s.placeholder.role)"
            >
              <q-icon name="sym_r_add" size="18px" />
              Добавить {{ s.placeholder.role === 'father' ? 'отца' : 'мать' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pv {
  overflow: auto;
  background-color: var(--ft-canvas);
  background-image: radial-gradient(var(--ft-dot) 1.2px, transparent 1.3px);
  background-size: 24px 24px;
}
.pv__inner {
  position: relative;
}
.pv__stage {
  position: absolute;
}
.pv__links {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  path {
    fill: none;
    stroke: var(--ft-line);
    stroke-width: 1.6;
  }
}
.pv__slot {
  position: absolute;
  animation: fadeIn 0.3s ease-out;
}
.pv__ph {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  border: 1.5px dashed color-mix(in srgb, var(--g) 60%, var(--ft-line));
  background: color-mix(in srgb, var(--ft-surface) 60%, transparent);
  color: var(--ft-muted);
  font: inherit;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: 0.15s;
  &:hover {
    border-style: solid;
    color: var(--g);
    border-color: var(--g);
    background: var(--ft-surface);
  }
}
.pv__kids {
  position: absolute;
  left: 20px;
  width: 190px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pv__kid {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--g) 50%, transparent);
  background: var(--ft-surface);
  color: var(--ft-text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    border-color: var(--g);
    box-shadow: var(--ft-shadow);
  }
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
}
</style>
