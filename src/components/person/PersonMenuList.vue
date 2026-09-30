<script setup>
/**
 * Список действий с персоной — используется в контекстном меню древа, таблице и профиле.
 */
import { computed } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { useTreeNav } from '@/composables/useTreeNav'
import { usePersonActions } from '@/composables/usePersonActions'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { CHART_SCOPES } from '@/domain/layout'

const props = defineProps({
  personId: { type: String, required: true },
  hideOpen: Boolean,
})
const emit = defineEmits(['done'])
const tree = useTreeStore()
const ui = useUiStore()
const nav = useTreeNav()
const actions = usePersonActions()
const { uploadFor } = useMediaUpload()

const p = computed(() => tree.person(props.personId))
const can = computed(() => {
  const { father, mother, family } = tree.graph.parents(props.personId)
  const full = (family?.partners.length ?? 0) >= 2
  return { father: !father && !full, mother: !mother && !full }
})
const relatives = computed(() => [
  { kind: 'father', label: 'Отца', g: 'M', disable: !can.value.father },
  { kind: 'mother', label: 'Мать', g: 'F', disable: !can.value.mother },
  { kind: 'brother', label: 'Брата', g: 'M' },
  { kind: 'sister', label: 'Сестру', g: 'F' },
  { kind: 'partner', label: p.value?.gender === 'F' ? 'Мужа или партнёра' : 'Жену или партнёршу', g: p.value?.gender === 'F' ? 'M' : 'F' },
  { kind: 'son', label: 'Сына', g: 'M' },
  { kind: 'daughter', label: 'Дочь', g: 'F' },
])
const isHome = computed(() => tree.homeId === props.personId)
const hasParents = computed(() => !!tree.graph.parentFamily(props.personId))

function run(fn) {
  emit('done')
  fn()
}
</script>

<template>
  <q-list v-if="p" dense style="min-width: 260px" class="q-py-xs">
    <q-item v-if="!hideOpen" clickable @click="run(() => nav.openPerson(personId))">
      <q-item-section avatar><q-icon name="sym_r_badge" /></q-item-section>
      <q-item-section>Открыть профиль</q-item-section>
      <q-item-section side><span class="ft-kbd">F3</span></q-item-section>
    </q-item>
    <q-item v-if="!tree.readonly" clickable @click="run(() => ui.editPerson(personId))">
      <q-item-section avatar><q-icon name="sym_r_edit" /></q-item-section>
      <q-item-section>Изменить</q-item-section>
      <q-item-section side><span class="ft-kbd">F4</span></q-item-section>
    </q-item>
    <q-item v-if="!tree.readonly" clickable>
      <q-item-section avatar><q-icon name="sym_r_person_add" /></q-item-section>
      <q-item-section>Добавить родственника</q-item-section>
      <q-item-section side><q-icon name="sym_r_chevron_right" /></q-item-section>
      <q-menu anchor="top end" self="top start" :offset="[4, 0]">
        <q-list dense style="min-width: 220px" class="q-py-xs">
          <q-item v-for="r in relatives" :key="r.kind" clickable :disable="r.disable" @click="run(() => ui.addRelative(personId, r.kind))">
            <q-item-section avatar style="min-width: 38px"><PersonAvatar :gender="r.g" :size="26" /></q-item-section>
            <q-item-section>{{ r.label }}</q-item-section>
          </q-item>
          <q-separator class="q-my-xs" />
          <q-item clickable @click="run(() => ui.addRelative(personId, 'father', null, 'adopted'))">
            <q-item-section avatar style="min-width: 38px"><q-icon name="sym_r_family_restroom" /></q-item-section>
            <q-item-section>Приёмных родителей</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-item>
    <q-separator class="q-my-xs" />
    <q-item clickable>
      <q-item-section avatar><q-icon name="sym_r_account_tree" /></q-item-section>
      <q-item-section>Построить древо</q-item-section>
      <q-item-section side><q-icon name="sym_r_chevron_right" /></q-item-section>
      <q-menu anchor="top end" self="top start" :offset="[4, 0]">
        <q-list dense style="min-width: 280px" class="q-py-xs">
          <q-item v-for="s in CHART_SCOPES" :key="s.value" clickable @click="run(() => nav.showInChart(personId, s.value))">
            <q-item-section avatar><q-icon :name="s.icon" /></q-item-section>
            <q-item-section>{{ s.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-item>
    <q-item clickable>
      <q-item-section avatar><q-icon name="sym_r_format_list_numbered" /></q-item-section>
      <q-item-section>Построить роспись</q-item-section>
      <q-item-section side><q-icon name="sym_r_chevron_right" /></q-item-section>
      <q-menu anchor="top end" self="top start" :offset="[4, 0]">
        <q-list dense style="min-width: 260px" class="q-py-xs">
          <q-item clickable @click="run(() => nav.openReport(personId, 'descendants'))">
            <q-item-section avatar><q-icon name="sym_r_south" /></q-item-section>
            <q-item-section>Поколенная (потомки)</q-item-section>
          </q-item>
          <q-item clickable @click="run(() => nav.openReport(personId, 'ancestors'))">
            <q-item-section avatar><q-icon name="sym_r_north" /></q-item-section>
            <q-item-section>Восходящая (предки)</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-item>
    <q-item v-if="!isHome && tree.homeId" clickable @click="run(() => ui.kinship(tree.homeId, personId))">
      <q-item-section avatar><q-icon name="sym_r_family_restroom" /></q-item-section>
      <q-item-section>Как мы связаны?</q-item-section>
    </q-item>
    <template v-if="!tree.readonly">
      <q-separator class="q-my-xs" />
      <q-item clickable @click="run(() => uploadFor([personId], { avatar: true }))">
        <q-item-section avatar><q-icon name="sym_r_add_a_photo" /></q-item-section>
        <q-item-section>Загрузить фото</q-item-section>
      </q-item>
      <q-item clickable @click="run(() => actions.toggleFavorite(personId))">
        <q-item-section avatar><q-icon :name="p.favorite ? 'sym_r_star' : 'sym_r_star'" :class="{ 'text-amber-8': p.favorite }" /></q-item-section>
        <q-item-section>{{ p.favorite ? 'Убрать из избранного' : 'В избранное' }}</q-item-section>
      </q-item>
      <q-item clickable :disable="isHome" @click="run(() => actions.setHome(personId))">
        <q-item-section avatar><q-icon name="sym_r_home" /></q-item-section>
        <q-item-section>{{ isHome ? 'Это Вы' : 'Это я («Это Вы»)' }}</q-item-section>
      </q-item>
      <q-item v-if="hasParents" clickable @click="run(() => actions.detachFromParents(personId))">
        <q-item-section avatar><q-icon name="sym_r_link_off" /></q-item-section>
        <q-item-section>Отвязать от родителей</q-item-section>
      </q-item>
      <q-separator class="q-my-xs" />
      <q-item clickable class="text-negative" @click="run(() => actions.remove(personId))">
        <q-item-section avatar><q-icon name="sym_r_delete" color="negative" /></q-item-section>
        <q-item-section>Удалить</q-item-section>
        <q-item-section side><span class="ft-kbd">F8</span></q-item-section>
      </q-item>
    </template>
  </q-list>
</template>
