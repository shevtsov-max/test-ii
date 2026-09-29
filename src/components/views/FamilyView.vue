<script setup>
import { computed } from 'vue'
import FamilyCanvas from '@/components/tree/FamilyCanvas.vue'
import ViewToolbar from './ViewToolbar.vue'
import { useTreeStore } from '@/stores/tree'
import { computeLayout } from '@/utils/layout'
import { useUiStore } from '@/stores/ui'
import PersonAvatar from '@/components/common/PersonAvatar.vue'
import { lifeSpan, shortName } from '@/utils/person'

const store = useTreeStore()
const ui = useUiStore()

const layout = computed(() => {
  const g = store.ui.generations
  return computeLayout(store.tree, store.focusId ?? '', {
    up: g,
    down: g,
    placeholders: store.ui.placeholders,
    siblings: store.ui.siblings,
  })
})
const shown = computed(() => layout.value.shownPersons.size)
</script>

<template>
  <div class="column no-wrap fit">
    <ViewToolbar :shown="shown" />
    <div class="col relative-position">
      <FamilyCanvas v-if="store.focus" :layout="layout" />
      <transition name="sheet">
        <div v-if="store.selected && !store.ui.panelOpen" class="fv__sheet" :class="`gender-${store.selected.gender}`">
          <PersonAvatar :person="store.selected" :size="40" />
          <div class="col" style="min-width: 0" @click="store.ui.panelOpen = true">
            <div class="text-weight-bold ellipsis">{{ shortName(store.selected) }}</div>
            <div class="text-caption text-muted ellipsis">
              {{ [lifeSpan(store.selected), store.relationToHome(store.selected.id)].filter(Boolean).join(' · ') }}
            </div>
          </div>
          <q-btn flat round dense icon="sym_r_edit" @click="ui.editPerson(store.selected.id)" />
          <q-btn flat round dense icon="sym_r_badge" @click="ui.openProfile(store.selected.id)" />
          <q-btn
            v-if="store.focusId !== store.selected.id"
            flat
            round
            dense
            icon="sym_r_center_focus_strong"
            @click="store.setFocus(store.selected.id)"
          />
        </div>
      </transition>
      <div v-if="!store.focus" class="absolute-center text-center text-muted">
        <q-icon name="sym_r_account_tree" size="56px" />
        <div class="q-mt-sm">Древо пусто</div>
        <q-btn class="q-mt-md" color="primary" unelevated label="Создать первую персону" @click="store.newTree()" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fv__sheet {
  position: absolute;
  left: 12px;
  bottom: 16px;
  right: 76px;
  max-width: 420px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 10px;
  border-radius: 16px;
  background: var(--ft-surface);
  border: 1px solid var(--ft-border);
  border-left: 4px solid var(--g);
  box-shadow: var(--ft-shadow-lg);
  cursor: pointer;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: 0.2s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
