<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { downloadText, pickFile } from '@/utils/image'
import { exportGedcom, importGedcom, validateTreeJson } from '@/utils/gedcom'

const $q = useQuasar()
const store = useTreeStore()
const ui = useUiStore()

const open = computed({
  get: () => ui.dataOpen,
  set: (v) => (ui.dataOpen = v),
})

const stats = computed(() => {
  const json = JSON.stringify(store.tree)
  const photos = store.persons.reduce((s, p) => s + p.photos.length, 0)
  return {
    persons: store.count,
    families: Object.keys(store.tree.families).length,
    photos,
    kb: Math.round((json.length * 2) / 1024),
  }
})

const slug = () =>
  (store.tree.name || 'tree').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '') + '_' + new Date().toISOString().slice(0, 10)

function exportJson() {
  downloadText(`${slug()}.json`, JSON.stringify(store.tree, null, 2))
}
function exportGed() {
  downloadText(`${slug()}.ged`, exportGedcom(store.tree), 'text/plain')
}

function confirmReplace(msg, fn) {
  $q.dialog({
    title: 'Заменить текущее древо?',
    message: msg + ' Текущие данные можно вернуть кнопкой «Отменить» (Ctrl+Z), но лучше сначала сохранить резервную копию.',
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Продолжить', color: 'primary' },
  }).onOk(fn)
}

async function importFile() {
  const [file] = await pickFile('.json,.ged,.gedcom,application/json,text/plain')
  if (!file) return
  try {
    const text = await file.text()
    const isGed = /\.ged(com)?$/i.test(file.name) || /^﻿?0 HEAD/m.test(text.slice(0, 200))
    const data = isGed ? importGedcom(text, file.name.replace(/\.[^.]+$/, '')) : validateTreeJson(JSON.parse(text))
    confirmReplace(
      `Будет загружено: ${Object.keys(data.persons).length} персон, ${Object.keys(data.families).length} семей.`,
      () => {
        store.replaceTree(data)
        open.value = false
        $q.notify({ type: 'positive', message: `Древо «${data.name}» импортировано` })
      },
    )
  } catch (e) {
    $q.notify({ type: 'negative', message: 'Ошибка импорта: ' + e.message })
  }
}

function demo() {
  confirmReplace('Будет загружено демонстрационное древо на 4 поколения.', () => {
    store.loadDemo()
    open.value = false
  })
}
function romanovs() {
  confirmReplace('Будет загружено тестовое древо: Николай II и европейские династии.', () => {
    store.loadRomanovs()
    open.value = false
  })
}
function original() {
  confirmReplace('Будет восстановлено исходное древо «Шевцов».', () => {
    store.loadOriginal()
    open.value = false
  })
}
function fresh() {
  confirmReplace('Будет создано новое пустое древо.', () => {
    store.newTree()
    open.value = false
  })
}
</script>

<template>
  <q-dialog v-model="open" transition-show="jump-up">
    <q-card style="width: 620px; max-width: 96vw">
      <q-card-section class="row items-center no-wrap">
        <div class="col">
          <div class="text-h6 text-weight-bold">Данные древа</div>
          <div class="text-caption text-muted">
            Всё хранится локально в браузере · сохранено {{ new Date(store.lastSaved).toLocaleTimeString('ru-RU') }}
          </div>
        </div>
        <q-btn flat round dense icon="sym_r_close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="dd__stats">
          <div><b>{{ stats.persons }}</b><span>персон</span></div>
          <div><b>{{ stats.families }}</b><span>семей</span></div>
          <div><b>{{ stats.photos }}</b><span>фото</span></div>
          <div><b>{{ stats.kb }}</b><span>КБ</span></div>
        </div>

        <div class="ft-section-title q-mt-lg q-mb-sm">Экспорт</div>
        <div class="dd__grid">
          <button class="dd__tile" @click="exportJson">
            <q-icon name="sym_r_data_object" size="26px" />
            <div>
              <b>Резервная копия (.json)</b>
              <span>Полная копия, включая фото и биографии</span>
            </div>
          </button>
          <button class="dd__tile" @click="exportGed">
            <q-icon name="sym_r_account_tree" size="26px" />
            <div>
              <b>GEDCOM (.ged)</b>
              <span>Для MyHeritage, Ancestry, Gramps и др. (без фото)</span>
            </div>
          </button>
        </div>

        <div class="ft-section-title q-mt-lg q-mb-sm">Импорт</div>
        <button class="dd__tile dd__tile--wide" @click="importFile">
          <q-icon name="sym_r_upload_file" size="26px" />
          <div>
            <b>Загрузить файл .json или .ged</b>
            <span>
              Перенос из MyHeritage: «Управление древом» → «Экспортировать в GEDCOM», затем загрузите файл сюда.
            </span>
          </div>
        </button>

        <div class="ft-section-title q-mt-lg q-mb-sm">Другое</div>
        <div class="row q-gutter-sm">
          <q-btn outline no-caps color="primary" icon="sym_r_account_tree" label="Тест: Романовы" @click="romanovs" />
          <q-btn outline no-caps color="primary" icon="sym_r_science" label="Демо-древо" @click="demo" />
          <q-btn outline no-caps color="primary" icon="sym_r_restart_alt" label="Древо «Шевцов»" @click="original" />
          <q-btn flat no-caps color="negative" icon="sym_r_note_add" label="Новое пустое древо" @click="fresh" />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.dd__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  > div {
    padding: 12px;
    border-radius: 12px;
    background: var(--ft-surface-2);
    display: flex;
    flex-direction: column;
    b {
      font-size: 22px;
      line-height: 1.1;
    }
    span {
      font-size: 12px;
      color: var(--ft-muted);
    }
  }
}
.dd__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.dd__tile {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  text-align: left;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  color: var(--ft-text);
  font: inherit;
  cursor: pointer;
  transition: 0.15s;
  width: 100%;
  .q-icon {
    color: var(--ft-primary);
    flex: none;
  }
  b {
    display: block;
    font-size: 14px;
  }
  span {
    display: block;
    font-size: 12.5px;
    color: var(--ft-muted);
    margin-top: 2px;
  }
  &:hover {
    border-color: var(--ft-primary);
    box-shadow: var(--ft-shadow);
  }
}
@media (max-width: 520px) {
  .dd__grid,
  .dd__stats {
    grid-template-columns: 1fr 1fr;
  }
  .dd__grid {
    grid-template-columns: 1fr;
  }
}
</style>
