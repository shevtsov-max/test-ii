<script setup>
/**
 * Персоны — таблица всех людей древа (главный экран «Древа Жизни»):
 * настраиваемые колонки, поиск, фильтры, панель выбранной персоны, групповые действия, экспорт.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import PersonSummary from '@/components/person/PersonSummary.vue'
import PersonMenuList from '@/components/person/PersonMenuList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { peopleColumns, COLUMN_LABELS } from '@/components/person/peopleColumns'
import { useTreeStore } from '@/stores/tree'
import { usePrefsStore, DEFAULT_COLUMNS } from '@/stores/prefs'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { usePersonActions } from '@/composables/usePersonActions'
import { normalize, personHaystack } from '@/domain/search'
import { completeness } from '@/domain/person'
import { formalName } from '@/domain/names'
import { downloadText, fileSlug } from '@/utils/files'
import { count } from '@/utils/format'

const $q = useQuasar()
const route = useRoute()
const tree = useTreeStore()
const prefs = usePrefsStore()
const ui = useUiStore()
const nav = useTreeNav()
const actions = usePersonActions()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filters = ref({
  gender: 'all',
  status: 'all',
  photo: 'all',
  linked: 'all',
  clan: typeof route.query.clan === 'string' ? route.query.clan : null,
  favorite: false,
  century: null,
  incomplete: false,
})
const selection = ref([])
const pagination = ref({ sortBy: 'name', descending: false, rowsPerPage: 0 })

const allColumns = computed(() => peopleColumns({ tree: tree.tree, graph: tree.graph, relation: tree.relationToHome }))
const visibleNames = computed(() => {
  const set = prefs.people.columns.filter((c) => allColumns.value.some((x) => x.name === c))
  return set.includes('name') ? set : ['name', ...set]
})
const columns = computed(() => visibleNames.value.map((n) => allColumns.value.find((c) => c.name === n)).filter(Boolean))

const linkedSet = computed(() => (tree.homeId ? tree.graph.component(tree.homeId) : new Set()))
const clans = computed(() => Object.values(tree.tree.clans).map((c) => ({ value: c.id, label: c.name, color: c.color })))
const centuries = [
  { value: 17, label: 'XVII век' },
  { value: 18, label: 'XVIII век' },
  { value: 19, label: 'XIX век' },
  { value: 20, label: 'XX век' },
  { value: 21, label: 'XXI век' },
]

const rows = computed(() => {
  const q = normalize(search.value).split(' ').filter(Boolean)
  const f = filters.value
  return tree.persons.filter((p) => {
    if (f.gender !== 'all' && p.gender !== f.gender) return false
    if (f.status === 'living' && !p.living) return false
    if (f.status === 'dead' && p.living) return false
    if (f.photo === 'yes' && !p.avatarId) return false
    if (f.photo === 'no' && p.avatarId) return false
    if (f.linked === 'yes' && !linkedSet.value.has(p.id)) return false
    if (f.linked === 'no' && linkedSet.value.has(p.id)) return false
    if (f.clan && p.clanId !== f.clan) return false
    if (f.favorite && !p.favorite) return false
    if (f.century && Math.floor(((p.birth.date.year ?? 0) - 1) / 100) + 1 !== f.century) return false
    if (f.incomplete && completeness(tree.graph, p).score >= 60) return false
    if (q.length) {
      const hay = personHaystack(tree.tree, p)
      if (!q.every((x) => hay.includes(x))) return false
    }
    return true
  })
})

const activeFilters = computed(() => {
  const f = filters.value
  return [f.gender !== 'all', f.status !== 'all', f.photo !== 'all', f.linked !== 'all', !!f.clan, f.favorite, !!f.century, f.incomplete].filter(Boolean).length
})
function resetFilters() {
  filters.value = { gender: 'all', status: 'all', photo: 'all', linked: 'all', clan: null, favorite: false, century: null, incomplete: false }
  search.value = ''
}

// Колонки
function toggleColumn(name, on) {
  const cur = [...prefs.people.columns]
  prefs.people.columns = on ? [...cur, name] : cur.filter((c) => c !== name)
}
function moveColumn(name, dir) {
  const cur = [...visibleNames.value]
  const i = cur.indexOf(name)
  const j = i + dir
  if (i < 0 || j < 1 || j >= cur.length) return
  ;[cur[i], cur[j]] = [cur[j], cur[i]]
  prefs.people.columns = cur
}

// Выбор строки
const panelOpen = ref(true)
function onRowClick(evt, row) {
  tree.selectPerson(row.id)
  panelOpen.value = true
}
const ctx = ref(null)
function onRowContext(evt, row) {
  evt.preventDefault()
  tree.selectPerson(row.id)
  ctx.value = { id: row.id, x: evt.clientX, y: evt.clientY }
}
const ctxTarget = ref()
const ctxOpen = computed({
  get: () => !!ctx.value,
  set: (v) => !v && (ctx.value = null),
})

// Клавиатура: вверх/вниз по таблице
function onKey(e) {
  if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return
  const list = sortedRows.value
  const i = list.findIndex((r) => r.id === tree.selectedId)
  if (e.key === 'Enter' && i >= 0) return nav.openPerson(list[i].id)
  const j = e.key === 'ArrowDown' ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1)
  if (list[j]) tree.selectPerson(list[j].id)
  e.preventDefault()
}
const tableRef = ref()
const sortedRows = computed(() => tableRef.value?.computedRows ?? rows.value)

// Групповые действия
const selectedIds = computed(() => selection.value.map((r) => r.id))
function bulkClan(clanId) {
  tree.assignClan(selectedIds.value, clanId)
  $q.notify({ type: 'positive', message: `Род назначен: ${count(selectedIds.value.length, 'персоне', 'персонам', 'персонам')}` })
}
function bulkFavorite(on) {
  tree.commit(on ? 'В избранное' : 'Из избранного', (d) => {
    for (const id of selectedIds.value) if (d.persons[id]) d.persons[id].favorite = on
  })
}
async function bulkDelete() {
  const n = selectedIds.value.length
  const ok = await actions.confirm({ title: `Удалить ${count(n, 'персону', 'персоны', 'персон')}?`, message: 'Вместе с событиями и связями. Действие можно отменить.', ok: { label: 'Удалить', color: 'negative' } })
  if (!ok) return
  const ids = [...selectedIds.value]
  tree.commit('Удаление персон', (d) => {
    for (const id of ids) {
      delete d.persons[id]
      for (const f of Object.values(d.families)) {
        f.partners = f.partners.filter((p) => p !== id)
        f.children = f.children.filter((c) => c !== id)
      }
    }
    for (const f of Object.values(d.families)) if (f.partners.length + f.children.length < 2) delete d.families[f.id]
    if (!d.persons[d.homePersonId]) d.homePersonId = Object.keys(d.persons)[0] ?? null
  })
  selection.value = []
  $q.notify({ message: 'Персоны удалены', actions: [{ label: 'Отменить', color: 'primary', handler: () => tree.undo() }] })
}

// Экспорт
function exportCsv(onlySelected = false) {
  const list = onlySelected ? selection.value : sortedRows.value
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  const cols = columns.value
  const head = cols.map((c) => esc(c.label)).join(';')
  const lines = list.map((p) => cols.map((c) => esc(c.name === 'living' || c.name === 'photo' ? (c.field(p) ? 'да' : 'нет') : c.format ? c.format(c.field(p)) : c.field(p))).join(';'))
  downloadText(`${fileSlug(tree.tree.name)}_персоны.csv`, '﻿' + [head, ...lines].join('\n'), 'text/csv')
}
const printing = ref(false)
async function printTable() {
  printing.value = true
  await nextTick()
  setTimeout(() => {
    window.print()
    printing.value = false
  }, 100)
}

watch(
  () => route.query.q,
  (q) => typeof q === 'string' && (search.value = q),
)
watch(
  () => route.query.clan,
  (c) => typeof c === 'string' && (filters.value.clan = c),
)
const showPanel = computed(() => panelOpen.value && tree.selected && $q.screen.gt.md)
</script>

<template>
  <div class="pp" tabindex="0" @keydown="onKey">
    <div class="pp__bar no-print">
      <div class="pp__title">
        <h1 class="ft-h2">Персоны</h1>
        <span class="text-muted tabular">{{ rows.length === tree.count ? tree.count : `${rows.length} из ${tree.count}` }}</span>
      </div>
      <q-input v-model="search" dense outlined clearable placeholder="Имя, фамилия, год, место…" class="pp__search" debounce="120">
        <template #prepend><q-icon name="sym_r_search" size="19px" /></template>
      </q-input>
      <q-btn outline no-caps dense class="pp__btn" icon="sym_r_filter_list" :label="$q.screen.gt.sm ? 'Фильтры' : undefined">
        <q-badge v-if="activeFilters" floating rounded color="primary">{{ activeFilters }}</q-badge>
        <q-menu anchor="bottom left" self="top left" :offset="[0, 6]">
          <div class="pp__filters">
            <div class="ft-label">Пол</div>
            <q-btn-toggle v-model="filters.gender" no-caps unelevated dense spread toggle-color="primary" :options="[{ label: 'Все', value: 'all' }, { label: 'Мужчины', value: 'M' }, { label: 'Женщины', value: 'F' }]" class="pp__toggle" />
            <div class="ft-label">Статус</div>
            <q-btn-toggle v-model="filters.status" no-caps unelevated dense spread toggle-color="primary" :options="[{ label: 'Все', value: 'all' }, { label: 'Только живые', value: 'living' }, { label: 'Умершие', value: 'dead' }]" class="pp__toggle" />
            <div class="ft-label">Фото</div>
            <q-btn-toggle v-model="filters.photo" no-caps unelevated dense spread toggle-color="primary" :options="[{ label: 'Все', value: 'all' }, { label: 'Есть фото', value: 'yes' }, { label: 'Без фото', value: 'no' }]" class="pp__toggle" />
            <div class="ft-label">Связь с «Это Вы»</div>
            <q-btn-toggle v-model="filters.linked" no-caps unelevated dense spread toggle-color="primary" :options="[{ label: 'Все', value: 'all' }, { label: 'Присутствуют в древе', value: 'yes' }, { label: 'Отдельно', value: 'no' }]" class="pp__toggle" />
            <div class="pp__filters-row">
              <q-select v-model="filters.clan" :options="clans" emit-value map-options outlined dense clearable label="Род" class="col" />
              <q-select v-model="filters.century" :options="centuries" emit-value map-options outlined dense clearable label="Век рождения" class="col" />
            </div>
            <q-toggle v-model="filters.favorite" label="Только избранные" dense />
            <q-toggle v-model="filters.incomplete" label="С неполными данными" dense />
            <q-btn flat dense no-caps color="primary" label="Сбросить фильтры" class="self-start" @click="resetFilters" />
          </div>
        </q-menu>
      </q-btn>
      <q-space />
      <q-btn flat round dense icon="sym_r_view_column" class="text-muted" aria-label="Колонки">
        <q-tooltip>Настройка таблицы</q-tooltip>
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <q-list dense style="min-width: 280px" class="q-py-xs">
            <q-item-label header class="q-pb-xs">Колонки</q-item-label>
            <q-item v-for="c in allColumns.filter((x) => x.name !== 'name')" :key="c.name" tag="label" dense>
              <q-item-section side><q-checkbox :model-value="visibleNames.includes(c.name)" dense @update:model-value="(v) => toggleColumn(c.name, v)" /></q-item-section>
              <q-item-section>{{ c.label }}</q-item-section>
              <q-item-section v-if="visibleNames.includes(c.name)" side>
                <div class="row no-wrap">
                  <q-btn flat round dense size="xs" icon="sym_r_keyboard_arrow_up" @click.prevent="moveColumn(c.name, -1)" />
                  <q-btn flat round dense size="xs" icon="sym_r_keyboard_arrow_down" @click.prevent="moveColumn(c.name, 1)" />
                </div>
              </q-item-section>
            </q-item>
            <q-separator class="q-my-xs" />
            <q-item clickable dense @click="prefs.people.columns = [...DEFAULT_COLUMNS]">
              <q-item-section>Как в «Древе Жизни» (по умолчанию)</q-item-section>
            </q-item>
            <q-item tag="label" dense>
              <q-item-section>Компактные строки</q-item-section>
              <q-item-section side><q-toggle :model-value="prefs.people.density === 'compact'" dense @update:model-value="(v) => (prefs.people.density = v ? 'compact' : 'normal')" /></q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn flat round dense icon="sym_r_ios_share" class="text-muted" aria-label="Экспорт">
        <q-tooltip>Экспорт и печать</q-tooltip>
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <q-list dense style="min-width: 240px" class="q-py-xs">
            <q-item v-close-popup clickable @click="exportCsv()">
              <q-item-section avatar><q-icon name="sym_r_table" /></q-item-section>
              <q-item-section>Таблица CSV (Excel)</q-item-section>
            </q-item>
            <q-item v-close-popup clickable @click="printTable">
              <q-item-section avatar><q-icon name="sym_r_print" /></q-item-section>
              <q-item-section>Печать / PDF</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn v-if="!tree.readonly" unelevated no-caps dense color="primary" icon="sym_r_person_add" :label="$q.screen.gt.sm ? 'Создать' : undefined" class="pp__btn" @click="ui.newPerson()" />
    </div>

    <div v-if="activeFilters || search" class="pp__active no-print">
      <span class="text-muted">Показано {{ rows.length }} из {{ tree.count }}</span>
      <q-btn flat dense no-caps size="sm" color="primary" label="Сбросить" @click="resetFilters" />
    </div>

    <div class="pp__body">
      <div class="pp__table-wrap">
        <q-table
          ref="tableRef"
          v-model:pagination="pagination"
          v-model:selected="selection"
          :rows="rows"
          :columns="columns"
          row-key="id"
          flat
          :dense="prefs.people.density === 'compact'"
          :virtual-scroll="!printing"
          :virtual-scroll-item-size="prefs.people.density === 'compact' ? 36 : 52"
          :rows-per-page-options="[0]"
          hide-bottom
          selection="multiple"
          binary-state-sort
          class="pp__table"
          :class="{ 'pp__table--selected': !!tree.selectedId }"
          table-header-class="pp__thead"
          no-data-label="Никого не найдено"
        >
          <template #body="props">
            <q-tr
              :props="props"
              :class="{ 'pp__row--active': props.row.id === tree.selectedId, [`gender-${props.row.gender}`]: true }"
              @click="onRowClick($event, props.row)"
              @dblclick="nav.openPerson(props.row.id)"
              @contextmenu="onRowContext($event, props.row)"
            >
              <q-td auto-width class="no-print" @click.stop>
                <q-checkbox v-model="props.selected" dense size="sm" />
              </q-td>
              <q-td v-for="col in props.cols" :key="col.name" :props="props" :style="col.style">
                <template v-if="col.name === 'name'">
                  <div class="pp__name">
                    <PersonAvatar :person="props.row" :size="prefs.people.density === 'compact' ? 24 : 32" />
                    <div class="min-w-0">
                      <div class="pp__name-text">
                        <q-icon v-if="tree.homeId === props.row.id" name="sym_r_home" size="15px" class="text-primary" />
                        {{ col.value }}
                        <q-icon v-if="props.row.favorite" name="sym_r_star" size="14px" class="pp__fav" />
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else-if="col.name === 'living' || col.name === 'photo'">
                  <q-icon v-if="col.value" name="sym_r_check" size="18px" class="pp__check" />
                </template>
                <template v-else-if="col.name === 'note'">
                  <div class="pp__note" :title="col.value">{{ col.value }}</div>
                </template>
                <template v-else-if="col.name === 'quality'">
                  <div class="pp__q">
                    <q-linear-progress :value="col.value / 100" rounded size="5px" :color="col.value > 75 ? 'positive' : col.value > 45 ? 'warning' : 'negative'" track-color="grey-3" />
                    <span class="tabular">{{ col.value }}%</span>
                  </div>
                </template>
                <template v-else-if="col.name === 'clan' && col.value">
                  <span class="pp__clan"><i :style="{ background: tree.tree.clans[props.row.clanId]?.color }" />{{ col.value }}</span>
                </template>
                <template v-else-if="col.name === 'relation'">
                  <span class="pp__rel">{{ col.value }}</span>
                </template>
                <template v-else>{{ col.value }}</template>
              </q-td>
            </q-tr>
          </template>
          <template #no-data>
            <EmptyState compact icon="sym_r_person_search" title="Никого не найдено" text="Измените запрос или сбросьте фильтры." class="full-width">
              <template #actions><q-btn outline no-caps color="primary" label="Сбросить фильтры" @click="resetFilters" /></template>
            </EmptyState>
          </template>
        </q-table>
      </div>
      <transition name="pp-side">
        <aside v-if="showPanel" class="pp__side ft-scroll no-print">
          <PersonSummary :person-id="tree.selectedId" closable @close="panelOpen = false" />
        </aside>
      </transition>
    </div>

    <!-- Групповые действия -->
    <transition name="pp-bulk">
      <div v-if="selection.length" class="pp__bulk no-print">
        <b>Выбрано: {{ selection.length }}</b>
        <q-btn flat dense no-caps icon="sym_r_diversity_1" label="Род">
          <q-menu>
            <q-list dense style="min-width: 200px">
              <q-item v-for="c in clans" :key="c.value" v-close-popup clickable @click="bulkClan(c.value)">
                <q-item-section avatar style="min-width: 24px"><span class="pp__dot" :style="{ background: c.color }" /></q-item-section>
                <q-item-section>{{ c.label }}</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="bulkClan(null)"><q-item-section class="text-muted">Без рода</q-item-section></q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn flat dense no-caps icon="sym_r_star" label="В избранное" @click="bulkFavorite(true)" />
        <q-btn flat dense no-caps icon="sym_r_table" label="CSV" @click="exportCsv(true)" />
        <q-btn v-if="selection.length === 2" flat dense no-caps icon="sym_r_merge" label="Объединить" @click="ui.merge(selection[0].id, selection[1].id)" />
        <q-btn flat dense no-caps icon="sym_r_delete" label="Удалить" class="text-negative" @click="bulkDelete" />
        <q-space />
        <q-btn flat round dense icon="sym_r_close" aria-label="Снять выделение" @click="selection = []" />
      </div>
    </transition>

    <div ref="ctxTarget" class="pp__ctx" :style="ctx ? { left: ctx.x + 'px', top: ctx.y + 'px' } : {}" />
    <q-menu v-if="ctx" v-model="ctxOpen" :target="ctxTarget" no-parent-event anchor="top left" self="top left">
      <div class="pp__ctx-head">{{ formalName(tree.person(ctx.id)) }}</div>
      <PersonMenuList :person-id="ctx.id" @done="ctx = null" />
    </q-menu>
  </div>
</template>

<style scoped lang="scss">
.pp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  outline: none;
  position: relative;
}
.pp__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--ft-surface);
  border-bottom: 1px solid var(--ft-border);
  flex-wrap: wrap;
}
.pp__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-right: 6px;
}
.pp__search {
  width: 320px;
  max-width: 100%;
}
.pp__btn {
  height: 40px;
  padding: 0 12px;
}
.pp__filters {
  width: 400px;
  max-width: 94vw;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pp__filters-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.pp__toggle {
  border: 1px solid var(--ft-border);
  border-radius: 10px;
}
.pp__active {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 13px;
  background: var(--ft-warning-soft);
}
.pp__body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.pp__table-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
}
.pp__table {
  flex: 1;
  min-width: 0;
  height: 100%;
  border-radius: 0;
  background: var(--ft-surface);
  :deep(.q-table__middle) {
    max-height: 100%;
  }
  :deep(thead tr th) {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--ft-surface-2);
    font-size: 12px;
    font-weight: 650;
    color: var(--ft-muted);
    border-bottom: 1px solid var(--ft-border);
    white-space: nowrap;
  }
  :deep(tbody tr) {
    cursor: pointer;
  }
  :deep(tbody td) {
    border-bottom-color: var(--ft-border);
    font-size: 13.5px;
  }
  :deep(tbody tr:hover) {
    background: var(--ft-surface-2);
  }
}
.pp__row--active {
  background: color-mix(in srgb, var(--ft-primary-soft) 70%, transparent) !important;
  box-shadow: inset 3px 0 0 var(--ft-primary);
}
.pp__name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pp__name-text {
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 380px;
}
.pp__fav {
  color: #e0a526;
}
.pp__check {
  color: var(--ft-positive);
}
.pp__note {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
  font-size: 12.5px;
  color: var(--ft-text-2);
  line-height: 1.35;
}
.pp__rel {
  color: var(--g);
  font-weight: 550;
}
.pp__q {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ft-muted);
  .q-linear-progress {
    width: 60px;
  }
}
.pp__clan {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  i {
    width: 9px;
    height: 9px;
    border-radius: 3px;
  }
}
.pp__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.pp__side {
  position: relative;
  z-index: 2;
  width: 360px;
  flex: none;
  overflow-y: auto;
  background: var(--ft-surface);
  border-left: 1px solid var(--ft-border);
}
.pp__bulk {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 6px 16px;
  border-radius: 14px;
  background: #1f242d;
  color: #fff;
  box-shadow: var(--ft-shadow-lg);
  width: max-content;
  max-width: calc(100% - 24px);
  flex-wrap: wrap;
  b {
    margin-right: 8px;
  }
}
.pp__ctx {
  position: fixed;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.pp__ctx-head {
  padding: 10px 16px 4px;
  font-weight: 700;
  font-size: 13px;
  color: var(--ft-muted);
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pp-side-enter-active,
.pp-side-leave-active {
  transition:
    margin 0.2s var(--ft-ease),
    opacity 0.2s;
}
.pp-side-enter-from,
.pp-side-leave-to {
  margin-right: -360px;
  opacity: 0;
}
.pp-bulk-enter-active,
.pp-bulk-leave-active {
  transition: 0.2s;
}
.pp-bulk-enter-from,
.pp-bulk-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
@media (max-width: 700px) {
  .pp__search {
    width: 100%;
    order: 5;
  }
}
@media print {
  .pp {
    height: auto;
  }
  .pp__table :deep(.q-table__middle) {
    max-height: none !important;
    overflow: visible !important;
  }
}
</style>
