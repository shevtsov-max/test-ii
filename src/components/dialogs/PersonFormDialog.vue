<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import type { FamilyStatus, Gender, LifeEvent, RelativeKind } from '@/types'
import DateInput from '@/components/common/DateInput.vue'
import PlaceInput from '@/components/common/PlaceInput.vue'
import PersonSelect from '@/components/common/PersonSelect.vue'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'
import { emptyEvent, FAMILY_STATUSES, fullName, shortName, SUFFIXES, TITLES } from '@/utils/person'
import { patronymicFrom, patronymicSwap, surnameFor } from '@/utils/names'

const $q = useQuasar()
const store = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()

const state = computed(() => ui.personForm)
const open = computed({
  get: () => ui.personForm.open,
  set: (v) => (ui.personForm.open = v),
})
const isEdit = computed(() => state.value.mode === 'edit')
const target = computed(() => store.person(state.value.targetId))
const kind = computed<RelativeKind | null>(() => state.value.kind)

const KIND_TITLE: Record<RelativeKind, string> = {
  father: 'Добавить отца',
  mother: 'Добавить мать',
  brother: 'Добавить брата',
  sister: 'Добавить сестру',
  partner: 'Добавить партнёра',
  son: 'Добавить сына',
  daughter: 'Добавить дочь',
}

// ---------------------------------------------------------------- form
const source = ref<'new' | 'existing'>('new')
const existingId = ref<string | null>(null)

const gender = ref<Gender>('U')
const firstName = ref('')
const middleName = ref('')
const lastName = ref('')
const birthName = ref('')
const title = ref('')
const suffix = ref('')
const birth = ref<LifeEvent>(emptyEvent())
const death = ref<LifeEvent & { cause: string }>({ ...emptyEvent(), cause: '' })
const living = ref(true)
const email = ref('')
const nameInput = ref()

// связи
const familyChoice = ref<string | null>(null)
const status = ref<FamilyStatus>('married')
const marriage = ref<LifeEvent>(emptyEvent())
const joinFamilyId = ref<string | null>(null)
const joinKids = ref(true)

const middleTouched = ref(false)
const lastTouched = ref(false)

function reset() {
  source.value = 'new'
  existingId.value = null
  title.value = suffix.value = email.value = birthName.value = ''
  birth.value = emptyEvent()
  death.value = { ...emptyEvent(), cause: '' }
  living.value = true
  status.value = 'married'
  marriage.value = emptyEvent()
  joinFamilyId.value = null
  joinKids.value = true
  middleTouched.value = lastTouched.value = false
}

watch(
  () => ui.personForm.open,
  (o) => {
    if (!o) return
    reset()
    if (isEdit.value) {
      const p = store.person(state.value.personId)
      if (!p) return
      gender.value = p.gender
      firstName.value = p.firstName
      middleName.value = p.middleName
      lastName.value = p.lastName
      birthName.value = p.birthName
      title.value = p.title
      suffix.value = p.suffix
      birth.value = JSON.parse(JSON.stringify(p.birth))
      death.value = JSON.parse(JSON.stringify(p.death))
      living.value = p.living
      email.value = p.email
      return
    }
    const k = kind.value!
    const t = target.value!
    gender.value =
      k === 'father' || k === 'brother' || k === 'son'
        ? 'M'
        : k === 'mother' || k === 'sister' || k === 'daughter'
          ? 'F'
          : t.gender === 'M'
            ? 'F'
            : t.gender === 'F'
              ? 'M'
              : 'U'
    firstName.value = ''
    middleName.value = ''
    lastName.value = ''

    // семья по умолчанию
    if (k === 'son' || k === 'daughter') {
      const preset = state.value.presetFamilyId
      const fams = store.spouseFamilies(t.id)
      const best =
        (preset && fams.find((f) => f.id === preset)) ||
        [...fams].reverse().find((f) => f.partners.length === 2 && !['divorced', 'separated'].includes(f.status)) ||
        [...fams].reverse().find((f) => f.partners.length === 2) ||
        fams.find((f) => f.partners.length === 1)
      familyChoice.value = best?.id ?? 'single'
    } else if (k === 'brother' || k === 'sister') {
      familyChoice.value = store.parentsOf(t.id).family?.id ?? null
    } else if (k === 'partner') {
      const single = store.spouseFamilies(t.id).find((f) => f.partners.length === 1 && f.children.length)
      joinFamilyId.value = single?.id ?? null
    }
    applyAutoNames()
  },
)

