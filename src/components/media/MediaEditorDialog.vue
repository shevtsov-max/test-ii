<script setup>
/** Сведения о фото или документе: название, дата, место, кто на нём, источник. */
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import PersonChip from '@/components/person/PersonChip.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { MEDIA_KINDS } from '@/domain/model'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const open = computed({
  get: () => ui.mediaEditor.open,
  set: (v) => (ui.mediaEditor.open = v),
})
const m = ref(null)
const adding = ref(null)
watch(open, (o) => {
  if (!o) return
  const src = tree.tree.media[ui.mediaEditor.mediaId]
  m.value = src ? JSON.parse(JSON.stringify(src)) : null
})
const sources = computed(() => Object.values(tree.tree?.sources ?? {}).map((s) => ({ value: s.id, label: s.title })))
function addPerson(id) {
  if (id && !m.value.personIds.includes(id)) m.value.personIds.push(id)
  adding.value = null
}
function save() {
  tree.updateMedia(m.value.id, m.value)
  open.value = false
}
function remove() {
  $q.dialog({
    title: 'Удалить файл?',
    message: 'Файл исчезнет у всех отмеченных людей.',
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Удалить', color: 'negative', noCaps: true },
  }).onOk(() => {
    tree.removeMedia(m.value.id)
    open.value = false
    ui.mediaViewer.open = false
    $q.notify({ message: 'Файл удалён', actions: [{ label: 'Отменить', color: 'primary', handler: () => tree.undo() }] })
  })
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card v-if="m" class="med">
      <header class="med__head">
        <img v-if="m.thumb" :src="m.thumb" alt="" class="med__thumb" />
        <div class="ft-h2 col">Файл</div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>
      <div class="med__body ft-scroll">
        <q-input v-model="m.title" outlined dense label="Название" autofocus />
        <q-btn-toggle v-model="m.kind" :options="MEDIA_KINDS.map((k) => ({ value: k.value, label: k.label }))" no-caps unelevated dense toggle-color="primary" class="med__kinds" />
        <div class="med__grid">
          <DateInput v-model="m.date" label="Дата снимка или документа" />
          <PlaceInput v-model="m.placeId" />
        </div>
        <q-input v-model="m.description" outlined dense autogrow label="Описание" />
        <q-select v-model="m.sourceId" :options="sources" emit-value map-options outlined dense clearable label="Источник" />
        <div>
          <div class="ft-label q-mb-sm">Кто на фото / в документе</div>
          <div class="med__people">
            <PersonChip v-for="pid in m.personIds" :key="pid" :person-id="pid" :link="false" :size="30">
              <q-btn flat round dense size="sm" icon="sym_r_close" class="text-muted" @click="m.personIds = m.personIds.filter((x) => x !== pid)" />
            </PersonChip>
          </div>
          <PersonSelect v-model="adding" dense placeholder="Отметить человека…" icon="sym_r_person_add" :exclude="m.personIds" class="q-mt-sm" @pick="addPerson" />
        </div>
      </div>
      <footer class="med__foot">
        <q-btn flat no-caps color="negative" icon="sym_r_delete" label="Удалить" @click="remove" />
        <q-space />
        <q-btn v-close-popup flat no-caps label="Отмена" />
        <q-btn unelevated no-caps color="primary" label="Сохранить" class="q-px-lg" @click="save" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.med {
  width: 600px;
  max-width: 96vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.med__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 6px 22px;
}
.med__thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
}
.med__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.med__kinds {
  border: 1px solid var(--ft-border);
  border-radius: 10px;
  align-self: flex-start;
}
.med__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.med__people {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.med__foot {
  display: flex;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
</style>
