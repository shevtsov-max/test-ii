<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import TreeSidebar from '@/components/workspace/TreeSidebar.vue'
import TreeHeader from '@/components/workspace/TreeHeader.vue'
import MobileNav from '@/components/workspace/MobileNav.vue'
import CommandPalette from '@/components/workspace/CommandPalette.vue'
import ShortcutsDialog from '@/components/dialogs/ShortcutsDialog.vue'
import PersonEditorDialog from '@/components/dialogs/PersonEditorDialog.vue'
import RelativeDialog from '@/components/dialogs/RelativeDialog.vue'
import FamilyDialog from '@/components/dialogs/FamilyDialog.vue'
import EventDialog from '@/components/dialogs/EventDialog.vue'
import MediaViewer from '@/components/media/MediaViewer.vue'
import MediaEditorDialog from '@/components/media/MediaEditorDialog.vue'
import PlaceDialog from '@/components/dialogs/PlaceDialog.vue'
import SourceDialog from '@/components/dialogs/SourceDialog.vue'
import MergeDialog from '@/components/dialogs/MergeDialog.vue'
import KinshipDialog from '@/components/dialogs/KinshipDialog.vue'
import DelegateDialog from '@/components/dialogs/DelegateDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePrefsStore } from '@/stores/prefs'
import { useTreeNav } from '@/composables/useTreeNav'
import { usePersonActions } from '@/composables/usePersonActions'
import { errorMessage } from '@/api'

const props = defineProps({ treeId: { type: String, required: true } })
const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const tree = useTreeStore()
const ui = useUiStore()
const prefs = usePrefsStore()
const nav = useTreeNav()
const actions = usePersonActions()

const drawer = ref(false)
const mini = computed(() => prefs.sidebarCollapsed && $q.screen.gt.sm)
const fullBleed = computed(() => !!route.meta.fullBleed)

watch(
  () => props.treeId,
  (id) => id && tree.open(id),
  { immediate: true },
)
watch(
  () => route.fullPath,
  () => (drawer.value = false),
)
watch(
  () => tree.externalChange,
  (v) => {
    if (!v) return
    tree.externalChange = false
    $q.notify({
      message: 'Древо изменено в другой вкладке',
      timeout: 0,
      actions: [
        { label: 'Загрузить', color: 'primary', handler: () => tree.reloadFromServer() },
        { label: 'Позже', color: 'white' },
      ],
    })
  },
)

// ------------------------------------------------------------------ клавиши
let chord = null
let chordTimer
function onKey(e) {
  const t = e.target
  const typing = t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  if (mod && k === 'k') {
    e.preventDefault()
    ui.commandOpen = true
    return
  }
  if (typing) return
  if (document.querySelector('.q-dialog')) return
  if (mod && k === 'z' && !e.shiftKey) {
    e.preventDefault()
    const l = tree.undo()
    if (l) $q.notify({ message: `Отменено: ${l}`, timeout: 1500 })
  } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
    e.preventDefault()
    const l = tree.redo()
    if (l) $q.notify({ message: `Повторено: ${l}`, timeout: 1500 })
  } else if (e.altKey && !mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    // Alt+← / Alt+→ — история центра древа (как «Назад»/«Вперёд» в браузере)
    e.preventDefault()
    if (e.key === 'ArrowLeft') tree.focusBack()
    else tree.focusForward()
  } else if (mod || e.altKey) {
    return
  } else if (e.key === '/') {
    e.preventDefault()
    ui.commandOpen = true
  } else if (e.key === '?') ui.shortcutsOpen = true
  else if (chord === 'g') {
    const map = { d: 'tree-chart', p: 'tree-people', o: 'tree-overview', e: 'tree-events', m: 'tree-media', s: 'tree-stats', r: 'tree-reports' }
    chord = null
    if (map[k]) nav.go(map[k])
  } else if (k === 'g') {
    chord = 'g'
    clearTimeout(chordTimer)
    chordTimer = setTimeout(() => (chord = null), 900)
  } else if (tree.selectedId) {
    const id = tree.selectedId
    if (e.key === 'F3') nav.openPerson(id)
    else if (e.key === 'F4' && tree.canEdit(id)) ui.editPerson(id)
    else if (e.key === 'F5') nav.showInChart(id)
    else if (e.key === 'F8' && tree.canEdit(id)) actions.remove(id)
    else if (k === 'a' && tree.canEdit(id)) ui.addRelative(id, null)
    else return
    e.preventDefault()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  tree.flush()
})
</script>

