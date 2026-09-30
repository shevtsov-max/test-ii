<script setup>
/**
 * Выбор места из справочника с поиском по названию и другим названиям.
 * Новое место создаётся из введённого текста («Россия, Санкт-Петербург» — с иерархией).
 */
import { computed, ref } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { placeFullName } from '@/domain/places'
import { normalize } from '@/domain/search'
import { placeTypeInfo } from '@/domain/model'

const model = defineModel({ type: String, default: null })
defineProps({
  label: { type: String, default: 'Место' },
  dense: { type: Boolean, default: true },
})
const tree = useTreeStore()
const options = ref([])
const input = ref('')

const all = computed(() =>
  Object.values(tree.tree?.places ?? {})
    .map((p) => ({ value: p.id, label: p.name, full: placeFullName(tree.tree, p.id), icon: placeTypeInfo(p.type).icon, hay: normalize(`${p.name} ${p.altNames} ${placeFullName(tree.tree, p.id)}`) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
)

function filter(val, update) {
  update(() => {
    input.value = val
    const n = normalize(val)
    const list = n ? all.value.filter((o) => o.hay.includes(n)) : all.value
    options.value = list.slice(0, 40)
  })
}
function onNew(val, done) {
  const s = val.trim()
  if (!s) return done()
  const id = tree.ensurePlace(s)
  done(id, 'add-unique')
}
const display = computed(() => (model.value ? placeFullName(tree.tree, model.value) : ''))
</script>

<template>
  <q-select
    v-model="model"
    :options="options"
    option-value="value"
    option-label="label"
    emit-value
    map-options
    use-input
    fill-input
    hide-selected
    input-debounce="0"
    outlined
    clearable
    :dense="dense"
    :label="label"
    :display-value="display"
    new-value-mode="add-unique"
    popup-content-class="pin__popup"
    @filter="filter"
    @new-value="onNew"
  >
    <template #prepend><q-icon name="sym_r_location_on" size="19px" /></template>
    <template #option="s">
      <q-item v-bind="s.itemProps" dense>
        <q-item-section avatar style="min-width: 32px"><q-icon :name="s.opt.icon" size="18px" class="text-muted" /></q-item-section>
        <q-item-section>
          <q-item-label>{{ s.opt.label }}</q-item-label>
          <q-item-label v-if="s.opt.full !== s.opt.label" caption>{{ s.opt.full }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template #no-option>
      <q-item dense>
        <q-item-section class="text-muted">
          {{ input.trim() ? `Нажмите Enter, чтобы добавить «${input.trim()}»` : 'Мест пока нет — введите название' }}
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>
