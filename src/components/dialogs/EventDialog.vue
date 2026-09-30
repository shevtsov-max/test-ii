<script setup>
/** Событие жизни персоны: тип, дата, место, описание, источники. */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import CitationsEditor from '@/components/inputs/CitationsEditor.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { EVENT_TYPES, eventTypeInfo, newEvent } from '@/domain/model'
import { shortName } from '@/domain/names'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.eventDialog.open,
  set: (v) => (ui.eventDialog.open = v),
})
const person = computed(() => tree.person(ui.eventDialog.personId))
const isNew = computed(() => !ui.eventDialog.eventId)
const ev = ref(newEvent())

watch(open, (o) => {
  if (!o) return
  const existing = person.value?.events.find((e) => e.id === ui.eventDialog.eventId)
  ev.value = existing ? JSON.parse(JSON.stringify({ citations: [], ...existing })) : newEvent({ type: ui.eventDialog.type ?? 'occupation' })
})
const info = computed(() => eventTypeInfo(ev.value.type))

function save() {
  if (!person.value) return
  tree.saveEvent(person.value.id, ev.value)
  open.value = false
  $q.notify({ type: 'positive', message: isNew.value ? 'Событие добавлено' : 'Событие сохранено', timeout: 1400 })
}
function remove() {
  tree.removeEvent(person.value.id, ev.value.id)
  open.value = false
  $q.notify({ message: 'Событие удалено', actions: [{ label: 'Отменить', color: 'primary', handler: () => tree.undo() }] })
}
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm" transition-show="jump-up">
    <q-card v-if="person" class="evd">
      <header class="evd__head">
        <div class="col">
          <div class="ft-h2">{{ isNew ? 'Новое событие' : 'Событие' }}</div>
          <div class="text-muted" style="font-size: 13px">{{ shortName(person) }}</div>
        </div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="evd__body ft-scroll">
        <div class="evd__types">
          <button v-for="t in EVENT_TYPES" :key="t.value" type="button" :class="{ active: ev.type === t.value }" @click="ev.type = t.value">
            <q-icon :name="t.icon" size="18px" />
            <span>{{ t.label }}</span>
          </button>
        </div>
        <q-input v-if="ev.type === 'custom'" v-model="ev.title" outlined dense label="Название события" autofocus />
        <q-input v-model="ev.description" outlined dense autogrow :label="info.hint" :autofocus="ev.type !== 'custom'" />
        <div class="evd__grid">
          <DateInput v-model="ev.date" />
          <PlaceInput v-model="ev.placeId" />
        </div>
        <CitationsEditor v-model="ev.citations" title="Источники" />
      </div>
      <footer class="evd__foot">
        <q-btn v-if="!isNew" flat no-caps color="negative" icon="sym_r_delete" label="Удалить" @click="remove" />
        <q-space />
        <q-btn v-close-popup flat no-caps label="Отмена" />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.evd {
  width: 640px;
  max-width: 96vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.evd__head {
  display: flex;
  align-items: flex-start;
  padding: 18px 18px 8px 22px;
}
.evd__body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.evd__types {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
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
    .q-icon {
      color: var(--ft-muted);
    }
    &:hover {
      border-color: var(--ft-border-strong);
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
.evd__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.evd__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 600px) {
  .evd__grid {
    grid-template-columns: 1fr;
  }
}
</style>