// Отец будущей персоны (для отчества / фамилии)
const fatherForNew = computed(() => {
  const t = target.value
  if (!t || !kind.value) return null
  if (kind.value === 'son' || kind.value === 'daughter') {
    if (t.gender === 'M') return t
    const f = familyChoice.value && familyChoice.value !== 'single' ? store.tree.families[familyChoice.value] : null
    const other = f?.partners.find((x) => x !== t.id)
    const op = store.person(other)
    return op?.gender === 'M' ? op : null
  }
  if (kind.value === 'brother' || kind.value === 'sister') {
    const f = familyChoice.value ? store.tree.families[familyChoice.value] : null
    const father = f?.partners.map((x) => store.person(x)).find((x) => x?.gender === 'M')
    return father ?? null
  }
  return null
})

function applyAutoNames() {
  if (isEdit.value || !target.value || !kind.value) return
  const t = target.value
  const g = gender.value
  const k = kind.value
  if (!lastTouched.value) {
    let ln = ''
    if (fatherForNew.value) ln = surnameFor(fatherForNew.value.lastName, g)
    else if (k === 'son' || k === 'daughter' || k === 'brother' || k === 'sister' || k === 'father')
      ln = surnameFor(t.lastName, g)
    else if (k === 'partner' && g === 'F' && t.gender === 'M') ln = surnameFor(t.lastName, 'F')
    lastName.value = ln
  }
  if (!middleTouched.value) {
    let mn = ''
    if (fatherForNew.value?.firstName) mn = patronymicFrom(fatherForNew.value.firstName, g)
    else if ((k === 'brother' || k === 'sister') && t.middleName) mn = patronymicSwap(t.middleName, g)
    middleName.value = mn
  }
}
watch([gender, familyChoice], applyAutoNames)

// ---------------------------------------------------------------- options
const childFamilyOptions = computed(() => {
  const t = target.value
  if (!t) return []
  const opts = store.spouseFamilies(t.id).map((f) => {
    const other = f.partners.find((x) => x !== t.id)
    const op = store.person(other)
    return {
      value: f.id,
      label: op ? fullName(op) : t.gender === 'F' ? 'Неизвестный отец' : 'Неизвестная мать',
      caption: op ? FAMILY_STATUSES.find((s) => s.value === f.status)?.label : 'Второй родитель неизвестен',
      person: op,
    }
  })
  if (!opts.some((o) => !o.person))
    opts.push({
      value: 'single',
      label: t.gender === 'F' ? 'Неизвестный / другой отец' : 'Неизвестная / другая мать',
      caption: 'Второго родителя можно будет добавить позже',
      person: undefined,
    })
  return opts
})
const otherParentLabel = computed(() => (target.value?.gender === 'F' ? 'Отец' : target.value?.gender === 'M' ? 'Мать' : 'Второй родитель'))

const siblingFamilyOptions = computed(() => {
  const t = target.value
  if (!t) return []
  const { family, father, mother } = store.parentsOf(t.id)
  if (!family) return []
  const name = (id?: string) => (id ? shortName(store.person(id)) : '?')
  const opts: { value: string; label: string; caption?: string }[] = [
    {
      value: family.id,
      label: family.partners.length ? `Те же родители` : 'Те же (неизвестные) родители',
      caption: [father, mother].filter(Boolean).map(name).join(' и '),
    },
  ]
  for (const par of family.partners) {
    for (const f of store.spouseFamilies(par)) {
      if (f.id === family.id) continue
      const other = f.partners.find((x) => x !== par)
      opts.push({
        value: f.id,
        label: `Сводн. — через ${name(par)}`,
        caption: other ? `${name(par)} и ${name(other)}` : `только ${name(par)}`,
      })
    }
  }
  return opts
})

