<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import SaveIndicator from '@/components/ui/SaveIndicator.vue'
import UserMenu from '@/components/ui/UserMenu.vue'
import { useTreeStore } from '@/stores/tree'
import { useTreesStore } from '@/stores/trees'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { shortName } from '@/domain/names'

const emit = defineEmits(['menu'])
const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const tree = useTreeStore()
const trees = useTreesStore()
const ui = useUiStore()
const nav = useTreeNav()
const { uploadFor } = useMediaUpload()

onMounted(() => {
  if (!trees.loaded) trees.fetch().catch(() => {})
})

const section = computed(() => {
  if (route.name === 'tree-person') {
    const p = tree.person(route.params.personId)
    return p ? shortName(p) : 'Персона'
  }
  return route.meta.title ?? ''
})
const otherTrees = computed(() => trees.list.filter((t) => t.id !== tree.treeId).slice(0, 6))
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function rename() {
  $q.dialog({
    title: 'Название древа',
    prompt: { model: tree.tree?.name ?? '', type: 'text', outlined: true, isValid: (v) => !!v.trim() },
    cancel: { flat: true, label: 'Отмена', noCaps: true },
    ok: { unelevated: true, label: 'Сохранить', color: 'primary', noCaps: true },
  }).onOk((v) => tree.updateInfo({ name: v.trim() }))
}

function undo() {
  const l = tree.undo()
  if (l) $q.notify({ message: `Отменено: ${l}`, timeout: 1500 })
}
function redo() {
  const l = tree.redo()
  if (l) $q.notify({ message: `Повторено: ${l}`, timeout: 1500 })
}
function addRelativeToSelected() {
  if (tree.selectedId) ui.addOverlayFor = null
  if (tree.selectedId) ui.addRelative(tree.selectedId, null)
}
</script>

