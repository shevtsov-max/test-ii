<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Fact, FactType } from '@/types'
import DateInput from '@/components/common/DateInput.vue'
import PlaceInput from '@/components/common/PlaceInput.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { emptyDate, FACT_TYPES, shortName, uid } from '@/utils/person'

const store = useTreeStore()
const ui = useUiStore()

const open = computed({
  get: () => ui.factDialog.open,
  set: (v) => (ui.factDialog.open = v),
})
const person = computed(() => store.person(ui.factDialog.personId))
const isNew = computed(() => !ui.factDialog.factId)
const fact = ref<Fact>({ id: '', type: 'occupation', date: emptyDate(), place: '', description: '' })

watch(
  () => ui.factDialog.open,
  (o) => {
    if (!o) return
    const existing = person.value?.facts.find((f) => f.id === ui.factDialog.factId)
    fact.value = existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: uid('fa'), type: 'occupation', title: '', date: emptyDate(), place: '', description: '' }
  },
)

const HINTS: Partial<Record<FactType, string>> = {
  education: 'Учебное заведение, специальность',
  occupation: 'Должность, место работы',
  residence: 'Адрес или описание',
  military: 'Род войск, звание, часть',
  award: 'Название награды',
  religion: 'Вероисповедание',
  nationality: 'Национальность',
  baptism: 'Храм, крёстные',
  burial: 'Кладбище, участок',
}
const hint = computed(() => HINTS[fact.value.type] ?? 'Описание')

function save() {
  if (!person.value) return
  store.saveFact(person.value.id, fact.value)
  open.value = false
}
function remove() {
  if (!person.value) return
  store.removeFact(person.value.id, fact.value.id)
  open.value = false
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card v-if="person" style="width: 560px; max-width: 96vw">
      <q-card-section class="row items-center no-wrap">
        <div class="col">
          <div class="text-h6 text-weight-bold">{{ isNew ? 'Новый факт' : 'Изменить факт' }}</div>
          <div class="text-caption text-muted">{{ shortName(person) }}</div>
        </div>
        <q-btn flat round dense icon="sym_r_close" v-close-popup />
      </q-card-section>
      <q-card-section class="q-pt-none q-gutter-y-md">
        <div class="fact-types">
          <button
            v-for="t in FACT_TYPES"
            :key="t.value"
            type="button"
            :class="{ active: fact.type === t.value }"
            @click="fact.type = t.value"
          >
            <q-icon :name="t.icon" size="18px" />
            <span>{{ t.label }}</span>
          </button>
        </div>
        <q-input v-if="fact.type === 'custom'" v-model="fact.title" outlined dense label="Название события" />
        <q-input v-model="fact.description" outlined dense :label="hint" autofocus />
        <DateInput v-model="fact.date" label="Дата" />
        <PlaceInput v-model="fact.place" label="Место" />
      </q-card-section>
      <q-card-actions class="q-px-md q-pb-md">
        <q-btn v-if="!isNew" flat no-caps color="negative" icon="sym_r_delete" label="Удалить" class="q-mr-auto" @click="remove" />
        <q-btn flat no-caps label="Отмена" color="grey-8" v-close-popup />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.fact-types {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
  button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: 0.15s;
    .q-icon {
      color: var(--ft-muted);
    }
    &:hover {
      border-color: var(--ft-primary);
    }
    &.active {
      border-color: var(--ft-primary);
      background: var(--ft-primary-soft);
      .q-icon {
        color: var(--ft-primary);
      }
    }
  }
}
</style>
