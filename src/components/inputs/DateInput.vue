<script setup>
/**
 * Ввод даты одной строкой: «13.05.1991», «май 1991», «ок. 1880», «1880-е», «между 1880 и 1885»,
 * «6.05.1868 ст. ст.». Под полем — как дата понята. Кнопка «…» — подробный ввод.
 */
import { computed, ref, watch } from 'vue'
import { MONTHS, QUALIFIERS, dateToInput, emptyDate, formatDate, hasDate, parseDateText } from '@/domain/dates'

const model = defineModel({ type: Object, default: () => emptyDate() })
const props = defineProps({
  label: { type: String, default: 'Дата' },
  dense: { type: Boolean, default: true },
  autofocus: Boolean,
})

const text = ref(dateToInput(model.value))
const focused = ref(false)
const popup = ref(false)
watch(model, (v) => {
  if (!focused.value) text.value = dateToInput(v)
})

const parsed = computed(() => {
  const s = text.value.trim()
  if (!s) return { empty: true }
  const d = parseDateText(s)
  return d ? { date: d } : { error: true }
})
const hint = computed(() => {
  if (parsed.value.empty) return 'Например: 13.05.1991, май 1991, ок. 1880, 1880-е'
  if (parsed.value.error) return 'Не похоже на дату — сохранится как текст'
  const f = formatDate(parsed.value.date)
  return f
})

function commit() {
  const s = text.value.trim()
  if (!s) model.value = emptyDate()
  else if (parsed.value.date) model.value = parsed.value.date
  else model.value = { ...emptyDate(), text: s }
}
function onBlur() {
  focused.value = false
  commit()
  text.value = dateToInput(model.value)
}

// Подробный ввод
const draft = ref(emptyDate())
watch(popup, (o) => {
  if (o) {
    commit()
    draft.value = { ...emptyDate(), ...model.value }
  }
})
const months = [{ label: '—', value: null }, ...MONTHS.map((m, i) => ({ label: m.charAt(0).toUpperCase() + m.slice(1), value: i + 1 }))]
const qualifiers = QUALIFIERS.map((q) => ({ label: q.label, value: q.value }))
const num = (v) => {
  const n = v === '' || v === null ? null : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}
function applyDraft() {
  const d = { ...draft.value }
  if (d.qualifier !== 'between') {
    delete d.day2
    delete d.month2
    delete d.year2
  }
  if (!d.calendar) delete d.calendar
  delete d.text
  model.value = d
  text.value = dateToInput(d)
  popup.value = false
}
const preview = computed(() => (hasDate(draft.value) ? formatDate(draft.value) : '—'))
</script>

<template>
  <q-input
    v-model="text"
    outlined
    :dense="dense"
    :label="label"
    :autofocus="autofocus"
    :hint="focused || parsed.error ? hint : hasDate(model) && model.calendar === 'julian' ? formatDate(model) : undefined"
    :error="false"
    class="din"
    :class="{ 'din--warn': parsed.error && !focused }"
    @focus="focused = true"
    @blur="onBlur"
    @keydown.enter="commit"
  >
    <template #prepend><q-icon name="sym_r_calendar_month" size="19px" /></template>
    <template #append>
      <q-btn flat round dense size="sm" icon="sym_r_more_horiz" class="text-muted" :aria-label="`Подробно: ${label}`" @click.stop="popup = true">
        <q-tooltip>Точность, интервал, старый стиль</q-tooltip>
      </q-btn>
    </template>
    <q-menu v-model="popup" no-parent-event anchor="bottom left" self="top left" :offset="[0, 4]">
      <div class="din__pop">
        <div class="din__row">
          <q-select v-model="draft.qualifier" :options="qualifiers" emit-value map-options outlined dense options-dense label="Точность" class="din__q" />
          <q-toggle v-model="draft.calendar" true-value="julian" :false-value="undefined" label="Старый стиль" dense />
        </div>
        <div class="din__row">
          <q-input :model-value="draft.day ?? ''" outlined dense type="number" label="День" class="din__d" @update:model-value="(v) => (draft.day = num(v))" />
          <q-select v-model="draft.month" :options="months" emit-value map-options outlined dense options-dense label="Месяц" class="din__m" />
          <q-input :model-value="draft.year ?? ''" outlined dense type="number" label="Год" class="din__y" @update:model-value="(v) => (draft.year = num(v))" />
        </div>
        <div v-if="draft.qualifier === 'between'" class="din__row">
          <q-input :model-value="draft.day2 ?? ''" outlined dense type="number" label="День" class="din__d" @update:model-value="(v) => (draft.day2 = num(v))" />
          <q-select v-model="draft.month2" :options="months" emit-value map-options outlined dense options-dense label="Месяц" class="din__m" />
          <q-input :model-value="draft.year2 ?? ''" outlined dense type="number" label="Год" class="din__y" @update:model-value="(v) => (draft.year2 = num(v))" />
        </div>
        <div class="din__preview">
          <span class="text-muted">Будет записано:</span> <b>{{ preview }}</b>
        </div>
        <div class="text-muted din__help">
          Старый стиль — юлианский календарь, в России до февраля 1918 г. Дата будет показана с новым стилем в скобках.
        </div>
        <div class="din__actions">
          <q-btn v-close-popup flat no-caps label="Отмена" />
          <q-btn unelevated no-caps color="primary" label="Готово" @click="applyDraft" />
        </div>
      </div>
    </q-menu>
  </q-input>
</template>

<style scoped lang="scss">
.din--warn :deep(.q-field__control:before) {
  border-color: var(--ft-warning);
}
.din__pop {
  width: 380px;
  max-width: 94vw;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.din__row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.din__q {
  flex: 1;
}
.din__d {
  width: 76px;
}
.din__m {
  flex: 1;
}
.din__y {
  width: 90px;
}
.din__preview {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--ft-surface-2);
  font-size: 13px;
}
.din__help {
  font-size: 12px;
}
.din__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
