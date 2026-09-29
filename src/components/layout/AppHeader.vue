<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { shortName } from '@/utils/person'

const $q = useQuasar()
const store = useTreeStore()
const ui = useUiStore()

const views = [
  { value: 'family', label: 'Семейное древо', icon: 'sym_r_account_tree' },
  { value: 'pedigree', label: 'Родословная', icon: 'sym_r_family_history' },
  { value: 'fan', label: 'Веер', icon: 'sym_r_motion_photos_auto' },
  { value: 'list', label: 'Список', icon: 'sym_r_table_rows' },
]

const view = computed({
  get: () => store.ui.view,
  set: (v) => (store.ui.view = v),
})

function rename() {
  $q.dialog({
    title: 'Название древа',
    prompt: { model: store.tree.name, type: 'text', outlined: true },
    cancel: { flat: true, label: 'Отмена' },
    ok: { unelevated: true, label: 'Сохранить', color: 'primary' },
  }).onOk((v) => v.trim() && store.renameTree(v.trim()))
}
</script>

<template>
  <q-header class="hd">
    <div class="hd__row">
      <div class="hd__brand">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="currentColor" />
          <g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="32" cy="16" r="6" />
            <circle cx="16" cy="46" r="6" />
            <circle cx="48" cy="46" r="6" />
            <path d="M32 22v10M16 40v-8h32v8" />
          </g>
        </svg>
        <span class="hd__brand-name gt-md">Родословная</span>
      </div>

      <div class="hd__crumbs gt-xs">
        <button class="hd__tree" @click="rename">
          {{ store.tree.name }}
          <q-tooltip>Переименовать древо</q-tooltip>
        </button>
        <template v-if="store.selected">
          <q-icon name="sym_r_chevron_right" size="18px" class="text-muted gt-xs" />
          <span class="hd__person gt-xs">{{ shortName(store.selected) }}</span>
        </template>
      </div>

      <q-space />

      <q-tabs v-model="view" dense no-caps inline-label class="hd__tabs" active-color="primary" indicator-color="primary">
        <q-tab v-for="v in views" :key="v.value" :name="v.value" :icon="v.icon">
          <span class="gt-sm q-ml-xs">{{ v.label }}</span>
          <q-tooltip v-if="$q.screen.lt.md">{{ v.label }}</q-tooltip>
        </q-tab>
      </q-tabs>

      <div class="hd__actions">
        <q-btn flat round dense icon="sym_r_undo" :disable="!store.canUndo" @click="store.undo()">
          <q-tooltip>Отменить (Ctrl+Z)</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="sym_r_redo" :disable="!store.canRedo" class="gt-xs" @click="store.redo()">
          <q-tooltip>Повторить (Ctrl+Shift+Z)</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="sym_r_cloud_sync" @click="ui.dataOpen = true">
          <q-tooltip>Импорт, экспорт, резервные копии</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          class="gt-xs"
          :icon="store.ui.dark ? 'sym_r_light_mode' : 'sym_r_dark_mode'"
          @click="store.ui.dark = !store.ui.dark"
        >
          <q-tooltip>{{ store.ui.dark ? 'Светлая тема' : 'Тёмная тема' }}</q-tooltip>
        </q-btn>
      </div>
    </div>
  </q-header>
</template>

<style scoped lang="scss">
.hd {
  background: var(--ft-surface);
  color: var(--ft-text);
  border-bottom: 1px solid var(--ft-border);
  --header-h: 60px;
}
.hd__row {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 14px 0 16px;
}
.hd__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ft-primary);
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.02em;
  flex: none;
}
.hd__brand-name {
  color: var(--ft-text);
}
.hd__crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-left: 14px;
  border-left: 1px solid var(--ft-border);
  font-size: 14px;
}
.hd__tree {
  border: 0;
  background: transparent;
  font: inherit;
  font-weight: 700;
  color: var(--ft-text);
  cursor: pointer;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
  &:hover {
    background: var(--ft-surface-2);
  }
}
.hd__person {
  color: var(--ft-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hd__tabs {
  height: 60px;
  :deep(.q-tab) {
    height: 60px;
    padding: 0 12px;
    color: var(--ft-muted);
  }
  :deep(.q-tab--active) {
    color: var(--ft-primary);
  }
  :deep(.q-tab__label) {
    font-weight: 600;
  }
}
.hd__actions {
  display: flex;
  gap: 2px;
  padding-left: 10px;
  border-left: 1px solid var(--ft-border);
  .q-btn {
    color: var(--ft-muted);
  }
}
@media (max-width: 600px) {
  .hd__row {
    gap: 6px;
    padding: 0 6px 0 10px;
  }
  .hd__crumbs {
    padding-left: 8px;
  }
  .hd__tree {
    max-width: 120px;
  }
  .hd__tabs :deep(.q-tab) {
    padding: 0 8px;
    min-width: 0;
  }
  .hd__actions {
    padding-left: 4px;
  }
}
</style>
