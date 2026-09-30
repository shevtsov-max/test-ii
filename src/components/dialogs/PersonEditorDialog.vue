<script setup>
/**
 * Изменение персоны (и создание персоны без связей). Вкладки как в «Древе Жизни»:
 * основное, дополнительно, заметки, источники. Семья, события и документы — на странице профиля.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import ClanSelect from '@/components/inputs/ClanSelect.vue'
import CitationsEditor from '@/components/inputs/CitationsEditor.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { useTreeNav } from '@/composables/useTreeNav'
import { GENDERS, PRIVACY_LEVELS, SUFFIXES, TITLES, newPerson, uid } from '@/domain/model'
import { shortName, surnameFor } from '@/domain/names'
import { errorMessage } from '@/api'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()
const nav = useTreeNav()
const { uploadFor } = useMediaUpload()

const open = computed({
  get: () => ui.personEditor.open,
  set: (v) => (ui.personEditor.open = v),
})
const personId = computed(() => ui.personEditor.personId)
const isNew = computed(() => !personId.value)
const tab = ref('main')
const form = ref(newPerson())
let initial = ''
let loading = false

const EDIT_FIELDS = [
  'gender',
  'firstName',
  'middleName',
  'lastName',
  'birthName',
  'nickname',
  'title',
  'suffix',
  'clanId',
  'living',
  'birth',
  'death',
  'residencePlaceId',
  'occupation',
  'email',
  'phone',
  'note',
  'biography',
  'custom',
  'citations',
  'favorite',
  'privacy',
]
const pick = (p) => JSON.parse(JSON.stringify(Object.fromEntries(EDIT_FIELDS.map((k) => [k, p[k]]))))

watch(open, (o) => {
  if (!o) return
  loading = true
  nextTick(() => (loading = false))
  tab.value = ui.personEditor.tab ?? 'main'
  const p = personId.value ? tree.person(personId.value) : null
  form.value = p ? pick(p) : pick(newPerson())
  form.value.custom ??= {}
  initial = JSON.stringify(form.value)
})
const dirty = computed(() => JSON.stringify(form.value) !== initial)
const person = computed(() => (personId.value ? tree.person(personId.value) : null))
const canSave = computed(() => !!(form.value.firstName.trim() || form.value.lastName.trim() || form.value.birthName.trim()))

// Род фамилии при смене пола: Шевцов ↔ Шевцова
watch(
  () => form.value.gender,
  (g, old) => {
    if (loading || !old || g === old || g === 'U') return
    if (form.value.lastName) form.value.lastName = surnameFor(form.value.lastName, g)
  },
)

async function close() {
  if (dirty.value) {
    const ok = await actions.confirm({ title: 'Закрыть без сохранения?', message: 'Внесённые изменения будут потеряны.', ok: { label: 'Не сохранять', color: 'negative' } })
    if (!ok) return
  }
  open.value = false
}

function save(then) {
  if (!canSave.value) {
    tab.value = 'main'
    $q.notify({ type: 'warning', message: 'Укажите имя или фамилию' })
    return
  }
  const data = JSON.parse(JSON.stringify(form.value))
  for (const k of ['firstName', 'middleName', 'lastName', 'birthName', 'nickname', 'occupation', 'email', 'phone']) data[k] = (data[k] ?? '').trim()
  if (data.living) data.death = { ...data.death, date: { qualifier: 'exact', day: null, month: null, year: null }, placeId: null, cause: '' }
  try {
    let id = personId.value
    if (isNew.value) {
      id = tree.addPerson(data)
      $q.notify({ type: 'positive', message: `${shortName(data)} добавлен(а)`, actions: [{ label: 'Открыть', color: 'white', handler: () => nav.openPerson(id) }] })
    } else {
      tree.updatePerson(id, data)
      $q.notify({ type: 'positive', message: 'Изменения сохранены', timeout: 1400 })
    }
    initial = JSON.stringify(form.value)
    open.value = false
    then?.(id)
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}

// Дополнительные поля
function addField() {
  $q.dialog({
    title: 'Новое поле',
    message: 'Появится у всех персон этого древа и в таблице (например: «Вероисповедание», «Сословие», «Номер в архиве»).',
    prompt: { model: '', type: 'text', outlined: true, label: 'Название поля', isValid: (v) => !!v.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Добавить', color: 'primary', noCaps: true },
  }).onOk((label) => tree.saveCustomField({ id: uid('cf'), label: label.trim(), type: 'text' }))
}
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm" persistent transition-show="jump-up" transition-hide="fade" @escape-key="close">
    <q-card class="ped">
      <header class="ped__head">
        <PersonAvatar
          :person="person ?? form"
          :size="48"
          :camera="!isNew"
          @camera="uploadFor([personId], { avatar: true })"
        />
        <div class="col min-w-0">
          <div class="ft-h2 ellipsis-1">{{ isNew ? 'Новая персона' : shortName(form) }}</div>
          <div class="text-muted" style="font-size: 13px">{{ isNew ? 'Без связей — связать можно позже' : tree.relationToHome(personId) || 'Изменение данных' }}</div>
        </div>
        <q-btn flat round dense icon="sym_r_close" aria-label="Закрыть" @click="close" />
      </header>

      <q-tabs v-model="tab" dense no-caps align="left" active-color="primary" indicator-color="primary" class="ped__tabs" outside-arrows mobile-arrows>
        <q-tab name="main" label="Основное" />
        <q-tab name="more" label="Дополнительно" />
        <q-tab name="notes" label="Заметки" />
        <q-tab name="sources">
          <span>Источники <q-badge v-if="form.citations.length + (form.birth.citations?.length ?? 0) + (form.death.citations?.length ?? 0)" rounded color="grey-5" text-color="dark">{{ form.citations.length + (form.birth.citations?.length ?? 0) + (form.death.citations?.length ?? 0) }}</q-badge></span>
        </q-tab>
      </q-tabs>

      <div class="ped__body ft-scroll">
        <!-- Основное -->
        <div v-show="tab === 'main'" class="ped__pane">
          <div class="ped__gender">
            <button v-for="g in GENDERS" :key="g.value" type="button" :class="[`gender-${g.value}`, { active: form.gender === g.value }]" @click="form.gender = g.value">
              <q-icon :name="g.value === 'M' ? 'sym_r_male' : g.value === 'F' ? 'sym_r_female' : 'sym_r_question_mark'" size="18px" />
              {{ g.label }}
            </button>
          </div>
          <div class="ped__grid3">
            <q-input v-model="form.lastName" outlined dense label="Фамилия" autofocus />
            <q-input v-model="form.firstName" outlined dense label="Имя" />
            <q-input v-model="form.middleName" outlined dense label="Отчество" />
          </div>
          <div class="ped__grid2">
            <q-input v-model="form.birthName" outlined dense label="Фамилия при рождении" :hint="form.gender === 'F' ? 'Девичья фамилия' : 'Если менялась'" />
            <ClanSelect v-model="form.clanId" />
          </div>

          <div class="ped__sec">
            <div class="ped__sec-head">
              <span class="ft-label">Жизнь</span>
              <q-toggle v-model="form.living" :label="form.living ? 'В живых' : 'Умер(ла)'" dense color="positive" />
            </div>
            <div class="ped__grid2">
              <DateInput v-model="form.birth.date" label="Дата рождения" />
              <PlaceInput v-model="form.birth.placeId" label="Место рождения" />
            </div>
            <q-slide-transition>
              <div v-if="!form.living">
                <div class="ped__grid2 q-mt-sm">
                  <DateInput v-model="form.death.date" label="Дата смерти" />
                  <PlaceInput v-model="form.death.placeId" label="Место смерти" />
                </div>
                <q-input v-model="form.death.cause" outlined dense label="Причина смерти" class="q-mt-sm" />
              </div>
            </q-slide-transition>
          </div>

          <div class="ped__sec">
            <div class="ped__grid2">
              <PlaceInput v-model="form.residencePlaceId" :label="form.living ? 'Место жительства' : 'Последнее место жительства'" />
              <q-input v-model="form.occupation" outlined dense label="Основное занятие">
                <template #prepend><q-icon name="sym_r_work" size="19px" /></template>
              </q-input>
            </div>
            <q-toggle v-model="form.favorite" label="В избранном — быстрый доступ из боковой панели" dense class="q-mt-sm" />
          </div>
        </div>

        <!-- Дополнительно -->
        <div v-show="tab === 'more'" class="ped__pane">
          <div class="ped__grid3">
            <q-input v-model="form.nickname" outlined dense label="Прозвище, как звали дома" />
            <q-select v-model="form.title" :options="TITLES" outlined dense label="Титул, звание, сословие" use-input new-value-mode="add-unique" fill-input hide-selected input-debounce="0" clearable />
            <q-select v-model="form.suffix" :options="SUFFIXES" outlined dense label="Приставка" use-input new-value-mode="add-unique" fill-input hide-selected input-debounce="0" clearable />
          </div>
          <div v-if="form.living" class="ped__sec">
            <div class="ft-label q-mb-sm">Контакты</div>
            <div class="ped__grid2">
              <q-input v-model="form.email" outlined dense type="email" label="Электронная почта"><template #prepend><q-icon name="sym_r_mail" size="19px" /></template></q-input>
              <q-input v-model="form.phone" outlined dense type="tel" label="Телефон"><template #prepend><q-icon name="sym_r_call" size="19px" /></template></q-input>
            </div>
          </div>
          <div class="ped__sec">
            <div class="ped__sec-head">
              <span class="ft-label">Дополнительные поля</span>
              <q-btn flat dense no-caps size="sm" color="primary" icon="sym_r_add" label="Новое поле" @click="addField" />
            </div>
            <div v-if="tree.tree.customFields.length" class="ped__grid2">
              <q-input
                v-for="f in tree.tree.customFields"
                :key="f.id"
                :model-value="form.custom[f.id] ?? ''"
                outlined
                dense
                :label="f.label"
                :type="f.type === 'number' ? 'number' : 'text'"
                @update:model-value="(v) => (form.custom[f.id] = String(v ?? ''))"
              />
            </div>
            <div v-else class="text-muted" style="font-size: 13px">Свои поля для всего древа: вероисповедание, сословие, номер дела в архиве…</div>
          </div>
          <div class="ped__sec">
            <div class="ft-label q-mb-sm">Кто видит сведения</div>
            <q-option-group v-model="form.privacy" :options="PRIVACY_LEVELS.map((p) => ({ value: p.value, label: p.label }))" dense />
          </div>
        </div>

        <!-- Заметки -->
        <div v-show="tab === 'notes'" class="ped__pane">
          <q-input v-model="form.note" outlined autogrow label="Комментарий" hint="Коротко — видно в таблице и на панели персоны" input-style="min-height: 60px" />
          <q-input
            v-model="form.biography"
            outlined
            autogrow
            type="textarea"
            label="Биография"
            placeholder="Где родился и рос, чем занимался, важные события, семейные истории…"
            input-style="min-height: 220px; line-height: 1.6"
            class="q-mt-md"
          />
        </div>

        <!-- Источники -->
        <div v-show="tab === 'sources'" class="ped__pane">
          <CitationsEditor v-model="form.citations" title="О персоне в целом" />
          <CitationsEditor v-model="form.birth.citations" title="О рождении" class="q-mt-md" />
          <CitationsEditor v-if="!form.living" v-model="form.death.citations" title="О смерти" class="q-mt-md" />
        </div>
      </div>

      <footer class="ped__foot">
        <q-btn v-if="!isNew" flat no-caps color="negative" icon="sym_r_delete" label="Удалить" class="gt-xs" @click="actions.remove(personId, () => (open = false))" />
        <q-space />
        <q-btn v-if="!isNew" flat no-caps color="primary" label="Семья, события, документы" class="gt-sm" @click="save((id) => nav.openPerson(id))" />
        <q-btn flat no-caps label="Отмена" @click="close" />
        <q-btn unelevated no-caps color="primary" :label="isNew ? 'Добавить' : 'Сохранить'" class="q-px-lg" :disable="!canSave" @click="save()" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.ped {
  width: 720px;
  max-width: 96vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.ped__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 18px 10px 22px;
}
.ped__tabs {
  padding: 0 12px;
  border-bottom: 1px solid var(--ft-border);
}
.ped__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
}
.ped__pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ped__gender {
  display: flex;
  gap: 6px;
  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    &:hover {
      border-color: var(--ft-border-strong);
    }
    &.active {
      border-color: var(--g);
      background: var(--g-soft);
      color: var(--g);
    }
  }
}
.ped__grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ped__grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ped__sec {
  padding-top: 14px;
  border-top: 1px solid var(--ft-border);
}
.ped__sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.ped__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 640px) {
  .ped {
    max-height: 100vh;
  }
  .ped__grid3,
  .ped__grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
