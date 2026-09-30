<script setup>
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'

const emit = defineEmits(['menu'])
const route = useRoute()
const ui = useUiStore()
const nav = useTreeNav()
const items = [
  { name: 'tree-chart', label: 'Древо', icon: 'sym_r_account_tree' },
  { name: 'tree-people', label: 'Персоны', icon: 'sym_r_groups', match: ['tree-person'] },
  { name: 'tree-overview', label: 'Обзор', icon: 'sym_r_space_dashboard' },
]
</script>

<template>
  <nav class="mn" aria-label="Навигация">
    <router-link v-for="it in items" :key="it.name" :to="nav.to(it.name)" class="mn__item" :class="{ active: route.name === it.name || it.match?.includes(route.name) }">
      <q-icon :name="it.icon" size="22px" />
      <span>{{ it.label }}</span>
    </router-link>
    <button type="button" class="mn__item" @click="ui.commandOpen = true">
      <q-icon name="sym_r_search" size="22px" />
      <span>Поиск</span>
    </button>
    <button type="button" class="mn__item" @click="emit('menu')">
      <q-icon name="sym_r_menu" size="22px" />
      <span>Ещё</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.mn {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border-top: 1px solid var(--ft-border);
  background: var(--ft-surface);
  padding-bottom: env(safe-area-inset-bottom);
  flex: none;
}
.mn__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 7px 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ft-muted);
  border: 0;
  background: none;
  font-family: inherit;
  text-decoration: none !important;
  cursor: pointer;
  &.active {
    color: var(--ft-primary-text);
  }
}
</style>
