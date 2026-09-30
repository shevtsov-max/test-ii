<script setup>
import { ref } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { searchPersons } from '@/domain/search'
import { shortName, fullName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'

const props = defineProps({
  modelValue: { type: String, default: null },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Начните вводить имя…' },
  exclude: { type: Array, default: () => [] },
  dense: Boolean,
  clearable: Boolean,
  autofocus: Boolean,
  icon: { type: String, default: 'sym_r_search' },
  gender: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'pick'])
const tree = useTreeStore()
const options = ref([])

function filter(val, update) {
  update(() => {
    const list = searchPersons(tree.tree, val, 60)
      .map((r) => r.person)
      .filter((p) => !props.exclude.includes(p.id))
    const g = props.gender
    options.value = (g ? [...list.filter((p) => p.gender === g || p.gender === 'U'), ...list.filter((p) => p.gender !== g && p.gender !== 'U')] : list).map(
      (p) => ({ value: p.id, label: shortName(p) }),
    )
  })
}
function onUpdate(v) {
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
    :label="label || undefined"
    :placeholder="modelValue ? undefined : placeholder"
    :clearable="clearable"
    :autofocus="autofocus"
    popup-content-class="ps__popup"
    @filter="filter"
    @update:model-value="onUpdate"
  >
    <template #prepend>
      <PersonAvatar v-if="modelValue && tree.person(modelValue)" :person="tree.person(modelValue)" :size="24" />
      <q-icon v-else :name="icon" size="20px" />
    </template>
    <template #option="scope">
      <q-item v-bind="scope.itemProps" dense class="q-py-xs">
        <q-item-section avatar style="min-width: 44px">
          <PersonAvatar :person="tree.person(scope.opt.value)" :size="32" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="fw-500">{{ fullName(tree.person(scope.opt.value)) }}</q-item-label>
          <q-item-label caption>
            {{ [lifeSpan(tree.person(scope.opt.value)), tree.relationToHome(scope.opt.value)].filter(Boolean).join(' · ') }}
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
