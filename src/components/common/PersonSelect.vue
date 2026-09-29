<script setup lang="ts">
import { computed, ref } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { lifeSpan, shortName, fullName } from '@/utils/person'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    label?: string
    placeholder?: string
    exclude?: string[]
    dense?: boolean
    clearable?: boolean
    autofocus?: boolean
    rounded?: boolean
  }>(),
  { exclude: () => [], placeholder: 'Поиск персоны…' },
)
const emit = defineEmits<{ 'update:modelValue': [string | null]; pick: [string] }>()
const store = useTreeStore()
const needle = ref('')

const all = computed(() =>
  store.persons
    .filter((p) => !props.exclude.includes(p.id))
    .map((p) => ({
      value: p.id,
      label: shortName(p),
      search: `${fullName(p, { middle: true })} ${p.birthName} ${p.nickname} ${p.birth.date.year ?? ''}`.toLowerCase(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
)
const options = ref(all.value)

function filter(val: string, update: (fn: () => void) => void) {
  update(() => {
    needle.value = val.toLowerCase().trim()
    const parts = needle.value.split(/\s+/).filter(Boolean)
    options.value = all.value.filter((o) => parts.every((p) => o.search.includes(p))).slice(0, 50)
  })
}

function onUpdate(v: string | null) {
  emit('update:modelValue', v)
  if (v) emit('pick', v)
}
</script>

<template>
  <q-select
    :model-value="modelValue ?? null"
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
    :dense="dense"
    :rounded="rounded"
    :label="label"
    :placeholder="modelValue ? undefined : placeholder"
    :clearable="clearable"
    :autofocus="autofocus"
    class="person-select"
    popup-content-class="person-select__popup"
    @filter="filter"
    @update:model-value="onUpdate"
  >
    <template #prepend>
      <q-icon name="sym_r_search" size="20px" />
    </template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps" dense>
        <q-item-section avatar>
          <PersonAvatar :person="store.person(scope.opt.value)" :size="32" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.label }}</q-item-label>
          <q-item-label caption>
            {{ lifeSpan(store.person(scope.opt.value)!) }}
            <template v-if="store.homeId && store.relationToHome(scope.opt.value)">
              · {{ store.relationToHome(scope.opt.value) }}
            </template>
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template #no-option>
      <q-item>
        <q-item-section class="text-muted">Никого не найдено</q-item-section>
      </q-item>
    </template>
  </q-select>
</template>
