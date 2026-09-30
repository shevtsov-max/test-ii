<script setup>
/**
 * Новое древо: мастер «начните с себя» (с живым предпросмотром схемы), импорт файла или пример.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import ChartScene from '@/components/chart/ChartScene.vue'
import { chartPalette } from '@/components/chart/palette'
import { EXAMPLES, useTreesStore } from '@/stores/trees'
import { errorMessage } from '@/api'
import { starterTree } from '@/data/seed'
import { emptyDate } from '@/domain/dates'
import { FamilyGraph } from '@/domain/graph'
import { relationship } from '@/domain/kinship'
import { computeChart } from '@/domain/layout'
import { patronymicFrom, surnameFor } from '@/domain/names'
import { pickFiles } from '@/utils/files'

const $q = useQuasar()
const router = useRouter()
const trees = useTreesStore()

const mode = ref('start')
const busy = ref(false)

const me = ref({ firstName: '', lastName: '', middleName: '', gender: 'M', birthDate: emptyDate() })
const birthPlace = ref('')
const father = ref({ firstName: '' })
const mother = ref({ firstName: '', birthName: '' })
const treeName = ref('')
const nameTouched = ref(false)
const middleTouched = ref(false)

/** Для «Семья …»: «Шевцов» → «Шевцовых», «Чайковский» → «Чайковских», «Толстой» → «Толстых», «Шевчук» → «Шевчук» */
function familyGenitive(surname) {
  const s = surnameFor(surname.trim(), 'M')
  if (!s) return ''
  if (/(ов|ев|ёв|ин|ын)$/.test(s)) return s + 'ых'
  if (/ий$/.test(s)) return s.slice(0, -2) + 'их'
  if (/(ой|ый)$/.test(s)) return s.slice(0, -2) + 'ых'
  return s
}
const suggestedName = computed(() => (familyGenitive(me.value.lastName) ? `Семья ${familyGenitive(me.value.lastName)}` : 'Моё семейное древо'))
watch(suggestedName, (v) => !nameTouched.value && (treeName.value = v), { immediate: true })
// Отчество подставляется из имени отца, пока его не правили вручную
watch(
  () => [father.value.firstName, me.value.gender],
  ([f, g]) => {
    if (!middleTouched.value && g !== 'U') me.value.middleName = f.trim() ? patronymicFrom(f.trim(), g) : ''
  },
)

const draft = computed(() =>
  starterTree({
    name: treeName.value.trim() || suggestedName.value,
    me: {
      firstName: me.value.firstName.trim() || 'Я',
      lastName: me.value.lastName.trim(),
      middleName: me.value.middleName.trim(),
      gender: me.value.gender,
      birth: { date: { ...me.value.birthDate }, placeId: null, citations: [] },
    },
    birthPlace: birthPlace.value,
    father: father.value,
    mother: mother.value,
  }),
)

// Предпросмотр: тот же движок раскладки, что и в древе
const preview = computed(() => {
  const t = draft.value
  const G = new FamilyGraph(t)
  const L = computeChart(G, t.homePersonId, { view: 'tree', scope: 'family', up: 1, down: 0, density: 'normal', placeholders: true })
  const b = L.bounds
  const pad = 20
  return {
    t,
    L,
    relationOf: (id) => relationship(G, t.homePersonId, id),
    viewBox: `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`,
  }
})
const previewOpts = { photos: true, years: true, relation: true, places: true, patronymic: true, colorBy: 'gender' }
const P = computed(() => chartPalette($q.dark.isActive))

async function create() {
  if (!me.value.firstName.trim()) {
    $q.notify({ type: 'warning', message: 'Укажите ваше имя' })
    return
  }
  busy.value = true
  try {
    const s = await trees.add(draft.value)
    router.replace({ name: 'tree-chart', params: { treeId: s.id } })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
async function importFile() {
  const [file] = await pickFiles('.json,.ged,.gedcom,application/json,text/plain')
  if (!file) return
  busy.value = true
  try {
    const s = await trees.importFile(file)
    $q.notify({ type: 'positive', message: `Древо «${s.name}» импортировано` })
    router.replace({ name: 'tree-overview', params: { treeId: s.id } })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e), timeout: 6000 })
  } finally {
    busy.value = false
  }
}
async function example(id) {
  busy.value = true
  try {
    const s = await trees.createExample(id)
    router.replace({ name: 'tree-chart', params: { treeId: s.id } })
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  } finally {
    busy.value = false
  }
}
const MODES = [
  { value: 'start', icon: 'sym_r_person_add', title: 'Начать с себя', text: 'Пара вопросов — и древо готово' },
  { value: 'import', icon: 'sym_r_upload_file', title: 'Импорт из файла', text: 'GEDCOM из другой программы или резервная копия' },
  { value: 'example', icon: 'sym_r_visibility', title: 'Пример', text: 'Посмотреть, как всё устроено' },
]
</script>

