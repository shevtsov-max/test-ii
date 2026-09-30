<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePrefsStore } from '@/stores/prefs'
import { useTreeNav } from '@/composables/useTreeNav'
import { searchPersons, normalize } from '@/domain/search'
import { fullName } from '@/domain/names'
import { lifeSpan } from '@/domain/person'
import { placeFullName } from '@/domain/places'

const router = useRouter()
const tree = useTreeStore()
const ui = useUiStore()
const prefs = usePrefsStore()
const nav = useTreeNav()

const open = computed({
  get: () => ui.commandOpen,
  set: (v) => (ui.commandOpen = v),
})
const q = ref('')
const index = ref(0)
const input = ref()
const listEl = ref()

watch(open, (o) => {
  if (o) {
    q.value = ''
    index.value = 0
    nextTick(() => input.value?.focus())
  }
})

const SECTIONS = [
  ['tree-overview', 'Обзор древа', 'sym_r_space_dashboard', 'обзор главная годовщины'],
  ['tree-chart', 'Древо', 'sym_r_account_tree', 'древо схема дерево'],
  ['tree-people', 'Персоны', 'sym_r_groups', 'персоны люди таблица список'],
  ['tree-events', 'События', 'sym_r_event_note', 'события хронология'],
  ['tree-places', 'Места', 'sym_r_location_on', 'места города'],
  ['tree-media', 'Медиа и документы', 'sym_r_photo_library', 'фото документы медиа'],
  ['tree-sources', 'Источники', 'sym_r_menu_book', 'источники архивы метрические'],
  ['tree-clans', 'Роды', 'sym_r_diversity_1', 'роды фамилии'],
  ['tree-reports', 'Росписи', 'sym_r_format_list_numbered', 'роспись отчёт поколенная восходящая печать'],
  ['tree-stats', 'Статистика', 'sym_r_monitoring', 'статистика графики'],
  ['tree-check', 'Проверка данных', 'sym_r_fact_check', 'проверка ошибки дубликаты'],
  ['tree-settings', 'Настройки древа', 'sym_r_settings', 'настройки импорт экспорт gedcom резервная копия'],
]

const ACTIONS = computed(() => [
  { id: 'new-person', label: 'Добавить персону', icon: 'sym_r_person_add', keys: 'добавить новая персона человек', run: () => ui.newPerson() },
  { id: 'kinship', label: 'Кем приходится… (калькулятор родства)', icon: 'sym_r_family_restroom', keys: 'родство калькулятор кем приходится', run: () => ui.kinship(tree.homeId, tree.selectedId) },
  { id: 'theme', label: prefs.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема', icon: 'sym_r_contrast', keys: 'тема тёмная светлая', run: () => (prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark') },
  { id: 'shortcuts', label: 'Горячие клавиши', icon: 'sym_r_keyboard', keys: 'клавиши горячие', run: () => (ui.shortcutsOpen = true) },
  { id: 'trees', label: 'Все древа', icon: 'sym_r_forest', keys: 'древа главная список', run: () => router.push({ name: 'dashboard' }) },
])

const results = computed(() => {
  if (!tree.tree) return []
  const n = normalize(q.value)
  const out = []
  const persons = searchPersons(tree.tree, q.value, n ? 12 : 0)
  if (!n) {
    for (const id of tree.recent.slice(0, 6)) {
      const p = tree.person(id)
      if (p) out.push({ type: 'person', id: 'p-' + id, person: p, group: 'Недавние' })
    }
  } else for (const r of persons) out.push({ type: 'person', id: 'p-' + r.person.id, person: r.person, group: 'Люди' })
  for (const [name, label, icon, keys] of SECTIONS) {
    if (!n || normalize(label + ' ' + keys).includes(n)) out.push({ type: 'section', id: 's-' + name, name, label, icon, group: 'Разделы' })
  }
  if (n) {
    const places = Object.values(tree.tree.places)
      .filter((p) => normalize(p.name + ' ' + p.altNames).includes(n))
      .slice(0, 4)
    for (const p of places) out.push({ type: 'place', id: 'pl-' + p.id, place: p, label: placeFullName(tree.tree, p.id), group: 'Места' })
  }
  for (const a of ACTIONS.value) if (!n || normalize(a.label + ' ' + a.keys).includes(n)) out.push({ type: 'action', ...a, id: 'a-' + a.id, group: 'Действия' })
  return out
})

const grouped = computed(() => {
  const groups = []
  results.value.forEach((r, i) => {
    let g = groups.find((x) => x.title === r.group)
    if (!g) groups.push((g = { title: r.group, items: [] }))
    g.items.push({ ...r, i })
  })
  return groups
})

watch(q, () => (index.value = 0))

