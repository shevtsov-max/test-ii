<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLogo from '@/components/ui/AppLogo.vue'
import PersonAvatar from '@/components/person/PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { usePrefsStore } from '@/stores/prefs'
import { useTreeNav } from '@/composables/useTreeNav'
import { shortName } from '@/domain/names'

defineProps({ mini: Boolean })
const emit = defineEmits(['navigate'])
const route = useRoute()
const tree = useTreeStore()
const prefs = usePrefsStore()
const nav = useTreeNav()

const count = (c) => Object.keys(tree.tree?.[c] ?? {}).length
const groups = computed(() => [
  {
    items: [
      { name: 'tree-overview', label: 'Обзор', icon: 'sym_r_space_dashboard' },
      { name: 'tree-chart', label: 'Древо', icon: 'sym_r_account_tree' },
      { name: 'tree-people', label: 'Персоны', icon: 'sym_r_groups', count: tree.count, match: ['tree-person'] },
    ],
  },
  {
    title: 'Данные',
    items: [
      { name: 'tree-events', label: 'События', icon: 'sym_r_event_note' },
      { name: 'tree-places', label: 'Места', icon: 'sym_r_location_on', count: count('places') },
      { name: 'tree-media', label: 'Медиа и документы', icon: 'sym_r_photo_library', count: count('media') },
      { name: 'tree-sources', label: 'Источники', icon: 'sym_r_menu_book', count: count('sources') },
      { name: 'tree-clans', label: 'Роды', icon: 'sym_r_diversity_1', count: count('clans') },
    ],
  },
  {
    title: 'Анализ',
    items: [
      { name: 'tree-reports', label: 'Росписи', icon: 'sym_r_format_list_numbered' },
      { name: 'tree-stats', label: 'Статистика', icon: 'sym_r_monitoring' },
      { name: 'tree-check', label: 'Проверка данных', icon: 'sym_r_fact_check' },
    ],
  },
])

const active = (it) => route.name === it.name || it.match?.includes(route.name)
const favorites = computed(() => tree.persons.filter((p) => p.favorite).slice(0, 8))
const recent = computed(() =>
  tree.recent
    .filter((id) => !tree.person(id)?.favorite)
    .slice(0, 5)
    .map((id) => tree.person(id))
    .filter(Boolean),
)
</script>

<template>
  <nav class="sb" :class="{ 'sb--mini': mini }" aria-label="Разделы древа">
    <div class="sb__brand">
      <AppLogo :to="{ name: 'dashboard' }" :text="!mini" :size="30" />
    </div>
    <div class="sb__scroll ft-scroll">
      <div v-for="(g, gi) in groups" :key="gi" class="sb__group">
        <div v-if="g.title && !mini" class="sb__title">{{ g.title }}</div>
        <div v-else-if="g.title" class="sb__sep" />
        <router-link
          v-for="it in g.items"
          :key="it.name"
          :to="nav.to(it.name)"
          class="sb__item"
          :class="{ active: active(it) }"
          @click="emit('navigate')"
        >
          <q-icon :name="it.icon" size="20px" />
          <span v-if="!mini" class="sb__label">{{ it.label }}</span>
          <span v-if="!mini && it.count" class="sb__count tabular">{{ it.count }}</span>
          <q-tooltip v-if="mini" anchor="center right" self="center left" :offset="[10, 0]">{{ it.label }}</q-tooltip>
        </router-link>
      </div>

      <template v-if="!mini && (favorites.length || recent.length)">
        <div v-if="favorites.length" class="sb__group">
          <div class="sb__title">Избранное</div>
          <router-link v-for="p in favorites" :key="p.id" :to="nav.personRoute(p.id)" class="sb__person" @click="emit('navigate')">
            <PersonAvatar :person="p" :size="22" />
            <span class="ellipsis-1">{{ shortName(p) }}</span>
            <q-icon name="sym_r_star" size="14px" class="sb__star" />
          </router-link>
        </div>
        <div v-if="recent.length" class="sb__group">
          <div class="sb__title">Недавние</div>
          <router-link v-for="p in recent" :key="p.id" :to="nav.personRoute(p.id)" class="sb__person" @click="emit('navigate')">
            <PersonAvatar :person="p" :size="22" />
            <span class="ellipsis-1">{{ shortName(p) }}</span>
          </router-link>
        </div>
      </template>
    </div>
    <div class="sb__foot">
      <router-link :to="nav.to('tree-settings')" class="sb__item" :class="{ active: route.name === 'tree-settings' }" @click="emit('navigate')">
        <q-icon name="sym_r_settings" size="20px" />
        <span v-if="!mini" class="sb__label">Настройки древа</span>
        <q-tooltip v-if="mini" anchor="center right" self="center left" :offset="[10, 0]">Настройки древа</q-tooltip>
      </router-link>
      <button class="sb__item sb__collapse gt-sm" type="button" @click="prefs.sidebarCollapsed = !prefs.sidebarCollapsed">
        <q-icon :name="mini ? 'sym_r_left_panel_open' : 'sym_r_left_panel_close'" size="20px" />
        <span v-if="!mini" class="sb__label">Свернуть</span>
        <q-tooltip v-if="mini" anchor="center right" self="center left" :offset="[10, 0]">Развернуть панель</q-tooltip>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.sb {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--ft-sidebar);
}
.sb__brand {
  height: var(--ft-header-h);
  display: flex;
  align-items: center;
  padding: 0 18px;
  flex: none;
}
.sb--mini .sb__brand {
  justify-content: center;
  padding: 0;
}
.sb__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 12px;
}
.sb__group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  & + & {
    margin-top: 14px;
  }
}
.sb__title {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ft-faint);
  padding: 0 10px 6px;
}
.sb__sep {
  height: 1px;
  background: var(--ft-border);
  margin: 0 10px 10px;
}
.sb__item {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 36px;
  padding: 0 10px;
  border-radius: 9px;
  color: var(--ft-text-2);
  font-weight: 550;
  font-size: 13.5px;
  border: 0;
  background: none;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none !important;
  transition:
    background 0.12s,
    color 0.12s;
  .q-icon {
    color: var(--ft-muted);
    flex: none;
  }
  &:hover {
    background: var(--ft-surface-3);
    color: var(--ft-text);
  }
  &.active {
    background: var(--ft-surface);
    color: var(--ft-text);
    box-shadow:
      var(--ft-shadow-xs),
      inset 0 0 0 1px var(--ft-border);
    .q-icon {
      color: var(--ft-primary);
    }
  }
}
.sb--mini .sb__item {
  justify-content: center;
  padding: 0;
  width: 44px;
  margin: 0 auto;
}
.sb__label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}
.sb__count {
  font-size: 11.5px;
  color: var(--ft-faint);
  font-weight: 600;
}
.sb__person {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  color: var(--ft-text-2);
  font-size: 13px;
  text-decoration: none !important;
  &:hover {
    background: var(--ft-surface-3);
  }
}
.sb__star {
  color: #e0a526;
  margin-left: auto;
}
.sb__foot {
  padding: 8px 10px 12px;
  border-top: 1px solid var(--ft-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sb__collapse {
  width: 100%;
}
.sb--mini .sb__collapse {
  width: 44px;
}
</style>
