<script setup>
import { computed, ref } from 'vue'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'
import { formatDate, fullName, sortKey } from '@/utils/person'
import { downloadText } from '@/utils/image'

const store = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()

const search = ref('')
const gender = ref('all')
const alive = ref('all')

const rows = computed(() => {
  const n = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return store.persons.filter((p) => {
    if (gender.value !== 'all' && p.gender !== gender.value) return false
    if (alive.value === 'living' && !p.living) return false
    if (alive.value === 'dead' && p.living) return false
    if (!n.length) return true
    const hay =
      `${fullName(p, { middle: true })} ${p.birthName} ${p.birth.place} ${p.death.place} ${p.birth.date.year ?? ''}`.toLowerCase()
    return n.every((x) => hay.includes(x))
  })
})

const columns = [
  {
    name: 'name',
    label: 'Имя',
    field: (p) => fullName(p, { middle: true }),
    align: 'left',
    sortable: true,
    sort: (_a, _b, ra, rb) => `${ra.lastName} ${ra.firstName}`.localeCompare(`${rb.lastName} ${rb.firstName}`, 'ru'),
  },
  { name: 'relation', label: 'Родство', field: (p) => store.relationToHome(p.id), align: 'left', sortable: true },
  {
    name: 'birth',
    label: 'Рождение',
    field: (p) => formatDate(p.birth.date),
    align: 'left',
    sortable: true,
    sort: (_a, _b, ra, rb) => sortKey(ra.birth.date) - sortKey(rb.birth.date),
  },
  { name: 'bplace', label: 'Место рождения', field: (p) => p.birth.place, align: 'left', sortable: true },
  {
    name: 'death',
    label: 'Смерть',
    field: (p) => (p.living ? '' : formatDate(p.death.date) || '†'),
    align: 'left',
    sortable: true,
    sort: (_a, _b, ra, rb) => sortKey(ra.death.date) - sortKey(rb.death.date),
  },
  { name: 'actions', label: '', field: 'id', align: 'right' },
]

const pagination = ref({ sortBy: 'birth', descending: false, rowsPerPage: 25 })

function exportCsv() {
  const esc = (s) => `"${(s ?? '').replace(/"/g, '""')}"`
  const head = ['Фамилия', 'Имя', 'Отчество', 'Пол', 'Дата рождения', 'Место рождения', 'Дата смерти', 'Место смерти', 'Родство']
  const lines = rows.value.map((p) =>
    [
      p.lastName,
      p.firstName,
      p.middleName,
      p.gender,
      formatDate(p.birth.date),
      p.birth.place,
      p.living ? '' : formatDate(p.death.date),
      p.death.place,
      store.relationToHome(p.id),
    ]
      .map(esc)
      .join(';'),
  )
  downloadText('persons.csv', '﻿' + [head.join(';'), ...lines].join('\n'), 'text/csv')
}
</script>

<template>
  <div class="lv column no-wrap fit">
    <div class="lv__bar row items-center q-gutter-sm q-px-md">
      <q-input v-model="search" dense outlined rounded placeholder="Поиск по имени, месту, году…" class="lv__search" clearable>
        <template #prepend><q-icon name="sym_r_search" /></template>
      </q-input>
      <q-btn-toggle
        v-model="gender"
        dense
        no-caps
        unelevated
        rounded
        toggle-color="primary"
        class="lv__toggle"
        :options="[
          { label: 'Все', value: 'all' },
          { label: 'Муж.', value: 'M' },
          { label: 'Жен.', value: 'F' },
        ]"
      />
      <q-btn-toggle
        v-model="alive"
        dense
        no-caps
        unelevated
        rounded
        toggle-color="primary"
        class="lv__toggle"
        :options="[
          { label: 'Все', value: 'all' },
          { label: 'Живые', value: 'living' },
          { label: 'Умершие', value: 'dead' },
        ]"
      />
      <q-space />
      <q-btn flat no-caps icon="sym_r_download" label="CSV" @click="exportCsv" />
    </div>
    <div class="col q-pa-md" style="min-height: 0">
      <q-table
        v-model:pagination="pagination"
        :rows="rows"
        :columns="columns"
        row-key="id"
        flat
        bordered
        class="lv__table fit"
        :rows-per-page-options="[25, 50, 100, 0]"
        rows-per-page-label="Строк на странице"
        no-data-label="Никого не найдено"
        virtual-scroll
        :grid="$q.screen.lt.sm"
        @row-click="(_e, row) => store.select(row.id)"
        @row-dblclick="(_e, row) => ui.openProfile(row.id)"
      >
        <template #body-cell-name="props">
          <q-td :props="props">
            <div class="row items-center no-wrap q-gutter-x-sm">
              <PersonAvatar :person="props.row" :size="34" />
              <div>
                <div class="text-weight-medium">
                  <q-icon v-if="store.homeId === props.row.id" name="sym_r_home" color="primary" size="16px" />
                  {{ props.value }}
                </div>
                <div v-if="props.row.birthName" class="text-caption text-muted">урожд. {{ props.row.birthName }}</div>
              </div>
            </div>
          </q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props" auto-width>
            <q-btn flat round dense size="sm" icon="sym_r_center_focus_strong" @click.stop="store.setFocus(props.row.id); store.ui.view = 'family'">
              <q-tooltip>Показать в древе</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" icon="sym_r_badge" @click.stop="ui.openProfile(props.row.id)">
              <q-tooltip>Профиль</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" icon="sym_r_edit" @click.stop="ui.editPerson(props.row.id)">
              <q-tooltip>Изменить</q-tooltip>
            </q-btn>
            <q-btn flat round dense size="sm" icon="sym_r_delete" color="negative" @click.stop="actions.remove(props.row.id)">
              <q-tooltip>Удалить</q-tooltip>
            </q-btn>
          </q-td>
        </template>
        <template #item="props">
          <div class="q-pa-xs col-12">
            <q-card flat bordered class="row items-center no-wrap q-pa-sm q-gutter-x-sm" @click="ui.openProfile(props.row.id)">
              <PersonAvatar :person="props.row" :size="40" />
              <div class="col">
                <div class="text-weight-medium">{{ fullName(props.row) }}</div>
                <div class="text-caption text-muted">
                  {{ formatDate(props.row.birth.date) }} {{ props.row.birth.place }} · {{ store.relationToHome(props.row.id) }}
                </div>
              </div>
              <q-btn flat round dense icon="sym_r_edit" @click.stop="ui.editPerson(props.row.id)" />
            </q-card>
          </div>
        </template>
      </q-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lv__bar {
  height: 56px;
  flex: none;
  background: var(--ft-surface);
  border-bottom: 1px solid var(--ft-border);
}
.lv__search {
  width: 320px;
  max-width: 100%;
}
.lv__toggle {
  border: 1px solid var(--ft-border);
}
.lv__table {
  border-radius: 14px;
  background: var(--ft-surface);
  :deep(thead th) {
    font-weight: 700;
    color: var(--ft-muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  :deep(tbody tr) {
    cursor: pointer;
  }
}
@media (max-width: 700px) {
  .lv__bar {
    height: auto;
    padding-top: 8px;
    padding-bottom: 8px;
    flex-wrap: wrap;
  }
}
</style>