const otherParentOfTarget = computed(() => {
  const t = target.value
  if (!t || (kind.value !== 'father' && kind.value !== 'mother')) return null
  const { father, mother } = store.parentsOf(t.id)
  return store.person(kind.value === 'father' ? mother : father) ?? null
})

const joinFamily = computed(() => (joinFamilyId.value ? store.tree.families[joinFamilyId.value] : null))

const dialogTitle = computed(() => {
  if (isEdit.value) return 'Изменить персону'
  return KIND_TITLE[kind.value!]
})

const canSubmit = computed(() => {
  if (!isEdit.value && source.value === 'existing') return !!existingId.value
  return !!(firstName.value.trim() || lastName.value.trim())
})

const excludeIds = computed(() => (target.value ? [target.value.id] : []))

// ---------------------------------------------------------------- submit
function collect() {
  return {
    gender: gender.value,
    firstName: firstName.value.trim(),
    middleName: middleName.value.trim(),
    lastName: lastName.value.trim(),
    birthName: birthName.value.trim(),
    title: title.value?.trim() ?? '',
    suffix: suffix.value?.trim() ?? '',
    birth: birth.value,
    death: living.value ? { ...emptyEvent(), cause: '' } : death.value,
    living: living.value,
    email: living.value ? email.value.trim() : '',
  }
}

function submit(openProfile = false) {
  if (!canSubmit.value) {
    $q.notify({ type: 'warning', message: 'Укажите имя или фамилию' })
    nameInput.value?.focus()
    return
  }
  try {
    if (isEdit.value) {
      const id = state.value.personId!
      store.updatePerson(id, collect())
      open.value = false
      if (openProfile) ui.openProfile(id, 'bio')
      $q.notify({ type: 'positive', message: 'Изменения сохранены', timeout: 1500 })
      return
    }
    const k = kind.value!
    const t = target.value!
    const opts: Parameters<typeof store.addRelative>[3] = {
      existingId: source.value === 'existing' ? existingId.value : null,
    }
    if (k === 'son' || k === 'daughter') opts.familyId = familyChoice.value === 'single' ? null : familyChoice.value
    if (k === 'brother' || k === 'sister') opts.familyId = familyChoice.value
    if (k === 'partner') {
      opts.status = status.value
      if (joinFamilyId.value && joinKids.value) opts.familyId = joinFamilyId.value
    }
    const id = store.addRelative(t.id, k, collect(), opts)
    // дата брака
    if (k === 'partner' && (marriage.value.date.year || marriage.value.place)) {
      const fam = store.spouseFamilies(t.id).find((f) => f.partners.includes(id))
      if (fam) store.updateFamily(fam.id, { marriage: marriage.value })
    }
    open.value = false
    const p = store.person(id)!
    $q.notify({
      type: 'positive',
      message: `${shortName(p)} ${source.value === 'existing' ? 'связан(а) с древом' : 'добавлен(а) в древо'}`,
      actions: [
        { label: 'Показать', color: 'white', handler: () => store.setFocus(id) },
      ],
    })
    if (openProfile) ui.openProfile(id, 'bio')
  } catch (e) {
    $q.notify({ type: 'negative', message: (e as Error).message })
  }
}

function onDelete() {
  const id = state.value.personId
  if (!id) return
  actions.remove(id, () => (open.value = false))
}
</script>

