<script setup>
/**
 * Ссылки на источники: какой источник, лист/страница, достоверность, примечание.
 */
import { computed } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { CITATION_QUALITY, newCitation, sourceTypeInfo } from '@/domain/model'

const model = defineModel({ type: Array, default: () => [] })
defineProps({ title: { type: String, default: '' } })
const tree = useTreeStore()
const ui = useUiStore()

const sources = computed(() =>
  Object.values(tree.tree?.sources ?? {})
    .map((s) => ({ value: s.id, label: s.title || 'Без названия', icon: sourceTypeInfo(s.type).icon, caption: [s.repository, s.callNumber].filter(Boolean).join(' · ') }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru')),
)
const add = () => (model.value = [...model.value, newCitation({ sourceId: sources.value[0]?.value ?? '' })])
const update = (i, patch) => (model.value = model.value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
const remove = (i) => (model.value = model.value.filter((_, j) => j !== i))
</script>

<template>
  <div class="cit">
    <div v-if="title" class="ft-label q-mb-xs">{{ title }}</div>
    <div v-for="(c, i) in model" :key="c.id" class="cit__row">
      <q-select
        :model-value="c.sourceId || null"
        :options="sources"
        emit-value
        map-options
        outlined
        dense
        label="Источник"
        class="cit__src"
        @update:model-value="(v) => update(i, { sourceId: v })"
      >
        <template #option="s">
          <q-item v-bind="s.itemProps" dense>
            <q-item-section avatar style="min-width: 32px"><q-icon :name="s.opt.icon" size="18px" /></q-item-section>
            <q-item-section>
              <q-item-label>{{ s.opt.label }}</q-item-label>
              <q-item-label v-if="s.opt.caption" caption>{{ s.opt.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
      <q-input :model-value="c.page" outlined dense label="Лист, запись" class="cit__page" @update:model-value="(v) => update(i, { page: v })" />
      <q-select
        :model-value="c.quality"
        :options="CITATION_QUALITY"
        option-value="value"
        option-label="label"
        emit-value
        map-options
        outlined
        dense
        label="Достоверность"
        class="cit__q"
        @update:model-value="(v) => update(i, { quality: v })"
      />
      <q-btn flat round dense icon="sym_r_delete" class="text-muted" aria-label="Убрать" @click="remove(i)" />
      <q-input :model-value="c.note" outlined dense autogrow label="Примечание, цитата" class="cit__note" @update:model-value="(v) => update(i, { note: v })" />
    </div>
    <div class="cit__actions">
      <q-btn v-if="sources.length" flat dense no-caps color="primary" icon="sym_r_add" label="Сослаться на источник" @click="add" />
      <q-btn flat dense no-caps color="primary" icon="sym_r_add_notes" label="Новый источник" @click="ui.editSource()" />
      <span v-if="!sources.length" class="text-muted" style="font-size: 12.5px">Сначала добавьте источник: метрическую книгу, перепись, документ…</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cit__row {
  display: grid;
  grid-template-columns: 1fr 140px 170px 32px;
  gap: 6px;
  align-items: start;
  padding: 10px;
  border-radius: 12px;
  background: var(--ft-surface-2);
  border: 1px solid var(--ft-border);
  margin-bottom: 8px;
}
.cit__note {
  grid-column: 1 / 4;
}
.cit__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
@media (max-width: 640px) {
  .cit__row {
    grid-template-columns: 1fr 32px;
  }
  .cit__page,
  .cit__q,
  .cit__note {
    grid-column: 1 / 2;
  }
}
</style>
