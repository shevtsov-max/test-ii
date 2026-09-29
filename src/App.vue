<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import AppHeader from '@/components/layout/AppHeader.vue'
import PersonPanel from '@/components/layout/PersonPanel.vue'
import FamilyView from '@/components/views/FamilyView.vue'
import PedigreeView from '@/components/views/PedigreeView.vue'
import FanView from '@/components/views/FanView.vue'
import ListView from '@/components/views/ListView.vue'
import PersonFormDialog from '@/components/dialogs/PersonFormDialog.vue'
import ProfileDialog from '@/components/dialogs/ProfileDialog.vue'
import FamilyDialog from '@/components/dialogs/FamilyDialog.vue'
import FactDialog from '@/components/dialogs/FactDialog.vue'
import DataDialog from '@/components/dialogs/DataDialog.vue'
import HelpDialog from '@/components/dialogs/HelpDialog.vue'
import { useTreeStore } from '@/stores/tree'

const $q = useQuasar()
const store = useTreeStore()

watch(
  () => store.ui.dark,
  (v) => $q.dark.set(v),
  { immediate: true },
)
watch(
  () => store.saveError,
  (e) => e && $q.notify({ type: 'warning', message: e, timeout: 6000 }),
)

// На телефонах панель персоны по умолчанию скрыта
if ($q.screen.width < 1024 || window.innerWidth < 1024) store.ui.panelOpen = false

const drawer = computed({
  get: () => store.ui.panelOpen,
  set: (v) => (store.ui.panelOpen = v),
})

function onKey(e) {
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    store.redo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <q-layout view="hHh Lpr lff" class="app">
    <AppHeader />

    <q-drawer
      v-model="drawer"
      side="left"
      :width="340"
      :breakpoint="1024"
      bordered
      class="app__drawer"
    >
      <PersonPanel />
    </q-drawer>

    <q-page-container>
      <q-page class="app__page">
        <q-btn
          v-if="!drawer && store.ui.view !== 'list'"
          class="app__panel-toggle"
          round
          unelevated
          size="sm"
          icon="sym_r_left_panel_open"
          @click="drawer = true"
        >
          <q-tooltip anchor="center right" self="center left">Показать панель персоны</q-tooltip>
        </q-btn>
        <transition name="view" mode="out-in">
          <FamilyView v-if="store.ui.view === 'family'" key="family" />
          <PedigreeView v-else-if="store.ui.view === 'pedigree'" key="pedigree" />
          <FanView v-else-if="store.ui.view === 'fan'" key="fan" />
          <ListView v-else key="list" />
        </transition>
      </q-page>
    </q-page-container>

    <PersonFormDialog />
    <ProfileDialog />
    <FamilyDialog />
    <FactDialog />
    <DataDialog />
    <HelpDialog />
  </q-layout>
</template>

<style lang="scss">
.app__page {
  position: relative;
  height: calc(100vh - var(--header-h, 60px));
  min-height: 0 !important;
  display: flex;
  flex-direction: column;
  > .column,
  > div:not(.q-btn) {
    flex: 1;
    min-height: 0;
  }
}
.app__drawer {
  background: var(--ft-surface);
}
.app__panel-toggle {
  position: absolute !important;
  left: 12px;
  top: 68px;
  z-index: 6;
  background: var(--ft-surface);
  color: var(--ft-muted);
  border: 1px solid var(--ft-border);
  box-shadow: var(--ft-shadow);
}
.view-enter-active,
.view-leave-active {
  transition: opacity 0.18s ease;
}
.view-enter-from,
.view-leave-to {
  opacity: 0;
}
</style>