<template>
  <q-dialog v-model="open" :maximized="$q.screen.lt.sm" transition-show="jump-up" transition-hide="fade">
    <q-card class="pf">
      <q-card-section class="pf__head row no-wrap items-center">
        <div class="col">
          <div class="pf__title">{{ dialogTitle }}</div>
          <div v-if="!isEdit && target" class="pf__sub">
            <PersonAvatar :person="target" :size="22" />
            для <b>{{ fullName(target) }}</b>
          </div>
        </div>
        <q-btn flat round dense icon="sym_r_close" v-close-popup />
      </q-card-section>

      <q-card-section class="pf__body ft-scroll">
        <q-btn-toggle
          v-if="!isEdit"
          v-model="source"
          spread
          no-caps
          unelevated
          rounded
          toggle-color="primary"
          color="grey-2"
          text-color="grey-9"
          class="q-mb-md pf__toggle"
          :options="[
            { label: 'Новая персона', value: 'new', icon: 'sym_r_person_add' },
            { label: 'Выбрать из древа', value: 'existing', icon: 'sym_r_link' },
          ]"
        />

        <template v-if="source === 'existing' && !isEdit">
          <PersonSelect v-model="existingId" label="Персона из древа" :exclude="excludeIds" autofocus />
          <div class="text-caption text-muted q-mt-sm">
            Используйте, чтобы связать уже добавленных людей (например, указать второго родителя или супруга).
          </div>
        </template>

        <template v-else>
          <div class="row q-gutter-x-lg q-mb-sm">
            <q-radio v-model="gender" val="M" label="Мужчина" color="info" />
            <q-radio v-model="gender" val="F" label="Женщина" color="pink-5" />
            <q-radio v-model="gender" val="U" label="Неизвестно" color="grey" />
          </div>

          <div class="pf__grid">
            <q-input ref="nameInput" v-model="firstName" outlined dense label="Имя" autofocus @keyup.enter="submit()" />
            <q-input v-model="lastName" outlined dense label="Фамилия" @update:model-value="lastTouched = true" @keyup.enter="submit()" />
            <q-input v-model="middleName" outlined dense label="Отчество" @update:model-value="middleTouched = true" />
            <q-input
              v-if="gender !== 'M'"
              v-model="birthName"
              outlined
              dense
              label="Фамилия при рождении"
              hint="Девичья фамилия"
            />
            <div v-else />
            <q-select
              v-model="title"
              outlined
              dense
              label="Звание"
              :options="TITLES"
              use-input
              new-value-mode="add-unique"
              clearable
              hide-dropdown-icon
              fill-input
              hide-selected
              input-debounce="0"
            />
            <q-select
              v-model="suffix"
              outlined
              dense
              label="Статус"
              :options="SUFFIXES"
              use-input
              new-value-mode="add-unique"
              clearable
              fill-input
              hide-selected
              input-debounce="0"
            />
          </div>

          <q-separator class="q-my-md" />

          <div class="pf__grid pf__grid--dates">
            <DateInput v-model="birth.date" label="Дата рождения" />
            <div>
              <div class="pf__lbl">Место рождения</div>
              <PlaceInput v-model="birth.place" />
            </div>
          </div>

          <q-separator class="q-my-md" />

          <div class="row q-gutter-x-lg">
            <q-radio v-model="living" :val="true" label="Жив(а)" />
            <q-radio v-model="living" :val="false" label="Умер(ла)" />
          </div>

          <q-slide-transition>
            <div v-if="!living" class="pf__grid pf__grid--dates q-mt-sm">
              <DateInput v-model="death.date" label="Дата смерти" />
              <div>
                <div class="pf__lbl">Место смерти</div>
                <PlaceInput v-model="death.place" />
              </div>
            </div>
          </q-slide-transition>
          <q-slide-transition>
            <div v-if="living" class="q-mt-sm" style="max-width: 320px">
              <q-input v-model="email" outlined dense type="email" label="Электронный адрес">
                <template #prepend><q-icon name="sym_r_mail" size="18px" /></template>
              </q-input>
            </div>
          </q-slide-transition>
        </template>

        <!-- Связи -->
        <template v-if="!isEdit && target">
          <q-separator class="q-my-md" />
          <template v-if="kind === 'son' || kind === 'daughter'">
            <div class="pf__lbl">{{ otherParentLabel }}</div>
            <q-select
              v-model="familyChoice"
              :options="childFamilyOptions"
              emit-value
              map-options
              outlined
              dense
              style="max-width: 420px"
            >
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
          </template>

          <template v-else-if="kind === 'brother' || kind === 'sister'">
            <div class="pf__lbl">Родители</div>
            <q-select
              v-if="siblingFamilyOptions.length"
              v-model="familyChoice"
              :options="siblingFamilyOptions"
              emit-value
              map-options
              outlined
              dense
              style="max-width: 420px"
            >
              <template #option="s">
                <q-item v-bind="s.itemProps">
                  <q-item-section>
                    <q-item-label>{{ s.opt.label }}</q-item-label>
                    <q-item-label caption>{{ s.opt.caption }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div v-else class="pf__note">
              <q-icon name="sym_r_info" size="18px" /> Родители {{ shortName(target) }} пока не указаны — их можно будет
              добавить позже, и они станут родителями обоих.
            </div>
          </template>

          <template v-else-if="kind === 'partner'">
            <div class="pf__grid">
              <q-select
                v-model="status"
                :options="FAMILY_STATUSES"
                emit-value
                map-options
                option-value="value"
                option-label="label"
                outlined
                dense
                label="Отношения"
              >
                <template #prepend>
                  <q-icon :name="FAMILY_STATUSES.find((s) => s.value === status)?.icon" size="18px" color="primary" />
                </template>
              </q-select>
            </div>
            <div class="pf__grid pf__grid--dates q-mt-md">
              <DateInput v-model="marriage.date" label="Дата брака / начала отношений" />
              <div>
                <div class="pf__lbl">Место</div>
                <PlaceInput v-model="marriage.place" />
              </div>
            </div>
            <q-checkbox
              v-if="joinFamily"
              v-model="joinKids"
              class="q-mt-sm"
              :label="`Второй родитель детей: ${joinFamily.children.map((c) => store.person(c)?.firstName).join(', ')}`"
            />
          </template>

          <template v-else-if="kind === 'father' || kind === 'mother'">
            <div v-if="otherParentOfTarget" class="pf__note">
              <q-icon name="sym_r_favorite" size="18px" color="primary" />
              Будет связан(а) как партнёр: <b>{{ fullName(otherParentOfTarget) }}</b>
            </div>
          </template>
        </template>
      </q-card-section>

      <q-card-actions class="pf__foot">
        <q-btn
          v-if="isEdit"
          flat
          no-caps
          color="negative"
          icon="sym_r_delete"
          label="Удалить"
          class="q-mr-auto"
          @click="onDelete"
        />
        <q-btn
          v-if="source === 'new' || isEdit"
          flat
          no-caps
          color="primary"
          class="q-mr-auto gt-xs"
          label="Редактировать (биография, другие факты)"
          @click="submit(true)"
        />
        <q-btn flat no-caps label="Отмена" color="grey-8" v-close-popup />
        <q-btn unelevated no-caps color="primary" label="Сохранить" :disable="!canSubmit" class="q-px-lg" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
.pf {
  width: 640px;
  max-width: 96vw;
  display: flex;
  flex-direction: column;
  max-height: 92vh;
}
.pf__head {
  padding: 20px 20px 12px 24px;
}
.pf__title {
  font-size: 20px;
  font-weight: 700;
}
.pf__sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: var(--ft-muted);
  font-size: 13.5px;
}
.pf__body {
  padding: 8px 24px 16px;
  overflow-y: auto;
  flex: 1;
}
.pf__toggle {
  border: 1px solid var(--ft-border);
}
.pf__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.pf__grid--dates {
  grid-template-columns: 1fr;
}
.pf__lbl {
  font-size: 12.5px;
  color: var(--ft-muted);
  margin-bottom: 4px;
}
.pf__note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ft-surface-2);
  font-size: 13.5px;
  color: var(--ft-muted);
}
.pf__foot {
  padding: 12px 20px 18px;
  border-top: 1px solid var(--ft-border);
  gap: 6px;
}
@media (max-width: 600px) {
  .pf {
    max-height: 100vh;
    border-radius: 0 !important;
  }
  .pf__grid {
    grid-template-columns: 1fr;
  }
}
body.body--dark .pf__toggle :deep(.q-btn:not(.bg-primary)) {
  background: var(--ft-surface-2) !important;
  color: var(--ft-text) !important;
}
</style>
