<script setup>
/**
 * Добавление родственника: нового человека или уже существующего в древе.
 * Фамилия и отчество подставляются автоматически (по отцу), выбирается второй родитель,
 * семья для сводных братьев/сестёр, статус отношений и тип родства (кровный, приёмный…).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import DateInput from '@/components/inputs/DateInput.vue'
import PlaceInput from '@/components/inputs/PlaceInput.vue'
import PersonSelect from '@/components/person/PersonSelect.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { CHILD_LINKS, FAMILY_STATUSES, emptyPoint, statusInfo } from '@/domain/model'
import { fatherNameFromPatronymic, fullName, patronymicFrom, patronymicSwap, shortName, surnameFor } from '@/domain/names'
import { errorMessage } from '@/api'

const $q = useQuasar()
const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()

const open = computed({
  get: () => ui.relativeDialog.open,
  set: (v) => (ui.relativeDialog.open = v),
})
const target = computed(() => tree.person(ui.relativeDialog.targetId))
const G = computed(() => tree.graph)
const kind = ref(null)

const KINDS = computed(() => {
  const t = target.value
  const { father, mother, family } = t ? G.value.parents(t.id) : {}
  const full = (family?.partners.length ?? 0) >= 2
  const female = t?.gender === 'F'
  return [
    { kind: 'father', label: 'Отца', g: 'M', disable: !!father || full },
    { kind: 'mother', label: 'Мать', g: 'F', disable: !!mother || full },
    { kind: 'brother', label: 'Брата', g: 'M' },
    { kind: 'sister', label: 'Сестру', g: 'F' },
    { kind: 'partner', label: female ? 'Мужа, партнёра' : 'Жену, партнёршу', g: female ? 'M' : 'F' },
    { kind: 'son', label: 'Сына', g: 'M' },
    { kind: 'daughter', label: 'Дочь', g: 'F' },
  ]
})
const TITLE = {
  father: 'Добавить отца',
  mother: 'Добавить мать',
  brother: 'Добавить брата',
  sister: 'Добавить сестру',
  partner: 'Добавить супруга или партнёра',
  son: 'Добавить сына',
  daughter: 'Добавить дочь',
}

// ---------------------------------------------------------------- форма
const source = ref('new')
const existingId = ref(null)
const f = ref(blank())
const familyChoice = ref(null)
const status = ref('married')
const marriage = ref(emptyPoint())
const joinFamilyId = ref(null)
const joinKids = ref(true)
const link = ref('birth')
const lastTouched = ref(false)
const middleTouched = ref(false)
const firstInput = ref()

function blank() {
  return { gender: 'U', firstName: '', middleName: '', lastName: '', birthName: '', living: true, birth: emptyPoint(), death: { ...emptyPoint(), cause: '' } }
}

function reset(k) {
  kind.value = k
  source.value = 'new'
  existingId.value = null
  f.value = blank()
  status.value = 'married'
  marriage.value = emptyPoint()
  joinFamilyId.value = null
  joinKids.value = true
  lastTouched.value = middleTouched.value = false
  link.value = ui.relativeDialog.link ?? 'birth'
  if (!k || !target.value) return
  const t = target.value
  f.value.gender = ['father', 'brother', 'son'].includes(k) ? 'M' : ['mother', 'sister', 'daughter'].includes(k) ? 'F' : t.gender === 'M' ? 'F' : t.gender === 'F' ? 'M' : 'U'
  if (k === 'son' || k === 'daughter') {
    const preset = ui.relativeDialog.familyId
    const fams = G.value.spouseFamilies(t.id)
    const best =
      (preset && fams.find((x) => x.id === preset)) ||
      [...fams].reverse().find((x) => x.partners.length === 2 && !['divorced', 'separated'].includes(x.status)) ||
      [...fams].reverse().find((x) => x.partners.length === 2) ||
      fams.find((x) => x.partners.length === 1)
    familyChoice.value = best?.id ?? 'single'
  } else if (k === 'brother' || k === 'sister') {
    familyChoice.value = ui.relativeDialog.familyId ?? G.value.parentFamily(t.id)?.id ?? null
  } else if (k === 'partner') {
    joinFamilyId.value = G.value.spouseFamilies(t.id).find((x) => x.partners.length === 1 && x.children.length)?.id ?? null
  } else familyChoice.value = null
  applyAutoNames()
  nextTick(() => firstInput.value?.focus())
}

watch(open, (o) => o && reset(ui.relativeDialog.kind))

// Отец будущей персоны — для отчества и фамилии
const fatherForNew = computed(() => {
  const t = target.value
  const k = kind.value
  if (!t || !k) return null
  if (k === 'son' || k === 'daughter') {
    if (t.gender === 'M') return t
    const fam = familyChoice.value && familyChoice.value !== 'single' ? tree.family(familyChoice.value) : null
    const op = tree.person(fam?.partners.find((x) => x !== t.id))
    return op?.gender === 'M' ? op : null
  }
  if (k === 'brother' || k === 'sister') {
    const fam = familyChoice.value ? tree.family(familyChoice.value) : null
    return fam?.partners.map((x) => tree.person(x)).find((x) => x?.gender === 'M') ?? null
  }
  return null
})

function applyAutoNames() {
  const t = target.value
  const k = kind.value
  if (!t || !k || source.value !== 'new') return
  const g = f.value.gender
  if (!lastTouched.value) {
    let ln = ''
    if (fatherForNew.value) ln = surnameFor(fatherForNew.value.lastName, g)
    else if (['son', 'daughter', 'brother', 'sister', 'father'].includes(k)) ln = surnameFor(t.lastName || t.birthName, g)
    else if (k === 'partner' && g === 'F' && t.gender === 'M') ln = surnameFor(t.lastName, 'F')
    f.value.lastName = ln
    if (k === 'mother' || (k === 'partner' && g === 'F')) f.value.birthName = ''
  }
  if (!middleTouched.value) {
    let mn = ''
    if (fatherForNew.value?.firstName) mn = patronymicFrom(fatherForNew.value.firstName, g)
    else if ((k === 'brother' || k === 'sister') && t.middleName) mn = patronymicSwap(t.middleName, g)
    else if (k === 'father' && t.middleName) mn = ''
    f.value.middleName = mn
  }
}
watch(() => [f.value.gender, familyChoice.value], applyAutoNames)

// Отец по отчеству ребёнка: «Николаевич» → подсказка «Николай»
const fatherNameHint = computed(() => (kind.value === 'father' ? fatherNameFromPatronymic(target.value?.middleName) : ''))

// ---------------------------------------------------------------- варианты связей
const childFamilyOptions = computed(() => {
  const t = target.value
  if (!t) return []
  const opts = G.value.spouseFamilies(t.id).map((fam) => {
    const op = tree.person(fam.partners.find((x) => x !== t.id))
    return {
      value: fam.id,
      label: op ? fullName(op) : t.gender === 'F' ? 'Отец неизвестен' : 'Мать неизвестна',
      caption: op ? statusInfo(fam.status).label : 'второго родителя можно добавить позже',
      person: op,
    }
  })
  if (!opts.some((o) => !o.person))
    opts.push({ value: 'single', label: t.gender === 'F' ? 'Другой или неизвестный отец' : 'Другая или неизвестная мать', caption: 'второго родителя можно добавить позже', person: null })
  return opts
})

const siblingFamilyOptions = computed(() => {
  const t = target.value
  if (!t) return []
  const { family, father, mother } = G.value.parents(t.id)
  if (!family) return []
  const name = (id) => (id ? shortName(tree.person(id)) : '?')
  const opts = [{ value: family.id, label: 'Те же родители — родной', caption: [father, mother].filter(Boolean).map(name).join(' и ') || 'родители не указаны' }]
  for (const par of family.partners) {
    for (const fam of G.value.spouseFamilies(par)) {
      if (fam.id === family.id) continue
      const other = fam.partners.find((x) => x !== par)
      opts.push({
        value: fam.id,
        label: `Сводный — через ${name(par)}`,
        caption: other ? `${name(par)} и ${name(other)}` : `только ${name(par)}`,
      })
    }
  }
  return opts
})

const otherParent = computed(() => {
  const t = target.value
  if (!t || (kind.value !== 'father' && kind.value !== 'mother') || link.value !== 'birth') return null
  const { father, mother } = G.value.parents(t.id)
  return tree.person(kind.value === 'father' ? mother : father) ?? null
})
const joinFamily = computed(() => (joinFamilyId.value ? tree.family(joinFamilyId.value) : null))
const canSubmit = computed(() => (source.value === 'existing' ? !!existingId.value : !!(f.value.firstName.trim() || f.value.lastName.trim())))
const preferGender = computed(() => KINDS.value.find((x) => x.kind === kind.value)?.g ?? '')

// ---------------------------------------------------------------- сохранение
function submit(again = false) {
  if (!canSubmit.value) {
    $q.notify({ type: 'warning', message: source.value === 'existing' ? 'Выберите персону' : 'Укажите имя или фамилию' })
    return
  }
  const k = kind.value
  const t = target.value
  const data = JSON.parse(JSON.stringify(f.value))
  for (const key of ['firstName', 'middleName', 'lastName', 'birthName']) data[key] = data[key].trim()
  if (data.living) data.death = { ...emptyPoint(), cause: '' }
  const opts = { existingId: source.value === 'existing' ? existingId.value : null }
  if (k === 'son' || k === 'daughter') {
    opts.familyId = familyChoice.value === 'single' ? null : familyChoice.value
    opts.link = link.value
  }
  if (k === 'father' || k === 'mother') opts.link = link.value
  if (k === 'brother' || k === 'sister') opts.familyId = familyChoice.value
  if (k === 'partner') {
    opts.status = status.value
    if (joinFamilyId.value && joinKids.value) opts.familyId = joinFamilyId.value
    if (marriage.value.date.year || marriage.value.date.month || marriage.value.placeId) opts.marriage = marriage.value
  }
  try {
    const id = tree.addRelative(t.id, k, data, opts)
    const p = tree.person(id)
    $q.notify({
      type: 'positive',
      message: `${shortName(p)} ${opts.existingId ? 'связан(а) с древом' : 'добавлен(а) в древо'}`,
      actions: [
        { label: 'Показать', color: 'white', handler: () => nav.showInChart(id) },
        { label: 'Изменить', color: 'white', handler: () => ui.editPerson(id) },
      ],
    })
    if (again) reset(k)
    else open.value = false
  } catch (e) {
    $q.notify({ type: 'negative', message: errorMessage(e) })
  }
}
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm" transition-show="jump-up" transition-hide="fade">
    <q-card v-if="target" class="rd">
      <header class="rd__head">
        <div class="col min-w-0">
          <div class="ft-h2">{{ kind ? TITLE[kind] : 'Добавить родственника' }}</div>
          <div class="rd__sub">
            <PersonAvatar :person="target" :size="22" />
            <span class="ellipsis-1">для <b>{{ fullName(target) }}</b></span>
          </div>
        </div>
        <q-btn v-close-popup flat round dense icon="sym_r_close" aria-label="Закрыть" />
      </header>

      <!-- Шаг 1: кого добавить -->
      <div v-if="!kind" class="rd__body">
        <div class="rd__kinds">
          <button v-for="k in KINDS" :key="k.kind" type="button" class="rd__kind" :class="`gender-${k.g}`" :disabled="k.disable" @click="reset(k.kind)">
            <PersonAvatar :gender="k.g" :size="34" />
            <span>{{ k.label }}</span>
          </button>
          <button type="button" class="rd__kind rd__kind--wide gender-U" @click="(ui.relativeDialog.link = 'adopted'), reset('father')">
            <q-icon name="sym_r_family_restroom" size="24px" />
            <span>Приёмных родителей <small>усыновление, опека, отчим или мачеха</small></span>
          </button>
        </div>
      </div>

      <!-- Шаг 2: данные -->
      <div v-else class="rd__body ft-scroll">
        <q-btn-toggle
          v-model="source"
          spread
          no-caps
          unelevated
          toggle-color="primary"
          class="rd__source"
          :options="[
            { label: 'Новый человек', value: 'new', icon: 'sym_r_person_add' },
            { label: 'Уже есть в древе', value: 'existing', icon: 'sym_r_link' },
          ]"
        />

        <template v-if="source === 'existing'">
          <PersonSelect v-model="existingId" label="Кто это" :exclude="[target.id]" :gender="preferGender" autofocus />
          <div class="rd__note">
            <q-icon name="sym_r_info" size="18px" />
            Свяжите уже добавленных людей — например, укажите второго родителя или супруга, которые есть в древе.
          </div>
        </template>

        <template v-else>
          <div class="rd__gender">
            <q-radio v-model="f.gender" val="M" label="Мужчина" color="blue-8" dense />
            <q-radio v-model="f.gender" val="F" label="Женщина" color="pink-6" dense />
            <q-radio v-model="f.gender" val="U" label="Неизвестно" color="grey-7" dense />
          </div>
          <div class="rd__grid3">
            <q-input v-model="f.lastName" outlined dense label="Фамилия" @update:model-value="lastTouched = true" @keyup.enter="submit()" />
            <q-input ref="firstInput" v-model="f.firstName" outlined dense label="Имя" :placeholder="fatherNameHint || undefined" :hint="fatherNameHint && !f.firstName ? 'подсказка по отчеству' : undefined" @keyup.enter="submit()" />
            <q-input v-model="f.middleName" outlined dense label="Отчество" @update:model-value="middleTouched = true" @keyup.enter="submit()" />
          </div>
          <q-input
            v-if="f.gender !== 'M'"
            v-model="f.birthName"
            outlined
            dense
            label="Фамилия при рождении"
            hint="Девичья фамилия, если отличается"
            style="max-width: 50%"
          />
          <div class="rd__grid2">
            <DateInput v-model="f.birth.date" label="Дата рождения" />
            <PlaceInput v-model="f.birth.placeId" label="Место рождения" />
          </div>
          <q-toggle v-model="f.living" :label="f.living ? 'В живых' : 'Умер(ла)'" dense color="positive" />
          <q-slide-transition>
            <div v-if="!f.living" class="rd__grid2">
              <DateInput v-model="f.death.date" label="Дата смерти" />
              <PlaceInput v-model="f.death.placeId" label="Место смерти" />
            </div>
          </q-slide-transition>
        </template>

        <!-- Связи -->
        <div class="rd__links">
          <template v-if="kind === 'son' || kind === 'daughter'">
            <div class="ft-label">{{ target.gender === 'F' ? 'Отец' : target.gender === 'M' ? 'Мать' : 'Второй родитель' }}</div>
            <q-select v-model="familyChoice" :options="childFamilyOptions" emit-value map-options outlined dense>
              <template #option="s">
                <q-item v-bind="s.itemProps">
                  <q-item-section avatar><PersonAvatar :person="s.opt.person" :gender="target.gender === 'F' ? 'M' : 'F'" :size="30" /></q-item-section>
                  <q-item-section>
                    <q-item-label>{{ s.opt.label }}</q-item-label>
                    <q-item-label caption>{{ s.opt.caption }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-select v-model="link" :options="CHILD_LINKS.slice(0, 5)" option-value="value" option-label="label" emit-value map-options outlined dense label="Родство" />
          </template>

          <template v-else-if="kind === 'brother' || kind === 'sister'">
            <div class="ft-label">Общие родители</div>
            <q-select v-if="siblingFamilyOptions.length" v-model="familyChoice" :options="siblingFamilyOptions" emit-value map-options outlined dense>
              <template #option="s">
                <q-item v-bind="s.itemProps">
                  <q-item-section>
                    <q-item-label>{{ s.opt.label }}</q-item-label>
                    <q-item-label caption>{{ s.opt.caption }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div v-else class="rd__note">
              <q-icon name="sym_r_info" size="18px" />
              Родители {{ shortName(target) }} пока не указаны — когда вы их добавите, они станут родителями обоих.
            </div>
          </template>

          <template v-else-if="kind === 'partner'">
            <div class="ft-label">Отношения</div>
            <div class="rd__statuses">
              <button v-for="s in FAMILY_STATUSES" :key="s.value" type="button" :class="{ active: status === s.value }" @click="status = s.value">
                <q-icon :name="s.icon" size="16px" />
                {{ s.label }}
              </button>
            </div>
            <div class="rd__grid2">
              <DateInput v-model="marriage.date" :label="status === 'engaged' ? 'Дата помолвки' : status === 'partners' ? 'Начало отношений' : 'Дата брака'" />
              <PlaceInput v-model="marriage.placeId" label="Место" />
            </div>
            <q-checkbox v-if="joinFamily" v-model="joinKids" dense :label="`Второй родитель детей: ${joinFamily.children.map((c) => tree.person(c)?.firstName).join(', ')}`" />
          </template>

          <template v-else-if="kind === 'father' || kind === 'mother'">
            <q-select v-model="link" :options="CHILD_LINKS.slice(0, 5)" option-value="value" option-label="label" emit-value map-options outlined dense label="Родство">
              <template #hint>{{ link === 'birth' ? 'Кровный родитель' : 'Будет отдельная семья-родители; кровные родители сохранятся' }}</template>
            </q-select>
            <div v-if="otherParent" class="rd__note">
              <q-icon name="sym_r_favorite" size="18px" color="primary" />
              Станет партнёром: <b>{{ fullName(otherParent) }}</b>
            </div>
          </template>
        </div>
      </div>

      <footer v-if="kind" class="rd__foot">
        <q-btn flat no-caps icon="sym_r_arrow_back" label="Другой родственник" class="gt-xs" @click="reset(null)" />
        <q-space />
        <q-btn v-if="['son', 'daughter', 'brother', 'sister'].includes(kind)" flat no-caps color="primary" label="Сохранить и ещё" :disable="!canSubmit" class="gt-xs" @click="submit(true)" />
        <q-btn unelevated no-caps color="primary" :label="source === 'existing' ? 'Связать' : 'Добавить'" class="q-px-lg" :disable="!canSubmit" @click="submit()" />
      </footer>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.rd {
  width: 640px;
  max-width: 96vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.rd__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 18px 8px 22px;
}
.rd__sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: var(--ft-muted);
  font-size: 13.5px;
  min-width: 0;
}
.rd__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rd__kinds {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
}
.rd__kind {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1.5px solid color-mix(in srgb, var(--g) 45%, var(--ft-border));
  background: var(--ft-surface);
  color: var(--ft-text);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: 0.15s;
  &:hover:not(:disabled) {
    background: var(--g-soft);
    border-color: var(--g);
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  small {
    display: block;
    font-weight: 400;
    font-size: 12px;
    color: var(--ft-muted);
  }
  .q-icon {
    color: var(--ft-muted);
    margin: 0 5px;
  }
}
.rd__kind--wide {
  grid-column: 1 / -1;
}
.rd__source {
  border: 1px solid var(--ft-border);
  border-radius: 12px;
  overflow: hidden;
  :deep(.q-btn:not(.bg-primary)) {
    background: var(--ft-surface) !important;
    color: var(--ft-text-2);
  }
}
.rd__gender {
  display: flex;
  gap: 18px;
}
.rd__grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.rd__grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.rd__links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--ft-border);
}
.rd__statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--ft-border);
    background: var(--ft-surface);
    color: var(--ft-text-2);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
    &.active {
      background: var(--ft-primary);
      border-color: var(--ft-primary);
      color: #fff;
    }
  }
}
.rd__note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ft-surface-2);
  font-size: 13px;
  color: var(--ft-text-2);
}
.rd__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ft-border);
}
@media (max-width: 640px) {
  .rd {
    max-height: 100vh;
  }
  .rd__grid3,
  .rd__grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
