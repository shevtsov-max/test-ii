<script setup>
/** Выбор рода (с созданием нового). */
import { computed, ref } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { CLAN_COLORS, newClan } from '@/domain/model'

const model = defineModel({ type: String, default: null })
defineProps({ label: { type: String, default: 'Род' } })
const tree = useTreeStore()
const options = computed(() =>
  Object.values(tree.tree?.clans ?? {})
    .map((c) => ({ value: c.id, label: c.name, color: c.color }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
)
const filtered = ref([])
function filter(val, update) {
  update(() => {
    const n = val.toLowerCase()
    filtered.value = options.value.filter((o) => o.label.toLowerCase().includes(n))
  })
}
function onNew(val, done) {
  const name = val.trim()
  if (!name) return done()
  const c = newClan({ name, color: CLAN_COLORS[Object.keys(tree.tree.clans).length % CLAN_COLORS.length] })
  tree.saveClan(c)
  done(c.id, 'add-unique')
}
const current = computed(() => options.value.find((o) => o.value === model.value))
</script>

<template>
  <q-select
    v-model="model"
    :options="filtered"
    emit-value
    map-options
    use-input
    fill-input
    hide-selected
    input-debounce="0"
    outlined
    dense
    clearable
    :label="label"
    new-value-mode="add-unique"
    :display-value="current?.label ?? ''"
    @filter="filter"
    @new-value="onNew"
  >
    <template #prepend>
      <span class="cls__dot" :style="{ background: current?.color ?? 'var(--ft-border-strong)' }" />
    </template>
    <template #option="s">
      <q-item v-bind="s.itemProps" dense>
        <q-item-section avatar style="min-width: 26px"><span class="cls__dot" :style="{ background: s.opt.color }" /></q-item-section>
        <q-item-section>{{ s.opt.label }}</q-item-section>
      </q-item>
    </template>
    <template #no-option>
      <q-item dense><q-item-section class="text-muted">Введите название нового рода и нажмите Enter</q-item-section></q-item>
    </template>
  </q-select>
</template>

<style scoped>
.cls__dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 4px;
}
</style>
