<script setup>
/** Источник сведений: архивный документ, метрическая книга, перепись, книга, сайт, рассказ. */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { SOURCE_TYPES, newSource } from '@/domain/model'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.sourceDialog.open,
  set: (v) => (ui.sourceDialog.open = v),
})
const isNew = computed(() => !ui.sourceDialog.sourceId)
const src = ref(newSource())
watch(open, (o) => {
  if (!o) return
  const existing = tree.tree.sources[ui.sourceDialog.sourceId]
  src.value = existing ? JSON.parse(JSON.stringify(existing)) : newSource({ type: 'metric' })
})
const hints = {
  metric: { title: 'Метрическая книга Никольской церкви с. Манычское, 1880 г.', call: 'Ф. 135, оп. 2, д. 614' },
  revision: { title: 'Ревизская сказка 1858 г.', call: 'Ф. 444, оп. 1, д. 12' },
  census: { title: 'Всероссийская перепись 1897 г.', call: '' },
  archive: { title: 'Послужной список', call: 'Ф., оп., д., л.' },
  document: { title: 'Свидетельство о рождении', call: 'Серия, номер' },
  book: { title: 'Название книги', call: 'Страницы' },
  website: { title: 'ОБД «Мемориал», «Память народа»', call: '' },
  oral: { title: 'Воспоминания бабушки, записано в 2024 г.', call: '' },
  other: { title: 'Название источника', call: '' },
}
const hint = computed(() => hints[src.value.type] ?? hints.other)

function save() {
  if (!src.value.title.trim()) return $q.notify({ type: 'warning', message: 'Укажите название источника' })
  tree.saveSource({ ...src.value, title: src.value.title.trim() })
  open.value = false
  $q.notify({ type: 'positive', message: isNew.value ? 'Источник добавлен' : 'Источник сохранён', timeout: 1400 })
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card class="srd">
      <header class="srd__head">
        <div class="ft-h2 col">{{ isNew ? 'Новый источник' : 'Источник' }}</div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="srd__body">
        <div class="srd__types">
          <button v-for="t in SOURCE_TYPES" :key="t.value" type="button" :class="{ active: src.type === t.value }" @click="src.type = t.value">
            <q-icon :name="t.icon" size="16px" />
            {{ t.label }}
          </button>
        </div>
        <q-input v-model="src.title" outlined dense label="Название" :placeholder="hint.title" autofocus />
        <div class="srd__grid">
          <q-input v-model="src.repository" outlined dense label="Где хранится" placeholder="ГАСК, ЦГИА СПб, семейный архив…" />
          <q-input v-model="src.callNumber" outlined dense label="Шифр (фонд, опись, дело)" :placeholder="hint.call" />
        </div>
        <div class="srd__grid">
          <q-input v-model="src.author" outlined dense label="Автор, составитель" />
          <DateInput v-model="src.date" label="Дата документа" />
        </div>
        <q-input v-model="src.url" outlined dense label="Ссылка" type="url" placeholder="https://…" />
        <q-input v-model="src.note" outlined dense autogrow label="Заметка, расшифровка" />
      </div>
      <footer class="srd__foot">
        <q-space />
        <q-btn v-close-popup flat no-caps label="Отмена" />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.srd {
  width: 620px;
  max-width: 96vw;
}
.srd__head {
  display: flex;
  align-items: center;
  padding: 18px 18px 6px 22px;
}
.srd__body {
  padding: 8px 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.srd__types {
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
.srd__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.srd__foot {
  display: flex;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 600px) {
  .srd__grid {
    grid-template-columns: 1fr;
  }
}
</style>
