<script setup lang="ts">
import { ref } from 'vue'
import { useTreeStore } from '@/stores/tree'

const model = defineModel<string>({ required: true })
defineProps<{ label?: string }>()
const store = useTreeStore()
const options = ref<string[]>([])

function filter(val: string, update: (fn: () => void) => void) {
  update(() => {
    const n = val.toLowerCase()
    options.value = store.places.filter((p) => p.toLowerCase().includes(n)).slice(0, 12)
  })
}
function onInput(v: string) {
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
