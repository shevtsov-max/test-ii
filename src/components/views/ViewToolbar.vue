<script setup lang="ts">
import { computed } from 'vue'
import PersonSelect from '@/components/common/PersonSelect.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ shown?: number; maxGen?: number }>()
const store = useTreeStore()
const ui = useUiStore()

const genOptions = computed(() => {
  const max = props.maxGen ?? 8
  const list = Array.from({ length: max }, (_, i) => ({ label: String(i + 1), value: i + 1 }))
  if (!props.maxGen) list.push({ label: 'Все', value: 99 })
  return list
})
const genLabel = computed(() => {
  const g = store.ui.generations
  if (props.maxGen && g > props.maxGen) return String(props.maxGen)
  return g >= 99 ? 'Все' : String(g)
})

function pick(id: string) {
  store.setFocus(id)
}
</script>

<template>
  <div class="vt row items-center no-wrap q-px-md q-gutter-x-sm">
    <div v-if="shown !== undefined" class="vt__count">
      <b>{{ shown }}</b> из {{ store.count }} персон
    </div>
    <q-space />

    <q-btn-dropdown flat no-caps dense class="vt__gen" content-class="vt__gen-menu" dropdown-icon="sym_r_keyboard_arrow_down">
      <template #label>
        <span class="text-muted q-mr-xs gt-xs">Поколения:</span>
        <q-icon name="sym_r_stacks" size="18px" class="xs q-mr-xs" />
        <b>{{ genLabel }}</b>
      </template>
      <q-list dense style="min-width: 140px">
        <q-item-label header class="q-py-sm">Поколений вверх/вниз</q-item-label>
        <q-item
          v-for="o in genOptions"
          :key="o.value"
          v-close-popup
          clickable
          :active="store.ui.generations === o.value"
          active-class="text-primary text-weight-bold"
          @click="store.ui.generations = o.value"
        >
          <q-item-section>{{ o.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <PersonSelect class="vt__search" dense :model-value="null" @pick="pick" />

    <q-btn flat round dense icon="sym_r_tune" class="text-muted">
      <q-tooltip>Настройки отображения</q-tooltip>
      <q-menu anchor="bottom right" self="top right">
        <q-list style="min-width: 270px" class="q-py-sm">
          <q-item-label header class="q-pb-xs">Отображение</q-item-label>
          <q-item v-ripple tag="label" dense>
            <q-item-section>Фотографии</q-item-section>
            <q-item-section side><q-toggle v-model="store.ui.showPhotos" dense /></q-item-section>
          </q-item>
          <q-item v-ripple tag="label" dense>
            <q-item-section>Годы жизни</q-item-section>
            <q-item-section side><q-toggle v-model="store.ui.showYears" dense /></q-item-section>
          </q-item>
          <q-item v-ripple tag="label" dense>
            <q-item-section>Родство с Вами</q-item-section>
            <q-item-section side><q-toggle v-model="store.ui.showRelation" dense /></q-item-section>
          </q-item>
          <q-item v-ripple tag="label" dense>
            <q-item-section>Братья, сёстры и другие партнёры</q-item-section>
            <q-item-section side><q-toggle v-model="store.ui.siblings" dense /></q-item-section>
          </q-item>
          <q-item v-ripple tag="label" dense>
            <q-item-section>Подсказки «Добавить отца/мать»</q-item-section>
            <q-item-section side><q-toggle v-model="store.ui.placeholders" dense /></q-item-section>
          </q-item>
          <q-separator class="q-my-sm" />
          <q-item v-ripple tag="label" dense>
            <q-item-section avatar><q-icon name="sym_r_dark_mode" /></q-item-section>
            <q-item-section>Тёмная тема</q-item-section>
            <q-item-section side><q-toggle v-model="store.ui.dark" dense /></q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
    <q-btn flat round dense icon="sym_r_help" class="text-muted" @click="ui.helpOpen = true">
      <q-tooltip>Справка</q-tooltip>
    </q-btn>
  </div>
</template>

<style scoped lang="scss">
.vt {
  height: 56px;
  flex: none;
  background: var(--ft-surface);
  border-bottom: 1px solid var(--ft-border);
  position: relative;
  z-index: 2;
}
.vt__count {
  font-size: 13px;
  color: var(--ft-muted);
  white-space: nowrap;
  b {
    color: var(--ft-text);
  }
}
.vt__search {
  width: 260px;
  :deep(.q-field__control) {
    border-radius: 999px;
    height: 38px;
    min-height: 38px;
  }
}
@media (max-width: 700px) {
  .vt__search {
    width: 160px;
  }
}
@media (max-width: 460px) {
  .vt__count {
    display: none;
  }
}
</style>