<template>
  <div class="tl" :class="{ 'tl--mini': mini }">
    <aside class="tl__side gt-sm no-print">
      <TreeSidebar :mini="mini" />
    </aside>

    <transition name="tl-drawer">
      <div v-if="drawer" class="tl__drawer lt-md no-print" @click.self="drawer = false">
        <div class="tl__drawer-panel">
          <TreeSidebar @navigate="drawer = false" />
        </div>
      </div>
    </transition>

    <div class="tl__body">
      <TreeHeader class="no-print" @menu="drawer = true" />
      <main class="tl__main" :class="{ 'tl__main--bleed': fullBleed, 'ft-scroll': !fullBleed }">
        <div v-if="tree.status === 'loading' || (tree.status === 'idle' && !tree.tree)" class="tl__state">
          <q-spinner-dots size="42px" color="primary" />
          <div class="text-muted q-mt-sm">Открываем древо…</div>
        </div>
        <EmptyState
          v-else-if="tree.status === 'error'"
          icon="sym_r_error"
          :title="tree.error?.code === 'NOT_FOUND' ? 'Древо не найдено' : 'Не удалось открыть древо'"
          :text="tree.error?.code === 'NOT_FOUND' ? 'Возможно, оно удалено или у вас нет доступа.' : errorMessage(tree.error)"
        >
          <template #actions>
            <q-btn unelevated no-caps color="primary" label="К списку древ" :to="{ name: 'dashboard' }" />
            <q-btn v-if="tree.error?.code !== 'NOT_FOUND'" outline no-caps color="primary" label="Повторить" @click="tree.open(treeId)" />
          </template>
        </EmptyState>
        <router-view v-else-if="tree.tree" v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="route.name === 'tree-person' ? 'person' : route.name" />
          </transition>
        </router-view>
      </main>
      <MobileNav class="lt-md no-print" @menu="drawer = true" />
    </div>

    <template v-if="tree.tree">
      <PersonEditorDialog />
      <RelativeDialog />
      <FamilyDialog />
      <EventDialog />
      <MediaViewer />
      <MediaEditorDialog />
      <PlaceDialog />
      <SourceDialog />
      <MergeDialog />
      <KinshipDialog />
      <DelegateDialog />
      <CommandPalette />
    </template>
    <ShortcutsDialog />
  </div>
</template>

<style scoped lang="scss">
.tl {
  display: grid;
  grid-template-columns: var(--ft-sidebar-w) minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--ft-bg);
}
.tl--mini {
  grid-template-columns: var(--ft-sidebar-w-collapsed) minmax(0, 1fr);
}
.tl__side {
  border-right: 1px solid var(--ft-border);
  min-height: 0;
  overflow: hidden;
}
.tl__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.tl__main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  position: relative;
}
.tl__main--bleed {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  > * {
    flex: 1;
    min-height: 0;
  }
}
.tl__state {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.tl__drawer {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: var(--ft-overlay);
}
.tl__drawer-panel {
  width: 290px;
  max-width: 86vw;
  height: 100%;
  box-shadow: var(--ft-shadow-lg);
}
.tl-drawer-enter-active,
.tl-drawer-leave-active {
  transition: opacity 0.2s;
  .tl__drawer-panel {
    transition: transform 0.25s var(--ft-ease);
  }
}
.tl-drawer-enter-from,
.tl-drawer-leave-to {
  opacity: 0;
  .tl__drawer-panel {
    transform: translateX(-100%);
  }
}
@media (max-width: 1023px) {
  .tl,
  .tl--mini {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media print {
  .tl {
    display: block;
    height: auto;
    overflow: visible;
  }
  .tl__main {
    overflow: visible;
  }
}
</style>
