<script setup>
/** Плашка на карточке персоны: ветка передана родственнику (только просмотр) или ждёт ответа на приглашение. */
import { computed } from 'vue'
import { useTreeStore } from '@/stores/tree'
import { useUiStore } from '@/stores/ui'
import { usePersonActions } from '@/composables/usePersonActions'

const props = defineProps({
  personId: { type: String, required: true },
  compact: Boolean,
})
const tree = useTreeStore()
const ui = useUiStore()
const actions = usePersonActions()

const active = computed(() => tree.delegationOf(props.personId))
const pending = computed(() => (tree.role === 'owner' ? tree.pendingDelegationOf(props.personId) : null))
const isOwner = computed(() => tree.role === 'owner')
</script>

<template>
  <div v-if="active || pending" class="bn no-print" :class="{ 'bn--pending': !active, 'bn--compact': compact }">
    <q-icon :name="active ? 'sym_r_lock' : 'sym_r_schedule_send'" size="18px" class="bn__icon" />
    <div class="bn__text">
      <template v-if="active">
        <b>Ветку ведёт {{ active.delegateName || 'родственник' }}</b>
        <span>Вы видите все его изменения, но править ветку нельзя.</span>
      </template>
      <template v-else>
        <b>Ветка ждёт родственника</b>
        <span>{{ pending.email ? `Приглашение отправлено на ${pending.email}.` : 'Ссылка-приглашение создана.' }} Пока его не приняли, ветку можно править.</span>
      </template>
    </div>
    <div class="bn__actions">
      <q-btn v-if="active && isOwner" unelevated dense no-caps no-wrap color="primary" icon="sym_r_content_copy" label="Склонировать себе" class="q-px-sm" @click="actions.cloneBranch(active)" />
      <q-btn v-if="isOwner" flat dense no-caps no-wrap color="primary" :label="active ? 'Подробнее' : 'Ссылка'" @click="ui.delegate(personId)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.bn {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 12px;
  padding: 10px 12px 10px 14px;
  border-radius: 12px;
  background: var(--ft-info-soft);
  font-size: 13px;
  line-height: 1.45;
}
.bn--pending {
  background: var(--ft-warning-soft);
  .bn__icon {
    color: var(--ft-warning);
  }
}
.bn__icon {
  color: var(--ft-info);
  flex: none;
}
.bn__text {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  span {
    color: var(--ft-text-2);
  }
}
.bn__actions {
  display: flex;
  gap: 6px;
}
.bn--compact {
  .bn__text {
    min-width: 0;
    flex-basis: calc(100% - 40px);
  }
  .bn__actions {
    flex-wrap: wrap;
    margin-left: 30px;
  }
}
</style>