<template>
  <header class="th">
    <q-btn flat round dense icon="sym_r_menu" class="lt-md" aria-label="Меню" @click="emit('menu')" />

    <div class="th__crumbs">
      <q-btn flat no-caps dense class="th__tree" icon-right="sym_r_unfold_more">
        <span class="ellipsis-1">{{ tree.tree?.name ?? 'Древо' }}</span>
        <q-menu anchor="bottom left" self="top left" :offset="[0, 6]">
          <q-list style="min-width: 280px" class="q-py-xs">
            <q-item-label header class="q-pb-xs">Это древо</q-item-label>
            <q-item v-close-popup clickable :disable="tree.readonly" @click="rename">
              <q-item-section avatar><q-icon name="sym_r_edit" /></q-item-section>
              <q-item-section>Переименовать</q-item-section>
            </q-item>
            <q-item v-close-popup clickable :to="nav.to('tree-settings')">
              <q-item-section avatar><q-icon name="sym_r_settings" /></q-item-section>
              <q-item-section>Настройки, импорт и экспорт</q-item-section>
            </q-item>
            <template v-if="otherTrees.length">
              <q-separator class="q-my-xs" />
              <q-item-label header class="q-pb-xs">Другие древа</q-item-label>
              <q-item v-for="t in otherTrees" :key="t.id" v-close-popup clickable @click="router.push({ name: 'tree-chart', params: { treeId: t.id } })">
                <q-item-section avatar><q-icon name="sym_r_account_tree" /></q-item-section>
                <q-item-section>
                  <q-item-label class="ellipsis-1">{{ t.name }}</q-item-label>
                  <q-item-label caption>{{ t.persons }} персон</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <q-separator class="q-my-xs" />
            <q-item v-close-popup clickable :to="{ name: 'dashboard' }">
              <q-item-section avatar><q-icon name="sym_r_forest" /></q-item-section>
              <q-item-section>Все древа</q-item-section>
            </q-item>
            <q-item v-close-popup clickable :to="{ name: 'new-tree' }">
              <q-item-section avatar><q-icon name="sym_r_add" /></q-item-section>
              <q-item-section>Новое древо</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <template v-if="section">
        <q-icon name="sym_r_chevron_right" size="18px" class="text-faint gt-xs" />
        <span class="th__section gt-xs ellipsis-1">{{ section }}</span>
      </template>
    </div>

    <q-space />

    <button class="th__search" type="button" @click="ui.commandOpen = true">
      <q-icon name="sym_r_search" size="18px" />
      <span class="th__search-text">Поиск людей и разделов</span>
      <span class="th__search-kbd"><span class="ft-kbd">{{ isMac ? '⌘' : 'Ctrl' }}</span> <span class="ft-kbd">K</span></span>
    </button>

    <div class="th__tools">
      <q-btn flat round dense icon="sym_r_undo" :disable="!tree.canUndo" class="gt-xs" aria-label="Отменить" @click="undo">
        <q-tooltip>Отменить{{ tree.undoLabel ? `: ${tree.undoLabel}` : '' }} (Ctrl+Z)</q-tooltip>
      </q-btn>
      <q-btn flat round dense icon="sym_r_redo" :disable="!tree.canRedo" class="gt-sm" aria-label="Повторить" @click="redo">
        <q-tooltip>Повторить{{ tree.redoLabel ? `: ${tree.redoLabel}` : '' }} (Ctrl+Shift+Z)</q-tooltip>
      </q-btn>
      <SaveIndicator />
      <q-btn v-if="!tree.readonly" unelevated no-caps no-wrap color="primary" icon="sym_r_add" class="th__add" :label="$q.screen.gt.sm ? 'Добавить' : undefined">
        <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
          <q-list style="min-width: 270px" class="q-py-xs">
            <q-item v-close-popup clickable :disable="!tree.selectedId" @click="addRelativeToSelected">
              <q-item-section avatar><q-icon name="sym_r_person_add" /></q-item-section>
              <q-item-section>
                <q-item-label>Родственника</q-item-label>
                <q-item-label caption>{{ tree.selected ? `для ${shortName(tree.selected)}` : 'выберите персону' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-close-popup clickable @click="ui.newPerson()">
              <q-item-section avatar><q-icon name="sym_r_person" /></q-item-section>
              <q-item-section>
                <q-item-label>Персону без связей</q-item-label>
                <q-item-label caption>связать можно позже</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator class="q-my-xs" />
            <q-item v-close-popup clickable @click="uploadFor(tree.selectedId ? [tree.selectedId] : [])">
              <q-item-section avatar><q-icon name="sym_r_add_photo_alternate" /></q-item-section>
              <q-item-section>Фото или документ</q-item-section>
            </q-item>
            <q-item v-close-popup clickable @click="ui.editPlace()">
              <q-item-section avatar><q-icon name="sym_r_add_location_alt" /></q-item-section>
              <q-item-section>Место</q-item-section>
            </q-item>
            <q-item v-close-popup clickable @click="ui.editSource()">
              <q-item-section avatar><q-icon name="sym_r_menu_book" /></q-item-section>
              <q-item-section>Источник</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <UserMenu />
    </div>
  </header>
</template>

<style scoped lang="scss">
.th {
  height: var(--ft-header-h);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 12px;
  background: var(--ft-surface);
  border-bottom: 1px solid var(--ft-border);
  position: relative;
  z-index: 10;
}
.th__crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.th__tree {
  max-width: 280px;
  font-weight: 700;
  font-size: 14.5px;
  padding: 4px 8px;
  :deep(.q-btn__content) {
    flex-wrap: nowrap;
    min-width: 0;
  }
  :deep(.q-icon) {
    font-size: 17px;
    color: var(--ft-faint);
    margin-left: 4px;
  }
}
.th__section {
  color: var(--ft-muted);
  font-weight: 550;
  max-width: 260px;
}
.th__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  width: 300px;
  padding: 0 8px 0 12px;
  border-radius: 10px;
  border: 1px solid var(--ft-border);
  background: var(--ft-surface-2);
  color: var(--ft-muted);
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  transition: border-color 0.15s;
  &:hover {
    border-color: var(--ft-border-strong);
  }
}
.th__search-text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
.th__search-kbd {
  display: flex;
  gap: 3px;
}
.th__tools {
  display: flex;
  align-items: center;
  gap: 4px;
  .q-btn--round {
    color: var(--ft-muted);
  }
}
.th__add {
  margin: 0 4px;
}
@media (max-width: 1100px) {
  .th__search {
    width: 220px;
  }
}
@media (max-width: 860px) {
  .th__search {
    width: 38px;
    padding: 0;
    justify-content: center;
    border-color: transparent;
    background: transparent;
  }
  .th__search-text,
  .th__search-kbd {
    display: none;
  }
  .th__tree {
    max-width: 160px;
  }
}
</style>
