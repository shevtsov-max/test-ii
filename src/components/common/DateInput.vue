<script setup>
import { computed } from 'vue'
import { MONTHS, QUALIFIERS } from '@/utils/person'

const model = defineModel({ type: Object, required: true })
defineProps({ label: String })

const days = [{ label: 'День', value: null }, ...Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: i + 1 }))]
const months = [{ label: 'Месяц', value: null }, ...MONTHS.map((m, i) => ({ label: m, value: i + 1 }))]
const qualifiers = QUALIFIERS.map((q) => ({ label: q.label, value: q.value }))
const between = computed(() => model.value.qualifier === 'between')

function setYear(key, v) {
  const n = v === null || v === '' ? null : Number(v)
  model.value = { ...model.value, [key]: Number.isFinite(n) ? n : null }
}
function set(key, v) {
  model.value = { ...model.value, [key]: v }
}
</script>

<template>
  <div class="di">
    <div v-if="label" class="di__label">{{ label }}</div>
    <div class="di__row">
      <q-select
        :model-value="model.qualifier"
        :options="qualifiers"
        emit-value
        map-options
        outlined
        dense
        options-dense
        class="di__q"
        @update:model-value="(v) => set('qualifier', v)"
      />
      <q-select
        :model-value="model.day ?? null"
        :options="days"
        emit-value
        map-options
        outlined
        dense
        options-dense
        class="di__d"
        :display-value="model.day ?? 'День'"
        :class="{ 'di__empty': !model.day }"
        @update:model-value="(v) => set('day', v)"
      />
      <q-select
        :model-value="model.month ?? null"
        :options="months"
        emit-value
        map-options
        outlined
        dense
        options-dense
        class="di__m"
        :display-value="model.month ? MONTHS[model.month - 1] : 'Месяц'"
        :class="{ 'di__empty': !model.month }"
        @update:model-value="(v) => set('month', v)"
      />
      <q-input
        :model-value="model.year ?? ''"
        outlined
        dense
        type="number"
        placeholder="Год"
        class="di__y"
        :rules="[(v) => !v || (v > 0 && v < 3000) || '']"
        hide-bottom-space
        @update:model-value="(v) => setYear('year', v)"
      />
    </div>
    <div v-if="between" class="di__row q-mt-xs">
      <div class="di__q di__and">и</div>
      <q-select
        :model-value="model.day2 ?? null"
        :options="days"
        emit-value
        map-options
        outlined
        dense
        options-dense
        class="di__d"
        :display-value="model.day2 ?? 'День'"
        @update:model-value="(v) => set('day2', v)"
      />
      <q-select
        :model-value="model.month2 ?? null"
        :options="months"
        emit-value
        map-options
        outlined
        dense
        options-dense
        class="di__m"
        :display-value="model.month2 ? MONTHS[model.month2 - 1] : 'Месяц'"
        @update:model-value="(v) => set('month2', v)"
      />
      <q-input
        :model-value="model.year2 ?? ''"
        outlined
        dense
        type="number"
        placeholder="Год"
        class="di__y"
        @update:model-value="(v) => setYear('year2', v)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.di__label {
  font-size: 12.5px;
  color: var(--ft-muted);
  margin-bottom: 4px;
}
.di__row {
  display: flex;
  gap: 6px;
}
.di__q {
  width: 128px;
  flex: none;
}
.di__d {
  width: 92px;
  flex: none;
}
.di__m {
  flex: 1;
  min-width: 96px;
}
.di__y {
  width: 84px;
  flex: none;
}
.di__and {
  display: grid;
  place-items: center end;
  padding-right: 8px;
  color: var(--ft-muted);
}
.di__empty :deep(.q-field__native) {
  color: var(--ft-muted);
}
@media (max-width: 480px) {
  .di__row {
    flex-wrap: wrap;
  }
  .di__q {
    width: 100%;
  }
}
</style>
