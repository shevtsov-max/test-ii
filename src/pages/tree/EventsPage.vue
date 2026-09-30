<script setup>
/** События — летопись семьи: рождения, браки, смерти и события жизни по годам. */
import { computed, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { allEvents } from '@/domain/stats'
import { formatDate } from '@/domain/dates'
import { placeDescendants, placeFullName } from '@/domain/places'
import { shortName } from '@/domain/names'
import { normalize } from '@/domain/search'

const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()

const KINDS = [
  { value: 'birth', label: 'Рождения', icon: 'sym_r_child_friendly' },
  { value: 'marriage', label: 'Браки', icon: 'sym_r_favorite' },
  { value: 'death', label: 'Смерти', icon: 'sym_r_deceased' },
  { value: 'life', label: 'События жизни', icon: 'sym_r_event_note' },
]
const kinds = ref(['birth', 'marriage', 'death', 'life'])
const q = ref('')
const placeId = ref(null)
const lineage = ref(false)
const undated = ref(false)
const limit = ref(300)

const events = computed(() => allEvents(tree.graph))
const years = computed(() => {
  const ys = events.value.map((e) => e.date.year).filter(Boolean)
  return ys.length ? { min: Math.min(...ys), max: Math.max(...ys) } : { min: 1800, max: new Date().getFullYear() }
})
const range = ref(null)
const rangeValue = computed({
  get: () => range.value ?? { min: years.value.min, max: years.value.max },
  set: (v) => (range.value = v),
})

const filtered = computed(() => {
  const n = normalize(q.value)
  const places = placeId.value ? placeDescendants(tree.tree, placeId.value) : null
  const line = lineage.value && tree.homeId ? tree.graph.lineage(tree.homeId) : null
  const r = rangeValue.value
  return events.value.filter((e) => {
    const k = ['birth', 'marriage', 'death'].includes(e.kind) ? e.kind : e.kind === 'divorce' ? 'marriage' : 'life'
    if (!kinds.value.includes(k)) return false
    if (!e.date.year && !undated.value) return false
    if (e.date.year && (e.date.year < r.min || e.date.year > r.max)) return false
    if (places && !places.has(e.placeId)) return false
    if (line && !e.personIds.some((id) => line.has(id))) return false
    if (n) {
      const hay = normalize([e.title, e.description, ...e.personIds.map((id) => shortName(tree.person(id))), placeFullName(tree.tree, e.placeId)].join(' '))
      if (!hay.includes(n)) return false
    }
    return true
  })
})

const groups = computed(() => {
  const out = []
  for (const e of filtered.value.slice(0, limit.value)) {
    const key = e.date.year ? `${Math.floor(e.date.year / 10) * 10}-е` : 'Без даты'
    let g = out.at(-1)
    if (!g || g.key !== key) out.push((g = { key, items: [] }))
    g.items.push(e)
  }
  return out
})

function open(e) {
  if (e.eventId) ui.editEvent(e.personIds[0], e.eventId)
  else if (e.familyId) ui.editFamily(e.familyId)
  else nav.openPerson(e.personIds[0])
}
const toggleKind = (k) => (kinds.value = kinds.value.includes(k) ? kinds.value.filter((x) => x !== k) : [...kinds.value, k])
</script>

<template>
  <div class="ft-page evp">
    <PageHeader title="События" icon="sym_r_event_note" :subtitle="`Летопись семьи: ${filtered.length} из ${events.length} событий`" />

    <div class="evp__filters ft-card">
      <div class="evp__kinds">
        <button v-for="k in KINDS" :key="k.value" type="button" :class="{ active: kinds.includes(k.value) }" @click="toggleKind(k.value)">
          <q-icon :name="k.icon" size="16px" />{{ k.label }}
        </button>
      </div>
      <div class="evp__row">
        <q-input v-model="q" dense outlined clearable placeholder="Поиск по людям, событиям, местам" class="evp__search" debounce="150">
          <template #prepend><q-icon name="sym_r_search" size="19px" /></template>
        </q-input>
        <PlaceInput v-model="placeId" label="Место (включая вложенные)" class="evp__place" />
        <q-toggle v-model="lineage" label="Только прямая линия «Это Вы»" dense />
        <q-toggle v-model="undated" label="С неизвестной датой" dense />
      </div>
      <div class="evp__range">
        <span class="tabular">{{ rangeValue.min }}</span>
        <q-range v-model="rangeValue" :min="years.min" :max="years.max" :step="1" label color="primary" class="col" />
        <span class="tabular">{{ rangeValue.max }}</span>
      </div>
    </div>

    <div v-if="groups.length" class="evp__list">
      <section v-for="g in groups" :key="g.key" class="evp__group">
        <h2 class="evp__decade">{{ g.key }}</h2>
        <div class="evp__items">
          <button v-for="e in g.items" :key="e.key" type="button" class="evp__item" @click="open(e)">
            <span class="evp__date tabular">{{ formatDate(e.date, 'numeric') || '—' }}</span>
            <span class="evp__icon" :class="`evp__icon--${e.kind}`"><q-icon :name="e.icon" size="16px" /></span>
            <span class="evp__body">
              <span class="evp__title">
                {{ e.title }}
                <span v-if="e.description" class="text-muted"> — {{ e.description }}</span>
              </span>
              <span class="evp__people">
                <router-link v-for="id in e.personIds" :key="id" :to="nav.personRoute(id)" class="evp__person" @click.stop>
                  <PersonAvatar :person="tree.person(id)" :size="20" />{{ shortName(tree.person(id)) }}
                </router-link>
                <span v-if="e.placeId" class="evp__place-name"><q-icon name="sym_r_location_on" size="14px" />{{ placeFullName(tree.tree, e.placeId) }}</span>
              </span>
            </span>
          </button>
        </div>
      </section>
      <div v-if="filtered.length > limit" class="text-center q-my-lg">
        <q-btn outline no-caps color="primary" :label="`Показать ещё (${filtered.length - limit})`" @click="limit += 300" />
      </div>
    </div>
    <EmptyState v-else icon="sym_r_event_busy" title="Событий не найдено" text="Измените фильтры или добавьте события в профилях людей." />
  </div>
</template>

<style scoped lang="scss">
.evp__filters {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}
.evp__kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-muted);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    &.active {
      background: var(--ft-primary-soft);
      border-color: var(--ft-primary);
      color: var(--ft-primary-text);
    }
  }
}
.evp__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
}
.evp__search {
  width: 300px;
}
.evp__place {
  width: 280px;
}
.evp__range {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 6px;
  font-size: 12.5px;
  color: var(--ft-muted);
}
.evp__group + .evp__group {
  margin-top: 18px;
}
.evp__decade {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0 0 6px;
  padding: 6px 0;
  font-size: 15px;
  font-weight: 750;
  background: var(--ft-bg);
  font-family: var(--ft-font-display);
}
.evp__items {
  display: flex;
  flex-direction: column;
  border-left: 2px solid var(--ft-border);
  margin-left: 58px;
}
.evp__item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 10px 8px 0;
  margin-left: -72px;
  border: 0;
  background: none;
  font: inherit;
  color: var(--ft-text);
  text-align: left;
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    background: var(--ft-surface);
  }
}
.evp__date {
  width: 58px;
  flex: none;
  text-align: right;
  font-size: 12px;
  color: var(--ft-muted);
  padding-top: 5px;
}
.evp__icon {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--ft-surface-3);
  color: var(--ft-text-2);
  box-shadow: 0 0 0 3px var(--ft-bg);
}
.evp__icon--birth {
  background: var(--ft-positive-soft);
  color: var(--ft-positive);
}
.evp__icon--marriage {
  background: var(--ft-primary-soft);
  color: var(--ft-primary);
}
.evp__icon--death {
  background: var(--ft-surface-3);
  color: var(--ft-muted);
}
.evp__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.evp__title {
  font-weight: 600;
}
.evp__people {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
}
.evp__person {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ft-text-2);
}
.evp__place-name {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--ft-muted);
}
</style>
