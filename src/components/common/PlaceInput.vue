<script setup>
import { ref } from 'vue'
import { useTreeStore } from '@/stores/tree'

const model = defineModel({ type: String, required: true })
defineProps({ label: String })
const store = useTreeStore()
const options = ref([])

function filter(val, update) {
  update(() => {
    const n = val.toLowerCase()
    options.value = store.places.filter((p) => p.toLowerCase().includes(n)).slice(0, 12)
  })
}
function onInput(v) {
  model.value = v
}
</script>

<template>
  <q-select
    :model-value="model"
    :options="options"
    :label="label"
    outlined
    dense
    use-input
    hide-selected
    fill-input
    input-debounce="0"
    hide-dropdown-icon
    new-value-mode="add-unique"
    @filter="filter"
    @input-value="onInput"
    @update:model-value="(v) => (model = v ?? '')"
  >
    <template #prepend><q-icon name="sym_r_location_on" size="18px" /></template>
  </q-select>
</template>