function choose(r) {
  open.value = false
  if (!r) return
  if (r.type === 'person') nav.openPerson(r.person.id)
  else if (r.type === 'section') nav.go(r.name)
  else if (r.type === 'place') nav.go('tree-places', { query: { place: r.place.id } })
  else r.run()
}
function showInTree(p) {
  open.value = false
  nav.showInChart(p.id)
}

function onKey(e) {
  const n = results.value.length
  if (e.key === 'ArrowDown') {
    index.value = (index.value + 1) % Math.max(1, n)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    index.value = (index.value - 1 + n) % Math.max(1, n)
    e.preventDefault()
  } else if (e.key === 'Enter') {
    const r = results.value[index.value]
    if (r?.type === 'person' && (e.ctrlKey || e.metaKey)) showInTree(r.person)
    else choose(r)
    e.preventDefault()
  } else return
  nextTick(() => listEl.value?.querySelector('.cp__item.active')?.scrollIntoView({ block: 'nearest' }))
}
</script>

<template>
  <q-dialog v-model="open" position="top" transition-show="jump-down" transition-hide="fade">
    <div class="cp">
      <div class="cp__input">
        <q-icon name="sym_r_search" size="22px" class="text-muted" />
        <input ref="input" v-model="q" placeholder="Имя, фамилия, год, место или раздел…" autocomplete="off" spellcheck="false" @keydown="onKey" />
        <span class="ft-kbd">Esc</span>
      </div>
      <div ref="listEl" class="cp__list ft-scroll">
        <template v-for="g in grouped" :key="g.title">
          <div class="cp__group">{{ g.title }}</div>
          <div
            v-for="r in g.items"
            :key="r.id"
            class="cp__item"
            :class="{ active: r.i === index }"
            role="option"
            :aria-selected="r.i === index"
            @mousemove="index = r.i"
            @click="choose(r)"
          >
            <template v-if="r.type === 'person'">
              <PersonAvatar :person="r.person" :size="32" />
              <div class="cp__text">
                <div class="fw-600 ellipsis-1">{{ fullName(r.person) }}</div>
                <div class="cp__sub ellipsis-1">{{ [lifeSpan(r.person), tree.relationToHome(r.person.id)].filter(Boolean).join(' · ') }}</div>
              </div>
              <q-btn flat dense round size="sm" icon="sym_r_account_tree" class="cp__tree" @click.stop="showInTree(r.person)">
                <q-tooltip>Показать в древе (Ctrl+Enter)</q-tooltip>
              </q-btn>
            </template>
            <template v-else>
              <span class="cp__icon"><q-icon :name="r.type === 'place' ? 'sym_r_location_on' : r.icon" size="18px" /></span>
              <div class="cp__text fw-500 ellipsis-1">{{ r.label }}</div>
            </template>
          </div>
        </template>
        <div v-if="!results.length" class="cp__empty">Ничего не найдено</div>
      </div>
      <div class="cp__foot">
        <span><span class="ft-kbd">↑</span><span class="ft-kbd">↓</span> выбрать</span>
        <span><span class="ft-kbd">Enter</span> открыть</span>
        <span><span class="ft-kbd">Ctrl</span>+<span class="ft-kbd">Enter</span> в древе</span>
      </div>
    </div>
  </q-dialog>
</template>

<style scoped lang="scss">
.cp {
  width: 640px;
  max-width: calc(100vw - 24px);
  margin-top: 10vh;
  background: var(--ft-surface);
  border-radius: 18px;
  box-shadow: var(--ft-shadow-lg);
  border: 1px solid var(--ft-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}
.cp__input {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ft-border);
  input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 16px;
    color: var(--ft-text);
  }
}
.cp__list {
  overflow-y: auto;
  padding: 6px 8px 8px;
}
.cp__group {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--ft-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 10px 4px;
}
.cp__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 10px;
  cursor: pointer;
  &.active {
    background: var(--ft-surface-3);
    .cp__tree {
      opacity: 1;
    }
  }
}
.cp__icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--ft-surface-3);
  color: var(--ft-muted);
  flex: none;
}
.cp__item.active .cp__icon {
  background: var(--ft-surface);
}
.cp__text {
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}
.cp__sub {
  font-size: 12.5px;
  color: var(--ft-muted);
}
.cp__tree {
  opacity: 0;
  color: var(--ft-muted);
}
.cp__empty {
  padding: 28px;
  text-align: center;
  color: var(--ft-muted);
}
.cp__foot {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--ft-border);
  font-size: 12px;
  color: var(--ft-muted);
  background: var(--ft-surface-2);
  .ft-kbd {
    margin-right: 3px;
  }
}
@media (max-width: 600px) {
  .cp {
    margin-top: 8px;
  }
  .cp__foot {
    display: none;
  }
}
</style>