<template>
  <div class="ft-page nt">
    <router-link :to="{ name: 'dashboard' }" class="nt__back"><q-icon name="sym_r_arrow_back" size="18px" />Мои древа</router-link>
    <h1 class="nt__title">Новое семейное древо</h1>

    <div class="nt__modes">
      <button v-for="m in MODES" :key="m.value" type="button" class="nt__mode" :class="{ active: mode === m.value }" @click="mode = m.value">
        <span class="nt__mode-icon"><q-icon :name="m.icon" size="22px" /></span>
        <span>
          <b>{{ m.title }}</b>
          <small>{{ m.text }}</small>
        </span>
      </button>
    </div>

    <!-- Начать с себя -->
    <div v-if="mode === 'start'" class="nt__grid">
      <form class="nt__form ft-card" @submit.prevent="create">
        <section>
          <h2 class="ft-h3">О вас</h2>
          <p class="nt__hint">Вы станете первой карточкой древа. От вас будет считаться родство: «Дедушка», «Двоюродная сестра».</p>
          <div class="nt__gender">
            <button type="button" :class="{ active: me.gender === 'M' }" @click="me.gender = 'M'"><q-icon name="sym_r_male" size="18px" />Мужчина</button>
            <button type="button" :class="{ active: me.gender === 'F' }" @click="me.gender = 'F'"><q-icon name="sym_r_female" size="18px" />Женщина</button>
          </div>
          <div class="nt__row">
            <q-input v-model="me.firstName" outlined dense label="Имя *" autofocus class="col" />
            <q-input v-model="me.lastName" outlined dense label="Фамилия" class="col" />
          </div>
          <div class="nt__row">
            <q-input v-model="me.middleName" outlined dense label="Отчество" class="col" @update:model-value="middleTouched = true" />
            <DateInput v-model="me.birthDate" label="Дата рождения" class="col" />
          </div>
          <q-input v-model="birthPlace" outlined dense label="Место рождения" hint="Например: Россия, Ставрополь" />
        </section>

        <section>
          <h2 class="ft-h3">Родители <span class="text-muted" style="font-weight: 500; font-size: 13px">— можно позже</span></h2>
          <p class="nt__hint">Достаточно имени: фамилия подставится ваша, а отчество — по имени отца.</p>
          <div class="nt__row">
            <q-input v-model="father.firstName" outlined dense label="Имя отца" class="col">
              <template #prepend><q-icon name="sym_r_man" size="18px" /></template>
            </q-input>
            <q-input v-model="mother.firstName" outlined dense label="Имя матери" class="col">
              <template #prepend><q-icon name="sym_r_woman" size="18px" /></template>
            </q-input>
          </div>
          <q-input v-model="mother.birthName" outlined dense label="Девичья фамилия матери" :disable="!mother.firstName.trim()" />
        </section>

        <section>
          <h2 class="ft-h3">Название древа</h2>
          <q-input v-model="treeName" outlined dense @update:model-value="nameTouched = true" />
        </section>

        <q-btn type="submit" unelevated no-caps color="primary" size="lg" label="Создать древо" icon-right="sym_r_arrow_forward" class="nt__submit" :loading="busy" />
      </form>

      <aside class="nt__preview ft-card">
        <div class="ft-label">Так будет выглядеть начало</div>
        <svg :viewBox="preview.viewBox" class="nt__svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Предпросмотр древа">
          <ChartScene
            :nodes="preview.L.nodes"
            :edges="preview.L.edges"
            :tree="preview.t"
            :metrics="preview.L.metrics"
            :palette="P"
            :opts="previewOpts"
            :relation-of="preview.relationOf"
            :home-id="preview.t.homePersonId"
            :selected-id="preview.t.homePersonId"
            lod="full"
            id-prefix="nt"
          />
        </svg>
        <p class="nt__hint">Дальше родственников удобно добавлять прямо на схеме — кнопкой «+» у карточки.</p>
      </aside>
    </div>

    <!-- Импорт -->
    <div v-else-if="mode === 'import'" class="nt__panel ft-card">
      <q-icon name="sym_r_upload_file" size="40px" class="nt__panel-icon" />
      <h2 class="ft-h2">Перенесите древо из другой программы</h2>
      <p>
        В «Древе Жизни», MyHeritage, Ancestry, Gramps, GenoPro и других программах есть экспорт в формат <b>GEDCOM (.ged)</b>. Сохраните файл и выберите
        его здесь — люди, семьи, даты, места и заметки перенесутся. Подходит и резервная копия «Родословной» (.json).
      </p>
      <q-btn unelevated no-caps color="primary" size="lg" icon="sym_r_folder_open" label="Выбрать файл" :loading="busy" @click="importFile" />
      <router-link :to="{ name: 'help', hash: '#import' }" class="nt__help">Как выгрузить GEDCOM из другой программы</router-link>
    </div>

    <!-- Примеры -->
    <div v-else class="nt__examples">
      <button v-for="e in EXAMPLES" :key="e.id" type="button" class="nt__example ft-card ft-card--hover" :disabled="busy" @click="example(e.id)">
        <q-icon name="sym_r_account_tree" size="28px" />
        <b>{{ e.name }}</b>
        <span>{{ e.text }}</span>
        <span class="nt__example-go">Открыть пример →</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nt {
  max-width: 1120px;
}
.nt__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ft-muted);
  font-weight: 550;
  font-size: 13.5px;
}
.nt__title {
  margin: 10px 0 20px;
  font-family: var(--ft-font-display);
  font-size: 32px;
  font-weight: 600;
}
.nt__modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.nt__mode {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface);
  color: var(--ft-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  > span:last-child {
    display: flex;
    flex-direction: column;
  }
  small {
    color: var(--ft-muted);
    font-size: 12.5px;
  }
  &.active {
    border-color: var(--ft-primary);
    box-shadow: 0 0 0 3px var(--ft-primary-soft);
    .nt__mode-icon {
      background: var(--ft-primary);
      color: #fff;
    }
  }
}
.nt__mode-icon {
  width: 42px;
  height: 42px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--ft-primary-soft);
  color: var(--ft-primary);
}
.nt__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
  gap: 20px;
  align-items: start;
}
.nt__form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}
.nt__hint {
  margin: -4px 0 4px;
  color: var(--ft-muted);
  font-size: 13px;
  line-height: 1.5;
}
.nt__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  > * {
    min-width: 180px;
  }
}
.nt__gender {
  display: inline-flex;
  gap: 6px;
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    &.active {
      border-color: var(--ft-primary);
      background: var(--ft-primary-soft);
      color: var(--ft-primary-text);
    }
  }
}
.nt__submit {
  align-self: flex-start;
}
.nt__preview {
  position: sticky;
  top: 12px;
  padding: 18px;
  background:
    radial-gradient(var(--ft-dot) 1px, transparent 1.2px) 0 0 / 20px 20px,
    var(--ft-canvas);
}
.nt__svg {
  display: block;
  width: 100%;
  height: 300px;
  margin: 10px 0;
}
.nt__panel {
  padding: 40px;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  p {
    color: var(--ft-text-2);
    line-height: 1.6;
    margin: 0 0 8px;
  }
}
.nt__panel-icon {
  color: var(--ft-primary);
}
.nt__help {
  font-size: 13.5px;
  margin-top: 4px;
}
.nt__examples {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.nt__example {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 22px;
  font: inherit;
  text-align: left;
  color: var(--ft-text-2);
  cursor: pointer;
  .q-icon {
    color: var(--ft-accent);
    margin-bottom: 6px;
  }
  b {
    color: var(--ft-text);
    font-size: 16px;
  }
}
.nt__example-go {
  margin-top: 8px;
  color: var(--ft-primary-text);
  font-weight: 600;
  font-size: 13.5px;
}
@media (max-width: 900px) {
  .nt__modes,
  .nt__grid {
    grid-template-columns: 1fr;
  }
  .nt__preview {
    position: static;
    order: -1;
  }
  .nt__svg {
    height: 220px;
  }
}
</style>
