<script setup>
/** Место: название, тип, в составе чего, координаты, другие названия. */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { PLACE_TYPES, newPlace } from '@/domain/model'
import { placeDescendants, placeMapUrl } from '@/domain/places'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.placeDialog.open,
  set: (v) => (ui.placeDialog.open = v),
})
const isNew = computed(() => !ui.placeDialog.placeId)
const pl = ref(newPlace())
watch(open, (o) => {
  if (!o) return
  const existing = tree.tree.places[ui.placeDialog.placeId]
  pl.value = existing ? { ...existing } : newPlace({ parentId: ui.placeDialog.parentId ?? null })
})
const invalidParent = computed(() => !!pl.value.parentId && !isNew.value && placeDescendants(tree.tree, pl.value.id).has(pl.value.parentId))
const coord = (v) => {
  const n = v === '' || v === null ? null : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function save() {
  if (!pl.value.name.trim()) return $q.notify({ type: 'warning', message: 'Укажите название' })
  if (invalidParent.value) return $q.notify({ type: 'warning', message: 'Место не может входить само в себя' })
  tree.savePlace({ ...pl.value, name: pl.value.name.trim() })
  open.value = false
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card class="pld">
      <header class="pld__head">
        <div class="ft-h2 col">{{ isNew ? 'Новое место' : 'Место' }}</div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="pld__body">
        <q-input v-model="pl.name" outlined dense label="Название" autofocus />
        <div class="pld__types">
          <button v-for="t in PLACE_TYPES" :key="t.value" type="button" :class="{ active: pl.type === t.value }" @click="pl.type = t.value">
            <q-icon :name="t.icon" size="16px" />
            {{ t.label }}
          </button>
        </div>
        <PlaceInput v-model="pl.parentId" label="Входит в (страна, регион, район…)" :error="invalidParent" />
        <q-input v-model="pl.altNames" outlined dense label="Другие названия" hint="Через запятую, например: Петроград, Ленинград" />
        <div class="pld__grid">
          <q-input :model-value="pl.lat ?? ''" outlined dense label="Широта" placeholder="59.9386" @update:model-value="(v) => (pl.lat = coord(v))" />
          <q-input :model-value="pl.lng ?? ''" outlined dense label="Долгота" placeholder="30.3141" @update:model-value="(v) => (pl.lng = coord(v))" />
        </div>
        <q-input v-model="pl.note" outlined dense autogrow label="Заметка" />
        <a v-if="!isNew && pl.name" :href="placeMapUrl({ ...tree.tree, places: { ...tree.tree.places, [pl.id]: pl } }, pl.id)" target="_blank" rel="noopener" class="pld__map">
          <q-icon name="sym_r_map" size="16px" /> Открыть на карте
        </a>
      </div>
      <footer class="pld__foot">
        <q-space />
        <q-btn v-close-popup flat no-caps label="Отмена" />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.pld {
  width: 540px;
  max-width: 96vw;
}
.pld__head {
  display: flex;
  align-items: center;
  padding: 18px 18px 6px 22px;
}
.pld__body {
  padding: 8px 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pld__types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
    &.active {
      border-color: var(--ft-primary);
      background: var(--ft-primary-soft);
      color: var(--ft-primary-text);
    }
  }
}
.pld__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.pld__map {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.pld__foot {
  display: flex;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
</style>
